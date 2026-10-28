/**
 * Manejador de la Interfaz de Usuario (UI) y Visualización
 * Minimalista, directo al grano y enfocado en la experiencia deportiva
 */

import { gamification } from './gamification.js';
import { getZoneBpmRange, ROUTINES_POOL } from './workouts.js';
import { exportToTCX } from './exporter.js';
import { soundEngine } from './audio.js';
import { trainingTracker, formatDateISO } from './trainingTracker.js';

const CIRC = 2 * Math.PI * 90; // Radio SVG 90px (~565.48)

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function generateMiniProfileSvg(steps) {
  const total = steps.reduce((a, s) => a + s.t, 0);
  if (total === 0) return '';
  const zoneColors = { 1: '#3b82f6', 2: '#10b981', 3: '#eab308', 'SS': '#f59e0b', 'ss': '#f59e0b', 4: '#f97316', 5: '#ef4444' };
  let x = 0;
  const svgWidth = 90;
  const svgHeight = 20;
  let rects = '';

  steps.forEach(st => {
    const w = Math.max(1.2, (st.t / total) * svgWidth);
    const rpeVal = st.rpe || (st.zone === 'SS' ? 7.8 : (st.zone ? st.zone * 2 : 5));
    const h = Math.max(3, Math.min(svgHeight, (rpeVal / 10) * svgHeight));
    const y = svgHeight - h;
    const color = zoneColors[st.zone] || zoneColors[st.zone || 2] || '#10b981';
    rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="1" />`;
    x += w;
  });

  return `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" class="overflow-hidden rounded opacity-80 group-hover:opacity-100 transition-opacity shrink-0">${rects}</svg>`;
}

export class UIManager {
  constructor() {
    this.CIRC = CIRC;
    this.currentWorkoutSteps = [];
    this.lastCompletedSessionData = null;
    this.selectedCalendarDate = formatDateISO(new Date());
    this.activeStatsTab = 'tracking';
  }

  init() {
    this.updateMiniRank();
    this.renderTrainingTrackerWidget();
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
  }

  updateMiniRank() {
    const stats = gamification.getStats();
    const rank = gamification.calculateRank(stats.totalXP || 0);
    const el = document.getElementById('miniRankText');
    if (el) el.textContent = rank.title;

    const pill = document.getElementById('headerTrackerPill');
    if (pill) {
      const prog = trainingTracker.getCurrentProgress();
      pill.textContent = `Sem ${prog.currentWeek}`;
    }
  }

  updateLevelTabs(selectedLevel) {
    document.querySelectorAll('.level-tab').forEach(tab => {
      if (tab.dataset.level === selectedLevel) {
        tab.className = 'level-tab px-2.5 py-1 rounded-md text-xs font-bold transition-all bg-blue-600 text-white shadow-sm';
      } else {
        tab.className = 'level-tab px-2.5 py-1 rounded-md text-xs font-bold transition-all text-slate-400 hover:text-white';
      }
    });
  }

  setRideMode(isRunning, isPaused = false) {
    const catalog = document.getElementById('catalogSection');
    const profile = document.getElementById('workoutProfileContainer');
    const controls = document.getElementById('inRideControls');
    const pauseBtn = document.getElementById('btnMainPause');

    if (isRunning) {
      if (catalog) catalog.classList.add('hidden');
      if (profile) profile.classList.remove('hidden');
      if (controls) controls.classList.remove('hidden');
      if (pauseBtn) {
        pauseBtn.innerHTML = isPaused ? '<i class="ti ti-player-play text-lg"></i> REANUDAR' : '<i class="ti ti-player-pause text-lg"></i> PAUSAR';
        pauseBtn.className = isPaused 
          ? 'flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-green-600 hover:bg-green-500 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md'
          : 'flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-blue-600 hover:bg-blue-500 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md';
      }
    } else {
      if (catalog) catalog.classList.remove('hidden');
      if (profile) profile.classList.add('hidden');
      if (controls) controls.classList.add('hidden');
      this.updateTrackingHeader();
    }
  }

  toggleFullscreen() {
    const btn = document.getElementById('btnFullscreen');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      if (btn) btn.innerHTML = '<i class="ti ti-minimize text-lg"></i>';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      if (btn) btn.innerHTML = '<i class="ti ti-maximize text-lg"></i>';
    }
  }

  handleFullscreenChange() {
    const btn = document.getElementById('btnFullscreen');
    if (!btn) return;
    if (document.fullscreenElement) {
      btn.innerHTML = '<i class="ti ti-minimize text-lg"></i>';
    } else {
      btn.innerHTML = '<i class="ti ti-maximize text-lg"></i>';
    }
  }

  // Actualiza los colores de la tarjeta según pulso real o RPE estimado
  updateInterfaceColors(currentBpm, fallbackRpe, isHRMConnected) {
    let color = '#1D9E75';
    const card = document.getElementById('mainCard');
    if (!card) return;

    card.className = "bg-slate-800 border rounded-2xl p-4 shadow-xl transition-all duration-500 relative";

    if (isHRMConnected && currentBpm) {
      const maxHr = gamification.getMaxHR();
      const pct = (currentBpm / maxHr) * 100;
      if (pct < 60) {
        color = '#3b82f6';
        card.classList.add('bg-blue-950/40', 'border-blue-500/40');
      } else if (pct < 71) {
        color = '#10b981';
        card.classList.add('bg-emerald-950/40', 'border-emerald-500/40');
      } else if (pct < 81) {
        color = '#eab308';
        card.classList.add('bg-yellow-950/40', 'border-yellow-500/40');
      } else if (pct < 91) {
        color = '#f59e0b';
        card.classList.add('bg-amber-950/40', 'border-amber-500/50');
      } else {
        color = '#ef4444';
        card.classList.add('bg-red-950/40', 'border-red-500/50');
      }
    } else {
      const rpe = fallbackRpe !== null && fallbackRpe !== undefined ? fallbackRpe : 4;
      if (rpe <= 4) {
        color = '#34D399';
        card.classList.add('border-slate-700');
      } else if (rpe <= 6.5) {
        color = '#FBBF24';
        card.classList.add('border-yellow-600/30', 'bg-slate-800');
      } else if (rpe <= 8.5) {
        color = '#F97316';
        card.classList.add('bg-orange-950/30', 'border-orange-500/40');
      } else {
        color = '#EF4444';
        card.classList.add('bg-red-950/40', 'border-red-500/50');
      }
    }

    const ring = document.getElementById('timerRing');
    if (ring) ring.style.stroke = color;
  }

  // Renderiza el paso activo en la pantalla principal
  renderStep({ step, stepIndex, totalSteps, nextStep }, isHRMConnected, currentBpm) {
    document.getElementById('sessionLabel').textContent = step.phase;
    document.getElementById('exPhase').textContent = `FASE ${stepIndex + 1} / ${totalSteps}`;
    document.getElementById('exName').textContent = step.phase;

    // Badge de postura
    const postBadge = document.getElementById('exPostureBadge');
    const postText = document.getElementById('exPostureText');
    const postIcon = document.getElementById('exPostureIcon');
    postBadge.classList.remove('hidden');
    postBadge.classList.add('flex');
    if (step.posture === 'aero') {
      postText.textContent = 'Posición Aero';
      postIcon.textContent = '🚴';
      postBadge.className = 'flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-extrabold bg-cyan-950/90 text-cyan-200 border border-cyan-500/50 shadow-sm';
    } else if (step.posture === 'de pie') {
      postText.textContent = 'De pie';
      postIcon.textContent = '⚡';
      postBadge.className = 'flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-extrabold bg-amber-900/80 text-amber-200 border border-amber-500/50';
    } else {
      postText.textContent = 'Sentado';
      postIcon.textContent = '🪑';
      postBadge.className = 'flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-extrabold bg-slate-700 text-slate-200 border border-slate-600';
    }

    // 1. Cadencia y Metrónomo Visual
    document.getElementById('cadenceVal').textContent = step.cadence ? step.cadence : '—';
    document.getElementById('cadenceUnit').textContent = step.cadence ? 'RPM' : 'Libre';
    
    const pacerDot = document.getElementById('cadencePacerDot');
    if (pacerDot) {
      if (step.cadence && step.cadence > 0) {
        pacerDot.classList.remove('hidden');
        const period = (60 / step.cadence).toFixed(2);
        pacerDot.style.animationDuration = `${period}s`;
      } else {
        pacerDot.classList.add('hidden');
      }
    }

    // 2. Zona
    const zoneStr = step.zone ? (String(step.zone).toUpperCase() === 'SS' ? 'SS' : 'Z' + step.zone) : '—';
    document.getElementById('zoneVal').textContent = zoneStr;
    document.getElementById('zoneBpmTarget').textContent = step.zone ? getZoneBpmRange(step.zone) + ' BPM' : 'BPM';

    // 3. RPE
    document.getElementById('rpeVal').textContent = step.rpe !== null ? step.rpe : '—';
    document.getElementById('rpeFill').style.width = step.rpe ? (step.rpe / 10 * 100) + '%' : '0%';

    // 4. Pulso
    document.getElementById('bpmVal').textContent = (isHRMConnected && currentBpm) ? currentBpm : '—';
    this.updateInterfaceColors(currentBpm, step.rpe, isHRMConnected);

    // Indicador de pasos / Dots
    document.getElementById('stepCounter').textContent = `${stepIndex + 1} / ${totalSteps}`;
    this.updateDots(stepIndex, totalSteps);

    // Reiniciar anillo SVG
    const ring = document.getElementById('timerRing');
    if (ring) ring.style.strokeDashoffset = 0;

    // Siguiente paso
    if (nextStep) {
      document.getElementById('nextName').textContent = nextStep.phase;
      const details = [];
      if (nextStep.cadence) details.push(`${nextStep.cadence} RPM`);
      if (nextStep.rpe) details.push(`RPE ${nextStep.rpe}`);
      details.push(formatTime(nextStep.t));
      const postTag = nextStep.posture === 'aero' ? '🚴 Aero' : (nextStep.posture === 'de pie' ? '⚡ De pie' : '🪑 Sentado');
      details.push(postTag);
      document.getElementById('nextMeta').textContent = details.join(' · ');
    } else {
      document.getElementById('nextName').textContent = 'Meta';
      document.getElementById('nextMeta').textContent = 'Último bloque';
    }

    // Resaltar bloque actual en la barra de perfil visual
    this.highlightProfileStep(stepIndex);
  }

  // Actualización de cada segundo
  renderTick({ timeLeft, stepTotal, elapsedTotal, durationTotal, stepProgress, globalProgress }) {
    document.getElementById('timerDisplay').textContent = formatTime(timeLeft);
    const ring = document.getElementById('timerRing');
    if (ring) {
      ring.style.strokeDashoffset = this.CIRC * (1 - (timeLeft / stepTotal));
    }
    document.getElementById('globalTime').textContent = `${formatTime(elapsedTotal)} / ${formatTime(durationTotal)}`;
    document.getElementById('globalProgress').style.width = `${Math.min(100, globalProgress * 100)}%`;

    // Actualizar indicador en la barra de perfil
    const marker = document.getElementById('profileProgressMarker');
    if (marker) {
      marker.style.left = `${Math.min(100, globalProgress * 100)}%`;
    }
  }

  // Dibuja la barra gráfica con el perfil de bloques del entrenamiento (Workout Profile Bar)
  renderWorkoutProfileBar(steps) {
    this.currentWorkoutSteps = steps;
    const container = document.getElementById('workoutProfileBar');
    if (!container) return;

    container.innerHTML = '';
    const totalDuration = steps.reduce((a, s) => a + s.t, 0);
    if (totalDuration === 0) return;

    const zoneColors = {
      1: '#3b82f6', // Azul
      2: '#10b981', // Verde
      3: '#eab308', // Amarillo
      4: '#f97316', // Naranja
      5: '#ef4444'  // Rojo
    };

    steps.forEach((st, idx) => {
      const widthPct = (st.t / totalDuration) * 100;
      const rpeVal = st.rpe || (st.zone ? st.zone * 2 : 5);
      const heightPct = Math.max(30, Math.min(100, (rpeVal / 10) * 100));
      const color = zoneColors[st.zone || 2];

      const block = document.createElement('div');
      block.id = `profile-step-${idx}`;
      block.className = "relative h-full flex flex-col justify-end group transition-all duration-300";
      block.style.width = `${widthPct}%`;

      block.innerHTML = `
        <div class="w-full rounded-t-sm transition-all duration-300 opacity-75 group-hover:opacity-100" 
             style="height: ${heightPct}%; background-color: ${color};">
        </div>
      `;
      block.title = `${idx + 1}. ${st.phase} (${formatTime(st.t)})`;
      container.appendChild(block);
    });

    // Marcador de progreso en la barra
    const marker = document.createElement('div');
    marker.id = 'profileProgressMarker';
    marker.className = "absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_#ffffff] z-10 transition-all duration-1000 ease-linear pointer-events-none";
    marker.style.left = '0%';
    container.appendChild(marker);
  }

  highlightProfileStep(stepIndex) {
    if (!this.currentWorkoutSteps) return;
    this.currentWorkoutSteps.forEach((_, idx) => {
      const block = document.getElementById(`profile-step-${idx}`);
      if (!block) return;
      const inner = block.firstElementChild;
      if (idx === stepIndex) {
        inner.classList.remove('opacity-75');
        inner.classList.add('opacity-100', 'ring-1', 'ring-white');
      } else if (idx < stepIndex) {
        inner.classList.remove('opacity-100', 'ring-1', 'ring-white');
        inner.classList.add('opacity-40');
      } else {
        inner.classList.remove('opacity-40', 'ring-1', 'ring-white');
        inner.classList.add('opacity-75');
      }
    });
  }

  // Dots de etapas
  buildDots(count) {
    const c = document.getElementById('stepDots');
    if (!c) return;
    c.innerHTML = '';
    const max = Math.min(count, 16);
    for (let i = 0; i < max; i++) {
      const d = document.createElement('div');
      d.id = 'dot-' + i;
      c.appendChild(d);
    }
    if (count > 16) {
      const s = document.createElement('span');
      s.className = 'text-[10px] text-slate-500 font-bold ml-0.5';
      s.textContent = '+' + (count - 16);
      c.appendChild(s);
    }
  }

  updateDots(currentStep, count) {
    for (let i = 0; i < Math.min(count, 16); i++) {
      const d = document.getElementById('dot-' + i);
      if (!d) continue;
      d.className = 'rounded-full transition-all duration-300 ' + (
        i < currentStep
          ? 'w-[6px] h-[6px] bg-[#1D9E75]'
          : (i === currentStep ? 'w-[9px] h-[9px] bg-[#378ADD] shadow-[0_0_6px_#378ADD]' : 'w-[6px] h-[6px] bg-slate-700')
      );
    }
  }

  // Render del Pool de Rutinas (Limpio y directo)
  renderRoutinesPool(selectedLevel = 'fase1', activeCategory = 'todos') {
    const container = document.getElementById('routinesPoolGrid');
    if (!container) return;

    container.innerHTML = '';

    const filtered = ROUTINES_POOL.filter(r => {
      return activeCategory === 'todos' || r.category === activeCategory;
    });

    filtered.forEach(routine => {
      const steps = routine.levels[selectedLevel] || routine.levels.fase1 || Object.values(routine.levels)[0];
      const totalSec = steps.reduce((a, s) => a + s.t, 0);
      const minutes = Math.round(totalSec / 60);
      const miniSvg = generateMiniProfileSvg(steps);

      const card = document.createElement('button');
      card.className = `p-3 rounded-xl border border-${routine.colorClass}-600/30 bg-slate-800/90 hover:bg-slate-750 text-left transition-all active:scale-[0.98] group flex flex-col justify-between shadow-sm`;
      card.onclick = () => window.painCaveApp.openPreWorkoutModal(routine.id);

      card.innerHTML = `
        <div class="w-full">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-black text-white group-hover:text-${routine.colorClass}-400 transition-colors">
              ${routine.title}
            </span>
            <span class="text-[11px] font-mono font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
              ${minutes} min
            </span>
          </div>
          <div class="text-[11px] text-slate-400 mb-2">
            ${steps.length} bloques · ${routine.subtitle}
          </div>
        </div>
        <div class="w-full pt-1.5 border-t border-slate-700/60 flex items-center justify-between">
          ${miniSvg}
          <span class="text-${routine.colorClass}-400 text-xs font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            Iniciar <i class="ti ti-chevron-right text-xs"></i>
          </span>
        </div>
      `;
      container.appendChild(card);
    });

    // Tarjeta informativa de Domingo (Descanso total) si estamos viendo todos los días
    if (activeCategory === 'todos') {
      const sundayCard = document.createElement('div');
      sundayCard.className = 'p-3 rounded-xl border border-slate-700/50 bg-slate-800/40 text-left flex flex-col justify-between opacity-75';
      sundayCard.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <i class="ti ti-moon text-blue-400"></i> Domingo · Descanso Total
          </span>
          <span class="text-[10px] uppercase font-mono font-bold text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800">
            Asimilación
          </span>
        </div>
        <div class="text-[11px] text-slate-400">
          Cero pedaleo. La adaptación mitocondrial y muscular se consolida durante el descanso.
        </div>
      `;
      container.appendChild(sundayCard);
    }
  }

  // Render del Modal de Resumen al terminar entrenamiento
  showWorkoutSummaryModal(summaryData) {
    this.lastCompletedSessionData = summaryData;
    const { sessionTitle, totalSeconds, hrStats, statsRecorded } = summaryData;

    document.getElementById('summarySessionTitle').textContent = sessionTitle;
    document.getElementById('summaryTotalTime').textContent = formatTime(totalSeconds);
    document.getElementById('summaryXp').textContent = `+${statsRecorded ? statsRecorded.earnedXP : 0} XP`;

    const avgEl = document.getElementById('summaryAvgHr');
    const maxEl = document.getElementById('summaryMaxHr');
    if (hrStats && hrStats.avg) {
      avgEl.textContent = `${hrStats.avg} BPM`;
      maxEl.textContent = `${hrStats.max} BPM`;
    } else {
      avgEl.textContent = '—';
      maxEl.textContent = '—';
    }

    this.updateMiniRank();
    this.openModal('summaryModal');
  }

  downloadCurrentSessionTCX() {
    if (!this.lastCompletedSessionData) return;
    const { sessionTitle, startTime, totalSeconds, steps, samples } = this.lastCompletedSessionData;
    exportToTCX({
      title: sessionTitle,
      startTime: startTime || Date.now(),
      totalSeconds,
      steps,
      heartRateSamples: samples || []
    });
  }

  // Modales
  openModal(id) {
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.replace('hidden', 'flex');
    ['preWorkoutModal', 'resumeModal', 'customModal', 'statsModal', 'exitModal', 'summaryModal'].forEach(m => {
      const el = document.getElementById(m);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
  }

  closeModals() {
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.replace('flex', 'hidden');
  }

  // ==============================================================================
  // INDICADOR DE SEGUIMIENTO EN CABECERA
  // ==============================================================================

  updateTrackingHeader() {
    const pill = document.getElementById('headerTrackerPill');
    if (pill) {
      const prog = trainingTracker.getCurrentProgress();
      pill.textContent = `${prog.currentWeek}`;
      const btn = document.getElementById('btnHeaderTracker');
      if (btn) {
        btn.title = `Semana ${prog.currentWeek} de ${prog.totalWeeks} · ${prog.matchedPhase.name}`;
      }
    }
  }

  renderTrainingTrackerWidget() {
    this.updateTrackingHeader();
  }

  // ==============================================================================
  // MODAL DE SEGUIMIENTO Y ESTADÍSTICAS
  // ==============================================================================

  showStatsModal(initialTab = 'tracking') {
    this.activeStatsTab = initialTab;
    this.switchStatsTab(initialTab);
    this.openModal('statsModal');
  }

  switchStatsTab(tabName) {
    this.activeStatsTab = tabName;
    const trackingBtn = document.getElementById('modalTabTrackingBtn');
    const profileBtn = document.getElementById('modalTabProfileBtn');
    const trackingContent = document.getElementById('modalTabTrackingContent');
    const profileContent = document.getElementById('modalTabProfileContent');

    if (tabName === 'tracking') {
      if (trackingBtn) {
        trackingBtn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white shadow-sm flex items-center justify-center gap-1.5';
      }
      if (profileBtn) {
        profileBtn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white flex items-center justify-center gap-1.5';
      }
      if (trackingContent) trackingContent.classList.remove('hidden');
      if (profileContent) profileContent.classList.add('hidden');
      this.renderTrackingTab(this.selectedCalendarDate);
    } else {
      if (profileBtn) {
        profileBtn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white shadow-sm flex items-center justify-center gap-1.5';
      }
      if (trackingBtn) {
        trackingBtn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white flex items-center justify-center gap-1.5';
      }
      if (profileContent) profileContent.classList.remove('hidden');
      if (trackingContent) trackingContent.classList.add('hidden');
      this.renderProfileTab();
    }
  }

  renderTrackingTab(selectedDate = null) {
    const prog = trainingTracker.getCurrentProgress();
    const weekOverview = trainingTracker.getWeekOverview();

    // 1. Tarjeta: ¿En qué fase estoy?
    const phaseName = document.getElementById('modalTrackPhaseName');
    if (phaseName) phaseName.textContent = `${prog.matchedPhase.name} (${prog.matchedPhase.subtitle})`;

    const phaseSub = document.getElementById('modalTrackPhaseSub');
    if (phaseSub) phaseSub.textContent = `Semanas ${prog.matchedPhase.startWeek} a ${prog.matchedPhase.endWeek} · ${prog.matchedPhase.description}`;

    const phaseWeekIn = document.getElementById('modalTrackPhaseWeekIn');
    if (phaseWeekIn) phaseWeekIn.textContent = `Semana ${prog.weekInPhase} de ${prog.totalWeeksInPhase}`;

    const phasePct = document.getElementById('modalTrackPhasePct');
    if (phasePct) phasePct.textContent = `${prog.phaseProgressPct}%`;

    const phaseBar = document.getElementById('modalTrackPhaseBar');
    if (phaseBar) phaseBar.style.width = `${prog.phaseProgressPct}%`;

    // 2. Tarjeta: ¿Cuántas semanas llevo?
    const totalWeeksTitle = document.getElementById('modalTrackTotalWeeksTitle');
    if (totalWeeksTitle) totalWeeksTitle.textContent = `Semana ${prog.currentWeek} de ${prog.totalWeeks}`;

    const activeWeeksLabel = document.getElementById('modalTrackActiveWeeksLabel');
    if (activeWeeksLabel) {
      activeWeeksLabel.textContent = `${prog.totalActiveWeeks} ${prog.totalActiveWeeks === 1 ? 'semana registrada' : 'semanas registradas'} (${prog.totalWorkouts} sesiones totales)`;
    }

    const overallPct = document.getElementById('modalTrackOverallPct');
    if (overallPct) overallPct.textContent = `${prog.overallProgressPct}%`;

    const overallBar = document.getElementById('modalTrackOverallBar');
    if (overallBar) overallBar.style.width = `${prog.overallProgressPct}%`;

    // 3. Tarjeta: Esta Semana
    const thisWeekDays = document.getElementById('modalTrackThisWeekDays');
    if (thisWeekDays) thisWeekDays.textContent = `${weekOverview.completedDaysCount} / ${weekOverview.targetDaysCount} Sesiones`;

    const thisWeekMinutes = document.getElementById('modalTrackThisWeekMinutes');
    if (thisWeekMinutes) thisWeekMinutes.textContent = `${weekOverview.totalMinutesThisWeek} min pedaleados`;

    // 4. Lista de días de la semana actual
    const weekRangeLabel = document.getElementById('modalTrackWeekRange');
    if (weekRangeLabel) {
      const first = weekOverview.days[0].date;
      const last = weekOverview.days[6].date;
      weekRangeLabel.textContent = `${first.slice(5)} al ${last.slice(5)}`;
    }

    const weekDaysList = document.getElementById('modalTrackWeekDaysList');
    if (weekDaysList) {
      weekDaysList.innerHTML = '';
      weekOverview.days.forEach(day => {
        const row = document.createElement('div');
        row.className = `flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
          day.isCompleted 
            ? 'border-emerald-600/40 bg-emerald-950/20' 
            : (day.isToday ? 'border-blue-500/60 bg-blue-950/30' : 'border-slate-800 bg-slate-900/40')
        }`;

        let statusBadge = '';
        if (day.isCompleted) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 flex items-center gap-1"><i class="ti ti-check"></i> Hecho (${day.totalDuration} min)</span>`;
        } else if (day.isToday) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/80 text-blue-300 border border-blue-600/50">Toca Hoy</span>`;
        } else if (day.dayIndex === 6) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">Descanso</span>`;
        } else {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-500">Pendiente</span>`;
        }

        const sessionSummary = day.workouts.length > 0
          ? day.workouts.map(w => w.session).join(' + ')
          : day.expectedTitle;

        row.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-bold text-slate-300 w-14 shrink-0">${day.dayName}</span>
            <span class="text-[11px] text-slate-400 truncate">${sessionSummary}</span>
          </div>
          <div class="shrink-0 ml-2">${statusBadge}</div>
        `;
        weekDaysList.appendChild(row);
      });
    }

    // 5. Calendario y detalle del día seleccionado
    const dateToSelect = selectedDate || this.selectedCalendarDate || formatDateISO(new Date());
    this.renderCalendar(dateToSelect);
    this.renderDayDetail(dateToSelect);

    // 6. Historial de sesiones
    this.renderWorkoutHistory();

    // 7. Panel de personalización
    this.renderPlanCustomizationPanel();
  }

  renderProfileTab() {
    const stats = gamification.getStats();
    document.getElementById('statStreak').textContent = stats.streak || 0;
    document.getElementById('statTotalTime').textContent = `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`;
    const rank = gamification.calculateRank(stats.totalXP || 0);
    document.getElementById('rankTitle').textContent = rank.title;
    document.getElementById('currentXpText').textContent = `${stats.totalXP || 0} XP`;
    document.getElementById('nextRankXpText').textContent = rank.next === Infinity ? "MAX" : `${rank.next} XP`;
    document.getElementById('rankProgressBar').style.width = `${rank.progress}%`;
    document.getElementById('maxHrInput').value = gamification.getMaxHR();
    this.populateVoiceSelect();
  }

  selectCalendarDate(dateStr) {
    this.selectedCalendarDate = dateStr;
    this.renderCalendar(dateStr);
    this.renderDayDetail(dateStr);
  }

  renderCalendar(selectedDateStr = null) {
    const stats = gamification.getStats();
    const cal = document.getElementById('calendarGrid');
    if (!cal) return;
    cal.innerHTML = '';
    const t = new Date();
    const m = t.getMonth();
    const y = t.getFullYear();

    document.getElementById('calendarMonthLabel').textContent = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ][m] + ' ' + y;

    let fDay = new Date(y, m, 1).getDay() - 1;
    if (fDay === -1) fDay = 6;
    for (let i = 0; i < fDay; i++) {
      cal.innerHTML += `<div class="p-1 rounded bg-slate-800/30 h-8"></div>`;
    }

    const clr = { 'fase1': 'text-cyan-400', 'fase2': 'text-amber-400', 'fase3': 'text-rose-400', 'principiante': 'text-green-500', 'amateur': 'text-blue-500', 'elite': 'text-orange-500', 'pro': 'text-red-500' };
    const totalDays = new Date(y, m + 1, 0).getDate();

    for (let d = 1; d <= totalDays; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const ws = stats.workouts.filter(w => w.date === ds);
      const isSelected = (selectedDateStr === ds);
      const isToday = (t.getDate() === d && t.getMonth() === m && t.getFullYear() === y);

      let iconHtml = '';
      if (ws.length > 0) {
        const mainPhase = ws[0].phaseId || ws[0].level || 'fase1';
        const color = clr[mainPhase] || 'text-orange-400';
        iconHtml = `<i class="ti ti-flame text-sm ${color} mt-0.5 leading-none"></i>`;
      }

      let borderClasses = 'border-slate-800 bg-slate-800/80';
      if (isSelected) {
        borderClasses = 'border-blue-400 bg-blue-950/60 ring-1 ring-blue-400 shadow-md';
      } else if (isToday) {
        borderClasses = 'border-slate-500 bg-slate-700/60';
      }

      cal.innerHTML += `
        <button type="button" onclick="window.painCaveApp.selectCalendarDate('${ds}')" class="flex flex-col items-center justify-center p-1 rounded h-8 border ${borderClasses} hover:border-slate-400 transition-all cursor-pointer">
          <span class="text-[9px] ${isSelected ? 'text-white font-black' : (isToday ? 'text-blue-300 font-bold' : 'text-slate-400')} leading-none">${d}</span>
          ${iconHtml}
        </button>
      `;
    }
  }

  renderDayDetail(dateStr) {
    const box = document.getElementById('calendarDayDetailBox');
    if (!box) return;

    const dayName = trainingTracker.getDayName(dateStr);
    const workouts = trainingTracker.getWorkoutsForDate(dateStr);

    if (workouts.length === 0) {
      box.innerHTML = `
        <div class="flex items-center justify-between text-slate-400">
          <div>
            <span class="font-bold text-slate-300">${dayName}, ${dateStr}</span>
            <span class="block text-[11px] text-slate-500 mt-0.5">Día de descanso o sin entrenamientos registrados.</span>
          </div>
          <span class="text-[10px] uppercase font-mono px-2 py-0.5 bg-slate-900 rounded border border-slate-700 text-slate-400">Sin sesión</span>
        </div>
      `;
      return;
    }

    let itemsHtml = '';
    workouts.forEach(w => {
      const phaseBadge = w.phaseName || (w.phaseId ? w.phaseId.toUpperCase() : (w.level || 'Fase 1'));
      const hrText = w.avgBpm ? ` · <i class="ti ti-heart text-rose-400"></i> ${w.avgBpm} BPM prom` : '';
      const xpText = w.earnedXP ? `<span class="text-orange-400 font-bold font-mono">+${w.earnedXP} XP</span>` : '';

      itemsHtml += `
        <div class="p-2 rounded bg-slate-900 border border-slate-700/60 last:mb-0 mb-1.5">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-white text-xs truncate mr-2">${w.session || 'Sesión de Ciclismo'}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-800 shrink-0">${phaseBadge}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>⏱️ ${w.durationMinutes || 0} min${hrText}</span>
            ${xpText}
          </div>
        </div>
      `;
    });

    box.innerHTML = `
      <div class="mb-1.5 flex items-center justify-between">
        <span class="font-bold text-white text-xs flex items-center gap-1.5">
          <i class="ti ti-calendar text-blue-400"></i> ${dayName}, ${dateStr}
        </span>
        <span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600/40">
          ${workouts.length} ${workouts.length === 1 ? 'Sesión completada' : 'Sesiones completadas'}
        </span>
      </div>
      <div class="space-y-1">${itemsHtml}</div>
    `;
  }

  renderWorkoutHistory() {
    const stats = gamification.getStats();
    const container = document.getElementById('workoutHistoryContainer');
    const badge = document.getElementById('modalTrackTotalHistoryBadge');
    if (!container) return;

    const workouts = stats.workouts || [];
    if (badge) badge.textContent = `${workouts.length} sesiones`;

    if (workouts.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-slate-500 text-xs">
          <i class="ti ti-bike text-2xl mb-1 block opacity-50"></i>
          Aún no has registrado entrenamientos. ¡Inicia hoy tu primera sesión!
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    // Mostrar en orden cronológico inverso
    const reversed = [...workouts].reverse();
    reversed.forEach(w => {
      const item = document.createElement('div');
      item.className = 'p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs';
      
      const dayName = w.dayName || trainingTracker.getDayName(w.date);
      const phaseLabel = w.phaseName || (w.phaseId ? w.phaseId.toUpperCase() : (w.level || ''));
      const weekLabel = w.weekNumber ? `S${w.weekNumber}` : '';
      const hrText = w.avgBpm ? ` · ${w.avgBpm} bpm` : '';

      item.innerHTML = `
        <div class="min-w-0 mr-2">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="font-bold text-white truncate">${w.session}</span>
            ${weekLabel ? `<span class="text-[9px] font-bold px-1 rounded bg-slate-700 text-slate-300 font-mono">${weekLabel}</span>` : ''}
          </div>
          <div class="text-[10px] text-slate-400">
            ${dayName} ${w.date} · ${phaseLabel}
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="font-mono font-bold text-slate-200 block">${w.durationMinutes || 0} min${hrText}</span>
          <span class="text-[10px] font-mono text-orange-400">+${w.earnedXP || 0} XP</span>
        </div>
      `;
      container.appendChild(item);
    });
  }

  renderPlanCustomizationPanel() {
    const prog = trainingTracker.getCurrentProgress();
    const phases = trainingTracker.getPhasesWithRanges();

    // Input de semana activa
    const weekInput = document.getElementById('configWeekInput');
    if (weekInput) {
      weekInput.value = prog.currentWeek;
      weekInput.max = prog.totalWeeks;
    }

    // Select de fase activa
    const phaseSelect = document.getElementById('configPhaseSelect');
    if (phaseSelect) {
      phaseSelect.innerHTML = '';
      phases.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.subtitle}) · S${p.startWeek}-${p.endWeek}`;
        if (p.id === prog.matchedPhase.id) opt.selected = true;
        phaseSelect.appendChild(opt);
      });
    }

    // Lista de fases configuradas
    const phasesList = document.getElementById('configPhasesList');
    if (phasesList) {
      phasesList.innerHTML = '';
      phases.forEach(phase => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-2 rounded bg-slate-800 border border-slate-700/60 text-xs';
        row.innerHTML = `
          <div class="min-w-0 mr-2">
            <span class="font-bold text-white">${phase.name}</span>
            <span class="text-slate-400 text-[11px] block truncate">${phase.subtitle} · ${phase.weeks} sem (S${phase.startWeek}-${phase.endWeek})</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="window.painCaveApp.promptEditPhase('${phase.id}')" class="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-700" title="Editar duración de semanas">
              <i class="ti ti-edit text-xs"></i>
            </button>
            ${phases.length > 1 ? `
              <button onclick="window.painCaveApp.deletePhase('${phase.id}')" class="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700" title="Eliminar fase">
                <i class="ti ti-trash text-xs"></i>
              </button>
            ` : ''}
          </div>
        `;
        phasesList.appendChild(row);
      });
    }
  }

  resetDisplay() {
    document.getElementById('sessionLabel').textContent = 'PAIN CAVE';
    document.getElementById('timerDisplay').textContent = '00:00';
    document.getElementById('globalTime').textContent = '00:00 / 00:00';
    document.getElementById('globalProgress').style.width = '0%';
    document.getElementById('exPhase').textContent = 'LISTO';
    document.getElementById('exName').textContent = 'Selecciona una rutina';
    document.getElementById('exPostureBadge').classList.add('hidden');

    document.getElementById('cadenceVal').textContent = '—';
    document.getElementById('cadenceUnit').textContent = 'RPM';
    const pacerDot = document.getElementById('cadencePacerDot');
    if (pacerDot) pacerDot.classList.add('hidden');

    document.getElementById('zoneVal').textContent = '—';
    document.getElementById('zoneBpmTarget').textContent = 'BPM';
    document.getElementById('rpeVal').textContent = '—';
    document.getElementById('rpeFill').style.width = '0%';

    document.getElementById('nextName').textContent = '—';
    document.getElementById('nextMeta').textContent = '';
    document.getElementById('stepCounter').textContent = '— / —';
    document.getElementById('stepDots').innerHTML = '';

    const ring = document.getElementById('timerRing');
    if (ring) ring.style.strokeDashoffset = this.CIRC;
    this.updateInterfaceColors(null, 0, false);

    this.setRideMode(false);
  }
}

export const ui = new UIManager();
