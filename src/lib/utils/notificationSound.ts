let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

/**
 * Unlock audio context on first user interaction (required by browser autoplay policy)
 */
export function unlockAudio(): void {
    if (audioUnlocked) return;
    if (typeof window === 'undefined') return;
    
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
            audioUnlocked = true;
            console.log('[NotificationSound] Audio unlocked');
        }).catch((err) => {
            console.warn('[NotificationSound] Failed to unlock audio:', err);
        });
    } else {
        audioUnlocked = true;
    }
}

// Auto-unlock on first user interaction
if (typeof window !== 'undefined') {
    const unlockEvents = ['click', 'touchstart', 'keydown'];
    const unlockHandler = () => {
        unlockAudio();
        // Remove listeners after first interaction
        unlockEvents.forEach(evt => {
            window.removeEventListener(evt, unlockHandler);
        });
    };
    unlockEvents.forEach(evt => {
        window.addEventListener(evt, unlockHandler, { once: true });
    });
}

import { selectedSoundType, customSoundPath, soundEnabled, type SoundType, AVAILABLE_SOUNDS } from '$lib/stores/staffNotifications';
import { selectedSoundType as adminSelectedSoundType, customSoundPath as adminCustomSoundPath, soundEnabled as adminSoundEnabled, type SoundType as AdminSoundType, AVAILABLE_SOUNDS as ADMIN_AVAILABLE_SOUNDS } from '$lib/stores/adminNotifications';
import { get } from 'svelte/store';

/**
 * Generic function to play selected notification sound for any app
 */
export async function playAppNotificationSound(
    soundEnabledStore: { subscribe: any },
    selectedSoundTypeStore: { subscribe: any },
    customSoundPathStore: { subscribe: any },
    availableSounds: Array<{ id: string; path: string }>,
    volume = 0.7
): Promise<void> {
    // Check if sound is enabled
    const enabled = get(soundEnabledStore);
    if (!enabled) {
        return;
    }

    const soundType = get(selectedSoundTypeStore);
    let soundPath: string;

    if (soundType === 'custom') {
        const customPath = get(customSoundPathStore);
        soundPath = customPath || availableSounds[0].path;
    } else {
        const sound = availableSounds.find(s => s.id === soundType);
        soundPath = sound?.path || availableSounds[0].path;
    }

    // Try to play the selected sound, fall back to chime on failure
    try {
        await playNotificationSound(soundPath, volume);
    } catch (err) {
        console.warn('[NotificationSound] Selected sound failed, falling back to chime:', err);
        playNotificationChime(volume * 0.8);
    }
}

/**
 * Plays the staff app's selected notification sound
 */
export async function playSelectedNotificationSound(volume = 0.7): Promise<void> {
    return playAppNotificationSound(
        soundEnabled,
        selectedSoundType,
        customSoundPath,
        AVAILABLE_SOUNDS,
        volume
    );
}

/**
 * Plays the admin app's selected notification sound
 */
export async function playAdminNotificationSound(volume = 0.7): Promise<void> {
    return playAppNotificationSound(
        adminSoundEnabled,
        adminSelectedSoundType,
        adminCustomSoundPath,
        ADMIN_AVAILABLE_SOUNDS,
        volume
    );
}

/**
 * Plays a notification sound from an MP3 file.
 * @param src - Path to the sound file (e.g., '/sounds/notification.mp3')
 * @param volume - Volume level 0.0 to 1.0 (default 0.7)
 * @returns Promise that resolves when sound starts playing, rejects on error
 */
export function playNotificationSound(src: string, volume = 0.7): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            if (typeof window === 'undefined') {
                reject(new Error('Not in browser environment'));
                return;
            }

            const audio = new Audio(src);
            audio.volume = volume;

            // Unlock audio context if needed
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {
                    // Silent fail - audio not unlocked yet
                });
            }

            audio.addEventListener('canplaythrough', () => {
                audio.play()
                    .then(() => {
                        console.log('[NotificationSound] Playing sound:', src);
                        resolve();
                    })
                    .catch((err) => {
                        console.warn('[NotificationSound] Failed to play sound:', err);
                        reject(err);
                    });
            }, { once: true });

            audio.addEventListener('error', (err) => {
                console.warn('[NotificationSound] Error loading sound:', src, err);
                reject(new Error('Failed to load sound'));
            }, { once: true });

            // Timeout if sound doesn't load
            setTimeout(() => {
                reject(new Error('Sound load timeout'));
            }, 3000);

            audio.load();
        } catch (err) {
            console.warn('[NotificationSound] Could not play sound:', err);
            reject(err);
        }
    });
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

        // Try to resume if suspended (may fail without user gesture, but we try)
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {
                // Silent fail - audio not unlocked yet
            });
            return; // Don't play if still suspended
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
