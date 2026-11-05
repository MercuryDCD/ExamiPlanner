# ExamPlan Studio

> **Universal Interactive Exam Planner Generator**

Generador y CLI ligero diseñado para transformar listas o esquemas de exámenes universitarios en plataformas visuales interactivas autocontenidas (`.html`).

## Características principales

* **Universal:** Compatible con sistemas de múltiples convocatorias (*appelli* como UNIBO) y sistemas clásicos (ordinaria/extraordinaria, parciales y finales).
* **Cero dependencias en el entregable final (*zero-build*):** El archivo `.html` resultante es 100% autónomo (Tailwind CSS vía CDN + JavaScript nativo), operable en local con doble clic, incrustable en Obsidian o publicable en GitHub Pages.
* **Motor de análisis y conflictos en vivo:** Detección reactiva de colisiones horarias exactas, sobrecarga diaria en la misma fecha, turnarounds críticos (< 24h), paracaídas de convocatorias múltiples y cálculo del colchón de estudio métrico entre pruebas.
* **Vista de calendario y agenda cronológica:** Calendario mensual interactivo con cambio de estado al vuelo, contador en vivo de créditos ECTS/CFU y presets de estrategias de examen.
* **Carga automática con IA y Drag & Drop:** Arrastra cualquier archivo `.json`, `.md` (README de IA) o `.txt` directamente sobre el navegador o usa el botón de carga rápida. Soporta extracción de bloques ```json generados por IA a partir de fotos de exámenes, portales universitarios y documentos PDF, con limpieza defensiva de comentarios y comas finales. Incluye plantilla lista para usar en [`TEMPLATE_EXAMS.md`](TEMPLATE_EXAMS.md) y botón "Prompt IA" en la interfaz.

## Estructura del proyecto

```text
exam-plan-studio/
├── templates/
│   ├── standalone_planner.html    # Plantilla maestra de la interfaz reactiva
│   └── partials/                  # Componentes reutilizables
├── schemas/
│   ├── schedule_schema.json       # JSON Schema para validación
│   └── examples/                  # Casos de ejemplo (UNIBO, estándar)
├── src/
│   ├── core/
│   │   ├── parser.js              # Ingesta (JSON, Markdown, README de IA)
│   │   ├── analyzer.js            # Motor de detección de conflictos y métricas
│   │   └── generator.js           # Inyector en plantilla estática
│   └── cli.js                     # CLI de generación
├── tests/                         # Suite de pruebas unitarias
├── TEMPLATE_EXAMS.md              # Prompt y esquema para rellenar con IA
├── GEMINI.md                      # Especificación arquitectónica y directivas
└── package.json
```

## Licencia

MIT

## Despliegue en GitHub Pages

El workflow `.github/workflows/pages.yml` ejecuta tests, regenera `index.html` y lo publica en cada push a `main`. Requiere **Settings → Pages → Source: GitHub Actions**.

