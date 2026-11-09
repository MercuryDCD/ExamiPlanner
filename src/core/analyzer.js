/**
 * ExamPlan Studio — Conflict & Buffer Analyzer Engine
 * Evaluates selected exam calls reactively against scheduling rules:
 * 1. Exact collision (time overlap, 0h margin) -> Critical Error (⛔)
 * 2. Same-day congestion (multiple exams on same date) -> High Warning (⚠️)
 * 3. Critical turnaround (< 24h between consecutive exams) -> Medium Warning (⏳)
 * 4. Multiple calls for the same module -> Informative (ℹ️)
 * 5. Metric Study Buffer between chronological exams:
 *    - >= 7 days: Optimal (Green)
 *    - 3 to 6 days: Acceptable (Yellow/Blue)
 *    - 1 to 2 days: Risk (Orange/Red)
 */

function parseDateTime(dateStr, timeStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(0);
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return new Date(0);
  const [y, m, d] = parts;
  const timeParts = (timeStr || '09:00').split(':').map(Number);
  const hh = isNaN(timeParts[0]) ? 9 : timeParts[0];
  const mm = isNaN(timeParts[1]) ? 0 : timeParts[1];
  // Using UTC to avoid daylight saving and timezone shifts in day diff calculation
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
}

function formatHours(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Enriches all calls in the schedule with metadata from their subject and module.
 * @param {object} schedule Normalized schedule
 * @returns {Map<string, object>} Call map keyed by callId
 */
function buildCallIndex(schedule) {
  const callIndex = new Map();
  if (!schedule || !Array.isArray(schedule.subjects)) return callIndex;

  const allCallsList = [];

  for (const subject of schedule.subjects) {
    const subShort = subject.shortName || (subject.code && subject.code.length <= 6 && !subject.code.includes(' ') ? subject.code : 'ASIG');
    const hasMultipleModules = (subject.modules || []).length > 1;
    for (const module of subject.modules || []) {
      const modShort = module.shortName || '';
      for (const call of module.calls || []) {
        const start = parseDateTime(call.date, call.time || '09:00');
        const durationHours = typeof call.durationHours === 'number' && call.durationHours > 0
          ? call.durationHours
          : 2.5;
        const end = new Date(start.getTime() + durationHours * 3600 * 1000);
        const moduleIds = Array.isArray(call.moduleIds) && call.moduleIds.length > 0
          ? call.moduleIds.map(String)
          : [String(module.id)];

        const item = {
          ...call,
          durationHours,
          startDateTime: start,
          endDateTime: end,
          startTimestamp: start.getTime(),
          endTimestamp: end.getTime(),
          subjectId: subject.id,
          subjectName: subject.name,
          subjectShortName: subShort,
          subjectCode: subject.code,
          subjectColor: subject.color,
          subjectDifficulty: subject.difficulty,
          subjectWeight: subject.defaultWeight || 3,
          moduleWeight: module.defaultWeight || subject.defaultWeight || 3,
          moduleId: module.id,
          moduleName: module.name,
          moduleShortName: modShort,
          moduleCredits: module.credits,
          alreadyPassed: module.alreadyPassed,
          evaluationMode: module.evaluationMode || 'standard',
          oralBinding: module.oralBinding || 'any_subsequent',
          type: call.type || 'standard',
          appelloIndex: call.appelloIndex != null ? call.appelloIndex : null,
          hasMultipleModules,
          moduleIds
        };
        allCallsList.push(item);
      }
    }
  }

  // Detect simultaneous calls of the same subject (Joint Exam Sessions)
  // Key: subjectId + '__' + date + '__' + time
  const jointMap = new Map();
  for (const call of allCallsList) {
    const key = `${call.subjectId}__${call.date}__${call.time || '09:00'}`;
    if (!jointMap.has(key)) {
      jointMap.set(key, []);
    }
    jointMap.get(key).push(call);
  }

  for (const [key, group] of jointMap.entries()) {
    const isJoint = group.length > 1;
    const allModIds = Array.from(new Set(group.flatMap(c => c.moduleIds || [c.moduleId])));
    const modShorts = group.map(c => c.moduleShortName || c.moduleName).filter(Boolean);
    const jointLabel = isJoint ? modShorts.join('+') : '';

    for (const call of group) {
      call.jointExamKey = isJoint ? key : null;
      call.isJointExam = isJoint;
      call.jointModuleIds = allModIds;
      call.jointModuleLabel = jointLabel;
      callIndex.set(call.id, call);
    }
  }

  return callIndex;
}

/**
 * Reactively analyzes the selected calls against scheduling rules.
 * @param {object} schedule Normalized schedule
 * @param {string[]|Set<string>} selectedCallIds List or Set of selected call IDs
 * @param {object} [options] Optional configuration including blockedDates or dayPlans
 * @returns {object} Analysis result
 */
function analyzeSchedule(schedule, selectedCallIds = [], options = {}) {
  const idsArray = Array.isArray(selectedCallIds)
    ? selectedCallIds
    : (selectedCallIds instanceof Set
      ? Array.from(selectedCallIds)
      : (typeof selectedCallIds === 'string' && selectedCallIds ? [selectedCallIds] : []));
  const selectedSet = new Set(idsArray);
  const callIndex = buildCallIndex(schedule);

  // Parse blocked dates from options
  const blockedDates = new Set();
  if (options) {
    if (options.blockedDates) {
      const bArr = Array.isArray(options.blockedDates) ? options.blockedDates : Array.from(options.blockedDates);
      bArr.forEach(d => blockedDates.add(String(d)));
    }
    if (options.dayPlans && typeof options.dayPlans === 'object') {
      Object.entries(options.dayPlans).forEach(([dateStr, plan]) => {
        if (plan && plan.type === 'blocked') {
          blockedDates.add(dateStr);
        }
      });
    }
  }

  // Filter and sort selected calls chronologically
  const activeCalls = [];
  for (const callId of selectedSet) {
    const callData = callIndex.get(callId);
    if (callData) {
      activeCalls.push(callData);
    }
  }

  activeCalls.sort((a, b) => {
    if (a.startTimestamp !== b.startTimestamp) {
      return a.startTimestamp - b.startTimestamp;
    }
    return a.endTimestamp - b.endTimestamp;
  });

  const conflicts = [];
  let exactCollisionCount = 0;
  let sameDateCongestionCount = 0;
  let turnaroundWarningCount = 0;
  let multipleCallsCount = 0;
  let precedenceViolationCount = 0;
  let bindingViolationCount = 0;
  let missingWrittenPrerequisiteCount = 0;

  // 1. Check Exact Collision and Same-Date Congestion
  for (let i = 0; i < activeCalls.length; i++) {
    for (let j = i + 1; j < activeCalls.length; j++) {
      const c1 = activeCalls[i];
      const c2 = activeCalls[j];

      // Simultaneous calls of distinct modules for the SAME subject represent the same physical exam session
      const isSameSubject = c1.subjectId === c2.subjectId;
      const isSimultaneousJoint = isSameSubject && (
        (c1.jointExamKey && c1.jointExamKey === c2.jointExamKey) ||
        (c1.date === c2.date && c1.time === c2.time)
      );

      if (isSimultaneousJoint) {
        // Examen conjunto de módulos de la misma materia: no es colisión
        continue;
      }

      // Exact time overlap: c1.start < c2.end && c2.start < c1.end
      const isOverlapping = c1.startTimestamp < c2.endTimestamp && c2.startTimestamp < c1.endTimestamp;

      if (isOverlapping) {
        exactCollisionCount++;
        conflicts.push({
          id: `collision_${c1.id}_${c2.id}`,
          type: 'exact_collision',
          severity: 'critical',
          icon: '⛔',
          badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
          title: `Colisión Horaria Crítica: ${c1.subjectName} vs ${c2.subjectName}`,
          description: `Solapamiento temporal directo el ${c1.date} entre las ${c1.time} (${c1.durationHours}h) y las ${c2.time} (${c2.durationHours}h). Imposible asistir a ambos.`,
          callIds: [c1.id, c2.id],
          date: c1.date
        });
      } else if (c1.date === c2.date) {
        // Same date, but different non-overlapping hours
        sameDateCongestionCount++;
        conflicts.push({
          id: `congestion_${c1.id}_${c2.id}`,
          type: 'same_date_congestion',
          severity: 'high',
          icon: '⚠️',
          badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
          title: `Sobrecarga Diaria: 2 exámenes el ${c1.date}`,
          description: `${c1.subjectName} (${c1.time}) y ${c2.subjectName} (${c2.time}) coinciden en el mismo día. Alto desgaste cognitivo.`,
          callIds: [c1.id, c2.id],
          date: c1.date
        });
      }
    }
  }

  // 2. Critical Turnaround (< 24h between consecutive exams on different dates or late/early)
  for (let i = 1; i < activeCalls.length; i++) {
    const prev = activeCalls[i - 1];
    const curr = activeCalls[i];

    // Only inspect consecutive calls that are not exact overlaps
    if (prev.date !== curr.date) {
      const gapMs = curr.startTimestamp - prev.endTimestamp;
      const gapHours = gapMs / (1000 * 3600);

      if (gapHours > 0 && gapHours < 24) {
        turnaroundWarningCount++;
        conflicts.push({
          id: `turnaround_${prev.id}_${curr.id}`,
          type: 'critical_turnaround',
          severity: 'medium',
          icon: '⏳',
          badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
          title: `Turnaround Crítico (< 24h de descanso)`,
          description: `Solo hay ${formatHours(gapHours)} entre el fin de ${prev.subjectName} (${prev.date} ${prev.time}) y el inicio de ${curr.subjectName} (${curr.date} ${curr.time}).`,
          callIds: [prev.id, curr.id],
          gapHours: Math.round(gapHours * 10) / 10
        });
      }
    }
  }

  // 3. Multiple calls for the same module and type
  const moduleCallsByTypeMap = new Map();
  for (const call of activeCalls) {
    const key = `${call.moduleId}__${call.type || 'standard'}`;
    if (!moduleCallsByTypeMap.has(key)) {
      moduleCallsByTypeMap.set(key, []);
    }
    moduleCallsByTypeMap.get(key).push(call);
  }

  for (const [key, calls] of moduleCallsByTypeMap.entries()) {
    const distinctDates = new Set(calls.map(c => `${c.date}_${c.time}`));
    if (distinctDates.size > 1) {
      multipleCallsCount++;
      const modName = calls[0].moduleName;
      const typeLabel = calls[0].type === 'written' ? ' (Escrito)' : (calls[0].type === 'oral' ? ' (Oral)' : (calls[0].type === 'lab' ? ' (Lab)' : ''));
      const dates = Array.from(distinctDates).map(dt => dt.split('_')[0]).join(', ');
      conflicts.push({
        id: `multiple_${key}`,
        type: 'multiple_calls',
        severity: 'info',
        icon: 'ℹ️',
        badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
        title: `Convocatoria Adicional / Reserva: ${modName}${typeLabel}`,
        description: `Has seleccionado ${distinctDates.size} llamamientos activos (${dates}) para esta parte del examen. Recuerda que solo debes presentarte a 1 examen por convocatoria (las fechas extra sirven como convocatoria de reserva/recuperación).`,
        callIds: calls.map(c => c.id),
        moduleId: calls[0].moduleId
      });
    }
  }

  // 4. Precedence & Appello Binding Rules for Multi-part Exams
  const activeCallsByModule = new Map();
  for (const call of activeCalls) {
    if (!activeCallsByModule.has(call.moduleId)) {
      activeCallsByModule.set(call.moduleId, []);
    }
    activeCallsByModule.get(call.moduleId).push(call);
  }

  if (schedule && Array.isArray(schedule.subjects)) {
    for (const sub of schedule.subjects) {
      for (const mod of sub.modules || []) {
        if (mod.alreadyPassed) continue;
        const evalMode = mod.evaluationMode || 'standard';
        if (evalMode === 'standard') continue;

        const callsInMod = activeCallsByModule.get(mod.id) || [];
        const writtens = callsInMod.filter(c => c.type === 'written');
        const secondaryType = evalMode === 'written_and_lab' ? 'lab' : 'oral';
        const secondaries = callsInMod.filter(c => c.type === secondaryType);
        const secLabel = evalMode === 'written_and_lab' ? 'práctico/laboratorio' : 'oral';

        // Missing written prerequisite check
        if (secondaries.length > 0 && writtens.length === 0) {
          missingWrittenPrerequisiteCount++;
          conflicts.push({
            id: `missing_written_${mod.id}`,
            type: 'missing_written_prerequisite',
            severity: 'high',
            icon: '⚠️',
            badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
            title: `Falta Examen Escrito Previo: ${mod.name}`,
            description: `Has seleccionado el examen ${secLabel} pero ningún examen escrito para este módulo. No es posible realizar el examen ${secLabel} sin haber realizado previamente el escrito.`,
            callIds: secondaries.map(c => c.id),
            moduleId: mod.id
          });
        }

        // Pairwise precedence & appello binding checks
        for (const w of writtens) {
          for (const s of secondaries) {
            // Precedence: secondary must be strictly after written
            if (s.startTimestamp <= w.startTimestamp) {
              precedenceViolationCount++;
              conflicts.push({
                id: `precedence_${mod.id}_${w.id}_${s.id}`,
                type: 'precedence_violation',
                severity: 'critical',
                icon: '⛔',
                badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
                title: `Violación de Precedencia: ${mod.name}`,
                description: `El examen ${secLabel} (${s.date} ${s.time}) no puede realizarse antes o al mismo tiempo que el examen escrito (${w.date} ${w.time}). Debe ser estrictamente posterior.`,
                callIds: [w.id, s.id],
                moduleId: mod.id,
                date: s.date
              });
            }

            // Appello binding
            if (mod.oralBinding === 'same_appello') {
              if (w.appelloIndex != null && s.appelloIndex != null && w.appelloIndex !== s.appelloIndex) {
                bindingViolationCount++;
                conflicts.push({
                  id: `binding_${mod.id}_${w.id}_${s.id}`,
                  type: 'binding_violation',
                  severity: 'critical',
                  icon: '⛔',
                  badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
                  title: `Vinculación de Appello Incumplida: ${mod.name}`,
                  description: `Esta asignatura exige realizar el examen ${secLabel} en el mismo llamamiento (Appello ${w.appelloIndex}) que el escrito. Has seleccionado el ${secLabel} en el Appello ${s.appelloIndex}.`,
                  callIds: [w.id, s.id],
                  moduleId: mod.id,
                  date: s.date
                });
              }
            } else if (mod.oralBinding === 'any_subsequent') {
              if (w.appelloIndex != null && s.appelloIndex != null && s.appelloIndex < w.appelloIndex) {
                bindingViolationCount++;
                conflicts.push({
                  id: `binding_${mod.id}_${w.id}_${s.id}`,
                  type: 'binding_violation',
                  severity: 'critical',
                  icon: '⛔',
                  badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
                  title: `Llamamiento Inválido: ${mod.name}`,
                  description: `El examen ${secLabel} no puede pertenecer a un llamamiento anterior (Appello ${s.appelloIndex}) al del escrito (Appello ${w.appelloIndex}).`,
                  callIds: [w.id, s.id],
                  moduleId: mod.id,
                  date: s.date
                });
              }
            }
          }
        }
      }
    }
  }

  // 4. Metric Study Buffer and Timeline construction
  // Group simultaneous calls of the same subject into unified sessions for realistic study intervals
  const unifiedActiveSessions = [];
  const processedJointKeys = new Set();

  for (let i = 0; i < activeCalls.length; i++) {
    const call = activeCalls[i];
    const sessionKey = `${call.subjectId}__${call.date}__${call.time || '09:00'}`;

    if (processedJointKeys.has(sessionKey)) continue;

    const partnerCalls = activeCalls.filter(c =>
      c.subjectId === call.subjectId && c.date === call.date && (c.time || '09:00') === (call.time || '09:00')
    );

    if (partnerCalls.length > 1) {
      processedJointKeys.add(sessionKey);
      const combinedModNames = partnerCalls.map(c => c.moduleShortName || c.moduleName).join(' + ');
      const combinedCredits = partnerCalls.reduce((sum, c) => sum + (Number(c.moduleCredits) || 0), 0);
      const allModIds = Array.from(new Set(partnerCalls.flatMap(c => c.moduleIds || [c.moduleId])));

      unifiedActiveSessions.push({
        ...call,
        isJointSession: true,
        partnerCalls,
        moduleName: combinedModNames,
        moduleShortName: partnerCalls.map(c => c.moduleShortName || 'M').join('+'),
        moduleCredits: combinedCredits,
        coveredModuleIds: allModIds,
        callIds: partnerCalls.map(c => c.id)
      });
    } else {
      unifiedActiveSessions.push({
        ...call,
        isJointSession: false,
        partnerCalls: [call],
        coveredModuleIds: call.moduleIds || [call.moduleId],
        callIds: [call.id]
      });
    }
  }

  const timeline = [];
  const bufferIntervals = [];

  for (let i = 0; i < unifiedActiveSessions.length; i++) {
    const call = unifiedActiveSessions[i];
    let bufferBeforeDays = null;
    let bufferBeforeHours = null;
    let bufferCategory = null;

    if (i > 0) {
      const prev = unifiedActiveSessions[i - 1];
      const diffMs = call.startTimestamp - prev.endTimestamp;
      bufferBeforeHours = Math.max(0, diffMs / (1000 * 3600));

      // Calculate calendar day difference
      const prevDate = new Date(prev.date + 'T00:00:00Z');
      const currDate = new Date(call.date + 'T00:00:00Z');
      const rawCalendarDays = Math.round((currDate - prevDate) / (1000 * 3600 * 24));

      // Exclude blocked dates strictly between previous and current exam dates
      let blockedCount = 0;
      const checkDate = new Date(prevDate);
      checkDate.setUTCDate(checkDate.getUTCDate() + 1);
      while (checkDate < currDate) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (blockedDates.has(dStr)) {
          blockedCount++;
        }
        checkDate.setUTCDate(checkDate.getUTCDate() + 1);
      }

      const effectiveBufferDays = Math.max(0, rawCalendarDays - blockedCount);
      bufferBeforeDays = effectiveBufferDays;
      bufferIntervals.push(bufferBeforeDays);

      if (bufferBeforeDays >= 7) {
        bufferCategory = 'optimal';
      } else if (bufferBeforeDays >= 3) {
        bufferCategory = 'acceptable';
      } else if (bufferBeforeDays >= 1) {
        bufferCategory = 'risk';
      } else {
        bufferCategory = 'critical';
      }
    }

    // Days to registration deadline
    let daysToDeadline = null;
    if (call.deadline) {
      const today = new Date();
      const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const deadlineDate = new Date(call.deadline + 'T00:00:00Z');
      daysToDeadline = Math.round((deadlineDate - todayUtc) / (1000 * 3600 * 24));
    }

    // Parachute backup calls in the same module scheduled after this call
    const allModuleCalls = [];
    if (schedule && Array.isArray(schedule.subjects)) {
      for (const sub of schedule.subjects) {
        for (const mod of sub.modules || []) {
          if (call.coveredModuleIds ? call.coveredModuleIds.includes(mod.id) : mod.id === call.moduleId) {
            for (const c of mod.calls || []) {
              const indexed = callIndex.get(c.id);
              if (indexed) allModuleCalls.push(indexed);
            }
          }
        }
      }
    }
    const subsequentCalls = allModuleCalls.filter(c => c.startTimestamp > call.startTimestamp);

    timeline.push({
      call,
      bufferBeforeDays,
      bufferBeforeHours,
      bufferCategory,
      daysToDeadline,
      subsequentCallsCount: subsequentCalls.length,
      subsequentCalls: subsequentCalls.map(c => ({ id: c.id, date: c.date, time: c.time }))
    });
  }

  // Calculate Metrics
  const minBufferDays = bufferIntervals.length > 0 ? Math.min(...bufferIntervals) : 0;
  const totalBufferDays = bufferIntervals.reduce((sum, d) => sum + d, 0);
  const avgBufferDays = bufferIntervals.length > 0
    ? Math.round((totalBufferDays / bufferIntervals.length) * 10) / 10
    : 0;

  let bufferVariance = 0;
  if (bufferIntervals.length > 1) {
    const mean = totalBufferDays / bufferIntervals.length;
    const squaredDiffs = bufferIntervals.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0);
    bufferVariance = Math.round((squaredDiffs / bufferIntervals.length) * 100) / 100;
  }

  // Collect all required modules across subjects
  const allRequiredModules = [];
  let totalAvailableModules = 0;
  if (schedule && Array.isArray(schedule.subjects)) {
    for (const sub of schedule.subjects) {
      for (const mod of sub.modules || []) {
        totalAvailableModules++;
        if (!mod.alreadyPassed) {
          allRequiredModules.push({
            moduleId: mod.id,
            moduleName: mod.name || sub.name,
            moduleShortName: mod.shortName || '',
            evaluationMode: mod.evaluationMode || 'standard',
            oralBinding: mod.oralBinding || 'any_subsequent',
            subjectId: sub.id,
            subjectName: sub.name,
            subjectShortName: sub.shortName || '',
            credits: Number(mod.credits) || Number(sub.credits) || 6,
            callsCount: (mod.calls || []).length
          });
        }
      }
    }
  }

  // Covered modules calculation accounting for joint sessions and multi-part requirements
  const coveredModuleIds = new Set();
  for (const mod of allRequiredModules) {
    const modCalls = activeCalls.filter(c =>
      c.moduleId === mod.moduleId ||
      (Array.isArray(c.moduleIds) && c.moduleIds.includes(mod.moduleId)) ||
      (Array.isArray(c.jointModuleIds) && c.jointModuleIds.includes(mod.moduleId))
    );

    if (mod.evaluationMode === 'written_and_oral') {
      const hasWritten = modCalls.some(c => c.type === 'written');
      const hasOral = modCalls.some(c => c.type === 'oral');
      if (hasWritten && hasOral) {
        coveredModuleIds.add(mod.moduleId);
      }
    } else if (mod.evaluationMode === 'written_and_lab') {
      const hasWritten = modCalls.some(c => c.type === 'written');
      const hasLab = modCalls.some(c => c.type === 'lab');
      if (hasWritten && hasLab) {
        coveredModuleIds.add(mod.moduleId);
      }
    } else {
      if (modCalls.length > 0) {
        coveredModuleIds.add(mod.moduleId);
      }
    }
  }

  // Count distinct selected credits from covered modules
  let totalCredits = 0;
  for (const mod of allRequiredModules) {
    if (coveredModuleIds.has(mod.moduleId)) {
      totalCredits += Number(mod.credits) || 0;
    }
  }

  const coveredModules = allRequiredModules.filter(m => coveredModuleIds.has(m.moduleId));
  const uncoveredModules = allRequiredModules.filter(m => !coveredModuleIds.has(m.moduleId));
  const totalRequiredModules = allRequiredModules.length;
  const coveredModulesCount = coveredModules.length;
  const coveragePercentage = totalRequiredModules > 0
    ? Math.round((coveredModulesCount / totalRequiredModules) * 100)
    : 100;
  const isAllModulesCovered = uncoveredModules.length === 0;

  // Warning alert if there are uncovered required exam modules
  if (uncoveredModules.length > 0 && activeCalls.length > 0) {
    const missingNames = uncoveredModules.map(m => `${m.subjectName} (${m.moduleName})`).join(', ');
    conflicts.push({
      id: 'uncovered_modules_alert',
      type: 'uncovered_modules',
      severity: 'medium',
      icon: '📋',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      title: `Módulos obligatorios pendientes de programar (${uncoveredModules.length})`,
      description: `Aún no has seleccionado fecha para: ${missingNames}. Recuerda que debes elegir obligatoriamente 1 fecha de examen por cada módulo.`,
      callIds: [],
      uncoveredCount: uncoveredModules.length,
      uncoveredModules
    });
  }

  const targetCredits = Number(schedule?.meta?.targetCredits) || totalCredits;

  return {
    selectedCalls: activeCalls,
    conflicts,
    hasCriticalErrors: exactCollisionCount > 0 || precedenceViolationCount > 0 || bindingViolationCount > 0,
    counts: {
      exactCollisions: exactCollisionCount,
      sameDateCongestions: sameDateCongestionCount,
      turnaroundWarnings: turnaroundWarningCount,
      multipleCalls: multipleCallsCount,
      precedenceViolations: precedenceViolationCount,
      bindingViolations: bindingViolationCount,
      missingWrittenPrerequisites: missingWrittenPrerequisiteCount,
      uncoveredModules: uncoveredModules.length,
      totalConflicts: conflicts.length
    },
    timeline,
    metrics: {
      minBufferDays,
      avgBufferDays,
      totalBufferDays,
      bufferVariance,
      totalCredits,
      targetCredits,
      isTargetCreditsMet: totalCredits >= targetCredits,
      selectedModulesCount: coveredModuleIds.size,
      totalModulesCount: totalAvailableModules,
      totalRequiredModules,
      coveredModulesCount,
      uncoveredModules,
      coveragePercentage,
      isAllModulesCovered,
      totalParachuteOpportunities: timeline.reduce((acc, t) => acc + (t.subsequentCallsCount || 0), 0)
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    analyzeSchedule,
    buildCallIndex,
    parseDateTime
  };
}

if (typeof window !== 'undefined') {
  window.ExamPlannerAnalyzer = {
    analyzeSchedule,
    buildCallIndex,
    parseDateTime
  };
}
