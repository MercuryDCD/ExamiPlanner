const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateSchedule,
  normalizeSchedule,
  parseMarkdownTable,
  parseInput
} = require('../src/core/parser');

describe('Parser & Normalizer Test Suite', () => {

  const validSample = {
    meta: {
      title: 'Máster en IA',
      institution: 'Universidad de Bolonia',
      academicYear: '2026/2027',
      session: 'Invierno'
    },
    subjects: [
      {
        id: 'ml',
        name: 'Machine Learning',
        credits: 6,
        modules: [
          {
            id: 'ml_mod',
            name: 'ML Teoría',
            calls: [
              { id: 'c1', date: '2027-01-15', time: '09:00', durationHours: 3 }
            ]
          }
        ]
      }
    ]
  };

  it('debe validar un esquema correcto sin errores', () => {
    const res = validateSchedule(validSample);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  it('debe rechazar esquemas que no tengan meta o subjects', () => {
    const resNoMeta = validateSchedule({ subjects: [] });
    assert.equal(resNoMeta.valid, false);
    assert.ok(resNoMeta.errors.some(e => e.includes('meta')));

    const resNoSubjects = validateSchedule({
      meta: { title: 'T', institution: 'I', academicYear: 'Y', session: 'S' }
    });
    assert.equal(resNoSubjects.valid, false);
    assert.ok(resNoSubjects.errors.some(e => e.includes('subjects')));
  });

  it('debe rechazar llamadas con fechas que no sean YYYY-MM-DD', () => {
    const invalidDateSample = {
      meta: { title: 'T', institution: 'I', academicYear: 'Y', session: 'S' },
      subjects: [
        {
          id: 'sub',
          name: 'Asignatura',
          credits: 6,
          modules: [
            {
              id: 'm1',
              name: 'M1',
              calls: [
                { id: 'c1', date: '15/01/2027' } // formato incorrecto
              ]
            }
          ]
        }
      ]
    };
    const res = validateSchedule(invalidDateSample);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('YYYY-MM-DD')));
  });

  it('debe normalizar valores por defecto (creditUnit, colores, deadlines, icon)', () => {
    const normalized = normalizeSchedule(validSample);
    assert.equal(normalized.meta.creditUnit, 'CFU');
    assert.equal(normalized.meta.targetCredits, 6);
    assert.equal(normalized.meta.icon, '📅');
    assert.ok(normalized.subjects[0].color);
    assert.equal(normalized.subjects[0].defaultWeight, 3);
    // Deadline should auto-default to 4 days prior (2027-01-11)
    assert.equal(normalized.subjects[0].modules[0].calls[0].deadline, '2027-01-11');

    // Debe respetar icon personalizado
    const customIconSample = {
      ...validSample,
      meta: { ...validSample.meta, icon: '❄️' }
    };
    const normCustom = normalizeSchedule(customIconSample);
    assert.equal(normCustom.meta.icon, '❄️');

    // Debe rechazar icon inválido (no string)
    const invalidIconSample = {
      ...validSample,
      meta: { ...validSample.meta, icon: 123 }
    };
    const valRes = validateSchedule(invalidIconSample);
    assert.equal(valRes.valid, false);
    assert.ok(valRes.errors.some(e => e.includes('meta.icon')));
  });

  it('debe parsear tablas Markdown correctamente', () => {
    const mdTable = `
| Asignatura | Código | Módulo | Fecha | Hora | Duración | CFU | Dificultad |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Deep Learning | 91001 | DL Mod | 2027-02-10 | 14:00 | 3 | 6 | high |
| Deep Learning | 91001 | DL Mod | 2027-02-25 | 14:00 | 3 | 6 | high |
| Computer Vision| 91002 | CV Mod | 2027-02-18 | 10:00 | 2.5 | 6 | medium |
`;
    const schedule = parseMarkdownTable(mdTable, { title: 'Markdown Import' });
    assert.equal(schedule.meta.title, 'Markdown Import');
    assert.equal(schedule.subjects.length, 2);
    
    const dlSub = schedule.subjects.find(s => s.name.includes('Deep Learning'));
    assert.ok(dlSub);
    assert.equal(dlSub.modules[0].calls.length, 2);
    assert.equal(dlSub.modules[0].calls[0].date, '2027-02-10');
    assert.equal(dlSub.modules[0].calls[1].date, '2027-02-25');
  });

  it('parseInput debe autodetectar JSON y Markdown', () => {
    const jsonParsed = parseInput(JSON.stringify(validSample));
    assert.equal(jsonParsed.subjects.length, 1);

    const mdString = `
| Asignatura | Fecha |
| IA | 2027-01-20 |
`;
    const mdParsed = parseInput(mdString);
    assert.equal(mdParsed.subjects.length, 1);
  });

  it('debe auto-normalizar formatos de fecha DD/MM/YYYY y YYYY/MM/DD en tablas Markdown', () => {
    const mdTable = `
| Asignatura | Fecha |
| Matemáticas | 15/01/2027 |
| Física | 2027/02/10 |
`;
    const schedule = parseMarkdownTable(mdTable);
    const mathCall = schedule.subjects.find(s => s.name === 'Matemáticas').modules[0].calls[0];
    const physCall = schedule.subjects.find(s => s.name === 'Física').modules[0].calls[0];

    assert.equal(mathCall.date, '2027-01-15');
    assert.equal(physCall.date, '2027-02-10');
  });

  it('generateStandaloneHTML debe generar un HTML válido con título escapado y JSON embebido', () => {
    const { generateStandaloneHTML } = require('../src/core/generator');
    const sampleWithSpecialChars = {
      meta: {
        title: 'Máster & IA <Test>',
        institution: 'UNIBO',
        academicYear: '2026/2027',
        session: 'Invierno'
      },
      subjects: [
        {
          id: 'sub',
          name: 'Subject',
          credits: 6,
          modules: [
            {
              id: 'mod',
              name: 'Mod',
              calls: [
                { id: 'c1', date: '2027-01-20' }
              ]
            }
          ]
        }
      ]
    };

    const html = generateStandaloneHTML(sampleWithSpecialChars);
    assert.ok(html.includes('&amp;'));
    assert.ok(html.includes('&lt;Test&gt;'));
    assert.ok(html.includes('planner-schedule-data'));
    assert.ok(!html.includes('/* __SCHEDULE_JSON__ */'));
    assert.ok(html.includes('id="btn-session-dropdown"'));
    assert.ok(html.includes('id="session-modal"'));
    assert.ok(html.includes('examplan_sessions'));
  });

  it('debe parsear tablas Markdown con encabezados en italiano y fechas con puntos (DD.MM.YYYY)', () => {
    const italianMd = `
| Materia | Codice | CFU | Difficoltà | Data | Ora | Durata | Aula |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Ingegneria del Software | 00921 | 9 | alta | 18.01.2027 | 09:30 | 3 | Aula Magna |
| Ingegneria del Software | 00921 | 9 | alta | 08.02.2027 | 09:30 | 3 | Aula Magna |
| Reti di Calcolatori | 00922 | 6 | media | 25.01.2027 | 14:00 | 2 | Aula Ercolani |
`;
    const schedule = parseMarkdownTable(italianMd, { title: 'Sessione Invernale UNIBO' });
    assert.equal(schedule.subjects.length, 2);

    const isSub = schedule.subjects.find(s => s.code === '00921');
    assert.ok(isSub);
    assert.equal(isSub.difficulty, 'high');
    assert.equal(isSub.defaultWeight, 5);
    assert.equal(isSub.credits, 9);
    assert.equal(isSub.modules[0].calls.length, 2);
    assert.equal(isSub.modules[0].calls[0].date, '2027-01-18');
    assert.equal(isSub.modules[0].calls[1].date, '2027-02-08');

    const retiSub = schedule.subjects.find(s => s.code === '00922');
    assert.ok(retiSub);
    assert.equal(retiSub.difficulty, 'medium');
    assert.equal(retiSub.modules[0].calls[0].date, '2027-01-25');
  });

  it('validateSchedule admite allowEmptySubjects para inicializar desde estado vacío', () => {
    const emptySched = {
      meta: {
        title: 'Nuevo Plan',
        institution: 'UNIBO',
        academicYear: '2026/2027',
        session: 'Invernale'
      },
      subjects: []
    };

    const strictResult = validateSchedule(emptySched);
    assert.equal(strictResult.valid, false);

    const lenientResult = validateSchedule(emptySched, { allowEmptySubjects: true });
    assert.equal(lenientResult.valid, true);
    assert.equal(lenientResult.errors.length, 0);
  });

  it('debe limpiar comentarios JS (// y /* */) y trailing commas en JSON', () => {
    const jsonWithFlaws = `{
      // Comentario de cabecera
      "meta": {
        "title": "Máster IA",
        "institution": "UNIBO",
        "academicYear": "2026/2027",
        "session": "Invierno", // trailing comma
      },
      /* Comentario
         multilínea de materias */
      "subjects": [
        {
          "id": "so",
          "name": "Sistemas Operativos // con barras en texto",
          "credits": 6,
          "modules": [
            {
              "id": "so_mod",
              "name": "Módulo Único",
              "calls": [
                {
                  "id": "so_c1",
                  "date": "2027-01-22",
                  "time": "09:30",
                  "durationHours": 3,
                  "location": "Aula 3.1 // Edificio B, ",
                },
              ],
            },
          ],
        },
      ],
    }`;

    const parsed = parseInput(jsonWithFlaws);
    assert.equal(parsed.subjects.length, 1);
    assert.equal(parsed.subjects[0].name, 'Sistemas Operativos // con barras en texto');
    assert.equal(parsed.subjects[0].modules[0].calls[0].location, 'Aula 3.1 // Edificio B, ');
    assert.equal(parsed.subjects[0].modules[0].calls[0].date, '2027-01-22');
  });

  it('debe extraer bloque ```json ... ``` dentro de un README con texto conversacional de IA', () => {
    const aiReadme = `# Planificación generada por IA

Hola Dani! He procesado las capturas de pantalla de tu portal universitario.
Aquí tienes el calendario estructurado con todas las convocatorias:

\`\`\`json
{
  "meta": {
    "title": "Laurea Magistrale in AI",
    "institution": "Università di Bologna",
    "academicYear": "2026/2027",
    "session": "Invernale"
  },
  "subjects": [
    {
      "id": "nlp",
      "name": "Natural Language Processing",
      "credits": 6,
      "modules": [
        {
          "id": "nlp_mod",
          "name": "NLP Escrito",
          "calls": [
            {
              "id": "nlp_call_1",
              "date": "2027-01-18",
              "time": "10:00",
              "durationHours": 2.5
            },
            {
              "id": "nlp_call_2",
              "date": "2027-02-08",
              "time": "10:00",
              "durationHours": 2.5
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

¡Mucho éxito preparando los exámenes! Si necesitas mover algún llamamiento dímelo.`;

    const parsed = parseInput(aiReadme);
    assert.equal(parsed.meta.title, 'Laurea Magistrale in AI');
    assert.equal(parsed.subjects.length, 1);
    assert.equal(parsed.subjects[0].id, 'nlp');
    assert.equal(parsed.subjects[0].modules[0].calls.length, 2);
    assert.equal(parsed.subjects[0].modules[0].calls[0].date, '2027-01-18');
  });

  it('debe extraer bloque ``` ... ``` sin identificador json y con comentarios de IA', () => {
    const aiRawBlock = `Claro, aquí tienes los datos:

\`\`\`
{
  // Titulación
  "meta": {
    "title": "Grado en Informática",
    "institution": "UPM",
    "academicYear": "2026/2027",
    "session": "Enero",
  },
  "subjects": [
    {
      "id": "eda",
      "name": "Estructuras de Datos",
      "credits": 6,
      "modules": [
        {
          "id": "eda_m",
          "name": "Teoría y Práctica",
          "calls": [
            { "id": "eda_1", "date": "2027-01-12", "time": "15:00", "durationHours": 3, }
          ],
        }
      ],
    }
  ]
}
\`\`\`

Saludos cordiales.`;

    const parsed = parseInput(aiRawBlock);
    assert.equal(parsed.meta.title, 'Grado en Informática');
    assert.equal(parsed.subjects[0].name, 'Estructuras de Datos');
    assert.equal(parsed.subjects[0].modules[0].calls[0].time, '15:00');
  });

  it('debe parsear tablas Markdown envueltas en texto conversacional de IA', () => {
    const conversationalTable = `¡Buenas! A continuación te adjunto los exámenes detectados en la imagen:

| Asignatura | Codigo | CFU | Dificultad | Fecha | Hora | Duracion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Inteligencia Artificial | 501 | 6 | high | 2027-01-25 | 09:00 | 3 |
| Robótica Autónoma | 502 | 6 | medium | 2027-02-15 | 11:30 | 2 |

Cualquier cosa me comentas.`;

    const parsed = parseInput(conversationalTable);
    assert.equal(parsed.subjects.length, 2);
    assert.equal(parsed.subjects[0].name, 'Inteligencia Artificial');
    assert.equal(parsed.subjects[1].name, 'Robótica Autónoma');
    assert.equal(parsed.subjects[0].modules[0].calls[0].date, '2027-01-25');
  });

  it('debe extraer JSON sin bloques de código si está delimitado por llaves dentro del texto', () => {
    const textWithBareJson = `Te paso la configuración directamente:

{
  "meta": {
    "title": "Bioinformática",
    "institution": "UCM",
    "academicYear": "2026/2027",
    "session": "Febrero"
  },
  "subjects": [
    {
      "id": "genomica",
      "name": "Genómica Computacional",
      "credits": 6,
      "modules": [
        {
          "id": "gen_mod",
          "name": "General",
          "calls": [
            { "id": "c1", "date": "2027-02-02", "time": "09:00", "durationHours": 2 }
          ]
        }
      ]
    }
  ]
}

Listo para cargar en ExamPlanner.`;

    const parsed = parseInput(textWithBareJson);
    assert.equal(parsed.meta.title, 'Bioinformática');
    assert.equal(parsed.subjects[0].name, 'Genómica Computacional');
    assert.equal(parsed.subjects[0].modules[0].calls[0].date, '2027-02-02');
  });

  it('debe parsear e ingerir directamente el archivo oficial TEMPLATE_EXAMS.md', () => {
    const fs = require('fs');
    const path = require('path');
    const templatePath = path.resolve(__dirname, '../TEMPLATE_EXAMS.md');
    const content = fs.readFileSync(templatePath, 'utf8');

    const parsed = parseInput(content);
    assert.ok(parsed.meta.title.includes('Ingeniería Informática'));
    assert.ok(parsed.subjects.length >= 1);
    const ml = parsed.subjects.find(s => s.id === 'ml');
    assert.ok(ml);
    assert.equal(ml.modules[0].calls.length, 2);
    assert.equal(ml.modules[0].calls[0].date, '2027-01-14');
  });

  it('debe priorizar el bloque JSON válido cuando hay múltiples bloques (ej: plantilla e información real)', () => {
    const multiBlock = [
      '# Documentación de Exámenes',
      'A continuación la plantilla que debes rellenar:',
      '```json',
      JSON.stringify({ meta: { title: 'Plantilla Incompleta' }, subjects: [] }),
      '```',
      'Y a continuación los exámenes reales extraídos por la IA:',
      '```json',
      JSON.stringify({
        meta: {
          title: 'Plan Definitivo 2027',
          institution: 'UNIBO',
          academicYear: '2026/2027',
          session: 'Invernale'
        },
        subjects: [
          {
            id: 'so',
            name: 'Sistemi Operativi',
            credits: 6,
            modules: [
              {
                id: 'so_mod',
                name: 'Teoria',
                calls: [{ id: 'so_c1', date: '2027-01-20', time: '09:00', durationHours: 3 }]
              }
            ]
          }
        ]
      }),
      '```'
    ].join('\n');

    const parsed = parseInput(multiBlock);
    assert.equal(parsed.meta.title, 'Plan Definitivo 2027');
    assert.equal(parsed.subjects.length, 1);
    assert.equal(parsed.subjects[0].id, 'so');
    assert.equal(parsed.subjects[0].modules[0].calls[0].date, '2027-01-20');
  });

  it('debe extraer bloques de código con etiquetas jsonc o javascript y llaves incidentales en el texto', () => {
    const textWithTagsAndIncidentalBraces = [
      'Analizando sesión académica {Sesión Invierno 2027}:',
      '```jsonc',
      '// Comentario dentro de jsonc',
      '{',
      '  "meta": {',
      '    "title": "Ingeniería de Datos",',
      '    "institution": "UPM",',
      '    "academicYear": "2026/2027",',
      '    "session": "Enero"',
      '  },',
      '  "subjects": [',
      '    {',
      '      "id": "bd",',
      '      "name": "Bases de Datos",',
      '      "credits": 6,',
      '      "modules": [',
      '        {',
      '          "id": "bd_mod",',
      '          "name": "General",',
      '          "calls": [',
      '            { "id": "bd_1", "date": "2027-01-28", "time": "9:30", "durationHours": "3" }',
      '          ]',
      '        }',
      '      ]',
      '    }',
      '  ]',
      '}',
      '```',
      '¡Muchos éxitos con {tus exámenes}!'
    ].join('\n');

    const parsed = parseInput(textWithTagsAndIncidentalBraces);
    assert.equal(parsed.meta.title, 'Ingeniería de Datos');
    assert.equal(parsed.subjects.length, 1);
    assert.equal(parsed.subjects[0].modules[0].calls[0].time, '09:30');
    assert.equal(parsed.subjects[0].modules[0].calls[0].durationHours, 3);
  });

  it('debe recuperarse si el texto comienza con llave pero no es JSON directo', () => {
    const textStartingWithBrace = [
      '{Nota previa informativa sobre el curso}',
      'Aquí tienes los exámenes en JSON:',
      '```json',
      JSON.stringify({
        meta: { title: 'Master AI', institution: 'UNIBO', academicYear: '2026/2027', session: 'Winter' },
        subjects: [
          {
            id: 'ml',
            name: 'ML',
            credits: 6,
            modules: [{ id: 'm1', name: 'M1', calls: [{ id: 'c1', date: '2027-02-05' }] }]
          }
        ]
      }),
      '```'
    ].join('\n');

    const parsed = parseInput(textStartingWithBrace);
    assert.equal(parsed.meta.title, 'Master AI');
    assert.equal(parsed.subjects[0].id, 'ml');
  });

  describe('Nuevos planes trimestrales (Ventana de 3 meses)', () => {
    const fs = require('fs');
    const path = require('path');
    const { generateStandaloneHTML } = require('../src/core/generator');
    const { analyzeSchedule } = require('../src/core/analyzer');
    const { optimizeSchedule } = require('../src/core/optimizer');

    const schemaPath = path.resolve(__dirname, '../schemas/schedule_schema.json');
    const officialSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    function assertMatchesOfficialSchema(data, fileName) {
      assert.ok(data && typeof data === 'object', `${fileName} debe ser un objeto JSON.`);
      for (const req of officialSchema.required) {
        assert.ok(req in data, `${fileName} debe contener la clave raíz obligatoria "${req}".`);
      }
      for (const req of officialSchema.properties.meta.required) {
        assert.ok(req in data.meta, `${fileName}.meta debe contener "${req}".`);
      }
      assert.equal(typeof data.meta.title, 'string');
      assert.equal(typeof data.meta.academicYear, 'string');
      assert.equal(typeof data.meta.session, 'string');
      if (data.meta.icon) assert.equal(typeof data.meta.icon, 'string');
      if (data.meta.targetCredits) assert.ok(typeof data.meta.targetCredits === 'number' && data.meta.targetCredits >= 0);

      const allCallIds = new Set();
      assert.ok(Array.isArray(data.subjects) && data.subjects.length > 0, `${fileName} debe tener asignaturas.`);
      for (const sub of data.subjects) {
        for (const req of officialSchema.properties.subjects.items.required) {
          assert.ok(req in sub, `${fileName} subject ${sub.id} debe contener "${req}".`);
        }
        if (sub.difficulty) {
          assert.ok(
            officialSchema.properties.subjects.items.properties.difficulty.enum.includes(sub.difficulty),
            `${fileName} dificultad inválida en ${sub.id}: ${sub.difficulty}`
          );
        }
        if (sub.defaultWeight) {
          assert.ok(sub.defaultWeight >= 1 && sub.defaultWeight <= 5);
        }
        assert.ok(Array.isArray(sub.modules) && sub.modules.length > 0);
        for (const mod of sub.modules) {
          for (const req of officialSchema.properties.subjects.items.properties.modules.items.required) {
            assert.ok(req in mod, `${fileName} module ${mod.id} debe contener "${req}".`);
          }
          assert.ok(Array.isArray(mod.calls) && mod.calls.length > 0);
          for (const call of mod.calls) {
            for (const req of officialSchema.properties.subjects.items.properties.modules.items.properties.calls.items.required) {
              assert.ok(req in call, `${fileName} call ${call.id} debe contener "${req}".`);
            }
            assert.match(call.date, /^\d{4}-\d{2}-\d{2}$/, `${call.id} fecha inválida: ${call.date}`);
            if (call.time) assert.match(call.time, /^\d{2}:\d{2}$/, `${call.id} hora inválida: ${call.time}`);
            if (call.deadline) assert.match(call.deadline, /^\d{4}-\d{2}-\d{2}$/, `${call.id} deadline inválido: ${call.deadline}`);
            if (call.durationHours) assert.ok(call.durationHours >= 0.5);
            allCallIds.add(call.id);
          }
        }
      }

      if (data.presets) {
        assert.ok(Array.isArray(data.presets));
        for (const preset of data.presets) {
          for (const req of officialSchema.properties.presets.items.required) {
            assert.ok(req in preset, `${fileName} preset "${preset.name}" debe contener "${req}".`);
          }
          assert.ok(Array.isArray(preset.selectedCallIds));
          for (const callId of preset.selectedCallIds) {
            assert.ok(allCallIds.has(callId), `${fileName} preset "${preset.name}" referencia un callId inexistente: "${callId}"`);
          }
        }
      }
    }

    it('debe validar e ingerir plan_winter_3months.json (Enero - Marzo 2027, 5 asignaturas)', () => {
      const filePath = path.resolve(__dirname, '../schemas/examples/plan_winter_3months.json');
      const raw = fs.readFileSync(filePath, 'utf8');
      const schedule = JSON.parse(raw);

      assertMatchesOfficialSchema(schedule, 'plan_winter_3months.json');

      const val = validateSchedule(schedule);
      assert.equal(val.valid, true, `Errores de validación: ${val.errors.join(', ')}`);

      const parsed = parseInput(raw);
      assert.equal(parsed.meta.icon, '❄️');
      assert.equal(parsed.meta.targetCredits, 30);
      assert.equal(parsed.subjects.length, 5);
      assert.ok(parsed.presets.length >= 3);

      // Verificar que cubre convocatorias en los 3 meses (Enero, Febrero, Marzo 2027)
      const allDates = parsed.subjects.flatMap(s => s.modules.flatMap(m => m.calls.map(c => c.date)));
      assert.ok(allDates.some(d => d.startsWith('2027-01-')), 'Debe tener exámenes en enero 2027');
      assert.ok(allDates.some(d => d.startsWith('2027-02-')), 'Debe tener exámenes en febrero 2027');
      assert.ok(allDates.some(d => d.startsWith('2027-03-')), 'Debe tener exámenes en marzo 2027');

      // Verificar que los presets no presentan colisiones y cubren los créditos objetivo
      const norm = normalizeSchedule(parsed);
      for (const preset of norm.presets) {
        const analysis = analyzeSchedule(norm, preset.selectedCallIds);
        assert.equal(analysis.metrics.totalCredits, 30);
        assert.equal(analysis.conflicts.length, 0, `Preset "${preset.name}" no debe tener conflictos`);
      }

      // Verificación con el optimizador
      const opt = optimizeSchedule(norm, 'max-spacing');
      assert.equal(opt.selectedCallIds.length, 6);

      // Generación HTML standalone
      const html = generateStandaloneHTML(parsed);
      assert.ok(html.includes('Grado en Ingeniería Informática'));
      assert.ok(html.includes('planner-schedule-data'));
    });

    it('debe validar e ingerir plan_summer_3months.json (Mayo - Julio 2027, 6 asignaturas)', () => {
      const filePath = path.resolve(__dirname, '../schemas/examples/plan_summer_3months.json');
      const raw = fs.readFileSync(filePath, 'utf8');
      const schedule = JSON.parse(raw);

      assertMatchesOfficialSchema(schedule, 'plan_summer_3months.json');

      const val = validateSchedule(schedule);
      assert.equal(val.valid, true, `Errores de validación: ${val.errors.join(', ')}`);

      const parsed = parseInput(raw);
      assert.equal(parsed.meta.icon, '☀️');
      assert.equal(parsed.meta.targetCredits, 36);
      assert.equal(parsed.subjects.length, 6);
      assert.ok(parsed.presets.length >= 3);

      // Verificar que cubre convocatorias en los 3 meses (Mayo, Junio, Julio 2027)
      const allDates = parsed.subjects.flatMap(s => s.modules.flatMap(m => m.calls.map(c => c.date)));
      assert.ok(allDates.some(d => d.startsWith('2027-05-')), 'Debe tener exámenes en mayo 2027');
      assert.ok(allDates.some(d => d.startsWith('2027-06-')), 'Debe tener exámenes en junio 2027');
      assert.ok(allDates.some(d => d.startsWith('2027-07-')), 'Debe tener exámenes en julio 2027');

      // Verificar detección de turnarounds ajustados (<24h) y sobrecarga en el preset 1
      const norm = normalizeSchedule(parsed);
      const conflictAnalysis = analyzeSchedule(norm, norm.presets[0].selectedCallIds);
      assert.ok(
        conflictAnalysis.conflicts.some(c => c.type === 'same_date_congestion'),
        'Debe detectar sobrecarga diaria en la misma fecha (27 de mayo)'
      );
      assert.ok(
        conflictAnalysis.conflicts.some(c => c.type === 'critical_turnaround'),
        'Debe detectar turnaround crítico < 24h entre Bioquímica y Genómica'
      );

      // Preset 2 debe estar limpio de conflictos
      const cleanAnalysis = analyzeSchedule(norm, norm.presets[1].selectedCallIds);
      assert.equal(cleanAnalysis.conflicts.length, 0);

      // Verificación con el optimizador
      const opt = optimizeSchedule(norm, 'weighted-difficulty');
      assert.equal(opt.selectedCallIds.length, 6);

      // Generación HTML standalone
      const html = generateStandaloneHTML(parsed);
      assert.ok(html.includes('Grado en Biotecnología'));
      assert.ok(html.includes('planner-schedule-data'));
    });

    it('debe validar e ingerir plan_autumn_3months.json (Octubre - Diciembre 2026, 4 asignaturas modulares)', () => {
      const filePath = path.resolve(__dirname, '../schemas/examples/plan_autumn_3months.json');
      const raw = fs.readFileSync(filePath, 'utf8');
      const schedule = JSON.parse(raw);

      assertMatchesOfficialSchema(schedule, 'plan_autumn_3months.json');

      const val = validateSchedule(schedule);
      assert.equal(val.valid, true, `Errores de validación: ${val.errors.join(', ')}`);

      const parsed = parseInput(raw);
      assert.equal(parsed.meta.icon, '🍂');
      assert.equal(parsed.meta.targetCredits, 30);
      assert.equal(parsed.subjects.length, 4);
      assert.ok(parsed.presets.length >= 3);

      // Verificar que cubre convocatorias en los 3 meses (Octubre, Noviembre, Diciembre 2026)
      const allDates = parsed.subjects.flatMap(s => s.modules.flatMap(m => m.calls.map(c => c.date)));
      assert.ok(allDates.some(d => d.startsWith('2026-10-')), 'Debe tener exámenes en octubre 2026');
      assert.ok(allDates.some(d => d.startsWith('2026-11-')), 'Debe tener exámenes en noviembre 2026');
      assert.ok(allDates.some(d => d.startsWith('2026-12-')), 'Debe tener exámenes en diciembre 2026');

      // Verificar examen conjunto unificado en el preset 3 (misma asignatura a la misma hora = mismo examen físico)
      const norm = normalizeSchedule(parsed);
      const jointAnalysis = analyzeSchedule(norm, norm.presets[2].selectedCallIds);
      assert.equal(
        jointAnalysis.hasCriticalErrors,
        false,
        'Exámenes de distintos módulos pero misma asignatura a la vez son el mismo examen conjunto (sin colisión crítica)'
      );
      assert.equal(jointAnalysis.metrics.coveredModulesCount, 6, 'Debe cubrir los 6 módulos requeridos');

      // Preset 1 debe estar completamente limpio
      const cleanAnalysis = analyzeSchedule(norm, norm.presets[0].selectedCallIds);
      assert.equal(cleanAnalysis.conflicts.length, 0);
      assert.equal(cleanAnalysis.metrics.totalCredits, 30);

      // Verificación con el optimizador
      const opt = optimizeSchedule(norm, 'max-spacing');
      assert.equal(opt.selectedCallIds.length, 6);

      // Generación HTML standalone
      const html = generateStandaloneHTML(parsed);
      assert.ok(html.includes('Máster en Telecomunicaciones'));
      assert.ok(html.includes('planner-schedule-data'));
    });

    it('debe ingerir los 3 planes trimestrales cuando se suben envueltos en markdown o bloques de IA', () => {
      const winterPath = path.resolve(__dirname, '../schemas/examples/plan_winter_3months.json');
      const summerPath = path.resolve(__dirname, '../schemas/examples/plan_summer_3months.json');
      const autumnPath = path.resolve(__dirname, '../schemas/examples/plan_autumn_3months.json');

      const files = [winterPath, summerPath, autumnPath];
      for (const file of files) {
        const rawJson = fs.readFileSync(file, 'utf8');
        const aiWrapped = `# Calendario detectado por IA\n\nA continuación tienes los datos:\n\n\`\`\`json\n${rawJson}\n\`\`\`\n\n¡Mucho éxito!`;
        const parsed = parseInput(aiWrapped);
        assert.ok(parsed.subjects.length >= 4);
        assert.ok(parsed.meta.session);
      }
    });

    it('debe admitir y normalizar asignaturas sin módulos con escrito y oral en calls directas', () => {
      const directSample = {
        meta: {
          title: 'Grado en Matemáticas',
          academicYear: '2026/2027',
          session: 'Convocatoria Oficial'
        },
        subjects: [
          {
            id: 'calculo',
            name: 'Cálculo',
            shortName: 'CALC',
            credits: 6,
            evaluationMode: 'written_and_oral',
            calls: [
              { id: 'c_w1', date: '2027-01-14', time: '09:00', durationHours: 3, type: 'written' },
              { id: 'c_o1', date: '2027-01-20', time: '10:00', durationHours: 1, type: 'oral' }
            ]
          }
        ]
      };

      const val = validateSchedule(directSample);
      assert.equal(val.valid, true, 'Debe ser válido sin declarar módulos');

      const norm = normalizeSchedule(directSample);
      assert.equal(norm.subjects[0].hasModules, false);
      assert.equal(norm.subjects[0].modules.length, 1);
      assert.equal(norm.subjects[0].modules[0].calls.length, 2);
      assert.equal(norm.subjects[0].calls.length, 2);
      assert.equal(norm.subjects[0].evaluationMode, 'written_and_oral');
    });
  });
});


