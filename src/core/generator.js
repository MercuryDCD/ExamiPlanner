/**
 * ExamPlan Studio — Standalone HTML Generator
 * Injects normalized schedule data and configuration into the standalone HTML template,
 * producing a zero-build, self-contained single-file planner.
 */

const fs = require('fs');
const path = require('path');
const { normalizeSchedule, validateSchedule } = require('./parser');

const DEFAULT_TEMPLATE_PATH = path.resolve(__dirname, '../../templates/standalone_planner.html');
const CLIENT_MODULES_DIR = path.resolve(__dirname, '../client');

const CLIENT_SCRIPTS_ORDER = [
  'utils.js',
  'parser.js',
  'i18n.js',
  'state.js',
  'analyzer.js',
  'optimizer.js',
  'ui-components.js',
  'timeline.js',
  'modal-manage.js',
  'app.js'
];

/**
 * Loads and concatenates modular client-side JavaScript scripts.
 * @returns {string} Bundled JavaScript content
 */
function getBundledClientScripts() {
  if (!fs.existsSync(CLIENT_MODULES_DIR)) {
    return '';
  }
  return CLIENT_SCRIPTS_ORDER.map(file => {
    const p = path.join(CLIENT_MODULES_DIR, file);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  }).join('\n');
}

/**
 * Generates the complete standalone HTML string.
 * @param {object} schedule Raw or normalized schedule data
 * @param {object} [options]
 * @param {string} [options.templatePath] Custom path to standalone_planner.html
 * @returns {string} Standalone HTML document string
 */
function generateStandaloneHTML(schedule, options = {}) {
  const templatePath = options.templatePath || DEFAULT_TEMPLATE_PATH;

  if (!fs.existsSync(templatePath)) {
    throw new Error(`No se encontró la plantilla HTML en: ${templatePath}`);
  }

  let templateContent = fs.readFileSync(templatePath, 'utf8');

  // Inject bundled client scripts if placeholder exists
  if (templateContent.includes('/* __CLIENT_SCRIPTS__ */')) {
    const bundledJs = getBundledClientScripts();
    templateContent = templateContent.replace('/* __CLIENT_SCRIPTS__ */', () => bundledJs);
  }

  // Validate and normalize
  const valResult = options.skipValidation ? { valid: true } : validateSchedule(schedule);
  if (!valResult.valid) {
    throw new Error(`Error de validación al generar HTML:\n- ${valResult.errors.join('\n- ')}`);
  }
  const normalized = normalizeSchedule(schedule);

  // Safe JSON serialization preventing </script> injection
  const safeJson = JSON.stringify(normalized, null, 2).replace(/<\/script>/gi, '<\\/script>');

  // Inject into template placeholder
  let outputHtml = templateContent.replace('/* __SCHEDULE_JSON__ */', () => safeJson);

  // Update page title if meta.title exists
  if (normalized.meta?.title) {
    const safeTitle = String(normalized.meta.title)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    outputHtml = outputHtml.replace(
      /<title>.*?<\/title>/i,
      `<title>${safeTitle} — ExamPlanner</title>`
    );
  }

  return outputHtml;
}

/**
 * Generates and writes the standalone HTML to a destination file.
 * @param {object} schedule
 * @param {string} outputPath
 * @param {object} [options]
 * @returns {string} Absolute path to generated file
 */
function generateFile(schedule, outputPath, options = {}) {
  const html = generateStandaloneHTML(schedule, options);
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  const targetDir = path.dirname(resolvedPath);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, html, 'utf8');
  return resolvedPath;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateStandaloneHTML,
    generateFile
  };
}
