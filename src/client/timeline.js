      function renderTimeline(analysis) {
        const container = document.getElementById('timeline-container');
        const badge = document.getElementById('timeline-count-badge');
        badge.textContent = `${analysis.timeline.length} ${t('exams_label')}`;

        if (analysis.timeline.length === 0) {
          container.innerHTML = `
            <div class="text-center py-8 text-slate-400 space-y-2">
              <p class="text-sm">${t('no_exams_selected')}</p>
              <p class="text-xs">${t('no_exams_selected_hint')}</p>
            </div>
          `;
          return;
        }

        let html = `<div class="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">`;

        analysis.timeline.forEach((item, idx) => {
          const call = item.call;
          const token = getColorToken(call.subjectColor);

          // Buffer pill between previous and current
          let bufferHtml = '';
          if (idx > 0) {
            let bufferBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
            let icon = '⚡';
            let label = `${item.bufferBeforeDays} ${t('rest_days_suffix')}`;

            const daysWord = item.bufferBeforeDays === 1 ? t('free_day_singular') : t('free_days_plural');
            if (item.bufferCategory === 'optimal') {
              bufferBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
              icon = '🟢';
              label = `${item.bufferBeforeDays} ${daysWord} (${t('optimal_buffer')})`;
            } else if (item.bufferCategory === 'acceptable') {
              bufferBadgeClass = 'bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-400 border border-sky-200 dark:border-sky-800';
              icon = '🟡';
              label = `${item.bufferBeforeDays} ${daysWord} (${t('acceptable_buffer')})`;
            } else if (item.bufferCategory === 'risk') {
              bufferBadgeClass = 'bg-orange-50 text-orange-700 dark:bg-orange-950/80 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
              icon = '⚠️';
              label = `${item.bufferBeforeDays} ${daysWord} (${t('risk_buffer')})`;
            } else {
              bufferBadgeClass = 'bg-red-50 text-red-700 dark:bg-red-950/80 dark:text-red-400 border border-red-200 dark:border-red-800';
              icon = '⛔';
              label = t('collision_buffer');
            }

            bufferHtml = `
              <div class="relative -left-2 my-2 flex items-center">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${bufferBadgeClass} shadow-sm z-10">
                  <span>${renderIcon(icon, 'w-3.5 h-3.5')}</span>
                  <span>${label}</span>
                </span>
              </div>
            `;
          }

          // Deadline label
          let deadlineHtml = '';
          if (call.deadline) {
            const daysLeft = item.daysToDeadline;
            let deadBadge = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
            let deadText = `${t('deadline_prefix')} ${escapeHtml(call.deadline)}`;
            if (daysLeft !== null) {
              if (daysLeft > 0) {
                deadText = t('deadline_open', daysLeft);
                deadBadge = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
              } else if (daysLeft === 0) {
                deadText = t('deadline_today');
                deadBadge = 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold';
              } else {
                deadText = t('deadline_closed', escapeHtml(call.deadline));
                deadBadge = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500';
              }
            }
            deadlineHtml = `
              <span class="text-[11px] px-2 py-0.5 rounded ${deadBadge}">
                <span class="inline-flex items-center gap-1">${renderIcon('📝', 'w-3 h-3')} ${deadText}</span>
              </span>
            `;
          }

          const safeSubCode = escapeHtml(call.subjectShortName || call.subjectCode || 'EXAM');
          const safeSubName = escapeHtml(call.subjectName);
          const modDisplay = call.jointModuleLabel || call.moduleShortName || (call.hasMultipleModules ? call.moduleName : '');
          const safeModName = escapeHtml(call.moduleName);
          const safeLocation = escapeHtml(call.location || t('location_tbd'));
          const safeNotes = call.notes ? escapeHtml(call.notes) : '';

          let parachuteHtml = '';
          if (typeof item.subsequentCallsCount === 'number') {
            if (item.subsequentCallsCount > 0) {
              const badgeWord = item.subsequentCallsCount === 1 ? t('parachute_singular') : t('parachute_plural', item.subsequentCallsCount);
              parachuteHtml = `
                <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60" title="${t('parachute_title_has')}">
                  <span>${renderIcon('🛡️', 'w-3 h-3')}</span> <span>${badgeWord}</span>
                </span>
              `;
            } else {
              parachuteHtml = `
                <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60" title="${t('parachute_title_none')}">
                  <span>${renderIcon('🏁', 'w-3 h-3')}</span> <span>${t('parachute_none')}</span>
                </span>
              `;
            }
          }

          html += `
            ${bufferHtml}
            <div class="relative group">
              <!-- Marker node -->
              <span class="absolute -left-[30px] top-4 w-3.5 h-3.5 rounded-full ${token.bg} ring-4 ring-white dark:ring-slate-900 shadow"></span>
              
              <!-- Exam card -->
              <div class="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm hover:shadow transition space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${token.lightBg} ${token.text}">
                      ${safeSubCode}
                    </span>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><span>${safeSubName}</span>${call.hasMultipleModules && modDisplay ? `<span class="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">[${escapeHtml(modDisplay)}]</span>` : ''}</h3>
                    <span class="text-xs text-slate-400">• ${call.moduleCredits} ${escapeHtml(schedule.meta?.creditUnit || 'CFU')}</span>
                  </div>

                  <!-- Date & Time badge -->
                  <div class="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg">
                    <span class="inline-flex items-center gap-1">${renderIcon('📅', 'w-3.5 h-3.5')} ${call.date}</span>
                    <span class="inline-flex items-center gap-1">${renderIcon('⏰', 'w-3.5 h-3.5')} ${call.time}</span>
                    <span class="text-slate-400 font-normal">(${call.durationHours}h)</span>
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-600 dark:text-slate-300">
                  <div><span class="font-medium">${t('module_label')}</span> ${safeModName}</div>
                  <div>${parachuteHtml}</div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1">${renderIcon('📍', 'w-3.5 h-3.5')} ${safeLocation}</span>
                    ${safeNotes ? `<span class="italic text-slate-400">• ${safeNotes}</span>` : ''}
                  </div>
                  <div>${deadlineHtml}</div>
                </div>
              </div>
            </div>
          `;
        });

        html += `</div>`;
        container.innerHTML = html;
      }

      function updateApp() {
        const active = getActiveSession();
        if (active) {
          active.selectedCallIds = Array.from(state.selectedCallIds);
          active.subjectWeights = { ...state.subjectWeights };
          active.prioritizeSafety = Boolean(state.prioritizeSafety);
          active.dayPlans = { ...state.dayPlans };
          active.updatedAt = Date.now();
          saveSessionsToStorage();
        }

        const analysis = analyzeSchedule(schedule, state.selectedCallIds, { dayPlans: state.dayPlans });
        state.currentAnalysis = analysis;

        renderHeader();
        renderKPIs(analysis);
        renderAlerts(analysis);
        renderCalendar(analysis);
        renderTimeline(analysis);
        renderSessionSwitcher();
      }

      // --- Export Tools ---
      function exportToICS() {
        const analysis = state.currentAnalysis;
        if (!analysis || analysis.selectedCalls.length === 0) {
          alert('No hay exámenes seleccionados para exportar.');
          return;
        }

        let ics = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//ExamPlan Studio//Universal Interactive Planner//ES',
          'CALSCALE:GREGORIAN',
          'METHOD:PUBLISH'
        ];

        analysis.selectedCalls.forEach(c => {
          const start = new Date(c.startTimestamp);
          const end = new Date(c.endTimestamp);

          function pad(n) { return String(n).padStart(2, '0'); }
          function fmtDate(d) {
            return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
          }
          function escIcs(str) {
            return String(str || '').replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n');
          }

          ics.push(
            'BEGIN:VEVENT',
            `UID:exam-${c.id}-${Date.now()}@examplan.studio`,
            `DTSTAMP:${fmtDate(new Date())}Z`,
            `DTSTART:${fmtDate(start)}`,
            `DTEND:${fmtDate(end)}`,
            `SUMMARY:Examen: ${escIcs(c.subjectName)} (${c.moduleCredits} ${escIcs(schedule.meta?.creditUnit || 'CFU')})`,
            `DESCRIPTION:Módulo: ${escIcs(c.moduleName)}\\nNotas: ${escIcs(c.notes || 'Ninguna')}\\nLímite de inscripción: ${escIcs(c.deadline || 'N/A')}`,
            `LOCATION:${escIcs(c.location || 'Universidad')}`,
            'STATUS:CONFIRMED',
            'END:VEVENT'
          );
        });

        ics.push('END:VCALENDAR');

        const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `examenes_${schedule.meta?.title ? schedule.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'calendario'}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      function copyMarkdownSummary() {
        const analysis = state.currentAnalysis;
        if (!analysis || analysis.selectedCalls.length === 0) {
          alert('No hay exámenes seleccionados.');
          return;
        }

        let md = `## 📚 Plan de Exámenes — ${schedule.meta?.title || 'Sesión'}\n`;
        md += `* **Universidad:** ${schedule.meta?.institution || 'N/A'}\n`;
        md += `* **Créditos Totales:** ${analysis.metrics.totalCredits} / ${analysis.metrics.targetCredits} ${schedule.meta?.creditUnit || 'CFU'}\n`;
        md += `* **Colchón Mínimo:** ${analysis.metrics.minBufferDays} días libres\n`;
        md += `* **Colchón Promedio:** ${analysis.metrics.avgBufferDays} días libres\n\n`;

        md += `### Cronograma de Convocatorias\n`;
        md += `| Fecha | Hora | Asignatura | CFU | Módulo | Aula | Descanso Previo |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        analysis.timeline.forEach((item, idx) => {
          const c = item.call;
          const rest = idx === 0 ? 'Inicio sesión' : `${item.bufferBeforeDays} días`;
          md += `| ${c.date} | ${c.time} | ${c.subjectName} | ${c.moduleCredits} | ${c.moduleName} | ${c.location || '-'} | ${rest} |\n`;
        });

        navigator.clipboard.writeText(md).then(() => {
          alert('¡Resumen en Markdown copiado al portapapeles!');
        }).catch(() => {
          alert('No se pudo copiar automáticamente. Revisa los permisos.');
        });
      }

      // --- Dark / Light Theme Toggle Setup (modern-web-guidance: dark-mode-toggle) ---