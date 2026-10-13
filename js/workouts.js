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
    title: "Fondo Aeróbico & Base (Z2)",
    subtitle: "Tirada continua (45-60m) para quemar grasas y crear resistencia",
    icon: "ti-leaf",
    colorClass: "emerald",
    levels: {
      principiante: [
        { phase: "Calentamiento suave sentado", cadence: 85, rpe: 3, posture: "sentado", t: 360 },
        { phase: "Rodaje base estable sentado", cadence: 90, rpe: 4, posture: "sentado", t: 720 },
        { phase: "Transición de pie (alivio de sillín)", cadence: 70, rpe: 4, posture: "de pie", t: 120 },
        { phase: "Fondo aeróbico con ritmo sentado", cadence: 92, rpe: 4.5, posture: "sentado", t: 720 },
        { phase: "Transición de pie con cadencia ágil", cadence: 70, rpe: 4, posture: "de pie", t: 120 },
        { phase: "Rodaje regenerativo suave", cadence: 85, rpe: 3, posture: "sentado", t: 480 }
      ], // 2520s = 42 min
      amateur: [
        { phase: "Calentamiento progresivo sentado", cadence: 85, rpe: 3, posture: "sentado", t: 420 },
        { phase: "Bloque 1: Resistencia base sentado", cadence: 90, rpe: 4, posture: "sentado", t: 900 },
        { phase: "Transición de pie (estirar piernas)", cadence: 70, rpe: 4, posture: "de pie", t: 120 },
        { phase: "Bloque 2: Fondo aeróbico continuo", cadence: 92, rpe: 4.5, posture: "sentado", t: 900 },
        { phase: "Transición de pie con carga media", cadence: 70, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Enfriamiento y soltar piernas", cadence: 80, rpe: 2, posture: "sentado", t: 480 }
      ], // 3000s = 50 min
      elite: [
        { phase: "Calentamiento progresivo sentado", cadence: 88, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Bloque 1: Fondo aeróbico sostenido", cadence: 92, rpe: 4.5, posture: "sentado", t: 1080 },
        { phase: "Paso de pie con resistencia suave", cadence: 75, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Bloque 2: Fondo aeróbico sostenido", cadence: 90, rpe: 4.5, posture: "sentado", t: 1080 },
        { phase: "Paso de pie con resistencia suave", cadence: 75, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Enfriamiento regenerativo final", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ], // 3300s = 55 min
      pro: [
        { phase: "Calentamiento progresivo sentado", cadence: 88, rpe: 3.5, posture: "sentado", t: 480 },
        { phase: "Bloque 1: Fondo aeróbico sostenido", cadence: 92, rpe: 4.5, posture: "sentado", t: 1200 },
        { phase: "Paso de pie con resistencia suave", cadence: 75, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Bloque 2: Fondo aeróbico sostenido", cadence: 90, rpe: 4.5, posture: "sentado", t: 1200 },
        { phase: "Paso de pie con resistencia suave", cadence: 75, rpe: 4.5, posture: "de pie", t: 180 },
        { phase: "Enfriamiento regenerativo final", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ] // 3600s = 60 min
    }
  },

  // 2. UMBRAL & SWEET SPOT
  {
    id: "sweet_spot",
    category: "fuerza",
    title: "Sweet Spot 2x15 min (Umbral)",
    subtitle: "Aumento de potencia sostenida y tolerancia a la fatiga en spinning",
    icon: "ti-flame",
    colorClass: "amber",
    levels: {
      principiante: [
        { phase: "Calentamiento articular sentado", cadence: 85, rpe: 3, posture: "sentado", t: 360 },
        { phase: "Activación progresiva de pulso", cadence: 90, rpe: 5, posture: "sentado", t: 240 },
        { phase: "Bloque 1 Sweet Spot sentado", cadence: 88, rpe: 7, posture: "sentado", t: 600 },
        { phase: "Recuperación activa en llano", cadence: 80, rpe: 3, posture: "sentado", t: 240 },
        { phase: "Bloque 2 Sweet Spot sentado", cadence: 88, rpe: 7.5, posture: "sentado", t: 600 },
        { phase: "Lavado de lactato y enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ], // 2400s = 40 min
      amateur: [
        { phase: "Calentamiento progresivo sentado", cadence: 85, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Activación previa de umbral", cadence: 92, rpe: 6, posture: "sentado", t: 180 },
        { phase: "Recuperación breve sentado", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Bloque 1: Sweet Spot continuo", cadence: 88, rpe: 7.5, posture: "sentado", t: 780 },
        { phase: "Pausa activa rodando suave", cadence: 85, rpe: 3.5, posture: "sentado", t: 300 },
        { phase: "Bloque 2: Sweet Spot continuo", cadence: 88, rpe: 8, posture: "sentado", t: 780 },
        { phase: "Enfriamiento y vuelta a la calma", cadence: 80, rpe: 2, posture: "sentado", t: 300 }
      ], // 2880s = 48 min
      elite: [
        { phase: "Calentamiento estructurado", cadence: 88, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Activación con ráfaga en subida", cadence: 80, rpe: 6.5, posture: "sentado", t: 180 },
        { phase: "Recuperación breve", cadence: 85, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Bloque 1: Sweet Spot (15 minutos)", cadence: 90, rpe: 8, posture: "sentado", t: 900 },
        { phase: "Descanso activo en Z2 baja", cadence: 85, rpe: 3.5, posture: "sentado", t: 300 },
        { phase: "Bloque 2: Sweet Spot (15 minutos)", cadence: 90, rpe: 8.5, posture: "sentado", t: 900 },
        { phase: "Enfriamiento metabólico", cadence: 80, rpe: 2, posture: "sentado", t: 420 }
      ], // 3240s = 54 min
      pro: [
        { phase: "Calentamiento estructurado", cadence: 90, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Activación rápida con ráfagas", cadence: 95, rpe: 7, posture: "sentado", t: 240 },
        { phase: "Recuperación breve", cadence: 85, rpe: 3, posture: "sentado", t: 120 },
        { phase: "Bloque 1: Umbral Crítico sostenido", cadence: 90, rpe: 8.5, posture: "sentado", t: 1080 },
        { phase: "Descanso activo en llano", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Bloque 2: Umbral Crítico sostenido", cadence: 90, rpe: 9, posture: "sentado", t: 1080 },
        { phase: "Vuelta a la calma regenerativa", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ] // 3600s = 60 min
    }
  },

  // 3. FUERZA & ESCALADA (ATRANQUE EN SPINNING)
  {
    id: "escalada_fuerza",
    category: "escalada",
    title: "Escalada de Fuerza & Rampas",
    subtitle: "Atranque muscular (55-65 RPM) apretando la perilla de resistencia",
    icon: "ti-mountain",
    colorClass: "sky",
    levels: {
      principiante: [
        { phase: "Rodaje inicial para entrar en calor", cadence: 85, rpe: 3, posture: "sentado", t: 360 },
        { phase: "Aproximación con freno suave sentado", cadence: 80, rpe: 4.5, posture: "sentado", t: 240 },
        { phase: "Subida tendida de fuerza sentado", cadence: 65, rpe: 6, posture: "sentado", t: 480 },
        { phase: "Rampa dura de pie con carga alta", cadence: 60, rpe: 7.5, posture: "de pie", t: 120 },
        { phase: "Falso llano de respiro sentado", cadence: 80, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Segunda subida tendida sentado", cadence: 65, rpe: 6.5, posture: "sentado", t: 480 },
        { phase: "Remate final de pie en rampa", cadence: 55, rpe: 8, posture: "de pie", t: 120 },
        { phase: "Bajada suave y enfriamiento", cadence: 85, rpe: 2, posture: "sentado", t: 480 }
      ], // 2520s = 42 min
      amateur: [
        { phase: "Calentamiento progresivo en llano", cadence: 88, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Aproximación al puerto con carga media", cadence: 80, rpe: 5, posture: "sentado", t: 240 },
        { phase: "Puerto Bloque 1: Fuerza sentado", cadence: 65, rpe: 7.5, posture: "sentado", t: 540 },
        { phase: "Ataque en rampa del 10% de pie", cadence: 58, rpe: 8.5, posture: "de pie", t: 180 },
        { phase: "Descanso activo en falso llano", cadence: 85, rpe: 4, posture: "sentado", t: 240 },
        { phase: "Puerto Bloque 2: Resistencia sentado", cadence: 65, rpe: 8, posture: "sentado", t: 540 },
        { phase: "Cumbre a tope de pie apretando freno", cadence: 55, rpe: 9, posture: "de pie", t: 180 },
        { phase: "Descenso y soltar piernas", cadence: 85, rpe: 2, posture: "sentado", t: 540 }
      ], // 2880s = 48 min
      elite: [
        { phase: "Calentamiento progresivo", cadence: 90, rpe: 4, posture: "sentado", t: 420 },
        { phase: "Entrada en rampa sentado", cadence: 75, rpe: 6, posture: "sentado", t: 240 },
        { phase: "Atranque muscular pesado sentado", cadence: 60, rpe: 8, posture: "sentado", t: 600 },
        { phase: "Muro del 14% de pie con inercia dura", cadence: 55, rpe: 9.5, posture: "de pie", t: 180 },
        { phase: "Paso por falso llano para soltar", cadence: 85, rpe: 4, posture: "sentado", t: 240 },
        { phase: "Segundo puerto Hors Catégorie sentado", cadence: 60, rpe: 8.5, posture: "sentado", t: 660 },
        { phase: "Ataques continuos de pie en cumbre", cadence: 55, rpe: 9.5, posture: "de pie", t: 300 },
        { phase: "Enfriamiento y recuperación", cadence: 85, rpe: 2, posture: "sentado", t: 600 }
      ], // 3240s = 54 min
      pro: [
        { phase: "Calentamiento estructurado", cadence: 92, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Aproximación de umbral sentado", cadence: 80, rpe: 6.5, posture: "sentado", t: 300 },
        { phase: "Puerto Especial sentado a fuerza máxima", cadence: 55, rpe: 8.5, posture: "sentado", t: 720 },
        { phase: "Rampa brutal de pie sin descanso", cadence: 50, rpe: 10, posture: "de pie", t: 240 },
        { phase: "Descanso activo rodando", cadence: 85, rpe: 4, posture: "sentado", t: 240 },
        { phase: "Subida final a ritmo de contrarreloj", cadence: 65, rpe: 9, posture: "sentado", t: 720 },
        { phase: "Esprint de cumbre de pie a muerte", cadence: 60, rpe: 10, posture: "de pie", t: 300 },
        { phase: "Vuelta a la calma prolongada", cadence: 85, rpe: 2, posture: "sentado", t: 600 }
      ] // 3600s = 60 min
    }
  },

  // 4. AGILIDAD & CADENCIA (MOLINILLO Y EFICIENCIA)
  {
    id: "agilidad_cadencia",
    category: "agilidad",
    title: "Agilidad & Molinillo (95-115 RPM)",
    subtitle: "Pedaleo redondo, velocidad de piernas y eficiencia neuromuscular",
    icon: "ti-rotate-clockwise",
    colorClass: "blue",
    levels: {
      principiante: [
        { phase: "Calentamiento a ritmo suave", cadence: 85, rpe: 3, posture: "sentado", t: 360 },
        { phase: "Ritmo base sentado", cadence: 90, rpe: 4, posture: "sentado", t: 360 },
        { phase: "Paso a cadencia ágil (molinillo)", cadence: 100, rpe: 5.5, posture: "sentado", t: 360 },
        { phase: "Pausa activa rodando suelto", cadence: 85, rpe: 3, posture: "sentado", t: 180 },
        { phase: "Paso a cadencia ágil (molinillo)", cadence: 100, rpe: 5.5, posture: "sentado", t: 360 },
        { phase: "Pausa activa rodando suelto", cadence: 85, rpe: 3, posture: "sentado", t: 180 },
        { phase: "Ráfaga de alta cadencia sentado", cadence: 105, rpe: 6.5, posture: "sentado", t: 240 },
        { phase: "Soltar piernas y enfriamiento", cadence: 85, rpe: 2, posture: "sentado", t: 260 }
      ], // 2400s = 40 min
      amateur: [
        { phase: "Calentamiento progresivo", cadence: 88, rpe: 3.5, posture: "sentado", t: 420 },
        { phase: "Pirámide 1: Ritmo base", cadence: 92, rpe: 4.5, posture: "sentado", t: 300 },
        { phase: "Pirámide 1: Agilidad media", cadence: 102, rpe: 6, posture: "sentado", t: 300 },
        { phase: "Pirámide 1: Molinillo rápido", cadence: 110, rpe: 7.5, posture: "sentado", t: 180 },
        { phase: "Descanso activo rodando suave", cadence: 85, rpe: 3, posture: "sentado", t: 240 },
        { phase: "Pirámide 2: Ritmo base", cadence: 92, rpe: 4.5, posture: "sentado", t: 300 },
        { phase: "Pirámide 2: Agilidad media", cadence: 102, rpe: 6, posture: "sentado", t: 300 },
        { phase: "Pirámide 2: Molinillo rápido", cadence: 110, rpe: 7.5, posture: "sentado", t: 180 },
        { phase: "Descanso activo rodando suave", cadence: 85, rpe: 3, posture: "sentado", t: 240 },
        { phase: "Sprint de cadencia over-speed", cadence: 115, rpe: 8.5, posture: "sentado", t: 60 },
        { phase: "Enfriamiento suave regenerativo", cadence: 80, rpe: 2, posture: "sentado", t: 240 }
      ], // 2760s = 46 min
      elite: [
        { phase: "Calentamiento estructurado", cadence: 90, rpe: 4, posture: "sentado", t: 420 },
        { phase: "Bloque 1 de alta cadencia sostenida", cadence: 105, rpe: 6.5, posture: "sentado", t: 600 },
        { phase: "Recuperación activa rodando", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Bloque 2 de alta cadencia sostenida", cadence: 105, rpe: 7, posture: "sentado", t: 600 },
        { phase: "Recuperación activa rodando", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Micro-intervalos: 30s rápido / 30s base", cadence: 115, rpe: 8, posture: "sentado", t: 480 },
        { phase: "Lavado y enfriamiento suave", cadence: 80, rpe: 2, posture: "sentado", t: 440 }
      ], // 3120s = 52 min
      pro: [
        { phase: "Calentamiento rápido y suelto", cadence: 92, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Bloque Tempo a cadencia elevada", cadence: 105, rpe: 7, posture: "sentado", t: 720 },
        { phase: "Recuperación activa", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Bloque Umbral a cadencia elevada", cadence: 108, rpe: 8, posture: "sentado", t: 720 },
        { phase: "Recuperación activa", cadence: 85, rpe: 3.5, posture: "sentado", t: 240 },
        { phase: "Ráfagas extremas a 120 RPM sentado", cadence: 120, rpe: 9, posture: "sentado", t: 600 },
        { phase: "Enfriamiento completo de recuperación", cadence: 80, rpe: 2, posture: "sentado", t: 480 }
      ] // 3480s = 58 min
    }
  },

  // 5. HIIT & POTENCIA MÁXIMA
  {
    id: "hiit_spinning",
    category: "hiit",
    title: "HIIT Sprints (Spinning Explosivo)",
    subtitle: "Ráfagas anaeróbicas, aceleraciones de pie y sprints intensos",
    icon: "ti-bolt",
    colorClass: "rose",
    levels: {
      principiante: [
        { phase: "Calentamiento articular completo", cadence: 85, rpe: 3, posture: "sentado", t: 480 },
        { phase: "Activación previa de pulso", cadence: 95, rpe: 6, posture: "sentado", t: 120 },
        { phase: "Descanso suave rodando", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        // Serie 1
        { phase: "Sprint 1 de pie con potencia", cadence: 105, rpe: 8.5, posture: "de pie", t: 30 },
        { phase: "Recuperación sentado", cadence: 75, rpe: 2.5, posture: "sentado", t: 90 },
        { phase: "Sprint 2 de pie con potencia", cadence: 105, rpe: 8.5, posture: "de pie", t: 30 },
        { phase: "Recuperación sentado", cadence: 75, rpe: 2.5, posture: "sentado", t: 90 },
        { phase: "Sprint 3 de pie con potencia", cadence: 105, rpe: 9, posture: "de pie", t: 30 },
        { phase: "Recuperación sentado", cadence: 75, rpe: 2.5, posture: "sentado", t: 90 },
        // Bloque medio
        { phase: "Fondo aeróbico de asimilación", cadence: 88, rpe: 4, posture: "sentado", t: 480 },
        // Serie 2
        { phase: "Aceleración fuerte sentado", cadence: 100, rpe: 8.5, posture: "sentado", t: 45 },
        { phase: "Descanso suave sentado", cadence: 75, rpe: 2.5, posture: "sentado", t: 75 },
        { phase: "Aceleración fuerte de pie", cadence: 105, rpe: 9, posture: "de pie", t: 45 },
        { phase: "Descanso suave sentado", cadence: 75, rpe: 2.5, posture: "sentado", t: 75 },
        // Vuelta a la calma
        { phase: "Lavado profundo y enfriamiento", cadence: 80, rpe: 2, posture: "sentado", t: 480 }
      ], // 2280s = 38 min
      amateur: [
        { phase: "Calentamiento progresivo amplio", cadence: 88, rpe: 3.5, posture: "sentado", t: 480 },
        { phase: "Activación en rampa con cadencia", cadence: 95, rpe: 6.5, posture: "sentado", t: 180 },
        { phase: "Descanso previo a las series", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        // Bloque Tabata 1 (4 sprints)
        { phase: "Ráfaga 1 de pie con resistencia", cadence: 110, rpe: 9.5, posture: "de pie", t: 30 },
        { phase: "Descanso activo sentado", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Ráfaga 2 de pie con resistencia", cadence: 110, rpe: 9.5, posture: "de pie", t: 30 },
        { phase: "Descanso activo sentado", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Ráfaga 3 de pie con resistencia", cadence: 110, rpe: 9.5, posture: "de pie", t: 30 },
        { phase: "Descanso activo sentado", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Ráfaga 4 de pie con resistencia", cadence: 110, rpe: 10, posture: "de pie", t: 30 },
        { phase: "Descanso activo sentado", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        // Intervalo aeróbico intermedio
        { phase: "Bloque aeróbico de oxigenación", cadence: 88, rpe: 4, posture: "sentado", t: 540 },
        // Bloque VO2 Max 2
        { phase: "Ataque sostenido sentado", cadence: 100, rpe: 9, posture: "sentado", t: 60 },
        { phase: "Recuperación rodando", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Ataque sostenido de pie", cadence: 105, rpe: 9.5, posture: "de pie", t: 60 },
        { phase: "Recuperación rodando", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Sprint explosivo final a tope", cadence: 115, rpe: 10, posture: "de pie", t: 30 },
        { phase: "Lavado completo de lactato", cadence: 80, rpe: 2, posture: "sentado", t: 760 }
      ], // 2700s = 45 min
      elite: [
        { phase: "Calentamiento estructurado y amplio", cadence: 90, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Activación piramidal", cadence: 100, rpe: 7, posture: "sentado", t: 180 },
        { phase: "Recuperación breve", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        // Serie 1
        { phase: "Sprint brutal de pie", cadence: 115, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Recuperación incompleta", cadence: 70, rpe: 3, posture: "sentado", t: 50 },
        { phase: "Sprint brutal de pie", cadence: 115, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Recuperación incompleta", cadence: 70, rpe: 3, posture: "sentado", t: 50 },
        { phase: "Sprint brutal de pie", cadence: 115, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Recuperación incompleta", cadence: 70, rpe: 3, posture: "sentado", t: 50 },
        { phase: "Sprint brutal de pie", cadence: 115, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Recuperación completa", cadence: 75, rpe: 3, posture: "sentado", t: 120 },
        // Bloque central aeróbico
        { phase: "Fondo de lavado aeróbico", cadence: 90, rpe: 4.5, posture: "sentado", t: 600 },
        // Serie 2 VO2
        { phase: "Serie VO2 Max sostenida sentado", cadence: 105, rpe: 9.5, posture: "sentado", t: 120 },
        { phase: "Descanso breve rodando", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Serie VO2 Max sostenida de pie", cadence: 105, rpe: 10, posture: "de pie", t: 120 },
        { phase: "Descanso breve rodando", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Ráfaga neuromuscular final", cadence: 125, rpe: 10, posture: "de pie", t: 30 },
        { phase: "Enfriamiento asimilador", cadence: 80, rpe: 2, posture: "sentado", t: 720 }
      ], // 3000s = 50 min
      pro: [
        { phase: "Calentamiento estructurado y amplio", cadence: 92, rpe: 4, posture: "sentado", t: 480 },
        { phase: "Activación piramidal", cadence: 105, rpe: 7.5, posture: "sentado", t: 180 },
        { phase: "Recuperación breve", cadence: 80, rpe: 3, posture: "sentado", t: 120 },
        // 5 Sprints máximos
        { phase: "Sprint brutal de pie", cadence: 120, rpe: 10, posture: "de pie", t: 45 },
        { phase: "Recuperación incompleta", cadence: 70, rpe: 3, posture: "sentado", t: 45 },
        { phase: "Sprint brutal de pie", cadence: 120, rpe: 10, posture: "de pie", t: 45 },
        { phase: "Recuperación incompleta", cadence: 70, rpe: 3, posture: "sentado", t: 45 },
        { phase: "Sprint brutal de pie", cadence: 120, rpe: 10, posture: "de pie", t: 45 },
        { phase: "Recuperación incompleta", cadence: 70, rpe: 3, posture: "sentado", t: 45 },
        { phase: "Sprint brutal de pie", cadence: 120, rpe: 10, posture: "de pie", t: 45 },
        { phase: "Recuperación incompleta", cadence: 70, rpe: 3, posture: "sentado", t: 45 },
        // Bloque central
        { phase: "Fondo de lavado aeróbico", cadence: 90, rpe: 4.5, posture: "sentado", t: 600 },
        // Serie 2
        { phase: "Intervalo Anaeróbico sostenido", cadence: 110, rpe: 9.5, posture: "sentado", t: 180 },
        { phase: "Descanso incompleto", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Intervalo Anaeróbico sostenido", cadence: 110, rpe: 10, posture: "de pie", t: 180 },
        { phase: "Descanso incompleto", cadence: 75, rpe: 3, posture: "sentado", t: 60 },
        { phase: "Ráfaga neuromuscular final", cadence: 130, rpe: 10, posture: "de pie", t: 40 },
        { phase: "Vuelta a la calma prolongada", cadence: 80, rpe: 2, posture: "sentado", t: 940 }
      ] // 3300s = 55 min
    }
  },

  // 6. RECUPERACIÓN ACTIVA (DÍAS POST-FATIGA)
  {
    id: "recuperacion_activa",
    category: "recuperacion",
    title: "Recuperación Activa & Soltar",
    subtitle: "Rodaje regenerativo suave para drenar piernas sin generar fatiga",
    icon: "ti-activity",
    colorClass: "teal",
    levels: {
      principiante: [
        { phase: "Rodaje muy suave sin resistencia", cadence: 80, rpe: 2, posture: "sentado", t: 300 },
        { phase: "Pedaleo fluido regenerativo", cadence: 88, rpe: 2.5, posture: "sentado", t: 600 },
        { phase: "Estiramiento suave de pie", cadence: 65, rpe: 2.5, posture: "de pie", t: 120 },
        { phase: "Pedaleo fluido regenerativo", cadence: 88, rpe: 2.5, posture: "sentado", t: 600 },
        { phase: "Vuelta a la calma suave", cadence: 80, rpe: 2, posture: "sentado", t: 480 }
      ], // 2100s = 35 min
      amateur: [
        { phase: "Inicio suave para calentar piernas", cadence: 82, rpe: 2, posture: "sentado", t: 360 },
        { phase: "Rodaje continuo en Zona 1/2 baja", cadence: 88, rpe: 2.5, posture: "sentado", t: 900 },
        { phase: "Paso de pie suave para aliviar cadera", cadence: 68, rpe: 2.5, posture: "de pie", t: 180 },
        { phase: "Rodaje continuo en Zona 1/2 baja", cadence: 88, rpe: 2.5, posture: "sentado", t: 720 },
        { phase: "Soltar piernas final regenerativo", cadence: 80, rpe: 1.5, posture: "sentado", t: 360 }
      ], // 2520s = 42 min
      elite: [
        { phase: "Inicio suave de activación", cadence: 85, rpe: 2, posture: "sentado", t: 420 },
        { phase: "Fondo regenerativo sin tensión", cadence: 90, rpe: 2.5, posture: "sentado", t: 1020 },
        { phase: "Paso de pie suave sin apretar freno", cadence: 70, rpe: 2.5, posture: "de pie", t: 180 },
        { phase: "Fondo regenerativo sin tensión", cadence: 90, rpe: 2.5, posture: "sentado", t: 900 },
        { phase: "Soltar piernas final", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
      ], // 2880s = 48 min
      pro: [
        { phase: "Inicio suave de activación", cadence: 85, rpe: 2, posture: "sentado", t: 480 },
        { phase: "Fondo regenerativo sin tensión", cadence: 90, rpe: 2.5, posture: "sentado", t: 1080 },
        { phase: "Paso de pie suave sin apretar freno", cadence: 70, rpe: 2.5, posture: "de pie", t: 180 },
        { phase: "Fondo regenerativo sin tensión", cadence: 90, rpe: 2.5, posture: "sentado", t: 1020 },
        { phase: "Soltar piernas final", cadence: 80, rpe: 2, posture: "sentado", t: 360 }
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
