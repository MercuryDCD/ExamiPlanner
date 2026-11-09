/**
 * ExamPlan Studio — Parser & Normalizer
 * Ingests JSON or Markdown tables, validates against schema rules,
 * and normalizes the schedule object into a standard runtime model.
 */

const COLOR_PALETTE = [
  'indigo',
  'violet',
  'emerald',
  'amber',
  'rose',
  'sky',
  'cyan',
  'fuchsia',
  'teal',
  'orange'
];

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'e', 'o', 'u', 'para', 'con', 'por', 'sobre',
  'of', 'the', 'and', 'in', 'for', 'to', 'with', 'at', 'by', 'on', 'from',
  'di', 'del', 'della', 'dei', 'degli', 'ed', 'il', 'lo', 'la', 'i', 'gli', 'le', 'per', 'con', 'in', 'su'
]);

function generateSubjectAcronym(name) {
  if (!name || typeof name !== 'string') return 'ASIG';
  const clean = name.trim().replace(/[^\w\s\u00C0-\u017F]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  const significant = words.filter(w => !STOP_WORDS.has(w.toLowerCase()));
  if (significant.length > 1) {
    return significant.map(w => w[0].toUpperCase()).join('').slice(0, 6);
  }
  if (words.length > 1) {
    return words.map(w => w[0].toUpperCase()).join('').slice(0, 6);
  }
  const single = words[0] || 'ASIG';
  return single.length <= 4 ? single.toUpperCase() : single.slice(0, 3).toUpperCase();
}

function generateModuleShortName(name, modIndex = 0, totalMods = 1) {
  if (!name || typeof name !== 'string') {
    return totalMods > 1 ? `M${modIndex + 1}` : '';
  }
  const trimmed = name.trim();
  // Check if it already mentions module numbers e.g. "Modulo 1", "Módulo 2", "M1", "M2+3", "Part 1"
  const mMatch = trimmed.match(/\b(?:m[oó]dulo|module|mod|part|parcial)\s*(\d+(?:\s*(?:y|\+|&|-)\s*\d+)?)\b/i);
  if (mMatch) {
    const rawNum = mMatch[1].replace(/\s*(?:y|\+|&)\s*/g, '+').replace(/\s*-\s*/g, '-');
    return `M${rawNum}`;
  }
  const directMatch = trimmed.match(/^M\d+(?:\+\d+)?$/i);
  if (directMatch) {
    return directMatch[0].toUpperCase();
  }
  if (totalMods > 1) {
    return `M${modIndex + 1}`;
  }
  return '';
}

function normalizeDateStr(str) {
  if (!str) return '';
  let s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(s)) {
    s = s.slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ymd = s.match(/^(\d{4})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return s;
}

function normalizeTimeStr(str) {
  if (!str) return '09:00';
  const s = String(str).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hh = parseInt(match[1], 10);
    const mm = parseInt(match[2], 10);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  return '09:00';
}

function normalizeDifficulty(val) {
  const d = String(val || '').toLowerCase().trim();
  if (['high', 'alta', 'alto', 'difficile', '5'].includes(d)) return 'high';
  if (['low', 'baja', 'basso', 'bassa', 'facile', '1'].includes(d)) return 'low';
  return 'medium';
}

function normalizeEvaluationMode(val) {
  const v = String(val || '').toLowerCase().trim();
  if (['written_and_oral', 'scritto_orale', 'escrito_y_oral', 'oral', 'scritto_e_orale'].includes(v)) return 'written_and_oral';
  if (['written_and_lab', 'scritto_lab', 'escrito_y_lab', 'lab', 'scritto_e_lab'].includes(v)) return 'written_and_lab';
  return 'standard';
}

function normalizeOralBinding(val) {
  const v = String(val || '').toLowerCase().trim();
  if (['any_subsequent', 'flexible', 'cualquiera', 'subsequent', 'posterior'].includes(v)) return 'any_subsequent';
  return 'same_appello';
}

function normalizeCallType(val, notes = '', modName = '') {
  const v = String(val || '').toLowerCase().trim();
  if (['written', 'scritto', 'escrito'].includes(v)) return 'written';
  if (['oral', 'orale'].includes(v)) return 'oral';
  if (['lab', 'laboratorio', 'practica', 'práctica'].includes(v)) return 'lab';
  const combined = `${notes} ${modName}`.toLowerCase();
  if (/\b(orale|oral)\b/.test(combined)) return 'oral';
  if (/\b(scritto|escrito|teor[ií]a|parcial)\b/.test(combined)) return 'written';
  if (/\b(lab|laboratorio|progetto|proyecto|pr[aá]ctica)\b/.test(combined)) return 'lab';
  return 'standard';
}

function normalizeAppelloIndex(val, notes = '', cIdx = 0) {
  if (typeof val === 'number' && val >= 1) return Math.round(val);
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed >= 1) return parsed;
  const match = String(notes || '').match(/(\d+)\s*(?:[ºª°]|appello|convocatoria|llamamiento)/i);
  if (match) return parseInt(match[1], 10);
  const match2 = String(notes || '').match(/(?:appello|convocatoria|llamamiento)\s*(\d+)/i);
  if (match2) return parseInt(match2[1], 10);
  return cIdx + 1;
}

function detectSessionIcon(meta) {
  if (!meta) return '🎓';
  if (typeof meta.icon === 'string' && meta.icon.trim() && meta.icon.trim() !== '📅') {
    return meta.icon.trim();
  }
  const text = `${meta.session || ''} ${meta.title || ''}`.toLowerCase();
  if (/\b(ene|feb|dic|gen|ice)\b|invern|wint|hibern|gennaio|febbra|diciembr|dicembr|frio|snow/.test(text)) return '❄️';
  if (/\b(jun|jul|may|mag|sol|sun)\b|veran|summ|estiv|primaver|spring|giugno|luglio/.test(text)) return '☀️';
  if (/\b(sep|set|oct|nov)\b|otoñ|oton|autumn|autun|fall|extraordinar|settembr|octub|noviembr|hoja/.test(text)) return '🍂';
  if (/ai|artificial|inteligenc|robot|machine|vision|nlp|deep|datos|data/.test(text)) return '🤖';
  if (/salud|medicin|bio|qu[ií]m|chem/.test(text)) return '🔬';
  if (/empresa|finanz|econom|business|direcc/.test(text)) return '💼';
  if (/f[ií]sic|teleco|el[eé]ctr|energy/.test(text)) return '⚡';
  if (/master|máster|grad|laurea|ingeni|univers|degree/.test(text)) return '🎓';
  return (typeof meta.icon === 'string' && meta.icon.trim()) ? meta.icon.trim() : '📚';
}

/**
 * Validates a schedule object against core schema rules.
 * @param {object} schedule
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSchedule(schedule, options = {}) {
  const { allowEmptySubjects = false } = options;
  const errors = [];

  if (!schedule || typeof schedule !== 'object') {
    return { valid: false, errors: ['El objeto de planificación debe ser un objeto JSON válido.'] };
  }

  if (!schedule.meta || typeof schedule.meta !== 'object') {
    errors.push('Falta el objeto "meta" con la información general de la titulación y sesión.');
  } else {
    if (!schedule.meta.title) errors.push('meta.title es obligatorio.');
    if (schedule.meta.institution !== undefined && typeof schedule.meta.institution !== 'string') {
      errors.push('meta.institution debe ser una cadena de texto.');
    }
    if (!schedule.meta.academicYear) errors.push('meta.academicYear es obligatorio.');
    if (!schedule.meta.session) errors.push('meta.session es obligatorio.');
    if (schedule.meta.icon !== undefined && (typeof schedule.meta.icon !== 'string' || !schedule.meta.icon.trim())) {
      errors.push('meta.icon debe ser una cadena de texto (ej. emoji o símbolo).');
    }
  }

  if (!Array.isArray(schedule.subjects) || (!allowEmptySubjects && schedule.subjects.length === 0)) {
    errors.push('Debe existir una lista "subjects" con al menos una asignatura.');
  } else {
    schedule.subjects.forEach((sub, sIdx) => {
      const subName = sub?.name || `Asignatura #${sIdx + 1}`;
      if (!sub.id) errors.push(`${subName}: Falta el "id".`);
      if (!sub.name) errors.push(`${subName}: Falta el "name".`);
      if (sub.credits !== undefined && (typeof sub.credits !== 'number' || sub.credits <= 0)) {
        errors.push(`${subName}: "credits" debe ser un número positivo.`);
      }

      const hasValidModules = Array.isArray(sub.modules) && sub.modules.length > 0;
      const hasValidDirectCalls = Array.isArray(sub.calls) && sub.calls.length > 0;

      if (!hasValidModules && !hasValidDirectCalls) {
        errors.push(`${subName}: Debe contener convocatorias directas en "calls" o al menos un módulo en "modules".`);
      } else {
        const validateCall = (call, cIdx, parentName) => {
          const callId = call?.id || `Call #${cIdx + 1}`;
          if (!call.id) errors.push(`${parentName} -> ${callId}: Falta el "id".`);
          if (!call.date || !/^\d{4}-\d{2}-\d{2}$/.test(call.date)) {
            errors.push(`${parentName} -> ${callId}: "date" debe tener formato YYYY-MM-DD.`);
          }
          if (call.time && !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(call.time)) {
            errors.push(`${parentName} -> ${callId}: "time" debe tener formato HH:MM (24h).`);
          }
          const parsedDur = typeof call.durationHours === 'number' ? call.durationHours : parseFloat(call.durationHours);
          if (call.durationHours !== undefined && (isNaN(parsedDur) || parsedDur <= 0)) {
            errors.push(`${parentName} -> ${callId}: "durationHours" debe ser un número mayor a 0.`);
          }
        };

        if (hasValidModules) {
          sub.modules.forEach((mod, mIdx) => {
            const modName = mod?.name || `Módulo #${mIdx + 1} de ${subName}`;
            if (!mod.id) errors.push(`${modName}: Falta el "id".`);
            if (!mod.name) errors.push(`${modName}: Falta el "name".`);

            if (!Array.isArray(mod.calls) || mod.calls.length === 0) {
              errors.push(`${modName}: Debe tener al menos una convocatoria en "calls".`);
            } else {
              mod.calls.forEach((call, cIdx) => {
                validateCall(call, cIdx, modName);
              });
            }
          });
        } else if (hasValidDirectCalls) {
          sub.calls.forEach((call, cIdx) => {
            validateCall(call, cIdx, subName);
          });
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes schedule data, applying consistent fallbacks, weights, and color tokens.
 * @param {object} schedule
 * @returns {object} Normalized schedule
 */
function normalizeSchedule(schedule) {
  const parsedTarget = typeof schedule.meta?.targetCredits === 'number'
    ? schedule.meta.targetCredits
    : parseFloat(schedule.meta?.targetCredits);
  const targetCredits = !isNaN(parsedTarget) && parsedTarget > 0
    ? parsedTarget
    : (schedule.subjects || []).reduce((acc, s) => acc + (Number(s.credits) || 0), 0);

  const meta = {
    title: schedule.meta?.title || 'Planificador de Exámenes',
    institution: schedule.meta?.institution || '',
    academicYear: schedule.meta?.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    session: schedule.meta?.session || 'Convocatoria Oficial',
    icon: (typeof schedule.meta?.icon === 'string' && schedule.meta.icon.trim()) ? schedule.meta.icon.trim() : '📅',
    creditUnit: schedule.meta?.creditUnit || 'CFU',
    targetCredits
  };

  const subjects = (schedule.subjects || []).map((sub, sIdx) => {
    const subId = sub.id || slugify(sub.name) || `subj_${sIdx + 1}`;
    const diff = normalizeDifficulty(sub.difficulty);
    const defaultWeight = typeof sub.defaultWeight === 'number'
      ? Math.max(1, Math.min(5, Math.round(sub.defaultWeight)))
      : diff === 'high' ? 5 : diff === 'low' ? 1 : 3;

    const shortName = (typeof sub.shortName === 'string' && sub.shortName.trim())
      ? sub.shortName.trim().toUpperCase()
      : (sub.code && sub.code.length <= 6 && !sub.code.includes(' ')
        ? sub.code.trim().toUpperCase()
        : generateSubjectAcronym(sub.name));

    const color = sub.color || COLOR_PALETTE[sIdx % COLOR_PALETTE.length];
    const subCredits = Number(sub.credits) || 6;
    const hasExplicitModules = Array.isArray(sub.modules) && sub.modules.length > 0 && sub.hasModules !== false;
    let rawModules = Array.isArray(sub.modules) && sub.modules.length > 0 ? sub.modules : [];

    if (rawModules.length === 0 && Array.isArray(sub.calls) && sub.calls.length > 0) {
      rawModules = [{
        id: `${subId}_mod`,
        name: sub.name,
        shortName: '',
        credits: subCredits,
        difficulty: diff,
        defaultWeight,
        alreadyPassed: Boolean(sub.alreadyPassed),
        evaluationMode: sub.evaluationMode || 'standard',
        oralBinding: sub.oralBinding || 'same_appello',
        calls: sub.calls,
        isImplicit: true
      }];
    }

    const hasModules = sub.hasModules !== undefined
      ? Boolean(sub.hasModules)
      : (hasExplicitModules && (rawModules.length > 1 || (rawModules.length === 1 && rawModules[0].name !== sub.name && !rawModules[0].isImplicit)));

    const modules = rawModules.map((mod, mIdx) => {
      const modId = mod.id || `${subId}_mod_${mIdx + 1}`;
      const modCredits = typeof mod.credits === 'number' ? mod.credits : subCredits;
      const alreadyPassed = Boolean(mod.alreadyPassed);
      const modDiff = mod.difficulty ? normalizeDifficulty(mod.difficulty) : diff;
      const modDefaultWeight = typeof mod.defaultWeight === 'number'
        ? Math.max(1, Math.min(5, Math.round(mod.defaultWeight)))
        : (modDiff === 'high' ? 5 : modDiff === 'low' ? 1 : defaultWeight);

      const modShortName = (typeof mod.shortName === 'string' && mod.shortName.trim())
        ? mod.shortName.trim()
        : generateModuleShortName(mod.name, mIdx, rawModules.length);

      const calls = (mod.calls || []).map((call, cIdx) => {
        const callId = call.id || `${modId}_call_${cIdx + 1}`;
        const time = normalizeTimeStr(call.time);
        const parsedDuration = typeof call.durationHours === 'number' ? call.durationHours : parseFloat(call.durationHours);
        const durationHours = !isNaN(parsedDuration) && parsedDuration > 0
          ? parsedDuration
          : 2.5;

        const date = normalizeDateStr(call.date);
        let deadline = normalizeDateStr(call.deadline);
        if (!deadline && date) {
          const d = new Date(date + 'T00:00:00Z');
          d.setUTCDate(d.getUTCDate() - 4);
          deadline = d.toISOString().split('T')[0];
        }

        const moduleIds = Array.isArray(call.moduleIds) && call.moduleIds.length > 0
          ? call.moduleIds.map(String)
          : [String(modId)];

        const isCallActive = (
          call.status === 'active' ||
          call.status === 'activo' ||
          call.active === true ||
          call.selected === true
        );
        const isCallExplicitlyInactive = (
          call.status === 'inactive' ||
          call.status === 'desactivado' ||
          call.status === 'inactivo' ||
          call.active === false ||
          call.selected === false
        );

        let callStatus;
        let callActive;
        if (isCallActive) {
          callStatus = 'active';
          callActive = true;
        } else if (isCallExplicitlyInactive) {
          callStatus = 'inactive';
          callActive = false;
        } else if (typeof call.status === 'string' && call.status.trim()) {
          callStatus = call.status.trim();
          callActive = false;
        }

        const callType = normalizeCallType(call.type, call.notes, mod.name);
        const appelloIndex = normalizeAppelloIndex(call.appelloIndex, call.notes, cIdx);

        const normCall = {
          id: String(callId),
          date,
          time,
          durationHours,
          deadline: deadline || date,
          location: call.location || 'Aula por determinar',
          notes: call.notes || '',
          type: callType,
          appelloIndex,
          moduleIds
        };
        if (callStatus !== undefined) {
          normCall.status = callStatus;
          normCall.active = callActive;
        }

        return normCall;
      });

      const evalMode = normalizeEvaluationMode(mod.evaluationMode);
      const oralBinding = normalizeOralBinding(mod.oralBinding);

      return {
        id: String(modId),
        name: mod.name || sub.name,
        shortName: modShortName,
        credits: modCredits,
        difficulty: modDiff,
        defaultWeight: modDefaultWeight,
        alreadyPassed,
        evaluationMode: evalMode,
        oralBinding,
        calls
      };
    });

    const primaryMod = modules[0] || {};
    return {
      id: String(subId),
      name: sub.name || `Asignatura ${sIdx + 1}`,
      shortName,
      code: sub.code || '',
      credits: subCredits,
      color,
      difficulty: diff,
      defaultWeight,
      hasModules,
      evaluationMode: normalizeEvaluationMode(sub.evaluationMode || primaryMod.evaluationMode || 'standard'),
      oralBinding: normalizeOralBinding(sub.oralBinding || primaryMod.oralBinding || 'same_appello'),
      calls: hasModules ? [] : (primaryMod.calls || []),
      modules
    };
  });

  const presets = Array.isArray(schedule.presets)
    ? schedule.presets.map((p, pIdx) => ({
        name: p.name || `Preset ${pIdx + 1}`,
        description: p.description || '',
        selectedCallIds: Array.isArray(p.selectedCallIds) ? p.selectedCallIds.map(String) : []
      }))
    : [];

  const result = {
    meta,
    subjects,
    presets
  };

  if (Array.isArray(schedule.selectedCallIds)) {
    result.selectedCallIds = schedule.selectedCallIds.map(String);
  }

  return result;
}

/**
 * Extracts selected call IDs from a schedule object.
 * Priority:
 * 1. Calls explicitly tagged with active/inactive status.
 * 2. Root-level selectedCallIds array.
 * 3. First preset selectedCallIds array.
 * 4. Fallback: First call of each pending (non-passed) module.
 * @param {object} sched Schedule object
 * @returns {string[]} List of active call IDs
 */
function extractSelectedCallIds(sched) {
  if (!sched || typeof sched !== 'object') return [];
  const explicitActiveIds = [];
  let hasExplicitCallStatus = false;

  (sched.subjects || []).forEach(sub => {
    (sub.modules || []).forEach(mod => {
      (mod.calls || []).forEach(call => {
        const isCallActive = (
          call.status === 'active' ||
          call.status === 'activo' ||
          call.active === true ||
          call.selected === true
        );
        const isCallInactive = (
          call.status === 'inactive' ||
          call.status === 'desactivado' ||
          call.status === 'inactivo' ||
          call.active === false ||
          call.selected === false
        );

        if (isCallActive) {
          explicitActiveIds.push(String(call.id));
          hasExplicitCallStatus = true;
        } else if (isCallInactive) {
          hasExplicitCallStatus = true;
        }
      });
    });
    if (Array.isArray(sub.calls)) {
      sub.calls.forEach(call => {
        const isCallActive = (
          call.status === 'active' ||
          call.status === 'activo' ||
          call.active === true ||
          call.selected === true
        );
        const isCallInactive = (
          call.status === 'inactive' ||
          call.status === 'desactivado' ||
          call.status === 'inactivo' ||
          call.active === false ||
          call.selected === false
        );

        if (isCallActive) {
          if (!explicitActiveIds.includes(String(call.id))) explicitActiveIds.push(String(call.id));
          hasExplicitCallStatus = true;
        } else if (isCallInactive) {
          hasExplicitCallStatus = true;
        }
      });
    }
  });

  if (hasExplicitCallStatus) {
    return explicitActiveIds;
  }

  if (Array.isArray(sched.selectedCallIds) && sched.selectedCallIds.length > 0) {
    return sched.selectedCallIds.map(String);
  }

  if (Array.isArray(sched.presets) && sched.presets.length > 0 && Array.isArray(sched.presets[0].selectedCallIds) && sched.presets[0].selectedCallIds.length > 0) {
    return sched.presets[0].selectedCallIds.map(String);
  }

  const fallback = [];
  (sched.subjects || []).forEach(sub => {
    (sub.modules || []).forEach(mod => {
      if (!mod.alreadyPassed && Array.isArray(mod.calls) && mod.calls.length > 0) {
        const evalMode = normalizeEvaluationMode(mod.evaluationMode);
        if (evalMode === 'written_and_oral') {
          const w = mod.calls.find(c => normalizeCallType(c.type, c.notes, mod.name) === 'written');
          const o = mod.calls.find(c => normalizeCallType(c.type, c.notes, mod.name) === 'oral');
          if (w) fallback.push(String(w.id));
          if (o) fallback.push(String(o.id));
          if (!w && !o) fallback.push(String(mod.calls[0].id));
        } else if (evalMode === 'written_and_lab') {
          const w = mod.calls.find(c => normalizeCallType(c.type, c.notes, mod.name) === 'written');
          const l = mod.calls.find(c => normalizeCallType(c.type, c.notes, mod.name) === 'lab');
          if (w) fallback.push(String(w.id));
          if (l) fallback.push(String(l.id));
          if (!w && !l) fallback.push(String(mod.calls[0].id));
        } else {
          fallback.push(String(mod.calls[0].id));
        }
      }
    });
  });
  return fallback;
}

/**
 * Generates an exportable JSON object of the schedule, tagging every call
 * with active/inactive status matching the currently selected call IDs.
 * Also synchronizes presets and root selectedCallIds for backward compatibility.
 * @param {object} sched Schedule object
 * @param {string[]|Set<string>} selectedCallIds Currently selected call IDs
 * @returns {object} Exportable schedule object
 */
function getExportableSchedule(sched, selectedCallIds = []) {
  const idsArray = Array.isArray(selectedCallIds)
    ? selectedCallIds
    : (selectedCallIds instanceof Set
      ? Array.from(selectedCallIds)
      : (typeof selectedCallIds === 'string' && selectedCallIds ? [selectedCallIds] : []));
  const selSet = new Set(idsArray.map(String));

  const clone = JSON.parse(JSON.stringify(sched || {}));

  (clone.subjects || []).forEach(sub => {
    (sub.modules || []).forEach(mod => {
      (mod.calls || []).forEach(call => {
        const isSelected = selSet.has(String(call.id));
        call.status = isSelected ? 'active' : 'inactive';
        call.active = isSelected;
      });
    });
    if (Array.isArray(sub.calls)) {
      sub.calls.forEach(call => {
        const isSelected = selSet.has(String(call.id));
        call.status = isSelected ? 'active' : 'inactive';
        call.active = isSelected;
      });
    }
  });

  const selectedList = Array.from(selSet);
  if (!Array.isArray(clone.presets) || clone.presets.length === 0) {
    clone.presets = [
      {
        name: 'Plan Seleccionado',
        description: 'Convocatorias seleccionadas en el planificador',
        selectedCallIds: selectedList
      }
    ];
  } else {
    clone.presets[0] = {
      ...clone.presets[0],
      selectedCallIds: selectedList
    };
  }

  clone.selectedCallIds = selectedList;

  return clone;
}

/**
 * Parses Markdown tables formatted with exam entries.
 * Expected columns may include:
 * | Asignatura | Módulo | Fecha (YYYY-MM-DD) | Hora | Duración | Dificultad | CFU |
 * @param {string} markdown
 * @param {object} [metaOverrides]
 * @returns {object} Normalized schedule
 */
function parseMarkdownTable(markdown, metaOverrides = {}) {
  const lines = markdown
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 2) {
    throw new Error('La tabla Markdown debe contener al menos una cabecera y una fila de datos.');
  }

  const parseCells = line =>
    line
      .slice(1, -1)
      .split('|')
      .map(c => c.trim());

  const headers = parseCells(lines[0]).map(h => slugify(h));

  // Determine if line 1 is a delimiter row (| --- | --- |)
  const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(lines[1]);
  const dataRows = isSeparator ? lines.slice(2) : lines.slice(1);

  if (dataRows.length === 0) {
    throw new Error('La tabla Markdown debe contener al menos una fila de datos.');
  }

  const subMap = new Map();

  for (const row of dataRows) {
    const cells = parseCells(row);
    if (cells.length < 2) continue;

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = cells[idx] || '';
    });

    const subName = rowObj.asignatura || rowObj.subject || rowObj.materia || rowObj.nome || 'Asignatura';
    const subCode = rowObj.codigo || rowObj.code || rowObj.codice || '';
    const modName = rowObj.modulo || rowObj.module || subName;
    const date = normalizeDateStr(rowObj.fecha || rowObj.date || rowObj.data || '');
    const time = rowObj.hora || rowObj.time || rowObj.ora || '09:00';
    const duration = parseFloat(rowObj.duracion || rowObj.duration || rowObj.durata || '2.5') || 2.5;
    const credits = parseFloat(rowObj.creditos || rowObj.cfu || rowObj.ects || rowObj.credits || '6') || 6;
    const difficulty = normalizeDifficulty(rowObj.dificultad || rowObj.difficulty || rowObj.difficolta || 'medium');
    const notes = rowObj.notas || rowObj.notes || rowObj.note || '';
    const location = rowObj.aula || rowObj.location || rowObj.sede || '';

    const subId = slugify(subCode || subName);
    const modId = slugify(`${subId}_${modName}`);

    if (!subMap.has(subId)) {
      subMap.set(subId, {
        id: subId,
        name: subName,
        code: subCode,
        credits,
        difficulty,
        modules: new Map()
      });
    }

    const subEntry = subMap.get(subId);
    if (!subEntry.modules.has(modId)) {
      subEntry.modules.set(modId, {
        id: modId,
        name: modName,
        credits,
        difficulty,
        defaultWeight: difficulty === 'high' ? 5 : difficulty === 'low' ? 1 : 3,
        alreadyPassed: false,
        calls: []
      });
    }

    const modEntry = subEntry.modules.get(modId);
    const callIdx = modEntry.calls.length + 1;
    const callId = `${modId}_call_${callIdx}`;

    modEntry.calls.push({
      id: callId,
      date,
      time,
      durationHours: duration,
      location,
      notes
    });
  }

  const subjects = Array.from(subMap.values()).map(sub => ({
    ...sub,
    modules: Array.from(sub.modules.values())
  }));

  const scheduleRaw = {
    meta: {
      title: metaOverrides.title || 'Planificador Importado desde Markdown',
      institution: metaOverrides.institution || '',
      academicYear: metaOverrides.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
      session: metaOverrides.session || 'Convocatoria',
      creditUnit: metaOverrides.creditUnit || 'CFU',
      targetCredits: subjects.reduce((sum, s) => sum + s.credits, 0)
    },
    subjects,
    presets: []
  };

  return normalizeSchedule(scheduleRaw);
}

/**
 * Strips single-line (//) and multi-line (/* * /) comments from a JSON-like string,
 * preserving strings and escaped quotes intact.
 * @param {string} jsonStr
 * @returns {string}
 */
function stripJsonComments(jsonStr) {
  let inString = false;
  let isEscaped = false;
  let inSingleComment = false;
  let inMultiComment = false;
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    const nextChar = jsonStr[i + 1];

    if (inSingleComment) {
      if (char === '\n' || char === '\r') {
        inSingleComment = false;
        result += char;
      }
      continue;
    }

    if (inMultiComment) {
      if (char === '*' && nextChar === '/') {
        inMultiComment = false;
        i++; // skip '/'
      }
      continue;
    }

    if (inString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inSingleComment = true;
      i++; // skip second '/'
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inMultiComment = true;
      i++; // skip '*'
      continue;
    }

    result += char;
  }
  return result;
}

/**
 * Strips trailing commas before } or ] in JSON strings, preserving string literals.
 * @param {string} jsonStr
 * @returns {string}
 */
function stripTrailingCommas(jsonStr) {
  let inString = false;
  let isEscaped = false;
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (inString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === ',') {
      let j = i + 1;
      while (j < jsonStr.length && /\s/.test(jsonStr[j])) {
        j++;
      }
      if (j < jsonStr.length && (jsonStr[j] === '}' || jsonStr[j] === ']')) {
        continue; // skip trailing comma
      }
    }

    result += char;
  }
  return result;
}

/**
 * Sanitizes JSON by removing comments and trailing commas.
 * @param {string} str
 * @returns {string}
 */
function sanitizeJsonString(str) {
  return stripTrailingCommas(stripJsonComments(str));
}

/**
 * Attempts to parse a JSON string, applying comment & trailing comma stripping on failure.
 * @param {string} text
 * @returns {any} Parsed value or throws Error
 */
function robustJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (initialErr) {
    try {
      const sanitized = sanitizeJsonString(text);
      return JSON.parse(sanitized);
    } catch (secondErr) {
      throw new Error(`JSON malformado: ${initialErr.message}`);
    }
  }
}

/**
 * Extracts candidate JSON schedule objects from Markdown, README text or conversational AI output.
 * Handles fenced code blocks (``` or ~~~ with any language tag) and balanced curly braces { ... }.
 * If multiple JSON blocks exist (e.g. prompt template and actual schedule), intelligently ranks
 * them and returns the most schema-complete candidate.
 * @param {string} text
 * @returns {object|null} Parsed object or null if none found
 */
function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;

  const candidates = [];

  // 1. Search for fenced code blocks ``` or ~~~ with any language identifier (json, jsonc, javascript, etc.)
  const codeBlockRegex = /(?:```+|~~~+)(?:[a-zA-Z0-9_\-]+)?\s*([\s\S]*?)(?:```+|~~~+)/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const rawContent = match[1].trim();
    const firstBrace = rawContent.indexOf('{');
    const lastBrace = rawContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidateStr = rawContent.slice(firstBrace, lastBrace + 1);
      try {
        const parsed = robustJsonParse(candidateStr);
        if (parsed && typeof parsed === 'object') {
          candidates.push(parsed);
        }
      } catch (e) {
        // Continue searching other code blocks
      }
    }
  }

  // 2. Search for balanced braces { ... } in the entire text (ignoring braces inside strings/comments)
  let inString = false;
  let isEscaped = false;
  let inSingleComment = false;
  let inMultiComment = false;
  let depth = 0;
  let startIdx = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inSingleComment) {
      if (char === '\n' || char === '\r') inSingleComment = false;
      continue;
    }
    if (inMultiComment) {
      if (char === '*' && nextChar === '/') {
        inMultiComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '/' && nextChar === '/') {
      inSingleComment = true;
      i++;
      continue;
    }
    if (char === '/' && nextChar === '*') {
      inMultiComment = true;
      i++;
      continue;
    }
    if (char === '{') {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (char === '}') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && startIdx !== -1) {
          const slice = text.slice(startIdx, i + 1);
          if (slice.includes('"meta"') || slice.includes('"subjects"')) {
            try {
              const parsed = robustJsonParse(slice);
              if (parsed && typeof parsed === 'object') {
                candidates.push(parsed);
              }
            } catch (e) {}
          }
          startIdx = -1;
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Rank candidates: prefer schema-valid schedules and those with more subjects/calls
  function scoreCandidate(cand) {
    if (!cand || typeof cand !== 'object') return -9999;
    const val = validateSchedule(cand);
    let totalCalls = 0;
    if (Array.isArray(cand.subjects)) {
      cand.subjects.forEach(s => {
        (s.modules || []).forEach(m => {
          totalCalls += (m.calls || []).length;
        });
      });
    }

    if (val.valid) {
      return 10000 + (cand.subjects?.length || 0) * 100 + totalCalls;
    }
    let score = 0;
    if (cand.meta && typeof cand.meta === 'object') score += 10;
    if (cand.meta?.title) score += 5;
    if (cand.meta?.institution) score += 5;
    if (Array.isArray(cand.subjects)) score += cand.subjects.length * 10;
    score += totalCalls * 5;
    score -= val.errors.length * 2;
    return score;
  }

  const scored = candidates.map(c => ({ cand: c, score: scoreCandidate(c) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].cand;
}

/**
 * Universal parser entrypoint: accepts JSON string, parsed object, or Markdown table/README.
 * Automatically extracts JSON from AI conversational wrappers, code blocks (```json ... ```),
 * sanitizes comments and trailing commas, and supports Markdown tables.
 * @param {string|object} input
 * @param {'auto'|'json'|'markdown'} [format='auto']
 * @returns {object} Normalized schedule
 */
function parseInput(input, format = 'auto') {
  if (typeof input === 'object' && input !== null) {
    const valResult = validateSchedule(input);
    if (!valResult.valid) {
      throw new Error(`Error de validación del esquema:\n- ${valResult.errors.join('\n- ')}`);
    }
    return normalizeSchedule(input);
  }

  if (typeof input !== 'string') {
    throw new Error('La entrada debe ser una cadena de texto o un objeto.');
  }

  const trimmed = input.trim();

  // If format is explicitly 'json'
  if (format === 'json') {
    let parsed;
    try {
      parsed = robustJsonParse(trimmed);
    } catch (err) {
      const extracted = extractJsonFromText(trimmed);
      if (extracted) {
        parsed = extracted;
      } else {
        throw err;
      }
    }
    const valResult = validateSchedule(parsed);
    if (!valResult.valid) {
      throw new Error(`Error de validación del esquema:\n- ${valResult.errors.join('\n- ')}`);
    }
    return normalizeSchedule(parsed);
  }

  // If format is explicitly 'markdown'
  if (format === 'markdown') {
    return parseMarkdownTable(trimmed);
  }

  // format === 'auto'
  // 1. Direct JSON (starts with { or [)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed = null;
    let directValid = false;
    try {
      parsed = robustJsonParse(trimmed);
      const valResult = validateSchedule(parsed);
      if (valResult.valid) {
        directValid = true;
      }
    } catch (e) {
      // Direct parse failed, try extracting JSON block
    }

    if (directValid) {
      return normalizeSchedule(parsed);
    }

    // Fall back to extracting JSON if direct parse failed or wasn't schema-valid
    const extracted = extractJsonFromText(trimmed);
    if (extracted) {
      const valResult = validateSchedule(extracted);
      if (!valResult.valid) {
        throw new Error(`Error de validación del esquema:\n- ${valResult.errors.join('\n- ')}`);
      }
      return normalizeSchedule(extracted);
    }

    if (parsed) {
      const valResult = validateSchedule(parsed);
      throw new Error(`Error de validación del esquema:\n- ${valResult.errors.join('\n- ')}`);
    }

    // Re-throw robust parse error if both failed
    robustJsonParse(trimmed);
  }

  // 2. Extracted JSON from Markdown / README code blocks (```json ... ```) or conversational wrappers
  const extractedJson = extractJsonFromText(trimmed);
  if (extractedJson) {
    const valResult = validateSchedule(extractedJson);
    if (!valResult.valid) {
      throw new Error(`Error de validación del esquema:\n- ${valResult.errors.join('\n- ')}`);
    }
    return normalizeSchedule(extractedJson);
  }

  // 3. Markdown table detection (lines starting and ending with |)
  const lines = trimmed
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.endsWith('|'));
  if (lines.length >= 2) {
    return parseMarkdownTable(trimmed);
  }

  throw new Error('Formato de entrada no reconocido. Debe ser un JSON válido, un archivo Markdown/README con bloque ```json, o una tabla Markdown con formato | Columna |.');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseInput,
    validateSchedule,
    normalizeSchedule,
    extractSelectedCallIds,
    getExportableSchedule,
    detectSessionIcon,
    parseMarkdownTable,
    normalizeDateStr,
    normalizeTimeStr,
    normalizeDifficulty,
    normalizeEvaluationMode,
    normalizeOralBinding,
    normalizeCallType,
    normalizeAppelloIndex,
    slugify,
    generateSubjectAcronym,
    generateModuleShortName,
    stripJsonComments,
    stripTrailingCommas,
    sanitizeJsonString,
    robustJsonParse,
    extractJsonFromText
  };
}

if (typeof window !== 'undefined') {
  window.ExamPlannerParser = {
    parseInput,
    validateSchedule,
    normalizeSchedule,
    extractSelectedCallIds,
    getExportableSchedule,
    detectSessionIcon,
    parseMarkdownTable,
    normalizeDateStr,
    normalizeTimeStr,
    normalizeDifficulty,
    normalizeEvaluationMode,
    normalizeOralBinding,
    normalizeCallType,
    normalizeAppelloIndex,
    slugify,
    generateSubjectAcronym,
    generateModuleShortName,
    stripJsonComments,
    stripTrailingCommas,
    sanitizeJsonString,
    robustJsonParse,
    extractJsonFromText
  };
}

