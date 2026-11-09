      function renderHeader() {
        const active = getActiveSession();
        const activeName = active?.name || schedule.meta?.session || schedule.meta?.title || 'ExamPlanner';
        const activeIcon = active?.icon || schedule.meta?.icon || '🎓';

        if (typeof document !== 'undefined') {
          document.title = `${activeName} — ExamPlanner`;
        }

        document.getElementById('header-title').textContent = activeName;
        const inst = schedule.meta?.institution || '';
        const session = schedule.meta?.session || '';
        const year = schedule.meta?.academicYear || '';
        document.getElementById('header-subtitle').textContent = [inst, session, year].filter(Boolean).join(' • ');

        const calTag = document.getElementById('calendar-session-tag');
        if (calTag) {
          calTag.innerHTML = `${renderIcon(activeIcon, 'w-3.5 h-3.5 inline-block mr-1 -mt-0.5')} ${escapeHtml(session || activeName || year)}`;
        }

        const brandIconEl = document.getElementById('header-brand-icon');
        if (brandIconEl) brandIconEl.innerHTML = renderIcon(activeIcon, 'w-4 h-4');

        const curIconEl = document.getElementById('current-session-icon');
        if (curIconEl) curIconEl.innerHTML = renderIcon(activeIcon, 'w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400');

        const curNameEl = document.getElementById('current-session-name');
        if (curNameEl) curNameEl.textContent = activeName;

        const curCountEl = document.getElementById('current-session-count');
        if (curCountEl) {
          let totalExams = 0;
          (schedule.subjects || []).forEach(sub => {
            (sub.modules || []).forEach(mod => {
              totalExams += (mod.calls || []).length;
            });
          });
          curCountEl.textContent = t('exam_count_badge', totalExams);
        }

        const importCurLabel = document.getElementById('import-current-session-label');
        if (importCurLabel) {
          importCurLabel.innerHTML = `${renderIcon(activeIcon, 'w-3.5 h-3.5 inline-block mr-1 -mt-0.5')} ${escapeHtml(activeName)}`;
        }
      }

      function renderSessionSwitcher() {
        const container = document.getElementById('session-dropdown-items');
        if (!container) return;
        container.innerHTML = '';

        sessions.forEach(sess => {
          const isActive = (sess.id === activeSessionId);
          let callCount = 0;
          (sess.schedule?.subjects || []).forEach(sub => {
            (sub.modules || []).forEach(mod => {
              callCount += (mod.calls || []).length;
            });
          });
          const subCount = (sess.schedule?.subjects || []).length;

          const item = document.createElement('div');
          item.className = `p-1 rounded-xl transition ${
            isActive
              ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
          }`;

          item.innerHTML = `
            <button type="button" role="menuitem" class="flex items-center gap-2.5 text-left w-full p-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer" data-switch-session="${sess.id}" aria-label="Cambiar a sesión ${escapeHtml(sess.name)}" ${isActive ? 'aria-current="true"' : ''}>
              <span class="text-lg flex-shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shadow-xs select-none">
                ${renderIcon(sess.icon || '🎓', 'w-4 h-4 text-indigo-600 dark:text-indigo-400')}
              </span>
              <div class="truncate flex-1 min-w-0">
                <div class="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5 leading-tight">
                  <span class="truncate">${escapeHtml(sess.name)}</span>
                  ${isActive ? `<span class="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold tracking-wider flex-shrink-0">${t('session_active_badge')}</span>` : ''}
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5">
                  ${subCount} ${t('subjects_unit')} • ${callCount} ${t('calls_label')}
                </div>
              </div>
            </button>
          `;

          item.querySelector(`[data-switch-session="${sess.id}"]`)?.addEventListener('click', () => {
            switchSession(sess.id);
            closeSessionDropdown();
          });

          container.appendChild(item);
        });

        const deleteActiveBtn = document.getElementById('btn-delete-active-session');
        if (deleteActiveBtn) {
          if (sessions.length <= 1) {
            deleteActiveBtn.setAttribute('disabled', 'true');
            deleteActiveBtn.classList.add('opacity-40', 'cursor-not-allowed');
            deleteActiveBtn.title = t('delete_single_session_disabled_title');
          } else {
            deleteActiveBtn.removeAttribute('disabled');
            deleteActiveBtn.classList.remove('opacity-40', 'cursor-not-allowed');
            deleteActiveBtn.title = t('title_delete');
          }
        }
      }

      function toggleSessionDropdown() {
        const menu = document.getElementById('session-dropdown-menu');
        const btn = document.getElementById('btn-session-dropdown');
        const arrow = document.getElementById('session-dropdown-arrow');
        if (!menu || !btn) return;
        const isClosed = menu.classList.contains('hidden');
        if (isClosed) {
          renderSessionSwitcher();
          menu.classList.remove('hidden');
          btn.setAttribute('aria-expanded', 'true');
          if (arrow) arrow.classList.add('rotate-180');
        } else {
          closeSessionDropdown();
        }
      }

      function closeSessionDropdown() {
        const menu = document.getElementById('session-dropdown-menu');
        const btn = document.getElementById('btn-session-dropdown');
        const arrow = document.getElementById('session-dropdown-arrow');
        if (menu) menu.classList.add('hidden');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (arrow) arrow.classList.remove('rotate-180');
      }

      const PRESET_EMOJIS = ['❄️', '☀️', '🍂', '🎓', '🤖', '📚', '🚀', '💡', '🎯', '🔬', '⚡', '☕', '🌟', '💼', '🧪', '🏛️'];

      function renderEmojiGrid(selectedEmoji) {
        const grid = document.getElementById('session-emoji-grid');
        if (!grid) return;
        grid.innerHTML = '';
        PRESET_EMOJIS.forEach(emoji => {
          const btn = document.createElement('button');
          btn.type = 'button';
          const isSel = (emoji === selectedEmoji);
          btn.className = `w-8 h-8 rounded-lg flex items-center justify-center text-base transition ${
            isSel
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-110'
              : 'hover:bg-slate-200 dark:hover:bg-slate-700 bg-white dark:bg-slate-800'
          }`;
          btn.innerHTML = renderIcon(emoji, 'w-4 h-4');
          btn.title = `Seleccionar ${emoji}`;
          btn.setAttribute('aria-label', `Seleccionar icono ${emoji}`);
          btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
          btn.addEventListener('click', () => {
            document.getElementById('session-modal-icon-input').value = emoji;
            document.getElementById('session-modal-badge-icon').innerHTML = renderIcon(emoji, 'w-5 h-5');
            renderEmojiGrid(emoji);
          });
          grid.appendChild(btn);
        });
      }

      function openCreateSessionModal() {
        const modal = document.getElementById('session-modal');
        if (!modal) return;
        state.editingSessionId = null;

        document.getElementById('session-modal-title').textContent = t('session_modal_title_new');
        document.getElementById('session-modal-subtitle').textContent = t('session_modal_subtitle_new');
        document.getElementById('btn-save-session-modal').textContent = t('btn_create_session');
        document.getElementById('session-modal-initial-mode-wrapper')?.classList.remove('hidden');

        const active = getActiveSession();
        const activeName = active ? active.name : '';
        const copyHint = document.getElementById('session-init-copy-hint');
        if (copyHint && activeName) {
          copyHint.textContent = t('session_init_copy_named', activeName);
        }

        const nameInput = document.getElementById('session-modal-name');
        nameInput.value = '';
        nameInput.placeholder = t('placeholder_session_name');

        const defaultEmoji = '☀️';
        document.getElementById('session-modal-icon-input').value = defaultEmoji;
        document.getElementById('session-modal-badge-icon').innerHTML = renderIcon(defaultEmoji, 'w-5 h-5');
        renderEmojiGrid(defaultEmoji);

        modal.showModal();
        setTimeout(() => nameInput.focus(), 50);
      }

      function openEditSessionModal(sessionId) {
        const target = sessions.find(s => s.id === sessionId) || getActiveSession();
        if (!target) return;
        const modal = document.getElementById('session-modal');
        if (!modal) return;

        state.editingSessionId = target.id;
        document.getElementById('session-modal-title').textContent = t('session_modal_title_edit');
        document.getElementById('session-modal-subtitle').textContent = t('session_modal_subtitle_edit');
        document.getElementById('btn-save-session-modal').textContent = t('btn_save');
        document.getElementById('session-modal-initial-mode-wrapper')?.classList.add('hidden');

        const nameInput = document.getElementById('session-modal-name');
        nameInput.value = target.name || '';

        const icon = target.icon || '🎓';
        document.getElementById('session-modal-icon-input').value = icon;
        document.getElementById('session-modal-badge-icon').innerHTML = renderIcon(icon, 'w-5 h-5');
        renderEmojiGrid(icon);

        modal.showModal();
        setTimeout(() => nameInput.focus(), 50);
      }

      function closeSessionModal() {
        const modal = document.getElementById('session-modal');
        if (modal && modal.open) modal.close();
      }

      function setupSessionModal() {
        const modal = document.getElementById('session-modal');
        const form = document.getElementById('session-modal-form');
        const closeBtn = document.getElementById('btn-close-session-modal');
        const cancelBtn = document.getElementById('btn-cancel-session-modal');
        const iconInput = document.getElementById('session-modal-icon-input');

        closeBtn?.addEventListener('click', closeSessionModal);
        cancelBtn?.addEventListener('click', closeSessionModal);

        iconInput?.addEventListener('input', (e) => {
          const val = e.target.value.trim() || '🎓';
          document.getElementById('session-modal-badge-icon').innerHTML = renderIcon(val, 'w-5 h-5');
          renderEmojiGrid(val);
        });

        // Light dismiss fallback (modern-web-guidance)
        if (modal && (typeof HTMLDialogElement === 'undefined' || !('closedBy' in HTMLDialogElement.prototype))) {
          let pressedOutside = false;
          modal.addEventListener('pointerdown', (e) => {
            const r = modal.getBoundingClientRect();
            pressedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          });
          modal.addEventListener('pointerup', (e) => {
            const r = modal.getBoundingClientRect();
            const releasedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
            if (pressedOutside && releasedOutside) closeSessionModal();
          });
        }

        form?.addEventListener('submit', (e) => {
          e.preventDefault();
          const nameVal = document.getElementById('session-modal-name').value.trim();
          const iconVal = document.getElementById('session-modal-icon-input').value.trim() || '🎓';

          if (!nameVal) {
            alert(t('alert_session_name_required'));
            return;
          }

          if (state.editingSessionId) {
            const target = sessions.find(s => s.id === state.editingSessionId);
            if (target) {
              target.name = nameVal;
              target.icon = iconVal;
              if (target.schedule && target.schedule.meta) {
                target.schedule.meta.session = nameVal;
                target.schedule.meta.icon = iconVal;
              }
              if (target.id === activeSessionId) {
                schedule.meta.session = nameVal;
                schedule.meta.icon = iconVal;
              }
              saveSessionsToStorage();
              renderHeader();
              renderSessionSwitcher();
              populateMetaForm();
              updateApp();
              showToast(t('toast_session_saved'), 'success');
            }
            closeSessionModal();
          } else {
            const mode = document.querySelector('input[name="session-init-mode"]:checked')?.value || 'copy_current';
            createSession({ name: nameVal, icon: iconVal, mode });
            closeSessionModal();
          }
        });
      }

      function renderPresets() {
        const select = document.getElementById('preset-select');
        select.innerHTML = `<option value="">${t('presets_default_opt')}</option>`;
        (schedule.presets || []).forEach((p, idx) => {
          const opt = document.createElement('option');
          opt.value = idx;
          opt.textContent = `${p.name}`;
          select.appendChild(opt);
        });
        if (schedule.presets && schedule.presets.length > 0) {
          select.value = '0';
        }
      }

      function getExamTypesForModule(mod, sub) {
        const evalMode = mod.evaluationMode || sub?.evaluationMode || 'standard';
        const typesSet = new Set();
        if (evalMode === 'written_and_oral') {
          typesSet.add('written');
          typesSet.add('oral');
        } else if (evalMode === 'written_and_lab') {
          typesSet.add('written');
          typesSet.add('lab');
        }
        (mod.calls || []).forEach(c => {
          if (c.type && c.type !== 'standard') {
            typesSet.add(c.type);
          }
        });
        if (typesSet.size === 0) {
          return [{ type: 'standard', label: '', icon: '' }];
        }
        return Array.from(typesSet).map(type => {
          let label = '';
          let icon = '';
          if (type === 'written') {
            label = t('badge_written') || 'Escrito';
            icon = '✍️';
          } else if (type === 'oral') {
            label = t('badge_oral') || 'Oral';
            icon = '🗣️';
          } else if (type === 'lab') {
            label = t('badge_lab') || 'Lab';
            icon = '💻';
          } else {
            label = type;
            icon = '📝';
          }
          return { type, label, icon };
        });
      }

      function renderSliders() {
        const container = document.getElementById('sliders-list');
        container.innerHTML = '';

        const creditUnit = schedule.meta?.creditUnit || 'ECTS';

        (schedule.subjects || []).forEach(sub => {
          const token = getColorToken(sub.color);
          const safeSubName = escapeHtml(sub.name);
          const subAcronym = escapeHtml(sub.shortName || generateSubjectAcronym(sub.name));
          const modulesList = (sub.modules || []).filter(m => !m.alreadyPassed);
          const totalMods = (sub.modules || []).length;
          const isMultiModuleSub = sub.hasModules !== false && totalMods > 1;

          modulesList.forEach(mod => {
            const safeModName = escapeHtml(mod.name);
            const modAcronym = escapeHtml(mod.shortName || generateModuleShortName(mod.name));
            const modCredits = mod.credits || sub.credits || 6;
            const examTypes = getExamTypesForModule(mod, sub);

            examTypes.forEach(typeItem => {
              const isTypeSpecific = examTypes.length > 1;
              const sliderKey = isTypeSpecific ? `${mod.id}__${typeItem.type}` : mod.id;
              const subTypeKey = isTypeSpecific ? `${sub.id}__${typeItem.type}` : sub.id;

              const currentWeight = (state.subjectWeights && state.subjectWeights[sliderKey])
                || (state.subjectWeights && state.subjectWeights[subTypeKey])
                || (state.subjectWeights && state.subjectWeights[mod.id])
                || (state.subjectWeights && state.subjectWeights[sub.id])
                || mod.defaultWeight
                || sub.defaultWeight
                || 3;

              const acronymBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${token.bg} text-white shrink-0 tracking-wide">[${subAcronym}]</span>`;
              const typeBadge = isTypeSpecific && typeItem.label
                ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shrink-0 inline-flex items-center gap-1">${typeItem.icon} ${typeItem.label}</span>`
                : '';

              const labelText = isMultiModuleSub && safeModName !== safeSubName
                ? `<div class="flex items-center gap-1.5 min-w-0 flex-wrap"><span class="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">[${modAcronym}]</span><span class="font-bold text-slate-800 dark:text-slate-100 truncate">${safeModName}</span>${typeBadge}</div>`
                : `<div class="flex items-center gap-1.5 min-w-0 flex-wrap"><span class="font-bold text-slate-800 dark:text-slate-100 truncate">${safeSubName}</span>${typeBadge}</div>`;

              const card = document.createElement('div');
              card.className = 'space-y-1.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50';

              card.innerHTML = `
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    ${acronymBadge}
                    <div class="font-semibold text-slate-800 dark:text-slate-200 truncate" title="${safeSubName}${isMultiModuleSub ? ' › ' + safeModName : ''}${typeItem.label ? ' (' + typeItem.label + ')' : ''}">
                      ${labelText}
                    </div>
                    <span class="text-[10px] text-slate-400 flex-shrink-0 font-mono">(${modCredits} ${creditUnit})</span>
                  </div>
                  <span id="slider-val-${sliderKey}" class="font-mono text-xs font-bold flex-shrink-0 ml-2 ${token.text}">
                    ${currentWeight}/5
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="1" 
                    value="${currentWeight}" 
                    data-module-id="${mod.id}"
                    data-subject-id="${sub.id}"
                    data-exam-type="${typeItem.type}"
                    data-slider-key="${sliderKey}"
                    aria-label="Dificultad de ${safeModName} ${typeItem.label || ''}"
                    class="module-slider w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                  >
                </div>
              `;

              container.appendChild(card);
            });
          });
        });

        // Add reactive event listeners to module sliders
        let sliderAnimFrame = null;
        container.querySelectorAll('.module-slider').forEach(input => {
          input.addEventListener('input', (e) => {
            const modId = e.target.getAttribute('data-module-id');
            const subId = e.target.getAttribute('data-subject-id');
            const examType = e.target.getAttribute('data-exam-type');
            const sliderKey = e.target.getAttribute('data-slider-key') || modId;
            const val = parseInt(e.target.value, 10);
            
            state.subjectWeights[sliderKey] = val;
            if (examType && examType !== 'standard') {
              state.subjectWeights[`${modId}__${examType}`] = val;
              if (subId) state.subjectWeights[`${subId}__${examType}`] = val;
            } else {
              state.subjectWeights[modId] = val;
              if (subId) state.subjectWeights[subId] = val;
            }
            
            const label = document.getElementById(`slider-val-${sliderKey}`);
            if (label) label.textContent = `${val}/5`;

            sliderAnimFrame = requestAnimationFrame(() => {
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
          });
        });
      }

      function renderKPIs(analysis) {
        const { metrics, counts } = analysis;

        // Covered Exams / Modules KPI
        const examsCurrent = document.getElementById('kpi-exams-current');
        const examsTotal = document.getElementById('kpi-exams-total');
        const examsBadge = document.getElementById('kpi-exams-badge');
        const examsProgress = document.getElementById('kpi-exams-progress');

        const coveredCount = metrics.coveredModulesCount ?? 0;
        const totalReq = metrics.totalRequiredModules ?? 0;
        const covPct = metrics.coveragePercentage ?? (totalReq > 0 ? Math.round((coveredCount / totalReq) * 100) : 100);

        if (examsCurrent) examsCurrent.textContent = coveredCount;
        if (examsTotal) examsTotal.textContent = totalReq;
        if (examsBadge) examsBadge.textContent = `${covPct}%`;
        if (examsProgress) {
          examsProgress.style.width = `${covPct}%`;
          if (metrics.isAllModulesCovered) {
            examsProgress.className = 'bg-emerald-500 h-full rounded-full transition-all duration-300';
            if (examsBadge) examsBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400';
          } else {
            examsProgress.className = 'bg-indigo-600 h-full rounded-full transition-all duration-300';
            if (examsBadge) examsBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
          }
        }

        // Backward compatibility for credits elements
        const credCurrent = document.getElementById('kpi-credits-current');
        if (credCurrent) credCurrent.textContent = metrics.totalCredits;
        const credTarget = document.getElementById('kpi-credits-target');
        if (credTarget) credTarget.textContent = metrics.targetCredits;
        const credUnit = document.getElementById('kpi-credit-unit');
        if (credUnit) credUnit.textContent = schedule.meta?.creditUnit || 'CFU';
        const credProgress = document.getElementById('kpi-credits-progress');
        const credBadge = document.getElementById('kpi-credits-badge');
        const credPct = metrics.targetCredits > 0 ? Math.min(100, Math.round((metrics.totalCredits / metrics.targetCredits) * 100)) : 100;
        if (credProgress) credProgress.style.width = `${credPct}%`;
        if (credBadge) credBadge.textContent = `${credPct}%`;

        // Min Buffer
        const minBufEl = document.getElementById('kpi-min-buffer');
        const minBufIcon = document.getElementById('kpi-minbuffer-icon');
        const minBufHint = document.getElementById('kpi-min-buffer-hint');

        if (metrics.minBufferDays !== undefined && analysis.timeline.length > 1) {
          minBufEl.textContent = metrics.minBufferDays;
          if (metrics.minBufferDays >= 7) {
            minBufIcon.innerHTML = renderIcon('🟢', 'w-4 h-4 text-emerald-500');
            minBufHint.textContent = t('optimal_buffer');
            minBufHint.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 mt-1';
          } else if (metrics.minBufferDays >= 3) {
            minBufIcon.innerHTML = renderIcon('🟡', 'w-4 h-4 text-amber-500');
            minBufHint.textContent = t('acceptable_buffer');
            minBufHint.className = 'text-[11px] text-amber-600 dark:text-amber-400 mt-1';
          } else {
            minBufIcon.innerHTML = renderIcon('🔴', 'w-4 h-4 text-red-500');
            minBufHint.textContent = t('risk_buffer');
            minBufHint.className = 'text-[11px] text-red-600 dark:text-red-400 mt-1';
          }
        } else {
          minBufEl.textContent = '-';
          minBufIcon.innerHTML = renderIcon('⏱️', 'w-4 h-4 text-slate-400');
          minBufHint.textContent = t('select_2_exams');
          minBufHint.className = 'text-[11px] text-slate-400 mt-1';
        }

        // Average Buffer & Variance
        if (analysis.timeline.length > 1) { document.getElementById('kpi-avg-buffer').textContent = metrics.avgBufferDays;
          const varVal = metrics.bufferVariance;
          const hint = varVal <= 2.5 ? t('variance_hint_good') : t('variance_hint_uneven');
          document.getElementById('kpi-variance-hint').textContent = hint;
        } else {
          document.getElementById('kpi-avg-buffer').textContent = '-'; document.getElementById('kpi-variance-hint').textContent = t('select_2_exams');
        }

        // Conflicts
        const confCountEl = document.getElementById('kpi-conflicts-count');
        const confIcon = document.getElementById('kpi-conflicts-icon');
        const confHint = document.getElementById('kpi-conflicts-hint');

        confCountEl.textContent = counts.totalConflicts;
        if (counts.exactCollisions > 0) {
          confIcon.innerHTML = renderIcon('⛔', 'w-4 h-4 text-red-500');
          confHint.textContent = t('conflicts_collisions', counts.exactCollisions);
          confHint.className = 'text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1';
        } else if (counts.totalConflicts > 0) {
          confIcon.innerHTML = renderIcon('⚠️', 'w-4 h-4 text-amber-500');
          confHint.textContent = t('conflicts_warnings', counts.totalConflicts);
          confHint.className = 'text-[11px] text-amber-600 dark:text-amber-400 mt-1';
        } else {
          confIcon.innerHTML = renderIcon('✅', 'w-4 h-4 text-emerald-500');
          confHint.textContent = t('kpi_conflicts_none');
          confHint.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 mt-1';
        }
      }

      function renderAlerts(analysis) {
        const container = document.getElementById('alerts-container');
        const box = document.getElementById('alerts-box');

        if (analysis.conflicts.length === 0) {
          container.classList.add('hidden');
          box.innerHTML = '';
          return;
        }

        container.classList.remove('hidden');

        const isCritical = analysis.hasCriticalErrors;
        box.className = isCritical
          ? 'rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/40 p-4 space-y-3'
          : 'rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/40 p-4 space-y-3';

        let html = `
          <div class="flex items-center justify-between border-b border-red-200/50 dark:border-red-900/40 pb-2">
            <div class="flex items-center gap-2">
              <span class="text-base ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}">${renderIcon(isCritical ? '⛔' : '⚠️', 'w-4 h-4')}</span>
              <h3 class="text-xs font-bold uppercase tracking-wider ${isCritical ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}">
                ${isCritical ? t('alerts_critical_title') : t('alerts_warning_title')} (${analysis.conflicts.length})
              </h3>
            </div>
            <span class="text-[11px] text-slate-500 dark:text-slate-400">${t('alerts_check_collisions')}</span>
          </div>
          <div class="space-y-2">
        `;

        analysis.conflicts.forEach(c => {
          html += `
            <div class="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
              <span class="text-sm shrink-0 mt-0.5 text-amber-600 dark:text-amber-400">${renderIcon(c.icon, 'w-4 h-4')}</span>
              <div class="space-y-0.5 flex-1">
                <div class="font-semibold text-slate-900 dark:text-slate-100">${c.title}</div>
                <div class="text-[11px] text-slate-600 dark:text-slate-400">${c.description}</div>
              </div>
            </div>
          `;
        });

        html += `</div>`;
        box.innerHTML = html;
      }

      function renderCalendar(analysis) {
        const container = document.getElementById('calendar-months-container');
        container.innerHTML = '';
        container.className = state.activeMonth === 'all'
          ? 'grid grid-cols-1 lg:grid-cols-3 gap-3 items-start'
          : 'grid grid-cols-1 gap-6 w-full max-w-6xl mx-auto';

        // Collect all calls to extract months with complete module & acronym metadata
        const callIndex = buildCallIndex(schedule);
        const allCalls = Array.from(callIndex.values());

        const tabsContainer = document.getElementById('calendar-month-tabs');

        if (allCalls.length === 0) {
          if (tabsContainer) tabsContainer.innerHTML = '';
          container.innerHTML = `
            <div class="col-span-full text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
              <span class="text-slate-400">${renderIcon('📅', 'w-8 h-8 mx-auto')}</span>
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">${t('empty_calendar_title')}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">${t('empty_calendar_desc')}</p>
            </div>
          `;
          return;
        }

        // Group by Year-Month (only months that actually have at least 1 valid call)
        const monthMap = new Map();
        allCalls.forEach(call => {
          if (!call.date || !/^\d{4}-\d{2}/.test(call.date)) return;
          const ym = call.date.slice(0, 7); // "YYYY-MM"
          if (!monthMap.has(ym)) {
            monthMap.set(ym, []);
          }
          monthMap.get(ym).push(call);
        });

        const sortedMonths = Array.from(monthMap.keys()).sort();

        // Strict month filtering: reset activeMonth if selected month has no exams
        if (state.activeMonth !== 'all' && !sortedMonths.includes(state.activeMonth)) {
          state.activeMonth = 'all';
        }

        // Month Names localized
        const monthNames = state.lang === 'en'
          ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
          : state.lang === 'it'
            ? ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
            : ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const weekDays = state.lang === 'en'
          ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          : state.lang === 'it'
            ? ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
            : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

        // Build conflict set for quick lookup
        const conflictCallIds = new Set();
        analysis.conflicts.forEach(c => {
          if (c.type === 'exact_collision' || c.type === 'same_date_congestion') {
            c.callIds.forEach(id => conflictCallIds.add(id));
          }
        });

        // Render Month View Switcher Tabs (Strict: only months with exams)
        if (tabsContainer) {
          tabsContainer.innerHTML = '';
          const createTab = (id, label) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.role = 'tab';
            btn.className = (state.activeMonth === id)
              ? 'px-2.5 py-1 rounded-lg font-bold bg-indigo-600 text-white shadow-sm transition'
              : 'px-2.5 py-1 rounded-lg font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition';
            btn.textContent = label;
            btn.addEventListener('click', () => {
              state.activeMonth = id;
              renderCalendar(analysis);
            });
            return btn;
          };

          tabsContainer.appendChild(createTab('all', t('all_months')));
          sortedMonths.forEach(ym => {
            const [yStr, mStr] = ym.split('-');
            const mIdx = parseInt(mStr, 10) - 1;
            tabsContainer.appendChild(createTab(ym, `${monthNames[mIdx]} ${yStr}`));
          });
        }

        const monthsToRender = state.activeMonth === 'all'
          ? sortedMonths
          : sortedMonths.filter(ym => ym === state.activeMonth);

        if (monthsToRender.length === 0) {
          const emptyDiv = document.createElement('div');
          emptyDiv.className = 'text-center py-12 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 space-y-2';
          emptyDiv.innerHTML = `
            <div class="text-slate-400 select-none">${renderIcon('📅', 'w-8 h-8 mx-auto')}</div>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">${t('empty_calendar_title')}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">${t('empty_calendar_desc')}</p>
          `;
          container.appendChild(emptyDiv);
        }

        monthsToRender.forEach(ym => {
          const [yearStr, monthStr] = ym.split('-');
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10) - 1;

          const monthCard = document.createElement('div');
          monthCard.className = 'border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30 shadow-xs';

          // Month header
          const monthTitle = `${monthNames[month]} ${year}`;
          let html = `
            <div class="px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 class="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide uppercase">${monthTitle}</h3>
              <span class="text-[11px] text-slate-400">${monthMap.get(ym).length} ${t('calls_label')}</span>
            </div>
            <div class="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40">
              ${weekDays.map(d => `<div>${d}</div>`).join('')}
            </div>
            <div class="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800/70 p-px">
          `;

          // Calculate calendar grid days
          const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
          // getUTCDay: 0 is Sun, 1 is Mon... convert so Monday is 0
          let startingDay = firstDayOfMonth.getUTCDay() - 1;
          if (startingDay === -1) startingDay = 6;

          const totalDaysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

          // Previous month padding
          for (let p = 0; p < startingDay; p++) {
            html += `<div class="min-h-[82px] bg-slate-100/40 dark:bg-slate-950/40 p-1 text-slate-300 dark:text-slate-700 text-[10px]"></div>`;
          }

          // Days in month
          for (let day = 1; day <= totalDaysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayCalls = allCalls.filter(c => c.date === dateStr);

            const isToday = (function() {
              const now = new Date();
              return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
            })();

            const dayPlan = state.dayPlans?.[dateStr];
            let dayBgClass = 'bg-white dark:bg-slate-900';
            let dayBorderClass = '';
            let dayPlanBadgeHtml = '';

            if (dayPlan) {
              if (dayPlan.type === 'blocked') {
                dayBgClass = 'bg-rose-50/80 dark:bg-rose-950/40';
                dayBorderClass = 'ring-1 ring-rose-400/50 dark:ring-rose-500/40';
                const noteText = dayPlan.note ? escapeHtml(dayPlan.note) : t('day_blocked_badge');
                dayPlanBadgeHtml = `
                  <div class="w-full min-w-0 overflow-hidden rounded px-0.5 py-0.5 mt-0.5 text-center text-[9.5px] leading-tight font-bold text-rose-600 dark:text-rose-400 bg-white/80 dark:bg-slate-900/70 border border-rose-300/60 dark:border-rose-700/60 break-words" title="🚫 ${escapeHtml(dayPlan.note || t('day_status_blocked'))}">
                    <span class="inline-flex items-center justify-center gap-0.5">${renderIcon('🚫', 'w-2.5 h-2.5')} ${noteText}</span>

                  </div>
                `;
              } else if (dayPlan.type === 'study') {
                const subject = (schedule.subjects || []).find(s => s.id === dayPlan.subjectId);
                const subToken = subject ? getColorToken(subject.color) : { bg: 'bg-indigo-600', text: 'text-indigo-600 dark:text-indigo-400', lightBg: 'bg-indigo-50/90 dark:bg-indigo-950/50' };
                dayBgClass = `${subToken.lightBg}`;
                dayBorderClass = 'ring-1 ring-indigo-400/50 dark:ring-indigo-500/40';
                const subName = subject ? (subject.shortName || generateSubjectAcronym(subject.name)) : t('day_study_badge'); const fullSubName = subject ? subject.name : t('day_study_badge');
                const noteText = dayPlan.note ? escapeHtml(`${subName} · ${dayPlan.note}`) : escapeHtml(subName);
                dayPlanBadgeHtml = `
                  <div class="w-full min-w-0 overflow-hidden rounded px-0.5 py-0.5 mt-0.5 text-center text-[10px] leading-tight font-extrabold ${subToken.text} bg-white/80 dark:bg-slate-900/70 border border-current/25 shadow-2xs break-words" title="📖 ${escapeHtml(fullSubName + (dayPlan.note ? ' - ' + dayPlan.note : ''))}">
                    <span>${noteText}</span>

                  </div>
                `;
              }
            }

            const seenJointKeys = new Set();
            const visibleDayCalls = dayCalls.filter(c => {
              if (c.jointExamKey) {
                if (seenJointKeys.has(c.jointExamKey)) return false;
                seenJointKeys.add(c.jointExamKey);
              }
              return true;
            });

            html += `
              <div class="day-cell min-h-[82px] min-w-0 overflow-hidden ${dayBgClass} ${dayBorderClass} p-1 flex flex-col justify-between transition group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-sm" data-date="${dateStr}" title="${t('day_click_hint')} (${dateStr})">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold ${isToday ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center' : 'text-slate-500 dark:text-slate-400'}">
                    ${day}
                  </span>
                  <div class="flex items-center gap-1">

                    <button type="button" class="day-edit-trigger opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition" data-date="${dateStr}" title="${t('day_click_hint')}">${renderIcon('✏️', 'w-2.5 h-2.5')}</button>
                  </div>
                </div>
                ${dayPlanBadgeHtml}
                <div class="space-y-1 mt-1 w-full min-w-0">
            `;

            visibleDayCalls.forEach(call => {
              const isSelected = state.selectedCallIds.has(call.id);
              const hasConflict = conflictCallIds.has(call.id);
              const token = getColorToken(call.subjectColor);
              const subAcronym = call.subjectShortName || generateSubjectAcronym(call.subjectName);
              const modDisplay = call.jointModuleLabel || call.moduleShortName || (call.hasMultipleModules ? call.moduleName : '');
              const verboseModuleLabel = `${call.subjectName}: ${call.moduleName}`;
              
              const typeIcon = call.type === 'written' ? ' ✍️' : (call.type === 'oral' ? ' 🗣️' : (call.type === 'lab' ? ' 💻' : ''));
              const displayLabel = (call.hasMultipleModules && modDisplay)
                ? `${subAcronym} · ${modDisplay}${typeIcon}`
                : `${subAcronym || call.subjectName}${typeIcon}`;

              const safeTooltip = `${escapeHtml(call.subjectName)}${call.hasMultipleModules ? ` · ${escapeHtml(call.moduleName)}` : ''} | 📅 ${call.date} ⏰ ${call.time || '09:00'} (${call.durationHours}h) - ${t('call_click_hint')}`;

              let pillStyle = '';
              if (isSelected) {
                pillStyle = `${token.bg} text-white font-semibold shadow-sm ring-1 ring-black/10`;
              } else {
                pillStyle = `bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500`;
              }

              html += `
                <button 
                  type="button"
                  data-call-id="${call.id}"
                  aria-pressed="${isSelected}"
                  title="${safeTooltip}"
                  class="call-toggle-btn w-full min-w-0 overflow-hidden text-center text-[10px] leading-tight px-0.5 py-1 rounded flex items-center justify-center gap-0.5 transition active:scale-95 shadow-xs ${pillStyle}"
                >
                  <span class="font-bold tracking-tighter min-w-0 text-center break-words leading-tight">
                    ${escapeHtml(displayLabel)}
                  </span>
                  ${hasConflict ? `<span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" title="Conflicto detectado"></span>` : ''}
                </button>
              `;
            });

            html += `
                </div>
              </div>
            `;
          }

          // Remaining padding to complete 7-col grid
          const totalRendered = startingDay + totalDaysInMonth;
          const remaining = (7 - (totalRendered % 7)) % 7;
          for (let r = 0; r < remaining; r++) {
            html += `<div class="min-h-[82px] bg-slate-100/40 dark:bg-slate-950/40 p-1 text-slate-300 dark:text-slate-700 text-[10px]"></div>`;
          }

          html += `</div></div>`;
          monthCard.innerHTML = html;
          container.appendChild(monthCard);
        });

        // Attach event listeners for pill clicks (stops propagation so it doesn't open day modal)
        container.querySelectorAll('.call-toggle-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const callId = btn.getAttribute('data-call-id');
            const targetCall = allCalls.find(c => c.id === callId);
            
            // If it's a joint exam of the same subject, toggle both partner calls together
            const relatedCalls = (targetCall && targetCall.jointExamKey)
              ? allCalls.filter(c => c.jointExamKey === targetCall.jointExamKey)
              : (targetCall ? [targetCall] : []);

            const isCurrentlySelected = state.selectedCallIds.has(callId);
            if (isCurrentlySelected) {
              if (relatedCalls.length > 0) {
                relatedCalls.forEach(c => state.selectedCallIds.delete(c.id));
              } else {
                state.selectedCallIds.delete(callId);
              }
            } else {
              if (relatedCalls.length > 0) {
                relatedCalls.forEach(c => state.selectedCallIds.add(c.id));
              } else {
                state.selectedCallIds.add(callId);
              }
            }
            const presetSelect = document.getElementById('preset-select');
            if (presetSelect) presetSelect.value = '';
            updateApp();
          });
        });

        // Attach event listeners for day cell clicks:
        // - If the day has exams: toggle the exams on this day.
        //   If all are selected, deselect them. If any is unselected, select them.
        // - If the day has 0 exams: open the day availability planning dialog.
        container.querySelectorAll('.day-cell').forEach(cell => {
          cell.addEventListener('click', (e) => {
            if (e.target.closest('.call-toggle-btn') || e.target.closest('.day-edit-trigger')) return;
            const d = cell.getAttribute('data-date');
            if (!d) return;
            const dayCalls = allCalls.filter(c => c.date === d);
            if (dayCalls.length > 0) {
              const allSelected = dayCalls.every(c => state.selectedCallIds.has(c.id));
              if (allSelected) {
                dayCalls.forEach(c => state.selectedCallIds.delete(c.id));
              } else {
                dayCalls.forEach(c => state.selectedCallIds.add(c.id));
              }
              const presetSelect = document.getElementById('preset-select');
              if (presetSelect) presetSelect.value = '';
              updateApp();
            } else {
              openDayDialog(d);
            }
          });
        });
        container.querySelectorAll('.day-edit-trigger').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const d = btn.getAttribute('data-date');
            if (d) openDayDialog(d);
          });
        });
      }

      function openDayDialog(dateStr) {
        const dialog = document.getElementById('day-dialog');
        if (!dialog) return;

        const dateInput = document.getElementById('day-dialog-date');
        if (dateInput) dateInput.value = dateStr;

        const titleEl = document.getElementById('day-dialog-title');
        if (titleEl) titleEl.textContent = `${t('day_dialog_title')} (${dateStr})`;

        // Populate subject select
        const subSelect = document.getElementById('day-dialog-subject-select');
        if (subSelect) {
          subSelect.innerHTML = '';
          (schedule.subjects || []).forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.id;
            opt.textContent = sub.name;
            subSelect.appendChild(opt);
          });
        }

        const existingPlan = state.dayPlans?.[dateStr];
        const planType = existingPlan ? existingPlan.type : 'normal';

        const radios = dialog.querySelectorAll('input[name="day-plan-type"]');
        radios.forEach(r => {
          r.checked = (r.value === planType);
        });

        const subGroup = document.getElementById('day-dialog-subject-group');
        if (subGroup) {
          if (planType === 'study') subGroup.classList.remove('hidden');
          else subGroup.classList.add('hidden');
        }

        if (existingPlan?.subjectId && subSelect) {
          subSelect.value = existingPlan.subjectId;
        }

        const noteInput = document.getElementById('day-dialog-note');
        if (noteInput) {
          noteInput.value = existingPlan?.note || '';
        }

        dialog.showModal();
        setTimeout(() => noteInput?.focus(), 50);
      }

      function closeDayDialog() {
        const dialog = document.getElementById('day-dialog');
        if (dialog && dialog.open) dialog.close();
      }

      function setupDayDialog() {
        const dialog = document.getElementById('day-dialog');
        const form = document.getElementById('day-dialog-form');
        const closeBtn = document.getElementById('btn-close-day-dialog');
        const cancelBtn = document.getElementById('btn-cancel-day-dialog');
        const clearBtn = document.getElementById('btn-clear-day-plan');
        const subGroup = document.getElementById('day-dialog-subject-group');

        closeBtn?.addEventListener('click', closeDayDialog);
        cancelBtn?.addEventListener('click', closeDayDialog);

        // Toggle subject dropdown visibility on radio change
        dialog?.querySelectorAll('input[name="day-plan-type"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            if (e.target.value === 'study') {
              subGroup?.classList.remove('hidden');
            } else {
              subGroup?.classList.add('hidden');
            }
          });
        });

        // Clear day plan button
        clearBtn?.addEventListener('click', () => {
          const dateStr = document.getElementById('day-dialog-date')?.value;
          if (dateStr && state.dayPlans) {
            delete state.dayPlans[dateStr];
            saveSessionsToStorage();
            closeDayDialog();
            updateApp();
            showToast(t('toast_day_cleared'), 'info');
          }
        });

        // Light dismiss fallback for dialog (modern-web-guidance)
        if (dialog && (typeof HTMLDialogElement === 'undefined' || !('closedBy' in HTMLDialogElement.prototype))) {
          let pressedOutside = false;
          dialog.addEventListener('pointerdown', (e) => {
            const r = dialog.getBoundingClientRect();
            pressedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          });
          dialog.addEventListener('pointerup', (e) => {
            const r = dialog.getBoundingClientRect();
            const releasedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
            if (pressedOutside && releasedOutside) closeDayDialog();
          });
        }

        // Form submit
        form?.addEventListener('submit', (e) => {
          e.preventDefault();
          const dateStr = document.getElementById('day-dialog-date')?.value;
          if (!dateStr) return;

          const chosenType = dialog.querySelector('input[name="day-plan-type"]:checked')?.value || 'normal';
          const noteVal = document.getElementById('day-dialog-note')?.value.trim() || '';
          const subId = document.getElementById('day-dialog-subject-select')?.value || '';

          if (!state.dayPlans) state.dayPlans = {};

          if (chosenType === 'normal') {
            delete state.dayPlans[dateStr];
          } else if (chosenType === 'blocked') {
            state.dayPlans[dateStr] = { type: 'blocked', note: noteVal };
          } else if (chosenType === 'study') {
            state.dayPlans[dateStr] = { type: 'study', subjectId: subId, note: noteVal };
          }

          saveSessionsToStorage();
          closeDayDialog();
          updateApp();
          showToast(t('toast_day_saved'), 'success');
        });
      }

      function setupHelpModal() {
        const dialog = document.getElementById('help-modal');
        const openBtn = document.getElementById('btn-open-help-modal');
        const closeBtn = document.getElementById('btn-close-help-modal');
        const footerCloseBtn = document.getElementById('btn-footer-close-help');

        if (!dialog) return;

        const openHelp = () => {
          renderHelpContent();
          dialog.showModal();
        };

        const closeHelp = () => {
          if (dialog.open) {
            dialog.close();
            openBtn?.focus();
          }
        };

        openBtn?.addEventListener('click', openHelp);
        closeBtn?.addEventListener('click', closeHelp);
        footerCloseBtn?.addEventListener('click', closeHelp);

        // Light dismiss fallback for dialog without native closedBy (modern-web-guidance)
        if (typeof HTMLDialogElement === 'undefined' || !('closedBy' in HTMLDialogElement.prototype)) {
          let pressedOutside = false;
          dialog.addEventListener('pointerdown', (e) => {
            const r = dialog.getBoundingClientRect();
            pressedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          });
          dialog.addEventListener('pointerup', (e) => {
            const r = dialog.getBoundingClientRect();
            const releasedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
            if (pressedOutside && releasedOutside) closeHelp();
          });
        }
      }
