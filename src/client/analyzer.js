      function parseDateTime(dateStr, timeStr) {
        if (!dateStr || typeof dateStr !== 'string') return new Date(0);
        const parts = dateStr.split('-').map(Number);
        if (parts.length < 3 || parts.some(isNaN)) return new Date(0);
        const [y, m, d] = parts;
        const timeParts = (timeStr || '09:00').split(':').map(Number);
        const hh = isNaN(timeParts[0]) ? 9 : timeParts[0];
        const mm = isNaN(timeParts[1]) ? 0 : timeParts[1];
        return new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
      }

      function buildCallIndex(sched) {
        const map = new Map();
        if (!sched || !Array.isArray(sched.subjects)) return map;

        const allCallsList = [];

        (sched.subjects || []).forEach(sub => {
          const subShort = sub.shortName || (sub.code && sub.code.length <= 6 && !sub.code.includes(' ') ? sub.code : generateSubjectAcronym(sub.name));
          (sub.modules || []).forEach(mod => {
            const modShort = mod.shortName || '';
            (mod.calls || []).forEach(c => {
              const start = parseDateTime(c.date, c.time || '09:00');
              const durationHours = typeof c.durationHours === 'number' && c.durationHours > 0 ? c.durationHours : 2.5;
              const end = new Date(start.getTime() + durationHours * 3600 * 1000);
              const moduleIds = Array.isArray(c.moduleIds) && c.moduleIds.length > 0
                ? c.moduleIds.map(String)
                : [String(mod.id)];

              const item = {
                ...c,
                durationHours,
                startDateTime: start,
                endDateTime: end,
                startTimestamp: start.getTime(),
                endTimestamp: end.getTime(),
                subjectId: sub.id,
                subjectName: sub.name,
                subjectShortName: subShort,
                subjectCode: sub.code,
                subjectColor: sub.color,
                subjectDifficulty: sub.difficulty,
                subjectWeight: (typeof state !== 'undefined' && state.subjectWeights && state.subjectWeights[sub.id]) || sub.defaultWeight || 3,
                moduleWeight: (typeof state !== 'undefined' && state.subjectWeights && state.subjectWeights[mod.id]) || (typeof state !== 'undefined' && state.subjectWeights && state.subjectWeights[sub.id]) || mod.defaultWeight || sub.defaultWeight || 3,
                moduleId: mod.id,
                moduleName: mod.name,
                moduleShortName: modShort,
                moduleCredits: mod.credits || sub.credits,
                alreadyPassed: mod.alreadyPassed,
                evaluationMode: mod.evaluationMode || 'standard',
                oralBinding: mod.oralBinding || 'any_subsequent',
                type: c.type || 'standard',
                appelloIndex: c.appelloIndex != null ? c.appelloIndex : null,
                hasMultipleModules: (sub.modules || []).length > 1,
                moduleIds
              };
              allCallsList.push(item);
            });
          });
        });

        // Detect simultaneous calls of the same subject (Joint Exam Sessions)
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
            map.set(call.id, call);
          }
        }

        return map;
      }

      function analyzeSchedule(sched, selectedIds, options = {}) {
        const callMap = buildCallIndex(sched);
        const idsArray = Array.isArray(selectedIds)
          ? selectedIds
          : (selectedIds instanceof Set
            ? Array.from(selectedIds)
            : (typeof selectedIds === 'string' && selectedIds ? [selectedIds] : []));
        const active = [];
        idsArray.forEach(id => {
          const call = callMap.get(id);
          if (call) active.push(call);
        });

        // Parse blocked dates from options or state
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
        if (blockedDates.size === 0 && typeof state !== 'undefined' && state.dayPlans) {
          Object.entries(state.dayPlans).forEach(([dateStr, plan]) => {
            if (plan && plan.type === 'blocked') {
              blockedDates.add(dateStr);
            }
          });
        }

        active.sort((a, b) => a.startTimestamp - b.startTimestamp || a.endTimestamp - b.endTimestamp);

        const conflicts = [];
        let exactCollisionCount = 0;
        let sameDateCongestionCount = 0;
        let turnaroundWarningCount = 0;
        let multipleCallsCount = 0;
        let precedenceViolationCount = 0;
        let bindingViolationCount = 0;
        let missingWrittenPrerequisiteCount = 0;

        // Collision & Congestion
        for (let i = 0; i < active.length; i++) {
          for (let j = i + 1; j < active.length; j++) {
            const c1 = active[i];
            const c2 = active[j];

            const isSameSubject = c1.subjectId === c2.subjectId;
            const isSimultaneousJoint = isSameSubject && (
              (c1.jointExamKey && c1.jointExamKey === c2.jointExamKey) ||
              (c1.date === c2.date && (c1.time || '09:00') === (c2.time || '09:00'))
            );

            if (isSimultaneousJoint) {
              continue;
            }

            const isOverlap = c1.startTimestamp < c2.endTimestamp && c2.startTimestamp < c1.endTimestamp;
            if (isOverlap) {
              exactCollisionCount++;
              conflicts.push({
                id: `col_${c1.id}_${c2.id}`,
                type: 'exact_collision',
                severity: 'critical',
                icon: '⛔',
                title: t('conflict_collision_title', c1.subjectName, c2.subjectName),
                description: t('conflict_collision_desc', c1.date, c1.time, c2.time),
                callIds: [c1.id, c2.id]
              });
            } else if (c1.date === c2.date) {
              sameDateCongestionCount++;
              conflicts.push({
                id: `cong_${c1.id}_${c2.id}`,
                type: 'same_date_congestion',
                severity: 'high',
                icon: '⚠️',
                title: t('conflict_congestion_title', c1.date),
                description: t('conflict_congestion_desc', c1.subjectName, c1.time, c2.subjectName, c2.time),
                callIds: [c1.id, c2.id]
              });
            }
          }
        }

        // Turnaround < 24h
        for (let i = 1; i < active.length; i++) {
          const prev = active[i - 1];
          const curr = active[i];
          if (prev.date !== curr.date) {
            const gapHours = (curr.startTimestamp - prev.endTimestamp) / (3600 * 1000);
            if (gapHours > 0 && gapHours < 24) {
              turnaroundWarningCount++;
              conflicts.push({
                id: `turn_${prev.id}_${curr.id}`,
                type: 'critical_turnaround',
                severity: 'medium',
                icon: '⏳',
                title: t('conflict_turnaround_title'),
                description: t('conflict_turnaround_desc', Math.round(gapHours * 10) / 10, prev.subjectName, curr.subjectName),
                callIds: [prev.id, curr.id]
              });
            }
          }
        }

        // Multiple calls for same module and type
        const modTypeMap = new Map();
        active.forEach(c => {
          const key = `${c.moduleId}__${c.type || 'standard'}`;
          if (!modTypeMap.has(key)) modTypeMap.set(key, []);
          modTypeMap.get(key).push(c);
        });

        modTypeMap.forEach((calls, key) => {
          const distinctDates = new Set(calls.map(c => `${c.date}_${c.time}`));
          if (distinctDates.size > 1) {
            multipleCallsCount++;
            const typeLabel = calls[0].type === 'written' ? ' (Escrito)' : (calls[0].type === 'oral' ? ' (Oral)' : (calls[0].type === 'lab' ? ' (Lab)' : ''));
            conflicts.push({
              id: `multi_${key}`,
              type: 'multiple_calls',
              severity: 'info',
              icon: 'ℹ️',
              title: t('conflict_multi_title', (calls[0].moduleName || '') + typeLabel),
              description: t('conflict_multi_desc', distinctDates.size),
              callIds: calls.map(c => c.id),
              moduleId: calls[0].moduleId
            });
          }
        });

        // Precedence & Appello Binding Rules for Multi-part Exams
        const activeCallsByModule = new Map();
        active.forEach(c => {
          if (!activeCallsByModule.has(c.moduleId)) activeCallsByModule.set(c.moduleId, []);
          activeCallsByModule.get(c.moduleId).push(c);
        });

        if (sched && Array.isArray(sched.subjects)) {
          sched.subjects.forEach(sub => {
            (sub.modules || []).forEach(mod => {
              if (mod.alreadyPassed) return;
              const evalMode = mod.evaluationMode || 'standard';
              if (evalMode === 'standard') return;

              const callsInMod = activeCallsByModule.get(mod.id) || [];
              const writtens = callsInMod.filter(c => c.type === 'written');
              const secondaryType = evalMode === 'written_and_lab' ? 'lab' : 'oral';
              const secondaries = callsInMod.filter(c => c.type === secondaryType);

              if (secondaries.length > 0 && writtens.length === 0) {
                missingWrittenPrerequisiteCount++;
                conflicts.push({
                  id: `missing_written_${mod.id}`,
                  type: 'missing_written_prerequisite',
                  severity: 'high',
                  icon: '⚠️',
                  title: t('conflict_missing_written_title', mod.name),
                  description: t('conflict_missing_written_desc'),
                  callIds: secondaries.map(c => c.id),
                  moduleId: mod.id
                });
              }

              for (const w of writtens) {
                for (const s of secondaries) {
                  if (s.startTimestamp <= w.startTimestamp) {
                    precedenceViolationCount++;
                    conflicts.push({
                      id: `precedence_${mod.id}_${w.id}_${s.id}`,
                      type: 'precedence_violation',
                      severity: 'critical',
                      icon: '⛔',
                      title: t('conflict_precedence_title', mod.name),
                      description: t('conflict_precedence_desc', s.date, w.date),
                      callIds: [w.id, s.id],
                      moduleId: mod.id,
                      date: s.date
                    });
                  }

                  if (mod.oralBinding === 'same_appello') {
                    if (w.appelloIndex != null && s.appelloIndex != null && w.appelloIndex !== s.appelloIndex) {
                      bindingViolationCount++;
                      conflicts.push({
                        id: `binding_${mod.id}_${w.id}_${s.id}`,
                        type: 'binding_violation',
                        severity: 'critical',
                        icon: '⛔',
                        title: t('conflict_binding_title', mod.name),
                        description: t('conflict_binding_desc', w.appelloIndex, s.appelloIndex),
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
                        title: t('conflict_binding_title', mod.name),
                        description: t('conflict_binding_desc', w.appelloIndex, s.appelloIndex),
                        callIds: [w.id, s.id],
                        moduleId: mod.id,
                        date: s.date
                      });
                    }
                  }
                }
              }
            });
          });
        }

        // Group simultaneous calls of the same subject into unified sessions for timeline
        const unifiedActiveSessions = [];
        const processedJointKeys = new Set();

        for (let i = 0; i < active.length; i++) {
          const call = active[i];
          const sessionKey = `${call.subjectId}__${call.date}__${call.time || '09:00'}`;
          if (processedJointKeys.has(sessionKey)) continue;

          const partnerCalls = active.filter(c =>
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

        // Timeline & Buffers
        const timeline = [];
        const bufferIntervals = [];
        for (let i = 0; i < unifiedActiveSessions.length; i++) {
          const call = unifiedActiveSessions[i];
          let bufferBeforeDays = null;
          let bufferBeforeHours = null;
          let bufferCategory = null;

          if (i > 0) {
            const prev = unifiedActiveSessions[i - 1];
            bufferBeforeHours = Math.max(0, (call.startTimestamp - prev.endTimestamp) / (3600 * 1000));
            const prevD = new Date(prev.date + 'T00:00:00Z');
            const currD = new Date(call.date + 'T00:00:00Z');
            const rawCalendarDays = Math.round((currD - prevD) / (24 * 3600 * 1000));

            let blockedCount = 0;
            const checkDate = new Date(prevD);
            checkDate.setUTCDate(checkDate.getUTCDate() + 1);
            while (checkDate < currD) {
              const dStr = checkDate.toISOString().split('T')[0];
              if (blockedDates.has(dStr)) {
                blockedCount++;
              }
              checkDate.setUTCDate(checkDate.getUTCDate() + 1);
            }

            bufferBeforeDays = Math.max(0, rawCalendarDays - blockedCount);
            bufferIntervals.push(bufferBeforeDays);

            if (bufferBeforeDays >= 7) bufferCategory = 'optimal';
            else if (bufferBeforeDays >= 3) bufferCategory = 'acceptable';
            else if (bufferBeforeDays >= 1) bufferCategory = 'risk';
            else bufferCategory = 'critical';
          }

          let daysToDeadline = null;
          if (call.deadline) {
            const now = new Date();
            const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
            const deadD = new Date(call.deadline + 'T00:00:00Z');
            daysToDeadline = Math.round((deadD - nowUtc) / (24 * 3600 * 1000));
          }

          const allModCalls = [];
          (sched.subjects || []).forEach(sub => {
            (sub.modules || []).forEach(mod => {
              if (call.coveredModuleIds ? call.coveredModuleIds.includes(mod.id) : mod.id === call.moduleId) {
                (mod.calls || []).forEach(c => {
                  const fc = callMap.get(c.id);
                  if (fc) allModCalls.push(fc);
                });
              }
            });
          });
          const subsequentCalls = allModCalls.filter(c => c.startTimestamp > call.startTimestamp);

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

        const minBufferDays = bufferIntervals.length > 0 ? Math.min(...bufferIntervals) : 0;
        const totalBufferDays = bufferIntervals.reduce((a, b) => a + b, 0);
        const avgBufferDays = bufferIntervals.length > 0 ? Math.round((totalBufferDays / bufferIntervals.length) * 10) / 10 : 0;

        let bufferVariance = 0;
        if (bufferIntervals.length > 1) {
          const mean = totalBufferDays / bufferIntervals.length;
          const sqDiff = bufferIntervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
          bufferVariance = Math.round((sqDiff / bufferIntervals.length) * 10) / 10;
        }

        // Collect all required modules across subjects
        const allRequiredModules = [];
        let totalAvailableModules = 0;
        (sched.subjects || []).forEach(sub => {
          (sub.modules || []).forEach(mod => {
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
          });
        });

        const coveredModuleIds = new Set();
        active.forEach(c => {
          if (Array.isArray(c.jointModuleIds)) {
            c.jointModuleIds.forEach(id => coveredModuleIds.add(id));
          }
          if (Array.isArray(c.moduleIds)) {
            c.moduleIds.forEach(id => coveredModuleIds.add(id));
          }
          if (c.moduleId) {
            coveredModuleIds.add(c.moduleId);
          }
        });

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

        if (uncoveredModules.length > 0 && active.length > 0) {
          const missingNames = uncoveredModules.map(m => `${m.subjectName} (${m.moduleName})`).join(', ');
          conflicts.push({
            id: 'uncovered_modules_alert',
            type: 'uncovered_modules',
            severity: 'medium',
            icon: '📋',
            title: `${t('uncovered_alert_title')} (${uncoveredModules.length})`,
            description: t('uncovered_alert_desc', uncoveredModules.length, missingNames),
            callIds: [],
            uncoveredCount: uncoveredModules.length,
            uncoveredModules
          });
        }

        const targetCredits = Number(sched.meta?.targetCredits) || totalCredits;

        return {
          selectedCalls: active,
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

      // --- Core Optimizer Logic In Browser ---