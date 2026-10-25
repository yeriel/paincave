/**
 * Catálogo, Gestor de Rutinas y Parser de Entrenamientos
 * Adaptado para Bicicleta de Spinning con sesiones de 45 a 60 minutos
 */

import { gamification } from './gamification.js';

// Mapeo fisiológico de RPE (1-10) a Zona Cardíaca (1-5)
export function getZoneFromRpe(rpe) {
  if (rpe === null || rpe === undefined) return 2;
  if (rpe <= 3.5) return 1;
  if (rpe <= 5.5) return 2;
  if (rpe <= 7.0) return 3;
  if (rpe <= 8.5) return 4;
  return 5;
}

// Rango BPM estimado para cada zona según FC Máx
export function getZoneBpmRange(zone, maxHr = null) {
  const hr = maxHr || gamification.getMaxHR();
  const z = parseInt(zone);
  if (isNaN(z)) return '—';
  switch (z) {
    case 1: return `< ${Math.round(hr * 0.60)}`;
    case 2: return `${Math.round(hr * 0.60)} - ${Math.round(hr * 0.70)}`;
    case 3: return `${Math.round(hr * 0.70)} - ${Math.round(hr * 0.80)}`;
    case 4: return `${Math.round(hr * 0.80)} - ${Math.round(hr * 0.90)}`;
    case 5: return `> ${Math.round(hr * 0.90)}`;
    default: return '—';
  }
}

// Normalizador de paso / fase individual
export function parseStep(step) {
  if (typeof step === 'object' && step.phase) {
    const rpe = step.rpe !== undefined ? step.rpe : null;
    const cadence = step.cadence !== undefined ? step.cadence : null;
    let posture = step.posture;
    if (!posture) {
      const pLower = (step.phase || '').toLowerCase();
      if (pLower.includes('aero')) posture = 'aero';
      else if (pLower.includes('de pie')) posture = 'de pie';
      else posture = 'sentado';
    }
    const zone = step.zone || getZoneFromRpe(rpe);
    let instruction = 'Pedaleo fluido sentado';
    if (posture === 'aero') instruction = 'Codos flexionados y core activo';
    else if (posture === 'de pie') instruction = '¡Ponte de pie sobre los pedales!';

    return {
      phase: step.phase,
      desc: step.desc || `${step.phase}${cadence ? ` [Cadencia ${cadence} RPM]` : ''} [RPE ${rpe}]`,
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
  const zm = desc.match(/Zona (\d)/);
  const rm = desc.match(/RPE ([\d.]+)/);
  const cm = desc.match(/Cadencia (\d+)/) || desc.match(/(\d+)\s*RPM/i);

  const rpe = rm ? parseFloat(rm[1]) : (typeof step === 'object' && step.rpe !== undefined ? step.rpe : null);
  const cadence = cm ? parseInt(cm[1]) : (typeof step === 'object' && step.cadence !== undefined ? step.cadence : null);
  const pLower = (desc + ' ' + phase).toLowerCase();
  let posture = 'sentado';
  if (pLower.includes('aero')) posture = 'aero';
  else if (pLower.includes('de pie')) posture = 'de pie';
  const zone = zm ? parseInt(zm[1]) : getZoneFromRpe(rpe);

  let instruction = 'Pedaleo fluido sentado';
  if (posture === 'aero') instruction = 'Codos flexionados y core activo';
  else if (posture === 'de pie') instruction = '¡Ponte de pie sobre los pedales!';

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

  const lvl = lines[0].toLowerCase().replace('é', 'e');
  if (!['principiante', 'amateur', 'elite', 'pro'].includes(lvl)) {
    throw new Error("Nivel inválido en la línea 1. Debe ser: Principiante, Amateur, Élite o Pro.");
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
        zone = getZoneFromRpe(rpe);
      } else {
        zone = col2; // Zona explícita
        cadence = null;
      }
    } else {
      zone = getZoneFromRpe(rpe);
    }

    const pLower = phase.toLowerCase();
    let posture = 'sentado';
    if (pLower.includes('aero')) posture = 'aero';
    else if (pLower.includes('de pie')) posture = 'de pie';

    steps.push({
      phase,
      desc: `${phase}${cadence ? ` [Cadencia ${cadence} RPM]` : ''} [Zona ${zone}] [RPE ${rpe}]`,
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
    "id": "fondo_z2",
    "category": "fondo",
    "title": "Fondo Aeróbico Z2",
    "subtitle": "Base mitocondrial continua (88-92 RPM)",
    "icon": "ti-leaf",
    "colorClass": "emerald",
    "levels": {
      "principiante": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 85,
          "rpe": 3,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Rodaje base Z2",
          "cadence": 88,
          "rpe": 4.5,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Introducción posición Aero",
          "cadence": 90,
          "rpe": 5,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Alivio y apertura cadera",
          "cadence": 75,
          "rpe": 4,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Fondo Z2 continuo",
          "cadence": 90,
          "rpe": 4.5,
          "posture": "sentado",
          "t": 690
        },
        {
          "phase": "Posición Aero sostenida",
          "cadence": 90,
          "rpe": 5,
          "posture": "aero",
          "t": 300
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 82,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 420
        }
      ],
      "amateur": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 86,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Rodaje base Z2",
          "cadence": 90,
          "rpe": 4.5,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Bloque Aero Z2 técnico",
          "cadence": 90,
          "rpe": 5,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Alivio de pie Z2",
          "cadence": 75,
          "rpe": 4,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 sostenido",
          "cadence": 90,
          "rpe": 4.5,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Bloque Aero Z2 técnico",
          "cadence": 90,
          "rpe": 5,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 82,
          "rpe": 2,
          "posture": "sentado",
          "t": 300
        }
      ],
      "elite": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 88,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Fondo Z2 sostenido",
          "cadence": 92,
          "rpe": 4.5,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Crucero Aero Z2",
          "cadence": 92,
          "rpe": 5,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Alivio de pie Z2",
          "cadence": 75,
          "rpe": 4,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 sostenido",
          "cadence": 92,
          "rpe": 4.5,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Crucero Aero Z2",
          "cadence": 92,
          "rpe": 5,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 82,
          "rpe": 2,
          "posture": "sentado",
          "t": 240
        }
      ],
      "pro": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 90,
          "rpe": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Fondo Z2 continuo",
          "cadence": 92,
          "rpe": 4.5,
          "posture": "sentado",
          "t": 960
        },
        {
          "phase": "Crucero Aero prolongado",
          "cadence": 92,
          "rpe": 5,
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "Alivio de pie Z2",
          "cadence": 75,
          "rpe": 4,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Fondo Z2 continuo",
          "cadence": 92,
          "rpe": 4.5,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Posición Aero de carrera",
          "cadence": 94,
          "rpe": 5.5,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 85,
          "rpe": 2,
          "posture": "sentado",
          "t": 240
        }
      ]
    }
  },
  {
    "id": "adaptacion_aero",
    "category": "aero",
    "title": "Adaptación Postural Aero",
    "subtitle": "Core, lumbares y codos a 90°",
    "icon": "ti-wind",
    "colorClass": "cyan",
    "levels": {
      "principiante": [
        {
          "phase": "Calentamiento dinámico",
          "cadence": 85,
          "rpe": 3,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Serie 1: Postura Aero",
          "cadence": 88,
          "rpe": 5,
          "posture": "aero",
          "t": 300
        },
        {
          "phase": "Recuperación erguido",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 2: Postura Aero",
          "cadence": 90,
          "rpe": 5,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "Recuperación erguido",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Alivio de pie",
          "cadence": 75,
          "rpe": 4,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Serie 3: Postura Aero",
          "cadence": 90,
          "rpe": 5.5,
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación erguido",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 4: Postura Aero final",
          "cadence": 90,
          "rpe": 5.5,
          "posture": "aero",
          "t": 300
        },
        {
          "phase": "Enfriamiento articular",
          "cadence": 82,
          "rpe": 2,
          "posture": "sentado",
          "t": 300
        }
      ],
      "amateur": [
        {
          "phase": "Calentamiento dinámico",
          "cadence": 88,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Serie 1: Postura Aero",
          "cadence": 90,
          "rpe": 5.5,
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación erguido",
          "cadence": 88,
          "rpe": 4,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 2: Postura Aero",
          "cadence": 90,
          "rpe": 5.5,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Recuperación erguido",
          "cadence": 88,
          "rpe": 4,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Alivio de pie",
          "cadence": 75,
          "rpe": 4,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Serie 3: Aero sostenida",
          "cadence": 90,
          "rpe": 6,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Recuperación erguido",
          "cadence": 88,
          "rpe": 4,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 4: Aero consolidación",
          "cadence": 90,
          "rpe": 6,
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Enfriamiento articular",
          "cadence": 82,
          "rpe": 2,
          "posture": "sentado",
          "t": 360
        }
      ],
      "elite": [
        {
          "phase": "Calentamiento dinámico",
          "cadence": 88,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Serie 1: Postura Aero",
          "cadence": 92,
          "rpe": 6,
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "Recuperación erguido",
          "cadence": 88,
          "rpe": 4,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 2: Aero profunda",
          "cadence": 92,
          "rpe": 6,
          "posture": "aero",
          "t": 660
        },
        {
          "phase": "Alivio de pie",
          "cadence": 75,
          "rpe": 4,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Serie 3: Aero de ritmo",
          "cadence": 92,
          "rpe": 6.5,
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "Recuperación erguido",
          "cadence": 88,
          "rpe": 4,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 4: Aero final",
          "cadence": 92,
          "rpe": 6.5,
          "posture": "aero",
          "t": 300
        },
        {
          "phase": "Enfriamiento articular",
          "cadence": 82,
          "rpe": 2,
          "posture": "sentado",
          "t": 240
        }
      ],
      "pro": [
        {
          "phase": "Calentamiento dinámico",
          "cadence": 90,
          "rpe": 4,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Serie 1: Postura Aero",
          "cadence": 92,
          "rpe": 6,
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "Transición activa sentado",
          "cadence": 88,
          "rpe": 4,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 2: Aero sostenida",
          "cadence": 92,
          "rpe": 6.5,
          "posture": "aero",
          "t": 840
        },
        {
          "phase": "Alivio de pie",
          "cadence": 75,
          "rpe": 4,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Serie 3: Aero de competición",
          "cadence": 94,
          "rpe": 7,
          "posture": "aero",
          "t": 960
        },
        {
          "phase": "Transición activa sentado",
          "cadence": 88,
          "rpe": 4,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Enfriamiento articular",
          "cadence": 82,
          "rpe": 2,
          "posture": "sentado",
          "t": 300
        }
      ]
    }
  },
  {
    "id": "intervalos_umbral",
    "category": "umbral",
    "title": "Intervalos de Umbral Z4",
    "subtitle": "Potencia crítica y tolerancia a lactato",
    "icon": "ti-flame",
    "colorClass": "rose",
    "levels": {
      "principiante": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Serie 1: Umbral Z4",
          "cadence": 90,
          "rpe": 7.5,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 2: Umbral Z4 Aero",
          "cadence": 90,
          "rpe": 8,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 3: Umbral Z4",
          "cadence": 90,
          "rpe": 8,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 4: Umbral Z4 Aero",
          "cadence": 90,
          "rpe": 8,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Enfriamiento regenerativo",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 660
        }
      ],
      "amateur": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Serie 1: Umbral Z4",
          "cadence": 90,
          "rpe": 7.5,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 2: Umbral Z4 Aero",
          "cadence": 90,
          "rpe": 8,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 3: Umbral Z4",
          "cadence": 90,
          "rpe": 8,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 4: Umbral Z4 Aero",
          "cadence": 90,
          "rpe": 8.5,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Serie 5: Umbral Z4 Aero",
          "cadence": 90,
          "rpe": 8.5,
          "posture": "aero",
          "t": 240
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Enfriamiento regenerativo",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 720
        }
      ],
      "elite": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 88,
          "rpe": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Serie 1: Umbral Z4",
          "cadence": 90,
          "rpe": 8,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 2: Umbral Z4 Aero",
          "cadence": 92,
          "rpe": 8.5,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Serie 3: Umbral Z4 Aero",
          "cadence": 92,
          "rpe": 8.5,
          "posture": "aero",
          "t": 480
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Enfriamiento regenerativo",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 840
        }
      ],
      "pro": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 90,
          "rpe": 4,
          "posture": "sentado",
          "t": 450
        },
        {
          "phase": "Serie 1: Umbral Z4",
          "cadence": 92,
          "rpe": 8,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 2: Umbral Z4 Aero",
          "cadence": 92,
          "rpe": 8.5,
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 3: Umbral Z4 Aero",
          "cadence": 92,
          "rpe": 8.5,
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Serie 4: Umbral Z4 Aero a fondo",
          "cadence": 94,
          "rpe": 9,
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 150
        },
        {
          "phase": "Enfriamiento regenerativo",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 870
        }
      ]
    }
  },
  {
    "id": "sweet_spot",
    "category": "sweetspot",
    "title": "Sweet Spot 88-93%",
    "subtitle": "Máxima ganancia aeróbica y crucero",
    "icon": "ti-bolt",
    "colorClass": "amber",
    "levels": {
      "principiante": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot",
          "cadence": 88,
          "rpe": 7,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero",
          "cadence": 90,
          "rpe": 7,
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Enfriamiento progresivo",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 600
        }
      ],
      "amateur": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot sentado",
          "cadence": 88,
          "rpe": 7,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot Aero",
          "cadence": 90,
          "rpe": 7.5,
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot sentado",
          "cadence": 88,
          "rpe": 7,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero",
          "cadence": 90,
          "rpe": 7.5,
          "posture": "aero",
          "t": 420
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Enfriamiento progresivo",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 420
        }
      ],
      "elite": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 88,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot sentado",
          "cadence": 90,
          "rpe": 7,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Bloque 1: Sweet Spot Aero",
          "cadence": 92,
          "rpe": 7.5,
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Bloque 2: Sweet Spot sentado",
          "cadence": 90,
          "rpe": 7,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero",
          "cadence": 92,
          "rpe": 7.5,
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Enfriamiento progresivo",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 300
        }
      ],
      "pro": [
        {
          "phase": "Calentamiento progresivo",
          "cadence": 90,
          "rpe": 4,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Bloque 1: Sweet Spot sentado",
          "cadence": 90,
          "rpe": 7,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Bloque 1: Sweet Spot Aero",
          "cadence": 92,
          "rpe": 7.5,
          "posture": "aero",
          "t": 900
        },
        {
          "phase": "Recuperación activa Z2",
          "cadence": 85,
          "rpe": 3.5,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Bloque 2: Sweet Spot sentado",
          "cadence": 90,
          "rpe": 7,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Bloque 2: Sweet Spot Aero",
          "cadence": 92,
          "rpe": 8,
          "posture": "aero",
          "t": 900
        },
        {
          "phase": "Enfriamiento regenerativo",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 480
        }
      ]
    }
  },
  {
    "id": "recuperacion_activa",
    "category": "recuperacion",
    "title": "Recuperación Activa",
    "subtitle": "Zona 1 · Drenaje y regeneración",
    "icon": "ti-activity",
    "colorClass": "teal",
    "levels": {
      "principiante": [
        {
          "phase": "Rodaje suave",
          "cadence": 80,
          "rpe": 2,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Pedaleo regenerativo Z1",
          "cadence": 85,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 65,
          "rpe": 2,
          "posture": "de pie",
          "t": 120
        },
        {
          "phase": "Pedaleo regenerativo Z1",
          "cadence": 85,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 80,
          "rpe": 1.5,
          "posture": "sentado",
          "t": 540
        }
      ],
      "amateur": [
        {
          "phase": "Rodaje suave",
          "cadence": 82,
          "rpe": 2,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Pedaleo regenerativo Z1",
          "cadence": 88,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 68,
          "rpe": 2,
          "posture": "de pie",
          "t": 180
        },
        {
          "phase": "Pedaleo regenerativo Z1",
          "cadence": 88,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 80,
          "rpe": 1.5,
          "posture": "sentado",
          "t": 420
        }
      ],
      "elite": [
        {
          "phase": "Rodaje suave",
          "cadence": 82,
          "rpe": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Pedaleo regenerativo Z1",
          "cadence": 88,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 1020
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 70,
          "rpe": 2,
          "posture": "de pie",
          "t": 180
        },
        {
          "phase": "Pedaleo regenerativo Z1",
          "cadence": 88,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 960
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 80,
          "rpe": 1.5,
          "posture": "sentado",
          "t": 420
        }
      ],
      "pro": [
        {
          "phase": "Rodaje suave",
          "cadence": 85,
          "rpe": 2,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Pedaleo regenerativo Z1",
          "cadence": 90,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 1140
        },
        {
          "phase": "Alivio de pie articular",
          "cadence": 70,
          "rpe": 2,
          "posture": "de pie",
          "t": 180
        },
        {
          "phase": "Pedaleo regenerativo Z1",
          "cadence": 90,
          "rpe": 2.5,
          "posture": "sentado",
          "t": 1080
        },
        {
          "phase": "Enfriamiento y soltura",
          "cadence": 80,
          "rpe": 1.5,
          "posture": "sentado",
          "t": 420
        }
      ]
    }
  }
];

export function getRoutine(id, level = 'amateur') {
  const item = ROUTINES_POOL.find(r => r.id === id);
  if (!item) return null;
  const routine = item.levels[level] || item.levels.amateur;
  return {
    id: item.id,
    title: item.title,
    level,
    steps: routine.map(s => parseStep(s))
  };
}
// Safelist: border-emerald-600/30 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-300 text-emerald-400 bg-emerald-600/20 border-emerald-600/40 border-amber-600/30 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 text-amber-400 bg-amber-600/20 border-amber-600/40 border-sky-600/30 bg-sky-950/20 hover:bg-sky-900/30 text-sky-300 text-sky-400 bg-sky-600/20 border-sky-600/40 border-blue-600/30 bg-blue-950/20 hover:bg-blue-900/30 text-blue-300 text-blue-400 bg-blue-600/20 border-blue-600/40 border-rose-600/30 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 text-rose-400 bg-rose-600/20 border-rose-600/40 border-teal-600/30 bg-teal-950/20 hover:bg-teal-900/30 text-teal-300 text-teal-400 bg-teal-600/20 border-teal-600/40 border-cyan-600/30 bg-cyan-950/20 hover:bg-cyan-900/30 text-cyan-300 text-cyan-400 bg-cyan-600/20 border-cyan-600/40 border-purple-600/30 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 text-purple-400 bg-purple-600/20 border-purple-600/40
