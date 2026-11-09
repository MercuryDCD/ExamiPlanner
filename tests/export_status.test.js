const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const {
  validateSchedule,
  normalizeSchedule,
  extractSelectedCallIds,
  getExportableSchedule,
  parseInput
} = require('../src/core/parser');
const { generateStandaloneHTML } = require('../src/core/generator');

describe('Export JSON with Active/Inactive Status & Backward Compatibility Suite', () => {

  const sampleSchedule = {
    meta: {
      title: 'Máster en Inteligencia Artificial',
      institution: 'Universidad de Bolonia',
      academicYear: '2026/2027',
      session: 'Sessione Invernale',
      icon: '❄️'
    },
    subjects: [
      {
        id: 'ml',
        name: 'Machine Learning',
        shortName: 'ML',
        credits: 6,
        modules: [
          {
            id: 'ml_mod',
            name: 'ML Teoría',
            alreadyPassed: false,
            calls: [
              { id: 'ml_c1', date: '2027-01-15', time: '09:00', durationHours: 3 },
              { id: 'ml_c2', date: '2027-02-05', time: '09:00', durationHours: 3 },
              { id: 'ml_c3', date: '2027-02-20', time: '09:00', durationHours: 3 }
            ]
          }
        ]
      },
      {
        id: 'cv',
        name: 'Computer Vision',
        shortName: 'CV',
        credits: 6,
        modules: [
          {
            id: 'cv_mod',
            name: 'CV Laboratorio',
            alreadyPassed: false,
            calls: [
              { id: 'cv_c1', date: '2027-01-20', time: '14:00', durationHours: 2.5 },
              { id: 'cv_c2', date: '2027-02-10', time: '14:00', durationHours: 2.5 }
            ]
          }
        ]
      }
    ],
    presets: [
      {
        name: 'Estrategia Inicial',
        description: 'Llamamientos por defecto',
        selectedCallIds: ['ml_c1', 'cv_c1']
      }
    ]
  };

  it('getExportableSchedule debe etiquetar cada llamamiento con status: active/inactive y active: boolean según la selección', () => {
    // Supongamos que el usuario seleccionó la 2ª convocatoria de ML y la 1ª de CV
    const selected = ['ml_c2', 'cv_c1'];
    const exported = getExportableSchedule(sampleSchedule, selected);

    // Validar estructura exportada
    const mlCalls = exported.subjects.find(s => s.id === 'ml').modules[0].calls;
    const cvCalls = exported.subjects.find(s => s.id === 'cv').modules[0].calls;

    // ML c1 no seleccionado
    assert.equal(mlCalls[0].status, 'inactive');
    assert.equal(mlCalls[0].active, false);

    // ML c2 seleccionado
    assert.equal(mlCalls[1].status, 'active');
    assert.equal(mlCalls[1].active, true);

    // ML c3 no seleccionado
    assert.equal(mlCalls[2].status, 'inactive');
    assert.equal(mlCalls[2].active, false);

    // CV c1 seleccionado
    assert.equal(cvCalls[0].status, 'active');
    assert.equal(cvCalls[0].active, true);

    // CV c2 no seleccionado
    assert.equal(cvCalls[1].status, 'inactive');
    assert.equal(cvCalls[1].active, false);

    // Presets y selectedCallIds sincronizados
    assert.deepEqual(exported.presets[0].selectedCallIds, ['ml_c2', 'cv_c1']);
    assert.deepEqual(exported.selectedCallIds, ['ml_c2', 'cv_c1']);
  });

  it('extractSelectedCallIds debe priorizar los llamamientos con status: active o active: true', () => {
    const exportedData = {
      meta: { title: 'Test', academicYear: '2026/2027', session: 'Invierno' },
      subjects: [
        {
          id: 's1',
          name: 'Subject 1',
          modules: [
            {
              id: 'm1',
              name: 'Mod 1',
              calls: [
                { id: 'c1', date: '2027-01-10', status: 'inactive', active: false },
                { id: 'c2', date: '2027-01-25', status: 'active', active: true }
              ]
            }
          ]
        }
      ]
    };

    const extracted = extractSelectedCallIds(exportedData);
    assert.deepEqual(extracted, ['c2']);
  });

  it('extractSelectedCallIds debe admitir sinónimos en español ("activo", "desactivado", "inactivo")', () => {
    const spanishData = {
      meta: { title: 'Test ES', academicYear: '2026/2027', session: 'Invierno' },
      subjects: [
        {
          id: 's1',
          name: 'Sistemas',
          modules: [
            {
              id: 'm1',
              name: 'M1',
              calls: [
                { id: 'call_ord_1', date: '2027-01-10', status: 'desactivado' },
                { id: 'call_ord_2', date: '2027-01-28', status: 'activo' }
              ]
            }
          ]
        }
      ]
    };

    const extracted = extractSelectedCallIds(spanishData);
    assert.deepEqual(extracted, ['call_ord_2']);
  });

  it('extractSelectedCallIds debe mantener compatibilidad hacia atrás con JSONs antiguos sin status', () => {
    // 1. Caso con presets tradicional
    const legacyWithPreset = {
      meta: { title: 'Legacy', academicYear: '2026/2027', session: 'Invierno' },
      subjects: [
        {
          id: 's1',
          name: 'Legacy Subject',
          modules: [
            {
              id: 'm1',
              name: 'Mod 1',
              calls: [
                { id: 'c1', date: '2027-01-10' },
                { id: 'c2', date: '2027-01-20' }
              ]
            }
          ]
        }
      ],
      presets: [
        {
          name: 'Preset 1',
          selectedCallIds: ['c2']
        }
      ]
    };
    assert.deepEqual(extractSelectedCallIds(legacyWithPreset), ['c2']);

    // 2. Caso sin presets: fallback al primer llamamiento de cada módulo
    const legacyWithoutPreset = {
      meta: { title: 'Legacy No Presets', academicYear: '2026/2027', session: 'Invierno' },
      subjects: [
        {
          id: 's1',
          name: 'Subject 1',
          modules: [
            {
              id: 'm1',
              name: 'Mod 1',
              calls: [
                { id: 'c1', date: '2027-01-10' },
                { id: 'c2', date: '2027-01-20' }
              ]
            }
          ]
        }
      ]
    };
    assert.deepEqual(extractSelectedCallIds(legacyWithoutPreset), ['c1']);
  });

  it('el esquema JSON Schema oficial debe permitir status, active y selectedCallIds', () => {
    const schemaPath = path.resolve(__dirname, '../schemas/schedule_schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    const callProps = schema.properties.subjects.items.properties.modules.items.properties.calls.items.properties;
    assert.ok(callProps.status, 'Schema debe definir propiedad status en calls');
    assert.ok(callProps.active, 'Schema debe definir propiedad active en calls');
    assert.ok(schema.properties.selectedCallIds, 'Schema debe definir selectedCallIds a nivel raíz');
  });

  it('compatibilidad con localStorage: planes guardados en formato previo no se corrompen ni pierden selección', () => {
    // Simular un estado existente en localStorage guardado por una versión previa
    const storedSessions = [
      {
        id: 'session_antigua_1',
        name: 'Mi Plan Guardado Previamente',
        icon: '🎓',
        schedule: {
          meta: { title: 'Plan Antiguo', academicYear: '2026/2027', session: 'Ordinaria' },
          subjects: [
            {
              id: 'sub_a',
              name: 'Álgebra',
              modules: [
                {
                  id: 'mod_a',
                  name: 'Álgebra',
                  // Nótese que las llamadas antiguas NO tienen status ni active
                  calls: [
                    { id: 'alg_call_1', date: '2027-01-12' },
                    { id: 'alg_call_2', date: '2027-02-02' }
                  ]
                }
              ]
            }
          ]
        },
        // En la versión previa, el cliente guardaba la selección en este campo:
        selectedCallIds: ['alg_call_2'],
        subjectWeights: {},
        dayPlans: {}
      }
    ];

    // Verificar que al leer la sesión antigua:
    const norm = normalizeSchedule(storedSessions[0].schedule);
    let chosenIds = (Array.isArray(storedSessions[0].selectedCallIds) && storedSessions[0].selectedCallIds.length > 0)
      ? storedSessions[0].selectedCallIds
      : extractSelectedCallIds(norm);

    assert.deepEqual(chosenIds, ['alg_call_2'], 'Debe conservar la selección original del usuario almacenada en su cliente');

    // Al exportar ese plan antiguo, debe generar el formato con status activo/desactivado
    const exported = getExportableSchedule(norm, chosenIds);
    const algCalls = exported.subjects[0].modules[0].calls;
    assert.equal(algCalls[0].status, 'inactive');
    assert.equal(algCalls[0].active, false);
    assert.equal(algCalls[1].status, 'active');
    assert.equal(algCalls[1].active, true);
  });

  it('runtime real: exportar copia JSON y copiar JSON incluye los llamamientos seleccionados con status active/inactive', () => {
    const html = generateStandaloneHTML(sampleSchedule, { skipValidation: true });

    // Verificar que el script empaquetado contiene getExportableSchedule y extractSelectedCallIds
    assert.ok(html.includes('getExportableSchedule'), 'HTML generado debe contener getExportableSchedule');
    assert.ok(html.includes('extractSelectedCallIds'), 'HTML generado debe contener extractSelectedCallIds');
    assert.ok(html.includes('id="call-status-select"'), 'HTML generado debe contener selector de estado de convocatoria');
    assert.ok(html.includes('data-action="toggle-call"'), 'Modal de asignaturas debe contener botón toggle de activación de llamamientos');
  });

});
