# Plantilla de Extracción de Exámenes para Inteligencia Artificial (ExamPlan Studio)

Este documento contiene la **plantilla y prompt estándar** para transformar automáticamente capturas de pantalla, fotos de portales universitarios (Esse3, AlmaEsami, SIGMA, Moodle) o PDFs de convocatorias en la estructura JSON oficial que **ExamPlan Studio** ingiere al instante.

---

## 📋 Prompt para Copiar y Pegar en la IA

Copia el siguiente bloque de texto tal cual y envíaselo a cualquier IA multimodal (**Gemini, ChatGPT-4o, Claude 3.5/3.7**) junto con las fotos o capturas de tus exámenes:

```text
Actúa como un extractor experto de calendarios y exámenes universitarios.
Analiza con máxima precisión las imágenes adjuntas (capturas de portales de facultades, fotos de horarios, tablas de exámenes, appelli o llamamientos) y extrae TODOS los exámenes disponibles estructurados por ASIGNATURA y por MÓDULOS (partes o subasignaturas obligatorias).

ARQUITECTURA DE DATOS Y CONCEPTO CLAVE:
1. ASIGNATURA ("subjects"): Es la materia o curso académico global (ej: "Fundamentals of Artificial Intelligence", "Sistemas Distribuidos").
   - "name": Nombre oficial completo de la asignatura.
   - "shortName": Abreviatura o acrónimo conciso de 2 a 5 letras en mayúsculas (ej: "FAI", "ML", "SD", "CV"). ES OBLIGATORIO para que en la interfaz visual y calendario los módulos destaquen con total claridad.
   - "code": Código oficial si aparece (ej: "91244").
   - "credits": Créditos totales de la materia (ej: 12).
2. DIVISIÓN POR MÓDULOS (OBLIGATORIA):
   - Cada parte evaluable independiente es un módulo ("modules").
   - Si una asignatura se evalúa en un único examen global, crea 1 solo módulo con el nombre de la prueba.
   - Si la asignatura está dividida en partes (ej: Módulo 1, Módulo 2, Teoría, Práctica, Laboratorio), crea un módulo por cada parte.
   - Cada módulo debe tener su propio "name", su etiqueta breve "shortName" (ej: "M1", "M2", "M2+3"), su "difficulty" ("high", "medium", "low") y su peso individual "defaultWeight" (del 1 al 5) para configurar los sliders de dificultad por módulo.
3. REGLA FUNDAMENTAL DE PRESENTACIÓN:
   - Para aprobar la asignatura, el estudiante debe presentarse OBLIGATORIAMENTE a exactamente 1 examen (llamamiento) por cada módulo pendiente ("alreadyPassed": false). Cuentan como exámenes obligatorios distintos.
4. EXÁMENES SEPARADOS VS CONJUNTOS (MISMO EXAMEN FÍSICO):
   - Una asignatura puede tener exámenes separados para cada módulo (ej: Módulo 1 el 14 de enero), o exámenes de varios módulos juntos (ej: Módulos 2 y 3 juntos el 20 de enero).
   - REGLA DE COINCIDENCIA: Si dos exámenes de distintos módulos pero de la misma asignatura suceden a la vez (mismo día y a la misma hora), son el MISMO EXAMEN FÍSICO (se examinan a la vez en la misma sesión).
   - En este caso, mantén los módulos separados (para conservar sus sliders individuales) y asigna la misma fecha y hora a los llamamientos evaluados conjuntamente (o usa "moduleIds": ["mod_2", "mod_3"]). NO crees módulos separados a la misma hora para asignaturas distintas sin verificar el horario.
5. CONVOCATORIAS / LLAMAMIENTOS ("calls"):
   - Lista todas las fechas disponibles por módulo (1ª convocatoria, 2ª convocatoria, appelli, extraordinaria).
   - "date": Formato estricto YYYY-MM-DD.
   - "time": Formato 24h HH:MM (por defecto "09:00").
   - "durationHours": Decimal (ej: 2.5, 3).
   - "deadline": Límite de inscripción YYYY-MM-DD (si no se especifica, calcula 4 días antes del examen).
6. PRESETS ("presets"):
   - Incluye al menos una estrategia recomendada con "selectedCallIds" que cubra el 100% de los módulos pendientes.

Genera ÚNICAMENTE un bloque de código JSON válido con la siguiente estructura normalizada, sin explicaciones ni texto conversacional:

```json
{
  "meta": {
    "title": "Grado en Ingeniería Informática — Convocatoria Enero/Febrero 2027",
    "institution": "Universidad / Facultad de Informática",
    "academicYear": "2026/2027",
    "session": "Convocatoria Principal (Invernale / Enero)",
    "targetCredits": 18,
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
              "notes": "1º Llamamiento Ordinario"
            },
            {
              "id": "ml_call_2",
              "date": "2027-02-04",
              "time": "09:00",
              "durationHours": 2.5,
              "deadline": "2027-01-31",
              "location": "Aula 2.1",
              "notes": "2º Llamamiento Ordinario"
            }
          ]
        }
      ]
    },
    {
      "id": "fai",
      "name": "Fundamentals of Artificial Intelligence",
      "shortName": "FAI",
      "code": "91244",
      "credits": 12,
      "color": "violet",
      "difficulty": "high",
      "defaultWeight": 4,
      "modules": [
        {
          "id": "fai_m1",
          "name": "Módulo 1: Knowledge Representation",
          "shortName": "M1",
          "credits": 4,
          "difficulty": "medium",
          "defaultWeight": 3,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "fai_m1_c1",
              "date": "2027-01-18",
              "time": "09:00",
              "durationHours": 2.5,
              "deadline": "2027-01-14",
              "location": "Aula 1.1",
              "notes": "1º Appello Ordinario Módulo 1"
            },
            {
              "id": "fai_m1_c2",
              "date": "2027-02-09",
              "time": "09:00",
              "durationHours": 2.5,
              "deadline": "2027-02-05",
              "location": "Aula 2.1",
              "notes": "2º Appello Ordinario Módulo 1"
            }
          ]
        },
        {
          "id": "fai_m2",
          "name": "Módulo 2: Logic Programming",
          "shortName": "M2",
          "credits": 4,
          "difficulty": "high",
          "defaultWeight": 5,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "fai_m2_m3_c1",
              "date": "2027-01-26",
              "time": "09:00",
              "durationHours": 3.5,
              "deadline": "2027-01-22",
              "location": "Aula 1.3",
              "notes": "Examen Conjunto Módulo 2 y 3 (1º Appello)",
              "moduleIds": ["fai_m2", "fai_m3"]
            },
            {
              "id": "fai_m2_c2",
              "date": "2027-02-16",
              "time": "09:00",
              "durationHours": 2,
              "deadline": "2027-02-12",
              "location": "Aula 1.3",
              "notes": "2º Appello Módulo 2 Separado"
            }
          ]
        },
        {
          "id": "fai_m3",
          "name": "Módulo 3: Deep Learning",
          "shortName": "M3",
          "credits": 4,
          "difficulty": "high",
          "defaultWeight": 5,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "fai_m2_m3_c1",
              "date": "2027-01-26",
              "time": "09:00",
              "durationHours": 3.5,
              "deadline": "2027-01-22",
              "location": "Aula 1.3",
              "notes": "Examen Conjunto Módulo 2 y 3 (1º Appello)",
              "moduleIds": ["fai_m2", "fai_m3"]
            },
            {
              "id": "fai_m3_c2",
              "date": "2027-02-19",
              "time": "14:00",
              "durationHours": 2,
              "deadline": "2027-02-15",
              "location": "Laboratorio 2",
              "notes": "2º Appello Módulo 3 Separado"
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
      "selectedCallIds": ["ml_call_1", "fai_m1_c1", "fai_m2_m3_c1"]
    }
  ]
}
```

REGLAS ESTRICTAS DE RESPUESTA:
1. Devuelve SOLAMENTE el bloque ```json ... ```. No incluyas saludos ni texto posterior.
2. Formato de fechas: YYYY-MM-DD. Horas: HH:MM en 24h.
3. Sliders y pesos: Define "defaultWeight" (1 a 5) y "difficulty" en cada módulo individualmente.
4. Identificación visual: Asegura "shortName" para cada asignatura (ej: FAI, ML, SOR) y para cada módulo (ej: M1, M2, M2+3).
```

---

## 🚀 Cómo Usar el Resultado en ExamPlan Studio

1. **Arrastrar y Soltar Directo:** Guarda la respuesta de la IA como un archivo `.json` o `.md` y arrástralo sobre la web de ExamPlan Studio.
2. **Menú Cargar Plan:** Pulsa en el botón **"Cargar Plan"** de la barra superior y selecciona tu archivo o usa la opción de pegar texto JSON directamente.
3. El planificador detectará automáticamente los módulos, creará los **sliders individuales por módulo** con la abreviatura de su asignatura (`[FAI] Módulo 1`), unificará los exámenes conjuntos que ocurran a la misma hora sin generar falsos conflictos, y calculará al instante la combinación óptima de fechas.
