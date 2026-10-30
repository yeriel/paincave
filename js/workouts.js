/**
 * Catálogo, Gestor de Rutinas y Parser de Entrenamientos
 * Adaptado para Bicicleta de Spinning con microciclo rotativo de 4 días
 * Día 1: Fondo Z2 (60 min) -> Día 2: Sweet Spot (157-166 BPM) -> Día 3: Z1 (< 113 BPM) -> Día 4: Descanso Total
 */

import { gamification } from './gamification.js';

// Mapeo fisiológico de RPE (1-10) a Zona Cardíaca (1-5 + Sweet Spot)
export function getZoneFromRpe(rpe) {
  if (rpe === null || rpe === undefined) return 2;
  if (rpe <= 3.0) return 1;    // Recuperación activa (< 60% FC Máx = < 113 BPM)
  if (rpe <= 5.0) return 2;    // Fondo aeróbico (60-74% FC Máx = 113-140 BPM)
  if (rpe <= 6.8) return 3;    // Tempo (75-85% FC Máx = 142-161 BPM)
  if (rpe <= 7.8) return 'SS'; // Sweet Spot subzona (83-88% FC Máx = 157-166 BPM)

  if (rpe <= 8.8) return 4;    // Umbral de lactato (85-94% FC Máx = 161-178 BPM)
  return 5;                    // VO2 Máx (94-100% FC Máx = 178-189 BPM)
}

// Rango BPM estimado para cada zona según FC Máx (Calibrado con FC Máx = 189 BPM)
export function getZoneBpmRange(zone, maxHr = null) {
  const hr = maxHr || gamification.getMaxHR();
  const z = typeof zone === 'string' ? zone.trim().toUpperCase() : String(zone);
  if (z === 'SS' || z === 'SWEETSPOT' || z === 'SWEET SPOT') {
    return `${Math.round(hr * 0.83)} - ${Math.round(hr * 0.88)}`; // 157 - 166 BPM (83-88%)
  }
  switch (parseInt(z)) {
    case 1: return `<${Math.round(hr * 0.60)}`; // < 113 BPM (< 60%)
    case 2: return `${Math.round(hr * 0.60)} - ${Math.round(hr * 0.74)}`; // 113 - 140 BPM (60-74%)
    case 3: return `${Math.round(hr * 0.75)} - ${Math.round(hr * 0.85)}`; // 142 - 161 BPM (75-85%)
    case 4: return `${Math.round(hr * 0.85)} - ${Math.round(hr * 0.94)}`; // 161 - 178 BPM (85-94%)
    case 5: return `${Math.round(hr * 0.94)} - ${hr}`; // 178 - 189 BPM (94-100%)
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
    if (zone === 'SS') instruction = 'Sweet Spot: busca 157-166 BPM';
    else if (zone === 4) instruction = 'Umbral: 161-178 BPM';
    else if (zone === 3) instruction = 'Tempo: 142-161 BPM';
    else if (zone === 2) instruction = 'Zona 2: ritmo fluido (113-140 BPM)';
    else if (zone === 1) instruction = 'Recuperación suave (< 113 BPM)';
    if (posture === 'aero') instruction += ' · Aero';
    else if (posture === 'de pie') instruction += ' · De pie';

    return {
      phase: step.phase,
      desc: step.desc || `${step.phase}${cadence ? ` · ${cadence} RPM` : ''}`,
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
  if (zone === 'SS') instruction = 'Sweet Spot: busca 157-166 BPM';
  else if (zone === 4) instruction = 'Umbral: 161-178 BPM';
  else if (zone === 3) instruction = 'Tempo: 142-161 BPM';
  else if (zone === 2) instruction = 'Zona 2: ritmo fluido (113-140 BPM)';
  else if (zone === 1) instruction = 'Recuperación suave (< 113 BPM)';
  if (posture === 'aero') instruction += ' · Aero';
  else if (posture === 'de pie') instruction += ' · De pie';

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
      desc: `${phase}${cadence ? ` · ${cadence} RPM` : ''}`,
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
    "title": "Día 1 · Fondo Z2",
    "subtitle": "Base aeróbica (113-140 BPM) con volumen progresivo",
    "icon": "ti-wind",
    "colorClass": "cyan",
    "levels": {
      // Fase 1 (Semanas 1 a 4): 60 minutos (3.600 segundos) - Adaptación y base inicial
      "fase1": [
        {
          "phase": "Calentamiento",
          "cadence": 85,
          "rpe": 3,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Fondo Z2",
          "cadence": 88,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Aero Z2",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 300
        },
        {
          "phase": "De pie (Alivio)",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Fondo Z2",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 1110
        },
        {
          "phase": "Aero Z2",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 360
        },
        {
          "phase": "De pie (Alivio)",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 60
        },
        {
          "phase": "Fondo Z2 suave",
          "cadence": 88,
          "rpe": 4,
          "zone": 2,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Enfriamiento",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ],
      // Fase 2 (Semanas 5 a 8): 75 minutos (4.500 segundos) - Progresión de volumen y resistencia aeróbica
      "fase2": [
        {
          "phase": "Calentamiento",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Fondo Z2",
          "cadence": 90,
          "rpe": 4.5,
          "zone": 2,
          "posture": "sentado",
          "t": 780
        },
        {
          "phase": "Aero Z2 sostenido",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 600
        },
        {
          "phase": "De pie (Alivio)",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Fondo Z2 continuo",
          "cadence": 92,
          "rpe": 4.8,
          "zone": 2,
          "posture": "sentado",
          "t": 1020
        },
        {
          "phase": "Aero Z2 sostenido",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 660
        },
        {
          "phase": "De pie (Alivio)",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Fondo Z2 suave",
          "cadence": 88,
          "rpe": 4.2,
          "zone": 2,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Enfriamiento",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ],
      // Fase 3 (Semanas 9 a 12): 85 minutos (5.100 segundos) - Sobrecarga de volumen y saturación aeróbica
      "fase3": [
        {
          "phase": "Calentamiento",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Fondo Z2 ritmo",
          "cadence": 92,
          "rpe": 4.8,
          "zone": 2,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Aero Z2 contrarreloj",
          "cadence": 92,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "De pie (Alivio)",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Fondo Z2 continuo",
          "cadence": 90,
          "rpe": 4.8,
          "zone": 2,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Aero Z2 contrarreloj",
          "cadence": 92,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 780
        },
        {
          "phase": "De pie (Alivio)",
          "cadence": 75,
          "rpe": 4,
          "zone": 2,
          "posture": "de pie",
          "t": 90
        },
        {
          "phase": "Aero Z2 final",
          "cadence": 90,
          "rpe": 5,
          "zone": 2,
          "posture": "aero",
          "t": 660
        },
        {
          "phase": "Fondo Z2 suave",
          "cadence": 85,
          "rpe": 3.8,
          "zone": 2,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Enfriamiento",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ]
    }
  },
  {
    "id": "dia2_sweet_spot",
    "day": "Día 2",
    "category": "calidad",
    "title": "Día 2 · Sweet Spot",
    "subtitle": "Intervalos de calidad sostenida (157-166 BPM)",
    "icon": "ti-flame",
    "colorClass": "amber",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento",
          "cadence": 85,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 420
        },
        {
          "phase": "Activación Z3",
          "cadence": 90,
          "rpe": 6,
          "zone": 3,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Sweet Spot",
          "cadence": 88,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Sweet Spot Aero",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "aero",
          "t": 720
        },
        {
          "phase": "Enfriamiento",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 420
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
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
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Sweet Spot",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Sweet Spot Aero",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "aero",
          "t": 900
        },
        {
          "phase": "Enfriamiento",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 2,
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
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Sweet Spot",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "sentado",
          "t": 1200
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        },
        {
          "phase": "Sweet Spot Aero",
          "cadence": 90,
          "rpe": 7.8,
          "zone": "SS",
          "posture": "aero",
          "t": 1200
        },
        {
          "phase": "Enfriamiento",
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
    "title": "Día 3 · Recuperación",
    "subtitle": "Regenerativo suave (< 113 BPM) para soltar piernas",
    "icon": "ti-heart-rate-monitor",
    "colorClass": "emerald",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 82,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 720
        },
        {
          "phase": "Soltura de piernas",
          "cadence": 85,
          "rpe": 2,
          "zone": 1,
          "posture": "de pie",
          "t": 720
        },
        {
          "phase": "Enfriamiento",
          "cadence": 75,
          "rpe": 1.5,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 84,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 840
        },
        {
          "phase": "Z2 muy suave",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Soltura de piernas",
          "cadence": 82,
          "rpe": 2,
          "zone": 1,
          "posture": "de pie",
          "t": 360
        },
        {
          "phase": "Enfriamiento",
          "cadence": 75,
          "rpe": 1.5,
          "zone": 1,
          "posture": "sentado",
          "t": 240
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento",
          "cadence": 80,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 85,
          "rpe": 2.2,
          "zone": 1,
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Z2 muy suave",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 2,
          "posture": "sentado",
          "t": 600
        },
        {
          "phase": "Soltura de piernas",
          "cadence": 80,
          "rpe": 1.8,
          "zone": 1,
          "posture": "de pie",
          "t": 420
        },
        {
          "phase": "Enfriamiento",
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
    "day": "Opcional",
    "category": "calidad",
    "title": "Alternativa · Umbral Z4",
    "subtitle": "Intervalos en umbral de lactato (161-178 BPM)",
    "icon": "ti-bolt",
    "colorClass": "rose",
    "levels": {
      "fase1": [
        {
          "phase": "Calentamiento",
          "cadence": 85,
          "rpe": 3.5,
          "zone": 2,
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
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Umbral FTP Z4",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Umbral FTP Z4",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Umbral FTP Z4",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 360
        },
        {
          "phase": "Enfriamiento",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 540
        }
      ],
      "fase2": [
        {
          "phase": "Calentamiento",
          "cadence": 86,
          "rpe": 3.5,
          "zone": 2,
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
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Umbral FTP Z4",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Umbral FTP Z4",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 180
        },
        {
          "phase": "Umbral FTP Z4",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 480
        },
        {
          "phase": "Enfriamiento",
          "cadence": 78,
          "rpe": 2,
          "zone": 1,
          "posture": "sentado",
          "t": 480
        }
      ],
      "fase3": [
        {
          "phase": "Calentamiento",
          "cadence": 88,
          "rpe": 3.5,
          "zone": 2,
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
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 120
        },
        {
          "phase": "Umbral FTP Z4",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Recuperación Z1",
          "cadence": 80,
          "rpe": 2.5,
          "zone": 1,
          "posture": "sentado",
          "t": 300
        },
        {
          "phase": "Umbral FTP Z4",
          "cadence": 90,
          "rpe": 8.5,
          "zone": 4,
          "posture": "sentado",
          "t": 900
        },
        {
          "phase": "Enfriamiento",
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
