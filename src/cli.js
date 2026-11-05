#!/usr/bin/env node
/**
 * ExamPlan Studio — Command Line Interface (CLI)
 * Generates an interactive, zero-build HTML exam planner from JSON or Markdown.
 *
 * Usage:
 *   node src/cli.js -i <datos.json> -o <salida.html>
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('node:util');
const { parseInput } = require('./core/parser');
const { generateFile } = require('./core/generator');
const { analyzeSchedule } = require('./core/analyzer');

function printHelp() {
  console.log(`
ExamPlan Studio — Universal Interactive Exam Planner Generator

USO:
  node src/cli.js -i <archivo_entrada> [opciones]

OPCIONES:
  -i, --input <ruta>       Ruta al archivo JSON o Markdown con las convocatorias (Obligatorio)
  -o, --output <ruta>      Ruta del archivo HTML generado (Por defecto: index.html)
  -t, --template <ruta>    Ruta a una plantilla HTML personalizada
  -h, --help               Muestra esta ayuda
  -v, --version            Muestra la versión instalada

EJEMPLOS:
  node src/cli.js -i schemas/examples/unibo_master_ai.json -o index.html
  node src/cli.js -i schemas/examples/standard_bachelor.json -o planner_grado.html
`);
}

function run() {
  const argOptions = {
    input: { type: 'string', short: 'i' },
    output: { type: 'string', short: 'o', default: 'index.html' },
    template: { type: 'string', short: 't' },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false }
  };

  let values;
  try {
    const parsed = parseArgs({ options: argOptions, allowPositionals: true });
    values = parsed.values;
  } catch (err) {
    console.error(`Error en argumentos: ${err.message}`);
    printHelp();
    process.exit(1);
  }

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.version) {
    const pkg = require('../package.json');
    console.log(`ExamPlan Studio v${pkg.version}`);
    process.exit(0);
  }

  if (!values.input) {
    console.error('Error: Debes especificar un archivo de entrada con -i o --input.\n');
    printHelp();
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), values.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: No se encontró el archivo de entrada: ${inputPath}`);
    process.exit(1);
  }

  console.log(`📖 Leyendo archivo de convocatorias: ${inputPath}`);
  const rawContent = fs.readFileSync(inputPath, 'utf8');

  let schedule;
  try {
    schedule = parseInput(rawContent);
  } catch (err) {
    console.error(`Error al procesar la entrada: ${err.message}`);
    process.exit(1);
  }

  const subjectCount = schedule.subjects.length;
  let callCount = 0;
  schedule.subjects.forEach(s => {
    (s.modules || []).forEach(m => {
      callCount += (m.calls || []).length;
    });
  });

  console.log(`✓ Datos validados: ${subjectCount} asignaturas, ${callCount} convocatorias detectadas.`);

  const outputPath = values.output;
  const genOptions = values.template ? { templatePath: path.resolve(process.cwd(), values.template) } : {};

  try {
    const writtenPath = generateFile(schedule, outputPath, genOptions);
    const stats = fs.statSync(writtenPath);
    const kb = (stats.size / 1024).toFixed(1);

    console.log(`\n🎉 ¡Plataforma interactiva generada con éxito!`);
    console.log(`   📁 Archivo: ${writtenPath} (${kb} KB)`);
    console.log(`   💡 Abre el archivo directamente en cualquier navegador con doble clic.\n`);
  } catch (err) {
    console.error(`Error al generar la plataforma HTML: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
