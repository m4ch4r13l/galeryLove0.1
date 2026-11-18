// Procedural Romantic Ambient Pad + Soft Harp Arpeggio via Web Audio API

const ARPEGGIO_CHORDS = [
  [261.63, 329.63, 392.0, 493.88, 587.33], // Cmaj9
  [220.0, 261.63, 329.63, 392.0, 493.88], // Am9
  [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
  [196.0, 246.94, 293.66, 392.0, 440.0], // G6
];

export class AmbientMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private padOscillators: OscillatorNode[] = [];
  private timerId: number | null = null;
  private step = 0;
  private playing = false;

  public isPlaying(): boolean {
    return this.playing;
  }

  public start(): boolean {
    if (this.playing) return true;
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return false;

      const ctx = new AudioContextCtor();
      this.ctx = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 1.4);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);
      this.masterGain = masterGain;

      // Warm low ambient pad (soft sine/triangle bed)
      const padFreqs = [130.81, 196.0, 246.94];
      padFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const padGain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.detune.setValueAtTime((idx - 1) * 4, ctx.currentTime);
        padGain.gain.setValueAtTime(0.055, ctx.currentTime);
        osc.connect(padGain);
        padGain.connect(filter);
        osc.start();
        this.padOscillators.push(osc);
      });

      this.step = 0;
      const playNote = () => {
        if (!this.ctx || !this.playing || !this.masterGain) return;
        const now = this.ctx.currentTime;
        const chordIdx = Math.floor(this.step / 8) % ARPEGGIO_CHORDS.length;
        const chord = ARPEGGIO_CHORDS[chordIdx];
        const noteFreq = chord[this.step % chord.length];

        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, now);

        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.linearRampToValueAtTime(0.11, now + 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

        osc.connect(noteGain);
        noteGain.connect(filter);
        osc.start(now);
        osc.stop(now + 2.5);

        this.step += 1;
      };

      this.playing = true;
      playNote();
      this.timerId = window.setInterval(playNote, 950);
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  public stop(): void {
    this.playing = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }

    const ctx = this.ctx;
    const masterGain = this.masterGain;
    const oscs = this.padOscillators;
    this.padOscillators = [];
    this.ctx = null;
    this.masterGain = null;

    if (ctx && masterGain) {
      try {
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(Math.max(0.001, masterGain.gain.value), now);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        window.setTimeout(() => {
          oscs.forEach((o) => {
            try {
              o.stop();
            } catch {
              // ignore already stopped
            }
          });
          ctx.close().catch(() => {});
        }, 400);
      } catch {
        ctx.close().catch(() => {});
      }
    }
  }
}
