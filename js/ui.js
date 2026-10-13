/**
 * Manejador de la Interfaz de Usuario (UI) y Visualización
 * Minimalista, directo al grano y enfocado en la experiencia deportiva
 */

import { gamification } from './gamification.js';
import { getZoneBpmRange, ROUTINES_POOL } from './workouts.js';
import { exportToTCX } from './exporter.js';
import { soundEngine } from './audio.js';

const CIRC = 2 * Math.PI * 90; // Radio SVG 90px (~565.48)

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function generateMiniProfileSvg(steps) {
  const total = steps.reduce((a, s) => a + s.t, 0);
  if (total === 0) return '';
  const zoneColors = { 1: '#3b82f6', 2: '#10b981', 3: '#eab308', 4: '#f97316', 5: '#ef4444' };
  let x = 0;
  const svgWidth = 90;
  const svgHeight = 20;
  let rects = '';

  steps.forEach(st => {
    const w = Math.max(1.2, (st.t / total) * svgWidth);
    const rpeVal = st.rpe || (st.zone ? st.zone * 2 : 5);
    const h = Math.max(3, Math.min(svgHeight, (rpeVal / 10) * svgHeight));
    const y = svgHeight - h;
    const color = zoneColors[st.zone || 2];
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
  }

  init() {
    this.updateMiniRank();
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
  }

  updateMiniRank() {
    const stats = gamification.getStats();
    const rank = gamification.calculateRank(stats.totalXP || 0);
    const el = document.getElementById('miniRankText');
    if (el) el.textContent = rank.title;
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
      } else if (pct < 70) {
        color = '#10b981';
        card.classList.add('bg-emerald-950/40', 'border-emerald-500/40');
      } else if (pct < 80) {
        color = '#eab308';
        card.classList.add('bg-yellow-950/40', 'border-yellow-500/40');
      } else if (pct < 90) {
        color = '#f97316';
        card.classList.add('bg-orange-950/40', 'border-orange-500/50');
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
    if (step.posture === 'de pie') {
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
    document.getElementById('zoneVal').textContent = step.zone ? 'Z' + step.zone : '—';
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
      details.push(nextStep.posture === 'de pie' ? '⚡ De pie' : '🪑 Sentado');
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
  renderRoutinesPool(selectedLevel = 'amateur', activeCategory = 'todos') {
    const container = document.getElementById('routinesPoolGrid');
    if (!container) return;

    container.innerHTML = '';

    const filtered = ROUTINES_POOL.filter(r => {
      return activeCategory === 'todos' || r.category === activeCategory;
    });

    filtered.forEach(routine => {
      const steps = routine.levels[selectedLevel] || routine.levels.amateur;
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

  renderCalendar() {
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

    const clr = { 'principiante': 'text-green-500', 'amateur': 'text-blue-500', 'elite': 'text-orange-500', 'pro': 'text-red-500' };
    const totalDays = new Date(y, m + 1, 0).getDate();

    for (let d = 1; d <= totalDays; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const ws = stats.workouts.filter(w => w.date === ds);
      let html = `<span class="text-[9px] ${t.getDate() === d ? 'text-white font-bold' : 'text-slate-400'} leading-none">${d}</span>`;
      if (ws.length > 0) {
        let best = 'principiante';
        let max = 0;
        ws.forEach(w => {
          const v = { 'principiante': 1, 'amateur': 2, 'elite': 3, 'pro': 4 }[w.level] || 1;
          if (v > max) { max = v; best = w.level; }
        });
        html += `<i class="ti ti-flame text-sm ${clr[best]} mt-0.5"></i>`;
      }
      cal.innerHTML += `<div class="flex flex-col items-center justify-center p-1 rounded h-8 border ${t.getDate() === d ? 'border-slate-500 bg-slate-700/50' : 'border-slate-700/40 bg-slate-800'}">${html}</div>`;
    }
  }

  populateVoiceSelect() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    const voices = soundEngine.getSpanishVoices();
    const current = soundEngine.getCurrentVoiceId();

    select.innerHTML = '<option value="system">Voz natural del sistema (Por defecto)</option>';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI || v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      select.appendChild(opt);
    });

    select.value = current;
  }

  showStatsModal() {
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
    this.renderCalendar();
    this.openModal('statsModal');
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
