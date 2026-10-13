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
    const posture = step.posture || (step.phase.toLowerCase().includes('de pie') ? 'de pie' : 'sentado');
    const zone = step.zone || getZoneFromRpe(rpe);
    return {
      phase: step.phase,
      desc: step.desc || `${step.phase}${cadence ? ` [Cadencia ${cadence} RPM]` : ''} [RPE ${rpe}]`,
      t: step.t,
      cadence,
      rpe,
      posture,
      zone,
      instruction: posture === 'de pie' ? '¡Ponte de pie sobre los pedales!' : 'Pedaleo fluido sentado'
    };
  }

  const desc = typeof step === 'string' ? step : (step.desc || '');
  const phase = desc.split('[')[0].split('(')[0].trim();
  const zm = desc.match(/Zona (\d)/);
  const rm = desc.match(/RPE ([\d.]+)/);
  const cm = desc.match(/Cadencia (\d+)/) || desc.match(/(\d+)\s*RPM/i);

  const rpe = rm ? parseFloat(rm[1]) : (typeof step === 'object' && step.rpe !== undefined ? step.rpe : null);
  const cadence = cm ? parseInt(cm[1]) : (typeof step === 'object' && step.cadence !== undefined ? step.cadence : null);
  const posture = desc.toLowerCase().includes('de pie') ? 'de pie' : 'sentado';
  const zone = zm ? parseInt(zm[1]) : getZoneFromRpe(rpe);

  return {
    phase: phase || 'Fase activa',
    desc,
    t: typeof step === 'object' ? step.t : 60,
    cadence,
    rpe,
    posture,
    zone,
    instruction: posture === 'de pie' ? '¡Ponte de pie sobre los pedales!' : 'Pedaleo fluido sentado'
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

    const posture = phase.toLowerCase().includes('de pie') ? 'de pie' : 'sentado';
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
  // 1. FONDO AERÓBICO (ZONA 2)
  {
    id: "fondo_z2",
    category: "fondo",
    title: "Fondo Aeróbico Z2",
    subtitle: "Resistencia base continua",
    icon: "ti-leaf",
    colorClass: "emerald",
    levels: {
      principiante: [
        { phase: "Calentamiento", cadence: 85, rpe: 3, posture: "sentado", t: 360 },
        { phase: "Rodaje base", cadence: 90, rpe: 4, posture: "sentado", t: 720 },
        { phase: "Pedaleo de pie", cadence: 70, rpe: 4, posture: "de pie", t: 120 },
        { phase: "Fondo aeróbico", cadence: 92, rpe: 4.5, posture: "sentado", t: 720 },
        { phase: "Pedaleo de pie", cadence: 70, rpe: 4, posture: "de pie", t: 120 },
        { phase: "Enfriamiento", cadence: 85, rpe: 3, posture: "sentado", t: 480 }
      ], // 2520s = 42 min
      amateur: [
        { phase: "Calentamiento", cadence: 85, rpe: 3, posture: "sentado", t: 420 },
        { phase: "Resistencia base", cadence: 90, rpe: 4, posture: "sentado", t: 900 },
        { phase: "Pedaleo de pie", cadence: 70, rpe: 4, posture: "de pie", t: 120 },
        { phase: "Fondo aeróbico", cadence: 92, rpe: 4.5, posture: "sentado", t: 900 },
        { phase: "Pedaleo de pie", cadence: 70, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 480 }
      ], // 3000s = 50 min
      elite: [
        { phase: "Calentamiento", cadence: 88, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Fondo sostenido", cadence: 92, rpe: 4.5, posture: "sentado", t: 1080 },
        { phase: "Pedaleo de pie", cadence: 75, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Fondo sostenido", cadence: 90, rpe: 4.5, posture: "sentado", t: 1080 },
        { phase: "Pedaleo de pie", cadence: 75, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ], // 3300s = 55 min
      pro: [
        { phase: "Calentamiento", cadence: 88, rpe: 3.5, posture: "sentado", t: 480 },
        { phase: "Fondo sostenido", cadence: 92, rpe: 4.5, posture: "sentado", t: 1200 },
        { phase: "Pedaleo de pie", cadence: 75, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Fondo sostenido", cadence: 90, rpe: 4.5, posture: "sentado", t: 1200 },
        { phase: "Pedaleo de pie", cadence: 75, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ] // 3600s = 60 min
    }
  },

  // 2. UMBRAL & SWEET SPOT
  {
    id: "sweet_spot",
    category: "fuerza",
    title: "Sweet Spot",
    subtitle: "Umbral · Potencia sostenida",
    icon: "ti-flame",
    colorClass: "amber",
    levels: {
      principiante: [
        { phase: "Calentamiento", cadence: 85, rpe: 3, posture: "sentado", t: 360 },
        { phase: "Activación", cadence: 90, rpe: 5, posture: "sentado", t: 240 },
        { phase: "Sweet Spot", cadence: 88, rpe: 7, posture: "sentado", t: 600 },
        { phase: "Recuperación", cadence: 80, rpe: 3, posture: "sentado", t: 240 },
        { phase: "Sweet Spot", cadence: 88, rpe: 7.5, posture: "sentado", t: 600 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ], // 2400s = 40 min
      amateur: [
        { phase: "Calentamiento", cadence: 85, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Activación", cadence: 92, rpe: 6, posture: "sentado", t: 180 },
        { phase: "Recuperación", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Sweet Spot", cadence: 88, rpe: 7.5, posture: "sentado", t: 780 },
        { phase: "Recuperación", cadence: 85, rpe: 3.5, posture: "sentado", t: 300 },
        { phase: "Sweet Spot", cadence: 88, rpe: 8, posture: "sentado", t: 780 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 300 }
      ], // 2880s = 48 min
      elite: [
        { phase: "Calentamiento", cadence: 88, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Activación", cadence: 80, rpe: 6.5, posture: "sentado", t: 180 },
        { phase: "Recuperación", cadence: 85, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Sweet Spot", cadence: 90, rpe: 8, posture: "sentado", t: 900 },
        { phase: "Recuperación", cadence: 85, rpe: 3.5, posture: "sentado", t: 300 },
        { phase: "Sweet Spot", cadence: 90, rpe: 8.5, posture: "sentado", t: 900 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 420 }
      ], // 3240s = 54 min
      pro: [
        { phase: "Calentamiento", cadence: 90, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Activación", cadence: 95, rpe: 7, posture: "sentado", t: 240 },
        { phase: "Recuperación", cadence: 85, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Umbral crítico", cadence: 90, rpe: 8.5, posture: "sentado", t: 1080 },
        { phase: "Recuperación", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Umbral crítico", cadence: 90, rpe: 9, posture: "sentado", t: 1080 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ] // 3600s = 60 min
    }
  },

  // 3. FUERZA & ESCALADA (ATRANQUE EN SPINNING)
  {
    id: "escalada_fuerza",
    category: "escalada",
    title: "Escalada de Fuerza",
    subtitle: "55-65 RPM · Carga alta",
    icon: "ti-mountain",
    colorClass: "sky",
    levels: {
      principiante: [
        { phase: "Calentamiento", cadence: 85, rpe: 3, posture: "sentado", t: 360 },
        { phase: "Aproximación", cadence: 80, rpe: 4.5, posture: "sentado", t: 240 },
        { phase: "Subida de fuerza", cadence: 65, rpe: 6, posture: "sentado", t: 480 },
        { phase: "Rampa dura de pie", cadence: 60, rpe: 7.5, posture: "de pie", t: 120 },
        { phase: "Falso llano", cadence: 80, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Subida de fuerza", cadence: 65, rpe: 6.5, posture: "sentado", t: 480 },
        { phase: "Rampa final de pie", cadence: 55, rpe: 8, posture: "de pie", t: 120 },
        { phase: "Enfriamiento", cadence: 85, rpe: 2, posture: "sentado", t: 480 }
      ], // 2520s = 42 min
      amateur: [
        { phase: "Calentamiento", cadence: 88, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Aproximación", cadence: 80, rpe: 5, posture: "sentado", t: 240 },
        { phase: "Subida de fuerza", cadence: 65, rpe: 7.5, posture: "sentado", t: 540 },
        { phase: "Rampa dura de pie", cadence: 58, rpe: 8.5, posture: "de pie", t: 180 },
        { phase: "Falso llano", cadence: 85, rpe: 4, posture: "sentado", t: 240 },
        { phase: "Subida de fuerza", cadence: 65, rpe: 8, posture: "sentado", t: 540 },
        { phase: "Cumbre de pie", cadence: 55, rpe: 9, posture: "de pie", t: 180 },
        { phase: "Enfriamiento", cadence: 85, rpe: 2, posture: "sentado", t: 540 }
      ], // 2880s = 48 min
      elite: [
        { phase: "Calentamiento", cadence: 90, rpe: 4, posture: "sentado", t: 420 },
        { phase: "Entrada en rampa", cadence: 75, rpe: 6, posture: "sentado", t: 240 },
        { phase: "Fuerza en subida", cadence: 60, rpe: 8, posture: "sentado", t: 600 },
        { phase: "Muro de pie", cadence: 55, rpe: 9.5, posture: "de pie", t: 180 },
        { phase: "Falso llano", cadence: 85, rpe: 4, posture: "sentado", t: 240 },
        { phase: "Segunda subida", cadence: 60, rpe: 8.5, posture: "sentado", t: 660 },
        { phase: "Cumbre de pie", cadence: 55, rpe: 9.5, posture: "de pie", t: 300 },
        { phase: "Enfriamiento", cadence: 85, rpe: 2, posture: "sentado", t: 600 }
      ], // 3240s = 54 min
      pro: [
        { phase: "Calentamiento", cadence: 92, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Aproximación", cadence: 80, rpe: 6.5, posture: "sentado", t: 300 },
        { phase: "Subida a fuerza", cadence: 55, rpe: 8.5, posture: "sentado", t: 720 },
        { phase: "Rampa dura de pie", cadence: 50, rpe: 10, posture: "de pie", t: 240 },
        { phase: "Falso llano", cadence: 85, rpe: 4, posture: "sentado", t: 240 },
        { phase: "Subida final", cadence: 65, rpe: 9, posture: "sentado", t: 720 },
        { phase: "Cumbre de pie", cadence: 60, rpe: 10, posture: "de pie", t: 300 },
        { phase: "Enfriamiento", cadence: 85, rpe: 2, posture: "sentado", t: 600 }
      ] // 3600s = 60 min
    }
  },

  // 4. AGILIDAD & CADENCIA (MOLINILLO Y EFICIENCIA)
  {
    id: "agilidad_cadencia",
    category: "agilidad",
    title: "Agilidad & Molinillo",
    subtitle: "95-115 RPM · Eficiencia",
    icon: "ti-rotate-clockwise",
    colorClass: "blue",
    levels: {
      principiante: [
        { phase: "Calentamiento", cadence: 85, rpe: 3, posture: "sentado", t: 360 },
        { phase: "Ritmo base", cadence: 90, rpe: 4, posture: "sentado", t: 360 },
        { phase: "Molinillo ágil", cadence: 100, rpe: 5.5, posture: "sentado", t: 360 },
        { phase: "Recuperación", cadence: 85, rpe: 3, posture: "sentado", t: 180 },
        { phase: "Molinillo ágil", cadence: 100, rpe: 5.5, posture: "sentado", t: 360 },
        { phase: "Recuperación", cadence: 85, rpe: 3, posture: "sentado", t: 180 },
        { phase: "Aceleración ágil", cadence: 105, rpe: 6.5, posture: "sentado", t: 240 },
        { phase: "Enfriamiento", cadence: 85, rpe: 2, posture: "sentado", t: 260 }
      ], // 2400s = 40 min
      amateur: [
        { phase: "Calentamiento", cadence: 88, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Ritmo base", cadence: 92, rpe: 4.5, posture: "sentado", t: 300 },
        { phase: "Molinillo ágil", cadence: 102, rpe: 6, posture: "sentado", t: 300 },
        { phase: "Molinillo rápido", cadence: 110, rpe: 7.5, posture: "sentado", t: 180 },
        { phase: "Recuperación", cadence: 85, rpe: 3, posture: "sentado", t: 240 },
        { phase: "Ritmo base", cadence: 92, rpe: 4.5, posture: "sentado", t: 300 },
        { phase: "Molinillo ágil", cadence: 102, rpe: 6, posture: "sentado", t: 300 },
        { phase: "Molinillo rápido", cadence: 110, rpe: 7.5, posture: "sentado", t: 180 },
        { phase: "Recuperación", cadence: 85, rpe: 3, posture: "sentado", t: 240 },
        { phase: "Sprint ágil", cadence: 115, rpe: 8.5, posture: "sentado", t: 60 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 240 }
      ], // 2760s = 46 min
      elite: [
        { phase: "Calentamiento", cadence: 90, rpe: 4, posture: "sentado", t: 420 },
        { phase: "Alta cadencia", cadence: 105, rpe: 6.5, posture: "sentado", t: 600 },
        { phase: "Recuperación", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Alta cadencia", cadence: 105, rpe: 7, posture: "sentado", t: 600 },
        { phase: "Recuperación", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Micro-intervalos", cadence: 115, rpe: 8, posture: "sentado", t: 480 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 440 }
      ], // 3120s = 52 min
      pro: [
        { phase: "Calentamiento", cadence: 92, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Tempo ágil", cadence: 105, rpe: 7, posture: "sentado", t: 720 },
        { phase: "Recuperación", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Umbral ágil", cadence: 108, rpe: 8, posture: "sentado", t: 720 },
        { phase: "Recuperación", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Aceleración extrema", cadence: 120, rpe: 9, posture: "sentado", t: 600 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 480 }
      ] // 3480s = 58 min
    }
  },

  // 5. HIIT & POTENCIA MÁXIMA
  {
    id: "hiit_spinning",
    category: "hiit",
    title: "HIIT Sprints",
    subtitle: "Intervalos · Potencia máxima",
    icon: "ti-bolt",
    colorClass: "rose",
    levels: {
      principiante: [
        { phase: "Calentamiento", cadence: 85, rpe: 3, posture: "sentado", t: 480 },
        { phase: "Activación", cadence: 95, rpe: 6, posture: "sentado", t: 120 },
        { phase: "Recuperación", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Sprint de pie", cadence: 105, rpe: 8.5, posture: "de pie", t: 30 },
        { phase: "Recuperación", cadence: 75, rpe: 2.5, posture: "sentado", t: 90 },
        { phase: "Sprint de pie", cadence: 105, rpe: 8.5, posture: "de pie", t: 30 },
        { phase: "Recuperación", cadence: 75, rpe: 2.5, posture: "sentado", t: 90 },
        { phase: "Sprint de pie", cadence: 105, rpe: 9, posture: "de pie", t: 30 },
        { phase: "Recuperación", cadence: 75, rpe: 2.5, posture: "sentado", t: 90 },
        { phase: "Rodaje intermedio", cadence: 88, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Aceleración sentado", cadence: 100, rpe: 8.5, posture: "sentado", t: 45 },
        { phase: "Recuperación", cadence: 75, rpe: 2.5, posture: "sentado", t: 75 },
        { phase: "Aceleración de pie", cadence: 105, rpe: 9, posture: "de pie", t: 45 },
        { phase: "Recuperación", cadence: 75, rpe: 2.5, posture: "sentado", t: 75 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 480 }
      ], // 2280s = 38 min
      amateur: [
        { phase: "Calentamiento", cadence: 88, rpe: 3.5, posture: "sentado", t: 480 },
        { phase: "Activación", cadence: 95, rpe: 6.5, posture: "sentado", t: 180 },
        { phase: "Recuperación", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Sprint de pie", cadence: 110, rpe: 9.5, posture: "de pie", t: 30 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Sprint de pie", cadence: 110, rpe: 9.5, posture: "de pie", t: 30 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Sprint de pie", cadence: 110, rpe: 9.5, posture: "de pie", t: 30 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Sprint de pie", cadence: 110, rpe: 10, posture: "de pie", t: 30 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Rodaje intermedio", cadence: 88, rpe: 4, posture: "sentado", t: 540 },
        { phase: "Ataque sentado", cadence: 100, rpe: 9, posture: "sentado", t: 60 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Ataque de pie", cadence: 105, rpe: 9.5, posture: "de pie", t: 60 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Sprint final de pie", cadence: 115, rpe: 10, posture: "de pie", t: 30 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 760 }
      ], // 2700s = 45 min
      elite: [
        { phase: "Calentamiento", cadence: 90, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Activación", cadence: 100, rpe: 7, posture: "sentado", t: 180 },
        { phase: "Recuperación", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Sprint de pie", cadence: 115, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Recuperación", cadence: 70, rpe: 3, posture: "sentado", t: 50 },
        { phase: "Sprint de pie", cadence: 115, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Recuperación", cadence: 70, rpe: 3, posture: "sentado", t: 50 },
        { phase: "Sprint de pie", cadence: 115, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Recuperación", cadence: 70, rpe: 3, posture: "sentado", t: 50 },
        { phase: "Sprint de pie", cadence: 115, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Rodaje intermedio", cadence: 90, rpe: 4.5, posture: "sentado", t: 600 },
        { phase: "Intervalo VO2 sentado", cadence: 105, rpe: 9.5, posture: "sentado", t: 120 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Intervalo VO2 de pie", cadence: 105, rpe: 10, posture: "de pie", t: 120 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Sprint final de pie", cadence: 125, rpe: 10, posture: "de pie", t: 30 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 720 }
      ], // 3000s = 50 min
      pro: [
        { phase: "Calentamiento", cadence: 92, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Activación", cadence: 105, rpe: 7.5, posture: "sentado", t: 180 },
        { phase: "Recuperación", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Sprint de pie", cadence: 120, rpe: 10, posture: "de pie", t: 45 },
        { phase: "Recuperación", cadence: 70, rpe: 3, posture: "sentado", t: 45 },
        { phase: "Sprint de pie", cadence: 120, rpe: 10, posture: "de pie", t: 45 },
        { phase: "Recuperación", cadence: 70, rpe: 3, posture: "sentado", t: 45 },
        { phase: "Sprint de pie", cadence: 120, rpe: 10, posture: "de pie", t: 45 },
        { phase: "Recuperación", cadence: 70, rpe: 3, posture: "sentado", t: 45 },
        { phase: "Sprint de pie", cadence: 120, rpe: 10, posture: "de pie", t: 45 },
        { phase: "Recuperación", cadence: 70, rpe: 3, posture: "sentado", t: 45 },
        { phase: "Rodaje intermedio", cadence: 90, rpe: 4.5, posture: "sentado", t: 600 },
        { phase: "Intervalo anaeróbico", cadence: 110, rpe: 9.5, posture: "sentado", t: 180 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Intervalo anaeróbico de pie", cadence: 110, rpe: 10, posture: "de pie", t: 180 },
        { phase: "Recuperación", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Sprint final de pie", cadence: 130, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 940 }
      ] // 3300s = 55 min
    }
  },

  // 6. RECUPERACIÓN ACTIVA (DÍAS POST-FATIGA)
  {
    id: "recuperacion_activa",
    category: "recuperacion",
    title: "Recuperación Activa",
    subtitle: "Zona 1 · Regenerativo",
    icon: "ti-activity",
    colorClass: "teal",
    levels: {
      principiante: [
        { phase: "Rodaje suave", cadence: 80, rpe: 2, posture: "sentado", t: 300 },
        { phase: "Pedaleo regenerativo", cadence: 88, rpe: 2.5, posture: "sentado", t: 600 },
        { phase: "Alivio de pie", cadence: 65, rpe: 2.5, posture: "de pie", t: 120 },
        { phase: "Pedaleo regenerativo", cadence: 88, rpe: 2.5, posture: "sentado", t: 600 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 480 }
      ], // 2100s = 35 min
      amateur: [
        { phase: "Rodaje suave", cadence: 82, rpe: 2, posture: "sentado", t: 360 },
        { phase: "Pedaleo regenerativo", cadence: 88, rpe: 2.5, posture: "sentado", t: 900 },
        { phase: "Alivio de pie", cadence: 68, rpe: 2.5, posture: "de pie", t: 180 },
        { phase: "Pedaleo regenerativo", cadence: 88, rpe: 2.5, posture: "sentado", t: 720 },
        { phase: "Enfriamiento", cadence: 80, rpe: 1.5, posture: "sentado", t: 360 }
      ], // 2520s = 42 min
      elite: [
        { phase: "Rodaje suave", cadence: 85, rpe: 2, posture: "sentado", t: 420 },
        { phase: "Pedaleo regenerativo", cadence: 90, rpe: 2.5, posture: "sentado", t: 1020 },
        { phase: "Alivio de pie", cadence: 70, rpe: 2.5, posture: "de pie", t: 180 },
        { phase: "Pedaleo regenerativo", cadence: 90, rpe: 2.5, posture: "sentado", t: 900 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ], // 2880s = 48 min
      pro: [
        { phase: "Rodaje suave", cadence: 85, rpe: 2, posture: "sentado", t: 480 },
        { phase: "Pedaleo regenerativo", cadence: 90, rpe: 2.5, posture: "sentado", t: 1080 },
        { phase: "Alivio de pie", cadence: 70, rpe: 2.5, posture: "de pie", t: 180 },
        { phase: "Pedaleo regenerativo", cadence: 90, rpe: 2.5, posture: "sentado", t: 1020 },
        { phase: "Enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ] // 3120s = 52 min
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
// Safelist: border-emerald-600/30 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-300 text-emerald-400 bg-emerald-600/20 border-emerald-600/40 border-amber-600/30 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 text-amber-400 bg-amber-600/20 border-amber-600/40 border-sky-600/30 bg-sky-950/20 hover:bg-sky-900/30 text-sky-300 text-sky-400 bg-sky-600/20 border-sky-600/40 border-blue-600/30 bg-blue-950/20 hover:bg-blue-900/30 text-blue-300 text-blue-400 bg-blue-600/20 border-blue-600/40 border-rose-600/30 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 text-rose-400 bg-rose-600/20 border-rose-600/40 border-teal-600/30 bg-teal-950/20 hover:bg-teal-900/30 text-teal-300 text-teal-400 bg-teal-600/20 border-teal-600/40
