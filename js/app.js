/**
 * Pain Cave Pro - Orquestador Principal
 */

import { soundEngine } from './audio.js';
import { bluetoothManager } from './bluetooth.js';
import { gamification } from './gamification.js';
import { workoutEngine } from './engine.js';
import { ui, formatTime } from './ui.js';
import { getRoutine, parseCSV, getZoneBpmRange } from './workouts.js';
import { trainingTracker } from './trainingTracker.js';

class PainCaveApp {
  constructor() {
    this.selectedLevel = 'fase1';
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

    // Calibración inicial de FC Máx personalizada (189 BPM)
    if (gamification.getMaxHR() === 190) {
      gamification.setMaxHR(189);
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
      ui.renderTrainingTrackerWidget();
      ui.updateMiniRank();
    };

    workoutEngine.onStatusChange = ({ isRunning, isPaused }) => {
      const display = document.getElementById('timerDisplay');
      if (!isRunning) {
        display.classList.remove('opacity-50', 'animate-pulse');
      } else {
        display.classList.toggle('opacity-50', isPaused);
        display.classList.toggle('animate-pulse', isPaused);
      }
      ui.setRideMode(isRunning, isPaused);
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
    ui.updateLevelTabs(level);
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

    const prog = trainingTracker.getCurrentProgress();
    const phaseNames = {
      fase1: 'Fase 1 (Cimientos)',
      fase2: 'Fase 2 (Densidad)',
      fase3: 'Fase 3 (Dominio Aero)'
    };
    const phaseLabel = phaseNames[this.selectedLevel] || (prog.matchedPhase?.id === this.selectedLevel ? `${prog.matchedPhase.name} (${prog.matchedPhase.subtitle})` : this.selectedLevel.toUpperCase());

    this.tempWorkoutBuffer = {
      routine: routine.steps,
      name: `${routine.title} · ${phaseLabel}`,
      routineId: routine.id,
      day: routine.day,
      phaseId: this.selectedLevel,
      phaseName: phaseLabel,
      weekNumber: prog.currentWeek
    };

    document.getElementById('preWorkoutType').textContent = routine.title;
    const totalSec = routine.steps.reduce((a, s) => a + s.t, 0);
    const badgeEl = document.getElementById('preWorkoutDurationBadge');
    if (badgeEl) badgeEl.textContent = `${Math.round(totalSec / 60)} min · ${routine.steps.length} bloques`;

    // Generar lista de fases
    const listEl = document.getElementById('preWorkoutStepsList');
    listEl.innerHTML = '';
    routine.steps.forEach((st, idx) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between py-1.5 border-b border-slate-800 last:border-b-0 text-xs';
      item.innerHTML = `
        <div class="truncate mr-2">
          <span class="font-bold text-slate-300">${idx + 1}. ${st.phase}</span>
          <span class="text-[10px] text-slate-400 block">${st.posture === 'aero' ? '🚴 Aero' : (st.posture === 'de pie' ? '⚡ De pie' : '🪑 Sentado')} · ${st.cadence ? st.cadence + ' RPM · ' : ''}${st.zone ? (st.zone === 'SS' ? 'Sweet Spot' : 'Z' + st.zone) + ' (' + getZoneBpmRange(st.zone) + ' BPM) · ' : ''}RPE ${st.rpe || '—'}</span>
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

    const { routine, name, ...meta } = this.tempWorkoutBuffer;
    ui.buildDots(routine.length);
    ui.renderWorkoutProfileBar(routine);

    const profileContainer = document.getElementById('workoutProfileContainer');
    if (profileContainer) profileContainer.classList.remove('hidden');

    workoutEngine.start(routine, name, this.selectedLevel, meta);

    const first = routine[0];
    const cue = soundEngine.formatCoachCue(first, true);
    soundEngine.announce(cue);
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
            <span class="text-[10px] text-slate-500 block">${st.posture === 'aero' ? '🚴 Aero' : (st.posture === 'de pie' ? '⚡ De pie' : '🪑 Sentado')} · ${st.cadence ? st.cadence + ' RPM · ' : ''}RPE ${st.rpe || '—'}</span>
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

  showStatsModal(tab = 'tracking') {
    ui.showStatsModal(tab);
  }

  openTrackingModal(tab = 'tracking') {
    ui.showStatsModal(tab);
  }

  switchStatsTab(tabName) {
    ui.switchStatsTab(tabName);
  }

  selectCalendarDate(dateStr) {
    ui.selectCalendarDate(dateStr);
  }

  togglePlanConfigAccordion() {
    const content = document.getElementById('planConfigAccordionContent');
    const chevron = document.getElementById('planConfigAccordionChevron');
    if (!content) return;
    const isHidden = content.classList.contains('hidden');
    content.classList.toggle('hidden', !isHidden);
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }

  saveCurrentWeekFromInput() {
    const input = document.getElementById('configWeekInput');
    if (!input) return;
    const weekNum = parseInt(input.value);
    if (isNaN(weekNum) || weekNum < 1) {
      alert("Por favor introduce un número de semana válido (1 o mayor).");
      return;
    }
    trainingTracker.setCurrentWeek(weekNum);
    this.setLevel(trainingTracker.plan.currentPhaseId);
    ui.renderTrainingTrackerWidget();
    ui.renderTrackingTab();
    ui.updateMiniRank();
  }

  saveCurrentPhaseFromSelect(phaseId) {
    trainingTracker.setCurrentPhase(phaseId);
    this.setLevel(phaseId);
    ui.renderTrainingTrackerWidget();
    ui.renderTrackingTab();
    ui.updateMiniRank();
  }

  promptAddPhase() {
    const name = prompt("Nombre de la nueva fase (ej: Fase 4):", `Fase ${trainingTracker.plan.phases.length + 1}`);
    if (!name) return;
    const subtitle = prompt("Subtítulo / Objetivo de la fase (ej: Especialización Pico FTP):", "Pico de Forma y Resistencia");
    if (!subtitle) return;
    const weeksStr = prompt("Duración en semanas (ej: 4):", "4");
    const weeks = parseInt(weeksStr) || 4;

    trainingTracker.addPhase({ name, subtitle, weeks });
    ui.renderTrainingTrackerWidget();
    ui.renderTrackingTab();
    alert(`¡Fase "${name}" agregada con éxito!`);
  }

  promptEditPhase(phaseId) {
    const phase = trainingTracker.plan.phases.find(p => p.id === phaseId);
    if (!phase) return;
    const newWeeks = prompt(`Modificar duración en semanas para "${phase.name}" (${phase.weeks} actuales):`, phase.weeks);
    if (!newWeeks) return;
    const weeks = parseInt(newWeeks);
    if (isNaN(weeks) || weeks < 1) {
      alert("Número de semanas inválido.");
      return;
    }
    trainingTracker.updatePhase(phaseId, { weeks });
    ui.renderTrainingTrackerWidget();
    ui.renderTrackingTab();
  }

  deletePhase(phaseId) {
    const phase = trainingTracker.plan.phases.find(p => p.id === phaseId);
    if (!phase) return;
    if (confirm(`¿Estás seguro de eliminar la "${phase.name}"?`)) {
      try {
        trainingTracker.removePhase(phaseId);
        ui.renderTrainingTrackerWidget();
        ui.renderTrackingTab();
      } catch (e) {
        alert(e.message);
      }
    }
  }

  startNewTrainingCycle() {
    if (confirm("¿Iniciar un nuevo ciclo de entrenamiento? Se mantendrá intacto tu historial de sesiones y XP, y el plan avanzará al siguiente ciclo desde la Semana 1.")) {
      const cycleName = prompt("Nombre del nuevo ciclo:", `Ciclo ${trainingTracker.plan.cycleNumber + 1}`);
      trainingTracker.startNewCycle(cycleName);
      this.setLevel(trainingTracker.plan.phases[0].id);
      ui.renderTrainingTrackerWidget();
      ui.renderTrackingTab();
      ui.updateMiniRank();
      alert("¡Nuevo ciclo de entrenamiento iniciado con éxito!");
    }
  }

  resetPlanProgress() {
    if (confirm("¿Deseas reiniciar la progresión a la Semana 1? (No se borrarán tus sesiones realizadas ni tu rango).")) {
      trainingTracker.resetProgress();
      this.setLevel(trainingTracker.plan.phases[0].id);
      ui.renderTrainingTrackerWidget();
      ui.renderTrackingTab();
      ui.updateMiniRank();
    }
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
      const stats = gamification.getStats();
      const plan = trainingTracker.exportPlanData();
      const backup = {
        version: 2,
        exportedAt: new Date().toISOString(),
        stats,
        plan
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paincave-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
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
        const parsed = JSON.parse(e.target.result);
        if (parsed.stats && Array.isArray(parsed.stats.workouts)) {
          gamification.importData(JSON.stringify(parsed.stats));
          if (parsed.plan) {
            trainingTracker.importPlanData(parsed.plan);
          }
        } else if (Array.isArray(parsed.workouts)) {
          // Archivo versión 1 anterior
          gamification.importData(e.target.result);
        } else {
          throw new Error("El archivo no tiene el formato de Pain Cave.");
        }
        ui.updateMiniRank();
        ui.renderTrainingTrackerWidget();
        ui.showStatsModal('tracking');
        alert("¡Datos y plan importados con éxito!");
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

  testVoice() {
    soundEngine.init();
    soundEngine.testVoice();
  }

  changeVoice(voiceUri) {
    soundEngine.init();
    soundEngine.setVoiceByUri(voiceUri);
    soundEngine.testVoice();
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
