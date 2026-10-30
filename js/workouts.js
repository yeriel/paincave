/**
 * Catálogo, Gestor de Rutinas y Parser de Entrenamientos
 * Adaptado para Bicicleta de Spinning con microciclo rotativo de 4 días
 * Día 1: Fondo Z2 (60 min) -> Día 2: Sweet Spot (158-170 BPM) -> Día 3: Z1 (< 113 BPM) -> Día 4: Descanso Total
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
    case 1: return `<${Math.round(hr * 0.60)}`; // < 113 BPM (< 60%)
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
    const cadence = parseInt(parts[1]) || null;
    const rpe = parseFloat(parts[2]) || null;
    const dur = parseInt(parts[3]) || 60;

    const pLower = phase.toLowerCase();
    let zone = null;
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
    }

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
// POOL OFICIAL DE RUTINAS PARA SPINNING (MICROCICLO ROTATIVO 4D)
// ==============================================================================

export const ROUTINES_POOL = [
  {
    "id": "dia1_fondo_z2",
    "day": "Día 1",
    "category": "fondo",
    "title": "Día 1 · Fondo Z2 & Aero (60 min)",
    "subtitle": "Resistencia base 113-132 BPM (60 min) + adaptación aero",
    "icon": "ti-wind",
    "colorClass": "cyan",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 85,
          "rpe": 3,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Rodaje base Z2 (113-132 BPM)",
          "cadence": 88,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 840
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
          "phase": "Alivio articular de pie",
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
          "t": 1110
        },
        {
          "phase": "Bloque Aero Z2 técnico",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Alivio articular de pie",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 60
        },
        {
          "phase": "Rodaje suave Z2",
          "cadence": 88,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Enfriamiento Z1 regenerativo",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento activo Z1->Z2",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 1,
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
          "t": 480
        },
        {
          "phase": "Alivio y apertura de cadera",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 90
        },
        {
          "phase": "Rodaje crucero Z2 continuo",
          "cadence": 92,
          "rpe": 4.8,
          "zone": 2,
          "posture": "sentado",
          "t": 870
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
          "phase": "Alivio articular de pie",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Rodaje final Z2",
          "cadence": 88,
          "rpe": 4.2,
          "zone": 2,
          "posture": "sentado",
          "t": 330
        },
        {
          "phase": "Enfriamiento Z1 regenerativo",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Rodaje de ritmo Z2 (113-132 BPM)",
          "cadence": 92,
          "rpe": 4.8,
          "zone": 2,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Bloque Aero Z2 contrarreloj",
          "cadence": 92,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 540
        },
        {
          "phase": "Alivio activo de pie",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Rodaje base Z2 sostenido",
          "cadence": 90,
          "rpe": 4.8,
          "zone": 2,
          "posture": "sentado",
          "t": 450
        },
        {
          "phase": "Bloque Aero Z2 contrarreloj",
          "cadence": 92,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "Alivio activo de pie",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Bloque Aero Z2 final",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Rodaje suave Z2",
          "cadence": 85,
          "rpe": 3.8,
          "zone": 2,
          "posture": "sentado",
          "t": 270
        },
        {
          "phase": "Enfriamiento Z1 regenerativo",
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
    "id": "dia2_sweet_spot",
    "day": "Día 2",
    "category": "calidad",
    "title": "Día 2 · Calidad Sweet Spot (158-170 BPM)",
    "subtitle": "Intervalos submáximos 84-90% FC Máx · Esfuerzo cómodamente duro",
    "icon": "ti-flame",
    "colorClass": "amber",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 85,
          "rpe": 3.5,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Activación neuromuscular Z3",
          "cadence": 90,
          "rpe": 6,
          "zone": 3,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Recuperación pre-bloque Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Bloque 1: Sweet Spot (158-170 BPM)",
          "cadence": 88,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Recuperación activa Z1 (< 113 BPM)",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero (158-170 BPM)",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 78,
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
          "zone": 1,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Activación piramidal Z3",
          "cadence": 92,
          "rpe": 6.2,
          "zone": 3,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Recuperación pre-bloque Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Bloque 1: Sweet Spot (158-170 BPM)",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Recuperación activa Z1 (< 113 BPM)",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero (158-170 BPM)",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "aero",
          "t": 900
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento dinámico Z1->Z2",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Activación piramidal Z3",
          "cadence": 92,
          "rpe": 6.5,
          "zone": 3,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Recuperación pre-bloque Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Bloque 1: Sweet Spot Master (158-170 BPM)",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 1200
        },
        {
          "phase": "Recuperación activa Z1 (< 113 BPM)",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero Master (158-170 BPM)",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "aero",
          "t": 1200
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ]
    }
  },
  {
    "id": "dia3_recuperacion",
    "day": "Día 3",
    "category": "recuperacion",
    "title": "Día 3 · Recuperación Activa Z1",
    "subtitle": "Regenerativo suave (< 113 BPM) · Soltar piernas y disipar lactato",
    "icon": "ti-heart-rate-monitor",
    "colorClass": "emerald",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento suave Z1",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Rodaje ágil de cadencia Z1",
          "cadence": 82,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Soltura de piernas suave Z1",
          "cadence": 85,
          "rpe": 2,
          "zone": 1,
          "posture": "de pie",
          "t": 720
        },
        {
          "phase": "Enfriamiento y desaceleración Z1",
          "cadence": 75,
          "rpe": 1.5,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento suave Z1",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Rodaje regenerativo Z1",
          "cadence": 84,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Z2 muy suave de activación capilar",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Soltura regenerativa Z1",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Enfriamiento final Z1",
          "cadence": 75,
          "rpe": 1.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento suave Z1",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Rodaje ágil sin carga Z1",
          "cadence": 85,
          "rpe": 2.2,
          "zone": 1,
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Z2 muy suave de flujo sanguíneo",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Desconexión regenerativa Z1",
          "cadence": 80,
          "rpe": 1.8,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Enfriamiento desacelerado Z1",
          "cadence": 75,
          "rpe": 1.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ]
    }
  },
  {
    "id": "opcional_umbral_z4",
    "day": "Calidad Opcional",
    "category": "calidad",
    "title": "Alternativa · Umbral FTP Z4 (153-170 BPM)",
    "subtitle": "Intervalos de umbral de lactato sostenido (153-170 BPM)",
    "icon": "ti-bolt",
    "colorClass": "rose",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 85,
          "rpe": 3.5,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Activación Z3",
          "cadence": 90,
          "rpe": 6,
          "zone": 3,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Recuperación pre-bloque Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 1 Umbral FTP Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Recuperación activa Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 2 Umbral FTP Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Recuperación activa Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 3 Umbral FTP Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 540
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Activación Z3",
          "cadence": 92,
          "rpe": 6.2,
          "zone": 3,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Recuperación pre-bloque Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 1 Umbral FTP Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Recuperación activa Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 2 Umbral FTP Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Recuperación activa Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 3 Umbral FTP Z4 (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 480
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento Z1->Z2",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Activación Z3",
          "cadence": 92,
          "rpe": 6.5,
          "zone": 3,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Recuperación pre-bloque Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 1 Umbral FTP Z4 Sostenido (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Recuperación activa Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Serie 2 Umbral FTP Z4 Sostenido (153-170 BPM)",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Enfriamiento regenerativo Z1",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 480
        }
      ]
    }
  }
];

export function getRoutine(id, level = 'fase1') {
  const aliasMap = {
    'lunes_fondo_aero': 'dia1_fondo_z2',
    'jueves_fondo_z2': 'dia1_fondo_z2',
    'sabado_fondo_extendido': 'dia1_fondo_z2',
    'martes_sweet_spot': 'dia2_sweet_spot',
    'miercoles_recuperacion': 'dia3_recuperacion',
    'viernes_umbral_z4': 'opcional_umbral_z4'
  };
  const targetId = aliasMap[id] || id;
  const item = ROUTINES_POOL.find(r => r.id === targetId) || ROUTINES_POOL[0];
  if (!item) return null;
  const routine = item.levels[level] || item.levels.fase1 || Object.values(item.levels)[0];
  return {
    id: item.id,
    title: item.title,
    level,
    steps: routine.map(s => parseStep(s))
  };
}
