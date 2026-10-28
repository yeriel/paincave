/**
 * Catálogo, Gestor de Rutinas y Parser de Entrenamientos
 * Adaptado para Bicicleta de Spinning con sesiones de 45 a 60 minutos
 */

import { gamification } from './gamification.js';

// Mapeo fisiológico de RPE (1-10) a Zona Cardíaca (1-5 + Sweet Spot)
export function getZoneFromRpe(rpe) {
  if (rpe === null || rpe === undefined) return 2;
  if (rpe <= 3.0) return 1;
  if (rpe <= 5.0) return 2;
  if (rpe <= 6.5) return 3;
  if (rpe <= 7.9) return 'SS'; // Sweet Spot (84-90% FC Máx = 158-170 BPM)
  if (rpe <= 8.8) return 4;   // Umbral de lactato (81-90% FC Máx = 153-170 BPM)
  return 5;                   // VO2 Máx (> 91% FC Máx = 172-189 BPM)
}

// Rango BPM estimado para cada zona según FC Máx (Calibrado con FC Máx = 189 BPM)
export function getZoneBpmRange(zone, maxHr = null) {
  const hr = maxHr || gamification.getMaxHR();
  const z = typeof zone === 'string' ? zone.trim().toUpperCase() : String(zone);
  if (z === 'SS' || z === 'SWEETSPOT' || z === 'SWEET SPOT') {
    return `${Math.round(hr * 0.836)} - ${Math.round(hr * 0.90)}`; // 158 - 170 BPM
  }
  switch (parseInt(z)) {
    case 1: return `< ${Math.round(hr * 0.60)}`; // < 113 BPM (< 60%)
    case 2: return `${Math.round(hr * 0.60)} - ${Math.round(hr * 0.70)}`; // 113 - 132 BPM (60-70%)
    case 3: return `${Math.round(hr * 0.71)} - ${Math.round(hr * 0.80)}`; // 134 - 151 BPM (71-80%)
    case 4: return `${Math.round(hr * 0.81)} - ${Math.round(hr * 0.90)}`; // 153 - 170 BPM (81-90%)
    case 5: return `${Math.round(hr * 0.91)} - ${hr}`; // 172 - 189 BPM (91-100%)
    default: return '—';
  }
}

// Normalizador de paso / fase individual
export function parseStep(step) {
  if (typeof step === 'object' && step.phase) {
    const rpe = step.rpe !== undefined ? step.rpe : null;
    const cadence = step.cadence !== undefined ? step.cadence : null;
    const pLower = (step.phase || '').toLowerCase();
    let posture = step.posture;
    if (!posture) {
      if (pLower.includes('aero')) posture = 'aero';
      else if (pLower.includes('de pie')) posture = 'de pie';
      else posture = 'sentado';
    }
    let zone = step.zone;
    if (!zone) {
      if (pLower.includes('sweet spot') || pLower.includes('sweetspot')) {
        zone = 'SS';
      } else if (pLower.includes('umbral') || pLower.includes('z4')) {
        zone = 4;
      } else if (pLower.includes('recuperaci') || pLower.includes('regenerativo') || pLower.includes('z1')) {
        zone = 1;
      } else if (pLower.includes('tempo') || pLower.includes('z3')) {
        zone = 3;
      } else if (pLower.includes('fondo') || pLower.includes('z2')) {
        zone = 2;
      } else {
        zone = getZoneFromRpe(rpe);
      }
    }

    let instruction = 'Pedaleo fluido sentado';
    if (zone === 'SS') instruction = 'Resistencia media-alta: busca 158-170 BPM';
    else if (zone === 4) instruction = 'Umbral: ardor claro en piernas (153-170 BPM)';
    else if (zone === 2) instruction = 'Resistencia básica: ritmo fluido (113-132 BPM)';
    else if (zone === 1) instruction = 'Regenerativo suave: soltar piernas (< 113 BPM)';
    if (posture === 'aero') instruction += ' · Codos a 90°';
    else if (posture === 'de pie') instruction += ' · ¡De pie!';

    return {
      phase: step.phase,
      desc: step.desc || `${step.phase}${cadence ? ` [Cadencia ${cadence} RPM]` : ''} [${zone === 'SS' ? 'Sweet Spot' : `Zona ${zone}`}] [RPE ${rpe}]`,
      t: step.t,
      cadence,
      rpe,
      posture,
      zone,
      instruction
    };
  }

  const desc = typeof step === 'string' ? step : (step.desc || '');
  const phase = desc.split('[')[0].split('(')[0].trim();
  const zm = desc.match(/Zona (\d)/) || desc.match(/\[(SS|Sweet Spot)\]/i);
  const rm = desc.match(/RPE ([\d.]+)/);
  const cm = desc.match(/Cadencia (\d+)/) || desc.match(/(\d+)\s*RPM/i);

  const rpe = rm ? parseFloat(rm[1]) : (typeof step === 'object' && step.rpe !== undefined ? step.rpe : null);
  const cadence = cm ? parseInt(cm[1]) : (typeof step === 'object' && step.cadence !== undefined ? step.cadence : null);
  const pLower = (desc + ' ' + phase).toLowerCase();
  let posture = 'sentado';
  if (pLower.includes('aero')) posture = 'aero';
  else if (pLower.includes('de pie')) posture = 'de pie';

  let zone = null;
  if (zm) {
    zone = zm[1].toUpperCase() === 'SS' || zm[1].toLowerCase() === 'sweet spot' ? 'SS' : parseInt(zm[1]);
  } else if (pLower.includes('sweet spot') || pLower.includes('sweetspot')) {
    zone = 'SS';
  } else if (pLower.includes('umbral') || pLower.includes('z4')) {
    zone = 4;
  } else if (pLower.includes('recuperaci') || pLower.includes('regenerativo') || pLower.includes('z1')) {
    zone = 1;
  } else if (pLower.includes('tempo') || pLower.includes('z3')) {
    zone = 3;
  } else if (pLower.includes('fondo') || pLower.includes('z2')) {
    zone = 2;
  } else {
    zone = getZoneFromRpe(rpe);
  }

  let instruction = 'Pedaleo fluido sentado';
  if (zone === 'SS') instruction = 'Resistencia media-alta: busca 158-170 BPM';
  else if (zone === 4) instruction = 'Umbral: ardor claro en piernas (153-170 BPM)';
  else if (zone === 2) instruction = 'Resistencia básica: ritmo fluido (113-132 BPM)';
  else if (zone === 1) instruction = 'Regenerativo suave: soltar piernas (< 113 BPM)';
  if (posture === 'aero') instruction += ' · Codos a 90°';
  else if (posture === 'de pie') instruction += ' · ¡De pie!';

  return {
    phase: phase || 'Fase activa',
    desc,
    t: typeof step === 'object' ? step.t : 60,
    cadence,
    rpe,
    posture,
    zone,
    instruction
  };
}

// Parser inteligente de texto CSV
export function parseCSV(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    throw new Error("El archivo CSV debe incluir el nivel en la línea 1 y al menos una fase.");
  }

  const lvl = lines[0].toLowerCase().replace('é', 'e').replace(/\s+/g, '');
  if (!['fase1', 'fase2', 'fase3', 'principiante', 'amateur', 'elite', 'pro'].includes(lvl)) {
    throw new Error("Fase o Nivel inválido en la línea 1. Debe ser: Fase 1, Fase 2 o Fase 3.");
  }

  const steps = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(lines[i].includes(';') ? ';' : ',').map(x => x.trim());
    if (parts.length < 4) continue;

    const phase = parts[0];
    const col2 = parseInt(parts[1]);
    const rpe = parseFloat(parts[2].replace(',', '.'));
    const dur = parseInt(parts[parts.length - 1]);
    if (isNaN(dur)) continue;

    let cadence = null;
    let zone = null;
    if (!isNaN(col2)) {
      if (col2 >= 30) {
        cadence = col2; // Cadencia en RPM
      } else {
        zone = col2; // Zona explícita
        cadence = null;
      }
    }

    const pLower = phase.toLowerCase();
    let posture = 'sentado';
    if (pLower.includes('aero')) posture = 'aero';
    else if (pLower.includes('de pie')) posture = 'de pie';

    if (!zone) {
      if (pLower.includes('sweet spot') || pLower.includes('sweetspot')) {
        zone = 'SS';
      } else if (pLower.includes('umbral') || pLower.includes('z4')) {
        zone = 4;
      } else if (pLower.includes('recuperaci') || pLower.includes('regenerativo') || pLower.includes('z1')) {
        zone = 1;
      } else if (pLower.includes('tempo') || pLower.includes('z3')) {
        zone = 3;
      } else if (pLower.includes('fondo') || pLower.includes('z2')) {
        zone = 2;
      } else {
        zone = getZoneFromRpe(rpe);
      }
    }

    steps.push({
      phase,
      desc: `${phase}${cadence ? ` [Cadencia ${cadence} RPM]` : ''} [${zone === 'SS' ? 'Sweet Spot' : `Zona ${zone}`}] [RPE ${rpe}]`,
      t: dur,
      cadence,
      rpe,
      zone,
      posture
    });
  }

  if (steps.length === 0) {
    throw new Error("No se encontraron fases válidas en el archivo CSV.");
  }

  return { level: lvl, steps };
}

// ==============================================================================
// POOL OFICIAL DE RUTINAS PARA SPINNING (45 - 60 MINUTOS)
// ==============================================================================

export const ROUTINES_POOL = [
  {
    "id": "lunes_fondo_aero",
    "day": "Lunes",
    "category": "fondo",
    "title": "Lunes · Fondo Aero Z2",
    "subtitle": "Base Z2 (113-132 BPM) + adaptación aero (codos 90°)",
    "icon": "ti-wind",
    "colorClass": "cyan",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 85,
          "rpe": 3,
          "zone": 2,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Rodaje base Z2 (113-132 BPM)",
          "cadence": 88,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Bloque Aero Z2 técnico",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Alivio y apertura de cadera",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Fondo Z2 continuo sentado",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 690
        },
        {
          "phase": "Bloque Aero Z2 técnico",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 300
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Rodaje base Z2 (113-132 BPM)",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Bloque Aero Z2 sostenido",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 continuo",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Bloque Aero Z2 sostenido",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento dinámico",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Fondo Z2 sentado (113-132 BPM)",
          "cadence": 92,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 540
        },
        {
          "phase": "Crucero Aero Z2 de carrera",
          "cadence": 92,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 sentado (113-132 BPM)",
          "cadence": 92,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 540
        },
        {
          "phase": "Crucero Aero Z2 de carrera",
          "cadence": 92,
          "rpe": 5.5,
          "zone": 2,
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ]
    }
  },
  {
    "id": "martes_sweet_spot",
    "day": "Martes",
    "category": "calidad",
    "title": "Martes · Sweet Spot 88-93%",
    "subtitle": "Calidad 1 · Crucero potente en 158-170 BPM (¡no en Z3!)",
    "icon": "ti-bolt",
    "colorClass": "amber",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 85,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot (158-170 BPM)",
          "cadence": 88,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero (158-170 BPM)",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 600
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot sentado (158-170 BPM)",
          "cadence": 88,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot Aero (158-170 BPM)",
          "cadence": 90,
          "rpe": 8,
          "zone": "SS",
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot sentado (158-170 BPM)",
          "cadence": 88,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero (158-170 BPM)",
          "cadence": 90,
          "rpe": 8,
          "zone": "SS",
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot sentado (158-170 BPM)",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Bloque 1: Sweet Spot Aero (158-170 BPM)",
          "cadence": 92,
          "rpe": 8,
          "zone": "SS",
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot sentado (158-170 BPM)",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero (158-170 BPM)",
          "cadence": 92,
          "rpe": 8,
          "zone": "SS",
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        }
      ]
    }
  },
  {
    "id": "miercoles_recuperacion",
    "day": "Miércoles",
    "category": "recuperacion",
    "title": "Miércoles · Recuperación Z1",
    "subtitle": "Día bisagra · Lavado suave bajo 113 BPM (< 60%)",
    "icon": "ti-activity",
    "colorClass": "teal",
    "levels": {
      "fase1": [
        {
          "phase": "Rodaje suave sentado",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Pedaleo regenerativo Z1 (< 113 BPM)",
          "cadence": 85,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 65,
          "rpe": 2,
          "zone": 1,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Pedaleo regenerativo Z1 (< 113 BPM)",
          "cadence": 85,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 80,
          "rpe": 1.5,
          "zone": 1,
          "posture": "sentado",
          "t": 540
        }
      ],
      "fase2": [
        {
          "phase": "Rodaje suave sentado",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Pedaleo regenerativo Z1 (< 113 BPM)",
          "cadence": 88,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 68,
          "rpe": 2,
          "zone": 1,
          "posture": "de pie",
          "t": 180
        },
        {
          "phase": "Pedaleo regenerativo Z1 (< 113 BPM)",
          "cadence": 88,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 780
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 80,
          "rpe": 1.5,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        }
      ],
      "fase3": [
        {
          "phase": "Rodaje suave sentado",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Pedaleo regenerativo Z1 (< 113 BPM)",
          "cadence": 88,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 70,
          "rpe": 2,
          "zone": 1,
          "posture": "de pie",
          "t": 180
        },
        {
          "phase": "Pedaleo regenerativo Z1 (< 113 BPM)",
          "cadence": 88,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 80,
          "rpe": 1.5,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ]
    }
  },
  {
    "id": "jueves_fondo_z2",
    "day": "Jueves",
    "category": "fondo",
    "title": "Jueves · Fondo Z2 Continuo",
    "subtitle": "Cadencia firme 90 RPM · Ritmo base en 118-130 BPM",
    "icon": "ti-leaf",
    "colorClass": "emerald",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 85,
          "rpe": 3,
          "zone": 2,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Fondo Z2 continuo (118-130 BPM)",
          "cadence": 88,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 960
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Fondo Z2 continuo (118-130 BPM)",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 930
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Fondo Z2 continuo (118-130 BPM)",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 1080
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 continuo (118-130 BPM)",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 1080
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Fondo Z2 firme (120-132 BPM)",
          "cadence": 92,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 1200
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 firme (120-132 BPM)",
          "cadence": 92,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 1080
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ]
    }
  },
  {
    "id": "viernes_umbral_z4",
    "day": "Viernes",
    "category": "calidad",
    "title": "Viernes · Intervalos Umbral Z4",
    "subtitle": "Calidad 2 · Tolerancia al lactato en 153-170 BPM",
    "icon": "ti-flame",
    "colorClass": "rose",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 85,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Serie 1: Umbral Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 2: Umbral Z4 Aero (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 3: Umbral Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 4: Umbral Z4 Aero (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 660
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 85,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Serie 1: Umbral Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 2: Umbral Z4 Aero (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 3: Umbral Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 4: Umbral Z4 Aero (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 5: Umbral Z4 Aero a tope",
          "cadence": 92,
          "rpe": 8.8,
          "zone": 4,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 720
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 88,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Serie 1: Bloque Umbral Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 2: Bloque Umbral Z4 Aero (153-170 BPM)",
          "cadence": 92,
          "rpe": 8.5,
          "zone": 4,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 3: Bloque Umbral Z4 Aero (153-170 BPM)",
          "cadence": 92,
          "rpe": 8.8,
          "zone": 4,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Recuperación activa Z2 (113-132 BPM)",
          "cadence": 85,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 840
        }
      ]
    }
  },
  {
    "id": "sabado_fondo_extendido",
    "day": "Sábado",
    "category": "fondo",
    "title": "Sábado · Fondo Aero Extendido",
    "subtitle": "Volumen reina en 113-132 BPM + tramos aero prolongados",
    "icon": "ti-trophy",
    "colorClass": "blue",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 85,
          "rpe": 3,
          "zone": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Fondo Z2 crucero (113-132 BPM)",
          "cadence": 88,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Bloque Aero Z2 (125-132 BPM)",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 300
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 crucero (113-132 BPM)",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Bloque Aero Z2 (125-132 BPM)",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Fondo Z2 crucero (113-132 BPM)",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Bloque Aero sostenido",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 crucero (113-132 BPM)",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Bloque Aero sostenido",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 90,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Fondo Z2 continuo (113-132 BPM)",
          "cadence": 92,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 960
        },
        {
          "phase": "Bloque Aero de carrera",
          "cadence": 92,
          "rpe": 5.5,
          "zone": 2,
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 continuo (113-132 BPM)",
          "cadence": 92,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Bloque Aero de carrera",
          "cadence": 94,
          "rpe": 5.5,
          "zone": 2,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Enfriamiento Z1 (< 113 BPM)",
          "cadence": 85,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ]
    }
  }
];

export function getRoutine(id, level = 'fase1') {
  const item = ROUTINES_POOL.find(r => r.id === id);
  if (!item) return null;
  const routine = item.levels[level] || item.levels.fase1 || Object.values(item.levels)[0];
  return {
    id: item.id,
    title: item.title,
    level,
    steps: routine.map(s => parseStep(s))
  };
}
// Safelist: border-emerald-600/30 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-300 text-emerald-400 bg-emerald-600/20 border-emerald-600/40 border-amber-600/30 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 text-amber-400 bg-amber-600/20 border-amber-600/40 border-sky-600/30 bg-sky-950/20 hover:bg-sky-900/30 text-sky-300 text-sky-400 bg-sky-600/20 border-sky-600/40 border-blue-600/30 bg-blue-950/20 hover:bg-blue-900/30 text-blue-300 text-blue-400 bg-blue-600/20 border-blue-600/40 border-rose-600/30 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 text-rose-400 bg-rose-600/20 border-rose-600/40 border-teal-600/30 bg-teal-950/20 hover:bg-teal-900/30 text-teal-300 text-teal-400 bg-teal-600/20 border-teal-600/40 border-cyan-600/30 bg-cyan-950/20 hover:bg-cyan-900/30 text-cyan-300 text-cyan-400 bg-cyan-600/20 border-cyan-600/40 border-purple-600/30 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 text-purple-400 bg-purple-600/20 border-purple-600/40
