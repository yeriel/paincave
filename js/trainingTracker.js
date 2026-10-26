/**
 * Gestor y Tracker de Progresión de Planes de Entrenamiento
 * Soporta fases configurables, microciclos semanales y seguimiento temporal.
 */

import { gamification } from './gamification.js';

export const DEFAULT_PLAN_CONFIG = {
  id: 'plan_spinning_progresivo',
  name: 'Plan Personalizado Spinning',
  startDate: null,
  currentWeek: 1,
  currentPhaseId: 'fase1',
  cycleNumber: 1,
  phases: [
    {
      id: 'fase1',
      name: 'Fase 1',
      subtitle: 'Cimientos Aeróbicos',
      weeks: 4,
      description: 'Base aeróbica Z2, adaptación postural al manillar/sillín y cadencia fluida.',
      colorClass: 'blue'
    },
    {
      id: 'fase2',
      name: 'Fase 2',
      subtitle: 'Densidad y Sweet Spot',
      weeks: 4,
      description: 'Aumento de densidad en Sweet Spot (88-93% FTP) y umbral Z4 sostenido.',
      colorClass: 'amber'
    },
    {
      id: 'fase3',
      name: 'Fase 3',
      subtitle: 'Dominio Aero y Umbral FTP',
      weeks: 4,
      description: 'Bloques aero extendidos, resistencia a la fatiga neuromuscular y picos de potencia.',
      colorClass: 'rose'
    }
  ]
};

export const WEEK_DAYS_ROUTINES = [
  { dayIndex: 0, dayName: 'Lunes', shortName: 'Lun', routineId: 'lunes_fondo_aero', expectedTitle: 'Fondo Aero Z2', category: 'fondo' },
  { dayIndex: 1, dayName: 'Martes', shortName: 'Mar', routineId: 'martes_sweet_spot', expectedTitle: 'Sweet Spot (SST)', category: 'calidad' },
  { dayIndex: 2, dayName: 'Miércoles', shortName: 'Mié', routineId: 'miercoles_recuperacion', expectedTitle: 'Recuperación Z1', category: 'recuperacion' },
  { dayIndex: 3, dayName: 'Jueves', shortName: 'Jue', routineId: 'jueves_fondo_z2', expectedTitle: 'Base Z2 Ágil', category: 'fondo' },
  { dayIndex: 4, dayName: 'Viernes', shortName: 'Vie', routineId: 'viernes_umbral_z4', expectedTitle: 'Umbral FTP Z4', category: 'calidad' },
  { dayIndex: 5, dayName: 'Sábado', shortName: 'Sáb', routineId: 'sabado_fondo_extendido', expectedTitle: 'Fondo Largo Z2', category: 'fondo' },
  { dayIndex: 6, dayName: 'Domingo', shortName: 'Dom', routineId: null, expectedTitle: 'Descanso Total', category: 'descanso' }
];

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
      return parsed;
    } catch (e) {
      console.error("Error loading training plan:", e);
      return JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG));
    }
  }

  savePlan(planData = this.plan) {
    this.plan = planData;
    localStorage.setItem(this.storageKey, JSON.stringify(this.plan));
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
   * Obtiene el estado detallado de los 7 días de la semana actual
   */
  getWeekOverview(targetDate = new Date()) {
    const monday = getMondayOfDate(targetDate);
    const todayStr = formatDateISO(new Date());
    const stats = gamification.getStats();
    const allWorkouts = stats.workouts || [];

    const days = WEEK_DAYS_ROUTINES.map(dayMeta => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + dayMeta.dayIndex);
      const dateStr = formatDateISO(d);

      // Buscar entrenamientos realizados en esa fecha exacta
      const dayWorkouts = allWorkouts.filter(w => w.date === dateStr);
      const isToday = (dateStr === todayStr);
      const isFuture = (dateStr > todayStr);
      const isCompleted = dayWorkouts.length > 0;

      return {
        ...dayMeta,
        date: dateStr,
        dayNumber: d.getDate(),
        isToday,
        isFuture,
        isCompleted,
        workouts: dayWorkouts,
        totalDuration: dayWorkouts.reduce((acc, w) => acc + (w.durationMinutes || 0), 0),
        totalXp: dayWorkouts.reduce((acc, w) => acc + (w.earnedXP || 0), 0)
      };
    });

    const completedCount = days.filter(d => d.isCompleted && d.dayIndex !== 6).length; // Excluye domingo
    const totalMinutesThisWeek = days.reduce((acc, d) => acc + d.totalDuration, 0);

    return {
      mondayDate: formatDateISO(monday),
      days,
      completedDaysCount: completedCount,
      targetDaysCount: 6, // Microciclo de 6 días
      totalMinutesThisWeek
    };
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
