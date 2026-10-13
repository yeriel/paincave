/**
 * Pain Cave Pro - Orquestador Principal
 */

import { soundEngine } from './audio.js';
import { bluetoothManager } from './bluetooth.js';
import { gamification } from './gamification.js';
import { workoutEngine } from './engine.js';
import { ui, formatTime } from './ui.js';
import { getRoutine, parseCSV } from './workouts.js';

class PainCaveApp {
  constructor() {
    this.selectedLevel = 'amateur';
    this.activeCategory = 'todos';
    this.tempWorkoutBuffer = null;
  }

  init() {
    // Registro de Service Worker para PWA Offline
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }

    ui.init();
    workoutEngine.initVisibilityWatcher();

    // Conectar callbacks de Bluetooth
    bluetoothManager.onConnectionChange = (connected) => {
      const btn = document.getElementById('btnBluetooth');
      const label = document.getElementById('bpmLabel');
      const icon = document.getElementById('hrIcon');
      if (connected) {
        label.textContent = "BPM";
        icon.classList.remove('hidden');
        icon.classList.add('animate-heart-beat');
        btn.classList.replace('text-slate-400', 'text-blue-500');
      } else {
        label.textContent = "Conectar";
        icon.classList.add('hidden');
        icon.classList.remove('animate-heart-beat');
        btn.classList.replace('text-blue-500', 'text-slate-400');
        document.getElementById('bpmVal').textContent = "—";
      }
    };

    bluetoothManager.onBpmUpdate = (bpm) => {
      document.getElementById('bpmVal').textContent = bpm;
      if (workoutEngine.workout.length > 0) {
        ui.updateInterfaceColors(bpm, null, true);
      }
    };

    // Conectar callbacks del motor de entrenamiento
    workoutEngine.onStepChange = (data) => {
      ui.renderStep(data, bluetoothManager.isConnected, bluetoothManager.currentBpm);
    };

    workoutEngine.onTick = (tickData) => {
      ui.renderTick(tickData);
    };

    workoutEngine.onWorkoutComplete = (summaryData) => {
      ui.showWorkoutSummaryModal(summaryData);
      ui.resetDisplay();
    };

    workoutEngine.onStatusChange = ({ isRunning, isPaused }) => {
      const display = document.getElementById('timerDisplay');
      const tapText = document.getElementById('tapActionText');
      const inRideControls = document.getElementById('inRideControls');
      const mainPauseBtn = document.getElementById('btnMainPause');
      if (!isRunning) {
        display.classList.remove('opacity-50', 'animate-pulse');
        tapText.textContent = "Pausar";
        if (inRideControls) inRideControls.classList.add('hidden');
      } else {
        display.classList.toggle('opacity-50', isPaused);
        display.classList.toggle('animate-pulse', isPaused);
        tapText.textContent = isPaused ? "Reanudar" : "Pausar";
        if (inRideControls) inRideControls.classList.remove('hidden');
        if (mainPauseBtn) {
          mainPauseBtn.innerHTML = isPaused ? '<i class="ti ti-player-play text-xl"></i> Reanudar' : '<i class="ti ti-player-pause text-xl"></i> Pausar';
          mainPauseBtn.className = isPaused ? 'flex-1 py-3.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg' : 'flex-1 py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg';
        }
      }
    };

    // Verificar si hay sesión pendiente para reanudar
    if (workoutEngine.getSavedState()) {
      ui.openModal('resumeModal');
    }

    // Renderizar Pool de Rutinas
    ui.renderRoutinesPool(this.selectedLevel, this.activeCategory);

    // Eventos de controles globales
    const voiceToggle = document.getElementById('voiceToggle');
    if (voiceToggle) {
      voiceToggle.addEventListener('change', (e) => {
        soundEngine.setVoiceEnabled(e.target.checked);
      });
    }

    const diffSelect = document.getElementById('difficulty');
    if (diffSelect) {
      diffSelect.value = this.selectedLevel;
      diffSelect.addEventListener('change', (e) => {
        this.setLevel(e.target.value);
      });
    }
  }

  setLevel(level) {
    this.selectedLevel = level;
    workoutEngine.selectedLevel = level;
    const diffSelect = document.getElementById('difficulty');
    if (diffSelect) diffSelect.value = level;
    ui.renderRoutinesPool(this.selectedLevel, this.activeCategory);
  }

  setCategoryFilter(category) {
    this.activeCategory = category;
    // Actualizar botones de categoría
    document.querySelectorAll('.cat-pill').forEach(btn => {
      if (btn.dataset.category === category) {
        btn.className = "cat-pill px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white transition-colors";
      } else {
        btn.className = "cat-pill px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-700";
      }
    });
    ui.renderRoutinesPool(this.selectedLevel, this.activeCategory);
  }

  openPreWorkoutModal(routineId) {
    const routine = getRoutine(routineId, this.selectedLevel);
    if (!routine) return;

    this.tempWorkoutBuffer = {
      routine: routine.steps,
      name: `${routine.title} · ${this.selectedLevel.toUpperCase()}`
    };

    document.getElementById('preWorkoutType').textContent = this.tempWorkoutBuffer.name;

    // Generar lista de fases
    const listEl = document.getElementById('preWorkoutStepsList');
    listEl.innerHTML = '';
    routine.steps.forEach((st, idx) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between py-1.5 border-b border-slate-800 last:border-b-0 text-xs';
      item.innerHTML = `
        <div class="truncate mr-2">
          <span class="font-bold text-slate-300">${idx + 1}. ${st.phase}</span>
          <span class="text-[10px] text-slate-500 block">${st.posture === 'de pie' ? '⚡ De pie' : '🪑 Sentado'} · ${st.cadence ? st.cadence + ' RPM · ' : ''}RPE ${st.rpe || '—'}</span>
        </div>
        <span class="font-mono text-slate-400 shrink-0 font-semibold">${formatTime(st.t)}</span>
      `;
      listEl.appendChild(item);
    });

    ui.openModal('preWorkoutModal');
  }

  startWorkout() {
    if (!this.tempWorkoutBuffer) return;
    ui.closeModals();

    const { routine, name } = this.tempWorkoutBuffer;
    ui.buildDots(routine.length);
    ui.renderWorkoutProfileBar(routine);

    const profileContainer = document.getElementById('workoutProfileContainer');
    if (profileContainer) profileContainer.classList.remove('hidden');

    workoutEngine.start(routine, name, this.selectedLevel);

    const first = routine[0];
    soundEngine.announce(`Comenzando sesión. ${first.phase}, ${first.posture === 'de pie' ? 'de pie' : 'sentado'}${first.cadence ? ' a ' + first.cadence + ' revoluciones' : ''}.`);
  }

  togglePause() {
    workoutEngine.togglePause();
  }

  skipStep() {
    workoutEngine.skipStep();
  }

  adjustTime(seconds) {
    workoutEngine.adjustTime(seconds);
  }

  toggleFullscreen() {
    ui.toggleFullscreen();
  }

  resetWorkout() {
    if (workoutEngine.workout.length === 0) return;
    workoutEngine.isPaused = true;
    workoutEngine.onStatusChange({ isRunning: true, isPaused: true });

    if (workoutEngine.getElapsedTotal() >= 15) {
      ui.openModal('exitModal');
    } else {
      workoutEngine.stop(false);
      ui.resetDisplay();
    }
  }

  cancelExit() {
    ui.closeModals();
    workoutEngine.isPaused = false;
    workoutEngine.onStatusChange({ isRunning: true, isPaused: false });
  }

  confirmExit(saveXP) {
    const statsRecorded = workoutEngine.stop(saveXP);
    ui.closeModals();
    ui.resetDisplay();
    ui.updateMiniRank();
  }

  resumeSavedState() {
    const ok = workoutEngine.resumeSavedState();
    if (ok) {
      this.selectedLevel = workoutEngine.selectedLevel;
      const diffSelect = document.getElementById('difficulty');
      if (diffSelect) diffSelect.value = this.selectedLevel;
      ui.closeModals();
      ui.buildDots(workoutEngine.workout.length);
      ui.renderWorkoutProfileBar(workoutEngine.workout);
      const profileContainer = document.getElementById('workoutProfileContainer');
      if (profileContainer) profileContainer.classList.remove('hidden');
      workoutEngine.togglePause();
    }
  }

  discardSavedState() {
    workoutEngine.clearSavedState();
    ui.closeModals();
  }

  // Bluetooth HRM
  async toggleHRM() {
    if (bluetoothManager.isConnected) {
      bluetoothManager.disconnect();
    } else {
      try {
        await bluetoothManager.connect();
      } catch (e) {
        if (e.name !== 'NotFoundError') {
          alert("Error de conexión Bluetooth: " + e.message);
        }
      }
    }
  }

  // Modales
  openCustomModal() {
    ui.openModal('customModal');
  }

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('csvInput').value = e.target.result;
    };
    reader.readAsText(file);
  }

  loadCustomCSV() {
    const text = document.getElementById('csvInput').value.trim();
    if (!text) {
      alert("El contenido CSV está vacío.");
      return;
    }
    try {
      const { level, steps } = parseCSV(text);
      this.setLevel(level);
      this.tempWorkoutBuffer = {
        routine: steps,
        name: `Personalizada (${level.toUpperCase()})`
      };
      document.getElementById('preWorkoutType').textContent = this.tempWorkoutBuffer.name;

      const listEl = document.getElementById('preWorkoutStepsList');
      listEl.innerHTML = '';
      steps.forEach((st, idx) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between py-1.5 border-b border-slate-800 last:border-b-0 text-xs';
        item.innerHTML = `
          <div class="truncate mr-2">
            <span class="font-bold text-slate-300">${idx + 1}. ${st.phase}</span>
            <span class="text-[10px] text-slate-500 block">${st.posture === 'de pie' ? '⚡ De pie' : '🪑 Sentado'} · ${st.cadence ? st.cadence + ' RPM · ' : ''}RPE ${st.rpe || '—'}</span>
          </div>
          <span class="font-mono text-slate-400 shrink-0 font-semibold">${formatTime(st.t)}</span>
        `;
        listEl.appendChild(item);
      });

      ui.openModal('preWorkoutModal');
    } catch (e) {
      alert("Error en el archivo CSV: " + e.message);
    }
  }

  showStatsModal() {
    ui.showStatsModal();
  }

  saveMaxHR(val) {
    try {
      gamification.setMaxHR(val);
      if (workoutEngine.workout.length > 0) {
        const current = workoutEngine.workout[workoutEngine.currentStep];
        document.getElementById('zoneBpmTarget').textContent = current.zone ? getZoneBpmRange(current.zone) + ' BPM' : 'BPM';
      }
    } catch (e) {
      alert(e.message);
      document.getElementById('maxHrInput').value = gamification.getMaxHR();
    }
  }

  exportStats() {
    try {
      gamification.exportData();
    } catch (e) {
      alert(e.message);
    }
  }

  importStats(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        gamification.importData(e.target.result);
        ui.updateMiniRank();
        ui.showStatsModal();
        alert("¡Estadísticas importadas con éxito!");
      } catch (err) {
        alert("Error al importar: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  downloadTCX() {
    ui.downloadCurrentSessionTCX();
  }

  closeModals() {
    ui.closeModals();
  }
}

// Inicializar y exponer al objeto global para enlaces HTML inline
window.painCaveApp = new PainCaveApp();
window.addEventListener('DOMContentLoaded', () => {
  window.painCaveApp.init();
});
