/**
 * Manejador de la Interfaz de Usuario (UI) y Visualización
 * Minimalista, directo al grano y enfocado en la experiencia deportiva
 */

import { gamification } from './gamification.js';
import { getZoneBpmRange, ROUTINES_POOL } from './workouts.js';
import { exportToTCX } from './exporter.js';
import { soundEngine } from './audio.js';
import { trainingTracker, formatDateISO, getCycleDayForDate, ROTATING_CYCLE_DAYS } from './trainingTracker.js';

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
    this.currentStep = null;
    this.lastCompletedSessionData = null;
    this.selectedCalendarDate = formatDateISO(new Date());
    this.calendarViewDate = new Date();
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
        tab.className = 'level-tab px-2.5 py-1 rounded-md text-xs font-bold transition-all bg-[#FC5200] text-white shadow-sm';
      } else {
        tab.className = 'level-tab px-2.5 py-1 rounded-md text-xs font-bold transition-all text-zinc-400 hover:text-white';
      }
    });
  }

  setRideMode(isRunning, isPaused = false) {
    const catalog = document.getElementById('catalogSection');
    const profile = document.getElementById('workoutProfileContainer');
    const controls = document.getElementById('inRideControls');
    const pauseBtn = document.getElementById('btnMainPause');
    const pauseBadge = document.getElementById('timerPauseBadge');

    if (isRunning) {
      if (catalog) catalog.classList.add('hidden');
      if (profile) profile.classList.remove('hidden');
      if (controls) controls.classList.remove('hidden');
      if (pauseBadge) {
        if (isPaused) {
          pauseBadge.classList.remove('hidden');
        } else {
          pauseBadge.classList.add('hidden');
        }
      }
      if (pauseBtn) {
        pauseBtn.innerHTML = isPaused ? '<i class="ti ti-player-play text-lg"></i> REANUDAR' : '<i class="ti ti-player-pause text-lg"></i> PAUSAR';
        pauseBtn.className = isPaused 
          ? 'flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md'
          : 'flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-[#FC5200] hover:bg-[#E04800] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md';
      }
    } else {
      if (catalog) catalog.classList.remove('hidden');
      if (profile) profile.classList.add('hidden');
      if (controls) controls.classList.add('hidden');
      if (pauseBadge) pauseBadge.classList.add('hidden');
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
    let color = '#FC5200';
    const card = document.getElementById('mainCard');
    const bpmDeltaIcon = document.getElementById('bpmDeltaIcon');
    const bpmLabel = document.getElementById('bpmLabel');

    if (card) {
      card.className = "bg-[#1E1E1E] border border-[#2D2D2D] rounded-2xl p-4 shadow-xl transition-all duration-500 relative";
    }

    if (isHRMConnected && currentBpm) {
      const maxHr = gamification.getMaxHR();
      const pct = (currentBpm / maxHr) * 100;
      if (pct < 60) {
        color = '#71717A';
        if (card) card.classList.add('border-zinc-700');
      } else if (pct < 71) {
        color = '#10B981';
        if (card) card.classList.add('bg-emerald-950/20', 'border-emerald-500/40');
      } else if (pct < 81) {
        color = '#EAB308';
        if (card) card.classList.add('bg-yellow-950/20', 'border-yellow-500/40');
      } else if (pct < 91) {
        color = '#FC5200';
        if (card) card.classList.add('bg-[#FC5200]/10', 'border-[#FC5200]/50');
      } else {
        color = '#EF4444';
        if (card) card.classList.add('bg-rose-950/20', 'border-rose-500/50');
      }

      // Indicador periférico de zona objetivo en el manillar
      if (this.currentStep && this.currentStep.zone) {
        const zone = this.currentStep.zone;
        let minBpm = 0, maxBpm = 999;
        if (zone === 'SS' || zone === 'ss') {
          minBpm = Math.round(maxHr * 0.83);
          maxBpm = Math.round(maxHr * 0.88);
        } else {
          const zNum = parseInt(zone, 10);
          if (zNum === 1) { minBpm = 0; maxBpm = Math.round(maxHr * 0.60) - 1; }
          else if (zNum === 2) { minBpm = Math.round(maxHr * 0.60); maxBpm = Math.round(maxHr * 0.74); }
          else if (zNum === 3) { minBpm = Math.round(maxHr * 0.75); maxBpm = Math.round(maxHr * 0.85); }
          else if (zNum === 4) { minBpm = Math.round(maxHr * 0.85); maxBpm = Math.round(maxHr * 0.94); }
          else if (zNum === 5) { minBpm = Math.round(maxHr * 0.94); maxBpm = maxHr; }
        }

        if (bpmDeltaIcon && bpmLabel) {
          if (currentBpm < minBpm) {
            bpmDeltaIcon.textContent = '↑';
            bpmDeltaIcon.className = 'text-xs font-bold font-mono text-amber-400';
            bpmLabel.textContent = 'Sube el ritmo';
          } else if (currentBpm > maxBpm) {
            bpmDeltaIcon.textContent = '↓';
            bpmDeltaIcon.className = 'text-xs font-bold font-mono text-rose-400';
            bpmLabel.textContent = 'Baja el ritmo';
          } else {
            bpmDeltaIcon.textContent = '✓';
            bpmDeltaIcon.className = 'text-xs font-bold font-mono text-emerald-400';
            bpmLabel.textContent = 'En zona';
          }
        }
      } else if (bpmDeltaIcon && bpmLabel) {
        bpmDeltaIcon.textContent = '';
        bpmLabel.textContent = 'Pulsómetro BLE';
      }
    } else {
      if (bpmDeltaIcon) bpmDeltaIcon.textContent = '';
      if (bpmLabel) bpmLabel.textContent = 'Pulsómetro BLE';

      const rpe = fallbackRpe !== null && fallbackRpe !== undefined ? fallbackRpe : 4;
      if (card) {
        if (rpe <= 4) {
          color = '#10B981';
          card.classList.add('border-[#2D2D2D]');
        } else if (rpe <= 6.5) {
          color = '#EAB308';
          card.classList.add('border-yellow-600/30');
        } else if (rpe <= 8.5) {
          color = '#FC5200';
          card.classList.add('bg-[#FC5200]/10', 'border-[#FC5200]/40');
        } else {
          color = '#EF4444';
          card.classList.add('bg-rose-950/20', 'border-rose-500/50');
        }
      }
    }

    const ring = document.getElementById('timerRing');
    if (ring) ring.style.stroke = color;
  }

  // Renderiza el paso activo en la pantalla principal
  renderStep({ step, stepIndex, totalSteps, nextStep }, isHRMConnected, currentBpm) {
    this.currentStep = step;
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
      postBadge.className = 'flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-extrabold bg-[#252525] text-zinc-200 border border-[#333333]';
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
      1: '#3b82f6',         // Azul (Z1)
      2: '#10b981',         // Verde (Z2)
      3: '#eab308',         // Amarillo (Z3)
      'SS': '#F59E0B',      // Ámbar/Naranja dorado (Sweet Spot)
      'ss': '#F59E0B',
      4: '#f97316',         // Naranja (Z4)
      5: '#ef4444'          // Rojo (Z5)
    };

    steps.forEach((st, idx) => {
      const widthPct = (st.t / totalDuration) * 100;
      const rpeVal = st.rpe || (st.zone === 'SS' ? 7.8 : (st.zone ? st.zone * 2 : 5));
      const heightPct = Math.max(30, Math.min(100, (rpeVal / 10) * 100));
      const color = zoneColors[st.zone] || zoneColors[st.zone || 2] || '#F59E0B';

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
      if (!inner || !inner.classList) return;
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
      s.className = 'text-[10px] text-zinc-500 font-bold ml-0.5';
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
          ? 'w-[6px] h-[6px] bg-[#10b981]'
          : (i === currentStep ? 'w-[9px] h-[9px] bg-[#FC5200] shadow-[0_0_6px_#FC5200]' : 'w-[6px] h-[6px] bg-[#333333]')
      );
    }
  }

  // Render del Pool de Rutinas (Limpio y directo)
  updateMicrocycleBanner() {
    // No-op: banner removido para evitar redundancia (KISS)
  }

  renderRoutinesPool(selectedLevel = 'fase1', activeCategory = 'todos') {
    const container = document.getElementById('routinesPoolGrid');
    if (!container) return;

    container.innerHTML = '';

    const weekOverview = trainingTracker.getWeekOverview();
    const todayCycle = weekOverview.todayCycle;
    const tomorrowCycle = weekOverview.tomorrowCycle;

    // Resaltar en píldoras de filtro el día actual del microciclo
    const dotFondo = document.getElementById('pillDotFondo');
    const dotCalidad = document.getElementById('pillDotCalidad');
    const dotRecuperacion = document.getElementById('pillDotRecuperacion');
    if (dotFondo) dotFondo.classList.toggle('hidden', todayCycle?.cycleDay !== 1);
    if (dotCalidad) dotCalidad.classList.toggle('hidden', todayCycle?.cycleDay !== 2);
    if (dotRecuperacion) dotRecuperacion.classList.toggle('hidden', todayCycle?.cycleDay !== 3);

    const filtered = ROUTINES_POOL.filter(r => {
      return activeCategory === 'todos' || r.category === activeCategory;
    });

    filtered.forEach(routine => {
      const steps = routine.levels[selectedLevel] || routine.levels.fase1 || Object.values(routine.levels)[0];
      const totalSec = steps.reduce((a, s) => a + s.t, 0);
      const minutes = Math.round(totalSec / 60);
      const miniSvg = generateMiniProfileSvg(steps);

      const isTodayRoutine = (todayCycle && todayCycle.routineId === routine.id);
      const isTomorrowRoutine = (tomorrowCycle && tomorrowCycle.routineId === routine.id);

      let badgeHtml = '';
      if (isTodayRoutine) {
        badgeHtml = `<span class="text-[9px] uppercase font-bold text-[#FC5200] bg-[#FC5200]/15 px-1.5 py-0.5 rounded border border-[#FC5200]/30 flex items-center gap-1"><i class="ti ti-target"></i> Hoy</span>`;
      } else if (isTomorrowRoutine) {
        badgeHtml = `<span class="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1"><i class="ti ti-clock"></i> Mañana</span>`;
      }

      const card = document.createElement('button');
      card.className = `p-2.5 sm:p-3 rounded-xl border ${isTodayRoutine ? 'border-[#FC5200]/70 bg-[#1E1E1E] ring-1 ring-[#FC5200]/40' : (isTomorrowRoutine ? 'border-amber-500/50 bg-[#1E1E1E]' : 'border-[#2D2D2D] bg-[#1E1E1E]')} hover:border-[#FC5200]/50 hover:bg-[#252525] text-left transition-all active:scale-[0.98] group flex flex-col justify-between shadow-sm`;
      card.onclick = () => window.painCaveApp.openPreWorkoutModal(routine.id);

      card.innerHTML = `
        <div class="w-full">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs sm:text-sm font-black text-white group-hover:text-[#FC5200] transition-colors truncate mr-1.5">
              ${routine.title}
            </span>
            <div class="flex items-center gap-1 shrink-0">
              ${badgeHtml}
              <span class="text-[10px] sm:text-[11px] font-mono font-bold text-zinc-300 bg-[#252525] px-1.5 py-0.5 rounded border border-[#333333]">
                ${minutes}m
              </span>
            </div>
          </div>
          <div class="text-[11px] text-zinc-400 mb-2 truncate">
            ${routine.subtitle}
          </div>
        </div>
        <div class="w-full pt-1.5 border-t border-[#2D2D2D] flex items-center justify-between">
          ${miniSvg}
          <span class="text-[#FC5200] text-xs font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            Iniciar <i class="ti ti-chevron-right text-xs"></i>
          </span>
        </div>
      `;
      container.appendChild(card);
    });

    // Tarjeta informativa de Día 4 (Descanso total) si estamos viendo ciclo completo o descanso
    if (activeCategory === 'todos' || activeCategory === 'descanso') {
      const isTodayRest = (todayCycle && todayCycle.isRest);
      const isTomorrowRest = (tomorrowCycle && tomorrowCycle.isRest);

      let restBadge = '';
      if (isTodayRest) {
        restBadge = `<span class="text-[9px] uppercase font-bold text-[#FC5200] bg-[#FC5200]/15 px-1.5 py-0.5 rounded border border-[#FC5200]/30">Hoy</span>`;
      } else if (isTomorrowRest) {
        restBadge = `<span class="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">Mañana</span>`;
      } else {
        restBadge = `<span class="text-[9px] uppercase font-mono font-bold text-zinc-400 bg-[#252525] px-1.5 py-0.5 rounded border border-[#333333]">Relax</span>`;
      }

      const restCard = document.createElement('div');
      restCard.className = `p-2.5 sm:p-3 rounded-xl border ${isTodayRest ? 'border-[#FC5200]/70 bg-[#1E1E1E] ring-1 ring-[#FC5200]/40' : 'border-[#2D2D2D] bg-[#1E1E1E]'} text-left flex flex-col justify-between opacity-85 shadow-sm`;
      restCard.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs sm:text-sm font-black text-zinc-300 flex items-center gap-1.5">
            <i class="ti ti-moon text-[#FC5200]"></i> Día 4 · Descanso Total
          </span>
          ${restBadge}
        </div>
        <div class="text-[11px] text-zinc-400">
          Asimilación y descanso muscular completo.
        </div>
      `;
      container.appendChild(restCard);
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
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
    }
    ['preWorkoutModal', 'resumeModal', 'customModal', 'statsModal', 'exitModal', 'summaryModal'].forEach(m => {
      const el = document.getElementById(m);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
  }

  closeModals() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
      overlay.classList.remove('flex');
      overlay.classList.add('hidden');
    }
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
    this.openModal('statsModal');
    this.switchStatsTab(initialTab);
  }

  switchStatsTab(tabName) {
    this.activeStatsTab = tabName;
    const trackingBtn = document.getElementById('modalTabTrackingBtn');
    const profileBtn = document.getElementById('modalTabProfileBtn');
    const trackingContent = document.getElementById('modalTabTrackingContent');
    const profileContent = document.getElementById('modalTabProfileContent');

    if (tabName === 'tracking') {
      if (trackingBtn) {
        trackingBtn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all bg-[#FC5200] text-white shadow-sm flex items-center justify-center gap-1.5';
      }
      if (profileBtn) {
        profileBtn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-zinc-400 hover:text-white flex items-center justify-center gap-1.5';
      }
      if (trackingContent) trackingContent.classList.remove('hidden');
      if (profileContent) profileContent.classList.add('hidden');
      this.renderTrackingTab(this.selectedCalendarDate);
    } else {
      if (profileBtn) {
        profileBtn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all bg-[#FC5200] text-white shadow-sm flex items-center justify-center gap-1.5';
      }
      if (trackingBtn) {
        trackingBtn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-zinc-400 hover:text-white flex items-center justify-center gap-1.5';
      }
      if (profileContent) profileContent.classList.remove('hidden');
      if (trackingContent) trackingContent.classList.add('hidden');
      this.renderProfileTab();
    }
  }

  renderTrackingTab(selectedDate = null) {
    const prog = trainingTracker.getCurrentProgress();
    const weekOverview = trainingTracker.getWeekOverview();

    // 1. Resumen compacto del plan
    const phaseName = document.getElementById('modalTrackPhaseName');
    if (phaseName) phaseName.textContent = `${prog.matchedPhase.name} (${prog.matchedPhase.subtitle})`;

    const phaseSub = document.getElementById('modalTrackPhaseSub');
    if (phaseSub) phaseSub.textContent = `Semana ${prog.weekInPhase} de ${prog.totalWeeksInPhase} · Semanas ${prog.matchedPhase.startWeek}-${prog.matchedPhase.endWeek}`;

    const totalWeeksTitle = document.getElementById('modalTrackTotalWeeksTitle');
    if (totalWeeksTitle) totalWeeksTitle.textContent = `Semana ${prog.currentWeek} de ${prog.totalWeeks}`;

    const overallPct = document.getElementById('modalTrackOverallPct');
    if (overallPct) overallPct.textContent = `${prog.overallProgressPct}%`;

    const overallBar = document.getElementById('modalTrackOverallBar');
    if (overallBar) overallBar.style.width = `${prog.overallProgressPct}%`;

    const thisWeekDays = document.getElementById('modalTrackThisWeekDays');
    if (thisWeekDays) thisWeekDays.textContent = `${weekOverview.completedDaysCount} Sesiones`;

    const thisWeekMinutes = document.getElementById('modalTrackThisWeekMinutes');
    if (thisWeekMinutes) thisWeekMinutes.textContent = `${weekOverview.totalMinutesThisWeek} min`;

    const totalHistoryBadge = document.getElementById('modalTrackTotalHistoryBadge');
    if (totalHistoryBadge) totalHistoryBadge.textContent = `${prog.totalWorkouts} sesiones`;

    // 2. Píldoras del Ciclo Rotativo (4 Días)
    const cycleContainer = document.getElementById('modalCyclePillsContainer');
    if (cycleContainer) {
      cycleContainer.innerHTML = '';
      const todayCycleDay = weekOverview.todayCycle?.cycleDay || 1;
      const tomorrowCycleDay = weekOverview.tomorrowCycle?.cycleDay || 2;

      ROTATING_CYCLE_DAYS.forEach(d => {
        const isToday = (d.cycleDay === todayCycleDay);
        const isTomorrow = (d.cycleDay === tomorrowCycleDay);

        let borderClass = 'border-[#333333] bg-[#1E1E1E]';
        let badgeHtml = '';
        if (isToday) {
          borderClass = 'border-[#FC5200]/70 bg-[#FC5200]/10 ring-1 ring-[#FC5200]/40';
          badgeHtml = `<span class="text-[8px] font-black uppercase text-[#FC5200] bg-[#FC5200]/20 px-1 rounded">Hoy</span>`;
        } else if (isTomorrow) {
          borderClass = 'border-amber-500/50 bg-amber-500/10';
          badgeHtml = `<span class="text-[8px] font-black uppercase text-amber-400 bg-amber-500/20 px-1 rounded">Mañana</span>`;
        }

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `p-2 rounded-lg border ${borderClass} hover:border-zinc-500 transition-all text-left flex flex-col justify-between cursor-pointer active:scale-95`;
        pill.title = 'Toca para alinear este día como HOY en el ciclo';
        pill.onclick = () => window.painCaveApp.alignCycleDay(d.cycleDay);

        pill.innerHTML = `
          <div class="flex items-center justify-between mb-1">
            <span class="text-[9px] font-bold text-zinc-400 uppercase font-mono">Día ${d.cycleDay}</span>
            ${badgeHtml}
          </div>
          <div class="text-[11px] font-bold ${isToday ? 'text-white' : 'text-zinc-300'} truncate">
            ${d.shortName.replace(/Día \d+: /, '')}
          </div>
        `;
        cycleContainer.appendChild(pill);
      });
    }

    // 3. Calendario y detalle del día seleccionado
    const dateToSelect = selectedDate || this.selectedCalendarDate || formatDateISO(new Date());
    this.renderCalendar(dateToSelect);
    this.renderDayDetail(dateToSelect);
  }

  renderProfileTab() {
    try {
      const stats = gamification.getStats() || {};
      const streakEl = document.getElementById('statStreak');
      if (streakEl) streakEl.textContent = stats.streak || 0;

      const totalMins = stats.totalMinutes || 0;
      const totalTimeEl = document.getElementById('statTotalTime');
      if (totalTimeEl) totalTimeEl.textContent = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;

      const rank = gamification.calculateRank(stats.totalXP || 0);
      const rankTitleEl = document.getElementById('rankTitle');
      if (rankTitleEl) rankTitleEl.textContent = rank.title;

      const currentXpEl = document.getElementById('currentXpText');
      if (currentXpEl) currentXpEl.textContent = `${stats.totalXP || 0} XP`;

      const nextRankEl = document.getElementById('nextRankXpText');
      if (nextRankEl) nextRankEl.textContent = rank.next === Infinity ? "MAX" : `${rank.next} XP`;

      const progressBar = document.getElementById('rankProgressBar');
      if (progressBar) progressBar.style.width = `${rank.progress}%`;

      const hr = gamification.getMaxHR();
      const maxHrInput = document.getElementById('maxHrInput');
      if (maxHrInput) maxHrInput.value = hr;

      this.updateProfileZonesDisplay(hr);
      this.populateVoiceSelect();
    } catch (err) {
      console.error('Error rendering profile tab:', err);
    }
  }

  updateProfileZonesDisplay(maxHr = null) {
    const hr = maxHr || gamification.getMaxHR();
    const container = document.getElementById('profileZonesGrid');
    if (!container) return;
    container.innerHTML = `
      <div class="text-zinc-300">Z1 (&lt; 60%): &lt; ${Math.round(hr * 0.60)} BPM</div>
      <div class="text-emerald-400">Z2 (60-74%): ${Math.round(hr * 0.60)}-${Math.round(hr * 0.74)} BPM</div>
      <div class="text-yellow-400">Z3 (75-85%): ${Math.round(hr * 0.75)}-${Math.round(hr * 0.85)} BPM</div>
      <div class="text-[#FC5200] font-bold">SS (83-88%): ${Math.round(hr * 0.83)}-${Math.round(hr * 0.88)} BPM</div>
      <div class="text-orange-400">Z4 (85-94%): ${Math.round(hr * 0.85)}-${Math.round(hr * 0.94)} BPM</div>
      <div class="text-rose-400 font-bold">Z5 (94-100%): ${Math.round(hr * 0.94)}-${hr} BPM</div>
    `;
  }

  populateVoiceSelect() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    const voices = soundEngine.getSpanishVoices();
    const current = soundEngine.getCurrentVoiceId();

    select.innerHTML = '<option value="system">Voz natural del sistema (Por defecto)</option>';
    if (voices && Array.isArray(voices)) {
      voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI || v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        select.appendChild(opt);
      });
    }
    if (current) select.value = current;
  }

  changeCalendarMonth(offset) {
    if (!this.calendarViewDate) {
      this.calendarViewDate = new Date();
    }
    this.calendarViewDate.setDate(1);
    this.calendarViewDate.setMonth(this.calendarViewDate.getMonth() + offset);
    this.renderCalendar(this.selectedCalendarDate);
  }

  selectCalendarDate(dateStr) {
    this.selectedCalendarDate = dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      this.calendarViewDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }
    this.renderCalendar(dateStr);
    this.renderDayDetail(dateStr);
  }

  renderCalendar(selectedDateStr = null) {
    const stats = gamification.getStats();
    const cal = document.getElementById('calendarGrid');
    if (!cal) return;
    cal.innerHTML = '';
    const now = new Date();
    const viewDate = this.calendarViewDate || now;
    const m = viewDate.getMonth();
    const y = viewDate.getFullYear();

    const monthLabel = document.getElementById('calendarMonthLabel');
    if (monthLabel) {
      monthLabel.textContent = [
        'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
      ][m] + ' ' + y;
    }

    let fDay = new Date(y, m, 1).getDay() - 1;
    if (fDay === -1) fDay = 6;
    for (let i = 0; i < fDay; i++) {
      cal.innerHTML += `<div class="p-1 rounded bg-[#181818] h-9 sm:h-10 border border-transparent"></div>`;
    }

    const clr = { 'fase1': 'text-cyan-400', 'fase2': 'text-amber-400', 'fase3': 'text-rose-400', 'principiante': 'text-emerald-400', 'amateur': 'text-[#FC5200]', 'elite': 'text-orange-500', 'pro': 'text-rose-500' };
    const totalDays = new Date(y, m + 1, 0).getDate();

    for (let d = 1; d <= totalDays; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const ws = stats.workouts.filter(w => w.date === ds);
      const isSelected = (selectedDateStr === ds);
      const isToday = (now.getDate() === d && now.getMonth() === m && now.getFullYear() === y);

      let iconHtml = '';
      if (ws.length > 0) {
        const mainPhase = ws[0].phaseId || ws[0].level || 'fase1';
        const color = clr[mainPhase] || 'text-[#FC5200]';
        iconHtml = `<i class="ti ti-flame text-sm ${color} mt-0.5 leading-none"></i>`;
      }

      let borderClasses = 'border-[#2D2D2D] bg-[#1E1E1E]';
      if (isSelected) {
        borderClasses = 'border-[#FC5200] bg-[#FC5200]/20 ring-1 ring-[#FC5200] shadow-md';
      } else if (isToday) {
        borderClasses = 'border-zinc-500 bg-[#252525]';
      }

      cal.innerHTML += `
        <button type="button" onclick="window.painCaveApp.selectCalendarDate('${ds}')" class="flex flex-col items-center justify-center p-1 rounded h-9 sm:h-10 border ${borderClasses} hover:border-[#FC5200]/50 transition-all cursor-pointer">
          <span class="text-[9px] sm:text-[10px] ${isSelected ? 'text-white font-black' : (isToday ? 'text-[#FC5200] font-bold' : 'text-zinc-400')} leading-none">${d}</span>
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
      const anchorDate = trainingTracker.plan.cycleAnchorDate || '2026-10-29';
      const anchorDay = trainingTracker.plan.cycleAnchorDay || 1;
      const cycleDay = getCycleDayForDate(dateStr, anchorDate, anchorDay);
      const isRest = cycleDay.isRest;

      box.innerHTML = `
        <div class="flex items-center justify-between text-zinc-400">
          <div>
            <span class="font-bold text-white">${dayName}, ${dateStr}</span>
            <span class="block text-[11px] ${isRest ? 'text-zinc-400' : 'text-[#FC5200] font-semibold'} mt-0.5">
              ${isRest ? '🛌 Programado: Descanso Total (Asimilación)' : `🚴 Programado: ${cycleDay.name}`}
            </span>
          </div>
          <span class="text-[10px] uppercase font-mono px-2 py-0.5 bg-[#252525] rounded border border-[#333333] ${isRest ? 'text-zinc-400' : 'text-[#FC5200] font-bold'}">
            ${cycleDay.shortName}
          </span>
        </div>
      `;
      return;
    }

    let itemsHtml = '';
    workouts.forEach(w => {
      const phaseBadge = w.phaseName || (w.phaseId ? w.phaseId.toUpperCase() : (w.level || 'Fase 1'));
      const hrText = w.avgBpm ? ` · <i class="ti ti-heart text-rose-400"></i> ${w.avgBpm} BPM prom` : '';
      const xpText = w.earnedXP ? `<span class="text-[#FC5200] font-bold font-mono">+${w.earnedXP} XP</span>` : '';

      itemsHtml += `
        <div class="p-2 rounded bg-[#181818] border border-[#2D2D2D] last:mb-0 mb-1.5">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-white text-xs truncate mr-2">${w.session || 'Sesión de Ciclismo'}</span>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FC5200]/15 text-[#FC5200] border border-[#FC5200]/30 shrink-0">${phaseBadge}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span>⏱️ ${w.durationMinutes || 0} min${hrText}</span>
            ${xpText}
          </div>
        </div>
      `;
    });

    box.innerHTML = `
      <div class="mb-1.5 flex items-center justify-between">
        <span class="font-bold text-white text-xs flex items-center gap-1.5">
          <i class="ti ti-calendar text-[#FC5200]"></i> ${dayName}, ${dateStr}
        </span>
        <span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600/40">
          ${workouts.length} ${workouts.length === 1 ? 'Sesión completada' : 'Sesiones completadas'}
        </span>
      </div>
      <div class="space-y-1">${itemsHtml}</div>
    `;
  }

  renderWorkoutHistory() {
    // Lista de historial eliminada para simplificar UX; el calendario navegable muestra el detalle con 1 toque.
  }

  resetDisplay() {
    this.currentStep = null;
    document.getElementById('sessionLabel').textContent = 'PAIN CAVE';
    document.getElementById('timerDisplay').textContent = '00:00';
    document.getElementById('globalTime').textContent = '00:00 / 00:00';
    document.getElementById('globalProgress').style.width = '0%';
    document.getElementById('exPhase').textContent = 'LISTO';
    document.getElementById('exName').textContent = 'Selecciona una rutina';
    document.getElementById('exPostureBadge').classList.add('hidden');

    const pauseBadge = document.getElementById('timerPauseBadge');
    if (pauseBadge) pauseBadge.classList.add('hidden');

    const bpmDeltaIcon = document.getElementById('bpmDeltaIcon');
    if (bpmDeltaIcon) bpmDeltaIcon.textContent = '';
    const bpmLabel = document.getElementById('bpmLabel');
    if (bpmLabel) bpmLabel.textContent = 'Pulsómetro BLE';

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
