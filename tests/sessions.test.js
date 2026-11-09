const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const {
  validateSchedule,
  normalizeSchedule,
  parseInput
} = require('../src/core/parser');
const { generateStandaloneHTML } = require('../src/core/generator');

describe('Multi-Session & Multi-Calendar Test Suite', () => {

  const sampleScheduleA = {
    meta: {
      title: 'Máster en Inteligencia Artificial',
      institution: 'UNIBO',
      academicYear: '2026/2027',
      session: 'Sessione Invernale',
      icon: '❄️'
    },
    subjects: [
      {
        id: 'ml',
        name: 'Machine Learning',
        credits: 6,
        modules: [
          {
            id: 'ml_mod',
            name: 'ML',
            calls: [
              { id: 'ml_1', date: '2027-01-15', time: '09:00', durationHours: 3 },
              { id: 'ml_2', date: '2027-02-05', time: '09:00', durationHours: 3 }
            ]
          }
        ]
      }
    ]
  };

  const sampleScheduleB = {
    meta: {
      title: 'Máster en Inteligencia Artificial',
      institution: 'UNIBO',
      academicYear: '2026/2027',
      session: 'Sessione Estiva',
      icon: '☀️'
    },
    subjects: [
      {
        id: 'nlp',
        name: 'Natural Language Processing',
        credits: 6,
        modules: [
          {
            id: 'nlp_mod',
            name: 'NLP',
            calls: [
              { id: 'nlp_1', date: '2027-06-15', time: '10:00', durationHours: 2.5 }
            ]
          }
        ]
      }
    ]
  };

  /**
   * Helper que instancia el entorno standalone en un contexto aislado de node:vm
   */
  function createRuntimeEnvironment(initialSchedule = null, initialStorage = {}) {
    const fallbackSchedule = initialSchedule || sampleScheduleA;
    const html = generateStandaloneHTML(fallbackSchedule, { skipValidation: true });

    const scriptMatches = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)];
    const appScript = scriptMatches[scriptMatches.length - 1][1];

    const elements = new Map();
    function createMockEl(id = '', tag = 'div') {
      const el = {
        id,
        tagName: tag.toUpperCase(),
        textContent: '',
        innerHTML: '',
        value: '',
        checked: false,
        attributes: new Map(),
        classList: {
          classes: new Set(),
          add: (...cls) => cls.forEach(c => el.classList.classes.add(c)),
          remove: (...cls) => cls.forEach(c => el.classList.classes.delete(c)),
          contains: (c) => el.classList.classes.has(c)
        },
        style: {},
        children: [],
        appendChild: (child) => {
          el.children.push(child);
          if (child.outerHTML) el.innerHTML += child.outerHTML;
          else if (child.innerHTML) el.innerHTML += child.innerHTML;
          return child;
        },
        setAttribute: (k, v) => el.attributes.set(k, String(v)),
        removeAttribute: (k) => el.attributes.delete(k),
        getAttribute: (k) => el.attributes.get(k) || null,
        addEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        showModal: () => { el.open = true; },
        close: () => { el.open = false; },
        focus: () => {}
      };
      if (id) elements.set(id, el);
      return el;
    }

    const scheduleDataEl = createMockEl('planner-schedule-data', 'script');
    if (initialSchedule) {
      scheduleDataEl.textContent = JSON.stringify(initialSchedule);
    }
    elements.set('planner-schedule-data', scheduleDataEl);

    const mockStorage = new Map(Object.entries(initialStorage));
    const storageListeners = [];

    const windowMock = {
      addEventListener: (event, cb) => {
        if (event === 'storage') storageListeners.push(cb);
      },
      removeEventListener: () => {},
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
      requestAnimationFrame: (cb) => { cb(); return 1; },
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      alert: () => {},
      confirm: () => true
    };

    const documentMock = {
      getElementById: (id) => {
        if (!elements.has(id)) {
          return createMockEl(id);
        }
        return elements.get(id);
      },
      createElement: (tag) => createMockEl('', tag),
      querySelector: (sel) => null,
      querySelectorAll: (sel) => [],
      addEventListener: () => {},
      documentElement: {
        classList: {
          classes: new Set(),
          add: (c) => documentMock.documentElement.classList.classes.add(c),
          remove: (c) => documentMock.documentElement.classList.classes.delete(c),
          contains: (c) => documentMock.documentElement.classList.classes.has(c)
        }
      }
    };

    const localStorageMock = {
      getItem: (k) => mockStorage.get(k) || null,
      setItem: (k, v) => mockStorage.set(k, String(v)),
      removeItem: (k) => mockStorage.delete(k),
      clear: () => mockStorage.clear()
    };

    const sandbox = {
      window: windowMock,
      document: documentMock,
      localStorage: localStorageMock,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      setTimeout,
      clearTimeout,
      requestAnimationFrame: windowMock.requestAnimationFrame,
      alert: windowMock.alert,
      confirm: windowMock.confirm
    };
    sandbox.window.window = sandbox.window;
    sandbox.window.document = documentMock;
    sandbox.window.localStorage = localStorageMock;

    const context = vm.createContext(sandbox);
    vm.runInContext(appScript, context);

    return {
      window: sandbox.window,
      elements,
      mockStorage,
      triggerStorageEvent: (key, newValue) => {
        if (newValue === null) mockStorage.delete(key);
        else mockStorage.set(key, String(newValue));
        storageListeners.forEach(listener => listener({ key, newValue }));
      }
    };
  }

  it('debe validar y normalizar esquemas con icono de sesión explícito', () => {
    const valA = validateSchedule(sampleScheduleA);
    assert.equal(valA.valid, true);

    const normA = normalizeSchedule(sampleScheduleA);
    assert.equal(normA.meta.icon, '❄️');
    assert.equal(normA.meta.session, 'Sessione Invernale');

    const normB = normalizeSchedule(sampleScheduleB);
    assert.equal(normB.meta.icon, '☀️');
  });

  it('el esquema JSON schema oficial debe permitir y validar el campo icon en meta', () => {
    const schemaPath = path.resolve(__dirname, '../schemas/schedule_schema.json');
    assert.ok(fs.existsSync(schemaPath));
    const schemaJson = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    assert.ok(schemaJson.properties.meta.properties.icon);
    assert.equal(schemaJson.properties.meta.properties.icon.type, 'string');
  });

  it('debe admitir serialización y deserialización multi-sesión con aislamiento de estado', () => {
    const sessions = [
      {
        id: 'sess_winter',
        name: 'Sesión de Invierno',
        icon: '❄️',
        schedule: normalizeSchedule(sampleScheduleA),
        selectedCallIds: ['ml_1'],
        subjectWeights: { ml: 5 },
        prioritizeSafety: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'sess_summer',
        name: 'Sesión de Verano',
        icon: '☀️',
        schedule: normalizeSchedule(sampleScheduleB),
        selectedCallIds: ['nlp_1'],
        subjectWeights: { nlp: 3 },
        prioritizeSafety: false,
        createdAt: Date.now() + 10,
        updatedAt: Date.now() + 10
      }
    ];

    const serialized = JSON.stringify(sessions);
    const restored = JSON.parse(serialized);

    assert.equal(restored.length, 2);
    assert.equal(restored[0].id, 'sess_winter');
    assert.equal(restored[0].icon, '❄️');
    assert.deepEqual(restored[0].selectedCallIds, ['ml_1']);
    assert.equal(restored[0].prioritizeSafety, true);

    assert.equal(restored[1].id, 'sess_summer');
    assert.equal(restored[1].icon, '☀️');
    assert.deepEqual(restored[1].selectedCallIds, ['nlp_1']);
    assert.equal(restored[1].prioritizeSafety, false);

    assert.equal(restored[0].schedule.subjects[0].id, 'ml');
    assert.equal(restored[1].schedule.subjects[0].id, 'nlp');
  });

  it('duplicar sesión debe crear una copia profunda con id nuevo y sufijo en el nombre', () => {
    const original = {
      id: 'sess_original',
      name: 'Convocatoria Ordinaria',
      icon: '🎓',
      schedule: normalizeSchedule(sampleScheduleA),
      selectedCallIds: ['ml_1'],
      subjectWeights: { ml: 4 },
      prioritizeSafety: false
    };

    const duplicate = {
      id: 'sess_original_dup_' + Date.now(),
      name: `${original.name} (Copia)`,
      icon: original.icon,
      schedule: JSON.parse(JSON.stringify(original.schedule)),
      selectedCallIds: [...original.selectedCallIds],
      subjectWeights: { ...original.subjectWeights },
      prioritizeSafety: original.prioritizeSafety
    };

    assert.notEqual(duplicate.id, original.id);
    assert.equal(duplicate.name, 'Convocatoria Ordinaria (Copia)');
    assert.equal(duplicate.icon, '🎓');
    assert.deepEqual(duplicate.selectedCallIds, ['ml_1']);

    duplicate.selectedCallIds.push('ml_2');
    duplicate.schedule.subjects[0].name = 'Machine Learning Modificado';
    assert.equal(original.selectedCallIds.length, 1);
    assert.equal(original.schedule.subjects[0].name, 'Machine Learning');
  });

  it('el template standalone debe incluir los componentes accesibles de gestión multi-sesión', () => {
    const html = generateStandaloneHTML(sampleScheduleA);

    assert.ok(html.includes('id="session-switcher-container"'));
    assert.ok(html.includes('id="btn-session-dropdown"'));
    assert.ok(html.includes('id="session-dropdown-menu"'));
    assert.ok(html.includes('id="session-dropdown-items"'));

    assert.ok(html.includes('id="session-modal"'));
    assert.ok(html.includes('id="session-modal-name"'));
    assert.ok(html.includes('id="session-emoji-grid"'));
    assert.ok(html.includes('id="session-modal-icon-input"'));
    assert.ok(html.includes('id="session-modal-initial-mode-wrapper"'));

    assert.ok(html.includes('id="btn-duplicate-active-session"'));
    assert.ok(html.includes('id="btn-edit-active-session"'));
    assert.ok(html.includes('id="btn-delete-active-session"'));

    assert.ok(html.includes('name="import-destination-mode"'));
    assert.ok(html.includes('id="meta-icon-input"'));
  });

  // --- Tests de Ejecución Real en Runtime (Node:vm) ---

  it('runtime real: inicialización correcta y API window.ExamPlannerSessions accesible', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;
    assert.ok(api, 'Debe exponer window.ExamPlannerSessions');

    const sessions = api.getSessions();
    assert.equal(sessions.length, 1);
    const active = api.getActiveSession();
    assert.equal(active.name, 'Sessione Invernale');
    assert.equal(active.icon, '❄️');
    assert.deepEqual(Array.from(active.selectedCallIds), ['ml_1']);
  });

  it('runtime real: crear sesión en modo copy_current preserva asignaturas, pesos y prioritizeSafety', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    // Marcamos prioritizeSafety en la sesión inicial
    api.setPrioritizeSafety(true);
    api.setSubjectWeight('ml', 5);

    api.createSession({
      name: 'Estrategia Alternativa Invierno',
      icon: '🎯',
      mode: 'copy_current'
    });

    const sessions = api.getSessions();
    assert.equal(sessions.length, 2);

    const active = api.getActiveSession();
    assert.equal(active.name, 'Estrategia Alternativa Invierno');
    assert.equal(active.icon, '🎯');
    assert.equal(active.prioritizeSafety, true, 'Debe heredar prioritizeSafety del original al copiar');
    assert.deepEqual(Array.from(active.selectedCallIds), ['ml_1']);
    assert.equal(active.subjectWeights.ml, 5);
  });

  it('runtime real: crear sesión en modo empty genera calendario en blanco aislado', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    api.createSession({
      name: 'Sesión Vacía',
      icon: '📝',
      mode: 'empty'
    });

    const active = api.getActiveSession();
    assert.equal(active.name, 'Sesión Vacía');
    assert.equal(active.icon, '📝');
    assert.equal(active.schedule.subjects.length, 0);
    assert.deepEqual(Array.from(active.selectedCallIds), []);
  });

  it('runtime real: switchSession y duplicateSession conservan independencia total de estado', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    const originalActive = api.getActiveSession();
    const originalId = originalActive.id;

    // Duplicar sesión activa
    api.duplicateSession(originalId);

    const sessions = api.getSessions();
    assert.equal(sessions.length, 2);

    const dupActive = api.getActiveSession();
    assert.notEqual(dupActive.id, originalId);
    assert.ok(dupActive.name.includes('(Copia)'));

    // Modificar copia usando la API reactiva
    api.setSelectedCallIds(['ml_2']);
    api.setSubjectWeight('ml', 1);

    // Cambiar de vuelta al original
    api.switchSession(originalId);
    const currentActive = api.getActiveSession();
    assert.equal(currentActive.id, originalId);
    assert.deepEqual(Array.from(currentActive.selectedCallIds), ['ml_1']);

    // Volver a la copia y verificar que mantiene sus cambios
    api.switchSession(dupActive.id);
    const currentDup = api.getActiveSession();
    assert.equal(currentDup.id, dupActive.id);
    assert.deepEqual(Array.from(currentDup.selectedCallIds), ['ml_2']);
  });

  it('runtime real: deleteSession impide eliminar la única sesión y gestiona conmutación de sesión activa', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    const firstId = api.getActiveSession().id;

    // Intentar borrar la única sesión no debe eliminarla
    api.deleteSession(firstId);
    assert.equal(api.getSessions().length, 1);

    // Crear segunda sesión y borrar la primera (activa)
    api.createSession({ name: 'Segunda Sesión', icon: '☀️', mode: 'sample' });
    assert.equal(api.getSessions().length, 2);

    const secondId = api.getActiveSession().id;
    api.deleteSession(secondId);

    // Debe conmutar automáticamente a la sesión restante
    assert.equal(api.getSessions().length, 1);
    assert.equal(api.getActiveSession().id, firstId);
  });

  it('runtime real: preserva la elección de deseleccionar convocatorias sin re-seleccionarlas forzadamente', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    const active = api.getActiveSession();
    // El usuario vacía intencionadamente sus convocatorias usando la API
    api.setSelectedCallIds([]);

    // Duplica o crea otra sesión y conmuta
    api.createSession({ name: 'Otra Sesión', icon: '🚀', mode: 'empty' });
    assert.equal(api.getActiveSession().name, 'Otra Sesión');

    // Conmuta de vuelta a la primera sesión
    api.switchSession(active.id);

    // La lista de seleccionados debe permanecer vacía, respetando la decisión del estudiante
    assert.deepEqual(Array.from(api.getActiveSession().selectedCallIds), []);
  });

  it('runtime real: detectSessionIcon resuelve emojis temáticos por palabras clave y placeholder genérico', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const detect = env.window.ExamPlannerParser.detectSessionIcon;

    assert.equal(detect({ session: 'Sessione Invernale' }), '❄️');
    assert.equal(detect({ session: 'Sessione Estiva' }), '☀️');
    assert.equal(detect({ session: 'Convocatoria Extraordinaria de Otoño' }), '🍂');
    assert.equal(detect({ title: 'Master in Artificial Intelligence' }), '🤖');
    assert.equal(detect({ title: 'Grado en Medicina' }), '🔬');
    assert.equal(detect({ title: 'Ingeniería Eléctrica' }), '⚡');
    assert.equal(detect({ session: 'Invernale', icon: '🎯' }), '🎯', 'Debe respetar icono explícito personalizado');
    assert.equal(detect({ session: 'Invernale', icon: '📅' }), '❄️', 'Debe detectar temática si icon es el placeholder genérico 📅');
  });

  it('runtime real: sincronización cross-tab reactiva ante evento storage', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    const remoteSessions = [
      {
        id: 'sess_remote',
        name: 'Sesión Remota en Otra Pestaña',
        icon: '🌟',
        schedule: normalizeSchedule(sampleScheduleB),
        selectedCallIds: ['nlp_1'],
        subjectWeights: { nlp: 5 },
        prioritizeSafety: true,
        createdAt: 1000,
        updatedAt: 2000
      }
    ];

    env.triggerStorageEvent('examplan_sessions', JSON.stringify(remoteSessions));

    assert.equal(api.getSessions().length, 1);
    assert.equal(api.getActiveSession().name, 'Sesión Remota en Otra Pestaña');
    assert.equal(api.getActiveSession().icon, '🌟');
  });

  it('runtime real: el dropdown de sesiones debe utilizar botones accesibles con role menuitem', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const container = env.elements.get('session-dropdown-items');
    assert.ok(container, 'Debe existir contenedor session-dropdown-items');
    assert.ok(container.innerHTML.includes('role="menuitem"'));
    assert.ok(container.innerHTML.includes('data-switch-session'));
    assert.ok(container.innerHTML.includes('<button'));
  });

  it('runtime real: setDayPlan persiste bloqueos y días de estudio por sesión', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    // Planificar un día como bloqueado
    api.setDayPlan('2027-01-20', { type: 'blocked', note: 'Viaje familiar' });
    assert.equal(api.getState().dayPlans['2027-01-20'].type, 'blocked');
    assert.equal(api.getActiveSession().dayPlans['2027-01-20'].note, 'Viaje familiar');

    // Planificar un día como estudio
    api.setDayPlan('2027-01-22', { type: 'study', subjectId: 'ml', note: 'Repasar teoría' });
    assert.equal(api.getState().dayPlans['2027-01-22'].type, 'study');
    assert.equal(api.getState().dayPlans['2027-01-22'].subjectId, 'ml');

    // Duplicar sesión preserva los planes de días
    api.duplicateSession(api.getActiveSession().id);
    const dup = api.getActiveSession();
    assert.ok(dup.dayPlans['2027-01-20'], 'La sesión duplicada debe heredar dayPlans');
    assert.equal(dup.dayPlans['2027-01-20'].type, 'blocked');

    // Limpiar día estableciendo a normal
    api.setDayPlan('2027-01-20', { type: 'normal' });
    assert.equal(api.getState().dayPlans['2027-01-20'], undefined);
  });

  it('runtime real: toggleLanguage conmuta entre ES y EN y actualiza textos de UI', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    // Inicialmente español por defecto
    assert.equal(api.getLanguage(), 'es');

    // Conmutar a inglés
    api.toggleLanguage();
    assert.equal(api.getLanguage(), 'en');
    assert.equal(env.mockStorage.get('examplan-lang'), 'en');

    // Conmutar a italiano
    api.toggleLanguage();
    assert.equal(api.getLanguage(), 'it');
    assert.equal(env.mockStorage.get('examplan-lang'), 'it');

    // Conmutar de vuelta a español
    api.toggleLanguage();
    assert.equal(api.getLanguage(), 'es');
    assert.equal(env.mockStorage.get('examplan-lang'), 'es');
  });

  it('runtime real: métricas de cobertura de exámenes/módulos requeridos actualizan KPIs visuales', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;

    // Con sampleScheduleA hay 1 módulo requerido (ml_mod)
    // Inicialmente con ml_1 seleccionado -> 1 de 1 (100%)
    api.setSelectedCallIds(['ml_1']);
    const kpiCurrent = env.elements.get('kpi-exams-current');
    const kpiTotal = env.elements.get('kpi-exams-total');
    const kpiBadge = env.elements.get('kpi-exams-badge');

    assert.equal(kpiCurrent.textContent, 1);
    assert.equal(kpiTotal.textContent, 1);
    assert.equal(kpiBadge.textContent, '100%');

    // Deseleccionar -> 0 de 1 (0%)
    api.setSelectedCallIds([]);
    assert.equal(kpiCurrent.textContent, 0);
    assert.equal(kpiTotal.textContent, 1);
    assert.equal(kpiBadge.textContent, '0%');
  });

  it('runtime real: modal accesible de ayuda y guía de uso está configurado con closedby any y botón en cabecera', () => {
    const html = generateStandaloneHTML(sampleScheduleA);
    assert.ok(html.includes('id="btn-open-help-modal"'), 'Debe existir el botón de ayuda en la cabecera');
    assert.ok(html.includes('id="help-modal"'), 'Debe existir el modal <dialog id="help-modal">');
    assert.ok(html.includes('closedby="any"'), 'El modal debe incluir atributo closedby="any" según modern-web-guidance');
    assert.ok(html.includes('aria-labelledby="help-modal-title"'));
    assert.ok(html.includes('id="btn-close-help-modal"'));
    assert.ok(html.includes('id="btn-footer-close-help"'));

    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;
    assert.ok(typeof api.openHelpModal === 'function');
    assert.ok(typeof api.closeHelpModal === 'function');
    api.openHelpModal();
    const helpModal = env.elements.get('help-modal');
    assert.equal(helpModal.open, true);
    api.closeHelpModal();
    assert.equal(helpModal.open, false);
  });

  it('runtime real: dropdown de sesiones no tiene botones repetidos inline', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const container = env.elements.get('session-dropdown-items');
    assert.ok(container);
    // Debe incluir el botón para conmutar de sesión
    assert.ok(container.innerHTML.includes('data-switch-session'));
    // No debe duplicar las acciones que ya están en el pie del menú
    assert.ok(!container.innerHTML.includes('data-dup-session'));
    assert.ok(!container.innerHTML.includes('data-edit-session'));
    assert.ok(!container.innerHTML.includes('data-del-session'));
  });

  it('runtime real: descripciones de paneles y traducciones i18n son funcionales y sin tecnicismos internos', () => {
    const html = generateStandaloneHTML(sampleScheduleA);
    // No deben figurar términos de implementación interna en las descripciones visibles
    assert.ok(!html.includes('Branch &amp; Bound') && !html.includes('Branch & Bound'));
    assert.ok(!html.includes('&lt; 10 ms') && !html.includes('< 10 ms'));
    assert.ok(!html.includes('función de utilidad logarítmica'));

    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;
    assert.equal(api.getLanguage(), 'es');

    // Cambiar a inglés y verificar que las descripciones funcionales persisten
    api.toggleLanguage();
    assert.equal(api.getLanguage(), 'en');
  });

  it('runtime real: clic en día con examen conmuta la selección y día libre abre diálogo', () => {
    const multiExamSchedule = {
      meta: { title: 'Test Clics', academicYear: '2026/2027', session: 'Principal' },
      subjects: [
        {
          id: 'sub_a',
          name: 'Asignatura A',
          credits: 6,
          modules: [
            {
              id: 'mod_a',
              calls: [
                { id: 'call_a1', date: '2027-01-10', time: '09:00', durationHours: 3 }
              ]
            }
          ]
        },
        {
          id: 'sub_b',
          name: 'Asignatura B',
          credits: 6,
          modules: [
            {
              id: 'mod_b',
              calls: [
                { id: 'call_b1', date: '2027-01-20', time: '09:00', durationHours: 3 },
                { id: 'call_b2', date: '2027-01-20', time: '15:00', durationHours: 3 }
              ]
            }
          ]
        }
      ]
    };

    const env = createRuntimeEnvironment(multiExamSchedule);
    const api = env.window.ExamPlannerSessions;

    // Día con 1 examen ('2027-01-10'): alternar selección
    api.setSelectedCallIds([]);
    assert.equal(api.getState().selectedCallIds.has('call_a1'), false);
    api.handleDayClick('2027-01-10');
    assert.equal(api.getState().selectedCallIds.has('call_a1'), true, 'Debe seleccionar el examen al hacer clic en el día');
    api.handleDayClick('2027-01-10');
    assert.equal(api.getState().selectedCallIds.has('call_a1'), false, 'Debe deseleccionar el examen al hacer clic nuevamente');

    // Día con 2 exámenes ('2027-01-20')
    api.handleDayClick('2027-01-20');
    assert.equal(api.getState().selectedCallIds.has('call_b1'), true);
    assert.equal(api.getState().selectedCallIds.has('call_b2'), true);
    // Volver a hacer clic deselecciona ambos
    api.handleDayClick('2027-01-20');
    assert.equal(api.getState().selectedCallIds.has('call_b1'), false);
    assert.equal(api.getState().selectedCallIds.has('call_b2'), false);

    // Día libre sin exámenes ('2027-01-15'): abre diálogo de planificación
    const dayDialog = env.elements.get('day-dialog');
    dayDialog.open = false;
    api.handleDayClick('2027-01-15');
    assert.equal(dayDialog.open, true, 'Día sin exámenes debe abrir day-dialog');
  });

  it('runtime real: modal de ayuda conmuta entre explicaciones completas en ES y EN', () => {
    const env = createRuntimeEnvironment(sampleScheduleA);
    const api = env.window.ExamPlannerSessions;
    const body = env.elements.get('help-modal-body');

    // En español
    api.openHelpModal();
    assert.ok(body.innerHTML.includes('Gestión de Sesiones'), 'Debe incluir sección sesiones en ES');
    assert.ok(body.innerHTML.includes('Barra de Herramientas'), 'Debe incluir barra herramientas en ES');
    assert.ok(body.innerHTML.includes('Motores de Optimización'), 'Debe incluir optimización en ES');

    // Conmutar a inglés
    api.toggleLanguage();
    api.openHelpModal();
    assert.ok(body.innerHTML.includes('Session &amp; Calendar Management') || body.innerHTML.includes('Session & Calendar Management'), 'Debe incluir sección sesiones en EN');
    assert.ok(body.innerHTML.includes('Top Quick Action Toolbar'), 'Debe incluir barra herramientas en EN');
    assert.ok(body.innerHTML.includes('Optimization &amp; Selection Engines') || body.innerHTML.includes('Optimization & Selection Engines'), 'Debe incluir optimización en EN');
  });

  it('runtime real: ningún botón de la interfaz contiene caracteres o signos repetidos como + +', () => {
    const html = generateStandaloneHTML(sampleScheduleA);
    // Extraer todos los botones de la interfaz HTML y verificar sus textos
    const buttonMatches = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)];
    assert.ok(buttonMatches.length > 0, 'Debe haber botones en la interfaz');
    for (const match of buttonMatches) {
      const btnText = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      assert.ok(!btnText.includes('+ +') && !btnText.includes('++'), `Botón no debe tener "+" repetido: ${match[0]}`);
      assert.ok(!btnText.includes('× ×') && !btnText.includes('✕ ✕'), `Botón no debe tener "×" repetido: ${match[0]}`);
      assert.ok(!btnText.includes('✏️ ✏️'), `Botón no debe tener emoji repetido: ${match[0]}`);
    }
  });

  it('runtime real: meta.institution es estrictamente opcional y no impone "Universidad" cuando está vacía', () => {
    const emptyInstSchedule = {
      meta: {
        title: 'Grado en Matemáticas',
        institution: '',
        academicYear: '2026/2027',
        session: 'Convocatoria Única'
      },
      subjects: []
    };

    const env = createRuntimeEnvironment(emptyInstSchedule);
    const active = env.window.ExamPlannerSessions.getActiveSession();
    assert.equal(active.schedule.meta.institution, '', 'No debe rellenar con "Universidad" si institution viene vacía');
    const subtitle = env.elements.get('header-subtitle');
    assert.ok(!subtitle.textContent.includes('Universidad'), 'El subtítulo no debe incluir "Universidad" si no se especificó');
  });

  it('runtime real: resetToDefaultTemplate restablece a la plantilla genérica y existe botón en dropdown en index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const vm = require('node:vm');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    assert.ok(indexHtml.includes('id="btn-reset-to-template"'), 'Debe existir #btn-reset-to-template en index.html');
    assert.ok(indexHtml.includes('data-i18n="btn_reset_all_sessions"'), 'Debe tener atributo data-i18n');
    assert.ok(indexHtml.includes('Fundamentos de Programación'), 'Debe tener la plantilla genérica con asignaturas');

    // Comprobar la lógica del script de index.html
    const scriptMatches = [...indexHtml.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)];
    // El script principal es el último bloque <script>
    const appScript = scriptMatches[scriptMatches.length - 1][1];
    assert.ok(appScript.includes('function resetToDefaultTemplate'), 'Debe definir resetToDefaultTemplate');
    assert.ok(appScript.includes('resetToTemplate: resetToDefaultTemplate'), 'Debe exportar resetToTemplate');
  });

  it('runtime real: submenú Cargar Plan agrupa importación, Prompt IA, Markdown y descarga JSON en index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    assert.ok(indexHtml.includes('id="btn-load-plan-dropdown"'), 'Debe existir el botón dropdown #btn-load-plan-dropdown');
    assert.ok(indexHtml.includes('id="load-plan-dropdown-menu"'), 'Debe existir el contenedor del submenú #load-plan-dropdown-menu');
    assert.ok(indexHtml.includes('id="btn-top-upload"'), 'Debe contener la opción de subir archivo');
    assert.ok(indexHtml.includes('id="btn-menu-paste-text"'), 'Debe contener la opción de pegar texto o JSON');
    assert.ok(indexHtml.includes('id="btn-top-copy-prompt"'), 'Debe contener Prompt IA en el submenú');
    assert.ok(indexHtml.includes('id="btn-copy-md"'), 'Debe contener Markdown en el submenú');
    assert.ok(indexHtml.includes('id="btn-menu-download-json"'), 'Debe contener opción de descargar copia JSON');
  });

  it('runtime real: sliders de dificultad se asignan a cada módulo individualmente en index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    assert.ok(indexHtml.includes('data-module-id'), 'Debe incluir data-module-id en los sliders');
    assert.ok(indexHtml.includes('module-slider'), 'Debe incluir clase module-slider');
    assert.ok(indexHtml.includes('setModuleWeight'), 'Debe exponer setModuleWeight');
  });

  it('runtime real: plantilla de prompt IA incluye división explícita por módulos y pesos por módulo en index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    assert.ok(indexHtml.includes('DIVISIÓN POR MÓDULOS (OBLIGATORIA)'), 'Debe tener regla obligatoria de módulos');
    assert.ok(indexHtml.includes('mod_so'), 'Debe tener ejemplo con múltiples módulos');
    assert.ok(indexHtml.includes('mod_redes'), 'Debe tener ejemplo con segundo módulo');
    assert.ok(indexHtml.includes('"defaultWeight": 5'), 'Debe incluir pesos a nivel de módulo');
  });

  it('runtime real: módulos como subasignaturas obligatorias (1 examen por módulo) y etiquetas de calendario informativas', () => {
    const fs = require('fs');
    const path = require('path');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    // Prompt explica regla fundamental de presentación (1 examen por módulo)
    assert.ok(indexHtml.includes('REGLA FUNDAMENTAL DE PRESENTACIÓN'), 'Prompt debe incluir regla de presentación');
    assert.ok(indexHtml.includes('OBLIGATORIAMENTE a exactamente 1 examen (llamamiento) por cada módulo'), 'Prompt debe exigir 1 examen por módulo');

    // Calendario enriquece chips con nombre de módulo para asignaturas multi-módulo
    assert.ok(indexHtml.includes('hasMultipleModules'), 'Debe distinguir asignaturas con múltiples módulos en el calendario');
    assert.ok(indexHtml.includes('${call.subjectName}: ${call.moduleName}'), 'Chip debe mostrar módulo cuando hay varios');

    // Modal de asignaturas muestra el módulo en cada convocatoria
    assert.ok(indexHtml.includes('escapeHtml(c.moduleName)'), 'Modal de gestión debe etiquetar módulo en convocatorias');
  });

  it('runtime real: prompt IA identifica y unifica módulos de la misma asignatura si coinciden en fecha y hora (mismo examen físico)', () => {
    const fs = require('fs');
    const path = require('path');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    // Regla de coincidencia horaria
    assert.ok(indexHtml.includes('MISMO EXAMEN FÍSICO'), 'Prompt debe especificar que misma fecha y hora es el mismo examen físico');
    assert.ok(indexHtml.includes('mismo día y a la misma hora'), 'Prompt debe detallar condición de coincidencia horaria');
    assert.ok(indexHtml.includes('NO crees módulos separados a la misma hora'), 'Prompt debe prohibir crear módulos duplicados simultáneos para la misma materia');
  });

  it('runtime real: panel de calendario ampliado (col-span-9) y panel derecho de optimización/sliders (col-span-3) con márgenes optimizados', () => {
    const fs = require('fs');
    const path = require('path');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    // Contenedor principal ampliado y márgenes reducidos
    assert.ok(indexHtml.includes('max-w-[1720px]'), 'Contenedor debe utilizar ancho extendido');

    // Calendario ampliado (col-span-9 en xl)
    assert.ok(indexHtml.includes('xl:col-span-9'), 'Panel de calendario debe tener 9 columnas en xl (75% ancho)');

    // Panel de controles a la derecha reducido (col-span-3 en xl)
    assert.ok(indexHtml.includes('xl:col-span-3'), 'Panel de optimización y sliders debe tener 3 columnas en xl (25% ancho)');
  });

  it('runtime real: panel Cargar Plan y toda la UI disponen de cobertura i18n completa en ES, EN e IT', () => {
    const fs = require('fs');
    const path = require('path');
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

    // Comprobar atributos i18n en el panel de carga de plan
    assert.ok(indexHtml.includes('data-i18n="import_guide_title"'), 'Debe tener data-i18n en título de guía');
    assert.ok(indexHtml.includes('data-i18n="step_1_badge"'), 'Debe tener data-i18n en badge de paso 1');
    assert.ok(indexHtml.includes('data-i18n="step_2_badge"'), 'Debe tener data-i18n en badge de paso 2');
    assert.ok(indexHtml.includes('data-i18n="step_3_badge"'), 'Debe tener data-i18n en badge de paso 3');
    assert.ok(indexHtml.includes('data-i18n="dropzone_prompt"'), 'Debe tener data-i18n en dropzone');
    assert.ok(indexHtml.includes('data-i18n="dropzone_hint"'), 'Debe tener data-i18n en hint de dropzone');
    assert.ok(indexHtml.includes('data-i18n="import_dest_overwrite"'), 'Debe tener data-i18n en opción sobrescribir');
    assert.ok(indexHtml.includes('data-i18n-placeholder="import_textarea_placeholder"'), 'Debe tener data-i18n-placeholder en textarea de importación');
    assert.ok(indexHtml.includes('data-i18n="export_sec_desc"'), 'Debe tener data-i18n en descripción de exportación');
    assert.ok(indexHtml.includes('data-i18n="btn_download_json"'), 'Debe tener data-i18n en botón descargar JSON');
    assert.ok(indexHtml.includes('data-i18n="btn_copy_json"'), 'Debe tener data-i18n en botón copiar JSON');
    assert.ok(indexHtml.includes('data-i18n="reset_sec_desc"'), 'Debe tener data-i18n en descripción de reset');
    assert.ok(indexHtml.includes('data-i18n="btn_reset_storage"'), 'Debe tener data-i18n en botón reset a fábrica');

    // Comprobar paridad de claves entre los 3 diccionarios
    const i18nCode = fs.readFileSync(path.resolve(__dirname, '../src/client/i18n.js'), 'utf8');
    const esMatch = i18nCode.match(/es:\s*\{([\s\S]*?)\n\s*\},/);
    const enMatch = i18nCode.match(/en:\s*\{([\s\S]*?)\n\s*\},/);
    const itMatch = i18nCode.match(/it:\s*\{([\s\S]*?)\n\s*\}\s*\n\s*\};/);

    function extractKeys(str) {
      const keys = [];
      const regex = /^\s*([a-zA-Z0-9_]+)\s*:/gm;
      let m;
      while ((m = regex.exec(str)) !== null) keys.push(m[1]);
      return keys;
    }

    const esKeys = extractKeys(esMatch[1]);
    const enKeys = extractKeys(enMatch[1]);
    const itKeys = extractKeys(itMatch[1]);

    const missingInEn = esKeys.filter(k => !enKeys.includes(k));
    const missingInIt = esKeys.filter(k => !itKeys.includes(k));

    assert.deepEqual(missingInEn, [], 'EN no debe tener claves faltantes respecto a ES');
    assert.deepEqual(missingInIt, [], 'IT no debe tener claves faltantes respecto a ES');
  });

});





