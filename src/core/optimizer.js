/**
 * ExamPlan Studio — Combinatorial Optimization Engine
 * Deterministic branch-and-bound search for the optimal selection of exam calls
 * (1 call per pending module).
 *
 * Supports two primary modes:
 * 1. 'max-spacing': Maximizes the bottleneck buffer max(min(Δt_i)),
 *    with tie-breakers: max sum(Δt_i) and min variance(Δt_i).
 * 2. 'weighted-difficulty': Uses user-configurable subject weights w_j in [1, 5]
 *    Fitness = sum( w_{e_i} * ln(1 + Δt_i) ) - Penalties
 */

const analyzer = typeof require !== 'undefined'
  ? require('./analyzer')
  : (typeof window !== 'undefined' ? window.ExamPlannerAnalyzer : {});
const buildCallIndex = analyzer?.buildCallIndex || function() { return new Map(); };

/**
 * Optimizes exam call selection according to the chosen strategy.
 * @param {object} schedule Normalized schedule
 * @param {object|string} [options] Options object or mode string ('max-spacing' | 'weighted-difficulty')
 * @param {'max-spacing'|'weighted-difficulty'} [options.mode='max-spacing']
 * @param {Record<string, number>} [options.weights={}]
 * @param {string[]} [options.fixedCallIds=[]]
 * @param {string} [options.sessionStartDate]
 * @returns {object} Optimization result
 */
function optimizeSchedule(schedule, optionsOrMode = {}, maybeOptions = {}) {
  let resolvedOptions = {};
  if (typeof optionsOrMode === 'string') {
    resolvedOptions = { mode: optionsOrMode, ...(maybeOptions || {}) };
  } else {
    resolvedOptions = { ...(optionsOrMode || {}), ...(maybeOptions || {}) };
  }
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const mode = resolvedOptions.mode === 'weighted-difficulty' ? 'weighted-difficulty' : 'max-spacing';
  const customWeights = resolvedOptions.weights || {};
  const fixedSet = new Set(resolvedOptions.fixedCallIds || []);

  // Parse blocked dates from options
  const blockedDates = new Set();
  if (resolvedOptions) {
    if (resolvedOptions.blockedDates) {
      const bArr = Array.isArray(resolvedOptions.blockedDates) ? resolvedOptions.blockedDates : Array.from(resolvedOptions.blockedDates);
      bArr.forEach(d => blockedDates.add(String(d)));
    }
    if (resolvedOptions.dayPlans && typeof resolvedOptions.dayPlans === 'object') {
      Object.entries(resolvedOptions.dayPlans).forEach(([dateStr, plan]) => {
        if (plan && plan.type === 'blocked') {
          blockedDates.add(dateStr);
        }
      });
    }
  }

  const callIndex = buildCallIndex(schedule);

  // Parachute safety factor: rewards early calls when they leave remaining backup attempts
  let safetyFactor = 0;
  if (typeof resolvedOptions.prioritizeSafety === 'number') {
    safetyFactor = Math.max(0, resolvedOptions.prioritizeSafety);
  } else if (resolvedOptions.prioritizeSafety === true) {
    safetyFactor = 1.5;
  } else if (typeof resolvedOptions.safetyWeight === 'number') {
    safetyFactor = Math.max(0, resolvedOptions.safetyWeight);
  }

  // Index all calls per module to quickly calculate remaining parachute opportunities
  const moduleAllCallsMap = new Map();
  for (const subject of schedule.subjects || []) {
    for (const module of subject.modules || []) {
      const allCalls = (module.calls || [])
        .map(c => callIndex.get(c.id))
        .filter(Boolean);
      moduleAllCallsMap.set(module.id, allCalls);
    }
  }

  // Collect modules to schedule (filter out already passed)
  const modulesToSchedule = [];
  let earliestCallTimestamp = Infinity;

  for (const subject of schedule.subjects || []) {
    for (const module of subject.modules || []) {
      if (module.alreadyPassed) continue;

      const modWeight = typeof customWeights[module.id] === 'number'
        ? Math.max(1, Math.min(5, Number(customWeights[module.id])))
        : (typeof customWeights[subject.id] === 'number'
          ? Math.max(1, Math.min(5, Number(customWeights[subject.id])))
          : (module.defaultWeight || subject.defaultWeight || 3));

      const validCalls = (module.calls || [])
        .map(c => callIndex.get(c.id))
        .filter(Boolean);

      if (validCalls.length === 0) continue;

      for (const call of validCalls) {
        if (call.startTimestamp < earliestCallTimestamp) {
          earliestCallTimestamp = call.startTimestamp;
        }
      }

      // If user has fixed a call for this module, restrict to that call only
      const fixedCall = validCalls.find(c => fixedSet.has(c.id));
      const candidates = fixedCall ? [fixedCall] : validCalls;

      modulesToSchedule.push({
        module,
        subject,
        weight: modWeight,
        calls: candidates
      });
    }
  }

  if (modulesToSchedule.length === 0) {
    return {
      selectedCallIds: [],
      mode,
      score: 0,
      minBufferDays: 0,
      avgBufferDays: 0,
      totalBufferDays: 0,
      bufferVariance: 0,
      executionTimeMs: 0,
      evaluatedCombinations: 0
    };
  }

  // Determine baseline session start for delta t of the first exam
  let baselineStartTimestamp;
  if (resolvedOptions.sessionStartDate) {
    const [y, m, d] = resolvedOptions.sessionStartDate.split('-').map(Number);
    baselineStartTimestamp = Date.UTC(y, m - 1, d, 8, 0, 0);
  } else if (earliestCallTimestamp !== Infinity) {
    // Default: 7 days before the earliest call
    baselineStartTimestamp = earliestCallTimestamp - (7 * 24 * 3600 * 1000);
  } else {
    baselineStartTimestamp = Date.now();
  }

  let evaluatedCount = 0;
  let bestCombination = null;
  let bestScore = -Infinity;
  let bestMetrics = null;

  // Branch and bound search
  function search(moduleIndex, currentSelection) {
    if (moduleIndex === modulesToSchedule.length) {
      evaluatedCount++;
      evaluateCombination(currentSelection);
      return;
    }

    const { calls } = modulesToSchedule[moduleIndex];

    for (let c = 0; c < calls.length; c++) {
      const call = calls[c];

      // Prune branch: check if this call directly has an exact collision with any already selected call
      let collides = false;
      for (let s = 0; s < currentSelection.length; s++) {
        const existing = currentSelection[s];

        // Simultaneous calls of distinct modules for the SAME subject represent the same physical exam
        const isSameSubjectJoint = call.subjectId === existing.subjectId && (
          (call.jointExamKey && call.jointExamKey === existing.jointExamKey) ||
          (call.date === existing.date && call.time === existing.time)
        );

        if (isSameSubjectJoint) {
          // Same joint exam: allowed to be taken together without collision
          continue;
        }

        if (call.startTimestamp < existing.endTimestamp && existing.startTimestamp < call.endTimestamp) {
          collides = true;
          break;
        }
      }

      if (collides) {
        // Prune: do not explore branches with critical collisions
        continue;
      }

      currentSelection.push(call);
      search(moduleIndex + 1, currentSelection);
      currentSelection.pop();
    }
  }

  function evaluateCombination(combination) {
    // Sort chronologically
    const sorted = [...combination].sort((a, b) => a.startTimestamp - b.startTimestamp);

    // Group simultaneous calls of the same subject into unique exam appointments
    const sessionMap = new Map();
    for (const c of sorted) {
      const sessKey = `${c.subjectId}__${c.date}__${c.time || '09:00'}`;
      const cWeight = typeof customWeights[c.moduleId] === 'number'
        ? Math.max(1, Math.min(5, Number(customWeights[c.moduleId])))
        : (typeof customWeights[c.subjectId] === 'number'
          ? Math.max(1, Math.min(5, Number(customWeights[c.subjectId])))
          : (c.moduleWeight || c.subjectWeight || 3));

      if (!sessionMap.has(sessKey)) {
        sessionMap.set(sessKey, {
          ...c,
          calls: [c],
          combinedWeight: cWeight
        });
      } else {
        const existingSession = sessionMap.get(sessKey);
        existingSession.calls.push(c);
        existingSession.combinedWeight = Math.min(5, Math.max(existingSession.combinedWeight, cWeight) + 0.2);
      }
    }

    const uniqueSessions = Array.from(sessionMap.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);

    const intervals = [];
    let penalties = 0;

    // Buffer for first exam from session start
    const firstBufferDays = Math.max(0, (uniqueSessions[0].startTimestamp - baselineStartTimestamp) / (24 * 3600 * 1000));
    intervals.push(firstBufferDays);

    for (let i = 1; i < uniqueSessions.length; i++) {
      const prev = uniqueSessions[i - 1];
      const curr = uniqueSessions[i];

      // Gap between consecutive exams in days (floating point)
      const diffHours = (curr.startTimestamp - prev.endTimestamp) / (3600 * 1000);
      let diffDays = Math.max(0, diffHours / 24);

      if (blockedDates.size > 0) {
        let blockedCount = 0;
        const prevDate = new Date(prev.date + 'T00:00:00Z');
        const currDate = new Date(curr.date + 'T00:00:00Z');
        const checkDate = new Date(prevDate);
        checkDate.setUTCDate(checkDate.getUTCDate() + 1);
        while (checkDate < currDate) {
          const dStr = checkDate.toISOString().split('T')[0];
          if (blockedDates.has(dStr)) blockedCount++;
          checkDate.setUTCDate(checkDate.getUTCDate() + 1);
        }
        diffDays = Math.max(0, diffDays - blockedCount);
      }

      intervals.push(diffDays);

      // Same date penalty (only between distinct exam sessions)
      if (prev.date === curr.date) {
        penalties += 40;
      } else if (diffHours > 0 && diffHours < 24) {
        // Turnaround < 24h penalty
        penalties += 20;
      }
    }

    // Consecutive exam intervals excluding baseline for pure inter-exam buffer metrics
    const interExamIntervals = intervals.slice(1);
    const minBuffer = interExamIntervals.length > 0 ? Math.min(...interExamIntervals) : firstBufferDays;
    const totalBuffer = interExamIntervals.length > 0 ? interExamIntervals.reduce((s, v) => s + v, 0) : firstBufferDays;
    const avgBuffer = interExamIntervals.length > 0 ? totalBuffer / interExamIntervals.length : firstBufferDays;

    let variance = 0;
    if (interExamIntervals.length > 1) {
      const mean = avgBuffer;
      variance = interExamIntervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / interExamIntervals.length;
    }

    // Calculate parachute safety bonus for this combination
    let safetyBonus = 0;
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const allModCalls = moduleAllCallsMap.get(item.moduleId) || [];
      const remainingOpportunities = allModCalls.filter(c => c.startTimestamp > item.startTimestamp).length;
      const weight = typeof customWeights[item.moduleId] === 'number'
        ? Math.max(1, Math.min(5, Number(customWeights[item.moduleId])))
        : (typeof customWeights[item.subjectId] === 'number'
          ? Math.max(1, Math.min(5, Number(customWeights[item.subjectId])))
          : (item.moduleWeight || item.subjectWeight || 3));
      safetyBonus += weight * remainingOpportunities;
    }

    let score = 0;

    if (mode === 'max-spacing') {
      let effectiveMinBuffer = minBuffer;
      if (safetyFactor > 0 && minBuffer >= 7) {
        effectiveMinBuffer = 7 + Math.min(minBuffer - 7, 7) * 0.1 + Math.max(0, minBuffer - 14) * 0.01;
      }
      score = (effectiveMinBuffer * 1000) + (totalBuffer * 10) - (variance * 2) + (safetyFactor * safetyBonus * 200) - (penalties * 15);
    } else {
      // Weighted difficulty mode:
      // Score = sum( w_{e_i} * ln(1 + Δt_i) ) + (safetyFactor * safetyBonus * 1.5) - penalties
      let weightedSum = 0;
      for (let i = 0; i < uniqueSessions.length; i++) {
        const item = uniqueSessions[i];
        const weight = item.combinedWeight;
        const deltaT = intervals[i];
        weightedSum += weight * Math.log(1 + deltaT);
      }
      score = weightedSum + (safetyFactor * safetyBonus * 1.5) - penalties;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCombination = sorted;
      bestMetrics = {
        minBufferDays: Math.round(minBuffer * 10) / 10,
        avgBufferDays: Math.round(avgBuffer * 10) / 10,
        totalBufferDays: Math.round(totalBuffer * 10) / 10,
        bufferVariance: Math.round(variance * 10) / 10,
        safetyBonus: Math.round(safetyBonus * 10) / 10,
        penalties
      };
    }
  }

  // Execute branch-and-bound
  search(0, []);

  // Fallback if all combinations had collisions: pick greedy best-effort
  if (!bestCombination && modulesToSchedule.length > 0) {
    bestCombination = modulesToSchedule.map(m => m.calls[0]);
    bestScore = -9999;
    bestMetrics = {
      minBufferDays: 0,
      avgBufferDays: 0,
      totalBufferDays: 0,
      bufferVariance: 0,
      safetyBonus: 0,
      penalties: 100
    };
  }

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

  return {
    selectedCallIds: (bestCombination || []).map(c => c.id),
    mode,
    score: Math.round(bestScore * 100) / 100,
    minBufferDays: bestMetrics?.minBufferDays || 0,
    avgBufferDays: bestMetrics?.avgBufferDays || 0,
    totalBufferDays: bestMetrics?.totalBufferDays || 0,
    bufferVariance: bestMetrics?.bufferVariance || 0,
    safetyBonus: bestMetrics?.safetyBonus || 0,
    executionTimeMs,
    evaluatedCombinations: evaluatedCount
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    optimizeSchedule
  };
}

if (typeof window !== 'undefined') {
  window.ExamPlannerOptimizer = {
    optimizeSchedule
  };
}
