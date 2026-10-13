/**
 * Motor de Audio y Voz Guía (Web Audio API & Web Speech API)
 */

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.silentSource = null;
    this.voiceEnabled = true;
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
        silentGain.gain.value = 0.0001; // Casi inaudible pero mantiene vivo el hardware de audio
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

  announce(text) {
    try {
      if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = 'es-ES';
      msg.rate = 1.05;
      window.speechSynthesis.speak(msg);
    } catch (e) {}
  }
}

export const soundEngine = new SoundEngine();
