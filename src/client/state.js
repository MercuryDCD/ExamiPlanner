
      const state = {
        selectedCallIds: new Set(),
        subjectWeights: {},
        dayPlans: {},
        lang: (function() { try { return localStorage.getItem('examplan-lang') || 'es'; } catch (e) { return 'es'; } })(),
        activeMonth: 'all',
        currentAnalysis: null,
        prioritizeSafety: false,
        lastOptimizationMode: 'max-spacing',
        activeModalTab: 'subjects',
        editingSubjectId: null,
        editingCallId: null,
        editingSessionId: null
      };

      // 2. Load Sessions (with Transparent Migration from Legacy or Embedded)
      try {
        const storedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
        if (storedSessions) {
          const parsed = JSON.parse(storedSessions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            sessions = parsed.map((s, idx) => {
              const normSched = normalizeSchedule(s.schedule || baseFallbackSchedule);
              const icon = s.icon || normSched.meta?.icon || detectSessionIcon(normSched.meta);
              return {
                id: String(s.id || `session_${Date.now()}_${idx}`),
                name: String(s.name || normSched.meta?.session || normSched.meta?.title || 'Mi Sesión'),
                icon: icon,
                schedule: normSched,
                selectedCallIds: (Array.isArray(s.selectedCallIds) && s.selectedCallIds.length > 0) ? s.selectedCallIds : extractSelectedCallIds(normSched),
                subjectWeights: typeof s.subjectWeights === 'object' && s.subjectWeights !== null ? s.subjectWeights : {},
                dayPlans: typeof s.dayPlans === 'object' && s.dayPlans !== null ? s.dayPlans : {},
                prioritizeSafety: Boolean(s.prioritizeSafety),
                createdAt: s.createdAt || Date.now(),
                updatedAt: s.updatedAt || Date.now()
              };
            });
            const storedActiveId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
            if (storedActiveId && sessions.some(s => s.id === storedActiveId)) {
              activeSessionId = storedActiveId;
            } else {
              activeSessionId = sessions[0].id;
            }
          }
        }
      } catch (e) {
        console.warn('Error reading sessions from localStorage:', e);
      }

      // If no sessions yet, perform migration from legacy storage or create initial session
      if (sessions.length === 0) {
        let initialSched = null;
        try {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const parsedLegacy = JSON.parse(legacy);
            const val = validateSchedule(parsedLegacy, { allowEmptySubjects: true });
            if (val.valid) initialSched = normalizeSchedule(parsedLegacy);
          }
        } catch (e) {
          console.warn('Error checking legacy storage:', e);
        }

        if (!initialSched) {
          initialSched = baseFallbackSchedule;
        }

        const initialIcon = initialSched.meta?.icon || detectSessionIcon(initialSched.meta);
        const initialName = initialSched.meta?.session || initialSched.meta?.title || 'Sesión de Invierno';

        const initialSession = {
          id: 'session_' + Date.now(),
          name: initialName,
          icon: initialIcon,
          schedule: initialSched,
          selectedCallIds: [],
          subjectWeights: {},
          dayPlans: {},
          prioritizeSafety: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        initialSession.selectedCallIds = extractSelectedCallIds(initialSched);
        (initialSched.subjects || []).forEach(sub => {
          initialSession.subjectWeights[sub.id] = sub.defaultWeight || (sub.difficulty === 'high' ? 5 : sub.difficulty === 'low' ? 1 : 3);
        });

        sessions = [initialSession];
        activeSessionId = initialSession.id;
        loadActiveSessionIntoState();
        saveSessionsToStorage();
      }

      function getActiveSession() {
        return sessions.find(s => s.id === activeSessionId) || sessions[0];
      }

      function loadActiveSessionIntoState() {
        const active = getActiveSession();
        if (!active) return;
        activeSessionId = active.id;
        schedule = normalizeSchedule(active.schedule);
        active.schedule = schedule;
        active.icon = active.icon || schedule.meta?.icon || detectSessionIcon(schedule.meta);
        active.name = active.name || schedule.meta?.session || schedule.meta?.title || 'Mi Sesión';

        const initialActiveIds = (Array.isArray(active.selectedCallIds) && active.selectedCallIds.length > 0)
          ? active.selectedCallIds
          : extractSelectedCallIds(schedule);
        state.selectedCallIds = new Set(initialActiveIds);
        state.subjectWeights = typeof active.subjectWeights === 'object' && active.subjectWeights !== null ? { ...active.subjectWeights } : {};
        state.dayPlans = typeof active.dayPlans === 'object' && active.dayPlans !== null ? { ...active.dayPlans } : {};
        state.prioritizeSafety = Boolean(active.prioritizeSafety);
        state.isLoaded = true;

        // Ensure weights for all subjects
        (schedule.subjects || []).forEach(sub => {
          if (typeof state.subjectWeights[sub.id] !== 'number') {
            state.subjectWeights[sub.id] = sub.defaultWeight || (sub.difficulty === 'high' ? 5 : sub.difficulty === 'low' ? 1 : 3);
          }
        });

        // Prune stale call IDs
        const allValidCallIds = new Set();
        (schedule.subjects || []).forEach(sub => {
          (sub.modules || []).forEach(mod => {
            (mod.calls || []).forEach(c => allValidCallIds.add(c.id));
          });
        });
        for (const id of Array.from(state.selectedCallIds)) {
          if (!allValidCallIds.has(id)) state.selectedCallIds.delete(id);
        }

        // Sync back active session
        active.selectedCallIds = Array.from(state.selectedCallIds);
        active.subjectWeights = { ...state.subjectWeights };
        active.dayPlans = { ...state.dayPlans };
      }

      function saveSessionsToStorage() {
        try {
          const active = getActiveSession();
          if (active && state.isLoaded) {
            active.selectedCallIds = Array.from(state.selectedCallIds);
            active.subjectWeights = { ...state.subjectWeights };
            active.dayPlans = { ...state.dayPlans };
            active.prioritizeSafety = Boolean(state.prioritizeSafety);
            active.updatedAt = Date.now();
            if (active.schedule) {
              (active.schedule.subjects || []).forEach(sub => {
                (sub.modules || []).forEach(mod => {
                  (mod.calls || []).forEach(c => {
                    const isSel = state.selectedCallIds.has(String(c.id));
                    c.status = isSel ? 'active' : 'inactive';
                    c.active = isSel;
                  });
                });
              });
              active.schedule.selectedCallIds = Array.from(state.selectedCallIds);
              if (Array.isArray(active.schedule.presets) && active.schedule.presets.length > 0) {
                active.schedule.presets[0].selectedCallIds = Array.from(state.selectedCallIds);
              }
            }
          }
          localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
          if (activeSessionId) {
            localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
          }
          if (active && active.schedule) {
            localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(active.schedule));
          }
        } catch (e) {
          console.warn('Error saving sessions to localStorage:', e);
        }
      }

      function persistSchedule(newSchedule) {
        schedule = normalizeSchedule(newSchedule);
        const active = getActiveSession();
        if (active) {
          active.schedule = schedule;
          active.name = schedule.meta?.session || schedule.meta?.title || active.name;
          active.icon = schedule.meta?.icon || active.icon || '🎓';
          active.updatedAt = Date.now();
        }

        // Clean weights
        (schedule.subjects || []).forEach(sub => {
          if (typeof state.subjectWeights[sub.id] !== 'number') {
            state.subjectWeights[sub.id] = sub.defaultWeight || (sub.difficulty === 'high' ? 5 : sub.difficulty === 'low' ? 1 : 3);
          }
        });

        // Prune stale selected call IDs
        const allValidCallIds = new Set();
        (schedule.subjects || []).forEach(sub => {
          (sub.modules || []).forEach(mod => {
            (mod.calls || []).forEach(c => allValidCallIds.add(c.id));
          });
        });
        for (const id of Array.from(state.selectedCallIds)) {
          if (!allValidCallIds.has(id)) state.selectedCallIds.delete(id);
        }

        if (active) {
          active.selectedCallIds = Array.from(state.selectedCallIds);
          active.subjectWeights = { ...state.subjectWeights };
          active.dayPlans = { ...state.dayPlans };
          active.prioritizeSafety = Boolean(state.prioritizeSafety);
        }

        saveSessionsToStorage();

        renderHeader();
        renderSessionSwitcher();
        renderPresets();
        renderSliders();
        updateApp();
        renderModalSubjects();
        populateMetaForm();
      }

      function switchSession(targetSessionId) {
        if (!sessions.some(s => s.id === targetSessionId)) return;
        // Save current active state
        const current = getActiveSession();
        if (current) {
          current.selectedCallIds = Array.from(state.selectedCallIds);
          current.subjectWeights = { ...state.subjectWeights };
          current.dayPlans = { ...state.dayPlans };
          current.prioritizeSafety = Boolean(state.prioritizeSafety);
          current.updatedAt = Date.now();
        }

        activeSessionId = targetSessionId;
        loadActiveSessionIntoState();
        saveSessionsToStorage();

        renderHeader();
        renderSessionSwitcher();
        renderPresets();
        renderSliders();
        const safetyToggle = document.getElementById('toggle-prioritize-safety');
        if (safetyToggle) safetyToggle.checked = Boolean(state.prioritizeSafety);

        updateApp();
        renderModalSubjects();
        populateMetaForm();
        showToast(`Sesión cambiada a: ${getActiveSession().icon} ${getActiveSession().name}`, 'info', 2000);
      }

      function createSession({ name, icon, mode }) {
        const trimmedName = (name || '').trim() || 'Nueva Sesión';
        const chosenIcon = (icon || '').trim() || '🎓';
        const currentActive = getActiveSession();

        let newSchedule;
        let newSelectedCallIds = [];
        let newWeights = {};

        if (mode === 'copy_current' && currentActive) {
          if (currentActive.id === activeSessionId && state.isLoaded) {
            currentActive.selectedCallIds = Array.from(state.selectedCallIds);
            currentActive.subjectWeights = { ...state.subjectWeights };
            currentActive.dayPlans = { ...state.dayPlans };
            currentActive.prioritizeSafety = Boolean(state.prioritizeSafety);
            currentActive.updatedAt = Date.now();
          }
          newSchedule = JSON.parse(JSON.stringify(currentActive.schedule));
          newSchedule.meta = newSchedule.meta || {};
          newSchedule.meta.session = trimmedName;
          newSchedule.meta.icon = chosenIcon;
          newSelectedCallIds = [...currentActive.selectedCallIds];
          newWeights = { ...currentActive.subjectWeights };
        } else if (mode === 'sample') {
          newSchedule = JSON.parse(JSON.stringify(baseFallbackSchedule));
          newSchedule.meta = newSchedule.meta || {};
          newSchedule.meta.session = trimmedName;
          newSchedule.meta.icon = chosenIcon;
          (newSchedule.subjects || []).forEach(sub => {
            (sub.modules || []).forEach(mod => {
              if (!mod.alreadyPassed && mod.calls?.[0]) {
                newSelectedCallIds.push(mod.calls[0].id);
              }
            });
            newWeights[sub.id] = sub.defaultWeight || 3;
          });
        } else {
          // Empty clean schedule
          newSchedule = {
            meta: {
              title: trimmedName,
              institution: currentActive?.schedule?.meta?.institution || '',
              academicYear: currentActive?.schedule?.meta?.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
              session: trimmedName,
              icon: chosenIcon,
              creditUnit: currentActive?.schedule?.meta?.creditUnit || 'CFU',
              targetCredits: 30
            },
            subjects: [],
            presets: []
          };
        }

        const newSession = {
          id: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: trimmedName,
          icon: chosenIcon,
          schedule: normalizeSchedule(newSchedule),
          selectedCallIds: newSelectedCallIds,
          subjectWeights: newWeights,
          dayPlans: mode === 'copy_current' ? JSON.parse(JSON.stringify(currentActive?.dayPlans || {})) : {},
          prioritizeSafety: mode === 'copy_current' ? Boolean(currentActive?.prioritizeSafety) : false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        sessions.push(newSession);
        saveSessionsToStorage();
        switchSession(newSession.id);
        showToast(`¡Sesión "${newSession.icon} ${newSession.name}" creada con éxito!`, 'success');
      }

      function duplicateSession(sessionId) {
        const target = sessions.find(s => s.id === sessionId) || getActiveSession();
        if (!target) return;
        if (target.id === activeSessionId) {
          target.selectedCallIds = Array.from(state.selectedCallIds);
          target.subjectWeights = { ...state.subjectWeights };
          target.dayPlans = { ...state.dayPlans };
          target.prioritizeSafety = Boolean(state.prioritizeSafety);
        }
        const dupName = `${target.name} (Copia)`;
        const dupSchedule = JSON.parse(JSON.stringify(target.schedule));
        if (dupSchedule.meta) {
          dupSchedule.meta.session = dupName;
        }

        const duplicated = {
          id: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: dupName,
          icon: target.icon || '🎓',
          schedule: normalizeSchedule(dupSchedule),
          selectedCallIds: Array.isArray(target.selectedCallIds) ? [...target.selectedCallIds] : Array.from(state.selectedCallIds),
          subjectWeights: typeof target.subjectWeights === 'object' ? { ...target.subjectWeights } : { ...state.subjectWeights },
          dayPlans: JSON.parse(JSON.stringify(target.dayPlans || state.dayPlans || {})),
          prioritizeSafety: Boolean(target.prioritizeSafety),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        sessions.push(duplicated);
        saveSessionsToStorage();
        switchSession(duplicated.id);
        showToast(`Sesión duplicada: ${duplicated.icon} ${duplicated.name}`, 'success');
      }

      function deleteSession(sessionId) {
        if (sessions.length <= 1) {
          alert('No puedes eliminar la única sesión disponible. Debes mantener al menos un calendario.');
          return;
        }
        const target = sessions.find(s => s.id === sessionId);
        if (!target) return;

        if (!confirm(`¿Eliminar definitivamente la sesión "${target.icon} ${target.name}"?\nSe perderán todas sus asignaturas y llamadas configuradas.`)) {
          return;
        }

        sessions = sessions.filter(s => s.id !== sessionId);
        if (activeSessionId === sessionId) {
          activeSessionId = sessions[0].id;
          loadActiveSessionIntoState();
          saveSessionsToStorage();
          renderHeader();
          renderSessionSwitcher();
          renderPresets();
          renderSliders();
          const safetyToggle = document.getElementById('toggle-prioritize-safety');
          if (safetyToggle) safetyToggle.checked = Boolean(state.prioritizeSafety);
          updateApp();
          renderModalSubjects();
          populateMetaForm();
        } else {
          saveSessionsToStorage();
          renderSessionSwitcher();
        }
        showToast('Sesión eliminada.', 'info');
      }

      // Reset to Default Generic Template
      function resetToDefaultTemplate() {
        if (!confirm('¿Restablecer el planificador a la plantilla de ejemplo de Fundamentos de Programación? Se perderán las modificaciones no guardadas.')) return;
        try {
          localStorage.removeItem(SESSIONS_STORAGE_KEY);
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          location.reload();
        } catch (e) {}
      }

      loadActiveSessionIntoState();

      // --- Core Analyzer Logic In Browser ---