<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { Video, Volume2, VolumeX, Mic, MicOff, Settings, Menu, Camera, Square, Send, X } from 'lucide-svelte';
	import VrmViewer from '$lib/components/VrmViewer.svelte';
	import { AudioAnalyser } from '$lib/audioAnalyser';
	import { db, auth } from '$lib/firebase';
	import { onAuthStateChanged } from 'firebase/auth';
	import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
	import { appServices, initAppServiceListener } from '$lib/stores/appData';
	import { cart } from '$lib/stores/booking';

	// State
	let messages: { role: 'user' | 'assistant'; text: string }[] = $state([]);
	let inputText = $state('');
	let isThinking = $state(false);
	let isSpeaking = $state(false);
	let isMuted = $state(false);
	let isListening = $state(false);
	let isProcessing = $state(false); // Hard lock: true from send until Ani fully finishes speaking
	let streamComplete = $state(true); // True when API response stream has fully ended
	let hasPlayedAudioThisTurn = $state(false);
	let textModeSpeaking = $state(false); // True during text-only visual "speaking"
	let isTextMode = $state(false); // Persistent flag: voice quota exhausted
	let showToast = $state('');
	let mouthVolume = $state(0);
	let showMenu = $state(false);
	let showSubtitle = $state('');
	let smartReplies: string[] = $state([]);
	let recognition: any = null;
	let persistentStream: MediaStream | null = null; // Holds hardware mic open for the entire session

	let isSoftwareMuted = $derived(isProcessing || isSpeaking || isThinking || !voiceModeEnabled);

	// Reactive metadata from AI
	let activeEmotion = $state('Neutral');
	let activeAction = $state('None');
	let activeEffect = $state('None');

	let isDestroyed = false;
	let abortController: AbortController | null = null;

	// Particle re-trigger keys
	let heartsKey = $state(0);
	let petalsKey = $state(0);

	$effect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (!user) {
				goto('/login', { replaceState: true });
			}
		});
		return unsubscribe;
	});

	// Audio
	const audioAnalyser = new AudioAnalyser();
	let volumeRafId: number;

	function pollVolume() {
		volumeRafId = requestAnimationFrame(pollVolume);
		mouthVolume = audioAnalyser.getVolume();
		
		// If text-mode speaking is active, don't let normal audio polling interfere
		if (textModeSpeaking) return;

		const currentlyPlaying = audioAnalyser.isPlaying;
		if (currentlyPlaying) {
			hasPlayedAudioThisTurn = true;
		}

		if (currentlyPlaying && !isSpeaking) {
			isSpeaking = true;
		} else if (!currentlyPlaying && isSpeaking) {
			isSpeaking = false;
			// Clear UI state shortly after speaking ends
			setTimeout(() => { showSubtitle = ''; activeEmotion = 'Neutral'; activeAction = 'None'; }, 3000);
		}

		if (streamComplete && !currentlyPlaying && isProcessing) {
			isProcessing = false; // Ani fully finished speaking — unlock software mic
			
			if (!hasPlayedAudioThisTurn && showSubtitle) {
				// Text-Only Fallback Mode (e.g. Voice Quota Exhausted)
				enterTextMode();
			} else if (!hasPlayedAudioThisTurn) {
				// No audio AND no text — just clean up
				setTimeout(() => { activeEmotion = 'Neutral'; activeAction = 'None'; }, 1000);
			} else {
				// Failsafe clear if audio played but state got stuck
				setTimeout(() => { showSubtitle = ''; activeEmotion = 'Neutral'; activeAction = 'None'; }, 3000);
			}
		}
	}

	function enterTextMode() {
		// Show persistent text mode indicator (only toast once)
		if (!isTextMode) {
			isTextMode = true;
			showToast = "Ani's voice module is resting. Text mode active.";
			setTimeout(() => { showToast = ''; }, 5000);
		}

		// Calculate comfortable reading time: ~65ms per character (~3.5 words/sec)
		const readingTimeMs = Math.max(3000, showSubtitle.length * 65);

		// Force her to "speak" visually so she performs talking gestures
		textModeSpeaking = true;
		isSpeaking = true;

		setTimeout(() => {
			textModeSpeaking = false;
			isSpeaking = false;
			setTimeout(() => { showSubtitle = ''; activeEmotion = 'Neutral'; activeAction = 'None'; }, 1500);
		}, readingTimeMs);
	}

	onMount(async () => {
		pollVolume();
		initAppServiceListener();

		// ── Persistent Hardware Mic Anchor ──
		// Acquire a getUserMedia stream ONCE and hold it for the entire session.
		// This keeps the hardware mic physically open so that when SpeechRecognition
		// internally cycles (onend → start), the OS doesn't re-acquire the mic,
		// preventing green-dot flicker and system gain sounds on smartphones.
		try {
			persistentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (e) {
			console.warn('[Ani Mic] Could not acquire persistent mic stream:', e);
		}

		if (typeof window !== 'undefined') {
			const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
			if (SR) {
				recognition = new SR();
				recognition.continuous = true;
				recognition.interimResults = false;
				recognition.lang = 'en-US';

				recognition.onresult = (event: any) => {
					const lastResult = event.results[event.results.length - 1];
					if (lastResult.isFinal) {
						const transcript = lastResult[0].transcript.trim();
						// Software-level gate: discard transcripts when muted (no hardware toggling)
						if (transcript && !isSoftwareMuted) {
							inputText = transcript;
							sendMessage();
						}
					}
				};
				recognition.onend = () => {
					isListening = false;
					// Always restart recognition — persistent stream keeps hardware alive,
					// so this restart is silent at the OS level (no green dot flicker)
					if (!isDestroyed) {
						setTimeout(() => {
							if (!isDestroyed && !isListening) {
								try { recognition.start(); isListening = true; } catch {}
							}
						}, 300);
					}
				};
				recognition.onerror = (e: any) => {
					isListening = false;
					// Auto-restart on recoverable errors — hardware mic stays alive via persistent stream
					if (!isDestroyed && e.error !== 'not-allowed' && e.error !== 'service-not-allowed') {
						setTimeout(() => {
							if (!isDestroyed && !isListening) {
								try { recognition.start(); isListening = true; } catch {}
							}
						}, 500);
					}
				};
			}
		}

		// Start SpeechRecognition — hardware is already held open by persistentStream
		if (recognition) {
			try { recognition.start(); isListening = true; } catch {}
		}

		// Initial greeting voice message is now triggered by VrmViewer's onLoaded callback
	});

	onDestroy(() => {
		isDestroyed = true;
		if (abortController) abortController.abort();
		voiceModeEnabled = false;
		if (volumeRafId) cancelAnimationFrame(volumeRafId);
		audioAnalyser.dispose();
		// Stop SpeechRecognition
		if (recognition) { try { recognition.stop(); } catch {} }
		// Release the persistent hardware mic stream — this is the ONLY place hardware is released
		if (persistentStream) {
			persistentStream.getTracks().forEach(t => t.stop());
			persistentStream = null;
		}
	});

	async function sendMessage(text?: string, isHidden: boolean = false) {
		const msg = text || inputText.trim();
		if (!msg || isThinking) return;

		// Software mute enabled (isThinking becomes true below, which derives isSoftwareMuted)
		// We no longer hardware-stop the recognition here

		isProcessing = true; // Lock mic until Ani fully finishes speaking
		streamComplete = false; // Reset stream status
		hasPlayedAudioThisTurn = false; // Reset audio tracking
		inputText = '';
		if (!isHidden) {
			messages = [...messages, { role: 'user', text: msg }];
		}
		isThinking = true;
		activeEffect = 'None';
		showSubtitle = '';
		smartReplies = [];

		try {
			if (abortController) abortController.abort();
			abortController = new AbortController();

			const res = await fetch('/api/companion', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					message: msg, 
					isMuted,
					services: $appServices.filter(s => s.isActive !== false).map(s => ({
						name: s.name, category: s.category, price: s.price,
						originalPrice: s.originalPrice, duration: s.duration
					}))
				}),
				signal: abortController.signal
			});

			if (!res.body) throw new Error('No response body');

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			
			// Add empty assistant message
			messages = [...messages, { role: 'assistant', text: '' }];
			
			let buffer = '';

			while (!isDestroyed) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				
				const lines = buffer.split('\n\n');
				buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const dataStr = line.slice(6);
						if (!dataStr.trim()) continue;

						try {
							const data = JSON.parse(dataStr);

							if (data.type === 'metadata') {
								activeEmotion = data.emotion || 'Neutral';
								activeAction = data.action || 'None';
								activeEffect = data.effect || 'None';
								
								if (activeEffect === 'Hearts') heartsKey++;
								if (activeEffect === 'Petals') petalsKey++;
							} else if (data.type === 'text_chunk') {
								isThinking = false;
								messages[messages.length - 1].text += data.text;
								showSubtitle += data.text;
							} else if (data.type === 'audio_chunk') {
								isThinking = false;
								if (!isMuted) {
									audioAnalyser.enqueuePcm(data.audio).catch(e => console.error('Audio playback error', e));
								}
								if (data.text) {
									messages[messages.length - 1].text += data.text;
									showSubtitle += data.text;
								}
							} else if (data.type === 'booking') {
								handleBookingEvent(data);
							} else if (data.type === 'suggestions') {
								smartReplies = data.suggestions || [];
								// Clean any leaked tags from displayed text
								const tagCleanRe = /\[(Suggestions|Booking):.*?\]/gi;
								showSubtitle = showSubtitle.replace(tagCleanRe, '').trim();
								if (messages.length > 0) {
									messages[messages.length - 1].text = messages[messages.length - 1].text.replace(tagCleanRe, '').trim();
								}
							} else if (data.type === 'error') {
								console.error(data.message);
							}
						} catch (e) {
							console.error('Failed to parse SSE chunk', e);
						}
					}
				}
			}

			streamComplete = true;

			if (isMuted) {
				isThinking = false;
				setTimeout(() => { if (!isDestroyed) { showSubtitle = ''; activeEmotion = 'Neutral'; activeAction = 'None'; } }, 5000);
			}

		} catch (e: any) {
			if (isDestroyed || e.name === 'AbortError') return;
			const errorMsg = "Ah... my network fluttered for a second. Try once more, darling~";
			messages = [...messages, { role: 'assistant', text: errorMsg }];
			showSubtitle = errorMsg;
			isThinking = false;
			streamComplete = true; // Force unlock
			isProcessing = false; // Unlock on error
			setTimeout(() => { if (!isDestroyed) showSubtitle = ''; }, 5000);
		}

		// If muted, there's no audio to wait for — unlock immediately after stream ends
		if (isMuted) {
			isProcessing = false;
			// No longer restart hardware mic here, software mute handles it automatically
		}
	}

	function toggleMute() {
		isMuted = !isMuted;
		audioAnalyser.setMuted(isMuted);
		if (isMuted) { audioAnalyser.stop(); isSpeaking = false; mouthVolume = 0; }
	}

	let voiceModeEnabled = $state(true);

	function toggleListen() {
		if (!recognition) {
			alert("Voice recognition is not supported in this browser.");
			return;
		}
		
		// Software-only toggle: flip the flag, never touch hardware
		voiceModeEnabled = !voiceModeEnabled;

		// Mute/unmute the persistent stream's audio tracks at the SOFTWARE level.
		// track.enabled = false silences the mic input without releasing hardware —
		// the OS still sees the mic as "in use" (green dot stays, no gain sounds).
		if (persistentStream) {
			persistentStream.getAudioTracks().forEach(track => {
				track.enabled = voiceModeEnabled;
			});
		}
		// recognition.start()/stop() is intentionally NOT called here
	}

	function stopAndExit() {
		audioAnalyser.stop();
		isSpeaking = false;
		streamComplete = true;
		isProcessing = false;
		// Stop hardware mic only when actually leaving the page
		isDestroyed = true; // Prevent auto-restart in onend handler
		if (recognition) { try { recognition.stop(); isListening = false; } catch {} }
		// Release persistent hardware mic stream
		if (persistentStream) {
			persistentStream.getTracks().forEach(t => t.stop());
			persistentStream = null;
		}
		goBack();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
	}

	function goBack() {
		const cameFromAssistant = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fromAssistant') === 'true';
		if (cameFromAssistant && typeof window !== 'undefined' && window.history.length > 1) {
			sessionStorage.removeItem('fromAssistant');
			window.history.back();
		} else {
			goto('/assistant', { replaceState: true });
		}
	}

	// --- BOOKING HANDLER ---
	async function handleBookingEvent(data: any) {
		const { service, price, date, time, payment } = data;

		// Clean leaked [Booking] tag from subtitle/messages
		const bookingTagRe = /\[Booking:.*?\]/gi;
		showSubtitle = showSubtitle.replace(bookingTagRe, '').trim();
		if (messages.length > 0) {
			messages[messages.length - 1].text = messages[messages.length - 1].text.replace(bookingTagRe, '').trim();
		}

		if (payment === 'pay_at_salon') {
			// Book directly via Firebase
			try {
				const user = auth.currentUser;
				if (!user) {
					console.error('User not authenticated for booking');
					return;
				}

				const bookingData = {
					services: [{ name: service, price: price, id: '' }],
					servicesList: [{ name: service, price: price, id: '' }],
					totalAmount: price,
					date: date,
					time: time,
					userName: user.displayName || 'Guest',
					userEmail: user.email || '',
					userPhone: user.phoneNumber || '',
					notes: `Booked via Ani Companion`,
					customer: {
						name: user.displayName || 'Guest',
						phone: user.phoneNumber || '',
						email: user.email || '',
						notes: 'Booked via Ani Companion'
					},
					payment: {
						type: 'free',
						method: 'pay_at_salon',
						amount: 0,
						status: 'unpaid',
						beuCashApplied: 0
					},
					userId: user.uid,
					createdAt: serverTimestamp(),
					status: 'pending',
					source: 'ani_companion'
				};

				await addDoc(collection(db, 'bookings'), bookingData);
				console.log('[Ani Booking] Successfully created booking for', service, 'on', date, 'at', time);
			} catch (err) {
				console.error('[Ani Booking] Failed to create booking:', err);
			}
		} else if (payment === 'pay_now') {
			// Find the matching service from appServices and add to cart
			const matchedService = $appServices.find(s => s.name.toLowerCase() === service.toLowerCase());
			if (matchedService) {
				cart.clear();
				cart.add(matchedService);
			}
			// Navigate to booking page after Ani finishes speaking
			setTimeout(() => {
				goto('/booking');
			}, 2000);
		}
	}


</script>

<svelte:head>
	<title>Ani — AI Companion | Blancbeu</title>
	<meta name="description" content="Chat with Ani, your devoted AI companion" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<!-- Inline SVG defs for premium vector particles -->
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
	<defs>
		<!-- Premium gradient heart -->
		<linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" stop-color="#ff2d55" />
			<stop offset="45%" stop-color="#e91e63" />
			<stop offset="100%" stop-color="#ad1457" />
		</linearGradient>
		<filter id="heartGlow">
			<feGaussianBlur stdDeviation="2" result="blur" />
			<feComposite in="SourceGraphic" in2="blur" operator="over" />
		</filter>
		<!-- Rose petal gradient -->
		<radialGradient id="petalGrad" cx="30%" cy="30%">
			<stop offset="0%" stop-color="#ff6b81" />
			<stop offset="50%" stop-color="#c0392b" />
			<stop offset="100%" stop-color="#7b1e1e" />
		</radialGradient>
		<filter id="petalShadow">
			<feDropShadow dx="0.5" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.3)" />
		</filter>
	</defs>
</svg>

<div class="companion-page">
	<div class="bg-ambient"></div>
	<div class="bg-glow glow-top"></div>
	<div class="bg-glow glow-bottom"></div>

	<!-- SVG Particle FX Layers -->
	{#if activeEffect === 'Hearts'}
		{#key heartsKey}
			<div class="particle-layer" transition:fade={{ duration: 500 }}>
				{#each Array(18) as _, i}
					<svg
						class="fx-heart"
						viewBox="0 0 24 24"
						style="left:{4 + i * 5.2}%;
						       animation-delay:{i * 0.12}s;
						       animation-duration:{3.5 + (i % 4) * 0.6}s;
						       --drift:{(i % 2 === 0 ? 1 : -1) * (8 + (i % 5) * 4)}px;
						       --spin:{(i % 2 === 0 ? 1 : -1) * (15 + (i % 3) * 10)}deg;
						       opacity:0;"
					>
						<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
						         2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
						         C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
						         c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
						      fill="url(#heartGrad)" filter="url(#heartGlow)" />
					</svg>
				{/each}
			</div>
		{/key}
	{/if}

	{#if activeEffect === 'Petals'}
		{#key petalsKey}
			<div class="particle-layer" transition:fade={{ duration: 500 }}>
				{#each Array(22) as _, i}
					<svg
						class="fx-petal"
						viewBox="0 0 20 14"
						style="left:{2 + i * 4.3}%;
						       animation-delay:{i * 0.1}s;
						       animation-duration:{4 + (i % 5) * 0.7}s;
						       --drift:{(i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 6)}px;
						       --tumble:{180 + (i % 3) * 90}deg;
						       transform:scale({0.7 + (i % 4) * 0.15});
						       opacity:0;"
					>
						<ellipse cx="10" cy="7" rx="9" ry="5"
							fill="url(#petalGrad)" filter="url(#petalShadow)"
							transform="rotate({-10 + (i % 4) * 8} 10 7)" />
						<!-- Vein detail -->
						<path d="M3 7 Q10 4 17 7" stroke="rgba(0,0,0,0.12)" stroke-width="0.4" fill="none" />
					</svg>
				{/each}
			</div>
		{/key}
	{/if}

	<!-- 3D Avatar -->
	<div class="avatar-fullscreen">
		<VrmViewer 
			{mouthVolume} 
			{isSpeaking} 
			emotion={activeEmotion} 
			action={activeAction} 
		/>
	</div>

	<!-- Toast notification -->
	{#if showToast}
		<div class="toast-notification" transition:fly={{ y: -30, duration: 300 }}>
			<span class="toast-icon">💬</span>
			<span>{showToast}</span>
		</div>
	{/if}

	<!-- Top bar -->
	<div class="top-bar">
		<button class="top-btn" onclick={() => showMenu = !showMenu} aria-label="Menu">
			<Menu size={22} strokeWidth={1.5} />
		</button>
		<div style="display:flex;gap:8px;align-items:center;">
			{#if isTextMode}
				<div class="text-mode-badge" transition:fade={{ duration: 200 }}>
					<span class="badge-dot"></span>
					<span>Text Mode</span>
				</div>
			{/if}
			<button class="capture-btn" aria-label="Capture">
				<Camera size={16} strokeWidth={2} />
				<span>Capture</span>
			</button>
		</div>
	</div>


	<!-- Slide-out menu -->
	{#if showMenu}
		<div class="menu-overlay" onclick={() => showMenu = false} transition:fade={{ duration: 150 }}></div>
		<div class="menu-panel" transition:fly={{ x: -280, duration: 250 }}>
			<div class="menu-header">
				<span class="menu-title">Ani</span>
				<button class="menu-close" onclick={() => showMenu = false}><X size={20} /></button>
			</div>
			<div class="menu-items">
				<button class="menu-item" onclick={() => { showMenu = false; goBack(); }}>← Back to Assistant</button>
				<button class="menu-item" onclick={() => { messages = []; showMenu = false; }}>🗑️ Clear Chat</button>
				<button class="menu-item" onclick={toggleMute}>{isMuted ? '🔇 Unmute Voice' : '🔊 Mute Voice'}</button>
			</div>
		</div>
	{/if}

	<!-- Subtitle -->
	{#if showSubtitle}
		<div class="subtitle-area" transition:fade={{ duration: 200 }}>
			<p class="subtitle-text" class:whisper={activeEmotion === 'Whisper'}>{showSubtitle}</p>
		</div>
	{/if}

	<!-- Thinking -->
	{#if isThinking}
		<div class="thinking-indicator" transition:fade={{ duration: 150 }}>
			<div class="thinking-dots"><span></span><span></span><span></span></div>
		</div>
	{/if}

	<!-- Smart Reply Suggestions -->
	{#if smartReplies.length > 0 && !isThinking && !isSpeaking}
		<div class="smart-replies" transition:fly={{ y: 20, duration: 250 }}>
			{#each smartReplies as reply, i}
				<button 
					class="smart-pill"
					style="animation-delay: {i * 80}ms"
					onclick={() => { sendMessage(reply); smartReplies = []; }}
				>{reply}</button>
			{/each}
		</div>
	{/if}

	<!-- Bottom controls -->
	<div class="bottom-controls">
		<div class="control-row">
			<button class="ctrl-btn" aria-label="Video" disabled><Video size={20} strokeWidth={1.8} /></button>
			<button class="ctrl-btn" class:active={!isMuted} onclick={toggleMute} aria-label="Speaker">
				{#if isMuted}<VolumeX size={20} strokeWidth={1.8} />{:else}<Volume2 size={20} strokeWidth={1.8} />{/if}
			</button>
			<button class="ctrl-btn" 
					class:active={!voiceModeEnabled || (voiceModeEnabled && !isSoftwareMuted)} 
					class:listening={!voiceModeEnabled || (voiceModeEnabled && !isSoftwareMuted)} 
					class:software-muted={voiceModeEnabled && isSoftwareMuted} 
					onclick={toggleListen} aria-label="Microphone">
				{#if !voiceModeEnabled}
					<MicOff size={20} strokeWidth={1.8} />
				{:else}
					<Mic size={20} strokeWidth={1.8} />
				{/if}
			</button>
			<button class="ctrl-btn" aria-label="Settings" disabled><Settings size={20} strokeWidth={1.8} /></button>
		</div>

		<div class="input-row">
			<div class="input-field">
				<input type="text" placeholder="Ask Ani Anything..." bind:value={inputText} onkeydown={handleKeydown} disabled={isThinking} />
			</div>
			{#if inputText.trim() && !isSpeaking && !isThinking}
				<button class="stop-btn send-active" onclick={() => sendMessage()} aria-label="Send"><Send size={14} /><span>Send</span></button>
			{:else}
				<button class="stop-btn exit-btn" onclick={stopAndExit} aria-label="Stop"><Square size={14} fill="white" /><span>Stop</span></button>
			{/if}
		</div>
	</div>
</div>

<style>
	.companion-page { position: fixed; inset: 0; background: #0c0a14; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; z-index: 9999; }

	.bg-ambient { position: absolute; inset: 0; background: linear-gradient(180deg, #230d2a 0%, #0c0a14 45%, #0c0a14 70%, #1a0821 100%); pointer-events: none; }
	.bg-glow { position: absolute; border-radius: 50%; filter: blur(100px); pointer-events: none; }
	.glow-top { width: 350px; height: 350px; background: radial-gradient(circle, rgba(220,50,100,0.22), transparent); top: -80px; right: -60px; animation: drift 12s ease-in-out infinite; }
	.glow-bottom { width: 300px; height: 300px; background: radial-gradient(circle, rgba(160,40,180,0.18), transparent); bottom: 5%; left: -50px; animation: drift 15s ease-in-out infinite reverse; }
	@keyframes drift { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(15px,-10px); } }

	/* ===== PREMIUM SVG PARTICLE FX ===== */
	.particle-layer { position: absolute; inset: 0; pointer-events: none; z-index: 10; overflow: hidden; }

	/* Hearts: Fall from top with gravity acceleration, lateral wind drift, gentle spin */
	.fx-heart {
		position: absolute;
		top: -40px;
		width: 28px; height: 28px;
		opacity: 0;
		animation: heart-gravity-fall linear forwards;
		will-change: transform, opacity;
	}

	@keyframes heart-gravity-fall {
		0%   { transform: translateY(0) translateX(0) rotate(0deg) scale(0.6); opacity: 0; }
		5%   { opacity: 0.9; }
		30%  { transform: translateY(25vh) translateX(var(--drift, 10px)) rotate(var(--spin, 15deg)) scale(0.85); }
		60%  { transform: translateY(55vh) translateX(calc(var(--drift, 10px) * -0.6)) rotate(calc(var(--spin, 15deg) * -1)) scale(0.95); }
		85%  { opacity: 0.7; }
		100% { transform: translateY(110vh) translateX(var(--drift, 10px)) rotate(calc(var(--spin, 15deg) * 2)) scale(1.05); opacity: 0; }
	}

	/* Petals: Tumble from top with realistic air resistance wobble */
	.fx-petal {
		position: absolute;
		top: -30px;
		width: 22px; height: 16px;
		opacity: 0;
		animation: petal-tumble-fall linear forwards;
		will-change: transform, opacity;
	}

	@keyframes petal-tumble-fall {
		0%   { transform: translateY(0) translateX(0) rotateX(0deg) rotateZ(0deg) scale(0.5); opacity: 0; }
		6%   { opacity: 0.85; }
		20%  { transform: translateY(15vh) translateX(var(--drift, 12px)) rotateX(60deg) rotateZ(40deg) scale(0.8); }
		40%  { transform: translateY(35vh) translateX(calc(var(--drift, 12px) * -0.8)) rotateX(140deg) rotateZ(-30deg) scale(0.9); }
		60%  { transform: translateY(58vh) translateX(var(--drift, 12px)) rotateX(220deg) rotateZ(50deg) scale(0.95); opacity: 0.8; }
		80%  { transform: translateY(80vh) translateX(calc(var(--drift, 12px) * -0.4)) rotateX(300deg) rotateZ(-20deg) scale(1.0); opacity: 0.5; }
		100% { transform: translateY(115vh) translateX(var(--drift, 12px)) rotateX(var(--tumble, 360deg)) rotateZ(60deg) scale(1.05); opacity: 0; }
	}

	.avatar-fullscreen { position: absolute; inset: 0; z-index: 1; }

	.top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; padding-top: calc(14px + env(safe-area-inset-top, 0px)); z-index: 20; }
	.top-btn { width: 42px; height: 42px; border-radius: 50%; background: rgba(0,0,0,0.35); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
	.top-btn:active { transform: scale(0.92); }
	.capture-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 24px; background: rgba(0,0,0,0.35); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
	.capture-btn:active { transform: scale(0.95); }

	.menu-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); z-index: 30; }
	.menu-panel { position: absolute; top: 0; left: 0; bottom: 0; width: 270px; background: rgba(18,14,28,0.97); backdrop-filter: blur(20px); border-right: 1px solid rgba(255,255,255,0.06); z-index: 31; display: flex; flex-direction: column; padding-top: env(safe-area-inset-top, 0px); }
	.menu-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 16px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
	.menu-title { color: #fff; font-size: 1.1rem; font-weight: 600; }
	.menu-close { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.05); border: none; color: rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; cursor: pointer; }
	.menu-items { display: flex; flex-direction: column; padding: 8px; }
	.menu-item { padding: 14px 16px; background: transparent; border: none; color: rgba(255,255,255,0.75); font-size: 0.92rem; text-align: left; cursor: pointer; border-radius: 12px; transition: background 0.15s; font-family: inherit; }
	.menu-item:hover, .menu-item:active { background: rgba(255,255,255,0.05); }

	.subtitle-area { position: absolute; bottom: 180px; left: 16px; right: 16px; z-index: 15; text-align: center; pointer-events: none; }
	.subtitle-text { display: inline-block; background: rgba(15,8,20,0.75); backdrop-filter: blur(12px); border: 1px solid rgba(220,50,100,0.15); padding: 10px 22px; border-radius: 18px; color: rgba(255,255,255,0.95); font-size: 0.88rem; line-height: 1.5; max-width: 90%; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
	.subtitle-text.whisper { font-style: italic; font-weight: 300; letter-spacing: 0.5px; color: #ffd1dc; border-color: rgba(255,182,193,0.3); background: rgba(30,10,25,0.85); }

	.thinking-indicator { position: absolute; bottom: 185px; left: 50%; transform: translateX(-50%); z-index: 15; }
	.thinking-dots { display: flex; gap: 6px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); padding: 10px 18px; border-radius: 20px; }
	.thinking-dots span { width: 8px; height: 8px; border-radius: 50%; background: rgba(220,50,100,0.9); animation: bounce-dot 1s infinite alternate; }
	.thinking-dots span:nth-child(2) { animation-delay: 0.15s; }
	.thinking-dots span:nth-child(3) { animation-delay: 0.3s; }
	@keyframes bounce-dot { 0% { transform: translateY(0); opacity: 0.4; } 100% { transform: translateY(-8px); opacity: 1; } }

	.bottom-controls { position: absolute; bottom: 0; left: 0; right: 0; z-index: 20; padding: 0 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 14px; }
	.control-row { display: flex; align-items: center; justify-content: center; gap: 16px; }
	.ctrl-btn { width: 50px; height: 50px; border-radius: 50%; background: rgba(30,20,35,0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; position: relative; }
	.ctrl-btn:active { transform: scale(0.9); }
	.ctrl-btn:disabled { opacity: 0.35; cursor: default; }
	.ctrl-btn.active { color: rgba(255,255,255,0.95); background: rgba(70,25,50,0.85); border-color: rgba(220,50,100,0.4); }
	.ctrl-btn.listening { background: rgba(220,50,50,0.25); border-color: rgba(220,80,80,0.5); color: #fff; }
	.ctrl-btn.software-muted { background: rgba(220,150,50,0.25); border-color: rgba(220,150,50,0.5); color: #fff; }

	.input-row { display: flex; align-items: center; gap: 10px; }
	.input-field { flex: 1; height: 46px; background: rgba(30,20,35,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); border-radius: 25px; display: flex; align-items: center; padding: 0 18px; transition: border-color 0.2s; }
	.input-field:focus-within { border-color: rgba(220,50,100,0.4); }
	.input-field input { flex: 1; background: transparent; border: none; color: rgba(255,255,255,0.95); font-size: 0.9rem; outline: none; font-family: inherit; }
	.input-field input::placeholder { color: rgba(255,255,255,0.3); }

	.stop-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 25px; background: rgba(70,40,60,0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; font-family: inherit; }
	.stop-btn:active { transform: scale(0.95); }
	.stop-btn.send-active { background: rgba(200,50,90,0.6); border-color: rgba(220,50,100,0.5); }
	.stop-btn.exit-btn { background: rgba(220,50,50,0.3); border-color: rgba(220,50,50,0.5); }

	/* Toast notification */
	.toast-notification {
		position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
		z-index: 50; display: flex; align-items: center; gap: 10px;
		padding: 12px 22px; border-radius: 16px;
		background: rgba(15, 10, 25, 0.85); backdrop-filter: blur(16px);
		border: 1px solid rgba(220, 180, 50, 0.3);
		color: rgba(255, 255, 255, 0.92); font-size: 0.82rem; font-weight: 500;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04);
		white-space: nowrap; pointer-events: none;
	}
	.toast-icon { font-size: 1.1rem; }

	/* Persistent Text Mode badge */
	.text-mode-badge {
		display: flex; align-items: center; gap: 6px;
		padding: 6px 14px; border-radius: 20px;
		background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(12px);
		border: 1px solid rgba(100, 220, 120, 0.25);
		color: rgba(255, 255, 255, 0.8); font-size: 0.72rem; font-weight: 600;
		letter-spacing: 0.5px; text-transform: uppercase;
	}
	.badge-dot {
		width: 7px; height: 7px; border-radius: 50%;
		background: rgba(100, 220, 120, 0.9);
		box-shadow: 0 0 6px rgba(100, 220, 120, 0.6);
		animation: badge-pulse 2s ease-in-out infinite;
	}
	@keyframes badge-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

	/* Smart Reply Suggestions */
	.smart-replies {
		position: absolute; bottom: 145px; left: 0; right: 0;
		z-index: 20; display: flex; gap: 8px;
		overflow-x: auto; overflow-y: hidden;
		padding: 0 16px; pointer-events: auto;
		scrollbar-width: none; -ms-overflow-style: none;
	}
	.smart-replies::-webkit-scrollbar { display: none; }
	.smart-pill {
		padding: 8px 18px; border-radius: 22px;
		background: rgba(25, 18, 35, 0.75); backdrop-filter: blur(14px);
		border: 1px solid rgba(220, 50, 100, 0.2);
		color: rgba(255, 255, 255, 0.88); font-size: 0.82rem; font-weight: 500;
		font-family: inherit; cursor: pointer;
		transition: all 0.2s ease; white-space: nowrap;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
		opacity: 0; animation: pill-appear 0.3s ease forwards;
	}
	.smart-pill:hover { background: rgba(220, 50, 100, 0.2); border-color: rgba(220, 50, 100, 0.45); transform: translateY(-2px); box-shadow: 0 4px 18px rgba(220, 50, 100, 0.15); }
	.smart-pill:active { transform: scale(0.95) translateY(0); }
	@keyframes pill-appear { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }

</style>
