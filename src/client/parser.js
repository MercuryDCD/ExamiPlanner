      function validateSchedule(sched, options = {}) {
        const { allowEmptySubjects = false } = options;
        const errors = [];
        if (!sched || typeof sched !== 'object') {
          return { valid: false, errors: ['El objeto debe ser un JSON válido.'] };
        }
        if (!sched.meta || typeof sched.meta !== 'object') {
          errors.push('Falta el objeto "meta".');
        } else {
          if (!sched.meta.title) errors.push('meta.title es obligatorio.');
          if (sched.meta.icon !== undefined && (typeof sched.meta.icon !== 'string' || !sched.meta.icon.trim())) {
            errors.push('meta.icon debe ser una cadena de texto (ej. emoji o símbolo).');
          }
        }
        if (!Array.isArray(sched.subjects) || (!allowEmptySubjects && sched.subjects.length === 0)) {
          errors.push('Debe existir al menos una asignatura en "subjects".');
        }
        return { valid: errors.length === 0, errors };
      }

      function normalizeSchedule(sched) {
        const parsedTarget = typeof sched.meta?.targetCredits === 'number'
          ? sched.meta.targetCredits
          : parseFloat(sched.meta?.targetCredits);
        const targetCredits = !isNaN(parsedTarget) && parsedTarget > 0
          ? parsedTarget
          : (sched.subjects || []).reduce((acc, s) => acc + (Number(s.credits) || 0), 0);

        const metaIcon = (typeof sched.meta?.icon === 'string' && sched.meta.icon.trim() && sched.meta.icon.trim() !== '📅')
          ? sched.meta.icon.trim()
          : detectSessionIcon(sched.meta);

        const meta = {
          title: sched.meta?.title || 'Planificador de Exámenes Universitario',
          institution: sched.meta?.institution || '',
          academicYear: sched.meta?.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
          session: sched.meta?.session || 'Convocatoria Oficial',
          icon: metaIcon,
          creditUnit: sched.meta?.creditUnit || 'CFU',
          targetCredits
        };

        const subjects = (sched.subjects || []).map((sub, sIdx) => {
          const subId = sub.id || slugify(sub.name) || `subj_${sIdx + 1}`;
          const diff = normalizeDifficulty(sub.difficulty);
          const defaultWeight = typeof sub.defaultWeight === 'number'
            ? Math.max(1, Math.min(5, Math.round(sub.defaultWeight)))
            : diff === 'high' ? 5 : diff === 'low' ? 1 : 3;
          const color = sub.color || COLOR_PALETTE[sIdx % COLOR_PALETTE.length];
          const subCredits = Number(sub.credits) || 6;
          const subShortName = typeof sub.shortName === 'string' && sub.shortName.trim()
            ? sub.shortName.trim()
            : generateSubjectAcronym(sub.name);

          const rawModules = Array.isArray(sub.modules) && sub.modules.length > 0
            ? sub.modules
            : [{ id: `${subId}_mod`, name: sub.name, credits: subCredits, calls: sub.calls || [] }];

          const modules = rawModules.map((mod, mIdx) => {
            const modId = mod.id || `${subId}_mod_${mIdx + 1}`;
            const modCredits = typeof mod.credits === 'number' ? mod.credits : subCredits;
            const alreadyPassed = Boolean(mod.alreadyPassed);
            const modShortName = typeof mod.shortName === 'string' && mod.shortName.trim()
              ? mod.shortName.trim()
              : generateModuleShortName(mod.name, mIdx, rawModules.length);
            const modDiff = normalizeDifficulty(mod.difficulty || sub.difficulty);
            const modWeight = typeof mod.defaultWeight === 'number'
              ? Math.max(1, Math.min(5, Math.round(mod.defaultWeight)))
              : defaultWeight;

            const calls = (mod.calls || []).map((call, cIdx) => {
              const callId = call.id || `${modId}_call_${cIdx + 1}`;
              const time = normalizeTimeStr(call.time);
              const parsedDuration = typeof call.durationHours === 'number' ? call.durationHours : parseFloat(call.durationHours);
              const durationHours = !isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration : 2.5;
              const date = normalizeDateStr(call.date);
              let deadline = normalizeDateStr(call.deadline);
              if (!deadline && date) {
                const d = new Date(date + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() - 4);
                deadline = d.toISOString().split('T')[0];
              }
              const moduleIds = Array.isArray(call.moduleIds) && call.moduleIds.length > 0
                ? call.moduleIds.map(String)
                : [String(modId)];

              const isCallActive = (
                call.status === 'active' ||
                call.status === 'activo' ||
                call.active === true ||
                call.selected === true
              );
              const isCallExplicitlyInactive = (
                call.status === 'inactive' ||
                call.status === 'desactivado' ||
                call.status === 'inactivo' ||
                call.active === false ||
                call.selected === false
              );

              let callStatus;
              let callActive;
              if (isCallActive) {
                callStatus = 'active';
                callActive = true;
              } else if (isCallExplicitlyInactive) {
                callStatus = 'inactive';
                callActive = false;
              } else if (typeof call.status === 'string' && call.status.trim()) {
                callStatus = call.status.trim();
                callActive = false;
              }

              const normCall = {
                id: String(callId),
                date,
                time,
                durationHours,
                deadline: deadline || date,
                location: call.location || 'Aula Magna',
                notes: call.notes || '',
                type: normalizeCallType(call.type, call.notes, mod.name),
                appelloIndex: normalizeAppelloIndex(call.appelloIndex, call.notes, cIdx),
                moduleIds
              };
              if (callStatus !== undefined) {
                normCall.status = callStatus;
                normCall.active = callActive;
              }

              return normCall;
            });

            return {
              id: String(modId),
              name: mod.name || sub.name,
              shortName: modShortName,
              credits: modCredits,
              difficulty: modDiff,
              defaultWeight: modWeight,
              alreadyPassed,
              evaluationMode: normalizeEvaluationMode(mod.evaluationMode),
              oralBinding: normalizeOralBinding(mod.oralBinding),
              calls
            };
          });

          return {
            id: String(subId),
            name: sub.name || `Asignatura ${sIdx + 1}`,
            shortName: subShortName,
            code: sub.code || '',
            credits: subCredits,
            color,
            difficulty: diff,
            defaultWeight,
            modules
          };
        });

        const presets = Array.isArray(sched.presets)
          ? sched.presets.map((p, pIdx) => ({
              name: p.name || `Preset ${pIdx + 1}`,
              description: p.description || '',
              selectedCallIds: Array.isArray(p.selectedCallIds) ? p.selectedCallIds.map(String) : []
            }))
          : [];

        const result = { meta, subjects, presets };
        if (Array.isArray(sched.selectedCallIds)) {
          result.selectedCallIds = sched.selectedCallIds.map(String);
        }
        return result;
      }

      function extractSelectedCallIds(sched) {
        if (!sched || typeof sched !== 'object') return [];
        const explicitActiveIds = [];
        let hasExplicitCallStatus = false;

        (sched.subjects || []).forEach(sub => {
          (sub.modules || []).forEach(mod => {
            (mod.calls || []).forEach(call => {
              const isCallActive = (
                call.status === 'active' ||
                call.status === 'activo' ||
                call.active === true ||
                call.selected === true
              );
              const isCallInactive = (
                call.status === 'inactive' ||
                call.status === 'desactivado' ||
                call.status === 'inactivo' ||
                call.active === false ||
                call.selected === false
              );

              if (isCallActive) {
                explicitActiveIds.push(String(call.id));
                hasExplicitCallStatus = true;
              } else if (isCallInactive) {
                hasExplicitCallStatus = true;
              }
            });
          });
        });

        if (hasExplicitCallStatus) {
          return explicitActiveIds;
        }

        if (Array.isArray(sched.selectedCallIds) && sched.selectedCallIds.length > 0) {
          return sched.selectedCallIds.map(String);
        }

        if (Array.isArray(sched.presets) && sched.presets.length > 0 && Array.isArray(sched.presets[0].selectedCallIds) && sched.presets[0].selectedCallIds.length > 0) {
          return sched.presets[0].selectedCallIds.map(String);
        }

        const fallback = [];
        (sched.subjects || []).forEach(sub => {
          (sub.modules || []).forEach(mod => {
            if (!mod.alreadyPassed && Array.isArray(mod.calls) && mod.calls.length > 0) {
              const evalMode = normalizeEvaluationMode(mod.evaluationMode);
              if (evalMode === 'written_and_oral') {
                const w = mod.calls.find(c => normalizeCallType(c.type, c.notes, mod.name) === 'written');
                const o = mod.calls.find(c => normalizeCallType(c.type, c.notes, mod.name) === 'oral');
                if (w) fallback.push(String(w.id));
                if (o) fallback.push(String(o.id));
                if (!w && !o) fallback.push(String(mod.calls[0].id));
              } else if (evalMode === 'written_and_lab') {
                const w = mod.calls.find(c => normalizeCallType(c.type, c.notes, mod.name) === 'written');
                const l = mod.calls.find(c => normalizeCallType(c.type, c.notes, mod.name) === 'lab');
                if (w) fallback.push(String(w.id));
                if (l) fallback.push(String(l.id));
                if (!w && !l) fallback.push(String(mod.calls[0].id));
              } else {
                fallback.push(String(mod.calls[0].id));
              }
            }
          });
        });
        return fallback;
      }

      function getExportableSchedule(sched, selectedCallIds = []) {
        const idsArray = Array.isArray(selectedCallIds)
          ? selectedCallIds
          : (selectedCallIds instanceof Set
            ? Array.from(selectedCallIds)
            : (typeof selectedCallIds === 'string' && selectedCallIds ? [selectedCallIds] : []));
        const selSet = new Set(idsArray.map(String));

        const clone = JSON.parse(JSON.stringify(sched || {}));

        (clone.subjects || []).forEach(sub => {
          (sub.modules || []).forEach(mod => {
            (mod.calls || []).forEach(call => {
              const isSelected = selSet.has(String(call.id));
              call.status = isSelected ? 'active' : 'inactive';
              call.active = isSelected;
            });
          });
        });

        const selectedList = Array.from(selSet);
        if (!Array.isArray(clone.presets) || clone.presets.length === 0) {
          clone.presets = [
            {
              name: 'Plan Seleccionado',
              description: 'Convocatorias seleccionadas en el planificador',
              selectedCallIds: selectedList
            }
          ];
        } else {
          clone.presets[0] = {
            ...clone.presets[0],
            selectedCallIds: selectedList
          };
        }

        clone.selectedCallIds = selectedList;

        return clone;
      }

      function parseMarkdownTable(markdown, metaOverrides = {}) {
        const lines = markdown
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l => l.startsWith('|') && l.endsWith('|'));

        if (lines.length < 2) {
          throw new Error('La tabla Markdown debe contener al menos cabecera y una fila de datos.');
        }

        const parseCells = line => line.slice(1, -1).split('|').map(c => c.trim());
        const headers = parseCells(lines[0]).map(h => slugify(h));
        const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(lines[1]);
        const dataRows = isSeparator ? lines.slice(2) : lines.slice(1);

        if (dataRows.length === 0) {
          throw new Error('La tabla Markdown no tiene filas de datos.');
        }

        const subMap = new Map();
        for (const row of dataRows) {
          const cells = parseCells(row);
          if (cells.length < 2) continue;
          const rowObj = {};
          headers.forEach((h, idx) => { rowObj[h] = cells[idx] || ''; });

          const subName = rowObj.asignatura || rowObj.subject || rowObj.materia || rowObj.nome || 'Asignatura';
          const subCode = rowObj.codigo || rowObj.code || rowObj.codice || '';
          const modName = rowObj.modulo || rowObj.module || subName;
          const date = normalizeDateStr(rowObj.fecha || rowObj.date || rowObj.data || '');
          const time = rowObj.hora || rowObj.time || rowObj.ora || '09:00';
          const duration = parseFloat(rowObj.duracion || rowObj.duration || rowObj.durata || '2.5') || 2.5;
          const credits = parseFloat(rowObj.creditos || rowObj.cfu || rowObj.ects || rowObj.credits || '6') || 6;
          const difficulty = normalizeDifficulty(rowObj.dificultad || rowObj.difficulty || rowObj.difficolta || 'medium');
          const notes = rowObj.notas || rowObj.notes || rowObj.note || '';
          const location = rowObj.aula || rowObj.location || rowObj.sede || '';

          const subId = slugify(subCode || subName);
          const modId = slugify(`${subId}_${modName}`);

          if (!subMap.has(subId)) {
            subMap.set(subId, {
              id: subId,
              name: subName,
              code: subCode,
              credits,
              difficulty,
              modules: new Map()
            });
          }

          const subEntry = subMap.get(subId);
          if (!subEntry.modules.has(modId)) {
            subEntry.modules.set(modId, {
              id: modId,
              name: modName,
              credits,
              alreadyPassed: false,
              calls: []
            });
          }

          const modEntry = subEntry.modules.get(modId);
          const callId = `${modId}_call_${modEntry.calls.length + 1}`;
          modEntry.calls.push({
            id: callId,
            date,
            time,
            durationHours: duration,
            location,
            notes
          });
        }

        const subjects = Array.from(subMap.values()).map(sub => ({
          ...sub,
          modules: Array.from(sub.modules.values())
        }));

        const scheduleRaw = {
          meta: {
            title: metaOverrides.title || 'Plan de Exámenes Universitario',
            institution: metaOverrides.institution || '',
            academicYear: metaOverrides.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
            session: metaOverrides.session || 'Convocatoria Oficial',
            creditUnit: metaOverrides.creditUnit || 'CFU',
            targetCredits: subjects.reduce((sum, s) => sum + s.credits, 0)
          },
          subjects,
          presets: []
        };

        return normalizeSchedule(scheduleRaw);
      }

      function stripJsonComments(jsonStr) {
        let inString = false;
        let isEscaped = false;
        let inSingleComment = false;
        let inMultiComment = false;
        let result = '';

        for (let i = 0; i < jsonStr.length; i++) {
          const char = jsonStr[i];
          const nextChar = jsonStr[i + 1];

          if (inSingleComment) {
            if (char === '\n' || char === '\r') {
              inSingleComment = false;
              result += char;
            }
            continue;
          }

          if (inMultiComment) {
            if (char === '*' && nextChar === '/') {
              inMultiComment = false;
              i++;
            }
            continue;
          }

          if (inString) {
            result += char;
            if (isEscaped) {
              isEscaped = false;
            } else if (char === '\\') {
              isEscaped = true;
            } else if (char === '"') {
              inString = false;
            }
            continue;
          }

          if (char === '"') {
            inString = true;
            result += char;
            continue;
          }

          if (char === '/' && nextChar === '/') {
            inSingleComment = true;
            i++;
            continue;
          }

          if (char === '/' && nextChar === '*') {
            inMultiComment = true;
            i++;
            continue;
          }

          result += char;
        }
        return result;
      }

      function stripTrailingCommas(jsonStr) {
        let inString = false;
        let isEscaped = false;
        let result = '';

        for (let i = 0; i < jsonStr.length; i++) {
          const char = jsonStr[i];

          if (inString) {
            result += char;
            if (isEscaped) {
              isEscaped = false;
            } else if (char === '\\') {
              isEscaped = true;
            } else if (char === '"') {
              inString = false;
            }
            continue;
          }

          if (char === '"') {
            inString = true;
            result += char;
            continue;
          }

          if (char === ',') {
            let j = i + 1;
            while (j < jsonStr.length && /\s/.test(jsonStr[j])) {
              j++;
            }
            if (j < jsonStr.length && (jsonStr[j] === '}' || jsonStr[j] === ']')) {
              continue;
            }
          }

          result += char;
        }
        return result;
      }

      function sanitizeJsonString(str) {
        return stripTrailingCommas(stripJsonComments(str));
      }

      function robustJsonParse(text) {
        try {
          return JSON.parse(text);
        } catch (initialErr) {
          try {
            const sanitized = sanitizeJsonString(text);
            return JSON.parse(sanitized);
          } catch (secondErr) {
            throw new Error(`JSON malformado: ${initialErr.message}`);
          }
        }
      }

      function extractJsonFromText(text) {
        if (!text || typeof text !== 'string') return null;

        const candidates = [];

        // 1. Search for fenced code blocks ``` or ~~~ with any language tag
        const codeBlockRegex = /(?:```+|~~~+)(?:[a-zA-Z0-9_\-]+)?\s*([\s\S]*?)(?:```+|~~~+)/g;
        let match;
        while ((match = codeBlockRegex.exec(text)) !== null) {
          const rawContent = match[1].trim();
          const firstBrace = rawContent.indexOf('{');
          const lastBrace = rawContent.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            const candidateStr = rawContent.slice(firstBrace, lastBrace + 1);
            try {
              const parsed = robustJsonParse(candidateStr);
              if (parsed && typeof parsed === 'object') {
                candidates.push(parsed);
              }
            } catch (e) {}
          }
        }

        // 2. Search for balanced braces { ... } in the entire text
        let inString = false;
        let isEscaped = false;
        let inSingleComment = false;
        let inMultiComment = false;
        let depth = 0;
        let startIdx = -1;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];

          if (inSingleComment) {
            if (char === '\n' || char === '\r') inSingleComment = false;
            continue;
          }
          if (inMultiComment) {
            if (char === '*' && nextChar === '/') {
              inMultiComment = false;
              i++;
            }
            continue;
          }
          if (inString) {
            if (isEscaped) isEscaped = false;
            else if (char === '\\') isEscaped = true;
            else if (char === '"') inString = false;
            continue;
          }
          if (char === '"') {
            inString = true;
            continue;
          }
          if (char === '/' && nextChar === '/') {
            inSingleComment = true;
            i++;
            continue;
          }
          if (char === '/' && nextChar === '*') {
            inMultiComment = true;
            i++;
            continue;
          }
          if (char === '{') {
            if (depth === 0) startIdx = i;
            depth++;
          } else if (char === '}') {
            if (depth > 0) {
              depth--;
              if (depth === 0 && startIdx !== -1) {
                const slice = text.slice(startIdx, i + 1);
                if (slice.includes('"meta"') || slice.includes('"subjects"')) {
                  try {
                    const parsed = robustJsonParse(slice);
                    if (parsed && typeof parsed === 'object') {
                      candidates.push(parsed);
                    }
                  } catch (e) {}
                }
                startIdx = -1;
              }
            }
          }
        }

        if (candidates.length === 0) return null;

        function scoreCandidate(cand) {
          if (!cand || typeof cand !== 'object') return -9999;
          const val = validateSchedule(cand);
          let totalCalls = 0;
          if (Array.isArray(cand.subjects)) {
            cand.subjects.forEach(s => {
              (s.modules || []).forEach(m => {
                totalCalls += (m.calls || []).length;
              });
            });
          }

          if (val.valid) {
            return 10000 + (cand.subjects?.length || 0) * 100 + totalCalls;
          }
          let score = 0;
          if (cand.meta && typeof cand.meta === 'object') score += 10;
          if (cand.meta?.title) score += 5;
          if (cand.meta?.institution) score += 5;
          if (Array.isArray(cand.subjects)) score += cand.subjects.length * 10;
          score += totalCalls * 5;
          score -= val.errors.length * 2;
          return score;
        }

        const scored = candidates.map(c => ({ cand: c, score: scoreCandidate(c) }));
        scored.sort((a, b) => b.score - a.score);
        return scored[0].cand;
      }

      function parseInput(input, format = 'auto') {
        if (typeof input === 'object' && input !== null) {
          const val = validateSchedule(input);
          if (!val.valid) throw new Error(val.errors.join('\n'));
          return normalizeSchedule(input);
        }
        if (typeof input !== 'string') throw new Error('Entrada no válida.');
        const trimmed = input.trim();

        if (format === 'json') {
          let parsed;
          try {
            parsed = robustJsonParse(trimmed);
          } catch (err) {
            const extracted = extractJsonFromText(trimmed);
            if (extracted) parsed = extracted;
            else throw err;
          }
          const val = validateSchedule(parsed);
          if (!val.valid) throw new Error(val.errors.join('\n'));
          return normalizeSchedule(parsed);
        }

        if (format === 'markdown') {
          return parseMarkdownTable(trimmed);
        }

        // format === 'auto'
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          let parsed = null;
          let directValid = false;
          try {
            parsed = robustJsonParse(trimmed);
            const val = validateSchedule(parsed);
            if (val.valid) directValid = true;
          } catch (e) {}

          if (directValid) {
            return normalizeSchedule(parsed);
          }

          const extracted = extractJsonFromText(trimmed);
          if (extracted) {
            const val = validateSchedule(extracted);
            if (!val.valid) throw new Error(val.errors.join('\n'));
            return normalizeSchedule(extracted);
          }

          if (parsed) {
            const val = validateSchedule(parsed);
            throw new Error(val.errors.join('\n'));
          }

          robustJsonParse(trimmed);
        }

        const extractedJson = extractJsonFromText(trimmed);
        if (extractedJson) {
          const val = validateSchedule(extractedJson);
          if (!val.valid) throw new Error(val.errors.join('\n'));
          return normalizeSchedule(extractedJson);
        }

        const lines = trimmed
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l => l.startsWith('|') && l.endsWith('|'));
        if (lines.length >= 2) {
          return parseMarkdownTable(trimmed);
        }

        throw new Error('Formato no reconocido. Pega un JSON válido, un archivo Markdown/README con bloque ```json, o una tabla Markdown con formato | Columna |.');
      }

      const SESSIONS_STORAGE_KEY = 'examplan_sessions';
      const ACTIVE_SESSION_STORAGE_KEY = 'examplan_active_session_id';
      const LEGACY_STORAGE_KEY = 'examplan_custom_schedule';

      // Toast notifications helper (top-level scope accessible by all session and import functions)
      function showToast(message, type = 'success', duration = 3500) {
        if (typeof document === 'undefined') return;
        let container = document.getElementById('toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'toast-container';
          container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0';
          if (document.body) document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold transition-all duration-300 transform translate-y-2 opacity-0 backdrop-blur-md';

        if (type === 'success') {
          toast.className += ' bg-emerald-600/95 text-white shadow-emerald-500/25 border border-emerald-400/30';
          toast.innerHTML = `<span class="text-base">✓</span><span>${message}</span>`;
        } else if (type === 'error') {
          toast.className += ' bg-rose-600/95 text-white shadow-rose-500/25 border border-rose-400/30';
          toast.innerHTML = `<span class="text-base">⚠️</span><span>${message}</span>`;
        } else {
          toast.className += ' bg-indigo-600/95 text-white shadow-indigo-500/25 border border-indigo-400/30';
          toast.innerHTML = `<span class="text-base">ℹ️</span><span>${message}</span>`;
        }

        container.appendChild(toast);
        requestAnimationFrame(() => {
          toast.classList.remove('translate-y-2', 'opacity-0');
        });

        setTimeout(() => {
          toast.classList.add('opacity-0', 'translate-y-2');
          setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
          }, 300);
        }, duration);
      }
