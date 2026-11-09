      function setupThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        const iconDark = document.getElementById('theme-icon-dark');
        const iconLight = document.getElementById('theme-icon-light');

        function updateIcons() {
          const isDark = document.documentElement.classList.contains('dark');
          if (isDark) {
            iconDark.classList.add('hidden');
            iconLight.classList.remove('hidden');
          } else {
            iconLight.classList.add('hidden');
            iconDark.classList.remove('hidden');
          }
        }

        updateIcons();

        toggleBtn.addEventListener('click', () => {
          const isDark = document.documentElement.classList.contains('dark');
          const targetDark = !isDark;
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

          try {
            if (targetDark === systemDark) {
              localStorage.removeItem('examplan-theme');
              document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', 'light dark');
            } else {
              const themeVal = targetDark ? 'dark' : 'light';
              localStorage.setItem('examplan-theme', themeVal);
              document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', themeVal);
            }
          } catch (err) {}

          if (targetDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          updateIcons();
        });

        // Listen for OS scheme changes if no explicit user override
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          let hasExplicitTheme = false;
          try {
            hasExplicitTheme = Boolean(localStorage.getItem('examplan-theme'));
          } catch (err) {}
          if (!hasExplicitTheme) {
            if (e.matches) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', 'light dark');
            updateIcons();
          }
        });

        // Sync theme changes across tabs
        window.addEventListener('storage', (e) => {
          if (e.key === 'examplan-theme') {
            const val = e.newValue;
            const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const shouldDark = val ? val === 'dark' : sysDark;
            if (shouldDark) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', val || 'light dark');
            updateIcons();
          }
        });
      }

      // --- Universal Subject & Call Management Modal Logic ---
      function renderModalSubjects() {
        const container = document.getElementById('modal-subjects-container');
        const countBadge = document.getElementById('modal-subjects-count');
        const subjects = schedule.subjects || [];

        if (countBadge) {
          countBadge.textContent = `${subjects.length} ${t('subjects_unit')}`;
        }
        if (!container) return;
        container.innerHTML = '';

        if (subjects.length === 0) {
          container.innerHTML = `
            <div class="text-center py-8 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 space-y-1">
              <p class="font-medium">${t('no_subjects_configured')}</p>
              <p class="text-[11px]">${t('no_subjects_hint')}</p>
            </div>
          `;
          return;
        }

        subjects.forEach(sub => {
          const token = getColorToken(sub.color);
          const safeName = escapeHtml(sub.name);
          const safeCode = escapeHtml(sub.code || '');
          const diffLabels = { high: t('diff_high_badge'), medium: t('diff_medium_badge'), low: t('diff_low_badge') };
          const diffBadge = diffLabels[sub.difficulty] || diffLabels.medium;

          const card = document.createElement('div');
          card.className = 'border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm';

          let callsHtml = '';
          const calls = [];
          (sub.modules || []).forEach(m => (m.calls || []).forEach(c => calls.push({ ...c, moduleId: m.id, moduleName: m.name })));

          if (calls.length === 0) {
            callsHtml = `
              <div class="px-4 py-3 bg-slate-50/50 dark:bg-slate-950/30 text-slate-400 italic text-[11px]">
                ${t('no_calls_registered')}
              </div>
            `;
          } else {
            callsHtml = `
              <div class="divide-y divide-slate-100 dark:divide-slate-800/60 bg-slate-50/30 dark:bg-slate-950/20">
                ${calls.map(c => {
                  const isCallSelected = state.selectedCallIds.has(c.id);
                  const statusBadge = isCallSelected
                    ? `<button type="button" data-action="toggle-call" data-call-id="${c.id}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:opacity-80 transition cursor-pointer" title="Hacer clic para desactivar de la selección">✓ ${t('status_active')}</button>`
                    : `<button type="button" data-action="toggle-call" data-call-id="${c.id}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer" title="Hacer clic para activar en la selección">○ ${t('status_inactive')}</button>`;
                  return `
                  <div class="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div class="flex items-center gap-2">
                      <span class="font-mono font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1">${renderIcon('📅', 'w-3 h-3')} ${c.date}</span>
                      <span class="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">${renderIcon('⏰', 'w-3 h-3')} ${c.time || '09:00'} (${c.durationHours}h)</span>
                      ${c.type && c.type !== 'standard' ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800">${c.type === 'written' ? '✍️ ' + t('badge_written') : (c.type === 'oral' ? '🗣️ ' + t('badge_oral') : (c.type === 'lab' ? '💻 ' + t('badge_lab') : c.type))}</span>` : ''}
                      ${c.appelloIndex ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">${t('badge_appello', c.appelloIndex)}</span>` : ''}
                      ${sub.hasModules !== false && c.moduleName && c.moduleName !== sub.name ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 font-semibold">${escapeHtml(c.moduleName)}</span>` : ''}
                      ${c.location ? `<span class="text-slate-400 inline-flex items-center gap-1">• ${renderIcon('📍', 'w-3 h-3')} ${escapeHtml(c.location)}</span>` : ''}
                      ${c.notes ? `<span class="text-slate-400 italic">• ${escapeHtml(c.notes)}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-1.5">
                      ${statusBadge}
                      <button type="button" data-action="edit-call" data-sub-id="${sub.id}" data-mod-id="${c.moduleId}" data-call-id="${c.id}" class="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition">
                        ${t('btn_edit')}
                      </button>
                      <button type="button" data-action="delete-call" data-sub-id="${sub.id}" data-call-id="${c.id}" class="px-2 py-0.5 rounded border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                        ${t('btn_delete')}
                      </button>
                    </div>
                  </div>
                `;
                }).join('')}
              </div>
            `;
          }

          const subAcronym = escapeHtml(sub.shortName || generateSubjectAcronym(sub.name));

          let modulesBadgesHtml = '';
          const isMultiModuleSub = sub.hasModules !== false && sub.modules && sub.modules.length > 1;
          if (isMultiModuleSub) {
            modulesBadgesHtml = `
              <div class="px-4 py-2 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                <span class="text-[10px] uppercase font-bold text-slate-400">${t('modules_label')}</span>
                ${sub.modules.map(m => `
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">[${escapeHtml(m.shortName || generateModuleShortName(m.name))}]</span>
                    <span>${escapeHtml(m.name)}</span>
                    <span class="text-slate-400 text-[9px]">(${m.credits || sub.credits} CFU)</span>
                    ${m.evaluationMode && m.evaluationMode !== 'standard' ? `<span class="text-[9px] text-violet-600 dark:text-violet-400 font-semibold">• ${m.evaluationMode === 'written_and_oral' ? t('eval_mode_written_oral') : t('eval_mode_written_lab')} (${m.oralBinding === 'same_appello' ? t('binding_same_appello') : t('binding_any_subsequent')})</span>` : ''}
                  </span>
                `).join('')}
              </div>
            `;
          }

          card.innerHTML = `
            <div class="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full ${token.bg}"></span>
                <span class="font-mono text-xs uppercase font-extrabold px-2 py-0.5 rounded ${token.lightBg} ${token.text}">[${subAcronym}]</span>
                ${safeCode ? `<span class="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">${safeCode}</span>` : ''}
                <strong class="text-xs text-slate-900 dark:text-white">${safeName}</strong>
                <span class="text-[11px] text-slate-400">(${sub.credits} ${escapeHtml(schedule.meta?.creditUnit || 'CFU')})</span>
                <span class="text-[10px] text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60">${diffBadge}</span>
                ${sub.hasModules === false ? `<span class="text-[10px] text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60 font-medium">${t('badge_no_modules')}</span>` : ''}
                ${sub.hasModules === false && sub.evaluationMode && sub.evaluationMode !== 'standard' ? `<span class="text-[10px] text-violet-600 dark:text-violet-400 font-semibold px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/60 border border-violet-200/60 dark:border-violet-800/60">${sub.evaluationMode === 'written_and_oral' ? t('eval_mode_written_oral') : t('eval_mode_written_lab')}</span>` : ''}
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" data-action="add-call" data-sub-id="${sub.id}" data-mod-id="${(sub.modules && sub.modules[0]) ? sub.modules[0].id : ''}" class="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white font-medium text-[11px] shadow-sm transition">
                  ${t('btn_add_call')}
                </button>
                <button type="button" data-action="edit-sub" data-sub-id="${sub.id}" class="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition">
                  ${t('btn_edit')}
                </button>
                <button type="button" data-action="delete-sub" data-sub-id="${sub.id}" class="px-2 py-1 rounded border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                  ${t('btn_delete')}
                </button>
              </div>
            </div>
            ${modulesBadgesHtml}
            ${callsHtml}
          `;

          container.appendChild(card);
        });

        // Event delegation for actions
        container.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const subId = btn.getAttribute('data-sub-id');
            const modId = btn.getAttribute('data-mod-id');
            const callId = btn.getAttribute('data-call-id');

            if (action === 'toggle-call') {
              if (state.selectedCallIds.has(callId)) {
                state.selectedCallIds.delete(callId);
              } else {
                state.selectedCallIds.add(callId);
              }
              saveSessionsToStorage();
              updateApp();
              renderModalSubjects();
            } else if (action === 'add-call') {
              showCallForm(subId, null, modId);
            } else if (action === 'edit-call') {
              showCallForm(subId, callId, modId);
            } else if (action === 'delete-call') {
              deleteCall(subId, callId);
            } else if (action === 'edit-sub') {
              showSubjectForm(subId);
            } else if (action === 'delete-sub') {
              deleteSubject(subId);
            }
          });
        });
      }

      function renderModuleRows(modules) {
        const container = document.getElementById('subject-modules-list');
        if (!container) return;
        container.innerHTML = '';

        const mods = Array.isArray(modules) && modules.length > 0 ? modules : [
          { id: `mod_${Date.now()}`, name: '', shortName: '', credits: 6, difficulty: 'medium', alreadyPassed: false, calls: [] }
        ];

        mods.forEach((m, idx) => {
          const row = document.createElement('div');
          row.className = 'module-row p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-2 transition shadow-xs';
          row.dataset.modId = m.id || `mod_${Date.now()}_${idx}`;

          row.innerHTML = `
            <div class="flex-1 min-w-[140px]">
              <label class="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">${t('lbl_mod_name')}</label>
              <input type="text" class="mod-name-input w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500" value="${escapeHtml(m.name || '')}" placeholder="ej: Módulo 1 (Teoría)">
            </div>
            <div class="w-24">
              <label class="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">${t('lbl_mod_short')}</label>
              <input type="text" maxlength="8" class="mod-short-input w-full uppercase font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500" value="${escapeHtml(m.shortName || '')}" placeholder="ej: M1">
            </div>
            <div class="w-28">
              <label class="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">${t('lbl_mod_diff')}</label>
              <select class="mod-diff-select w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500">
                <option value="high" ${m.difficulty === 'high' ? 'selected' : ''}>Alta (5/5)</option>
                <option value="medium" ${(!m.difficulty || m.difficulty === 'medium') ? 'selected' : ''}>Media (3/5)</option>
                <option value="low" ${m.difficulty === 'low' ? 'selected' : ''}>Baja (1/5)</option>
              </select>
            </div>
            <div class="w-16">
              <label class="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">${t('lbl_mod_credits')}</label>
              <input type="number" min="0" max="60" class="mod-credits-input w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs" value="${typeof m.credits === 'number' ? m.credits : 6}">
            </div>
            <div class="w-36">
              <label class="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">${t('lbl_mod_eval_mode')}</label>
              <select class="mod-eval-mode-select w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500">
                <option value="standard" ${(!m.evaluationMode || m.evaluationMode === 'standard') ? 'selected' : ''}>${t('eval_mode_standard')}</option>
                <option value="written_and_oral" ${m.evaluationMode === 'written_and_oral' ? 'selected' : ''}>${t('eval_mode_written_oral')}</option>
                <option value="written_and_lab" ${m.evaluationMode === 'written_and_lab' ? 'selected' : ''}>${t('eval_mode_written_lab')}</option>
              </select>
            </div>
            <div class="w-40 mod-oral-binding-wrapper ${(!m.evaluationMode || m.evaluationMode === 'standard') ? 'opacity-40 pointer-events-none' : ''}">
              <label class="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">${t('lbl_mod_oral_binding')}</label>
              <select class="mod-oral-binding-select w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500">
                <option value="same_appello" ${m.oralBinding === 'same_appello' ? 'selected' : ''}>${t('binding_same_appello')}</option>
                <option value="any_subsequent" ${(!m.oralBinding || m.oralBinding === 'any_subsequent') ? 'selected' : ''}>${t('binding_any_subsequent')}</option>
              </select>
            </div>
            <div class="flex items-center gap-1.5 pt-4">
              <button type="button" class="btn-remove-mod-row text-xs font-bold text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 px-1.5 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition" title="Eliminar módulo">✕</button>
            </div>
          `;

          const evalModeSel = row.querySelector('.mod-eval-mode-select');
          const bindingWrapper = row.querySelector('.mod-oral-binding-wrapper');
          if (evalModeSel && bindingWrapper) {
            evalModeSel.addEventListener('change', () => {
              if (evalModeSel.value === 'standard') {
                bindingWrapper.classList.add('opacity-40', 'pointer-events-none');
              } else {
                bindingWrapper.classList.remove('opacity-40', 'pointer-events-none');
              }
            });
          }

          row.querySelector('.btn-remove-mod-row').addEventListener('click', () => {
            const allRows = container.querySelectorAll('.module-row');
            if (allRows.length <= 1) {
              alert(t('alert_min_one_module'));
              return;
            }
            row.remove();
          });

          container.appendChild(row);
        });
      }

      function showSubjectForm(subId = null) {
        const form = document.getElementById('subject-form-box');
        const titleEl = document.getElementById('subject-form-title');
        const idHidden = document.getElementById('sub-id-hidden');
        const nameInput = document.getElementById('sub-name-input');
        const shortNameInput = document.getElementById('sub-shortname-input');
        const codeInput = document.getElementById('sub-code-input');
        const creditsInput = document.getElementById('sub-credits-input');
        const diffSelect = document.getElementById('sub-diff-select');
        const colorSelect = document.getElementById('sub-color-select');

        document.getElementById('call-form-box').classList.add('hidden');
        const hasModulesCheckbox = document.getElementById('sub-has-modules-checkbox');
        const subModulesWrapper = document.getElementById('sub-modules-wrapper');
        const subSingleEvalWrapper = document.getElementById('sub-single-eval-wrapper');
        const subEvalModeSelect = document.getElementById('sub-eval-mode-select');
        const subOralBindingSelect = document.getElementById('sub-oral-binding-select');
        const subOralBindingWrapper = document.getElementById('sub-oral-binding-wrapper');

        if (subId) {
          const sub = (schedule.subjects || []).find(s => s.id === subId);
          if (!sub) return;
          titleEl.textContent = t('subject_form_title_edit');
          idHidden.value = sub.id;
          nameInput.value = sub.name || '';
          if (shortNameInput) shortNameInput.value = sub.shortName || generateSubjectAcronym(sub.name);
          codeInput.value = sub.code || '';
          creditsInput.value = sub.credits || 6;
          diffSelect.value = sub.difficulty || 'medium';
          colorSelect.value = sub.color || 'indigo';

          const hasModules = sub.hasModules !== undefined ? Boolean(sub.hasModules) : (Array.isArray(sub.modules) && sub.modules.length > 1);
          if (hasModulesCheckbox) hasModulesCheckbox.checked = hasModules;
          if (subEvalModeSelect) subEvalModeSelect.value = sub.evaluationMode || sub.modules?.[0]?.evaluationMode || 'standard';
          if (subOralBindingSelect) subOralBindingSelect.value = sub.oralBinding || sub.modules?.[0]?.oralBinding || 'same_appello';
          if (hasModules) {
            subModulesWrapper?.classList.remove('hidden');
            subSingleEvalWrapper?.classList.add('hidden');
          } else {
            subModulesWrapper?.classList.add('hidden');
            subSingleEvalWrapper?.classList.remove('hidden');
          }
          if (subEvalModeSelect && subOralBindingWrapper) {
            if (subEvalModeSelect.value === 'standard') subOralBindingWrapper.classList.add('opacity-40', 'pointer-events-none');
            else subOralBindingWrapper.classList.remove('opacity-40', 'pointer-events-none');
          }
          renderModuleRows(sub.modules && sub.modules.length > 0 ? sub.modules : [
            { id: `${sub.id}_mod`, name: sub.name, shortName: sub.shortName || generateSubjectAcronym(sub.name), credits: sub.credits || 6, difficulty: sub.difficulty || 'medium', calls: [] }
          ]);
        } else {
          titleEl.textContent = t('btn_new_subject');
          idHidden.value = '';
          nameInput.value = '';
          if (shortNameInput) shortNameInput.value = '';
          codeInput.value = '';
          creditsInput.value = 6;
          diffSelect.value = 'medium';
          colorSelect.value = COLOR_PALETTE[(schedule.subjects?.length || 0) % COLOR_PALETTE.length];

          if (hasModulesCheckbox) hasModulesCheckbox.checked = false;
          if (subEvalModeSelect) subEvalModeSelect.value = 'standard';
          if (subOralBindingSelect) subOralBindingSelect.value = 'same_appello';
          subModulesWrapper?.classList.add('hidden');
          subSingleEvalWrapper?.classList.remove('hidden');
          if (subOralBindingWrapper) subOralBindingWrapper.classList.add('opacity-40', 'pointer-events-none');
          renderModuleRows([
            { id: `mod_${Date.now()}`, name: '', shortName: '', credits: 6, difficulty: 'medium', calls: [] }
          ]);
        }

        form.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      function hideSubjectForm() {
        document.getElementById('subject-form-box').classList.add('hidden');
      }

      function saveSubject() {
        const idHidden = document.getElementById('sub-id-hidden').value.trim();
        const name = document.getElementById('sub-name-input').value.trim();
        const shortNameRaw = document.getElementById('sub-shortname-input')?.value.trim().toUpperCase();
        const shortName = shortNameRaw || generateSubjectAcronym(name);
        const code = document.getElementById('sub-code-input').value.trim();
        const credits = parseInt(document.getElementById('sub-credits-input').value, 10) || 6;
        const difficulty = document.getElementById('sub-diff-select').value;
        const color = document.getElementById('sub-color-select').value;

        if (!name) {
          alert(t('alert_enter_subject_name'));
          return;
        }

        const subjects = [...(schedule.subjects || [])];
        const defaultWeight = difficulty === 'high' ? 5 : difficulty === 'low' ? 1 : 3;

        const hasModules = Boolean(document.getElementById('sub-has-modules-checkbox')?.checked);
        let modules = [];
        let evaluationMode = 'standard';
        let oralBinding = 'same_appello';

        if (!hasModules) {
          evaluationMode = document.getElementById('sub-eval-mode-select')?.value || 'standard';
          oralBinding = document.getElementById('sub-oral-binding-select')?.value || 'same_appello';
          const existingMod = existingSub?.modules?.[0];
          const modId = existingMod?.id || `${idHidden || slugify(code || name) || 'sub'}_mod`;
          const existingCalls = existingMod?.calls || existingSub?.calls || [];
          modules = [{
            id: modId,
            name,
            shortName: '',
            credits,
            difficulty,
            defaultWeight,
            alreadyPassed: Boolean(existingMod?.alreadyPassed),
            evaluationMode,
            oralBinding,
            calls: existingCalls,
            isImplicit: true
          }];
        } else {
          const rows = Array.from(document.querySelectorAll('#subject-modules-list .module-row'));
          if (rows.length > 0) {
            modules = rows.map((r, idx) => {
              const rId = r.dataset.modId || `mod_${Date.now()}_${idx + 1}`;
              const rName = r.querySelector('.mod-name-input')?.value.trim() || (rows.length > 1 ? `Módulo ${idx + 1}` : name);
              const rShort = r.querySelector('.mod-short-input')?.value.trim().toUpperCase() || generateModuleShortName(rName, idx, rows.length);
              const rDiff = r.querySelector('.mod-diff-select')?.value || difficulty;
              const rCredits = parseFloat(r.querySelector('.mod-credits-input')?.value) || (rows.length > 1 ? Math.round(credits / rows.length) : credits);
              const rWeight = rDiff === 'high' ? 5 : rDiff === 'low' ? 1 : 3;
              const rEvalMode = r.querySelector('.mod-eval-mode-select')?.value || 'standard';
              const rOralBinding = r.querySelector('.mod-oral-binding-select')?.value || 'any_subsequent';

              const existingMod = existingModulesMap.get(rId) || (idx === 0 && existingSub?.modules?.[0]) || null;
              const existingCalls = existingMod?.calls || [];

              return {
                id: rId,
                name: rName,
                shortName: rShort,
                credits: rCredits,
                difficulty: rDiff,
                defaultWeight: rWeight,
                alreadyPassed: Boolean(existingMod?.alreadyPassed),
                evaluationMode: rEvalMode,
                oralBinding: rOralBinding,
                calls: existingCalls
              };
            });
          } else {
            const modId = existingSub?.modules?.[0]?.id || `${idHidden || slugify(code || name) || 'sub'}_mod`;
            modules = [{
              id: modId,
              name,
              shortName: shortName || generateSubjectAcronym(name),
              credits,
              difficulty,
              defaultWeight,
              alreadyPassed: false,
              calls: existingSub?.modules?.[0]?.calls || []
            }];
          }
        }

        if (idHidden) {
          const idx = subjects.findIndex(s => s.id === idHidden);
          if (idx !== -1) {
            subjects[idx] = {
              ...subjects[idx],
              name,
              shortName,
              code,
              credits,
              difficulty,
              color,
              defaultWeight,
              hasModules,
              evaluationMode,
              oralBinding,
              calls: hasModules ? [] : modules[0].calls,
              modules
            };
            state.subjectWeights[idHidden] = defaultWeight;
            modules.forEach(m => {
              if (m.defaultWeight) state.subjectWeights[m.id] = m.defaultWeight;
            });
          }
        } else {
          const newId = slugify(code || name) || `subj_${Date.now()}`;
          let uniqueId = newId;
          let counter = 1;
          while (subjects.some(s => s.id === uniqueId)) {
            uniqueId = `${newId}_${counter++}`;
          }
          subjects.push({
            id: uniqueId,
            name,
            shortName,
            code,
            credits,
            color,
            difficulty,
            defaultWeight,
            hasModules,
            evaluationMode,
            oralBinding,
            calls: hasModules ? [] : modules[0].calls,
            modules
          });
          state.subjectWeights[uniqueId] = defaultWeight;
          modules.forEach(m => {
            if (m.defaultWeight) state.subjectWeights[m.id] = m.defaultWeight;
          });
        }

        schedule.subjects = subjects;
        persistSchedule(schedule);
        hideSubjectForm();
        renderModalSubjects();
        updateApp();
      }

      function deleteSubject(subId) {
        const sub = (schedule.subjects || []).find(s => s.id === subId);
        if (!sub) return;
        if (!confirm(t('confirm_delete_subject', sub.name))) return;

        schedule.subjects = (schedule.subjects || []).filter(s => s.id !== subId);
        delete state.subjectWeights[subId];
        persistSchedule(schedule);
      }

      function showCallForm(subId, callId = null, modId = null) {
        const form = document.getElementById('call-form-box');
        const titleEl = document.getElementById('call-form-title');
        const subBadge = document.getElementById('call-subject-name-badge');
        const targetSubHidden = document.getElementById('call-target-sub-id');
        const targetModHidden = document.getElementById('call-target-mod-id');
        const callIdHidden = document.getElementById('call-id-hidden');
        const dateInput = document.getElementById('call-date-input');
        const timeInput = document.getElementById('call-time-input');
        const durationInput = document.getElementById('call-duration-input');
        const deadlineInput = document.getElementById('call-deadline-input');
        const locInput = document.getElementById('call-location-input');
        const notesInput = document.getElementById('call-notes-input');
        const statusSelect = document.getElementById('call-status-select');

        document.getElementById('subject-form-box').classList.add('hidden');

        const sub = (schedule.subjects || []).find(s => s.id === subId);
        if (!sub) return;

        targetSubHidden.value = subId;
        subBadge.textContent = t('subject_prefix', sub.name);

        const modSelectWrapper = document.getElementById('call-module-select-wrapper');
        const modSelect = document.getElementById('call-module-select');
        if (sub.modules && sub.modules.length > 1 && modSelectWrapper && modSelect) {
          modSelectWrapper.classList.remove('hidden');
          modSelect.innerHTML = sub.modules.map(m => `
            <option value="${m.id}" ${(modId === m.id) ? 'selected' : ''}>
              [${escapeHtml(m.shortName || generateModuleShortName(m.name))}] ${escapeHtml(m.name)}
            </option>
          `).join('');
        } else if (modSelectWrapper) {
          modSelectWrapper.classList.add('hidden');
        }

        let resolvedModId = modId;
        if (callId) {
          titleEl.textContent = t('call_form_title_edit');
          callIdHidden.value = callId;
          let foundCall = null;
          (sub.modules || []).forEach(m => {
            const c = (m.calls || []).find(item => item.id === callId);
            if (c) {
              foundCall = c;
              resolvedModId = m.id;
            }
          });
          if (targetModHidden) targetModHidden.value = resolvedModId || '';
          if (foundCall) {
            dateInput.value = foundCall.date || '';
            timeInput.value = foundCall.time || '09:00';
            durationInput.value = foundCall.durationHours || 2.5;
            deadlineInput.value = foundCall.deadline || '';
            locInput.value = foundCall.location || '';
            notesInput.value = foundCall.notes || '';
            if (statusSelect) statusSelect.value = state.selectedCallIds.has(callId) ? 'active' : 'inactive';
            const typeSelect = document.getElementById('call-type-select');
            if (typeSelect) typeSelect.value = foundCall.type || 'standard';
            const appelloInput = document.getElementById('call-appello-input');
            if (appelloInput) appelloInput.value = foundCall.appelloIndex != null ? foundCall.appelloIndex : '';
          }
        } else {
          titleEl.textContent = t('call_form_title_new');
          callIdHidden.value = '';
          if (targetModHidden) targetModHidden.value = resolvedModId || (sub.modules?.[0]?.id || '');
          dateInput.value = '';
          timeInput.value = '09:00';
          durationInput.value = 2.5;
          deadlineInput.value = '';
          locInput.value = 'Aula Magna';
          notesInput.value = '';
          if (statusSelect) statusSelect.value = 'active';
          const typeSelect = document.getElementById('call-type-select');
          if (typeSelect) typeSelect.value = 'standard';
          const appelloInput = document.getElementById('call-appello-input');
          if (appelloInput) appelloInput.value = '';
        }

        form.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      function hideCallForm() {
        document.getElementById('call-form-box').classList.add('hidden');
      }

      function saveCall() {
        const subId = document.getElementById('call-target-sub-id').value;
        const modSelectWrapper = document.getElementById('call-module-select-wrapper');
        const modSelect = document.getElementById('call-module-select');
        const modId = (!modSelectWrapper?.classList.contains('hidden') && modSelect?.value) 
          ? modSelect.value 
          : (document.getElementById('call-target-mod-id')?.value || '');
        const callId = document.getElementById('call-id-hidden').value;
        const date = normalizeDateStr(document.getElementById('call-date-input').value);
        const time = document.getElementById('call-time-input').value || '09:00';
        const durationHours = parseFloat(document.getElementById('call-duration-input').value) || 2.5;
        let deadline = normalizeDateStr(document.getElementById('call-deadline-input').value);
        const location = document.getElementById('call-location-input').value.trim() || 'Aula Magna';
        const notes = document.getElementById('call-notes-input').value.trim();
        const statusSelect = document.getElementById('call-status-select');
        const isNowActive = !statusSelect || statusSelect.value === 'active';
        const callType = document.getElementById('call-type-select')?.value || 'standard';
        const parsedAppello = parseInt(document.getElementById('call-appello-input')?.value, 10);
        const appelloIndex = (!isNaN(parsedAppello) && parsedAppello >= 1) ? parsedAppello : null;

        if (!date) {
          alert(t('alert_valid_date'));
          return;
        }

        if (!deadline) {
          const d = new Date(date + 'T00:00:00Z');
          d.setUTCDate(d.getUTCDate() - 4);
          deadline = d.toISOString().split('T')[0];
        }

        const sub = (schedule.subjects || []).find(s => s.id === subId);
        if (!sub) return;
        if (!sub.modules || sub.modules.length === 0) {
          sub.modules = [{ id: `${subId}_mod`, name: sub.name, credits: sub.credits, alreadyPassed: false, calls: [] }];
        }
        const mod = (modId ? sub.modules.find(m => m.id === modId) : null) || sub.modules[0];
        mod.calls = mod.calls || [];

        if (callId) {
          const idx = mod.calls.findIndex(c => c.id === callId);
          if (idx !== -1) {
            mod.calls[idx] = {
              ...mod.calls[idx],
              date,
              time,
              durationHours,
              deadline,
              location,
              notes
            };
            if (isNowActive) {
              state.selectedCallIds.add(callId);
            } else {
              state.selectedCallIds.delete(callId);
            }
          }
        } else {
          const newCallId = `${mod.id}_call_${Date.now()}`;
          const hadCallsSelected = mod.calls.some(c => state.selectedCallIds.has(c.id));
          mod.calls.push({
            id: newCallId,
            date,
            time,
            durationHours,
            deadline,
            location,
            notes,
            type: callType,
            appelloIndex
          });
          // Auto-select newly created call if module previously had none selected
          if (isNowActive) {
            state.selectedCallIds.add(newCallId);
          } else {
            state.selectedCallIds.delete(newCallId);
          }
        }

        mod.calls.sort((a, b) => (a.date + ' ' + (a.time || '')).localeCompare(b.date + ' ' + (b.time || '')));

        persistSchedule(schedule);
        hideCallForm();
      }

      function deleteCall(subId, callId) {
        const sub = (schedule.subjects || []).find(s => s.id === subId);
        if (!sub) return;
        if (!confirm(t('confirm_delete_call'))) return;

        let targetMod = null;
        (sub.modules || []).forEach(m => {
          if ((m.calls || []).some(c => c.id === callId)) {
            targetMod = m;
            m.calls = m.calls.filter(c => c.id !== callId);
          }
        });

        const wasSelected = state.selectedCallIds.has(callId);
        state.selectedCallIds.delete(callId);

        // Auto-select replacement call if deleted call was selected
        if (wasSelected && targetMod && targetMod.calls && targetMod.calls.length > 0) {
          state.selectedCallIds.add(targetMod.calls[0].id);
        }

        persistSchedule(schedule);
      }

      function populateMetaForm() {
        const active = getActiveSession();
        document.getElementById('meta-title-input').value = schedule.meta?.title || '';
        document.getElementById('meta-inst-input').value = schedule.meta?.institution || '';
        document.getElementById('meta-year-input').value = schedule.meta?.academicYear || '';
        document.getElementById('meta-session-input').value = schedule.meta?.session || active?.name || '';
        const iconInput = document.getElementById('meta-icon-input');
        if (iconInput) {
          iconInput.value = schedule.meta?.icon || active?.icon || '🎓';
        }
        document.getElementById('meta-target-credits-input').value = schedule.meta?.targetCredits || 30;
        document.getElementById('meta-unit-input').value = schedule.meta?.creditUnit || 'CFU';
      }

      function saveMeta() {
        schedule.meta = schedule.meta || {};
        schedule.meta.title = document.getElementById('meta-title-input').value.trim() || 'Plan de Exámenes Universitario';
        schedule.meta.institution = document.getElementById('meta-inst-input').value.trim();
        schedule.meta.academicYear = document.getElementById('meta-year-input').value.trim() || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
        schedule.meta.session = document.getElementById('meta-session-input').value.trim() || 'Convocatoria Oficial';
        const iconVal = document.getElementById('meta-icon-input')?.value.trim() || '🎓';
        schedule.meta.icon = iconVal;
        schedule.meta.targetCredits = parseInt(document.getElementById('meta-target-credits-input').value, 10) || 30;
        schedule.meta.creditUnit = document.getElementById('meta-unit-input').value.trim() || 'CFU';

        const active = getActiveSession();
        if (active) {
          active.name = schedule.meta.session;
          active.icon = iconVal;
        }

        persistSchedule(schedule);
        alert(t('toast_meta_saved'));
      }

      function switchModalTab(tabId) {
        state.activeModalTab = tabId;
        const tabs = [
          { id: 'subjects', btn: document.getElementById('tab-btn-subjects'), panel: document.getElementById('tab-panel-subjects') },
          { id: 'import', btn: document.getElementById('tab-btn-import'), panel: document.getElementById('tab-panel-import') },
          { id: 'meta', btn: document.getElementById('tab-btn-meta'), panel: document.getElementById('tab-panel-meta') }
        ];

        tabs.forEach(t => {
          if (!t.btn || !t.panel) return;
          if (t.id === tabId) {
            t.btn.className = 'px-4 py-2.5 border-b-2 border-indigo-600 font-bold text-indigo-600 dark:text-indigo-400 transition';
            t.panel.classList.remove('hidden');
          } else {
            t.btn.className = 'px-4 py-2.5 border-b-2 border-transparent font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition';
            t.panel.classList.add('hidden');
          }
        });
      }

      function setupManageModal() {
        const modal = document.getElementById('manage-modal');
        const openBtn = document.getElementById('btn-open-manage-modal');
        const closeBtn = document.getElementById('btn-close-modal');

        if (openBtn && modal) {
          openBtn.addEventListener('click', () => {
            renderModalSubjects();
            populateMetaForm();
            switchModalTab('subjects');
            modal.showModal();
          });
        }

        if (closeBtn && modal) {
          closeBtn.addEventListener('click', () => modal.close());
        }

        // Light dismiss fallback for browsers not yet fully supporting closedby="any" (modern-web-guidance)
        if (modal && (typeof HTMLDialogElement === 'undefined' || !('closedBy' in HTMLDialogElement.prototype))) {
          let pressedOutside = false;
          modal.addEventListener('pointerdown', (e) => {
            const r = modal.getBoundingClientRect();
            pressedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          });
          modal.addEventListener('pointerup', (e) => {
            const r = modal.getBoundingClientRect();
            const releasedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
            if (pressedOutside && releasedOutside) modal.close();
          });
        }

        // Tab buttons
        document.getElementById('tab-btn-subjects')?.addEventListener('click', () => switchModalTab('subjects'));
        document.getElementById('tab-btn-import')?.addEventListener('click', () => switchModalTab('import'));
        document.getElementById('tab-btn-meta')?.addEventListener('click', () => switchModalTab('meta'));

        // Subject actions
        const formHasModulesCheckbox = document.getElementById('sub-has-modules-checkbox');
        const formSubModulesWrapper = document.getElementById('sub-modules-wrapper');
        const formSubSingleEvalWrapper = document.getElementById('sub-single-eval-wrapper');
        const formSubEvalModeSelect = document.getElementById('sub-eval-mode-select');
        const formSubOralBindingWrapper = document.getElementById('sub-oral-binding-wrapper');

        formHasModulesCheckbox?.addEventListener('change', () => {
          if (formHasModulesCheckbox.checked) {
            formSubModulesWrapper?.classList.remove('hidden');
            formSubSingleEvalWrapper?.classList.add('hidden');
          } else {
            formSubModulesWrapper?.classList.add('hidden');
            formSubSingleEvalWrapper?.classList.remove('hidden');
          }
        });

        formSubEvalModeSelect?.addEventListener('change', () => {
          if (formSubEvalModeSelect.value === 'standard') {
            formSubOralBindingWrapper?.classList.add('opacity-40', 'pointer-events-none');
          } else {
            formSubOralBindingWrapper?.classList.remove('opacity-40', 'pointer-events-none');
          }
        });

        document.getElementById('btn-show-add-subject')?.addEventListener('click', () => showSubjectForm());
        document.getElementById('sub-cancel-btn')?.addEventListener('click', hideSubjectForm);
        document.getElementById('sub-save-btn')?.addEventListener('click', saveSubject);
        document.getElementById('btn-add-module-row')?.addEventListener('click', () => {
          const container = document.getElementById('subject-modules-list');
          if (!container) return;
          const currentCount = container.querySelectorAll('.module-row').length;
          const newMod = {
            id: `mod_${Date.now()}_${currentCount + 1}`,
            name: `Módulo ${currentCount + 1}`,
            shortName: `M${currentCount + 1}`,
            credits: 6,
            difficulty: 'medium',
            alreadyPassed: false,
            calls: []
          };
          const currentRows = Array.from(container.querySelectorAll('.module-row')).map(r => ({
            id: r.dataset.modId,
            name: r.querySelector('.mod-name-input')?.value || '',
            shortName: r.querySelector('.mod-short-input')?.value || '',
            difficulty: r.querySelector('.mod-diff-select')?.value || 'medium',
            credits: parseFloat(r.querySelector('.mod-credits-input')?.value) || 6
          }));
          renderModuleRows([...currentRows, newMod]);
        });

        // Call actions
        document.getElementById('call-cancel-btn')?.addEventListener('click', hideCallForm);
        document.getElementById('call-save-btn')?.addEventListener('click', saveCall);

        // Meta actions
        document.getElementById('meta-save-btn')?.addEventListener('click', saveMeta);

        // Sample markdown button
        document.getElementById('btn-sample-md')?.addEventListener('click', () => {
          const sample = `| Asignatura | Codigo | CFU | Dificultad | Fecha | Hora | Duracion | Aula |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n| Machine Learning | 91244 | 6 | high | 2027-01-14 | 09:00 | 3 | Aula Magna |\n| Machine Learning | 91244 | 6 | high | 2027-02-04 | 09:00 | 3 | Aula 2.1 |\n| Deep Learning | 91245 | 6 | high | 2027-01-19 | 14:30 | 3 | Lab Turing |\n| Deep Learning | 91245 | 6 | high | 2027-02-09 | 14:30 | 3 | Lab Turing |\n| Natural Language Processing | 91246 | 6 | medium | 2027-01-26 | 10:00 | 2.5 | Aula 3.2 |\n| Natural Language Processing | 91246 | 6 | medium | 2027-02-16 | 10:00 | 2.5 | Aula 3.2 |`;
          document.getElementById('import-text-input').value = sample;
        });



        const AI_PROMPT_TEMPLATE = `Actúa como un extractor experto de calendarios y exámenes universitarios.
Analiza con máxima precisión las imágenes adjuntas (capturas de portales de facultades, fotos de horarios, tablas de exámenes, appelli o llamamientos) y extrae TODOS los exámenes disponibles estructurados por ASIGNATURA y por MÓDULOS (partes o subasignaturas obligatorias).

ARQUITECTURA DE DATOS Y CONCEPTO CLAVE:
1. ASIGNATURA ("subjects"): Es la materia o curso académico global (ej: "Fundamentals of Artificial Intelligence", "Sistemas Distribuidos").
   - "name": Nombre oficial completo de la asignatura.
   - "shortName": Abreviatura o acrónimo conciso de 2 a 5 caracteres en mayúsculas (ej: "FAI", "ML", "DLCV", "SD"). ES OBLIGATORIO: el calendario muestra 3 meses en paralelo al 100% de zoom y utiliza este "shortName" centrado tanto en los bloques de examen como en los días asignados para estudiar.
   - "code": Código oficial si aparece (ej: "91244").
   - "credits": Créditos totales de la materia (ej: 12).
2. DIVISIÓN POR MÓDULOS (OBLIGATORIA):
   - Cada parte evaluable independiente es un módulo ("modules").
   - Si una asignatura se evalúa en un único examen global, crea 1 solo módulo con el nombre de la prueba.
   - Si la asignatura está dividida en partes (ej: Módulo 1, Módulo 2, Teoría, Práctica, Laboratorio), crea un módulo por cada parte.
   - Cada módulo debe tener su propio "name", su etiqueta breve OBLIGATORIA "shortName" de 2 a 4 caracteres (ej: "M1", "M2", "TEO", "LAB"), su "difficulty" ("high", "medium", "low") y su peso individual "defaultWeight" (del 1 al 5) para configurar los sliders de dificultad por módulo.
3. REGLA FUNDAMENTAL DE PRESENTACIÓN:
   - Para aprobar la asignatura, el estudiante debe presentarse OBLIGATORIAMENTE a exactamente 1 examen (llamamiento) por cada módulo pendiente ("alreadyPassed": false). Cuentan como exámenes obligatorios distintos.
4. EXÁMENES SEPARADOS VS CONJUNTOS (MISMO EXAMEN FÍSICO):
   - Una asignatura puede tener exámenes separados para cada módulo (ej: Módulo 1 el 14 de enero), o exámenes de varios módulos juntos (ej: Módulos 2 y 3 juntos el 20 de enero).
   - REGLA DE COINCIDENCIA: Si dos exámenes de distintos módulos pero de la misma asignatura suceden a la vez (mismo día y a la misma hora), son el MISMO EXAMEN FÍSICO (se examinan a la vez en la misma sesión).
   - En este caso, mantén los módulos separados (para conservar sus sliders individuales) y asigna exactamente la misma "date" y "time" a los llamamientos evaluados conjuntamente (la interfaz los unificará automáticamente en el calendario como "SOR · SO+REDES" y los seleccionará a la vez). NO crees módulos separados a la misma hora para asignaturas distintas sin verificar el horario.
5. CONVOCATORIAS / LLAMAMIENTOS ("calls"):
   - Lista todas las fechas disponibles por módulo (1ª convocatoria, 2ª convocatoria, appelli, extraordinaria).
   - "date": Formato estricto YYYY-MM-DD.
   - "time": Formato 24h HH:MM (por defecto "09:00").
   - "durationHours": Decimal (ej: 2.5, 3).
   - "deadline": Límite de inscripción YYYY-MM-DD (si no se especifica, calcula 4 días antes del examen).
6. PRESETS ("presets"):
   - Incluye al menos una estrategia recomendada con "selectedCallIds" que cubra el 100% de los módulos pendientes.

Genera ÚNICAMENTE un bloque de código JSON válido con la siguiente estructura normalizada, sin explicaciones ni texto conversacional:

\`\`\`json
{
  "meta": {
    "title": "Grado en Ingeniería Informática — Convocatoria Enero/Febrero 2027",
    "institution": "Universidad / Facultad de Informática",
    "academicYear": "2026/2027",
    "session": "Convocatoria Principal (Invernale / Enero)",
    "targetCredits": 18,
    "icon": "❄️",
    "creditUnit": "ECTS"
  },
  "subjects": [
    {
      "id": "ml",
      "name": "Machine Learning",
      "shortName": "ML",
      "code": "INF-301",
      "credits": 6,
      "color": "indigo",
      "difficulty": "high",
      "defaultWeight": 4,
      "modules": [
        {
          "id": "ml_mod1",
          "name": "Módulo 1: Teoría y Modelos",
          "shortName": "M1",
          "credits": 6,
          "difficulty": "high",
          "defaultWeight": 4,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "ml_call_1",
              "date": "2027-01-14",
              "time": "09:00",
              "durationHours": 2.5,
              "deadline": "2027-01-10",
              "location": "Aula Magna",
              "notes": "1º Llamamiento Ordinario",
              "status": "active",
              "active": true
            },
            {
              "id": "ml_call_2",
              "date": "2027-02-04",
              "time": "09:00",
              "durationHours": 2.5,
              "deadline": "2027-01-31",
              "location": "Aula 2.1",
              "notes": "2º Llamamiento Ordinario",
              "status": "inactive",
              "active": false
            }
          ]
        }
      ]
    },
    {
      "id": "redes_so",
      "name": "Sistemas Operativos y Redes",
      "shortName": "SOR",
      "code": "INF-102",
      "credits": 12,
      "color": "emerald",
      "difficulty": "high",
      "defaultWeight": 4,
      "modules": [
        {
          "id": "mod_so",
          "name": "Módulo 1: Sistemas Operativos (Teoría)",
          "shortName": "SO",
          "credits": 6,
          "difficulty": "high",
          "defaultWeight": 5,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "so_call_1",
              "date": "2027-01-20",
              "time": "15:00",
              "durationHours": 3,
              "deadline": "2027-01-16",
              "location": "Aula 2.3",
              "notes": "1ª Convocatoria SO (Separado)"
            },
            {
              "id": "so_call_2_joint",
              "date": "2027-02-10",
              "time": "15:00",
              "durationHours": 3,
              "deadline": "2027-02-06",
              "location": "Aula Magna",
              "notes": "2ª Convocatoria Conjunta SO + Redes (mismo día y hora)"
            }
          ]
        },
        {
          "id": "mod_redes",
          "name": "Módulo 2: Redes y Comunicaciones (Laboratorio)",
          "shortName": "REDES",
          "credits": 6,
          "difficulty": "medium",
          "defaultWeight": 3,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "redes_call_1",
              "date": "2027-01-28",
              "time": "10:00",
              "durationHours": 2.5,
              "deadline": "2027-01-24",
              "location": "Laboratorio Redes",
              "notes": "1ª Convocatoria Redes (Separado)"
            },
            {
              "id": "redes_call_2_joint",
              "date": "2027-02-10",
              "time": "15:00",
              "durationHours": 3,
              "deadline": "2027-02-06",
              "location": "Aula Magna",
              "notes": "2ª Convocatoria Conjunta SO + Redes (mismo día y hora)"
            }
          ]
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "Convocatoria Ordinaria Óptima",
      "description": "Selecciona los primeros llamamientos cubriendo el 100% de módulos requeridos.",
      "selectedCallIds": ["ml_call_1", "so_call_1", "redes_call_1"]
    }
  ]
}
\`\`\`

REGLAS ESTRICTAS DE RESPUESTA:
1. Devuelve SOLAMENTE el bloque \`\`\`json ... \`\`\`. No incluyas saludos ni texto posterior.
2. Formato de fechas: YYYY-MM-DD. Horas: HH:MM en 24h.
3. Sliders y pesos: Define "defaultWeight" (1 a 5) y "difficulty" en cada módulo individualmente.
4. Identificación visual: Asegura "shortName" para cada asignatura (ej: FAI, ML, SOR) y para cada módulo (ej: M1, M2, M2+3).`;
