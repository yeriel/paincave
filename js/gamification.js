/**
 * Sistema de Gamificación, Perfil Fisiológico y Estadísticas (LocalStorage)
 */

import { RANKS, LEVEL_XP_MULTIPLIERS, DEFAULT_MAX_HR } from './constants.js';

class GamificationManager {
  constructor() {
    this.storageKey = 'painCaveStats';
    this.hrKey = 'painCaveMaxHR';
  }

  getStats() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        const initial = {
          workouts: [],
          streak: 0,
          lastWorkoutDate: null,
          totalMinutes: 0,
          totalXP: 0
        };
        localStorage.setItem(this.storageKey, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(raw);
    } catch (e) {
      return { workouts: [], streak: 0, lastWorkoutDate: null, totalMinutes: 0, totalXP: 0 };
    }
  }

  saveStats(stats) {
    localStorage.setItem(this.storageKey, JSON.stringify(stats));
  }

  getMaxHR() {
    const raw = localStorage.getItem(this.hrKey);
    const num = parseInt(raw);
    return (!isNaN(num) && num >= 100 && num <= 240) ? num : DEFAULT_MAX_HR;
  }

  setMaxHR(val) {
    const num = parseInt(val);
    if (isNaN(num) || num < 100 || num > 240) {
      throw new Error("La Frecuencia Cardíaca Máxima debe estar entre 100 y 240 BPM.");
    }
    localStorage.setItem(this.hrKey, num);
    return num;
  }

  calculateRank(xp = 0) {
    let rank = RANKS[0];
    let prev = 0;
    for (let i = 0; i < RANKS.length; i++) {
      if (xp < RANKS[i].max) {
        rank = RANKS[i];
        break;
      }
      prev = RANKS[i].max;
    }
    const pct = rank.max === Infinity ? 100 : ((xp - prev) / (rank.max - prev)) * 100;
    return {
      title: rank.title,
      next: rank.max,
      progress: Math.min(Math.max(pct, 0), 100)
    };
  }

  getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  }

  recordWorkout(elapsedSeconds, sessionTitle, level, hrStats = null, extraMeta = {}) {
    if (elapsedSeconds < 15) return null;

    const stats = this.getStats();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Racha semanal
    if (stats.lastWorkoutDate) {
      const weeksDiff = Math.round((this.getWeekStart(today) - this.getWeekStart(new Date(stats.lastWorkoutDate))) / 604800000);
      stats.streak = weeksDiff === 1 ? stats.streak + 1 : (weeksDiff > 1 ? 1 : stats.streak);
    } else {
      stats.streak = 1;
    }

    stats.lastWorkoutDate = todayStr;
    const minutes = Math.floor(elapsedSeconds / 60);
    stats.totalMinutes += minutes;

    // Cálculo de XP
    const mult = LEVEL_XP_MULTIPLIERS[level] || 0.10;
    const earnedXP = Math.floor(elapsedSeconds * mult);
    stats.totalXP = (stats.totalXP || 0) + earnedXP;

    // Registro de sesión individual enriquecido con metadatos de tracking
    const workoutRecord = {
      date: todayStr,
      timestamp: Date.now(),
      session: sessionTitle,
      level,
      durationMinutes: minutes,
      earnedXP,
      avgBpm: hrStats ? hrStats.avg : null,
      maxBpm: hrStats ? hrStats.max : null,
      routineId: extraMeta.routineId || null,
      dayName: extraMeta.day || null,
      phaseId: extraMeta.phaseId || level,
      phaseName: extraMeta.phaseName || null,
      weekNumber: extraMeta.weekNumber || null
    };

    stats.workouts.push(workoutRecord);

    this.saveStats(stats);
    return { earnedXP, totalXP: stats.totalXP, streak: stats.streak, workout: workoutRecord };
  }

  exportData() {
    const stats = localStorage.getItem(this.storageKey);
    if (!stats) throw new Error("No hay estadísticas registradas.");
    const blob = new Blob([stats], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paincave-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.workouts)) {
      throw new Error("El archivo no tiene el formato válido de Pain Cave.");
    }
    this.saveStats(data);
    return data;
  }
}

export const gamification = new GamificationManager();
