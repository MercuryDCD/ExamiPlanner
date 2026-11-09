      function optimizeSchedule(sched, optionsOrMode = {}, maybeOptions = {}) {
        let resolved = {};
        if (typeof optionsOrMode === 'string') {
          resolved = { mode: optionsOrMode, ...(maybeOptions || {}) };
        } else {
          resolved = { ...(optionsOrMode || {}), ...(maybeOptions || {}) };
        }
        const mode = resolved.mode === 'weighted-difficulty' ? 'weighted-difficulty' : 'max-spacing';
        const customWeights = resolved.weights || state.subjectWeights || {};
        const fixedSet = new Set(Array.isArray(resolved.fixedCallIds) ? resolved.fixedCallIds : []);

        const blockedDates = new Set();
        if (resolved) {
          if (resolved.blockedDates) {
            const bArr = Array.isArray(resolved.blockedDates) ? resolved.blockedDates : Array.from(resolved.blockedDates);
            bArr.forEach(d => blockedDates.add(String(d)));
          }
          if (resolved.dayPlans && typeof resolved.dayPlans === 'object') {
            Object.entries(resolved.dayPlans).forEach(([dateStr, plan]) => {
              if (plan && plan.type === 'blocked') {
                blockedDates.add(dateStr);
              }
            });
          }
        }
        if (blockedDates.size === 0 && typeof state !== 'undefined' && state.dayPlans) {
          Object.entries(state.dayPlans).forEach(([dateStr, plan]) => {
            if (plan && plan.type === 'blocked') {
              blockedDates.add(dateStr);
            }
          });
        }

        let safetyFactor = 0;
        if (typeof resolved.prioritizeSafety === 'number') {
          safetyFactor = Math.max(0, resolved.prioritizeSafety);
        } else if (resolved.prioritizeSafety === true || (resolved.prioritizeSafety === undefined && state.prioritizeSafety)) {
          safetyFactor = 1.5;
        } else if (typeof resolved.safetyWeight === 'number') {
          safetyFactor = Math.max(0, resolved.safetyWeight);
        }

        const callMap = buildCallIndex(sched);

        const moduleAllCallsMap = new Map();
        (sched.subjects || []).forEach(sub => {
          (sub.modules || []).forEach(mod => {
            const all = (mod.calls || []).map(c => callMap.get(c.id)).filter(Boolean);
            moduleAllCallsMap.set(mod.id, all);
          });
        });

        const modulesToSchedule = [];
        let earliestTimestamp = Infinity;

        (sched.subjects || []).forEach(sub => {
          (sub.modules || []).forEach(mod => {
            if (mod.alreadyPassed) return;
            const modWeight = typeof customWeights[mod.id] === 'number'
              ? Math.max(1, Math.min(5, Number(customWeights[mod.id])))
              : (typeof customWeights[sub.id] === 'number'
                ? Math.max(1, Math.min(5, Number(customWeights[sub.id])))
                : (mod.defaultWeight || sub.defaultWeight || 3));

            const valid = (mod.calls || []).map(c => callMap.get(c.id)).filter(Boolean);
            if (valid.length === 0) return;
            valid.forEach(c => {
              if (c.startTimestamp < earliestTimestamp) earliestTimestamp = c.startTimestamp;
            });
            const evalMode = mod.evaluationMode || 'standard';
            const oralBinding = mod.oralBinding || 'any_subsequent';
            let candidates = [];

            if (evalMode === 'written_and_oral' || evalMode === 'written_and_lab') {
              const secType = evalMode === 'written_and_lab' ? 'lab' : 'oral';
              let writtens = valid.filter(c => c.type === 'written');
              let secondaries = valid.filter(c => c.type === secType);

              if (writtens.length === 0 || secondaries.length === 0) {
                const fixedCall = valid.find(c => fixedSet.has(c.id));
                candidates = (fixedCall ? [fixedCall] : valid).map(c => [c]);
              } else {
                if (fixedSet.size > 0) {
                  const fixedW = writtens.filter(c => fixedSet.has(c.id));
                  if (fixedW.length > 0) writtens = fixedW;
                  const fixedS = secondaries.filter(c => fixedSet.has(c.id));
                  if (fixedS.length > 0) secondaries = fixedS;
                }

                for (const w of writtens) {
                  for (const s of secondaries) {
                    if (w.startTimestamp >= s.startTimestamp) continue;
                    if (w.endTimestamp > s.startTimestamp) continue;

                    if (oralBinding === 'same_appello') {
                      if (w.appelloIndex != null && s.appelloIndex != null && w.appelloIndex !== s.appelloIndex) {
                        continue;
                      }
                    } else if (oralBinding === 'any_subsequent') {
                      if (w.appelloIndex != null && s.appelloIndex != null && s.appelloIndex < w.appelloIndex) {
                        continue;
                      }
                    }

                    candidates.push([w, s]);
                  }
                }

                if (candidates.length === 0) {
                  for (const w of writtens) {
                    for (const s of secondaries) {
                      if (w.startTimestamp < s.startTimestamp) {
                        candidates.push([w, s]);
                      }
                    }
                  }
                  if (candidates.length === 0) {
                    candidates = valid.map(c => [c]);
                  }
                }
              }
            } else {
              const fixedCall = valid.find(c => fixedSet.has(c.id));
              candidates = (fixedCall ? [fixedCall] : valid).map(c => [c]);
            }

            modulesToSchedule.push({ module: mod, subject: sub, weight: modWeight, candidates });
          });
        });

        if (modulesToSchedule.length === 0) {
          return {
            selectedCallIds: [],
            mode,
            score: 0,
            minBufferDays: 0,
            avgBufferDays: 0,
            totalBufferDays: 0,
            bufferVariance: 0,
            safetyBonus: 0
          };
        }

        const baseline = earliestTimestamp !== Infinity ? earliestTimestamp - (7 * 24 * 3600 * 1000) : Date.now();
        let bestSelection = null;
        let bestScore = -Infinity;
        let bestMetrics = null;

        function search(idx, current) {
          if (idx === modulesToSchedule.length) {
            const sorted = [...current].sort((a, b) => a.startTimestamp - b.startTimestamp);

            // Group simultaneous calls of the same subject into unique exam sessions
            const sessionMap = new Map();
            for (const c of sorted) {
              const sessKey = `${c.subjectId}__${c.date}__${c.time || '09:00'}`;
              const typeKeyMod = (c.type && c.type !== 'standard') ? `${c.moduleId}__${c.type}` : null;
                const typeKeySub = (c.type && c.type !== 'standard') ? `${c.subjectId}__${c.type}` : null;

                let rawW;
                if (typeKeyMod && typeof customWeights[typeKeyMod] === 'number') {
                  rawW = customWeights[typeKeyMod];
                } else if (typeKeySub && typeof customWeights[typeKeySub] === 'number') {
                  rawW = customWeights[typeKeySub];
                } else if (typeof customWeights[c.moduleId] === 'number') {
                  rawW = customWeights[c.moduleId];
                } else if (typeof customWeights[c.subjectId] === 'number') {
                  rawW = customWeights[c.subjectId];
                } else {
                  rawW = c.moduleWeight || c.subjectWeight || 3;
                }
                const cWeight = Math.max(1, Math.min(5, Number(rawW)));

              if (!sessionMap.has(sessKey)) {
                sessionMap.set(sessKey, {
                  ...c,
                  calls: [c],
                  combinedWeight: cWeight
                });
              } else {
                const existing = sessionMap.get(sessKey);
                existing.calls.push(c);
                existing.combinedWeight = Math.min(5, Math.max(existing.combinedWeight, cWeight) + 0.2);
              }
            }

            const uniqueSessions = Array.from(sessionMap.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);

            const intervals = [];
            let penalties = 0;

            const firstDelta = Math.max(0, (uniqueSessions[0].startTimestamp - baseline) / (24 * 3600 * 1000));
            intervals.push(firstDelta);

            for (let i = 1; i < uniqueSessions.length; i++) {
              const diffH = (uniqueSessions[i].startTimestamp - uniqueSessions[i - 1].endTimestamp) / (3600 * 1000);
              let diffD = Math.max(0, diffH / 24);

              if (blockedDates.size > 0) {
                let blockedCount = 0;
                const prevDate = new Date(uniqueSessions[i - 1].date + 'T00:00:00Z');
                const currDate = new Date(uniqueSessions[i].date + 'T00:00:00Z');
                const checkDate = new Date(prevDate);
                checkDate.setUTCDate(checkDate.getUTCDate() + 1);
                while (checkDate < currDate) {
                  const dStr = checkDate.toISOString().split('T')[0];
                  if (blockedDates.has(dStr)) blockedCount++;
                  checkDate.setUTCDate(checkDate.getUTCDate() + 1);
                }
                diffD = Math.max(0, diffD - blockedCount);
              }

              intervals.push(diffD);

              if (uniqueSessions[i - 1].date === uniqueSessions[i].date) penalties += 40;
              else if (diffH > 0 && diffH < 24) penalties += 20;
            }

            const interIntervals = intervals.slice(1);
            const minB = interIntervals.length > 0 ? Math.min(...interIntervals) : firstDelta;
            const totalB = interIntervals.length > 0 ? interIntervals.reduce((a, b) => a + b, 0) : firstDelta;
            const avgB = interIntervals.length > 0 ? totalB / interIntervals.length : firstDelta;
            let variance = 0;
            if (interIntervals.length > 1) {
              variance = interIntervals.reduce((s, v) => s + Math.pow(v - avgB, 2), 0) / interIntervals.length;
            }

            let safetyBonus = 0;
            for (let i = 0; i < sorted.length; i++) {
              const item = sorted[i];
              const allModCalls = moduleAllCallsMap.get(item.moduleId) || [];
              const rem = allModCalls.filter(other => other.startTimestamp > item.startTimestamp).length;
              const typeKeyMod = (item.type && item.type !== 'standard') ? `${item.moduleId}__${item.type}` : null;
                const typeKeySub = (item.type && item.type !== 'standard') ? `${item.subjectId}__${item.type}` : null;
                let rawW;
                if (typeKeyMod && typeof customWeights[typeKeyMod] === 'number') {
                  rawW = customWeights[typeKeyMod];
                } else if (typeKeySub && typeof customWeights[typeKeySub] === 'number') {
                  rawW = customWeights[typeKeySub];
                } else if (typeof customWeights[item.moduleId] === 'number') {
                  rawW = customWeights[item.moduleId];
                } else if (typeof customWeights[item.subjectId] === 'number') {
                  rawW = customWeights[item.subjectId];
                } else {
                  rawW = item.moduleWeight || item.subjectWeight || 3;
                }
                const weight = Math.max(1, Math.min(5, Number(rawW)));
              safetyBonus += weight * rem;
            }

            let score = 0;
            if (mode === 'max-spacing') {
              let effectiveMinBuffer = minB;
              if (safetyFactor > 0 && minB >= 7) {
                effectiveMinBuffer = 7 + Math.min(minB - 7, 7) * 0.1 + Math.max(0, minB - 14) * 0.01;
              }
              score = (effectiveMinBuffer * 1000) + (totalB * 10) - (variance * 2) + (safetyFactor * safetyBonus * 200) - (penalties * 15);
            } else {
              let weightedSum = 0;
              for (let i = 0; i < uniqueSessions.length; i++) {
                const weight = uniqueSessions[i].combinedWeight;
                weightedSum += weight * Math.log(1 + intervals[i]);
              }
              score = weightedSum + (safetyFactor * safetyBonus * 1.5) - penalties;
            }

            if (score > bestScore) {
              bestScore = score;
              bestSelection = sorted.map(c => c.id);
              bestMetrics = {
                minBufferDays: Math.round(minB * 10) / 10,
                avgBufferDays: Math.round(avgB * 10) / 10,
                totalBufferDays: Math.round(totalB * 10) / 10,
                bufferVariance: Math.round(variance * 10) / 10,
                safetyBonus: Math.round(safetyBonus * 10) / 10
              };
            }
            return;
          }

          const { candidates } = modulesToSchedule[idx];
          for (let i = 0; i < candidates.length; i++) {
            const callTuple = candidates[i];
            let collides = false;
            for (let t = 0; t < callTuple.length; t++) {
              const candidate = callTuple[t];
              for (let s = 0; s < current.length; s++) {
                const existing = current[s];
                const isSameSubjectJoint = candidate.subjectId === existing.subjectId && (
                  (candidate.jointExamKey && candidate.jointExamKey === existing.jointExamKey) ||
                  (candidate.date === existing.date && candidate.time === existing.time)
                );
                if (isSameSubjectJoint) {
                  continue;
                }
                if (candidate.startTimestamp < existing.endTimestamp && existing.startTimestamp < candidate.endTimestamp) {
                  collides = true;
                  break;
                }
              }
              if (collides) break;
            }
            if (collides) continue;
            current.push(...callTuple);
            search(idx + 1, current);
            current.splice(current.length - callTuple.length, callTuple.length);
          }
        }

        search(0, []);
        const chosenIds = bestSelection || modulesToSchedule.flatMap(m => m.candidates[0] || []).map(c => c.id);
        return {
          selectedCallIds: chosenIds,
          mode,
          score: Math.round(bestScore * 100) / 100,
          minBufferDays: bestMetrics?.minBufferDays || 0,
          avgBufferDays: bestMetrics?.avgBufferDays || 0,
          totalBufferDays: bestMetrics?.totalBufferDays || 0,
          bufferVariance: bestMetrics?.bufferVariance || 0,
          safetyBonus: bestMetrics?.safetyBonus || 0
        };
      }

      // --- UI Rendering ---
