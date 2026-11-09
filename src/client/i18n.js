      function detectSessionIcon(meta) {
        if (!meta) return '🎓';
        if (typeof meta.icon === 'string' && meta.icon.trim() && meta.icon.trim() !== '📅') {
          return meta.icon.trim();
        }
        const text = `${meta.session || ''} ${meta.title || ''}`.toLowerCase();
        if (/\b(ene|feb|dic|gen|ice)\b|invern|wint|hibern|gennaio|febbra|diciembr|dicembr|frio|snow/.test(text)) return '❄️';
        if (/\b(jun|jul|may|mag|sol|sun)\b|veran|summ|estiv|primaver|spring|giugno|luglio/.test(text)) return '☀️';
        if (/\b(sep|set|oct|nov)\b|otoñ|oton|autumn|autun|fall|extraordinar|settembr|octub|noviembr|hoja/.test(text)) return '🍂';
        if (/ai|artificial|inteligenc|robot|machine|vision|nlp|deep|datos|data/.test(text)) return '🤖';
        if (/salud|medicin|bio|qu[ií]m|chem/.test(text)) return '🔬';
        if (/empresa|finanz|econom|business|direcc/.test(text)) return '💼';
        if (/f[ií]sic|teleco|el[eé]ctr|energy/.test(text)) return '⚡';
        if (/master|máster|grad|laurea|ingeni|univers|degree/.test(text)) return '🎓';
        return (typeof meta.icon === 'string' && meta.icon.trim()) ? meta.icon.trim() : '📚';
      }

      // Base schedule fallback
      let baseFallbackSchedule = null;
      try {
        const rawJsonEl = document.getElementById('planner-schedule-data');
        const text = rawJsonEl ? rawJsonEl.textContent.trim() : '';
        if (text && !text.startsWith('/*')) {
          baseFallbackSchedule = normalizeSchedule(JSON.parse(text));
        }
      } catch (e) {
        console.warn('Error reading embedded schedule data:', e);
      }

      if (!baseFallbackSchedule) {
        baseFallbackSchedule = normalizeSchedule({
          meta: {
            title: "Grado en Informática — Convocatoria Ordinaria",
            academicYear: "2026/2027",
            session: "Convocatoria Ordinaria",
            icon: "🎓",
            targetCredits: 12,
            creditUnit: "ECTS"
          },
          subjects: [
            {
              id: "fp",
              name: "Fundamentos de Programación",
              shortName: "FP",
              code: "INF-101",
              credits: 6,
              color: "indigo",
              difficulty: "medium",
              defaultWeight: 3,
              modules: [
                {
                  id: "fp_mod",
                  name: "Fundamentos de Programación",
                  credits: 6,
                  calls: [
                    { id: "fp_1", date: "2027-01-10", time: "09:00", durationHours: 3, deadline: "2027-01-06", location: "Aula Magna" }
                  ]
                }
              ]
            },
            {
              id: "sd",
              name: "Sistemas Distribuidos",
              code: "101",
              credits: 6,
              color: "indigo",
              difficulty: "high",
              defaultWeight: 4,
              modules: [
                {
                  id: "sd_mod",
                  name: "Sistemas Distribuidos",
                  credits: 6,
                  calls: [
                    { id: "sd_1", date: "2027-01-14", time: "09:00", durationHours: 3, deadline: "2027-01-10", location: "Aula Magna" },
                    { id: "sd_2", date: "2027-02-04", time: "09:00", durationHours: 3, deadline: "2027-01-31", location: "Aula 2.1" }
                  ]
                }
              ]
            },
            {
              id: "ia",
              name: "Inteligencia Artificial",
              code: "102",
              credits: 6,
              color: "violet",
              difficulty: "high",
              defaultWeight: 5,
              modules: [
                {
                  id: "ia_mod",
                  name: "Inteligencia Artificial",
                  credits: 6,
                  calls: [
                    { id: "ia_1", date: "2027-01-19", time: "14:30", durationHours: 3, deadline: "2027-01-15", location: "Aula Turing" },
                    { id: "ia_2", date: "2027-02-09", time: "14:30", durationHours: 3, deadline: "2027-02-05", location: "Aula Turing" }
                  ]
                }
              ]
            }
          ],
          presets: []
        });
      }

      // --- Internationalization (i18n: ES / EN) ---
      const I18N = {
        es: {
          lang_code: 'ES',
          lang_toggle_target: 'EN',
          brand_subtitle: 'Planificador Inteligente de Exámenes',
          session_label: 'Sesión',
          my_sessions_title: 'Mis Calendarios y Sesiones',
          new_session_btn: '+ Nueva Sesión',
          btn_duplicate: 'Duplicar',
          btn_rename: 'Renombrar',
          btn_manage_subjects: 'Gestionar Asignaturas',
          btn_load_plan: 'Cargar Plan',
          btn_ai_prompt: 'Prompt IA',
          btn_markdown: 'Markdown',
          btn_help: 'Ayuda',
          help_modal_title: 'Guía de Uso y Funciones',
          help_modal_subtitle: 'Explicación clara de cada botón y panel del planificador.',
          btn_understand: 'Entendido',
          help_sec_sessions_title: 'Gestión de Sesiones y Calendarios',
          help_sec_toolbar_title: 'Barra de Herramientas Superior',
          help_sec_opt_title: 'Motores de Optimización y Selección',
          help_sec_sliders_title: 'Ponderación por Asignatura (Sliders de Dificultad)',
          help_sec_calendar_title: 'Calendario Interactivo y Planificación de Días',
          help_sec_timeline_title: 'Métricas (KPIs), Avisos y Agenda Cronológica',
          help_sec_manage_title: 'Panel de Gestión de Asignaturas',
          help_html_content: `
            <section class="space-y-2">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>📅</span> <span>Gestión de Sesiones y Calendarios</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Desplegable de Sesión:</strong> Muestra el nombre e icono del calendario activo. Al pulsar, abre la lista de calendarios disponibles.</p>
                <p><strong>Conmutar Sesión:</strong> Haz clic en cualquier sesión de la lista para cambiar instantáneamente de calendario sin perder tus datos.</p>
                <p><strong>+ Nueva Sesión:</strong> Crea un calendario nuevo desde cero, copiando las materias actuales o cargando una plantilla de ejemplo.</p>
                <p><strong>Duplicar:</strong> Crea una copia idéntica del calendario activo con todas sus notas y llamamientos para probar estrategias alternativas.</p>
                <p><strong>Renombrar:</strong> Modifica el nombre o elige un icono emoji temático para identificar fácilmente el calendario.</p>
                <p><strong>Eliminar:</strong> Borra la sesión activa si ya no la necesitas (el sistema protege siempre al menos un calendario).</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>⚡</span> <span>Barra de Herramientas Superior</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>🌐 Idioma (ES / EN / IT):</strong> Cambia al instante todos los textos, paneles y avisos entre Español, Inglés e Italiano.</p>
                <p><strong>Gestionar Asignaturas:</strong> Abre la ventana para dar de alta materias, editar horas, aulas, dificultades o importar/exportar datos.</p>
                <p><strong>Cargar Plan:</strong> Abre el selector de archivos para cargar un <code>.json</code>, <code>.md</code> o <code>.txt</code>. También puedes arrastrar el archivo directamente a la ventana.</p>
                <p><strong>Prompt IA:</strong> Copia al portapapeles una plantilla de prompt con el esquema exacto para que una IA (ChatGPT, Claude, Gemini) extraiga tus exámenes desde capturas o fotos.</p>
                <p><strong>Markdown:</strong> Copia un resumen estructurado de tus exámenes en formato Markdown para Obsidian, Notion o tus notas personales.</p>
                <p><strong>❓ Ayuda:</strong> Abre esta guía explicativa con el detalle de cada función y botón.</p>
                <p><strong>Modo Claro / Oscuro:</strong> Conmuta la apariencia entre tema claro y oscuro, recordando tu preferencia.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🎯</span> <span>Motores de Optimización y Selección</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Maximizar Espaciado:</strong> Encuentra automáticamente la combinación de fechas con mayor separación mínima entre exámenes, distribuyéndolos de forma equilibrada para evitar sobrecargas.</p>
                <p><strong>Optimizar con Sliders de Dificultad:</strong> Calcula la mejor distribución otorgando más días de descanso y estudio previo a las asignaturas a las que hayas asignado mayor dificultad.</p>
                <p><strong>🛡️ Red de Seguridad (Convocatorias de reserva):</strong> Prioriza elegir fechas tempranas para conservarse convocatorias posteriores de repetición por si necesitas recuperar o subir nota.</p>
                <p><strong>Seleccionar Todo / Limpiar Todo:</strong> Activa o desactiva con un solo clic todas las convocatorias disponibles.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🎚️</span> <span>Ponderación por Asignatura (Sliders de Dificultad)</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Deslizadores 1 a 5:</strong> Ajusta la dificultad o prioridad de cada materia. Mueve a la derecha (4-5) para asignaturas duras que requieran más días de estudio, y a la izquierda (1-2) para materias más llevaderas.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🗓️</span> <span>Calendario Interactivo y Planificación de Días</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Clic en un examen (píldora):</strong> Activa o desactiva esa convocatoria concreta en tu plan de exámenes.</p>
                <p><strong>Clic en una celda de día:</strong> Alterna la selección de los exámenes de ese día. Si el día no tiene exámenes programados, abre el diálogo para planificar el día.</p>
                <p><strong>Icono ✏️ de día:</strong> Abre la ventana de planificación para cualquier día, permitiendo marcarlo como:</p>
                <ul class="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                  <li><strong>🟢 Día Normal / Libre:</strong> Día sin bloqueos ni asignaciones especiales.</li>
                  <li><strong>🚫 Día Bloqueado:</strong> Día en el que no podrás estudiar (viajes, compromisos personales). Se descuenta de tus días útiles de estudio.</li>
                  <li><strong>📖 Día Dedicado:</strong> Pinta el día con el color de una asignatura y una nota para organizar tu repaso intensivo.</li>
                </ul>
                <p><strong>Pestañas de Mes:</strong> Permiten alternar entre la vista global de todos los meses o filtrar un mes específico.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>📊</span> <span>Métricas (KPIs), Avisos y Agenda Cronológica</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Exámenes Cubiertos:</strong> Indica cuántas asignaturas obligatorias tienen al menos un llamamiento elegido.</p>
                <p><strong>Cuello de Botella:</strong> Indica el menor margen de días libres entre dos exámenes consecutivos de tu selección.</p>
                <p><strong>Colchón Promedio:</strong> Media de días libres por examen entre pruebas consecutivas.</p>
                <p><strong>Avisos y Conflictos:</strong> Detecta y avisa de colisiones horarias, sobrecarga en la misma fecha o descansos inferiores a 24 horas.</p>
                <p><strong>Línea Temporal:</strong> Ordena cronológicamente tus exámenes con los días libres restantes, aula, notas y fechas de reserva disponibles.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>⚙️</span> <span>Panel de Gestión de Asignaturas</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Pestaña Asignaturas:</strong> Da de alta nuevas materias, edita su color y dificultad, y añade convocatorias con fecha, hora, duración, aula y fecha límite de inscripción.</p>
                <p><strong>Pestaña Importar / Exportar:</strong> Permite pegar texto o JSON, importar archivos, exportar a Google/Apple Calendar (.ics), descargar tu copia de seguridad en JSON o restablecer datos.</p>
                <p><strong>Pestaña Datos de la Titulación:</strong> Personaliza el título de tu grado o máster, universidad (opcional), año académico y nombre de sesión.</p>
              </div>
            </section>
          `,
          opt_engine_title: 'Motores de Optimización',
          opt_engine_desc: 'Encuentra automáticamente la mejor combinación de fechas para maximizar tus días de estudio y evitar solapamientos.',
          btn_max_spacing: 'Maximizar Espaciado',
          btn_prioritize_difficulty: 'Optimizar con Sliders de Dificultad',
          btn_safety_toggle: '🛡️ Red de Seguridad (Convocatorias de reserva)',
          safety_toggle_desc: 'Prioriza fechas tempranas para asegurar que te queden convocatorias posteriores de repetición si necesitas recuperar o subir nota.',
          btn_select_all: 'Seleccionar Todo',
          btn_clear_selection: 'Limpiar Todo',
          subject_weights_title: 'Ponderación por Asignatura',
          subject_weights_desc: 'Aumenta la dificultad en las materias más exigentes para que el planificador les reserve más días de preparación previa.',
          calendar_title: 'Calendario de la Sesión',
          calendar_desc: 'Haz clic en un día o examen para seleccionarlo. En días libres o pulsando ✏️ puedes bloquear días o asignar materias de estudio.',
          legend_active: 'Activo',
          legend_inactive: 'Desactivado',
          legend_conflict: 'Conflicto',
          all_months: 'Todos los meses',
          calls_label: 'convocatorias',
          kpi_exams_covered: 'Exámenes Cubiertos',
          kpi_exams_unit: 'obligatorios',
          kpi_bottleneck: 'Cuello de Botella (Mín. Días)',
          kpi_free_days: 'días libres',
          kpi_bottleneck_hint: 'Margen mínimo entre 2 exámenes',
          kpi_avg_buffer: 'Colchón Promedio',
          kpi_avg_buffer_unit: 'días / examen',
          kpi_conflicts: 'Conflictos y Avisos',
          kpi_conflicts_none: 'Sin colisiones ni avisos',
          section_calendar: 'Calendario de Convocatorias',
          section_timeline: 'Línea Temporal de Exámenes',
          section_alerts: 'Avisos de Planificación',
          timeline_title: 'Agenda Cronológica & Colchón de Estudio',
          timeline_desc: 'Secuencia temporal con descansos intermedios y plazos de matrícula.',
          exams_label: 'Exámenes',
          no_exams_selected: 'No has seleccionado ningún examen.',
          no_exams_selected_hint: 'Usa el botón "Maximizar Espaciado" o haz clic en las convocatorias del calendario.',
          optimal_buffer: 'Colchón Óptimo (≥ 7 días)',
          acceptable_buffer: 'Aceptable (3 a 6 días)',
          risk_buffer: '¡Riesgo! (< 3 días)',
          collision_buffer: '0 días (Mismo día / Colisión)',
          rest_days_suffix: 'días de descanso',
          free_day_singular: 'día libre',
          free_days_plural: 'días libres',
          deadline_open: (d) => `Inscripción abierta (${d} días restantes)`,
          deadline_today: '¡Último día de inscripción hoy!',
          deadline_closed: (d) => `Inscripción cerrada (${d})`,
          deadline_prefix: 'Límite:',
          parachute_singular: '1 llamamiento de reserva posterior',
          parachute_plural: (n) => `${n} llamamientos de reserva posteriores`,
          parachute_none: 'Última oportunidad (sin paracaídas)',
          parachute_title_has: 'Tienes oportunidades posteriores para repetir este examen si fuera necesario',
          parachute_title_none: 'Última oportunidad programada en esta sesión',
          module_label: 'Módulo:',
          location_tbd: 'Aula por asignar',
          variance_prefix: 'Varianza:',
          variance_hint_good: 'Reparto equilibrado',
          variance_hint_uneven: 'Reparto irregular',
          alerts_critical_title: 'Conflicto Crítico de Horarios',
          alerts_warning_title: 'Avisos de Planificación',
          alerts_check_collisions: 'Revisa las llamadas en colisión',
          conflicts_collisions: (n) => `${n} colisión(es) horaria(s)`,
          conflicts_warnings: (n) => `${n} aviso(s) detectado(s)`,
          day_dialog_title: 'Planificar Día',
          day_dialog_subtitle: 'Disponibilidad o materia de estudio para este día.',
          day_dialog_status_label: 'Estado de Disponibilidad:',
          day_status_normal: 'Día Normal / Libre',
          day_status_normal_hint: 'Sin bloqueo ni asignación fija.',
          day_status_blocked: 'Día No Disponible / Bloqueado',
          day_status_blocked_hint: 'No puedes estudiar. Se descuenta del colchón útil de estudio.',
          day_status_study: 'Día Dedicado a Asignatura',
          day_status_study_hint: 'Pintar el día con el color de la asignatura elegida.',
          day_subject_label: 'Asignatura a Preparar:',
          day_note_label: 'Nota o Tarea (opcional):',
          btn_clear: 'Limpiar Día',
          btn_cancel: 'Cancelar',
          btn_save: 'Guardar',
          day_blocked_badge: 'Bloqueado',
          day_study_badge: 'Estudio',
          day_click_hint: 'Clic para planificar día',
          call_click_hint: 'Clic para alternar examen',
          select_2_exams: 'Selecciona al menos 2 exámenes',
          uncovered_alert_title: 'Exámenes pendientes de planificar',
          uncovered_alert_desc: (count, list) => `Faltan ${count} módulo(s) obligatorios por programar: ${list}.`,
          toast_day_saved: 'Plan de día guardado con éxito.',
          toast_day_cleared: 'Día restablecido a normal.',
          modules_unit: 'módulos',
          module_singular: 'módulo',
          exam_count_badge: (n) => `${n} exám.`,
          btn_reset_all_sessions: 'Restablecer a plantilla genérica',
          alerts_label: 'alertas',
          kpi_no_conflicts: 'Sin colisiones ni avisos',
          menu_upload_file: 'Subir archivo (.json, .md, .txt)',
          menu_paste_text: 'Pegar texto o JSON',
          menu_copy_prompt: 'Prompt IA (Copiar plantilla)',
          menu_copy_md: 'Copiar resumen en Markdown',
          menu_download_json: 'Descargar copia JSON',
          opt_auto_badge: 'Automático',
          difficulty_range_label: 'Dificultad (1 a 5)',
          drop_title: 'Suelta tu archivo aquí',
          drop_subtitle: 'Carga automática de archivos .json, .md o .txt (README generado por IA)',
          drop_badge: '✨ Procesamiento y guardado instantáneo',
          session_active_badge: 'Activa',
          subjects_unit: 'asignaturas',
          session_modal_title_new: 'Nueva Sesión de Exámenes',
          session_modal_subtitle_new: 'Crea un calendario independiente para organizar otra convocatoria o titulación.',
          btn_create_session: 'Crear Sesión',
          session_modal_title_edit: 'Editar Información de Sesión',
          session_modal_subtitle_edit: 'Modifica el nombre e icono representativo de este calendario.',
          empty_calendar_title: 'No hay convocatorias en el calendario',
          empty_calendar_desc: 'Pulsa en "Gestionar Asignaturas" para añadir exámenes o importar tus datos.',
          conflict_collision_title: (s1, s2) => `Colisión Horaria: ${s1} vs ${s2}`,
          conflict_collision_desc: (d, t1, t2) => `Solapamiento directo el ${d} entre las ${t1} y las ${t2}. No es posible realizar ambos.`,
          conflict_congestion_title: (d) => `Sobrecarga Diaria el ${d}`,
          conflict_congestion_desc: (s1, t1, s2, t2) => `${s1} (${t1}) y ${s2} (${t2}) coinciden en la misma jornada.`,
          conflict_turnaround_title: 'Descanso Crítico (< 24h)',
          conflict_turnaround_desc: (h, s1, s2) => `Solo hay ${h} horas de descanso entre ${s1} y ${s2}.`,
          conflict_multi_title: (m) => `Convocatoria de Reserva: ${m}`,
          conflict_multi_desc: (n) => `Has seleccionado ${n} llamamientos activos para esta misma materia.`,
          manage_modal_title: 'Gestión Universal de Asignaturas & Convocatorias',
          manage_modal_subtitle: 'Personaliza tus asignaturas, añade convocatorias o importa planes completos para cualquier titulación universitaria.',
          tab_subjects: '📚 Asignaturas & Convocatorias',
          tab_import: '📥 Importar / Exportar',
          tab_meta: '🏛️ Datos de la Titulación',
          manage_subjects_hint: ' • Edita o añade los llamamientos de cada examen',
          btn_new_subject: 'Nueva Asignatura',
          subject_form_title_edit: 'Editar Asignatura',
          no_subjects_configured: 'No hay asignaturas configuradas.',
          no_subjects_hint: 'Haz clic en "Nueva Asignatura" para añadir tu primer examen o ve a la pestaña Importar.',
          diff_high_badge: 'Dificultad Alta (5/5)',
          diff_medium_badge: 'Dificultad Media (3/5)',
          diff_low_badge: 'Dificultad Baja (1/5)',
          no_calls_registered: 'Sin convocatorias registradas. Añade una para poder incluirla en el calendario.',
          btn_edit: 'Editar',
          btn_delete: 'Eliminar',
          modules_label: 'Módulos:',
          btn_add_call: '+ Convocatoria',
          lbl_mod_name: 'Nombre del Módulo *',
          lbl_mod_short: 'Abreviatura *',
          lbl_mod_diff: 'Dificultad',
          lbl_mod_credits: 'Créditos',
          call_form_title_new: 'Nueva Convocatoria (Appello)',
          call_form_title_edit: 'Editar Convocatoria',
          lbl_sub_name: 'Nombre de la Asignatura *',
          lbl_sub_code: 'Código (Opcional)',
          lbl_sub_diff: 'Dificultad Previa',
          lbl_sub_color: 'Color Identificativo',
          lbl_sub_modules: 'Módulos / Partes de la Asignatura',
          btn_add_module: '+ Añadir Módulo',
          btn_save_subject: 'Guardar Asignatura',
          lbl_call_date: 'Fecha del Examen *',
          lbl_call_time: 'Hora de Inicio',
          lbl_call_duration: 'Duración (Horas)',
          lbl_call_deadline: 'Límite Inscripción (Deadline)',
          lbl_call_location: 'Aula / Ubicación',
          lbl_call_notes: 'Notas / Modalidad',
          lbl_call_status: 'Estado de Selección',
          opt_call_active: 'Activo (Seleccionado en el plan)',
          opt_call_inactive: 'Desactivado (No seleccionado)',
          status_active: 'Activo',
          status_inactive: 'Desactivado',
          toast_json_downloaded: '¡Plan descargado en JSON con exámenes activos!',
          toast_json_copied: '¡Plan JSON copiado al portapapeles con exámenes activos!',
          btn_save_call: 'Guardar Convocatoria',
          conflict_precedence_title: (m) => `Violación de Precedencia: ${m}`,
          conflict_precedence_desc: (dOral, dWritten) => `El examen oral (${dOral}) debe realizarse obligatoriamente después del examen escrito (${dWritten}).`,
          conflict_binding_title: (m) => `Vinculación de Appello Incumplida: ${m}`,
          conflict_binding_desc: (wApp, oApp) => `Esta asignatura exige realizar el oral en el mismo llamamiento que el escrito (escrito en Appello ${wApp}, oral en Appello ${oApp}).`,
          conflict_missing_written_title: (m) => `Falta Examen Escrito Previo: ${m}`,
          conflict_missing_written_desc: 'Has seleccionado el examen oral sin haber elegido el examen escrito previo obligatorio para este módulo.',
          lbl_has_modules: 'Esta asignatura se divide en módulos',
          badge_no_modules: 'Sin módulos',
          lbl_subject_eval_mode: 'Modalidad de Evaluación',
          lbl_mod_eval_mode: 'Modalidad de Evaluación',
          eval_mode_standard: 'Estándar (1 examen)',
          eval_mode_written_oral: 'Escrito + Oral',
          eval_mode_written_lab: 'Escrito + Práctica/Lab',
          lbl_mod_oral_binding: 'Vinculación del Oral',
          binding_same_appello: 'Mismo Appello obligatorio',
          binding_any_subsequent: 'Mismo o cualquier Appello posterior',
          lbl_call_type: 'Tipo de Examen',
          type_standard: 'General / Estándar',
          type_written: 'Escrito (Scritto)',
          type_oral: 'Oral (Orale)',
          type_lab: 'Laboratorio / Práctica',
          lbl_call_appello: 'Nº de Appello / Llamamiento',
          badge_written: 'Escrito',
          badge_oral: 'Oral',
          badge_lab: 'Lab',
          badge_appello: (n) => `Appello ${n}`,
          import_sec_title: 'Importar Datos Universitarios (JSON, README de IA o Markdown)',
          import_guide_title: 'Cómo cargar tus exámenes automáticamente con IA',
          import_guide_subtitle: 'Extrae asignaturas, fechas, horas y aulas directamente desde fotos, capturas o PDFs en 3 sencillos pasos.',
          step1_title: 'Paso 1: Copiar Prompt IA',
          step1_desc: 'Copia la plantilla con las instrucciones y formato que el planificador necesita.',
          step2_title: 'Paso 2: Generar con tu IA',
          step2_desc: 'Abre ChatGPT, Claude o Gemini, pega el prompt y adjunta tus fotos o lista de exámenes.',
          step3_title: 'Paso 3: Pegar resultado e Importar',
          step3_desc: 'Pega la respuesta de la IA en el recuadro de abajo y haz clic en "Procesar e Importar Plan".',
          badge_guided_fast: '⚡ Rápido y Guiado',
          step_badge_ready: '✓ Listo en 1 clic',
          import_sec_desc: 'Arrastra tu archivo, pega el esquema JSON, o pega la respuesta completa generada por una IA (incluso con texto conversacional y formato ```json).',
          import_dest_label: 'Destino del plan importado:',
          import_dest_new: '✨ Crear automáticamente una nueva sesión',
          btn_copy_ai_template: 'Copiar Plantilla para IA',
          btn_sample_md: '📋 Cargar Ejemplo Markdown',
          btn_select_file: '📂 Seleccionar Archivo',
          btn_run_import: 'Procesar e Importar Plan',
          export_sec_title: 'Exportar Configuración',
          reset_sec_title: 'Restablecer Datos',
          meta_sec_title: 'Información de la Titulación y Convocatoria',
          lbl_meta_title: 'Título de la Titulación / Sesión',
          lbl_meta_inst: 'Universidad / Institución',
          lbl_meta_year: 'Año Académico',
          lbl_meta_session: 'Nombre de la Sesión',
          lbl_meta_icon: 'Icono / Emoji de la Sesión',
          btn_save_meta: 'Guardar Datos de Titulación',
          step_1_badge: 'Paso 1',
          step_2_badge: 'Paso 2',
          step_3_badge: 'Paso 3',
          dropzone_prompt: 'Arrastra aquí tu archivo <span class="text-indigo-600 dark:text-indigo-400 underline">.json, .md o .txt</span> o haz clic para seleccionarlo',
          dropzone_hint: 'Detección automática de bloques JSON, sanitización de comentarios y tablas Markdown',
          import_dest_overwrite: 'Sobrescribir sesión activa',
          import_textarea_placeholder: 'O pega directamente aquí el JSON o el texto de la IA (incluyendo ```json ... ``` o tablas)...',
          export_sec_desc: 'Descarga el JSON actualizado para respaldar o usar en otros dispositivos.',
          btn_download_json: 'Descargar JSON',
          btn_copy_json: 'Copiar JSON',
          reset_sec_desc: 'Borra las modificaciones guardadas en localStorage y restaura el plan original.',
          btn_reset_storage: 'Restablecer a Datos de Fábrica',
          toast_prompt_copied: '✓ ¡Plantilla y prompt para IA copiado al portapapeles! Pégalo a una IA junto con tus capturas.',
          toast_prompt_copied_simple: '✓ ¡Plantilla y prompt para IA copiado al portapapeles!',
          alert_copy_failed: 'No se pudo copiar automáticamente al portapapeles.',
          toast_new_session_imported: (icon, name, subs, calls) => `¡Nueva sesión "${icon} ${name}" creada! (${subs} asignaturas, ${calls} llamamientos).`,
          toast_session_imported_active: (subs, calls) => `¡Plan cargado en sesión activa! (${subs} asignaturas, ${calls} convocatorias).`,
          toast_image_pdf_uploaded: 'ℹ️ Has subido una imagen o PDF. Copia la plantilla con el botón "Prompt IA", envíasela a ChatGPT/Gemini junto con tus capturas, y arrastra aquí el JSON o Markdown resultante.',
          toast_file_read_error: (name) => `Error al leer el archivo ${name}.`,
          confirm_reset_storage: '¿Restablecer el planificador a la configuración inicial? Se perderán todas las sesiones y asignaturas añadidas en el navegador.',
          toast_markdown_copied: '✓ ¡Resumen Markdown copiado al portapapeles!',
          alert_no_exams_export_ics: 'No hay exámenes seleccionados para exportar.',
          lbl_sub_acronym: 'Abreviatura / Acrónimo',
          hint_sub_acronym: '(ej. FAI, ML, SO, FP — visible en calendario y sliders)',
          hint_sub_modules: 'Asigna a cada módulo su nombre y abreviatura (ej. M1, M2, Teoría, Lab) para mostrarse en la UI.',
          lbl_call_mod_evaluated: 'Módulo Evaluado en este Examen',
          btn_cancel_sub: '✕ Cancelar',
          btn_cancel_call: '✕ Cancelar',
          title_duplicate: 'Duplicar para probar otra combinación de fechas',
          title_rename: 'Renombrar o cambiar icono',
          title_delete: 'Eliminar sesión actual',
          title_manage_subjects: 'Gestionar asignaturas, convocatorias o importar planes',
          title_load_plan: 'Cargar o importar plan de exámenes (JSON, IA, archivo)',
          title_help: 'Guía y explicación de funciones',
          title_theme_toggle: 'Cambiar tema claro u oscuro',
          title_lang_toggle: 'Switch Language / Cambiar Idioma',
          title_session_dropdown: 'Cambiar de sesión o gestionar calendarios',
          placeholder_day_note: 'Ej: Repasar temas 1-3, simulacro...',
          placeholder_session_name: 'Ej: ❄️ Sesión de Invierno, ☀️ Verano, 🎓 Máster AI...',
          lbl_session_name: 'Nombre de la Sesión / Calendario',
          lbl_session_icon: 'Icono de la Sesión',
          hint_session_emoji: 'Selecciona o escribe cualquier emoji',
          lbl_selected_emoji: 'Emoji seleccionado:',
          hint_custom_emoji: '(personalizable a mano si lo prefieres)',
          lbl_session_init_content: 'Contenido Inicial de Asignaturas:',
          session_init_copy_title: 'Duplicar asignaturas de la sesión actual',
          session_init_copy_hint: 'Copia las asignaturas y llamamientos para comparar estrategias.',
          session_init_copy_named: (name) => `Copia las asignaturas y llamamientos de "${name}".`,
          session_init_sample_title: 'Cargar plantilla universitaria de ejemplo',
          session_init_sample_hint: 'Asignaturas de prueba con múltiples convocatorias para planificar.',
          session_init_empty_title: 'Calendario en blanco (vacío)',
          session_init_empty_hint: 'Empieza desde cero y añade o importa tus asignaturas.',
          btn_save_session: 'Guardar Sesión',
          presets_default_opt: '⚙️ Presets de Estrategia...',
          subject_prefix: (name) => `Asignatura: ${name}`,
          confirm_delete_subject: (name) => `¿Eliminar la asignatura "${name}" y todas sus convocatorias?`,
          confirm_delete_call: '¿Eliminar esta convocatoria?',
          alert_enter_subject_name: 'Por favor introduce el nombre de la asignatura.',
          alert_min_one_module: 'La asignatura debe tener al menos un módulo.',
          alert_valid_date: 'Por favor selecciona una fecha válida para el examen.',
          alert_session_name_required: 'Por favor, indica un nombre para la sesión.',
          toast_session_saved: 'Sesión actualizada con éxito.',
          toast_meta_saved: 'Datos de titulación actualizados con éxito.',
          delete_single_session_disabled_title: 'No se puede eliminar la única sesión disponible',
          diff_high_opt: 'Alta (5/5)',
          diff_medium_opt: 'Media (3/5)',
          diff_low_opt: 'Baja (1/5)'
        },
        en: {
          lang_code: 'EN',
          lang_toggle_target: 'IT',
          brand_subtitle: 'Smart Exam Planner',
          session_label: 'Session',
          my_sessions_title: 'My Calendars & Sessions',
          new_session_btn: '+ New Session',
          btn_duplicate: 'Duplicate',
          btn_rename: 'Rename',
          btn_manage_subjects: 'Manage Subjects',
          btn_load_plan: 'Load Plan',
          btn_ai_prompt: 'AI Prompt',
          btn_markdown: 'Markdown',
          btn_help: 'Help',
          help_modal_title: 'User Guide & Features',
          help_modal_subtitle: 'Clear explanation of every button and panel in the planner.',
          btn_understand: 'Got it',
          help_sec_sessions_title: 'Session & Calendar Management',
          help_sec_toolbar_title: 'Top Quick Action Toolbar',
          help_sec_opt_title: 'Optimization & Selection Engines',
          help_sec_sliders_title: 'Subject Weighting (Difficulty Sliders)',
          help_sec_calendar_title: 'Interactive Calendar & Day Planning',
          help_sec_timeline_title: 'KPIs, Alerts & Chronological Timeline',
          help_sec_manage_title: 'Subject Management Panel',
          help_html_content: `
            <section class="space-y-2">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>📅</span> <span>Session & Calendar Management</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Session Dropdown:</strong> Shows the active calendar name and icon. Click it to display all available sessions.</p>
                <p><strong>Switch Session:</strong> Click any session in the list to switch calendars instantly without losing data.</p>
                <p><strong>+ New Session:</strong> Creates a brand new calendar from scratch, copying current subjects, or using a sample template.</p>
                <p><strong>Duplicate:</strong> Creates an identical copy of the active calendar with all calls and notes to test alternative strategies.</p>
                <p><strong>Rename:</strong> Change the name or select a themed emoji icon to easily identify this calendar.</p>
                <p><strong>Delete:</strong> Removes the active session when no longer needed (the system always retains at least one calendar).</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>⚡</span> <span>Top Quick Action Toolbar</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>🌐 Language (ES / EN / IT):</strong> Instantly switches all text, panels, and warnings between Spanish, English, and Italian.</p>
                <p><strong>Manage Subjects:</strong> Opens the management panel to add subjects, edit times, rooms, difficulty, or import/export data.</p>
                <p><strong>Load Plan:</strong> Opens the file picker to import <code>.json</code>, <code>.md</code>, or <code>.txt</code>. You can also drag and drop files anywhere on the page.</p>
                <p><strong>AI Prompt:</strong> Copies an optimized prompt template and schema to clipboard so ChatGPT, Claude, or Gemini can parse dates from screenshots.</p>
                <p><strong>Markdown:</strong> Copies a structured summary of your selected exams in Markdown format for Obsidian or Notion.</p>
                <p><strong>❓ Help:</strong> Opens this guide with explanations of every feature and button.</p>
                <p><strong>Light / Dark Mode:</strong> Toggles appearance between light and dark themes, remembering your choice.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🎯</span> <span>Optimization & Selection Engines</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Maximize Spacing:</strong> Automatically selects the combination of dates that maximizes the minimum study gap between exams, distributing them evenly.</p>
                <p><strong>Optimize with Difficulty Sliders:</strong> Calculates the best schedule by allocating more prep days before the subjects you marked as more demanding.</p>
                <p><strong>🛡️ Safety Net (Backup Calls):</strong> Prioritizes earlier exam dates so you keep later backup calls available if you need to retake or improve a grade.</p>
                <p><strong>Select All / Clear All:</strong> Selects or deselects all scheduled exam calls with a single click.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🎚️</span> <span>Subject Weighting (Difficulty Sliders)</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Sliders 1 to 5:</strong> Configure each subject's relative difficulty. Slide right (4-5) for tough subjects needing more study time, and left (1-2) for lighter ones.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🗓️</span> <span>Interactive Calendar & Day Planning</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Click on an exam pill:</strong> Toggles that specific call on or off in your schedule.</p>
                <p><strong>Click on a day cell:</strong> Toggles the selection of exams on that day. On free days without exams, it opens the day planning dialog.</p>
                <p><strong>Day ✏️ icon:</strong> Opens the planning dialog for any day to mark it as:</p>
                <ul class="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                  <li><strong>🟢 Normal / Free Day:</strong> Standard day for study without restrictions.</li>
                  <li><strong>🚫 Blocked Day:</strong> Day you are unavailable (trips, events). Deducted from usable study buffer.</li>
                  <li><strong>📖 Dedicated Study Day:</strong> Colors the day with a subject token and note to organize your study plan.</li>
                </ul>
                <p><strong>Month Tabs:</strong> Switch between seeing all months together or focusing on a specific month.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>📊</span> <span>KPIs, Alerts & Chronological Timeline</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Covered Exams:</strong> Shows how many required subjects have at least one selected exam call.</p>
                <p><strong>Bottleneck:</strong> The smallest gap of free days between any two consecutive exams in your selection.</p>
                <p><strong>Average Buffer:</strong> Mean number of study days between consecutive exams.</p>
                <p><strong>Planning Alerts:</strong> Instantly warns of time overlaps, same-day exams, or turnarounds under 24 hours.</p>
                <p><strong>Chronological Agenda:</strong> Lists your exams ordered by date with free preparation days, rooms, notes, and backup attempts.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>⚙️</span> <span>Subject Management Panel</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Subjects Tab:</strong> Add new subjects, customize colors and difficulty, and add calls with date, time, duration, room, and deadline.</p>
                <p><strong>Import / Export Tab:</strong> Paste JSON or markdown, upload schedule files, export to Google/Apple Calendar (.ics), download JSON backups, or reset data.</p>
                <p><strong>Degree Data Tab:</strong> Customize program title, university/institution (optional), academic year, and session name.</p>
              </div>
            </section>
          `,
          opt_engine_title: 'Optimization Engines',
          opt_engine_desc: 'Automatically finds the best combination of exam dates to maximize your study buffer and avoid overlaps.',
          btn_max_spacing: 'Maximize Spacing',
          btn_prioritize_difficulty: 'Optimize with Difficulty Sliders',
          btn_safety_toggle: '🛡️ Safety Net (Backup Calls)',
          safety_toggle_desc: 'Prioritizes earlier dates so you retain later backup calls if you need to retake or improve your grade.',
          btn_select_all: 'Select All',
          btn_clear_selection: 'Clear All',
          subject_weights_title: 'Subject Weighting',
          subject_weights_desc: 'Increase difficulty on demanding subjects so the planner allocates more preparation days before them.',
          calendar_title: 'Session Calendar',
          calendar_desc: 'Click on any day or exam to select it. On free days or clicking ✏️ you can block days or assign study tasks.',
          legend_active: 'Active',
          legend_inactive: 'Inactive',
          legend_conflict: 'Conflict',
          all_months: 'All months',
          calls_label: 'calls',
          kpi_exams_covered: 'Covered Exams',
          kpi_exams_unit: 'required',
          kpi_bottleneck: 'Bottleneck (Min. Days)',
          kpi_free_days: 'free days',
          kpi_bottleneck_hint: 'Minimum gap between 2 exams',
          kpi_avg_buffer: 'Average Buffer',
          kpi_avg_buffer_unit: 'days / exam',
          kpi_conflicts: 'Conflicts & Warnings',
          kpi_conflicts_none: 'No collisions or warnings',
          section_calendar: 'Exam Calendar',
          section_timeline: 'Exam Timeline',
          section_alerts: 'Planning Alerts',
          timeline_title: 'Chronological Agenda & Study Buffer',
          timeline_desc: 'Time sequence with rest intervals and registration deadlines.',
          exams_label: 'Exams',
          no_exams_selected: 'No exams selected.',
          no_exams_selected_hint: 'Use "Maximize Spacing" or click exam calls in the calendar.',
          optimal_buffer: 'Optimal Buffer (≥ 7 days)',
          acceptable_buffer: 'Acceptable (3 to 6 days)',
          risk_buffer: 'Risk! (< 3 days)',
          collision_buffer: '0 days (Same day / Collision)',
          rest_days_suffix: 'rest days',
          free_day_singular: 'free day',
          free_days_plural: 'free days',
          deadline_open: (d) => `Registration open (${d} days left)`,
          deadline_today: 'Registration deadline today!',
          deadline_closed: (d) => `Registration closed (${d})`,
          deadline_prefix: 'Deadline:',
          parachute_singular: '1 backup attempt remaining',
          parachute_plural: (n) => `${n} backup attempts remaining`,
          parachute_none: 'Final attempt (no backup)',
          parachute_title_has: 'You have subsequent opportunities to retake this exam if needed',
          parachute_title_none: 'Last scheduled opportunity in this session',
          module_label: 'Module:',
          location_tbd: 'Room TBA',
          variance_prefix: 'Variance:',
          variance_hint_good: 'Even spacing',
          variance_hint_uneven: 'Uneven spacing',
          alerts_critical_title: 'Critical Schedule Conflict',
          alerts_warning_title: 'Planning Warnings',
          alerts_check_collisions: 'Review colliding calls',
          conflicts_collisions: (n) => `${n} critical collision(s)`,
          conflicts_warnings: (n) => `${n} warning(s) detected`,
          day_dialog_title: 'Plan Day',
          day_dialog_subtitle: 'Availability or dedicated study subject for this day.',
          day_dialog_status_label: 'Availability Status:',
          day_status_normal: 'Normal / Free Day',
          day_status_normal_hint: 'No block and no fixed assignment.',
          day_status_blocked: 'Unavailable / Blocked Day',
          day_status_blocked_hint: 'Cannot study. Deducted from usable study buffer.',
          day_status_study: 'Dedicated Study Day',
          day_status_study_hint: 'Tint day with selected subject color.',
          day_subject_label: 'Subject to Prepare:',
          day_note_label: 'Note or Goal (optional):',
          btn_clear: 'Clear Day',
          btn_cancel: 'Cancel',
          btn_save: 'Save',
          day_blocked_badge: 'Blocked',
          day_study_badge: 'Study',
          day_click_hint: 'Click to plan day',
          call_click_hint: 'Click to toggle exam',
          select_2_exams: 'Select at least 2 exams',
          uncovered_alert_title: 'Pending Exams to Schedule',
          uncovered_alert_desc: (count, list) => `Missing ${count} required module(s) to schedule: ${list}.`,
          toast_day_saved: 'Day plan saved successfully.',
          toast_day_cleared: 'Day reset to normal.',
          modules_unit: 'modules',
          module_singular: 'module',
          exam_count_badge: (n) => `${n} exams`,
          btn_reset_all_sessions: 'Reset to default template',
          alerts_label: 'alerts',
          kpi_no_conflicts: 'No collisions or warnings',
          menu_upload_file: 'Upload file (.json, .md, .txt)',
          menu_paste_text: 'Paste text or JSON',
          menu_copy_prompt: 'AI Prompt (Copy template)',
          menu_copy_md: 'Copy Markdown summary',
          menu_download_json: 'Download JSON backup',
          opt_auto_badge: 'Automatic',
          difficulty_range_label: 'Difficulty (1 to 5)',
          drop_title: 'Drop your file here',
          drop_subtitle: 'Automatic import of .json, .md or .txt files (AI-generated README)',
          drop_badge: '✨ Instant processing and saving',
          session_active_badge: 'Active',
          subjects_unit: 'subjects',
          session_modal_title_new: 'New Exam Session',
          session_modal_subtitle_new: 'Create an independent calendar to organize another session or degree.',
          btn_create_session: 'Create Session',
          session_modal_title_edit: 'Edit Session Details',
          session_modal_subtitle_edit: 'Modify the name and representative icon of this calendar.',
          empty_calendar_title: 'No exam calls in the calendar',
          empty_calendar_desc: 'Click "Manage Subjects" to add exams or import your schedule.',
          conflict_collision_title: (s1, s2) => `Time Collision: ${s1} vs ${s2}`,
          conflict_collision_desc: (d, t1, t2) => `Direct overlap on ${d} between ${t1} and ${t2}. Both cannot be taken together.`,
          conflict_congestion_title: (d) => `Same-Day Overload on ${d}`,
          conflict_congestion_desc: (s1, t1, s2, t2) => `${s1} (${t1}) and ${s2} (${t2}) are scheduled on the same day.`,
          conflict_turnaround_title: 'Critical Turnaround (< 24h)',
          conflict_turnaround_desc: (h, s1, s2) => `Only ${h} hours of rest between ${s1} and ${s2}.`,
          conflict_multi_title: (m) => `Backup Call Selected: ${m}`,
          conflict_multi_desc: (n) => `You have selected ${n} active calls for this same module.`,
          manage_modal_title: 'Universal Subject & Exam Call Manager',
          manage_modal_subtitle: 'Customize subjects, add exam calls, or import complete schedules for any university degree.',
          tab_subjects: '📚 Subjects & Calls',
          tab_import: '📥 Import / Export',
          tab_meta: '🏛️ Degree Details',
          manage_subjects_hint: ' • Edit or add exam calls for each subject',
          btn_new_subject: 'New Subject',
          subject_form_title_edit: 'Edit Subject',
          no_subjects_configured: 'No subjects configured.',
          no_subjects_hint: 'Click "New Subject" to add your first exam or go to the Import tab.',
          diff_high_badge: 'High Difficulty (5/5)',
          diff_medium_badge: 'Medium Difficulty (3/5)',
          diff_low_badge: 'Low Difficulty (1/5)',
          no_calls_registered: 'No exam calls registered. Add one to display it on the calendar.',
          btn_edit: 'Edit',
          btn_delete: 'Delete',
          modules_label: 'Modules:',
          btn_add_call: '+ Exam Call',
          lbl_mod_name: 'Module Name *',
          lbl_mod_short: 'Short Name *',
          lbl_mod_diff: 'Difficulty',
          lbl_mod_credits: 'Credits',
          call_form_title_new: 'New Exam Call',
          call_form_title_edit: 'Edit Exam Call',
          lbl_sub_name: 'Subject Name *',
          lbl_sub_code: 'Code (Optional)',
          lbl_sub_diff: 'Base Difficulty',
          lbl_sub_color: 'Color Theme',
          lbl_sub_modules: 'Subject Modules / Parts',
          btn_add_module: '+ Add Module',
          btn_save_subject: 'Save Subject',
          lbl_call_date: 'Exam Date *',
          lbl_call_time: 'Start Time',
          lbl_call_duration: 'Duration (Hours)',
          lbl_call_deadline: 'Registration Deadline',
          lbl_call_location: 'Room / Location',
          lbl_call_notes: 'Notes / Format',
          lbl_call_status: 'Selection Status',
          opt_call_active: 'Active (Selected in plan)',
          opt_call_inactive: 'Inactive (Not selected)',
          status_active: 'Active',
          status_inactive: 'Inactive',
          toast_json_downloaded: 'Plan downloaded in JSON with active exams!',
          toast_json_copied: 'JSON plan copied to clipboard with active exams!',
          btn_save_call: 'Save Exam Call',
          import_sec_title: 'Import University Data (JSON, AI Output or Markdown)',
          import_guide_title: 'How to Load Your Exams Automatically with AI',
          import_guide_subtitle: 'Extract subjects, dates, times, and rooms directly from photos, screenshots, or PDFs in 3 easy steps.',
          step1_title: 'Step 1: Copy AI Prompt',
          step1_desc: 'Copy the template with instructions and format the planner expects.',
          step2_title: 'Step 2: Generate with AI',
          step2_desc: 'Open ChatGPT, Claude, or Gemini, paste the prompt, and attach your photos or exam list.',
          step3_title: 'Step 3: Paste result & Import',
          step3_desc: 'Paste the AI response in the box below and click "Process and Import Plan".',
          badge_guided_fast: '⚡ Fast & Guided',
          step_badge_ready: '✓ Ready in 1 click',
          import_sec_desc: 'Drag and drop your file, paste JSON schema, or paste the raw AI response (including ```json blocks).',
          import_dest_label: 'Imported plan destination:',
          import_dest_new: '✨ Automatically create a new session',
          btn_copy_ai_template: 'Copy AI Prompt Template',
          btn_sample_md: '📋 Load Markdown Sample',
          btn_select_file: '📂 Select File',
          btn_run_import: 'Process & Import Plan',
          export_sec_title: 'Export Configuration',
          reset_sec_title: 'Reset Data',
          meta_sec_title: 'Degree & Session Information',
          lbl_meta_title: 'Degree / Session Title',
          lbl_meta_inst: 'University / Institution',
          lbl_meta_year: 'Academic Year',
          lbl_meta_session: 'Session Name',
          lbl_meta_icon: 'Session Icon / Emoji',
          btn_save_meta: 'Save Degree Info',
          conflict_precedence_title: (m) => `Precedence Violation: ${m}`,
          conflict_precedence_desc: (dOral, dWritten) => `Oral exam (${dOral}) must strictly be taken after written exam (${dWritten}).`,
          conflict_binding_title: (m) => `Call Binding Violation: ${m}`,
          conflict_binding_desc: (wApp, oApp) => `This course requires taking the oral in the same call as the written exam (written in Call ${wApp}, oral in Call ${oApp}).`,
          conflict_missing_written_title: (m) => `Missing Prerequisite Written Exam: ${m}`,
          conflict_missing_written_desc: 'You selected the oral exam without selecting the mandatory prerequisite written exam for this module.',
          lbl_has_modules: 'This subject is divided into modules',
          badge_no_modules: 'No modules',
          lbl_subject_eval_mode: 'Evaluation Mode',
          lbl_mod_eval_mode: 'Evaluation Mode',
          eval_mode_standard: 'Standard (1 exam)',
          eval_mode_written_oral: 'Written + Oral',
          eval_mode_written_lab: 'Written + Practical/Lab',
          lbl_mod_oral_binding: 'Oral Exam Binding',
          binding_same_appello: 'Same Call required',
          binding_any_subsequent: 'Same or any subsequent Call',
          lbl_call_type: 'Exam Type',
          type_standard: 'General / Standard',
          type_written: 'Written',
          type_oral: 'Oral',
          type_lab: 'Lab / Practical',
          lbl_call_appello: 'Call / Appello Number',
          badge_written: 'Written',
          badge_oral: 'Oral',
          badge_lab: 'Lab',
          badge_appello: (n) => `Call ${n}`,
          step_1_badge: 'Step 1',
          step_2_badge: 'Step 2',
          step_3_badge: 'Step 3',
          dropzone_prompt: 'Drag & drop your <span class="text-indigo-600 dark:text-indigo-400 underline">.json, .md or .txt</span> file here or click to select',
          dropzone_hint: 'Automatic detection of JSON blocks, comment stripping, and Markdown tables',
          import_dest_overwrite: 'Overwrite active session',
          import_textarea_placeholder: 'Or paste directly here the JSON or AI output (including ```json ... ``` or tables)...',
          export_sec_desc: 'Download the updated JSON to backup or use on other devices.',
          btn_download_json: 'Download JSON',
          btn_copy_json: 'Copy JSON',
          reset_sec_desc: 'Clears changes stored in localStorage and restores the original schedule.',
          btn_reset_storage: 'Reset to Factory Defaults',
          toast_prompt_copied: '✓ AI prompt template copied to clipboard! Paste it into an AI along with your screenshots.',
          toast_prompt_copied_simple: '✓ AI prompt template copied to clipboard!',
          alert_copy_failed: 'Could not copy to clipboard automatically.',
          toast_new_session_imported: (icon, name, subs, calls) => `New session "${icon} ${name}" created! (${subs} subjects, ${calls} exam calls).`,
          toast_session_imported_active: (subs, calls) => `Plan loaded into active session! (${subs} subjects, ${calls} exam calls).`,
          toast_image_pdf_uploaded: 'ℹ️ You uploaded an image or PDF. Copy the template using "AI Prompt", send it to ChatGPT/Gemini with your screenshots, and drop the resulting JSON or Markdown here.',
          toast_file_read_error: (name) => `Error reading file ${name}.`,
          confirm_reset_storage: 'Reset planner to factory defaults? All sessions and custom subjects in this browser will be lost.',
          toast_markdown_copied: '✓ Markdown summary copied to clipboard!',
          alert_no_exams_export_ics: 'No exams selected to export.',
          lbl_sub_acronym: 'Short Name / Acronym',
          hint_sub_acronym: '(e.g. FAI, ML, OS, CS — visible in calendar and sliders)',
          hint_sub_modules: 'Assign each module a name and short label (e.g. M1, M2, Theory, Lab) for UI display.',
          lbl_call_mod_evaluated: 'Module Evaluated in this Exam',
          btn_cancel_sub: '✕ Cancel',
          btn_cancel_call: '✕ Cancel',
          title_duplicate: 'Duplicate to test another date strategy',
          title_rename: 'Rename or change icon',
          title_delete: 'Delete current session',
          title_manage_subjects: 'Manage subjects, exam calls, or import schedules',
          title_load_plan: 'Load or import exam plan (JSON, AI, file)',
          title_help: 'Guide and feature explanation',
          title_theme_toggle: 'Toggle light or dark theme',
          title_lang_toggle: 'Switch Language / Cambiar Idioma',
          title_session_dropdown: 'Switch session or manage calendars',
          placeholder_day_note: 'E.g. Review topics 1-3, mock exam...',
          placeholder_session_name: 'E.g. ❄️ Winter Session, ☀️ Summer, 🎓 AI Master...',
          lbl_session_name: 'Session / Calendar Name',
          lbl_session_icon: 'Session Icon',
          hint_session_emoji: 'Select or type any emoji',
          lbl_selected_emoji: 'Selected emoji:',
          hint_custom_emoji: '(customizable manually if you prefer)',
          lbl_session_init_content: 'Initial Subject Content:',
          session_init_copy_title: 'Duplicate subjects from current session',
          session_init_copy_hint: 'Copies subjects and calls to compare strategies.',
          session_init_copy_named: (name) => `Copies subjects and calls from "${name}".`,
          session_init_sample_title: 'Load sample university template',
          session_init_sample_hint: 'Sample subjects with multiple exam calls to plan.',
          session_init_empty_title: 'Blank calendar (empty)',
          session_init_empty_hint: 'Start from scratch and add or import your subjects.',
          btn_save_session: 'Save Session',
          presets_default_opt: '⚙️ Strategy Presets...',
          subject_prefix: (name) => `Subject: ${name}`,
          confirm_delete_subject: (name) => `Delete subject "${name}" and all its scheduled calls?`,
          confirm_delete_call: 'Delete this exam call?',
          alert_enter_subject_name: 'Please enter the subject name.',
          alert_min_one_module: 'The subject must have at least one module.',
          alert_valid_date: 'Please select a valid exam date.',
          alert_session_name_required: 'Please provide a name for the session.',
          toast_session_saved: 'Session updated successfully.',
          toast_meta_saved: 'Degree details updated successfully.',
          delete_single_session_disabled_title: 'Cannot delete the only available session',
          diff_high_opt: 'High (5/5)',
          diff_medium_opt: 'Medium (3/5)',
          diff_low_opt: 'Low (1/5)'
        },
        it: {
          lang_code: 'IT',
          lang_toggle_target: 'ES',
          brand_subtitle: 'Pianificatore Intelligente di Esami',
          session_label: 'Sessione',
          my_sessions_title: 'I Miei Calendari e Sessioni',
          new_session_btn: '+ Nuova Sessione',
          btn_duplicate: 'Duplica',
          btn_rename: 'Rinomina',
          btn_manage_subjects: 'Gestisci Materie',
          btn_load_plan: 'Carica Piano',
          btn_ai_prompt: 'Prompt IA',
          btn_markdown: 'Markdown',
          btn_help: 'Aiuto',
          help_modal_title: 'Guida all\'Uso e Funzioni',
          help_modal_subtitle: 'Spiegazione chiara di ogni pulsante e pannello del pianificatore.',
          btn_understand: 'Ho capito',
          help_sec_sessions_title: 'Gestione Sessioni e Calendari',
          help_sec_toolbar_title: 'Barra degli Strumenti Superiore',
          help_sec_opt_title: 'Motori di Ottimizzazione e Selezione',
          help_sec_sliders_title: 'Ponderazione per Materia (Slider di Difficoltà)',
          help_sec_calendar_title: 'Calendario Interattivo e Pianificazione Giorni',
          help_sec_timeline_title: 'Metriche (KPI), Avvisi e Agenda Cronologica',
          help_sec_manage_title: 'Pannello di Gestione Materie',
          help_html_content: `
            <section class="space-y-2">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>📅</span> <span>Gestione Sessioni e Calendari</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Menu Sessione:</strong> Mostra il nome e l'icona del calendario attivo. Clicca per aprire l'elenco delle sessioni disponibili.</p>
                <p><strong>Cambia Sessione:</strong> Clicca su qualsiasi sessione della lista per cambiare calendario istantaneamente senza perdere i dati.</p>
                <p><strong>+ Nuova Sessione:</strong> Crea un nuovo calendario da zero, copiando le materie attuali o caricando un modello di esempio.</p>
                <p><strong>Duplica:</strong> Crea una copia identica del calendario attivo con tutti gli appelli e le note per testare strategie alternative.</p>
                <p><strong>Rinomina:</strong> Modifica il nome o scegli un'icona emoji a tema per identificare facilmente il calendario.</p>
                <p><strong>Elimina:</strong> Rimuove la sessione attiva se non più necessaria (il sistema mantiene sempre almeno un calendario).</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>⚡</span> <span>Barra degli Strumenti Superiore</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>🌐 Lingua (ES / EN / IT):</strong> Cambia all'istante tutti i testi, i pannelli e gli avvisi tra Spagnolo, Inglese e Italiano.</p>
                <p><strong>Gestisci Materie:</strong> Apre il pannello per aggiungere materie, modificare orari, aule, difficoltà o importare/esportare dati.</p>
                <p><strong>Carica Piano:</strong> Apre il selettore file per caricare un <code>.json</code>, <code>.md</code> o <code>.txt</code>. Puoi anche trascinare il file direttamente nella pagina.</p>
                <p><strong>Prompt IA:</strong> Copia negli appunti un prompt ottimizzato con lo schema esatto per far estrarre gli appelli a un'IA (ChatGPT, Claude, Gemini) da screenshot o foto.</p>
                <p><strong>Markdown:</strong> Copia un riepilogo strutturato dei tuoi esami in formato Markdown per Obsidian o Notion.</p>
                <p><strong>❓ Aiuto:</strong> Apre questa guida esplicativa con i dettagli di ogni funzione e pulsante.</p>
                <p><strong>Modalità Chiara / Scura:</strong> Alterna il tema chiaro e scuro memorizzando la tua preferenza.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🎯</span> <span>Motori di Ottimizzazione e Selezione</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Massimizza Distanza:</strong> Trova automaticamente la combinazione di date con la massima distanza minima tra gli esami, distribuendoli in modo equilibrato.</p>
                <p><strong>Ottimizza con Slider di Difficoltà:</strong> Calcola la migliore distribuzione assegnando più giorni di studio preliminare ai moduli più impegnativi.</p>
                <p><strong>🛡️ Rete di Sicurezza (Appelli di riserva):</strong> Dà priorità ai primi appelli per conservare appelli successivi di recupero in caso di necessità.</p>
                <p><strong>Seleziona Tutto / Cancella Tutto:</strong> Attiva o disattiva tutti gli appelli disponibili con un clic.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🎚️</span> <span>Ponderazione per Materia (Slider di Difficoltà)</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Slider da 1 a 5:</strong> Regola la difficoltà o priorità di ciascun modulo. Sposta a destra (4-5) per gli esami più complessi che richiedono più giorni di studio.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🗓️</span> <span>Calendario Interattivo e Pianificazione Giorni</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Clic su un esame:</strong> Attiva o disattiva quello specifico appello nel tuo piano.</p>
                <p><strong>Clic su una cella giorno:</strong> Alterna la selezione degli esami di quel giorno. Nei giorni liberi apre la finestra di pianificazione giornaliera.</p>
                <p><strong>Icona ✏️ del giorno:</strong> Apre la finestra di pianificazione per contrassegnare il giorno come:</p>
                <ul class="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                  <li><strong>🟢 Giorno Normale / Libero:</strong> Giorno standard disponibile per lo studio.</li>
                  <li><strong>🚫 Giorno Bloccato:</strong> Giorno non disponibile (viaggi, impegni). Viene sottratto dai giorni utili di studio.</li>
                  <li><strong>📖 Giorno Dedicato:</strong> Colora il giorno con la materia scelta e una nota per organizzare il ripasso.</li>
                </ul>
                <p><strong>Schede Mese:</strong> Permettono di passare dalla vista di tutti i mesi a un mese specifico.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>📊</span> <span>Metriche (KPI), Avvisi e Agenda Cronologica</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Esami Coperti:</strong> Indica quanti moduli obbligatori hanno almeno un appello selezionato.</p>
                <p><strong>Collo di Bottiglia:</strong> Indica il margine minimo di giorni liberi tra due esami consecutivi.</p>
                <p><strong>Margine Medio:</strong> Media dei giorni liberi tra prove consecutive.</p>
                <p><strong>Avvisi e Conflitti:</strong> Rileva sovrapposizioni orarie, esami nello stesso giorno o recuperi inferiori a 24 ore.</p>
                <p><strong>Agenda Cronologica:</strong> Elenca gli esami in ordine cronologico con giorni liberi, aula, note e appelli di riserva.</p>
              </div>
            </section>
            <section class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>⚙️</span> <span>Pannello di Gestione Materie</span>
              </h3>
              <div class="space-y-1.5 text-slate-600 dark:text-slate-300">
                <p><strong>Scheda Materie:</strong> Aggiungi materie, abbreviazioni, moduli, colori e appelli con data, ora, durata, aula e scadenza iscrizione.</p>
                <p><strong>Scheda Importa / Esporta:</strong> Incolla testo o JSON, carica file, esporta su Google/Apple Calendar (.ics), scarica backup JSON o ripristina i dati.</p>
                <p><strong>Scheda Corso di Studi:</strong> Personalizza il titolo del corso di laurea, università, anno accademico e sessione.</p>
              </div>
            </section>
          `,
          opt_engine_title: 'Motori di Ottimizzazione',
          opt_engine_desc: 'Trova automaticamente la migliore combinazione di appelli per massimizzare i giorni di studio ed evitare sovrapposizioni.',
          btn_max_spacing: 'Massimizza Distanza',
          btn_prioritize_difficulty: 'Ottimizza con Slider di Difficoltà',
          btn_safety_toggle: '🛡️ Rete di Sicurezza (Appelli di riserva)',
          safety_toggle_desc: 'Dà priorità ai primi appelli disponibili per conservare appelli successivi di recupero se necessario.',
          btn_select_all: 'Seleziona Tutto',
          btn_clear_selection: 'Cancella Tutto',
          subject_weights_title: 'Ponderazione per Materia',
          subject_weights_desc: 'Aumenta la difficoltà sui moduli più impegnativi affinché il pianificatore riservi più giorni di preparazione.',
          calendar_title: 'Calendario della Sessione',
          calendar_desc: 'Clicca su un giorno o esame per selezionarlo. Nei giorni liberi o cliccando ✏️ puoi bloccare giorni o assegnare materie di studio.',
          legend_active: 'Attivo',
          legend_inactive: 'Inattivo',
          legend_conflict: 'Conflitto',
          all_months: 'Tutti i mesi',
          calls_label: 'appelli',
          kpi_exams_covered: 'Esami Coperti',
          kpi_exams_unit: 'obbligatori',
          kpi_bottleneck: 'Collo di Bottiglia (Min. Giorni)',
          kpi_free_days: 'giorni liberi',
          kpi_bottleneck_hint: 'Margine minimo tra 2 esami',
          kpi_avg_buffer: 'Margine Medio',
          kpi_avg_buffer_unit: 'giorni / esame',
          kpi_conflicts: 'Conflitti e Avvisi',
          kpi_conflicts_none: 'Nessun conflitto o avviso',
          section_calendar: 'Calendario Appelli',
          section_timeline: 'Linea Temporale Esami',
          section_alerts: 'Avvisi di Pianificazione',
          timeline_title: 'Agenda Cronologica & Margine di Studio',
          timeline_desc: 'Sequenza temporale con giorni di studio e scadenze di iscrizione.',
          exams_label: 'Esami',
          no_exams_selected: 'Nessun esame selezionato.',
          no_exams_selected_hint: 'Usa il pulsante "Massimizza Distanza" o clicca sugli appelli nel calendario.',
          optimal_buffer: 'Margine Ottimale (≥ 7 giorni)',
          acceptable_buffer: 'Accettabile (3-6 giorni)',
          risk_buffer: 'Rischio! (< 3 giorni)',
          collision_buffer: '0 giorni (Stesso giorno / Conflitto)',
          rest_days_suffix: 'giorni di studio',
          free_day_singular: 'giorno libero',
          free_days_plural: 'giorni liberi',
          deadline_open: (d) => `Iscrizione aperta (${d} giorni rimasti)`,
          deadline_today: 'Ultimo giorno per iscriversi oggi!',
          deadline_closed: (d) => `Iscrizione chiusa (${d})`,
          deadline_prefix: 'Scadenza:',
          parachute_singular: '1 appello di riserva successivo',
          parachute_plural: (n) => `${n} appelli di riserva successivi`,
          parachute_none: 'Ultimo appello (nessuna riserva)',
          parachute_title_has: 'Hai appelli successivi disponibili per ripetere questo esame se necessario',
          parachute_title_none: 'Ultimo appello programmato in questa sessione',
          module_label: 'Modulo:',
          location_tbd: 'Aula da definire',
          variance_prefix: 'Varianza:',
          variance_hint_good: 'Distribuzione equilibrata',
          variance_hint_uneven: 'Distribuzione irregolare',
          alerts_critical_title: 'Conflitto Critico di Orario',
          alerts_warning_title: 'Avvisi di Pianificazione',
          alerts_check_collisions: 'Controlla gli appelli in conflitto',
          conflicts_collisions: (n) => `${n} sovrapposizione/i oraria/e`,
          conflicts_warnings: (n) => `${n} avviso/i rilevato/i`,
          day_dialog_title: 'Pianifica Giorno',
          day_dialog_subtitle: 'Disponibilità o materia di studio per questo giorno.',
          day_dialog_status_label: 'Stato di Disponibilità:',
          day_status_normal: 'Giorno Normale / Libero',
          day_status_normal_hint: 'Nessun blocco o assegnazione fissa.',
          day_status_blocked: 'Giorno Non Disponibile / Bloccato',
          day_status_blocked_hint: 'Non puoi studiare. Sottratto dal margine utile di studio.',
          day_status_study: 'Giorno Dedicato a Materia',
          day_status_study_hint: 'Colora il giorno con il colore della materia scelta.',
          day_subject_label: 'Materia da Preparare:',
          day_note_label: 'Nota o Obiettivo (opzionale):',
          btn_clear: 'Ripristina Giorno',
          btn_cancel: 'Annulla',
          btn_save: 'Salva',
          day_blocked_badge: 'Bloccato',
          day_study_badge: 'Studio',
          day_click_hint: 'Clicca per pianificare il giorno',
          call_click_hint: 'Clicca per attivare/disattivare appello',
          select_2_exams: 'Seleziona almeno 2 esami',
          uncovered_alert_title: 'Esami in attesa di pianificazione',
          uncovered_alert_desc: (count, list) => `Mancano ${count} modulo/i obbligatorio/i da pianificare: ${list}.`,
          toast_day_saved: 'Piano giornaliero salvato con successo.',
          toast_day_cleared: 'Giorno ripristinato a normale.',
          modules_unit: 'moduli',
          module_singular: 'modulo',
          exam_count_badge: (n) => `${n} esami`,
          btn_reset_all_sessions: 'Ripristina modello predefinito',
          alerts_label: 'avvisi',
          kpi_no_conflicts: 'Nessun conflitto o avviso',
          menu_upload_file: 'Carica file (.json, .md, .txt)',
          menu_paste_text: 'Incolla testo o JSON',
          menu_copy_prompt: 'Prompt IA (Copia modello)',
          menu_copy_md: 'Copia riepilogo Markdown',
          menu_download_json: 'Scarica copia JSON',
          opt_auto_badge: 'Automatico',
          difficulty_range_label: 'Difficoltà (1 a 5)',
          drop_title: 'Rilascia qui il tuo file',
          drop_subtitle: 'Caricamento automatico di file .json, .md o .txt (README generato da IA)',
          drop_badge: '✨ Elaborazione e salvataggio istantanei',
          session_active_badge: 'Attiva',
          subjects_unit: 'materie',
          session_modal_title_new: 'Nuova Sessione d\'Esame',
          session_modal_subtitle_new: 'Crea un calendario indipendente per organizzare un\'altra sessione o corso di laurea.',
          btn_create_session: 'Crea Sessione',
          session_modal_title_edit: 'Modifica Informazioni Sessione',
          session_modal_subtitle_edit: 'Modifica il nome e l\'icona rappresentativa di questo calendario.',
          empty_calendar_title: 'Nessun appello in calendario',
          empty_calendar_desc: 'Clicca su "Gestisci Materie" per aggiungere esami o importare i tuoi dati.',
          conflict_collision_title: (s1, s2) => `Sovrapposizione Oraria: ${s1} vs ${s2}`,
          conflict_collision_desc: (d, t1, t2) => `Sovrapposizione diretta il ${d} tra le ${t1} e le ${t2}. Impossibile sostenere entrambi.`,
          conflict_congestion_title: (d) => `Sovraccarico Giornaliero il ${d}`,
          conflict_congestion_desc: (s1, t1, s2, t2) => `${s1} (${t1}) e ${s2} (${t2}) coincidono nella stessa giornata.`,
          conflict_turnaround_title: 'Recupero Critico (< 24h)',
          conflict_turnaround_desc: (h, s1, s2) => `Solo ${h} ore di riposo tra ${s1} e ${s2}.`,
          conflict_multi_title: (m) => `Appello di Riserva: ${m}`,
          conflict_multi_desc: (n) => `Hai selezionato ${n} appelli attivi per questo stesso modulo.`,
          manage_modal_title: 'Gestione Universale Materie & Appelli',
          manage_modal_subtitle: 'Personalizza le tue materie, aggiungi appelli o importa piani completi per qualsiasi corso universitario.',
          tab_subjects: '📚 Materie & Appelli',
          tab_import: '📥 Importa / Esporta',
          tab_meta: '🏛️ Dati Corso di Studi',
          manage_subjects_hint: ' • Modifica o aggiungi gli appelli di ogni esame',
          btn_new_subject: 'Nuova Materia',
          subject_form_title_edit: 'Modifica Materia',
          no_subjects_configured: 'Nessuna materia configurata.',
          no_subjects_hint: 'Clicca su "Nuova Materia" per aggiungere il primo esame o vai alla scheda Importa.',
          diff_high_badge: 'Difficoltà Alta (5/5)',
          diff_medium_badge: 'Difficoltà Media (3/5)',
          diff_low_badge: 'Difficoltà Bassa (1/5)',
          no_calls_registered: 'Nessun appello registrato. Aggiungine uno per includerlo nel calendario.',
          btn_edit: 'Modifica',
          btn_delete: 'Elimina',
          modules_label: 'Moduli:',
          btn_add_call: '+ Appello',
          lbl_mod_name: 'Nome del Modulo *',
          lbl_mod_short: 'Abbreviazione *',
          lbl_mod_diff: 'Difficoltà',
          lbl_mod_credits: 'Crediti (CFU)',
          call_form_title_new: 'Nuovo Appello d\'Esame',
          call_form_title_edit: 'Modifica Appello',
          lbl_sub_name: 'Nome della Materia *',
          lbl_sub_code: 'Codice (Opzionale)',
          lbl_sub_diff: 'Difficoltà Base',
          lbl_sub_color: 'Colore Identificativo',
          lbl_sub_modules: 'Moduli / Parti della Materia',
          btn_add_module: '+ Aggiungi Modulo',
          btn_save_subject: 'Salva Materia',
          lbl_call_date: 'Data dell\'Esame *',
          lbl_call_time: 'Ora di Inizio',
          lbl_call_duration: 'Durata (Ore)',
          lbl_call_deadline: 'Scadenza Iscrizione',
          lbl_call_location: 'Aula / Sede',
          lbl_call_notes: 'Note / Modalità',
          lbl_call_status: 'Stato Selezione',
          opt_call_active: 'Attivo (Selezionato nel piano)',
          opt_call_inactive: 'Disattivato (Non selezionato)',
          status_active: 'Attivo',
          status_inactive: 'Disattivato',
          toast_json_downloaded: 'Piano scaricato in JSON con appelli attivi!',
          toast_json_copied: 'Piano JSON copiato negli appunti con appelli attivi!',
          btn_save_call: 'Salva Appello',
          conflict_precedence_title: (m) => `Violazione di Precedenza: ${m}`,
          conflict_precedence_desc: (dOral, dWritten) => `L'esame orale (${dOral}) deve essere sostenuto obbligatoriamente dopo lo scritto (${dWritten}).`,
          conflict_binding_title: (m) => `Vincolo d'Appello Violato: ${m}`,
          conflict_binding_desc: (wApp, oApp) => `Questa materia richiede l'orale nello stesso appello dello scritto (scritto nell'Appello ${wApp}, orale nell'Appello ${oApp}).`,
          conflict_missing_written_title: (m) => `Manca lo Scritto Propedeutico: ${m}`,
          conflict_missing_written_desc: 'Hai selezionato l\'esame orale senza aver scelto il corrispondente esame scritto propedeutico per questo modulo.',
          lbl_mod_eval_mode: 'Modalità di Valutazione',
          eval_mode_standard: 'Standard (1 esame)',
          eval_mode_written_oral: 'Scritto + Orale',
          eval_mode_written_lab: 'Scritto + Laboratorio',
          lbl_has_modules: 'Questa materia è divisa in moduli',
          badge_no_modules: 'Senza moduli',
          lbl_subject_eval_mode: 'Modalità di Valutazione',
          lbl_mod_oral_binding: 'Vincolo dell\'Orale',
          binding_same_appello: 'Stesso Appello obbligatorio',
          binding_any_subsequent: 'Stesso o qualsiasi Appello successivo',
          lbl_call_type: 'Tipo di Esame',
          type_standard: 'Generale / Standard',
          type_written: 'Scritto',
          type_oral: 'Orale',
          type_lab: 'Laboratorio / Progetto',
          lbl_call_appello: 'Nº Appello',
          badge_written: 'Scritto',
          badge_oral: 'Orale',
          badge_lab: 'Lab',
          badge_appello: (n) => `Appello ${n}`,
          import_sec_title: 'Importa Dati Universitari (JSON, Output IA o Markdown)',
          import_guide_title: 'Come caricare i tuoi esami automaticamente con l\'IA',
          import_guide_subtitle: 'Estrai materie, date, orari e aule direttamente da foto, screenshot o PDF in 3 semplici passaggi.',
          step1_title: 'Passo 1: Copia Prompt IA',
          step1_desc: 'Copia il template con le istruzioni e il formato che il pianificatore richiede.',
          step2_title: 'Passo 2: Genera con l\'IA',
          step2_desc: 'Apri ChatGPT, Claude o Gemini, incolla il prompt e allega le tue foto o elenco esami.',
          step3_title: 'Passo 3: Incolla risultato e Importa',
          step3_desc: 'Incolla la risposta dell\'IA nella casella sottostante e clicca su "Elabora e Importa Piano".',
          badge_guided_fast: '⚡ Rapido e Guidato',
          step_badge_ready: '✓ Pronto in 1 clic',
          import_sec_desc: 'Trascina il file, incolla lo schema JSON o incolla la risposta completa generata da un\'IA (anche con blocchi ```json).',
          import_dest_label: 'Destinazione del piano importato:',
          import_dest_new: '✨ Crea automaticamente una nuova sessione',
          btn_copy_ai_template: 'Copia Modello Prompt IA',
          btn_sample_md: '📋 Carica Esempio Markdown',
          btn_select_file: '📂 Seleziona File',
          btn_run_import: 'Elabora e Importa Piano',
          export_sec_title: 'Esporta Configurazione',
          reset_sec_title: 'Ripristina Dati',
          meta_sec_title: 'Informazioni Corso di Studi e Sessione',
          lbl_meta_title: 'Titolo Corso di Studi / Sessione',
          lbl_meta_inst: 'Università / Istituzione',
          lbl_meta_year: 'Anno Accademico',
          lbl_meta_session: 'Nome della Sessione',
          lbl_meta_icon: 'Icona / Emoji della Sessione',
          btn_save_meta: 'Salva Dati Corso',
          step_1_badge: 'Passo 1',
          step_2_badge: 'Passo 2',
          step_3_badge: 'Passo 3',
          dropzone_prompt: 'Trascina qui il tuo file <span class="text-indigo-600 dark:text-indigo-400 underline">.json, .md o .txt</span> oppure clicca per selezionarlo',
          dropzone_hint: 'Rilevamento automatico di blocchi JSON, pulizia dei commenti e tabelle Markdown',
          import_dest_overwrite: 'Sovrascrivi sessione attiva',
          import_textarea_placeholder: 'Oppure incolla direttamente qui il JSON o l\'output dell\'IA (inclusi blocchi ```json ... ``` o tabelle)...',
          export_sec_desc: 'Scarica il JSON aggiornato per il backup o per l\'uso su altri dispositivi.',
          btn_download_json: 'Scarica JSON',
          btn_copy_json: 'Copia JSON',
          reset_sec_desc: 'Cancella le modifiche salvate in localStorage e ripristina il piano originale.',
          btn_reset_storage: 'Ripristina ai Dati Predefiniti',
          toast_prompt_copied: '✓ Modello prompt IA copiato negli appunti! Incollalo in un\'IA insieme ai tuoi screenshot.',
          toast_prompt_copied_simple: '✓ Modello prompt IA copiato negli appunti!',
          alert_copy_failed: 'Impossibile copiare automaticamente negli appunti.',
          toast_new_session_imported: (icon, name, subs, calls) => `Nuova sessione "${icon} ${name}" creata! (${subs} materie, ${calls} appelli).`,
          toast_session_imported_active: (subs, calls) => `Piano caricato nella sessione attiva! (${subs} materie, ${calls} appelli).`,
          toast_image_pdf_uploaded: 'ℹ️ Hai caricato un\'immagine o PDF. Copia il modello con il pulsante "Prompt IA", invialo a ChatGPT/Gemini insieme ai tuoi screenshot e trascina qui il JSON o Markdown risultante.',
          toast_file_read_error: (name) => `Errore durante la lettura del file ${name}.`,
          confirm_reset_storage: 'Ripristinare il pianificatore ai dati di fabbrica? Tutte le sessioni e le materie aggiunte nel browser andranno perse.',
          toast_markdown_copied: '✓ Riepilogo Markdown copiato negli appunti!',
          alert_no_exams_export_ics: 'Nessun esame selezionato da esportare.',
          lbl_sub_acronym: 'Abbreviazione / Acronimo',
          hint_sub_acronym: '(es. FAI, ML, SO, FP — visibile nel calendario e slider)',
          hint_sub_modules: 'Assegna a ogni modulo nome e abbreviazione (es. M1, M2, Teoria, Lab) da mostrare nella UI.',
          lbl_call_mod_evaluated: 'Modulo Valutato in questo Esame',
          btn_cancel_sub: '✕ Annulla',
          btn_cancel_call: '✕ Annulla',
          title_duplicate: 'Duplica per testare un\'altra combinazione di date',
          title_rename: 'Rinomina o cambia icona',
          title_delete: 'Elimina sessione corrente',
          title_manage_subjects: 'Gestisci materie, appelli o importa piani',
          title_load_plan: 'Carica o importa piano esami (JSON, IA, file)',
          title_help: 'Guida e spiegazione delle funzioni',
          title_theme_toggle: 'Cambia tema chiaro o scuro',
          title_lang_toggle: 'Cambia Lingua / Switch Language',
          title_session_dropdown: 'Cambia sessione o gestisci calendari',
          placeholder_day_note: 'Es: Ripassare capitoli 1-3, simulazione...',
          placeholder_session_name: 'Es: ❄️ Sessione Invernale, ☀️ Estiva, 🎓 Laurea AI...',
          lbl_session_name: 'Nome della Sessione / Calendario',
          lbl_session_icon: 'Icona della Sessione',
          hint_session_emoji: 'Seleziona o digita qualsiasi emoji',
          lbl_selected_emoji: 'Emoji selezionata:',
          hint_custom_emoji: '(personalizzabile a mano se preferisci)',
          lbl_session_init_content: 'Contenuto Iniziale delle Materie:',
          session_init_copy_title: 'Duplica materie dalla sessione corrente',
          session_init_copy_hint: 'Copia materie e appelli per confrontare strategie.',
          session_init_copy_named: (name) => `Copia materie e appelli da "${name}".`,
          session_init_sample_title: 'Carica modello universitario di esempio',
          session_init_sample_hint: 'Materie di prova con appelli multipli da pianificare.',
          session_init_empty_title: 'Calendario vuoto',
          session_init_empty_hint: 'Inizia da zero e aggiungi o importa le tue materie.',
          btn_save_session: 'Salva Sessione',
          presets_default_opt: '⚙️ Preset Strategici...',
          subject_prefix: (name) => `Materia: ${name}`,
          confirm_delete_subject: (name) => `Eliminare la materia "${name}" e tutti i suoi appelli?`,
          confirm_delete_call: 'Eliminare questo appello?',
          alert_enter_subject_name: 'Inserisci il nome della materia.',
          alert_min_one_module: 'La materia deve avere almeno un modulo.',
          alert_valid_date: 'Seleziona una data valida per l\'esame.',
          alert_session_name_required: 'Inserisci un nome per la sessione.',
          toast_session_saved: 'Sessione aggiornata con successo.',
          toast_meta_saved: 'Dati del corso aggiornati con successo.',
          delete_single_session_disabled_title: 'Impossibile eliminare l\'unica sessione disponibile',
          diff_high_opt: 'Alta (5/5)',
          diff_medium_opt: 'Media (3/5)',
          diff_low_opt: 'Bassa (1/5)'
        }
      };

      function getLang() {
        return (typeof state !== 'undefined' && state.lang) ? state.lang : 'es';
      }

      function t(key, ...args) {
        const lang = getLang();
        const dict = I18N[lang] || I18N.es;
        const val = dict[key];
        if (typeof val === 'function') return val(...args);
        return val !== undefined ? val : (I18N.es[key] || key);
      }

      function renderHelpContent() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('help-modal-body');
        if (!container) return;
        const lang = getLang();
        const dict = I18N[lang] || I18N.es;
        if (dict.help_html_content) {
          container.innerHTML = replaceEmojisWithIcons(dict.help_html_content, 'w-3.5 h-3.5 inline-block shrink-0 -mt-0.5');
        }
      }

      function applyI18n() {
        const lang = getLang();
        const dict = I18N[lang] || I18N.es;
        const labelEl = document.getElementById('lang-label');
        if (labelEl) labelEl.textContent = dict.lang_toggle_target;

        if (typeof document !== 'undefined') {
          if (document.documentElement) document.documentElement.lang = lang;
          document.querySelectorAll('[data-i18n]').forEach(el => {
            const k = el.getAttribute('data-i18n');
            if (dict[k] && typeof dict[k] === 'string') {
              const renderedVal = replaceEmojisWithIcons(dict[k], 'w-3.5 h-3.5 inline-block shrink-0 -mt-0.5');
              if (renderedVal.includes('<')) {
                el.innerHTML = renderedVal;
              } else {
                el.textContent = renderedVal;
              }
            }
          });
          document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const k = el.getAttribute('data-i18n-placeholder');
            if (dict[k] && typeof dict[k] === 'string') {
              el.placeholder = dict[k];
            }
          });
          document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const k = el.getAttribute('data-i18n-title');
            if (dict[k] && typeof dict[k] === 'string') {
              el.title = dict[k];
            }
          });
          document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const k = el.getAttribute('data-i18n-aria-label');
            if (dict[k] && typeof dict[k] === 'string') {
              el.setAttribute('aria-label', dict[k]);
            }
          });
        }

        renderHelpContent();
      }

      function toggleLanguage() {
        const order = ['es', 'en', 'it'];
        const idx = order.indexOf(state.lang);
        state.lang = order[(idx + 1) % order.length];
        try {
          localStorage.setItem('examplan-lang', state.lang);
        } catch (e) {}
        applyI18n();
        if (typeof renderPresets === 'function') renderPresets();
        if (typeof renderSliders === 'function') renderSliders();
        updateApp();
        if (typeof renderModalSubjects === 'function') renderModalSubjects();
      }

      // Application Multi-Session State
      let sessions = [];
      let activeSessionId = null;
      let schedule = null;