let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

/**
 * Plays a luxurious 3-note ascending chime (C5 → E5 → G5) using Web Audio API.
 * No sound file required. Works in all modern browsers.
 * @param volume - Master volume, 0.0 to 1.0 (default 0.55)
 */
export function playNotificationChime(volume = 0.55): void {
    try {
        if (typeof window === 'undefined' || !window.AudioContext && !(window as any).webkitAudioContext) {
            return;
        }

        const ctx = getAudioContext();

        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        // Luxury salon chime: C5 → E5 → G5 (major chord ascent)
        const notes = [
            { freq: 523.25, delay: 0.0 },   // C5
            { freq: 659.25, delay: 0.18 },  // E5
            { freq: 783.99, delay: 0.36 },  // G5
        ];

        notes.forEach(({ freq, delay }) => {
            const start = ctx.currentTime + delay;
            const duration = 1.1;

            // Primary tone (sine - clear bell)
            const osc1 = ctx.createOscillator();
            // Harmonic overtone (2× freq, softened) for warmth
            const osc2 = ctx.createOscillator();
            const masterGain = ctx.createGain();
            const harmGain = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.value = freq;

            osc2.type = 'sine';
            osc2.frequency.value = freq * 2;   // octave harmonic

            harmGain.gain.value = 0.12;          // subtle second harmonic

            osc2.connect(harmGain);
            harmGain.connect(masterGain);
            osc1.connect(masterGain);
            masterGain.connect(ctx.destination);

            // Bell envelope: near-instant attack → long exponential decay
            masterGain.gain.setValueAtTime(0, start);
            masterGain.gain.linearRampToValueAtTime(volume, start + 0.009);   // 9ms attack
            masterGain.gain.exponentialRampToValueAtTime(0.001, start + duration); // bell decay

            osc1.start(start);
            osc2.start(start);
            osc1.stop(start + duration);
            osc2.stop(start + duration);
        });
    } catch (err) {
        console.warn('[NotificationSound] Could not play chime:', err);
    }
}
