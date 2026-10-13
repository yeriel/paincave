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
    this.selectedLevel = 'amateur';
    this.timerInterval = null;
    this.startTime = null;
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
      if (document.visibilityState === 'visible' && !this.isPaused && this.workout.length > 0) {
        this.requestWakeLock();
      }
    });
  }

  start(workoutSteps, title, level = 'amateur') {
    this.stop(false);
    this.workout = workoutSteps;
    this.sessionTitle = title;
    this.selectedLevel = level;
    this.currentStep = 0;
    this.isPaused = false;
    this.startTime = Date.now();
    bluetoothManager.clearSessionSamples();

    soundEngine.init();
    this.requestWakeLock();

    this.loadCurrentStep();
    this.saveState();

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

    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (this.isPaused) return;

    this.timeLeft--;
    this.saveState();

    if (this.onTick) {
      const elapsedTotal = this.getElapsedTotal();
      const durationTotal = this.getTotalDuration();
      this.onTick({
        timeLeft: this.timeLeft,
        stepTotal: this.stepTotal,
        elapsedTotal,
        durationTotal,
        stepProgress: 1 - (this.timeLeft / this.stepTotal),
        globalProgress: durationTotal > 0 ? (elapsedTotal / durationTotal) : 0
      });
    }

    // Aviso por voz a los 10 segundos restantes
    if (this.timeLeft === 10 && this.workout[this.currentStep + 1]) {
      const next = this.workout[this.currentStep + 1];
      const posText = next.posture === 'de pie' ? 'de pie' : 'sentado';
      const cadText = next.cadence ? ` a ${next.cadence} revoluciones por minuto` : '';
      soundEngine.announce(`En diez segundos: ${next.phase}, ${posText}${cadText}.`);
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
  }

  togglePause() {
    if (this.workout.length === 0 || this.currentStep >= this.workout.length) return;
    soundEngine.init();
    this.requestWakeLock();

    this.isPaused = !this.isPaused;
    this.saveState();

    if (this.onStatusChange) {
      this.onStatusChange({ isRunning: true, isPaused: this.isPaused });
    }
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
  }

  stop(saveProgress = true) {
    clearInterval(this.timerInterval);
    this.releaseWakeLock();

    const elapsed = this.getElapsedTotal();
    let statsRecorded = null;
    if (saveProgress && elapsed >= 15) {
      statsRecorded = gamification.recordWorkout(
        elapsed,
        this.sessionTitle,
        this.selectedLevel,
        bluetoothManager.getHeartRateStats()
      );
    }

    this.clearSavedState();
    const wasRunning = this.workout.length > 0;
    this.workout = [];
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
    this.releaseWakeLock();
    soundEngine.playFinishFanfare();

    const elapsed = this.getTotalDuration();
    const hrStats = bluetoothManager.getHeartRateStats();
    const statsRecorded = gamification.recordWorkout(
      elapsed,
      this.sessionTitle,
      this.selectedLevel,
      hrStats
    );
    this.clearSavedState();

    if (this.onWorkoutComplete) {
      this.onWorkoutComplete({
        sessionTitle: this.sessionTitle,
        level: this.selectedLevel,
        totalSeconds: elapsed,
        hrStats,
        statsRecorded,
        steps: this.workout,
        startTime: this.startTime || (Date.now() - elapsed * 1000),
        samples: bluetoothManager.samples
      });
    }

    this.workout = [];
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
    localStorage.setItem(this.storageKey, JSON.stringify({
      workout: this.workout,
      currentStep: this.currentStep,
      timeLeft: this.timeLeft,
      sessionTitle: this.sessionTitle,
      selectedLevel: this.selectedLevel,
      startTime: this.startTime,
      isPaused: true
    }));
  }

  getSavedState() {
    const raw = localStorage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : null;
  }

  clearSavedState() {
    localStorage.removeItem(this.storageKey);
  }

  resumeSavedState() {
    const saved = this.getSavedState();
    if (!saved) return false;

    this.workout = saved.workout;
    this.currentStep = saved.currentStep;
    this.timeLeft = saved.timeLeft;
    this.sessionTitle = saved.sessionTitle;
    this.selectedLevel = saved.selectedLevel;
    this.startTime = saved.startTime || Date.now();
    this.stepTotal = this.workout[this.currentStep].t;
    this.isPaused = true;

    this.clearSavedState();
    this.requestWakeLock();

    if (this.onStepChange) {
      this.onStepChange({
        step: this.workout[this.currentStep],
        stepIndex: this.currentStep,
        totalSteps: this.workout.length,
        nextStep: this.workout[this.currentStep + 1] || null
      });
    }

    if (this.onStatusChange) {
      this.onStatusChange({ isRunning: true, isPaused: true });
    }

    return true;
  }
}

export const workoutEngine = new WorkoutEngine();
