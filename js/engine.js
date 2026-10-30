/**
 * Motor de Temporizador y Máquina de Estados del Entrenamiento
 */

import { soundEngine } from './audio.js';
import { gamification } from './gamification.js';
import { bluetoothManager } from './bluetooth.js';

class WorkoutEngine {
  constructor() {
    this.workout = [];
    this.currentStep = 0;
    this.isPaused = false;
    this.timeLeft = 0;
    this.stepTotal = 0;
    this.sessionTitle = '';
    this.selectedLevel = 'fase1';
    this.timerInterval = null;
    this.startTime = null;
    this.lastTickTime = null;
    this.lastHiddenTime = null;
    this.wakeLock = null;
    this.storageKey = 'bikeWorkoutState';

    // Callbacks
    this.onTick = null;
    this.onStepChange = null;
    this.onWorkoutComplete = null;
    this.onStatusChange = null;
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      }
    } catch (e) {}
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  initVisibilityWatcher() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.handleVisibilityVisible();
      } else if (document.visibilityState === 'hidden') {
        this.handleVisibilityHidden();
      }
    });

    window.addEventListener('pagehide', () => {
      this.handleVisibilityHidden();
    });
  }

  handleVisibilityHidden() {
    this.lastHiddenTime = Date.now();
    if (this.workout.length > 0 && this.currentStep < this.workout.length) {
      this.saveState();
    }
  }

  handleVisibilityVisible() {
    this.requestWakeLock();

    if (this.workout.length === 0 || this.currentStep >= this.workout.length) return;

    if (!this.lastHiddenTime) {
      this.lastTickTime = Date.now();
      return;
    }

    const elapsedAway = Math.floor((Date.now() - this.lastHiddenTime) / 1000);
    this.lastHiddenTime = null;
    this.lastTickTime = Date.now();

    if (!this.isPaused) {
      if (elapsedAway <= 25) {
        // Estuvo fuera un momento breve (ej. cambiar música en Spotify o mirar una notificación)
        // Se sincroniza el tiempo real de entrenamiento transcurrido
        if (elapsedAway > 0) {
          this.advanceTime(elapsedAway);
        }
      } else {
        // Estuvo fuera más de 25 segundos (ej. conversando en WhatsApp o llamada)
        // Avanzamos los primeros 10s y pausamos para no perder bloques sin pedalear
        this.advanceTime(10);
        this.isPaused = true;
        this.saveState();
        if (this.onStatusChange) {
          this.onStatusChange({ isRunning: true, isPaused: true });
        }
        this.emitTick();
      }
    } else {
      this.emitTick();
    }
  }

  startTimerInterval() {
    clearInterval(this.timerInterval);
    this.lastTickTime = Date.now();
    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  start(workoutSteps, title, level = 'amateur', metadata = {}) {
    this.stop(false);
    this.workout = workoutSteps;
    this.sessionTitle = title;
    this.selectedLevel = level;
    this.workoutMetadata = metadata;
    this.currentStep = 0;
    this.isPaused = false;
    this.startTime = Date.now();
    this.lastTickTime = Date.now();
    bluetoothManager.clearSessionSamples();

    soundEngine.init();
    this.requestWakeLock();

    this.loadCurrentStep();

    if (this.onStatusChange) this.onStatusChange({ isRunning: true, isPaused: false });
  }

  loadCurrentStep() {
    if (this.currentStep >= this.workout.length) {
      this.complete();
      return;
    }

    const st = this.workout[this.currentStep];
    this.stepTotal = st.t;
    this.timeLeft = st.t;

    if (this.onStepChange) {
      this.onStepChange({
        step: st,
        stepIndex: this.currentStep,
        totalSteps: this.workout.length,
        nextStep: this.workout[this.currentStep + 1] || null
      });
    }

    this.startTimerInterval();
    this.emitTick();
    this.saveState();
  }

  emitTick() {
    if (!this.onTick) return;
    const elapsedTotal = this.getElapsedTotal();
    const durationTotal = this.getTotalDuration();
    this.onTick({
      timeLeft: this.timeLeft,
      stepTotal: this.stepTotal,
      elapsedTotal,
      durationTotal,
      stepProgress: this.stepTotal > 0 ? (1 - (this.timeLeft / this.stepTotal)) : 0,
      globalProgress: durationTotal > 0 ? (elapsedTotal / durationTotal) : 0
    });
  }

  advanceTime(seconds) {
    let remaining = seconds;
    while (remaining > 0 && this.workout.length > 0 && this.currentStep < this.workout.length) {
      if (remaining < this.timeLeft) {
        this.timeLeft -= remaining;
        remaining = 0;
      } else {
        remaining -= this.timeLeft;
        this.timeLeft = 0;
        this.currentStep++;
        if (this.currentStep >= this.workout.length) {
          this.complete();
          return;
        }
        const st = this.workout[this.currentStep];
        this.stepTotal = st.t;
        this.timeLeft = st.t;
        soundEngine.playPhaseChangeTone();
        if (this.onStepChange) {
          this.onStepChange({
            step: st,
            stepIndex: this.currentStep,
            totalSteps: this.workout.length,
            nextStep: this.workout[this.currentStep + 1] || null
          });
        }
      }
    }
    this.saveState();
    this.emitTick();
  }

  tick() {
    if (this.isPaused || this.workout.length === 0) return;

    const now = Date.now();
    const delta = this.lastTickTime ? Math.max(1, Math.round((now - this.lastTickTime) / 1000)) : 1;
    this.lastTickTime = now;

    if (delta <= 1) {
      this.timeLeft--;
      this.saveState();
      this.emitTick();

      // Aviso por voz a los 10 segundos restantes (conciso y natural)
      if (this.timeLeft === 10 && this.workout[this.currentStep + 1]) {
        const next = this.workout[this.currentStep + 1];
        const cue = soundEngine.formatCoachCue(next, false);
        soundEngine.announce(cue);
      }

      // Cuenta regresiva 3, 2, 1
      if (this.timeLeft > 0 && this.timeLeft <= 3) {
        soundEngine.playCountdownTick();
      }

      // Fin del bloque actual
      if (this.timeLeft <= 0) {
        soundEngine.playPhaseChangeTone();
        clearInterval(this.timerInterval);
        this.currentStep++;
        this.loadCurrentStep();
      }
    } else {
      // Si el navegador throttled o congeló el bucle por cambio de app
      this.advanceTime(delta);
    }
  }

  togglePause() {
    if (this.workout.length === 0 || this.currentStep >= this.workout.length) return;
    soundEngine.init();
    this.requestWakeLock();

    this.isPaused = !this.isPaused;
    this.lastTickTime = Date.now();

    if (!this.isPaused) {
      this.startTimerInterval();
    }
    this.saveState();

    if (this.onStatusChange) {
      this.onStatusChange({ isRunning: true, isPaused: this.isPaused });
    }
    this.emitTick();
  }

  skipStep() {
    if (this.workout.length === 0 || this.currentStep >= this.workout.length) return;
    soundEngine.init();
    this.requestWakeLock();
    clearInterval(this.timerInterval);
    this.currentStep++;
    this.loadCurrentStep();
  }

  adjustTime(deltaSeconds) {
    if (this.workout.length === 0 || this.isPaused) return;
    this.timeLeft = Math.max(1, this.timeLeft + deltaSeconds);
    this.stepTotal = Math.max(this.stepTotal, this.timeLeft);
    this.saveState();
    this.emitTick();
  }

  stop(saveProgress = true) {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.releaseWakeLock();

    const elapsed = this.getElapsedTotal();
    let statsRecorded = null;
    if (saveProgress && elapsed >= 15) {
      statsRecorded = gamification.recordWorkout(
        elapsed,
        this.sessionTitle,
        this.selectedLevel,
        bluetoothManager.getHeartRateStats(),
        this.workoutMetadata || {}
      );
    }

    this.clearSavedState();
    this.workout = [];
    this.workoutMetadata = {};
    this.currentStep = 0;
    this.isPaused = false;
    this.timeLeft = 0;
    this.stepTotal = 0;

    if (this.onStatusChange) {
      this.onStatusChange({ isRunning: false, isPaused: false });
    }

    return statsRecorded;
  }

  complete() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.releaseWakeLock();
    soundEngine.playFinishFanfare();

    const elapsed = this.getTotalDuration();
    const hrStats = bluetoothManager.getHeartRateStats();
    const statsRecorded = gamification.recordWorkout(
      elapsed,
      this.sessionTitle,
      this.selectedLevel,
      hrStats,
      this.workoutMetadata || {}
    );
    this.clearSavedState();

    if (this.onWorkoutComplete) {
      this.onWorkoutComplete({
        sessionTitle: this.sessionTitle,
        level: this.selectedLevel,
        metadata: this.workoutMetadata,
        totalSeconds: elapsed,
        hrStats,
        statsRecorded,
        steps: this.workout,
        startTime: this.startTime || (Date.now() - elapsed * 1000),
        samples: bluetoothManager.samples
      });
    }

    this.workout = [];
    this.workoutMetadata = {};
    this.currentStep = 0;
    this.isPaused = false;

    if (this.onStatusChange) {
      this.onStatusChange({ isRunning: false, isPaused: false });
    }
  }

  getElapsedTotal() {
    if (this.workout.length === 0) return 0;
    const pastSteps = this.workout.slice(0, this.currentStep).reduce((a, s) => a + s.t, 0);
    const currentElapsed = Math.max(0, this.stepTotal - this.timeLeft);
    return pastSteps + currentElapsed;
  }

  getTotalDuration() {
    return this.workout.reduce((a, s) => a + s.t, 0);
  }

  saveState() {
    if (this.workout.length === 0 || this.currentStep >= this.workout.length) {
      this.clearSavedState();
      return;
    }
    const state = {
      workout: this.workout,
      workoutMetadata: this.workoutMetadata,
      currentStep: this.currentStep,
      timeLeft: this.timeLeft,
      stepTotal: this.stepTotal,
      sessionTitle: this.sessionTitle,
      selectedLevel: this.selectedLevel,
      startTime: this.startTime,
      isPaused: this.isPaused,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (e) {
      console.warn('Error al guardar estado:', e);
    }
  }

  getSavedState() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  clearSavedState() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {}
  }

  resumeSavedState() {
    const saved = this.getSavedState();
    if (!saved || !saved.workout || saved.workout.length === 0) return false;

    this.workout = saved.workout;
    this.workoutMetadata = saved.workoutMetadata || {};
    this.currentStep = Math.min(saved.currentStep || 0, this.workout.length - 1);
    this.sessionTitle = saved.sessionTitle || 'Entrenamiento';
    this.selectedLevel = saved.selectedLevel || 'fase1';
    this.startTime = saved.startTime || Date.now();

    const st = this.workout[this.currentStep];
    this.stepTotal = saved.stepTotal || st.t;
    this.timeLeft = typeof saved.timeLeft === 'number' ? Math.max(1, saved.timeLeft) : st.t;
    this.isPaused = true; // Restaurar en pausa segura

    this.requestWakeLock();

    // Notificar cambio de fase para cargar nombres, cadencias, etc.
    if (this.onStepChange) {
      this.onStepChange({
        step: st,
        stepIndex: this.currentStep,
        totalSteps: this.workout.length,
        nextStep: this.workout[this.currentStep + 1] || null
      });
    }

    // Inicializar el temporizador
    this.startTimerInterval();

    // Notificar modo carrera en pausa
    if (this.onStatusChange) {
      this.onStatusChange({ isRunning: true, isPaused: true });
    }

    // Emitir inmediatamente el tick para pintar tiempos y porcentaje correctos
    this.emitTick();

    // Re-guardar estado consolidado
    this.saveState();

    return true;
  }
}

export const workoutEngine = new WorkoutEngine();
