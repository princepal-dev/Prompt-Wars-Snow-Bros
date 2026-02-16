
export class SoundManager {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  
  isMuted: boolean = false;
  private readonly STORAGE_KEY = 'snowbros_sound_muted';
  private readonly MASTER_VOLUME = 0.4;
  private readonly MUSIC_VOLUME = 0.25;
  private readonly SFX_VOLUME = 0.5;

  // Sequencer State
  private currentTrack: 'MENU' | 'GAME' | 'BOSS' | 'NONE' = 'NONE';
  private isPlaying: boolean = false;
  private nextNoteTime: number = 0;
  private current16thNote: number = 0;
  private tempo: number = 120;
  private scheduleAheadTime: number = 0.1;
  private lookahead: number = 25;
  private timerID: number | null = null;

  constructor() {
    this.isMuted = localStorage.getItem(this.STORAGE_KEY) === 'true';

    try {
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.MUSIC_VOLUME;
      this.musicGain.connect(this.masterGain);
      
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.SFX_VOLUME;
      this.sfxGain.connect(this.masterGain);
      
      this.updateMasterVolume();
    } catch (e) {
      console.warn("Web Audio API not supported");
    }
  }

  // --- Core Audio Control ---

  private updateMasterVolume() {
    if (!this.masterGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetVolume = this.isMuted ? 0 : this.MASTER_VOLUME;
    this.masterGain.gain.setTargetAtTime(targetVolume, now, 0.1);
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem(this.STORAGE_KEY, String(this.isMuted));
    this.updateMasterVolume();
    return this.isMuted;
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.isPlaying && this.currentTrack !== 'NONE') {
        this.isPlaying = true;
        this.scheduler();
    }
  }

  // --- Music Sequencer ---

  playTrack(track: 'MENU' | 'GAME' | 'BOSS') {
      if (this.currentTrack === track) return;
      this.currentTrack = track;
      
      switch(track) {
          case 'MENU': this.tempo = 90; break;
          case 'GAME': this.tempo = 110; break;
          case 'BOSS': this.tempo = 140; break;
      }

      if (!this.isPlaying && this.ctx?.state === 'running') {
          this.isPlaying = true;
          this.nextNoteTime = this.ctx.currentTime + 0.1;
          this.scheduler();
      }
  }

  stopMusic() {
      this.isPlaying = false;
      this.currentTrack = 'NONE';
      if (this.timerID) window.clearTimeout(this.timerID);
  }

  private nextNote() {
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
      this.current16thNote++;
      if (this.current16thNote === 16) {
          this.current16thNote = 0;
      }
  }

  private scheduler() {
      if (!this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
          this.scheduleNote(this.current16thNote, this.nextNoteTime);
          this.nextNote();
      }
      this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private scheduleNote(beatNumber: number, time: number) {
      if (!this.musicGain || this.isMuted) return;

      if (this.currentTrack === 'MENU') {
          // Atmospheric Arp
          if ([0, 3, 6, 8, 11, 14].includes(beatNumber)) {
              this.playSynthNote(time, 220 + (beatNumber * 10), 'sine', 0.2);
          }
          // Deep Drone
          if (beatNumber === 0) {
              this.playSynthNote(time, 55, 'triangle', 2.0);
          }
      } 
      else if (this.currentTrack === 'GAME') {
          // Kick
          if (beatNumber % 4 === 0) {
              this.playKick(time);
          }
          // HiHat
          if (beatNumber % 2 === 0) {
              this.playHiHat(time);
          }
          // Bassline
          if ([0, 2, 3, 6, 8, 10, 11, 14].includes(beatNumber)) {
               const freq = beatNumber < 8 ? 110 : 82.4; // A2 then E2
               this.playSynthNote(time, freq, 'sawtooth', 0.15);
          }
      }
      else if (this.currentTrack === 'BOSS') {
           // Fast Kick
           if (beatNumber % 2 === 0) {
               this.playKick(time);
           }
           // Chaotic Arp
           const freqs = [110, 220, 164, 330]; // D minorish
           const f = freqs[beatNumber % 4];
           this.playSynthNote(time, f, 'square', 0.1);
           
           // Snare
           if (beatNumber % 8 === 4) {
               this.playSnare(time);
           }
      }
  }

  // --- Instruments ---

  private playKick(time: number) {
      if (!this.ctx || !this.musicGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
      gain.gain.setValueAtTime(0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.5);
  }

  private playHiHat(time: number) {
      if (!this.ctx || !this.musicGain) return;
      // Simple high freq noise burst approximation
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, time); // Metallic ring
      // Typically need noise buffer, but square wave high pitch is okay for retro
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.05);
  }
  
  private playSnare(time: number) {
     if (!this.ctx || !this.musicGain) return;
     const osc = this.ctx.createOscillator();
     const gain = this.ctx.createGain();
     osc.type = 'triangle';
     osc.frequency.setValueAtTime(200, time);
     gain.gain.setValueAtTime(0.4, time);
     gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
     osc.connect(gain);
     gain.connect(this.musicGain);
     osc.start(time);
     osc.stop(time + 0.2);
  }

  private playSynthNote(time: number, freq: number, type: OscillatorType, duration: number) {
      if (!this.ctx || !this.musicGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.linearRampToValueAtTime(0.2, time + duration - 0.05);
      gain.gain.linearRampToValueAtTime(0.01, time + duration);
      
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + duration);
  }

  // --- SFX (Routed to SFX Gain) ---

  playJump() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playShoot() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playEnemyHit() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExplosion() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    noise.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
  }

  playPowerUp() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(1800, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }
}
