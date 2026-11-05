# Project: ExamPlan Studio — Universal Interactive Exam Planner Generator

## 1. Project Overview & Vision
**ExamPlan Studio** es un generador y CLI ligero diseñado para transformar listas o esquemas de exámenes universitarios en plataformas visuales interactivas autocontenidas (`.html`).

### Objetivos clave y portabilidad
* **Universal para cualquier universidad o titulación:** Compatible con sistemas de múltiples convocatorias/llamamientos (*appelli* italianos como UNIBO) y sistemas clásicos (ordinaria/extraordinaria, parciales y finales), con soporte para asignaturas divididas en módulos evaluables por separado o conjuntamente.
* **Cero dependencias en el entregable final:** El código fuente está modularizado para facilitar el mantenimiento (`src/core/` y `src/client/`), pero el producto generado por el CLI (`index.html`) es un único archivo `.html` 100% autónomo (Tailwind CSS vía CDN + JavaScript nativo empaquetado en línea) que funciona haciendo doble clic en local, incrustado en Obsidian o alojado en GitHub Pages, sin servidor ni compiladores pesados (*zero-build*).

---

## 2. Estructura del Repositorio

```text
exam-plan-studio/
├── .gemini/                       # Configuración de agentes y skills de Antigravity
├── templates/
│   └── standalone_planner.html    # Plantilla HTML maestra (inyecta datos y módulos cliente)
├── schemas/
│   ├── schedule_schema.json       # JSON Schema que valida la entrada
│   └── examples/
│       ├── unibo_master_ai.json   # Ejemplo modular con appelli italianos
│       └── standard_bachelor.json # Ejemplo estándar (ordinaria/extraordinaria)
├── src/
│   ├── core/                      # Motores Node.js / Isomórficos
│   │   ├── parser.js              # Ingesta y normalización (JSON, tablas Markdown)
│   │   ├── analyzer.js            # Detección de conflictos, exámenes conjuntos y días libres
│   │   ├── optimizer.js           # Motor de búsqueda y optimización combinatoria
│   │   └── generator.js           # Empaquetador de src/client/*.js e inyector en HTML
│   ├── client/                    # Módulos del cliente (concatenados en orden por generator.js)
│   │   ├── utils.js               # Paleta de colores, escapeHtml, generación de acrónimos
│   │   ├── parser.js              # Validación, normalización e ingesta en navegador
│   │   ├── i18n.js                # Internacionalización trilingüe (ES / EN / IT) e iconos
│   │   ├── state.js               # Estado reactivo, multi-sesión y persistencia localStorage
│   │   ├── analyzer.js            # Motor de análisis en cliente y sincronización de conjuntos
│   │   ├── optimizer.js           # Optimizador combinatorio en cliente (Max-Min y Ponderado)
│   │   ├── ui-components.js       # Cabecera, KPIs, sliders, calendario de 3 meses y modales
│   │   ├── timeline.js            # Agenda cronológica, exportación .ics y resumen Markdown
│   │   ├── modal-manage.js        # CRUD de asignaturas/módulos/llamamientos y plantilla IA
│   │   └── app.js                 # Eventos globales, importación drag-and-drop y arranque
│   └── cli.js                     # CLI para terminal (node src/cli.js -i datos.json -o index.html)
├── tests/
│   ├── analyzer.test.js           # Tests unitarios del motor de conflictos
│   ├── optimizer.test.js          # Tests unitarios del motor de optimización
│   ├── parser.test.js             # Tests de robustez de parsing
│   └── sessions.test.js           # Tests de integración, multi-sesión, i18n y UI
├── GEMINI.md                      # Directivas del asistente y arquitectura
├── package.json                   # Scripts (npm test, npm run build:example)
└── README.md                      # Documentación de uso y especificación del JSON
```

---

## 3. Especificación del Esquema de Entrada (Normalized Schema)

Cualquier conjunto de exámenes se describe mediante una estructura JSON normalizada con soporte para abreviaturas visuales (`shortName`) tanto en asignaturas como en módulos:

```json
{
  "meta": {
    "title": "Grado / Máster — Convocatoria",
    "institution": "Nombre de la Universidad",
    "academicYear": "2026/2027",
    "session": "Invierno / Verano / Otoño",
    "icon": "❄️",
    "targetCredits": 30,
    "creditUnit": "CFU / ECTS"
  },
  "subjects": [
    {
      "id": "fai",
      "name": "Fundamentals of Artificial Intelligence",
      "shortName": "FAI",
      "code": "91244",
      "credits": 12,
      "color": "indigo",
      "difficulty": "high",
      "defaultWeight": 4,
      "modules": [
        {
          "id": "fai_m1",
          "name": "Módulo 1: Búsqueda y Lógica",
          "shortName": "M1",
          "credits": 6,
          "difficulty": "high",
          "defaultWeight": 4,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "fai_m1_c1",
              "date": "2027-01-14",
              "time": "09:00",
              "durationHours": 2,
              "deadline": "2027-01-10",
              "location": "Aula Magna",
              "notes": "1º Appello M1"
            }
          ]
        },
        {
          "id": "fai_m2",
          "name": "Módulo 2: Representación y Planificación",
          "shortName": "M2",
          "credits": 3,
          "difficulty": "medium",
          "defaultWeight": 3,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "fai_m2_joint",
              "date": "2027-01-25",
              "time": "14:00",
              "durationHours": 3,
              "deadline": "2027-01-21",
              "location": "Lab 2",
              "notes": "Examen conjunto M2+M3"
            }
          ]
        },
        {
          "id": "fai_m3",
          "name": "Módulo 3: Aprendizaje Automático Básico",
          "shortName": "M3",
          "credits": 3,
          "difficulty": "medium",
          "defaultWeight": 3,
          "alreadyPassed": false,
          "calls": [
            {
              "id": "fai_m3_joint",
              "date": "2027-01-25",
              "time": "14:00",
              "durationHours": 3,
              "deadline": "2027-01-21",
              "location": "Lab 2",
              "notes": "Examen conjunto M2+M3"
            }
          ]
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "Estrategia Recomendada",
      "description": "Explicación breve del criterio de selección",
      "selectedCallIds": ["fai_m1_c1", "fai_m2_joint", "fai_m3_joint"]
    }
  ]
}
```

### Reglas de Identificación Visual y Exámenes Conjuntos
* **Abreviaturas (`shortName`):** Cada asignatura define un `shortName` conciso (2–5 letras, ej. `"FAI"`, `"ML"`, `"DLCV"`) y cada módulo su `shortName` (2–4 caracteres, ej. `"M1"`, `"M2"`, `"LAB"`). En el calendario se muestra siempre `shortName` (o `shortName · modShortName` si la asignatura tiene varios módulos) centrado sobre el bloque del examen y en las etiquetas de días de estudio.
* **Exámenes Conjuntos (Mismo Examen Físico):** Si dos o más módulos de la **misma asignatura** tienen convocatorias con la misma `date` y `time` (o comparten `moduleIds`), el motor los agrupa bajo una clave `jointExamKey`:
  * En el calendario se renderizan como un **único botón unificado** (`FAI · M2+M3`).
  * Al hacer clic o ejecutar el optimizador, todos los llamamientos hermanos se seleccionan o deseleccionan atómicamente.
  * No generan falsas alertas de colisión ni congestión entre sí, y cuentan como un único bloque temporal en el cálculo de días de estudio.

---

## 4. Reglas del Motor de Análisis y Conflictos (`analyzer.js`)

El motor evalúa reactivamente cualquier combinación de exámenes seleccionados:

1. **Colisión exacta (0 horas de margen):**  
   * Condición: Misma fecha y solapamiento entre horas de inicio y fin (`durationHours`) de exámenes distintos (excluyendo módulos que comparten `jointExamKey`).
   * Nivel: ⛔ **Error crítico / Bloqueo**.
2. **Congestión en la misma fecha:**  
   * Condición: Misma fecha con horas distintas.
   * Nivel: ⚠️ **Aviso alto (Sobrecarga diaria)**.
3. **Turnaround crítico (< 24 horas):**  
   * Condición: Examen de tarde seguido de examen a la mañana siguiente con menos de 24h de diferencia.
   * Nivel: ⏳ **Aviso medio (Falta de descanso)**.
4. **Múltiples convocatorias del mismo módulo:**  
   * Condición: Más de un llamamiento activo para el mismo módulo (convocatoria de reserva/paracaídas).
   * Nivel: ℹ️ **Informativo (Convocatoria de paracaídas)**.
5. **Cálculo de colchón de estudio (Buffer métrico):**  
   * Ordena cronológicamente los exámenes físicos activos y calcula la diferencia entera de días:
     * $\ge 7\text{ días}$: Óptimo (Verde).
     * $3\text{--}6\text{ días}$: Aceptable (Azul/Amarillo).
     * $1\text{--}2\text{ días}$: Riesgo (Naranja/Rojo).

---

## 5. Motor de Optimización y Recomendación (`optimizer.js`)

Algoritmo determinista que encuentra la selección óptima de llamamientos (1 llamamiento por módulo pendiente):

1. **Modo Maximizar Espaciado (Max-Min Buffer):**
   * Maximiza el cuello de botella temporal: $\max \min_i (\Delta t_i)$.
   * Desempate mediante maximización de la suma de colchones $\sum \Delta t_i$ y minimización de la varianza entre intervalos para garantizar una distribución homogénea sin apelotonamientos locales.
   * Soporta el modo **Red de Seguridad (`prioritizeSafety`)**, que bonifica dejar convocatorias posteriores libres como paracaídas.

2. **Modo Prioridad por Dificultad (Sliders Ponderados por Módulo):**
   * Cada módulo cuenta con un factor de peso $w_j \in [1, 5]$ configurable por el usuario mediante controles deslizantes en la interfaz.
   * Asignación del colchón anterior: El colchón de preparación crítico para el examen $e_i$ es el intervalo desde el examen inmediatamente anterior $e_{i-1}$ ($\Delta t_i$).
   * Función de idoneidad (*fitness function*):
     $$\text{Score}(S) = \sum_{i=1}^{n} \left( w_{e_i} \cdot \ln(1 + \Delta t_i) \right) - \sum \text{Penalizaciones}$$
     * Penalización crítica: $-\infty$ ante colisiones exactas o solapamientos.
     * Penalización moderada: Intervalos $\Delta t_i < 24\text{ h}$ o múltiples exámenes en la misma fecha.

3. **Garantía de Rendimiento en Cliente:**
   * Al ser el espacio combinatorio acotado ($\prod |Calls_k| \le 10^4$), la resolución se realiza en el hilo del navegador en $< 10\text{ ms}$ mediante búsqueda exhaustiva podada (*branch-and-bound*), prescindiendo de dependencias externas.

---

## 6. Requisitos del Entregable Standalone (`.html`)

* **Vista de Calendario de 3 Meses al 100% de Zoom (`lg:grid-cols-3`):**
  * Despliegue simultáneo de hasta 3 meses en paralelo sin necesidad de reducir el zoom del navegador.
  * Etiquetas de examen centradas mostrando la abreviatura (`shortName` / `shortName · modShortName`) en lugar de la fecha.
  * Planificación diaria interactiva (`dayPlans`): clic en cualquier día o en `✏️` permite marcar un día como **No disponible / Bloqueado (`🚫`)** o **Día de Estudio (`📖`)** asignado a una asignatura (mostrando su `shortName` centrado en la celda).
* **Panel de Control, Multi-Sesión y Optimización:**
  * Selector y gestor de múltiples sesiones independientes en `localStorage` con iconos automáticos según la época del año o temática.
  * Contador en vivo de módulos/exámenes obligatorios cubiertos (`X / Total`).
  * Botones **"Maximizar Espaciado"**, **"Optimizar con Sliders de Dificultad"** y conmutador **"Red de Seguridad"**.
  * **Sliders de Dificultad / Prioridad (1 a 5)** individuales por cada módulo pendiente.
* **Internacionalización Trilingüe (`ES → EN → IT`):** Rotación instantánea entre español, inglés e italiano en toda la interfaz, meses, días de la semana y alertas.
* **Identidad en Navegador:** Actualización dinámica de `document.title` con el nombre de la sesión/plan activo y *favicon* SVG embebido.
* **Modo Oscuro / Claro:** Basado en tokens semánticos CSS y persistido en `localStorage`.

---

## 7. Directivas para Antigravity en este Repositorio

* **Flujo de Desarrollo Modular:** Edita siempre los módulos en `src/client/*.js`, `src/core/*.js` o la estructura HTML en `templates/standalone_planner.html`, y ejecuta `npm run build:example` (`node src/cli.js -i schemas/examples/unibo_master_ai.json -o index.html`) para regenerar el entregable autónomo `index.html`.
* **Garantía Zero-Build para el Usuario Final:** No introduzcas herramientas de compilación externas (Webpack, Vite) ni dependencias runtime. `src/core/generator.js` se encarga de concatenar e inyectar `src/client/*.js` en `index.html`.
