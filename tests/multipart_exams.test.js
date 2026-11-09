const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSchedule, normalizeCallType, normalizeAppelloIndex, normalizeEvaluationMode, normalizeOralBinding } = require('../src/core/parser');
const { analyzeSchedule } = require('../src/core/analyzer');
const { optimizeSchedule } = require('../src/core/optimizer');

describe('Multi-Part Exams Suite (Scritto, Orale, Laboratorio & Appello Binding)', () => {

  it('Normalizadores: reconocen tipos de examen, modalidades de evaluación y vinculación de appello', () => {
    assert.equal(normalizeEvaluationMode('written_and_oral'), 'written_and_oral');
    assert.equal(normalizeEvaluationMode('scritto_e_orale'), 'written_and_oral');
    assert.equal(normalizeEvaluationMode('escrito_y_oral'), 'written_and_oral');
    assert.equal(normalizeEvaluationMode('written_and_lab'), 'written_and_lab');
    assert.equal(normalizeEvaluationMode('standard'), 'standard');
    assert.equal(normalizeEvaluationMode(null), 'standard');

    assert.equal(normalizeOralBinding('same_appello'), 'same_appello');
    assert.equal(normalizeOralBinding('mismo_appello'), 'same_appello');
    assert.equal(normalizeOralBinding('any_subsequent'), 'any_subsequent');
    assert.equal(normalizeOralBinding('flexible'), 'any_subsequent');
    assert.equal(normalizeOralBinding(null), 'same_appello');

    assert.equal(normalizeCallType('written'), 'written');
    assert.equal(normalizeCallType('scritto'), 'written');
    assert.equal(normalizeCallType('escrito'), 'written');
    assert.equal(normalizeCallType('oral'), 'oral');
    assert.equal(normalizeCallType('orale'), 'oral');
    assert.equal(normalizeCallType('lab'), 'lab');
    assert.equal(normalizeCallType('laboratorio'), 'lab');
    assert.equal(normalizeCallType('', 'Examen Oral de Teoría'), 'oral');
    assert.equal(normalizeCallType('', 'Prueba escrita parcial'), 'written');

    assert.equal(normalizeAppelloIndex(1), 1);
    assert.equal(normalizeAppelloIndex('2'), 2);
    assert.equal(normalizeAppelloIndex(null, '1º Appello'), 1);
    assert.equal(normalizeAppelloIndex(null, 'Llamamiento 3'), 3);
  });

  it('Precedencia: oral antes del escrito (t_oral <= t_escrito) genera error crítico de precedencia', () => {
    const schedule = normalizeSchedule({
      meta: { title: 'Test Precedence' },
      subjects: [
        {
          id: 'sub1',
          name: 'Asignatura Mixta',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'Teoría y Práctica',
              evaluationMode: 'written_and_oral',
              oralBinding: 'any_subsequent',
              calls: [
                { id: 'w1', date: '2027-01-20', time: '09:00', type: 'written', appelloIndex: 1 },
                { id: 'o1', date: '2027-01-10', time: '10:00', type: 'oral', appelloIndex: 1 }
              ]
            }
          ]
        }
      ]
    });

    const analysis = analyzeSchedule(schedule, ['w1', 'o1']);
    assert.equal(analysis.hasCriticalErrors, true);
    assert.equal(analysis.counts.precedenceViolations, 1);
    const violation = analysis.conflicts.find(c => c.type === 'precedence_violation');
    assert.ok(violation);
    assert.equal(violation.severity, 'critical');
    assert.equal(violation.icon, '⛔');
  });

  it('Precedencia válida: oral después del escrito (t_oral > t_escrito) no genera violación de precedencia', () => {
    const schedule = normalizeSchedule({
      meta: { title: 'Test Precedence OK' },
      subjects: [
        {
          id: 'sub1',
          name: 'Asignatura Mixta',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'Teoría y Práctica',
              evaluationMode: 'written_and_oral',
              oralBinding: 'any_subsequent',
              calls: [
                { id: 'w1', date: '2027-01-10', time: '09:00', type: 'written', appelloIndex: 1 },
                { id: 'o1', date: '2027-01-20', time: '10:00', type: 'oral', appelloIndex: 1 }
              ]
            }
          ]
        }
      ]
    });

    const analysis = analyzeSchedule(schedule, ['w1', 'o1']);
    assert.equal(analysis.counts.precedenceViolations, 0);
    assert.equal(analysis.hasCriticalErrors, false);
  });

  it('Vinculación: oralBinding === "same_appello" prohíbe oral en appello distinto al del escrito', () => {
    const schedule = normalizeSchedule({
      meta: { title: 'Test Same Appello' },
      subjects: [
        {
          id: 'sub1',
          name: 'Sistemas Complejos',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'Módulo Único',
              evaluationMode: 'written_and_oral',
              oralBinding: 'same_appello',
              calls: [
                { id: 'w1', date: '2027-01-10', time: '09:00', type: 'written', appelloIndex: 1 },
                { id: 'o1', date: '2027-01-15', time: '09:00', type: 'oral', appelloIndex: 1 },
                { id: 'w2', date: '2027-02-01', time: '09:00', type: 'written', appelloIndex: 2 },
                { id: 'o2', date: '2027-02-06', time: '09:00', type: 'oral', appelloIndex: 2 }
              ]
            }
          ]
        }
      ]
    });

    // Combinación inválida: Escrito de Appello 1 con Oral de Appello 2
    const invalidAnalysis = analyzeSchedule(schedule, ['w1', 'o2']);
    assert.equal(invalidAnalysis.hasCriticalErrors, true);
    assert.equal(invalidAnalysis.counts.bindingViolations, 1);
    const violation = invalidAnalysis.conflicts.find(c => c.type === 'binding_violation');
    assert.ok(violation);
    assert.equal(violation.severity, 'critical');

    // Combinación válida: Escrito de Appello 1 con Oral de Appello 1
    const validAnalysis = analyzeSchedule(schedule, ['w1', 'o1']);
    assert.equal(validAnalysis.counts.bindingViolations, 0);
    assert.equal(validAnalysis.hasCriticalErrors, false);
  });

  it('Vinculación: oralBinding === "any_subsequent" permite oral en appello posterior', () => {
    const schedule = normalizeSchedule({
      meta: { title: 'Test Flexible Appello' },
      subjects: [
        {
          id: 'sub1',
          name: 'Inteligencia Artificial',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'Teoría',
              evaluationMode: 'written_and_oral',
              oralBinding: 'any_subsequent',
              calls: [
                { id: 'w1', date: '2027-01-10', time: '09:00', type: 'written', appelloIndex: 1 },
                { id: 'o2', date: '2027-02-05', time: '09:00', type: 'oral', appelloIndex: 2 }
              ]
            }
          ]
        }
      ]
    });

    const analysis = analyzeSchedule(schedule, ['w1', 'o2']);
    assert.equal(analysis.counts.bindingViolations, 0);
    assert.equal(analysis.hasCriticalErrors, false);
  });

  it('Orphan Oral: Seleccionar examen oral sin escrito previo genera aviso de prerrequisito faltante', () => {
    const schedule = normalizeSchedule({
      meta: { title: 'Test Orphan' },
      subjects: [
        {
          id: 'sub1',
          name: 'Materia X',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'M1',
              evaluationMode: 'written_and_oral',
              calls: [
                { id: 'w1', date: '2027-01-10', time: '09:00', type: 'written', appelloIndex: 1 },
                { id: 'o1', date: '2027-01-20', time: '09:00', type: 'oral', appelloIndex: 1 }
              ]
            }
          ]
        }
      ]
    });

    // Solo oral seleccionado
    const analysis = analyzeSchedule(schedule, ['o1']);
    assert.equal(analysis.counts.missingWrittenPrerequisites, 1);
    const missingAlert = analysis.conflicts.find(c => c.type === 'missing_written_prerequisite');
    assert.ok(missingAlert);
    assert.equal(missingAlert.severity, 'high');
  });

  it('Cobertura de módulo: written_and_oral solo cuenta como cubierto si ambos (escrito y oral) están seleccionados', () => {
    const schedule = normalizeSchedule({
      meta: { title: 'Test Coverage', targetCredits: 6 },
      subjects: [
        {
          id: 'sub1',
          name: 'Materia Completa',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'M1',
              credits: 6,
              evaluationMode: 'written_and_oral',
              calls: [
                { id: 'w1', date: '2027-01-10', time: '09:00', type: 'written', appelloIndex: 1 },
                { id: 'o1', date: '2027-01-20', time: '09:00', type: 'oral', appelloIndex: 1 }
              ]
            }
          ]
        }
      ]
    });

    // Solo escrito: no cubierto
    const analysisWrittenOnly = analyzeSchedule(schedule, ['w1']);
    assert.equal(analysisWrittenOnly.metrics.coveredModulesCount, 0);
    assert.equal(analysisWrittenOnly.metrics.isAllModulesCovered, false);
    assert.equal(analysisWrittenOnly.metrics.totalCredits, 0);

    // Solo oral: no cubierto
    const analysisOralOnly = analyzeSchedule(schedule, ['o1']);
    assert.equal(analysisOralOnly.metrics.coveredModulesCount, 0);
    assert.equal(analysisOralOnly.metrics.isAllModulesCovered, false);

    // Ambos: cubierto al 100%
    const analysisBoth = analyzeSchedule(schedule, ['w1', 'o1']);
    assert.equal(analysisBoth.metrics.coveredModulesCount, 1);
    assert.equal(analysisBoth.metrics.isAllModulesCovered, true);
    assert.equal(analysisBoth.metrics.totalCredits, 6);
  });

  it('Optimizador: selecciona pares válidos (escrito + oral) respetando precedencia y appello', () => {
    const schedule = normalizeSchedule({
      meta: { title: 'Test Optimizer Multi-part' },
      subjects: [
        {
          id: 'sub1',
          name: 'Asignatura con Oral Obligatorio',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'Módulo Examen Mixto',
              evaluationMode: 'written_and_oral',
              oralBinding: 'same_appello',
              calls: [
                { id: 'w1', date: '2027-01-10', time: '09:00', type: 'written', appelloIndex: 1 },
                { id: 'o1', date: '2027-01-14', time: '09:00', type: 'oral', appelloIndex: 1 },
                { id: 'w2', date: '2027-02-01', time: '09:00', type: 'written', appelloIndex: 2 },
                { id: 'o2', date: '2027-02-05', time: '09:00', type: 'oral', appelloIndex: 2 }
              ]
            }
          ]
        }
      ]
    });

    const optResult = optimizeSchedule(schedule, 'max-spacing');
    assert.ok(optResult.selectedCallIds.length === 2);

    // Debe contener 1 escrito y 1 oral del MISMO appello
    const hasAppello1Pair = optResult.selectedCallIds.includes('w1') && optResult.selectedCallIds.includes('o1');
    const hasAppello2Pair = optResult.selectedCallIds.includes('w2') && optResult.selectedCallIds.includes('o2');
    assert.ok(hasAppello1Pair || hasAppello2Pair);

    // El resultado analizado no debe tener errores críticos
    const analysis = analyzeSchedule(schedule, optResult.selectedCallIds);
    assert.equal(analysis.hasCriticalErrors, false);
    assert.equal(analysis.counts.precedenceViolations, 0);
    assert.equal(analysis.counts.bindingViolations, 0);
    assert.equal(analysis.metrics.isAllModulesCovered, true);
  });

  it('No interferencia: asignaturas estándar con 1 examen siguen funcionando sin alertas espurias', () => {
    const schedule = normalizeSchedule({
      meta: { title: 'Standard Subject' },
      subjects: [
        {
          id: 'sub_std',
          name: 'Cálculo',
          credits: 6,
          modules: [
            {
              id: 'm_std',
              name: 'Cálculo',
              evaluationMode: 'standard',
              calls: [
                { id: 'c1', date: '2027-01-12', time: '09:00' },
                { id: 'c2', date: '2027-02-02', time: '09:00' }
              ]
            }
          ]
        }
      ]
    });

    const analysis = analyzeSchedule(schedule, ['c1']);
    assert.equal(analysis.hasCriticalErrors, false);
    assert.equal(analysis.counts.precedenceViolations, 0);
    assert.equal(analysis.counts.bindingViolations, 0);
    assert.equal(analysis.counts.missingWrittenPrerequisites, 0);
    assert.equal(analysis.metrics.coveredModulesCount, 1);
  });

});
