        function copyPromptToClipboard() {
          navigator.clipboard.writeText(AI_PROMPT_TEMPLATE).then(() => {
            showToast('✓ ¡Plantilla y prompt para IA copiado al portapapeles! Pégalo a una IA junto con tus capturas.', 'success');
          }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = AI_PROMPT_TEMPLATE;
            document.body.appendChild(textarea);
            textarea.select();
            try {
              document.execCommand('copy');
              showToast('✓ ¡Plantilla y prompt para IA copiado al portapapeles!', 'success');
            } catch (e) {
              alert('No se pudo copiar automáticamente al portapapeles.');
            }
            document.body.removeChild(textarea);
          });
        }

        function processScheduleText(text, sourceName = 'archivo') {
          const alertBox = document.getElementById('import-alert-box');
          if (alertBox) alertBox.className = 'hidden';

          try {
            const parsed = parseInput(text, 'auto');

            const destRadio = document.querySelector('input[name="import-destination-mode"]:checked');
            const destMode = destRadio ? destRadio.value : 'new';

            let totalCalls = 0;
            (parsed.subjects || []).forEach(s => {
              (s.modules || []).forEach(m => {
                totalCalls += (m.calls || []).length;
              });
            });

            if (destMode === 'new') {
              const detectedName = parsed.meta?.session || parsed.meta?.title || 'Sesión Importada';
              const detectedIcon = parsed.meta?.icon || detectSessionIcon(parsed.meta) || '📚';
              parsed.meta.session = detectedName;
              parsed.meta.icon = detectedIcon;

              const newSchedule = normalizeSchedule(parsed);
              let newSelectedCallIds = [];
              if (Array.isArray(newSchedule.presets) && newSchedule.presets.length > 0 && newSchedule.presets[0].selectedCallIds?.length > 0) {
                newSelectedCallIds = [...newSchedule.presets[0].selectedCallIds];
              } else {
                (newSchedule.subjects || []).forEach(sub => {
                  (sub.modules || []).forEach(mod => {
                    if (!mod.alreadyPassed && mod.calls?.[0]) {
                      newSelectedCallIds.push(mod.calls[0].id);
                    }
                  });
                });
              }

              const newWeights = {};
              (newSchedule.subjects || []).forEach(sub => {
                newWeights[sub.id] = sub.defaultWeight || (sub.difficulty === 'high' ? 5 : sub.difficulty === 'low' ? 1 : 3);
              });

              const newSession = {
                id: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                name: detectedName,
                icon: detectedIcon,
                schedule: newSchedule,
                selectedCallIds: newSelectedCallIds,
                subjectWeights: newWeights,
                prioritizeSafety: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
              };

              sessions.push(newSession);
              saveSessionsToStorage();
              switchSession(newSession.id);

              showToast(`¡Nueva sesión "${detectedIcon} ${detectedName}" creada! (${parsed.subjects.length} asignaturas, ${totalCalls} llamamientos).`, 'success');

              if (alertBox) {
                alertBox.className = 'p-3 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
                alertBox.textContent = `¡Nueva sesión "${detectedIcon} ${detectedName}" creada e importada con éxito! (${parsed.subjects.length} asignaturas, ${totalCalls} exámenes).`;
                alertBox.classList.remove('hidden');
              }
            } else {
              const norm = normalizeSchedule(parsed);
              state.selectedCallIds.clear();
              if (Array.isArray(norm.presets) && norm.presets.length > 0 && norm.presets[0].selectedCallIds?.length > 0) {
                norm.presets[0].selectedCallIds.forEach(id => state.selectedCallIds.add(id));
              } else {
                (norm.subjects || []).forEach(sub => {
                  (sub.modules || []).forEach(mod => {
                    if (!mod.alreadyPassed && mod.calls?.[0]) {
                      state.selectedCallIds.add(mod.calls[0].id);
                    }
                  });
                });
              }
              persistSchedule(norm);
              showToast(`¡Plan cargado en sesión activa! (${parsed.subjects.length} asignaturas, ${totalCalls} convocatorias).`, 'success');

              if (alertBox) {
                alertBox.className = 'p-3 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
                alertBox.textContent = `¡Plan importado en la sesión activa! Se cargaron ${parsed.subjects.length} asignaturas (${totalCalls} exámenes).`;
                alertBox.classList.remove('hidden');
              }
            }

            const modal = document.getElementById('manage-modal');
            if (modal && modal.open) {
              setTimeout(() => {
                switchModalTab('subjects');
              }, 700);
            }
            return true;
          } catch (err) {
            showToast(`Error al procesar ${sourceName}: ${err.message}`, 'error', 5000);
            if (alertBox) {
              alertBox.className = 'p-3 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800';
              alertBox.textContent = `Error al importar: ${err.message}`;
              alertBox.classList.remove('hidden');
            }
            return false;
          }
        }

        function handleFileInput(file) {
          if (!file) return;
          const fileName = file.name || '';
          const isImageOrPdf = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|tiff|pdf)$/i.test(fileName);
          if (isImageOrPdf) {
            showToast('ℹ️ Has subido una imagen o PDF. Copia la plantilla con el botón "Prompt IA", envíasela a ChatGPT/Gemini junto con tus capturas, y arrastra aquí el JSON o Markdown resultante.', 'info', 7000);
            return;
          }

          const reader = new FileReader();
          reader.onload = (ev) => {
            const content = ev.target?.result;
            if (typeof content === 'string') {
              const textarea = document.getElementById('import-text-input');
              if (textarea) textarea.value = content;
              processScheduleText(content, file.name);
            }
          };
          reader.onerror = () => {
            showToast(`Error al leer el archivo ${file.name}.`, 'error');
          };
          reader.readAsText(file);
        }

        // File upload button in modal
        const fileInput = document.getElementById('import-file-input');
        document.getElementById('btn-trigger-file-import')?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (file) handleFileInput(file);
          e.target.value = '';
        });

        // Modal dropzone
        const modalDropzone = document.getElementById('modal-dropzone');
        const modalFileInput = document.getElementById('modal-file-input');
        if (modalDropzone) {
          modalDropzone.addEventListener('click', () => modalFileInput?.click());
          modalDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            modalDropzone.classList.add('border-indigo-500', 'bg-indigo-50/40', 'dark:bg-indigo-950/40');
          });
          modalDropzone.addEventListener('dragleave', () => {
            modalDropzone.classList.remove('border-indigo-500', 'bg-indigo-50/40', 'dark:bg-indigo-950/40');
          });
          modalDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modalDropzone.classList.remove('border-indigo-500', 'bg-indigo-50/40', 'dark:bg-indigo-950/40');
            const file = e.dataTransfer?.files?.[0];
            if (file) handleFileInput(file);
          });
        }
        modalFileInput?.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (file) handleFileInput(file);
          e.target.value = '';
        });

        // Top upload button and file input
        const topFileInput = document.getElementById('top-file-input');
        document.getElementById('btn-top-upload')?.addEventListener('click', () => topFileInput?.click());
        topFileInput?.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (file) handleFileInput(file);
          e.target.value = '';
        });

        // Copy prompt buttons
        document.getElementById('btn-top-copy-prompt')?.addEventListener('click', copyPromptToClipboard);
        document.getElementById('btn-modal-copy-prompt')?.addEventListener('click', copyPromptToClipboard);

        // Whole page Drag & Drop Overlay
        const overlay = document.getElementById('drop-overlay');
        let dragCounter = 0;

        window.addEventListener('dragenter', (e) => {
          e.preventDefault();
          dragCounter++;
          if (overlay) {
            overlay.classList.remove('hidden');
            requestAnimationFrame(() => {
              overlay.style.opacity = '1';
            });
          }
        });

        window.addEventListener('dragover', (e) => {
          e.preventDefault();
        });

        window.addEventListener('dragleave', (e) => {
          e.preventDefault();
          dragCounter--;
          if (dragCounter <= 0) {
            dragCounter = 0;
            if (overlay) {
              overlay.style.opacity = '0';
              setTimeout(() => {
                if (dragCounter <= 0) overlay.classList.add('hidden');
              }, 200);
            }
          }
        });

        window.addEventListener('drop', (e) => {
          e.preventDefault();
          dragCounter = 0;
          if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.classList.add('hidden'), 200);
          }
          const file = e.dataTransfer?.files?.[0];
          if (file) {
            handleFileInput(file);
          }
        });

        // Run Import button
        document.getElementById('btn-run-import')?.addEventListener('click', () => {
          const text = document.getElementById('import-text-input').value;
          processScheduleText(text, 'texto introducido');
        });

        // Download JSON Config
        document.getElementById('btn-download-json-config')?.addEventListener('click', () => {
          const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `plan_examenes_${schedule.meta?.title ? slugify(schedule.meta.title) : 'config'}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });

        // Copy JSON Config
        document.getElementById('btn-copy-json-config')?.addEventListener('click', () => {
          navigator.clipboard.writeText(JSON.stringify(schedule, null, 2)).then(() => {
            alert('¡Configuración JSON copiada al portapapeles!');
          }).catch(() => {
            alert('No se pudo copiar al portapapeles.');
          });
        });

        // Reset to Factory Defaults
        document.getElementById('btn-reset-storage')?.addEventListener('click', () => {
          if (confirm('¿Restablecer el planificador a la configuración inicial? Se perderán todas las sesiones y asignaturas añadidas en el navegador.')) {
            localStorage.removeItem(SESSIONS_STORAGE_KEY);
            localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            location.reload();
          }
        });
      }

      // --- Bind Event Listeners ---
      function setupEvents() {
        // Session Dropdown Events
        document.getElementById('btn-session-dropdown')?.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSessionDropdown();
        });

        document.getElementById('btn-quick-new-session')?.addEventListener('click', (e) => {
          e.stopPropagation();
          closeSessionDropdown();
          openCreateSessionModal();
        });

        document.getElementById('btn-duplicate-active-session')?.addEventListener('click', (e) => {
          e.stopPropagation();
          closeSessionDropdown();
          duplicateSession(activeSessionId);
        });

        document.getElementById('btn-edit-active-session')?.addEventListener('click', (e) => {
          e.stopPropagation();
          closeSessionDropdown();
          openEditSessionModal(activeSessionId);
        });

        document.getElementById('btn-delete-active-session')?.addEventListener('click', (e) => {
          e.stopPropagation();
          closeSessionDropdown();
          deleteSession(activeSessionId);
        });

        document.addEventListener('click', (e) => {
          const container = document.getElementById('session-switcher-container');
          if (container && !container.contains(e.target)) {
            closeSessionDropdown();
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            const menu = document.getElementById('session-dropdown-menu');
            if (menu && !menu.classList.contains('hidden')) {
              closeSessionDropdown();
              document.getElementById('btn-session-dropdown')?.focus();
            }
          }
        });

        // Sincronización multi-pestaña en tiempo real mediante eventos storage
        window.addEventListener('storage', (e) => {
          if (e.key === SESSIONS_STORAGE_KEY || e.key === ACTIVE_SESSION_STORAGE_KEY) {
            try {
              const storedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
              if (storedSessions) {
                const parsed = JSON.parse(storedSessions);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  sessions = parsed;
                  const storedActiveId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
                  if (storedActiveId && sessions.some(s => s.id === storedActiveId)) {
                    activeSessionId = storedActiveId;
                  } else if (!sessions.some(s => s.id === activeSessionId)) {
                    activeSessionId = sessions[0].id;
                  }
                  loadActiveSessionIntoState();
                  renderHeader();
                  renderSessionSwitcher();
                  renderPresets();
                  renderSliders();
                  const safetyToggle = document.getElementById('toggle-prioritize-safety');
                  if (safetyToggle) safetyToggle.checked = Boolean(state.prioritizeSafety);
                  updateApp();
                  renderModalSubjects();
                  populateMetaForm();
                }
              }
            } catch (err) {
              console.warn('Error en sincronización storage entre pestañas:', err);
            }
          }
        });

        // Max Spacing Button
        document.getElementById('btn-opt-max-spacing').addEventListener('click', () => {
          state.lastOptimizationMode = 'max-spacing';
          const result = optimizeSchedule(schedule, {
            mode: 'max-spacing',
            prioritizeSafety: state.prioritizeSafety,
            dayPlans: state.dayPlans
          });
          state.selectedCallIds = new Set(result.selectedCallIds || result);
          const presetSelect = document.getElementById('preset-select');
          if (presetSelect) presetSelect.value = '';
          updateApp();
        });

        // Weighted Sliders Button
        document.getElementById('btn-opt-weighted').addEventListener('click', () => {
          state.lastOptimizationMode = 'weighted-difficulty';
          const result = optimizeSchedule(schedule, {
            mode: 'weighted-difficulty',
            prioritizeSafety: state.prioritizeSafety,
            weights: state.subjectWeights,
            dayPlans: state.dayPlans
          });
          state.selectedCallIds = new Set(result.selectedCallIds || result);
          const presetSelect = document.getElementById('preset-select');
          if (presetSelect) presetSelect.value = '';
          updateApp();
        });

        // Toggle Prioritize Safety (Parachute Red de Seguridad)
        const safetyToggle = document.getElementById('toggle-prioritize-safety');
        if (safetyToggle) {
          safetyToggle.checked = Boolean(state.prioritizeSafety);
          safetyToggle.addEventListener('change', (e) => {
            state.prioritizeSafety = e.target.checked;
            const result = optimizeSchedule(schedule, {
              mode: state.lastOptimizationMode || 'max-spacing',
              prioritizeSafety: state.prioritizeSafety,
              weights: state.subjectWeights,
              dayPlans: state.dayPlans
            });
            state.selectedCallIds = new Set(result.selectedCallIds || result);
            const presetSelect = document.getElementById('preset-select');
            if (presetSelect) presetSelect.value = '';
            updateApp();
          });
        }

        // Select All / Clear All
        document.getElementById('btn-select-all').addEventListener('click', () => {
          (schedule.subjects || []).forEach(sub => {
            (sub.modules || []).forEach(mod => {
              (mod.calls || []).forEach(c => state.selectedCallIds.add(c.id));
            });
          });
          const presetSelect = document.getElementById('preset-select');
          if (presetSelect) presetSelect.value = '';
          updateApp();
        });

        document.getElementById('btn-clear-selection').addEventListener('click', () => {
          state.selectedCallIds.clear();
          const presetSelect = document.getElementById('preset-select');
          if (presetSelect) presetSelect.value = '';
          updateApp();
        });

        // Preset Selector
        document.getElementById('preset-select').addEventListener('change', (e) => {
          const idx = parseInt(e.target.value, 10);
          if (!isNaN(idx) && schedule.presets?.[idx]) {
            state.selectedCallIds = new Set(schedule.presets[idx].selectedCallIds);
            updateApp();
          }
        });

        // Load Plan Dropdown & Actions
        const loadPlanBtn = document.getElementById('btn-load-plan-dropdown');
        const loadPlanMenu = document.getElementById('load-plan-dropdown-menu');
        if (loadPlanBtn && loadPlanMenu) {
          loadPlanBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = loadPlanMenu.classList.contains('hidden');
            loadPlanMenu.classList.toggle('hidden', !isHidden);
            loadPlanBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
          });
          document.addEventListener('click', (e) => {
            if (!loadPlanBtn.contains(e.target) && !loadPlanMenu.contains(e.target)) {
              loadPlanMenu.classList.add('hidden');
              loadPlanBtn.setAttribute('aria-expanded', 'false');
            }
          });
        }
        document.getElementById('btn-menu-paste-text')?.addEventListener('click', () => {
          loadPlanMenu?.classList.add('hidden');
          switchModalTab('import');
          document.getElementById('manage-modal')?.showModal();
        });
        document.getElementById('btn-menu-download-json')?.addEventListener('click', () => {
          loadPlanMenu?.classList.add('hidden');
          document.getElementById('btn-download-json-config')?.click();
        });

        // Reset to Default Generic Template
        document.getElementById('btn-reset-to-template')?.addEventListener('click', (e) => {
          e.stopPropagation();
          closeSessionDropdown();
          resetToDefaultTemplate();
        });

        // Export Tools
        document.getElementById('btn-export-ics').addEventListener('click', exportToICS);
        document.getElementById('btn-copy-md').addEventListener('click', copyMarkdownSummary);

        // Language Switcher Toggle
        document.getElementById('btn-lang-toggle')?.addEventListener('click', () => {
          toggleLanguage();
        });
      }

      // Expose engines on window for testing or embedding
      if (typeof window !== 'undefined') {
        window.ExamPlannerParser = {
          parseInput,
          parseMarkdownTable,
          normalizeSchedule,
          validateSchedule,
          detectSessionIcon,
          normalizeDateStr,
          normalizeTimeStr,
          stripJsonComments,
          stripTrailingCommas,
          sanitizeJsonString,
          robustJsonParse,
          extractJsonFromText
        };
        window.ExamPlannerAnalyzer = { analyzeSchedule, buildCallIndex, parseDateTime };
        window.ExamPlannerOptimizer = { optimizeSchedule };
        window.ExamPlannerSessions = {
          getSessions: () => sessions,
          getActiveSession: () => getActiveSession(),
          getState: () => state,
          switchSession,
          createSession,
          duplicateSession,
          deleteSession,
          detectSessionIcon,
          setSelectedCallIds: (callIds) => {
            state.selectedCallIds = new Set(callIds);
            updateApp();
          },
          setPrioritizeSafety: (val) => {
            state.prioritizeSafety = Boolean(val);
            updateApp();
          },
          setSubjectWeight: (subId, weight) => {
            state.subjectWeights[subId] = Number(weight);
            updateApp();
          },
          setModuleWeight: (modId, weight) => {
            state.subjectWeights[modId] = Number(weight);
            updateApp();
          },
          resetToTemplate: resetToDefaultTemplate,
          setDayPlan: (dateStr, plan) => {
            if (!state.dayPlans) state.dayPlans = {};
            if (!plan || plan.type === 'normal') {
              delete state.dayPlans[dateStr];
            } else {
              state.dayPlans[dateStr] = plan;
            }
            saveSessionsToStorage();
            updateApp();
          },
          toggleLanguage: () => toggleLanguage(),
          getLanguage: () => getLang(),
          openHelpModal: () => {
            renderHelpContent();
            document.getElementById('help-modal')?.showModal();
          },
          closeHelpModal: () => document.getElementById('help-modal')?.close(),
          handleDayClick: (dateStr) => {
            const allCalls = [];
            (schedule.subjects || []).forEach(sub => {
              (sub.modules || []).forEach(mod => {
                (mod.calls || []).forEach(call => {
                  allCalls.push(call);
                });
              });
            });
            const dayCalls = allCalls.filter(c => c.date === dateStr);
            if (dayCalls.length > 0) {
              const allSelected = dayCalls.every(c => state.selectedCallIds.has(c.id));
              if (allSelected) {
                dayCalls.forEach(c => state.selectedCallIds.delete(c.id));
              } else {
                dayCalls.forEach(c => state.selectedCallIds.add(c.id));
              }
              updateApp();
            } else {
              openDayDialog(dateStr);
            }
          }
        };
      }

      // Initialize Application
      applyI18n();
      renderHeader();
      renderSessionSwitcher();
      renderPresets();
      renderSliders();
      setupThemeToggle();
      setupManageModal();
      setupSessionModal();
      setupDayDialog();
      setupHelpModal();
      setupEvents();
      updateApp();

    })();
  