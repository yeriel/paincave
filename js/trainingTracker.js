/**
 * Gestor y Tracker de Progresión de Planes de Entrenamiento
 * Soporta fases configurables, microciclos semanales y seguimiento temporal.
 */

import { gamification } from './gamification.js';

export const DEFAULT_PLAN_CONFIG = {
  id: 'plan_spinning_rotativo_4d',
  name: 'Plan Rotativo 4D Spinning',
  startDate: null,
  cycleAnchorDate: '2026-10-29',
  cycleAnchorDay: 1, // 2026-10-29 fue Día 1 (Fondo Z2), por lo que mañana 2026-10-30 es Día 2 (Sweet Spot)
  currentWeek: 1,
  currentPhaseId: 'fase1',
  cycleNumber: 1,
  phases: [
    {
      id: 'fase1',
      name: 'Fase 1',
      subtitle: 'Cimientos y Sweet Spot (S1-4)',
      weeks: 4,
      description: 'Fondo Z2 de 60 min (113-140 BPM), adaptación postural aero y Sweet Spot 2x12 min (157-166 BPM).',
      colorClass: 'blue'
    },
    {
      id: 'fase2',
      name: 'Fase 2',
      subtitle: 'Densidad y Extensión Sweet Spot (S5-8)',
      weeks: 4,
      description: 'Z2 de 60 min con bloques aero sostenidos y Sweet Spot 2x15 min (157-166 BPM).',
      colorClass: 'amber'
    },
    {
      id: 'fase3',
      name: 'Fase 3',
      subtitle: 'Dominio Aero y Sweet Spot 2x20 (S9-12)',
      weeks: 4,
      description: 'Z2 de 60 min con triple bloque aero y Sweet Spot 2x20 min (157-166 BPM).',
      colorClass: 'rose'
    }
  ]
};

export const ROTATING_CYCLE_DAYS = [
  {
    cycleDay: 1,
    cycleIndex: 0,
    routineId: 'dia1_fondo_z2',
    name: 'Día 1 · Fondo Z2 & Aero (60 min)',
    shortName: 'Día 1: Fondo Z2',
    category: 'fondo',
    description: 'Resistencia base 113-140 BPM (60 min) con bloques aero',
    isRest: false
  },
  {
    cycleDay: 2,
    cycleIndex: 1,
    routineId: 'dia2_sweet_spot',
    name: 'Día 2 · Calidad Sweet Spot (157-166 BPM)',
    shortName: 'Día 2: Sweet Spot',
    category: 'calidad',
    description: 'Intervalos submáximos 83-88% FC Máx (157-166 BPM)',
    isRest: false
  },
  {
    cycleDay: 3,
    cycleIndex: 2,
    routineId: 'dia3_recuperacion',
    name: 'Día 3 · Recuperación Activa Z1',
    shortName: 'Día 3: Recuperación',
    category: 'recuperacion',
    description: 'Regenerativo suave < 113 BPM para soltar piernas',
    isRest: false
  },
  {
    cycleDay: 4,
    cycleIndex: 3,
    routineId: null,
    name: 'Día 4 · Descanso Total',
    shortName: 'Día 4: Descanso',
    category: 'descanso',
    description: 'Cero pedaleo. Asimilación y regeneración neuromuscular',
    isRest: true
  }
];

export const WEEK_DAYS_ROUTINES = ROTATING_CYCLE_DAYS;

export function getCycleDayForDate(dateStr, anchorDate = '2026-10-29', anchorCycleDay = 1) {
  try {
    const [y1, m1, d1] = anchorDate.split('-').map(Number);
    const [y2, m2, d2] = dateStr.split('-').map(Number);
    const t1 = Date.UTC(y1, m1 - 1, d1);
    const t2 = Date.UTC(y2, m2 - 1, d2);
    const diffDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
    const offset = ((anchorCycleDay - 1 + diffDays) % 4 + 4) % 4;
    return ROTATING_CYCLE_DAYS[offset];
  } catch (e) {
    return ROTATING_CYCLE_DAYS[0];
  }
}

export function getMondayOfDate(d) {
  const date = new Date(d);
  const day = date.getDay();
  // 0 es domingo -> retroceder 6 días; 1 es lunes -> 0 días; etc.
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDateISO(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class TrainingTracker {
  constructor() {
    this.storageKey = 'painCaveTrainingPlan';
    this.plan = this.loadPlan();
  }

  loadPlan() {
    try {
      if (typeof localStorage === 'undefined') {
        return JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG));
      }
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        const initial = JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG));
        initial.startDate = formatDateISO(new Date());
        localStorage.setItem(this.storageKey, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(raw);
      // Validar fases mínimas
      if (!parsed.phases || !Array.isArray(parsed.phases) || parsed.phases.length === 0) {
        parsed.phases = JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG.phases));
      }
      if (!parsed.startDate) {
        parsed.startDate = formatDateISO(new Date());
      }
      if (!parsed.cycleAnchorDate) {
        parsed.cycleAnchorDate = DEFAULT_PLAN_CONFIG.cycleAnchorDate;
        parsed.cycleAnchorDay = DEFAULT_PLAN_CONFIG.cycleAnchorDay;
      }
      // Actualizar a nuevas zonas y microciclo si el plan tenía formato antiguo
      if (parsed.phases && parsed.phases[0] && (!parsed.phases[0].description.includes('157-166') || !parsed.phases[0].description.includes('60 min'))) {
        parsed.phases = JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG.phases));
        parsed.name = DEFAULT_PLAN_CONFIG.name;
        this.savePlan(parsed);
      }
      return parsed;
    } catch (e) {
      console.error("Error loading training plan:", e);
      return JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG));
    }
  }

  savePlan(planData = this.plan) {
    this.plan = planData;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.plan));
    }
  }

  getPhasesWithRanges() {
    let currentStart = 1;
    return this.plan.phases.map(phase => {
      const startWeek = currentStart;
      const endWeek = startWeek + Math.max(1, phase.weeks || 4) - 1;
      currentStart = endWeek + 1;
      return {
        ...phase,
        startWeek,
        endWeek
      };
    });
  }

  getTotalPlanWeeks() {
    return this.plan.phases.reduce((sum, p) => sum + (parseInt(p.weeks) || 4), 0);
  }

  /**
   * Obtiene la fase y semana actuales calculadas o seleccionadas
   */
  getCurrentProgress() {
    const phases = this.getPhasesWithRanges();
    const totalWeeks = this.getTotalPlanWeeks();
    let week = parseInt(this.plan.currentWeek) || 1;
    if (week < 1) week = 1;

    // Buscar a qué fase pertenece esta semana
    let matchedPhase = phases.find(p => week >= p.startWeek && week <= p.endWeek);
    if (!matchedPhase) {
      matchedPhase = phases[phases.length - 1];
    }

    const weekInPhase = week - matchedPhase.startWeek + 1;
    const phaseProgressPct = Math.min(100, Math.round((weekInPhase / matchedPhase.weeks) * 100));
    const overallProgressPct = Math.min(100, Math.round((week / totalWeeks) * 100));

    // Determinar semanas activas en el histórico
    const stats = gamification.getStats();
    const workoutDates = (stats.workouts || []).map(w => w.date);
    const uniqueWeeks = new Set(workoutDates.map(d => formatDateISO(getMondayOfDate(new Date(d + 'T00:00:00')))));

    return {
      planName: this.plan.name,
      cycleNumber: this.plan.cycleNumber || 1,
      currentWeek: week,
      totalWeeks,
      matchedPhase,
      weekInPhase,
      totalWeeksInPhase: matchedPhase.weeks,
      phaseProgressPct,
      overallProgressPct,
      totalActiveWeeks: uniqueWeeks.size,
      totalWorkouts: (stats.workouts || []).length,
      startDate: this.plan.startDate
    };
  }

  /**
   * Obtiene el estado detallado de los 7 días de la semana actual mapeados al ciclo rotativo
   */
  getWeekOverview(targetDate = new Date()) {
    const monday = getMondayOfDate(targetDate);
    const todayStr = formatDateISO(new Date());
    const stats = gamification.getStats();
    const allWorkouts = stats.workouts || [];

    const anchorDate = this.plan.cycleAnchorDate || '2026-10-29';
    const anchorDay = this.plan.cycleAnchorDay || 1;

    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shortNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const days = [0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + dayIndex);
      const dateStr = formatDateISO(d);

      const cycleMeta = getCycleDayForDate(dateStr, anchorDate, anchorDay);
      const dayWorkouts = allWorkouts.filter(w => w.date === dateStr);
      const isToday = (dateStr === todayStr);
      const isFuture = (dateStr > todayStr);
      const isCompleted = dayWorkouts.length > 0;

      return {
        dayIndex,
        dayName: dayNames[dayIndex],
        shortName: shortNames[dayIndex],
        date: dateStr,
        dayNumber: d.getDate(),
        cycleDay: cycleMeta.cycleDay,
        cycleName: cycleMeta.name,
        routineId: cycleMeta.routineId,
        expectedTitle: cycleMeta.name,
        category: cycleMeta.category,
        isRest: cycleMeta.isRest,
        isToday,
        isFuture,
        isCompleted,
        workouts: dayWorkouts,
        totalDuration: dayWorkouts.reduce((acc, w) => acc + (w.durationMinutes || 0), 0),
        totalXp: dayWorkouts.reduce((acc, w) => acc + (w.earnedXP || 0), 0)
      };
    });

    const completedCount = days.filter(d => d.isCompleted && !d.isRest).length;
    const activeDaysCount = days.filter(d => !d.isRest).length;
    const totalMinutesThisWeek = days.reduce((acc, d) => acc + d.totalDuration, 0);

    const todayCycle = getCycleDayForDate(todayStr, anchorDate, anchorDay);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateISO(tomorrow);
    const tomorrowCycle = getCycleDayForDate(tomorrowStr, anchorDate, anchorDay);

    return {
      mondayDate: formatDateISO(monday),
      days,
      completedDaysCount: completedCount,
      targetDaysCount: activeDaysCount,
      totalMinutesThisWeek,
      todayCycle,
      tomorrowCycle
    };
  }

  setCycleAnchor(dateStr, cycleDay) {
    this.plan.cycleAnchorDate = dateStr || formatDateISO(new Date());
    this.plan.cycleAnchorDay = parseInt(cycleDay) || 1;
    this.savePlan();
    return this.getCurrentProgress();
  }

  /**
   * Consulta entrenamientos para una fecha específica (usado por el calendario)
   */
  getWorkoutsForDate(dateStr) {
    const stats = gamification.getStats();
    return (stats.workouts || []).filter(w => w.date === dateStr);
  }

  /**
   * Obtiene el nombre del día en español a partir de una fecha YYYY-MM-DD
   */
  getDayName(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[d.getDay()];
  }

  /**
   * Métodos para actualizar el plan y fases (Futuro / Personalización)
   */
  setCurrentWeek(weekNumber) {
    const total = this.getTotalPlanWeeks();
    const valid = Math.max(1, Math.min(parseInt(weekNumber) || 1, total));
    this.plan.currentWeek = valid;
    
    // Sincronizar phaseId correspondiente
    const phases = this.getPhasesWithRanges();
    const current = phases.find(p => valid >= p.startWeek && valid <= p.endWeek);
    if (current) {
      this.plan.currentPhaseId = current.id;
    }
    this.savePlan();
    return this.getCurrentProgress();
  }

  setCurrentPhase(phaseId) {
    const phases = this.getPhasesWithRanges();
    const phase = phases.find(p => p.id === phaseId);
    if (phase) {
      this.plan.currentPhaseId = phase.id;
      this.plan.currentWeek = phase.startWeek;
      this.savePlan();
    }
    return this.getCurrentProgress();
  }

  addPhase({ name, subtitle, weeks, description, colorClass }) {
    const count = this.plan.phases.length + 1;
    const newPhase = {
      id: `fase${count}_${Date.now()}`,
      name: name || `Fase ${count}`,
      subtitle: subtitle || 'Fase Personalizada',
      weeks: parseInt(weeks) || 4,
      description: description || 'Fase de entrenamiento personalizada.',
      colorClass: colorClass || 'cyan'
    };
    this.plan.phases.push(newPhase);
    this.savePlan();
    return newPhase;
  }

  updatePhase(phaseId, updateData) {
    const phase = this.plan.phases.find(p => p.id === phaseId);
    if (!phase) throw new Error("Fase no encontrada");
    if (updateData.name) phase.name = updateData.name;
    if (updateData.subtitle) phase.subtitle = updateData.subtitle;
    if (updateData.weeks) phase.weeks = Math.max(1, parseInt(updateData.weeks));
    if (updateData.description) phase.description = updateData.description;
    if (updateData.colorClass) phase.colorClass = updateData.colorClass;
    this.savePlan();
    return phase;
  }

  removePhase(phaseId) {
    if (this.plan.phases.length <= 1) {
      throw new Error("El plan debe contener al menos una fase.");
    }
    this.plan.phases = this.plan.phases.filter(p => p.id !== phaseId);
    // Reajustar semana actual si se pasa
    const total = this.getTotalPlanWeeks();
    if (this.plan.currentWeek > total) {
      this.plan.currentWeek = total;
    }
    this.savePlan();
  }

  startNewCycle(cycleName = null) {
    this.plan.cycleNumber = (this.plan.cycleNumber || 1) + 1;
    this.plan.currentWeek = 1;
    this.plan.currentPhaseId = this.plan.phases[0]?.id || 'fase1';
    this.plan.startDate = formatDateISO(new Date());
    if (cycleName) this.plan.name = cycleName;
    this.savePlan();
    return this.getCurrentProgress();
  }

  resetProgress() {
    this.plan.currentWeek = 1;
    this.plan.currentPhaseId = this.plan.phases[0]?.id || 'fase1';
    this.plan.startDate = formatDateISO(new Date());
    this.savePlan();
    return this.getCurrentProgress();
  }

  exportPlanData() {
    return JSON.parse(JSON.stringify(this.plan));
  }

  importPlanData(data) {
    if (data && Array.isArray(data.phases)) {
      this.plan = data;
      this.savePlan();
    }
  }
}

export const trainingTracker = new TrainingTracker();
