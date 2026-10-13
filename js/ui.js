/**
 * Manejador de la Interfaz de Usuario (UI) y Visualización
 */

import { gamification } from './gamification.js';
import { getZoneBpmRange, ROUTINES_POOL } from './workouts.js';
import { exportToTCX } from './exporter.js';

const CIRC = 2 * Math.PI * 95; // Radio SVG 95px (~596.9)

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
  const svgWidth = 100;
  const svgHeight = 22;
  let rects = '';

  steps.forEach(st => {
    const w = Math.max(1.2, (st.t / total) * svgWidth);
    const rpeVal = st.rpe || (st.zone ? st.zone * 2 : 5);
    const h = Math.max(4, Math.min(svgHeight, (rpeVal / 10) * svgHeight));
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

  toggleFullscreen() {
    const btn = document.getElementById('btnFullscreen');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      if (btn) btn.innerHTML = '<i class="ti ti-minimize text-xl"></i>';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      if (btn) btn.innerHTML = '<i class="ti ti-maximize text-xl"></i>';
    }
  }

  handleFullscreenChange() {
    const btn = document.getElementById('btnFullscreen');
    if (!btn) return;
    if (document.fullscreenElement) {
      btn.innerHTML = '<i class="ti ti-minimize text-xl"></i>';
    } else {
      btn.innerHTML = '<i class="ti ti-maximize text-xl"></i>';
    }
  }

  // Actualiza los colores de la tarjeta según pulso real o RPE estimado
  updateInterfaceColors(currentBpm, fallbackRpe, isHRMConnected) {
    let color = '#1D9E75';
    const card = document.getElementById('mainCard');
    if (!card) return;

    card.className = "bg-slate-800 border rounded-2xl p-4 md:p-5 mb-4 shadow-xl transition-all duration-500 relative overflow-hidden";

    if (isHRMConnected && currentBpm) {
      const maxHr = gamification.getMaxHR();
      const pct = (currentBpm / maxHr) * 100;
      if (pct < 60) {
        color = '#3b82f6';
        card.classList.add('bg-blue-950/40', 'border-blue-500/40', 'shadow-[0_0_30px_rgba(59,130,246,0.15)]');
      } else if (pct < 70) {
        color = '#10b981';
        card.classList.add('bg-emerald-950/40', 'border-emerald-500/40', 'shadow-[0_0_30px_rgba(16,185,129,0.15)]');
      } else if (pct < 80) {
        color = '#eab308';
        card.classList.add('bg-yellow-950/40', 'border-yellow-500/40', 'shadow-[0_0_30px_rgba(234,179,8,0.15)]');
      } else if (pct < 90) {
        color = '#f97316';
        card.classList.add('bg-orange-950/40', 'border-orange-500/50', 'shadow-[0_0_30px_rgba(249,115,22,0.2)]');
      } else {
        color = '#ef4444';
        card.classList.add('bg-red-950/40', 'border-red-500/50', 'shadow-[0_0_30px_rgba(239,68,68,0.25)]');
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
        card.classList.add('bg-red-950/40', 'border-red-500/50', 'shadow-[0_0_30px_rgba(239,68,68,0.2)]');
      }
    }

    const ring = document.getElementById('timerRing');
    if (ring) ring.style.stroke = color;
  }

  // Renderiza el paso activo en la pantalla principal
  renderStep({ step, stepIndex, totalSteps, nextStep }, isHRMConnected, currentBpm) {
    document.getElementById('sessionLabel').textContent = step.phase;
    document.getElementById('exPhase').textContent = `FASE ${stepIndex + 1} DE ${totalSteps}`;
    document.getElementById('exName').textContent = step.phase;
    document.getElementById('exPart').textContent = step.instruction;

    // Badge de postura
    const postBadge = document.getElementById('exPostureBadge');
    const postText = document.getElementById('exPostureText');
    const postIcon = document.getElementById('exPostureIcon');
    postBadge.classList.remove('hidden');
    postBadge.classList.add('flex');
    if (step.posture === 'de pie') {
      postText.textContent = 'De pie';
      postIcon.textContent = '⚡';
      postBadge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs uppercase tracking-wider font-extrabold bg-amber-900/70 text-amber-200 border border-amber-500/50 animate-pulse';
    } else {
      postText.textContent = 'Sentado';
      postIcon.textContent = '🪑';
      postBadge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs uppercase tracking-wider font-extrabold bg-slate-700/80 text-slate-200 border border-slate-600';
    }

    // 1. Cadencia y Metrónomo Visual
    document.getElementById('cadenceVal').textContent = step.cadence ? step.cadence : '—';
    document.getElementById('cadenceUnit').textContent = step.cadence ? 'RPM sug.' : 'Libre';
    
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
      if (nextStep.zone) details.push(`Z${nextStep.zone}`);
      if (nextStep.rpe) details.push(`RPE ${nextStep.rpe}`);
      details.push(formatTime(nextStep.t));
      details.push(nextStep.posture === 'de pie' ? '⚡ De pie' : '🪑 Sentado');
      document.getElementById('nextMeta').textContent = details.join(' · ');
    } else {
      document.getElementById('nextName').textContent = 'Llegando a la meta';
      document.getElementById('nextMeta').textContent = 'Último esfuerzo';
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

    // Colores según zona (1-5)
    const zoneColors = {
      1: '#3b82f6', // Azul
      2: '#10b981', // Verde
      3: '#eab308', // Amarillo
      4: '#f97316', // Naranja
      5: '#ef4444'  // Rojo
    };

    steps.forEach((st, idx) => {
      const widthPct = (st.t / totalDuration) * 100;
      const heightPct = Math.max(30, Math.min(100, (st.rpe || (st.zone * 2)) * 10));
      const color = zoneColors[st.zone || 2];

      const block = document.createElement('div');
      block.id = `profile-step-${idx}`;
      block.className = "relative h-full flex flex-col justify-end group transition-all duration-300";
      block.style.width = `${widthPct}%`;

      block.innerHTML = `
        <div class="w-full rounded-t-sm transition-all duration-300 opacity-70 group-hover:opacity-100" 
             style="height: ${heightPct}%; background-color: ${color};">
        </div>
      `;
      block.title = `${idx + 1}. ${st.phase} (${formatTime(st.t)}) · Z${st.zone || 2} · RPE ${st.rpe || '—'}`;
      container.appendChild(block);
    });

    // Marcador de progreso en la barra
    const marker = document.createElement('div');
    marker.id = 'profileProgressMarker';
    marker.className = "absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#ffffff] z-10 transition-all duration-1000 ease-linear pointer-events-none";
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
        inner.classList.remove('opacity-70');
        inner.classList.add('opacity-100', 'ring-1', 'ring-white');
      } else if (idx < stepIndex) {
        inner.classList.remove('opacity-100', 'ring-1', 'ring-white');
        inner.classList.add('opacity-40');
      } else {
        inner.classList.remove('opacity-40', 'ring-1', 'ring-white');
        inner.classList.add('opacity-70');
      }
    });
  }

  // Dots de etapas
  buildDots(count) {
    const c = document.getElementById('stepDots');
    if (!c) return;
    c.innerHTML = '';
    const max = Math.min(count, 20);
    for (let i = 0; i < max; i++) {
      const d = document.createElement('div');
      d.id = 'dot-' + i;
      c.appendChild(d);
    }
    if (count > 20) {
      const s = document.createElement('span');
      s.className = 'text-[11px] text-slate-500 font-bold ml-1';
      s.textContent = '+' + (count - 20);
      c.appendChild(s);
    }
  }

  updateDots(currentStep, count) {
    for (let i = 0; i < Math.min(count, 20); i++) {
      const d = document.getElementById('dot-' + i);
      if (!d) continue;
      d.className = 'rounded-full transition-all duration-300 ' + (
        i < currentStep
          ? 'w-[7px] h-[7px] bg-[#1D9E75]'
          : (i === currentStep ? 'w-[10px] h-[10px] bg-[#378ADD] shadow-[0_0_8px_#378ADD]' : 'w-[7px] h-[7px] bg-slate-700')
      );
    }
  }

  // Render del Pool de Rutinas con Mini-Perfil SVG
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
      card.className = `p-3.5 rounded-xl border border-${routine.colorClass}-600/30 bg-${routine.colorClass}-950/20 hover:bg-${routine.colorClass}-900/30 text-left transition-all active:scale-[0.98] group flex flex-col justify-between shadow-sm`;
      card.onclick = () => window.painCaveApp.openPreWorkoutModal(routine.id);

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="p-2 rounded-lg bg-${routine.colorClass}-600/20 text-${routine.colorClass}-400">
              <i class="ti ${routine.icon} text-xl"></i>
            </div>
            <span class="text-[11px] font-mono font-bold text-${routine.colorClass}-400 bg-${routine.colorClass}-950/80 px-2 py-0.5 rounded-full border border-${routine.colorClass}-600/40">
              ${minutes} min · ${steps.length} fases
            </span>
          </div>
          <div class="text-sm font-bold text-white group-hover:text-${routine.colorClass}-300 transition-colors">
            ${routine.title}
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
            ${routine.subtitle}
          </div>
        </div>
        <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
          ${miniSvg}
          <span class="text-${routine.colorClass}-400 text-xs font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            Ver ruta <i class="ti ti-chevron-right text-xs"></i>
          </span>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Render del Modal de Resumen al terminar entrenamiento
  showWorkoutSummaryModal(summaryData) {
    this.lastCompletedSessionData = summaryData;
    const { sessionTitle, totalSeconds, hrStats, statsRecorded, level } = summaryData;

    document.getElementById('summarySessionTitle').textContent = sessionTitle;
    document.getElementById('summaryTotalTime').textContent = formatTime(totalSeconds);
    document.getElementById('summaryXp').textContent = `+${statsRecorded ? statsRecorded.earnedXP : 0} XP`;

    // FC stats
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
      cal.innerHTML += `<div class="p-1 rounded bg-slate-800/30 h-10"></div>`;
    }

    const clr = { 'principiante': 'text-green-500', 'amateur': 'text-blue-500', 'elite': 'text-orange-500', 'pro': 'text-red-500' };
    const totalDays = new Date(y, m + 1, 0).getDate();

    for (let d = 1; d <= totalDays; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const ws = stats.workouts.filter(w => w.date === ds);
      let html = `<span class="text-[10px] ${t.getDate() === d ? 'text-white font-bold' : 'text-slate-400'} leading-none">${d}</span>`;
      if (ws.length > 0) {
        let best = 'principiante';
        let max = 0;
        ws.forEach(w => {
          const v = { 'principiante': 1, 'amateur': 2, 'elite': 3, 'pro': 4 }[w.level] || 1;
          if (v > max) { max = v; best = w.level; }
        });
        html += `<i class="ti ti-flame text-base ${clr[best]} mt-0.5"></i>`;
      }
      cal.innerHTML += `<div class="flex flex-col items-center justify-center p-1 rounded h-10 border ${t.getDate() === d ? 'border-slate-500 bg-slate-700/50' : 'border-slate-700/50 bg-slate-800'}">${html}</div>`;
    }
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
    this.renderCalendar();
    this.openModal('statsModal');
  }

  resetDisplay() {
    document.getElementById('sessionLabel').textContent = 'Selecciona una rutina';
    document.getElementById('timerDisplay').textContent = '00:00';
    document.getElementById('globalTime').textContent = '00:00 / 00:00';
    document.getElementById('globalProgress').style.width = '0%';
    document.getElementById('exPhase').textContent = '—';
    document.getElementById('exName').textContent = 'Esperando ciclista...';
    document.getElementById('exPart').textContent = 'Súbete a la bici y elige una ruta abajo';
    document.getElementById('exPostureBadge').classList.add('hidden');

    document.getElementById('cadenceVal').textContent = '—';
    document.getElementById('cadenceUnit').textContent = 'RPM sug.';
    const pacerDot = document.getElementById('cadencePacerDot');
    if (pacerDot) pacerDot.classList.add('hidden');

    document.getElementById('zoneVal').textContent = '—';
    document.getElementById('zoneBpmTarget').textContent = 'BPM';
    document.getElementById('rpeVal').textContent = '—';
    document.getElementById('rpeFill').style.width = '0%';

    document.getElementById('nextName').textContent = '—';
    document.getElementById('nextMeta').textContent = '—';
    document.getElementById('stepCounter').textContent = '— / —';
    document.getElementById('stepDots').innerHTML = '';

    const ring = document.getElementById('timerRing');
    if (ring) ring.style.strokeDashoffset = this.CIRC;
    this.updateInterfaceColors(null, 0, false);

    // Ocultar barra de perfil
    const profileContainer = document.getElementById('workoutProfileContainer');
    if (profileContainer) profileContainer.classList.add('hidden');

    // Ocultar controles activos
    const inRideControls = document.getElementById('inRideControls');
    if (inRideControls) inRideControls.classList.add('hidden');
  }
}

export const ui = new UIManager();
