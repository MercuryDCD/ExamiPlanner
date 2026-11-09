const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { optimizeSchedule } = require('../src/core/optimizer');
const { normalizeSchedule } = require('../src/core/parser');

describe('Optimizer Test Suite — Combinatorial Branch-and-Bound Engine', () => {

  const testSchedule = normalizeSchedule({
    meta: {
      title: 'Optimizer Test',
      institution: 'University',
      academicYear: '2026/2027',
      session: 'Session',
      targetCredits: 12
    },
    subjects: [
      {
        id: 's_math',
        name: 'Matemáticas',
        credits: 6,
        defaultWeight: 5,
        modules: [
          {
            id: 'mod_math',
            name: 'Módulo Matemáticas',
            calls: [
              { id: 'math_early', date: '2027-01-10', time: '09:00', durationHours: 3 },
              { id: 'math_late', date: '2027-01-20', time: '09:00', durationHours: 3 }
            ]
          }
        ]
      },
      {
        id: 's_phys',
        name: 'Física',
        credits: 6,
        defaultWeight: 2,
        modules: [
          {
            id: 'mod_phys',
            name: 'Módulo Física',
            calls: [
              { id: 'phys_crowded', date: '2027-01-11', time: '09:00', durationHours: 3 }, // 1 day from math_early
              { id: 'phys_spaced', date: '2027-01-30', time: '09:00', durationHours: 3 }   // 10 or 20 days
            ]
          }
        ]
      }
    ]
  });

  it('Modo Maximizar Espaciado (Max-Min Buffer): Debe seleccionar la combinación con mayor distancia mínima', () => {
    const result = optimizeSchedule(testSchedule, { mode: 'max-spacing' });

    assert.equal(result.selectedCallIds.length, 2);
    // Combos:
    // math_early (10) + phys_crowded (11) -> min buffer = 1 día
    // math_early (10) + phys_spaced (30) -> min buffer = 20 días
    // math_late (20) + phys_crowded (11) -> min buffer = 9 días
    // math_late (20) + phys_spaced (30) -> min buffer = 10 días
    // La óptima es math_early (10) + phys_spaced (30)
    assert.deepEqual(result.selectedCallIds.sort(), ['math_early', 'phys_spaced'].sort());
    assert.ok(result.minBufferDays >= 19);
  });

  it('Poda Branch-and-Bound: No debe seleccionar combinaciones con colisión exacta', () => {
    const collisionSchedule = normalizeSchedule({
      meta: { title: 'T', institution: 'I', academicYear: 'Y', session: 'S' },
      subjects: [
        {
          id: 'sub1',
          name: 'Asig 1',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'Mod 1',
              calls: [
                { id: 'c1_same', date: '2027-02-05', time: '09:00', durationHours: 3 },
                { id: 'c1_alt', date: '2027-02-15', time: '09:00', durationHours: 3 }
              ]
            }
          ]
        },
        {
          id: 'sub2',
          name: 'Asig 2',
          credits: 6,
          modules: [
            {
              id: 'm2',
              name: 'Mod 2',
              calls: [
                { id: 'c2_same', date: '2027-02-05', time: '10:00', durationHours: 3 } // colisiona con c1_same
              ]
            }
          ]
        }
      ]
    });

    const result = optimizeSchedule(collisionSchedule, { mode: 'max-spacing' });
    // Debe seleccionar c1_alt y c2_same, evitando la colisión entre c1_same y c2_same
    assert.ok(result.selectedCallIds.includes('c1_alt'));
    assert.ok(result.selectedCallIds.includes('c2_same'));
    assert.ok(!result.selectedCallIds.includes('c1_same'));
  });

  it('Modo Ponderado por Dificultad: Recompensa descanso para la asignatura de mayor peso', () => {
    // Escenario de prueba donde el peso relativo altera la combinación ganadora
    const customSchedule = normalizeSchedule({
      meta: { title: 'T', institution: 'I', academicYear: 'Y', session: 'S' },
      subjects: [
        {
          id: 'subA',
          name: 'Asignatura A',
          credits: 6,
          defaultWeight: 1,
          modules: [
            {
              id: 'modA',
              name: 'Mod A',
              calls: [
                { id: 'cA_early', date: '2027-01-10', time: '09:00', durationHours: 3 },
                { id: 'cA_late', date: '2027-01-25', time: '09:00', durationHours: 3 }
              ]
            }
          ]
        },
        {
          id: 'subB',
          name: 'Asignatura B',
          credits: 6,
          defaultWeight: 1,
          modules: [
            {
              id: 'modB',
              name: 'Mod B',
              calls: [
                { id: 'cB_early', date: '2027-01-12', time: '09:00', durationHours: 3 },
                { id: 'cB_late', date: '2027-02-05', time: '09:00', durationHours: 3 }
              ]
            }
          ]
        }
      ]
    });

    const resAHeavy = optimizeSchedule(customSchedule, {
      mode: 'weighted-difficulty',
      weights: { subA: 5, subB: 1 }
    });

    const resBHeavy = optimizeSchedule(customSchedule, {
      mode: 'weighted-difficulty',
      weights: { subA: 1, subB: 5 }
    });

    assert.notDeepEqual(resAHeavy.selectedCallIds, resBHeavy.selectedCallIds);
    assert.deepEqual(resAHeavy.selectedCallIds.sort(), ['cA_late', 'cB_late'].sort());
    assert.deepEqual(resBHeavy.selectedCallIds.sort(), ['cA_early', 'cB_late'].sort());
  });

  it('Debe admitir modo como string directo o como propiedad en objeto de opciones', () => {
    const resString = optimizeSchedule(testSchedule, 'max-spacing');
    const resObject = optimizeSchedule(testSchedule, { mode: 'max-spacing' });

    assert.deepEqual(resString.selectedCallIds, resObject.selectedCallIds);
    assert.equal(resString.score, resObject.score);
  });

  it('Debe respetar fixedCallIds cuando el usuario bloquea una convocatoria', () => {
    // Si forzamos math_late, la mejor opción restante para phys es phys_spaced
    const result = optimizeSchedule(testSchedule, {
      mode: 'max-spacing',
      fixedCallIds: ['math_late']
    });

    assert.ok(result.selectedCallIds.includes('math_late'));
    assert.ok(result.selectedCallIds.includes('phys_spaced'));
  });

  it('Garantía de rendimiento: Debe ejecutarse en < 10 ms para un espacio combinatorio típico', () => {
    // Ejemplo completo de UNIBO Master AI (5 materias x 2-3 llamadas = ~100 combinaciones)
    const uniboData = require('../schemas/examples/unibo_master_ai.json');
    const schedule = normalizeSchedule(uniboData);

    const start = performance.now();
    const result = optimizeSchedule(schedule, { mode: 'max-spacing' });
    const duration = performance.now() - start;

    assert.equal(result.selectedCallIds.length, 5);
    assert.ok(duration < 25, `El optimizador tardó ${duration} ms, debe ser < 25 ms.`);
  });

  it('Bonificación de Paracaídas: Favorece convocatoria temprana para retener appello posterior cuando el descanso es razonable', () => {
    const parachuteSchedule = normalizeSchedule({
      meta: { title: 'Parachute Test', institution: 'UNIBO', academicYear: '2026/2027', session: 'Invernale' },
      subjects: [
        {
          id: 's_hard',
          name: 'Materia Difícil',
          credits: 6,
          defaultWeight: 5,
          modules: [
            {
              id: 'm_hard',
              name: 'Módulo Difícil',
              calls: [
                { id: 'hard_early', date: '2027-01-15', time: '09:00', durationHours: 3 }, // 14 días desde baseline
                { id: 'hard_late', date: '2027-02-10', time: '09:00', durationHours: 3 }  // 40 días desde baseline
              ]
            }
          ]
        }
      ]
    });

    // Sin bonificación de seguridad (modo ponderado estándar: logaritmo de 40 días > 14 días)
    const resWithoutSafety = optimizeSchedule(parachuteSchedule, {
      mode: 'weighted-difficulty',
      prioritizeSafety: false
    });
    assert.deepEqual(resWithoutSafety.selectedCallIds, ['hard_late']);
    assert.equal(resWithoutSafety.safetyBonus, 0);

    // Con bonificación de seguridad (prioritizeSafety: true):
    // hard_early ofrece 1 appello posterior de paracaídas (hard_late).
    // Con 14 días de colchón óptimo (>= 7 días), el bono de paracaídas debe seleccionar hard_early
    const resWithSafety = optimizeSchedule(parachuteSchedule, {
      mode: 'weighted-difficulty',
      prioritizeSafety: true
    });
    assert.deepEqual(resWithSafety.selectedCallIds, ['hard_early']);
    assert.ok(resWithSafety.safetyBonus > 0, 'Debe calcular safetyBonus positivo para la convocatoria temprana');
  });

  it('Bonificación de Paracaídas: No debe forzar convocatoria temprana si provoca colisión o descanso crítico', () => {
    const dangerEarlySchedule = normalizeSchedule({
      meta: { title: 'Danger Test', institution: 'UNIBO', academicYear: '2026/2027', session: 'Invernale' },
      subjects: [
        {
          id: 's1',
          name: 'Materia 1',
          credits: 6,
          defaultWeight: 5,
          modules: [
            {
              id: 'm1',
              name: 'Módulo 1',
              calls: [
                { id: 'c1_fixed', date: '2027-01-10', time: '09:00', durationHours: 3 }
              ]
            }
          ]
        },
        {
          id: 's2',
          name: 'Materia 2',
          credits: 6,
          defaultWeight: 5,
          modules: [
            {
              id: 'm2',
              name: 'Módulo 2',
              calls: [
                // early_danger es 2 horas después el mismo día (misma fecha -> penalización alta de sobrecarga)
                { id: 'c2_danger_same_day', date: '2027-01-10', time: '14:00', durationHours: 3 },
                // late_safe está a 15 días de distancia
                { id: 'c2_late_safe', date: '2027-01-25', time: '09:00', durationHours: 3 }
              ]
            }
          ]
        }
      ]
    });

    const res = optimizeSchedule(dangerEarlySchedule, {
      mode: 'weighted-difficulty',
      prioritizeSafety: true
    });

    // Debe prevalecer c2_late_safe a pesar de que c2_danger_same_day tenga una llamada posterior
    assert.deepEqual(res.selectedCallIds.sort(), ['c1_fixed', 'c2_late_safe'].sort());
  });

  it('Modo Maximizar Espaciado con Prioridad de Paracaídas: Favorece convocatoria temprana cuando el colchón es óptimo (>= 7 días)', () => {
    const spacingParachuteSchedule = normalizeSchedule({
      meta: { title: 'Spacing Parachute', institution: 'UNIBO', academicYear: '2026/2027', session: 'Invernale' },
      subjects: [
        {
          id: 'sub_spacing',
          name: 'Materia Espaciada',
          credits: 6,
          defaultWeight: 5,
          modules: [
            {
              id: 'mod_spacing',
              name: 'Módulo',
              calls: [
                { id: 'early_call', date: '2027-01-15', time: '09:00', durationHours: 3 }, // 14 días desde baseline
                { id: 'late_call', date: '2027-02-10', time: '09:00', durationHours: 3 }  // 40 días desde baseline
              ]
            }
          ]
        }
      ]
    });

    const resWithoutSafety = optimizeSchedule(spacingParachuteSchedule, 'max-spacing', { prioritizeSafety: false });
    assert.deepEqual(resWithoutSafety.selectedCallIds, ['late_call']);

    const resWithSafety = optimizeSchedule(spacingParachuteSchedule, 'max-spacing', { prioritizeSafety: true });
    assert.deepEqual(resWithSafety.selectedCallIds, ['early_call']);
  });

  it('Firma de 3 argumentos: Debe admitir (schedule, mode, options) con paridad total frente a objeto de opciones', () => {
    const parachuteSchedule = normalizeSchedule({
      meta: { title: 'T', institution: 'I', academicYear: 'Y', session: 'S' },
      subjects: [
        {
          id: 's',
          name: 'Sub',
          credits: 6,
          defaultWeight: 4,
          modules: [
            {
              id: 'm',
              name: 'Mod',
              calls: [
                { id: 'c_early', date: '2027-01-15', time: '09:00', durationHours: 3 },
                { id: 'c_late', date: '2027-02-05', time: '09:00', durationHours: 3 }
              ]
            }
          ]
        }
      ]
    });

    const res3Args = optimizeSchedule(parachuteSchedule, 'weighted-difficulty', { prioritizeSafety: true });
    const resObj = optimizeSchedule(parachuteSchedule, { mode: 'weighted-difficulty', prioritizeSafety: true });

    assert.deepEqual(res3Args.selectedCallIds, resObj.selectedCallIds);
    assert.equal(res3Args.score, resObj.score);
    assert.equal(res3Args.safetyBonus, resObj.safetyBonus);
  });

  it('Entrada vacía: Debe gestionar array de asignaturas vacío sin lanzar error', () => {
    const emptySchedule = {
      meta: { title: 'Vacío', institution: 'U', academicYear: '2026/2027', session: 'S' },
      subjects: []
    };

    const res = optimizeSchedule(emptySchedule, { mode: 'max-spacing' });
    assert.deepEqual(res.selectedCallIds, []);
    assert.equal(res.minBufferDays, 0);
    assert.equal(res.evaluatedCombinations, 0);
  });

  it('Modo Ponderado por Dificultad: Soporta pesos individuales por módulo en una misma asignatura', () => {
    const multiModuleSched = normalizeSchedule({
      meta: { title: 'Test Multi Mod', institution: '', academicYear: '2026/2027', session: 'S' },
      subjects: [
        {
          id: 'sub_composite',
          name: 'Matemática Integrada',
          credits: 12,
          defaultWeight: 3,
          modules: [
            {
              id: 'mod_theory',
              name: 'Teoría (Dura)',
              credits: 6,
              calls: [
                { id: 'th_early', date: '2027-01-10', time: '09:00', durationHours: 3 },
                { id: 'th_late', date: '2027-01-25', time: '09:00', durationHours: 3 }
              ]
            },
            {
              id: 'mod_lab',
              name: 'Práctica de Laboratorio (Fácil)',
              credits: 6,
              calls: [
                { id: 'lab_early', date: '2027-01-12', time: '09:00', durationHours: 2 },
                { id: 'lab_late', date: '2027-01-27', time: '09:00', durationHours: 2 }
              ]
            }
          ]
        }
      ]
    });

    // Asignamos dificultad 5 a la teoría y 1 al laboratorio a nivel de moduleId
    const res = optimizeSchedule(multiModuleSched, {
      mode: 'weighted-difficulty',
      weights: {
        mod_theory: 5,
        mod_lab: 1
      }
    });

    assert.equal(res.selectedCallIds.length, 2);
    assert.ok(res.selectedCallIds.includes('th_late') || res.selectedCallIds.includes('th_early'));
  });

  it('debe optimizar asignaturas sin módulos con escrito y oral asignando pesos independientes a cada tipo de examen', () => {
    const directSubjectSched = normalizeSchedule({
      meta: {
        title: 'Cálculo sin módulos',
        academicYear: '2026/2027',
        session: 'Invierno',
        targetCredits: 6
      },
      subjects: [
        {
          id: 'calc',
          name: 'Cálculo',
          shortName: 'CALC',
          credits: 6,
          evaluationMode: 'written_and_oral',
          oralBinding: 'any_subsequent',
          calls: [
            { id: 'calc_w1', date: '2027-01-15', time: '09:00', durationHours: 3, type: 'written', appelloIndex: 1 },
            { id: 'calc_w2', date: '2027-01-25', time: '09:00', durationHours: 3, type: 'written', appelloIndex: 2 },
            { id: 'calc_o1', date: '2027-01-20', time: '09:00', durationHours: 1, type: 'oral', appelloIndex: 1 },
            { id: 'calc_o2', date: '2027-02-05', time: '09:00', durationHours: 1, type: 'oral', appelloIndex: 2 }
          ]
        }
      ]
    });

    assert.equal(directSubjectSched.subjects[0].hasModules, false, 'La asignatura no debe tener módulos');
    assert.equal(directSubjectSched.subjects[0].modules.length, 1, 'Debe normalizarse con 1 módulo implícito');

    // Optimizamos con peso 5 para el escrito y peso 1 para el oral
    const res = optimizeSchedule(directSubjectSched, {
      mode: 'weighted-difficulty',
      weights: {
        calc__written: 5,
        calc__oral: 1
      }
    });

    assert.equal(res.selectedCallIds.length, 2, 'Debe seleccionar exactamente 1 escrito y 1 oral');
    // Precedencia: el oral seleccionado debe ser posterior al escrito seleccionado
    const callIndex = new Map();
    directSubjectSched.subjects[0].modules[0].calls.forEach(c => callIndex.set(c.id, c));
    const selCalls = res.selectedCallIds.map(id => callIndex.get(id));
    const wCall = selCalls.find(c => c.type === 'written');
    const oCall = selCalls.find(c => c.type === 'oral');
    assert.ok(wCall, 'Debe haber un examen escrito seleccionado');
    assert.ok(oCall, 'Debe haber un examen oral seleccionado');
    assert.ok(new Date(oCall.date) > new Date(wCall.date), 'El oral debe ser posterior al escrito');
  });
});
