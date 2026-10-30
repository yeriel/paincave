/**
 * Motor de Audio y Voz Guía Natural (Web Audio API & Web Speech API)
 */

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.silentSource = null;
    this.voiceEnabled = true;
    this.selectedVoice = null;
    this.voicesLoaded = false;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices();
      window.speechSynthesis.onvoiceschanged = () => this.initVoices();
    }
  }

  initVoices() {
    try {
      if (!('speechSynthesis' in window)) return;
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;
      this.voicesLoaded = true;

      const savedUri = localStorage.getItem('paincave_voice');
      if (savedUri && savedUri !== 'system') {
        const found = voices.find(v => v.voiceURI === savedUri || v.name === savedUri);
        if (found) {
          this.selectedVoice = found;
          return;
        }
      }

      // Si no hay voz configurada o está en 'system', buscar si hay alguna voz Neural/Google explícita
      const esVoices = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('es'));
      const naturalVoice = esVoices.find(v => 
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online')) &&
        !v.name.toLowerCase().includes('espeak')
      );

      // Si existe una voz Google/Natural explícita la usamos; de lo contrario dejamos null para que el navegador use su voz nativa por defecto (la que el usuario tenía antes)
      this.selectedVoice = naturalVoice || null;
    } catch (e) {}
  }

  getSpanishVoices() {
    try {
      if (!('speechSynthesis' in window)) return [];
      const voices = window.speechSynthesis.getVoices() || [];
      const esVoices = voices.filter(v => 
        v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('es') &&
        !v.name.toLowerCase().includes('espeak')
      );
      return esVoices;
    } catch (e) {
      return [];
    }
  }

  setVoiceByUri(voiceUri) {
    if (voiceUri === 'system' || !voiceUri) {
      localStorage.setItem('paincave_voice', 'system');
      this.initVoices();
      return;
    }
    localStorage.setItem('paincave_voice', voiceUri);
    this.initVoices();
  }

  getCurrentVoiceId() {
    return localStorage.getItem('paincave_voice') || 'system';
  }

  init() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // Buffer silencioso persistente para evitar suspensión en segundo plano
      if (!this.silentSource && this.audioCtx) {
        const buffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 2, this.audioCtx.sampleRate);
        this.silentSource = this.audioCtx.createBufferSource();
        this.silentSource.buffer = buffer;
        this.silentSource.loop = true;
        const silentGain = this.audioCtx.createGain();
        silentGain.gain.value = 0.0001; // Inaudible pero mantiene vivo el hardware de audio
        this.silentSource.connect(silentGain);
        silentGain.connect(this.audioCtx.destination);
        this.silentSource.start(0);
      }
    } catch (e) {
      console.warn("Audio Context init error:", e);
    }
  }

  setVoiceEnabled(enabled) {
    this.voiceEnabled = enabled;
  }

  playBeep(freq = 480, duration = 0.15, type = 'sine') {
    try {
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.frequency.value = freq;
      osc.type = type;
      osc.start();

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, this.audioCtx.currentTime + duration);
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  playToneSequence(notes) {
    try {
      if (!this.audioCtx) return;
      let time = this.audioCtx.currentTime;

      notes.forEach(note => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.frequency.value = note.freq;
        osc.type = note.type || 'triangle';
        osc.start(time);

        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.00001, time + note.duration);
        osc.stop(time + note.duration);

        time += note.duration;
      });
    } catch (e) {}
  }

  playCountdownTick() {
    this.playBeep(480, 0.12, 'sine');
  }

  playPhaseChangeTone() {
    this.playToneSequence([
      { freq: 587.33, duration: 0.12, type: 'triangle' }, // Re5
      { freq: 880.00, duration: 0.30, type: 'triangle' }  // La5
    ]);
  }

  playFinishFanfare() {
    this.playToneSequence([
      { freq: 523.25, duration: 0.15, type: 'sine' }, // Do5
      { freq: 659.25, duration: 0.15, type: 'sine' }, // Mi5
      { freq: 783.99, duration: 0.15, type: 'sine' }, // Sol5
      { freq: 1046.50, duration: 0.40, type: 'sine' } // Do6
    ]);
  }

  testVoice() {
    this.announce("Pain Cave listo. ¡A rodar!");
  }

  formatCoachCue(step, isStart = false) {
    if (!step) return '';
    const prefix = isStart ? 'Iniciamos: ' : 'Próximo: ';
    const pLower = (step.phase || '').toLowerCase();

    let cue = '';
    if (pLower.includes('calentamiento')) {
      cue = `Calentamiento${step.cadence ? `, ${step.cadence} RPM` : ''}`;
    } else if (pLower.includes('enfriamiento')) {
      cue = 'Enfriamiento, soltar piernas';
    } else if (pLower.includes('sweet spot') || pLower.includes('sweetspot') || step.zone === 'SS') {
      const aero = step.posture === 'aero' ? ' aero' : '';
      cue = `Sweet Spot${aero}, 157 a 166 pulsaciones`;
    } else if (pLower.includes('umbral') || step.zone === 4) {
      cue = 'Umbral, 166 a 178 pulsaciones';
    } else if (step.posture === 'de pie' || pLower.includes('de pie')) {
      cue = `De pie, cadencia ${step.cadence || 75}`;
    } else if (step.posture === 'aero' || pLower.includes('aero')) {
      cue = `Posición aero, ${step.cadence || 90} RPM`;
    } else if (step.zone === 1 || pLower.includes('recuperaci') || pLower.includes('regenerativo')) {
      cue = 'Recuperación suave';
    } else if (step.zone === 2 || pLower.includes('fondo') || pLower.includes('z2')) {
      cue = `Zona 2, ${step.cadence || 88} RPM`;
    } else {
      cue = `${step.phase.replace(/\(.*?\)/g, '').trim()}${step.cadence ? `, ${step.cadence} RPM` : ''}`;
    }

    return `${prefix}${cue}.`;
  }

  announce(text) {
    try {
      if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();

      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = 'es-ES';
      msg.rate = 1.0; // Velocidad natural humana (sin aceleración metálica)
      msg.pitch = 1.0;

      if (this.selectedVoice) {
        msg.voice = this.selectedVoice;
      }

      window.speechSynthesis.speak(msg);
    } catch (e) {}
  }
}

export const soundEngine = new SoundEngine();
