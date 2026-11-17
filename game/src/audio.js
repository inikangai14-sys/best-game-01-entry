// Sound, synthesised with WebAudio: no audio files, nothing to download. Every
// effect is a short oscillator blip so the game stays quiet to load and loud
// enough to feel. The context is created on the first user gesture (browsers
// refuse audio before one); M mutes, and a muted game stays silent.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        context = Ctor ? new Ctor() : null;
      } catch {
        context = null;
      }
    }
    if (context !== null && context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  /** One note: an oscillator that slides from `from` to `to` Hz over `seconds`. */
  function note(from, to, seconds, type, gainValue, delay) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const when = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), when + seconds);
    gain.gain.setValueAtTime(gainValue, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + seconds + 0.02);
  }

  return {
    /** Call on the first key or pointer press so the context is allowed to start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** A delivery: the pitch climbs with the combo, so a streak sounds like one. */
    pickup(combo) {
      const base = 520 + Math.min(combo, 5) * 70;
      note(base, base * 1.5, 0.09, 'square', 0.05, 0);
    },
    golden() {
      note(660, 990, 0.1, 'sine', 0.07, 0);
      note(990, 1320, 0.12, 'sine', 0.06, 0.07);
    },
    shield() {
      note(440, 880, 0.16, 'triangle', 0.06, 0);
    },
    hit() {
      note(220, 55, 0.28, 'sawtooth', 0.09, 0);
    },
    nearMiss() {
      note(1200, 1200, 0.04, 'square', 0.03, 0);
    },
    levelUp() {
      note(523, 523, 0.09, 'triangle', 0.06, 0);
      note(659, 659, 0.09, 'triangle', 0.06, 0.08);
      note(784, 784, 0.14, 'triangle', 0.06, 0.16);
    },
    gameOver() {
      note(392, 392, 0.16, 'triangle', 0.07, 0);
      note(311, 311, 0.16, 'triangle', 0.07, 0.15);
      note(233, 175, 0.34, 'triangle', 0.07, 0.3);
    },
  };
}
