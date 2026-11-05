const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSchedule, parseDateTime } = require('../src/core/analyzer');
const { normalizeSchedule } = require('../src/core/parser');

describe('Analyzer Test Suite — Conflict Engine & Study Buffer Metrics', () => {

  const baseSchedule = normalizeSchedule({
    meta: {
      title: 'Test Session',
      institution: 'UNIBO',
      academicYear: '2026/2027',
      session: 'Invernale',
      targetCredits: 18,
      creditUnit: 'CFU'
    },
    subjects: [
      {
        id: 's1',
        name: 'Asignatura 1',
        credits: 6,
        modules: [
          {
            id: 'm1',
            name: 'Módulo 1',
            calls: [
              { id: 'c1_colliding', date: '2027-01-15', time: '09:00', durationHours: 3 }, // 09:00 - 12:00
              { id: 'c1_afternoon', date: '2027-01-15', time: '15:00', durationHours: 2 }, // 15:00 - 17:00
              { id: 'c1_alt', date: '2027-02-01', time: '09:00', durationHours: 2 }
            ]
          }
        ]
      },
      {
        id: 's2',
        name: 'Asignatura 2',
        credits: 6,
        modules: [
          {
            id: 'm2',
            name: 'Módulo 2',
            calls: [
              { id: 'c2_colliding', date: '2027-01-15', time: '10:30', durationHours: 2 }, // overlaps c1_colliding
              { id: 'c2_evening', date: '2027-01-15', time: '18:00', durationHours: 2 },   // no overlap with c1_afternoon
              { id: 'c2_next_morning', date: '2027-01-16', time: '09:00', durationHours: 2 } // turnaround < 24h from c2_evening
            ]
          }
        ]
      },
      {
        id: 's3',
        name: 'Asignatura 3',
        credits: 6,
        modules: [
          {
            id: 'm3',
            name: 'Módulo 3',
            calls: [
              { id: 'c3_spaced', date: '2027-01-25', time: '09:00', durationHours: 2 },
              { id: 'c3_close', date: '2027-01-18', time: '09:00', durationHours: 2 }
            ]
          }
        ]
      }
    ]
  });

  it('Regla 1: Debe detectar colisión exacta con solapamiento de horas (0h de margen)', () => {
    // c1_colliding (09:00 - 12:00) y c2_colliding (10:30 - 12:30)
    const analysis = analyzeSchedule(baseSchedule, ['c1_colliding', 'c2_colliding']);

    assert.equal(analysis.hasCriticalErrors, true);
    assert.equal(analysis.counts.exactCollisions, 1);
    
    const collision = analysis.conflicts.find(c => c.type === 'exact_collision');
    assert.ok(collision);
    assert.equal(collision.severity, 'critical');
    assert.ok(collision.description.includes('Solapamiento temporal directo'));
  });

  it('Regla 2: Debe detectar sobrecarga diaria en la misma fecha sin solapamiento horario', () => {
    // c1_colliding (09:00 - 12:00) y c1_afternoon no (mismo modulo), probamos c1_afternoon (15:00-17:00) y c2_evening (18:00-20:00)
    const analysis = analyzeSchedule(baseSchedule, ['c1_afternoon', 'c2_evening']);

    assert.equal(analysis.hasCriticalErrors, false);
    assert.equal(analysis.counts.exactCollisions, 0);
    assert.equal(analysis.counts.sameDateCongestions, 1);

    const congestion = analysis.conflicts.find(c => c.type === 'same_date_congestion');
    assert.ok(congestion);
    assert.equal(congestion.severity, 'high');
  });

  it('Regla 3: Debe detectar turnaround crítico (< 24h) entre tarde y mañana siguiente', () => {
    // c2_evening (15 Jan 18:00 - 20:00) y c2_next_morning (16 Jan 09:00)
    // Gap: de 20:00 del 15 a 09:00 del 16 = 13 horas < 24h
    // Usamos c1_afternoon (15 Jan 15:00 - 17:00) y c2_next_morning (16 Jan 09:00): gap = 16h < 24h
    const analysis = analyzeSchedule(baseSchedule, ['c1_afternoon', 'c2_next_morning']);

    assert.equal(analysis.counts.turnaroundWarnings, 1);
    const turnaround = analysis.conflicts.find(c => c.type === 'critical_turnaround');
    assert.ok(turnaround);
    assert.equal(turnaround.severity, 'medium');
    assert.ok(turnaround.gapHours < 24);
  });

  it('Regla 4: Debe detectar múltiples llamamientos seleccionados para un mismo módulo (paracaídas)', () => {
    // c1_colliding y c1_alt pertenecen al mismo módulo m1
    const analysis = analyzeSchedule(baseSchedule, ['c1_colliding', 'c1_alt']);

    assert.equal(analysis.counts.multipleCalls, 1);
    const multi = analysis.conflicts.find(c => c.type === 'multiple_calls');
    assert.ok(multi);
    assert.equal(multi.severity, 'info');
    assert.equal(multi.moduleId, 'm1');
  });

  it('Regla 5: Debe calcular correctamente el colchón métrico de estudio y categorías', () => {
    // c1_colliding (15 Jan) y c3_spaced (25 Jan) -> diferencia de 10 días (>= 7 días -> optimal)
    const analysis = analyzeSchedule(baseSchedule, ['c1_colliding', 'c3_spaced']);

    assert.equal(analysis.timeline.length, 2);
    assert.equal(analysis.timeline[1].bufferBeforeDays, 10);
    assert.equal(analysis.timeline[1].bufferCategory, 'optimal');
    assert.equal(analysis.metrics.minBufferDays, 10);
    assert.equal(analysis.metrics.avgBufferDays, 10);
  });

  it('Debe clasificar colchones según la escala (riesgo 1-2 días, aceptable 3-6 días, óptimo >=7)', () => {
    // c1_colliding (15 Jan), c3_close (18 Jan) -> 3 días (acceptable)
    const analysisAcceptable = analyzeSchedule(baseSchedule, ['c1_colliding', 'c3_close']);
    assert.equal(analysisAcceptable.timeline[1].bufferBeforeDays, 3);
    assert.equal(analysisAcceptable.timeline[1].bufferCategory, 'acceptable');

    // c2_next_morning (16 Jan) y c3_close (18 Jan) -> 2 días (risk)
    const analysisRisk = analyzeSchedule(baseSchedule, ['c2_next_morning', 'c3_close']);
    assert.equal(analysisRisk.timeline[1].bufferBeforeDays, 2);
    assert.equal(analysisRisk.timeline[1].bufferCategory, 'risk');
  });

  it('Debe contabilizar créditos acumulados y estado de meta alcanzada', () => {
    const analysis = analyzeSchedule(baseSchedule, ['c1_alt', 'c2_next_morning', 'c3_spaced']);
    assert.equal(analysis.metrics.totalCredits, 18);
    assert.equal(analysis.metrics.targetCredits, 18);
    assert.equal(analysis.metrics.isTargetCreditsMet, true);
  });

  it('Debe detectar turnaround crítico (< 24h) a través del cambio de año natural', () => {
    const yearBoundarySchedule = normalizeSchedule({
      meta: { title: 'T', institution: 'I', academicYear: '2026/2027', session: 'S' },
      subjects: [
        {
          id: 'sub1',
          name: 'Examen Fin de Año',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'M1',
              calls: [
                { id: 'c_nye', date: '2026-12-31', time: '17:00', durationHours: 2 } // termina 19:00
              ]
            }
          ]
        },
        {
          id: 'sub2',
          name: 'Examen Año Nuevo',
          credits: 6,
          modules: [
            {
              id: 'm2',
              name: 'M2',
              calls: [
                { id: 'c_nyd', date: '2027-01-01', time: '09:00', durationHours: 2 } // inicia 09:00 (gap = 14h)
              ]
            }
          ]
        }
      ]
    });

    const analysis = analyzeSchedule(yearBoundarySchedule, ['c_nye', 'c_nyd']);
    assert.equal(analysis.counts.turnaroundWarnings, 1);
    const turnaround = analysis.conflicts.find(c => c.type === 'critical_turnaround');
    assert.ok(turnaround);
    assert.equal(turnaround.gapHours, 14);
  });

  it('Debe admitir selectedCallIds como Set, Array o ID único sin fallar', () => {
    const fromArray = analyzeSchedule(baseSchedule, ['c1_alt']);
    const fromSet = analyzeSchedule(baseSchedule, new Set(['c1_alt']));
    const fromSingle = analyzeSchedule(baseSchedule, 'c1_alt');

    assert.equal(fromArray.selectedCalls.length, 1);
    assert.equal(fromSet.selectedCalls.length, 1);
    assert.equal(fromSingle.selectedCalls.length, 1);
    assert.equal(fromArray.metrics.totalCredits, fromSet.metrics.totalCredits);
  });

  it('Debe calcular las oportunidades de repetición (appelli posteriores de reserva) para cada examen en la timeline', () => {
    // En baseSchedule, m1 tiene 3 llamamientos: c1_colliding (15 Jan 09:00), c1_afternoon (15 Jan 15:00), c1_alt (01 Feb 09:00)
    // Si seleccionamos c1_colliding, tiene 2 llamamientos posteriores en m1 (c1_afternoon y c1_alt)
    const analysis = analyzeSchedule(baseSchedule, ['c1_colliding', 'c3_spaced']);
    const m1Item = analysis.timeline.find(t => t.call.id === 'c1_colliding');
    assert.ok(m1Item);
    assert.equal(m1Item.subsequentCallsCount, 2);
    assert.equal(m1Item.subsequentCalls.length, 2);
    assert.ok(analysis.metrics.totalParachuteOpportunities >= 2);

    // c1_alt es la última fecha para m1 (01 Feb 09:00), por lo que no tiene llamadas posteriores
    const analysisLate = analyzeSchedule(baseSchedule, ['c1_alt', 'c3_spaced']);
    const m1LateItem = analysisLate.timeline.find(t => t.call.id === 'c1_alt');
    assert.ok(m1LateItem);
    assert.equal(m1LateItem.subsequentCallsCount, 0);
  });

  it('Robustez de fechas: parseDateTime maneja fechas inválidas o nulas sin retornar NaN', () => {
    const invalidDate = parseDateTime('fecha-invalida', '09:00');
    assert.ok(!isNaN(invalidDate.getTime()));
    assert.equal(invalidDate.getTime(), 0);

    const emptyDate = parseDateTime('', '');
    assert.ok(!isNaN(emptyDate.getTime()));
    assert.equal(emptyDate.getTime(), 0);

    const nullDate = parseDateTime(null, null);
    assert.ok(!isNaN(nullDate.getTime()));
    assert.equal(nullDate.getTime(), 0);
  });

  it('Entrada vacía: analyzeSchedule en horario sin asignaturas retorna métricas en cero sin lanzar excepción', () => {
    const emptySchedule = {
      meta: { title: 'Vacío', targetCredits: 30 },
      subjects: []
    };

    const analysis = analyzeSchedule(emptySchedule, []);
    assert.equal(analysis.hasCriticalErrors, false);
    assert.equal(analysis.counts.totalConflicts, 0);
    assert.equal(analysis.selectedCalls.length, 0);
    assert.equal(analysis.timeline.length, 0);
    assert.equal(analysis.metrics.totalCredits, 0);
    assert.equal(analysis.metrics.minBufferDays, 0);
    assert.equal(analysis.metrics.totalParachuteOpportunities, 0);
    assert.equal(analysis.metrics.totalRequiredModules, 0);
    assert.equal(analysis.metrics.coveredModulesCount, 0);
    assert.equal(analysis.metrics.coveragePercentage, 100);
  });

  it('Debe calcular métricas de cobertura de exámenes/módulos obligatorios y alertar de módulos pendientes', () => {
    // baseSchedule tiene 3 módulos requeridos: m1, m2, m3
    // Si seleccionamos solo c1_alt (m1) y c2_next_morning (m2):
    // Cubrimos 2 de 3 (67% de cobertura), quedando m3 pendiente
    const partialAnalysis = analyzeSchedule(baseSchedule, ['c1_alt', 'c2_next_morning']);
    assert.equal(partialAnalysis.metrics.totalRequiredModules, 3);
    assert.equal(partialAnalysis.metrics.coveredModulesCount, 2);
    assert.equal(partialAnalysis.metrics.coveragePercentage, 67);
    assert.equal(partialAnalysis.metrics.isAllModulesCovered, false);
    assert.equal(partialAnalysis.metrics.uncoveredModules.length, 1);
    assert.equal(partialAnalysis.metrics.uncoveredModules[0].moduleId, 'm3');

    const missingAlert = partialAnalysis.conflicts.find(c => c.type === 'uncovered_modules');
    assert.ok(missingAlert);
    assert.ok(missingAlert.description.includes('Módulo 3'));

    // Si seleccionamos los 3 módulos: cobertura 100% y 0 módulos pendientes
    const fullAnalysis = analyzeSchedule(baseSchedule, ['c1_alt', 'c2_next_morning', 'c3_spaced']);
    assert.equal(fullAnalysis.metrics.coveredModulesCount, 3);
    assert.equal(fullAnalysis.metrics.coveragePercentage, 100);
    assert.equal(fullAnalysis.metrics.isAllModulesCovered, true);
    assert.equal(fullAnalysis.metrics.uncoveredModules.length, 0);
    assert.ok(!fullAnalysis.conflicts.some(c => c.type === 'uncovered_modules'));
  });

  it('Debe descontar los días bloqueados del cálculo de colchón útil de estudio entre exámenes', () => {
    // c1_colliding (15 Jan) y c3_spaced (25 Jan) -> 10 días de calendario
    // Si el usuario bloquea 3 días intermedios (18, 19, 20 Jan):
    // El colchón útil debe ser 10 - 3 = 7 días
    const blockedDates = ['2027-01-18', '2027-01-19', '2027-01-20'];
    const analysisWithBlocked = analyzeSchedule(baseSchedule, ['c1_colliding', 'c3_spaced'], {
      blockedDates
    });

    assert.equal(analysisWithBlocked.timeline.length, 2);
    assert.equal(analysisWithBlocked.timeline[1].bufferBeforeDays, 7);
    assert.equal(analysisWithBlocked.metrics.minBufferDays, 7);

    // Si el usuario bloquea 5 días (18, 19, 20, 21, 22 Jan):
    // El colchón útil baja a 10 - 5 = 5 días (categoría acceptable en vez de optimal)
    const analysisMoreBlocked = analyzeSchedule(baseSchedule, ['c1_colliding', 'c3_spaced'], {
      blockedDates: [...blockedDates, '2027-01-21', '2027-01-22']
    });
    assert.equal(analysisMoreBlocked.timeline[1].bufferBeforeDays, 5);
    assert.equal(analysisMoreBlocked.timeline[1].bufferCategory, 'acceptable');
    assert.equal(analysisMoreBlocked.metrics.minBufferDays, 5);
  });
});
