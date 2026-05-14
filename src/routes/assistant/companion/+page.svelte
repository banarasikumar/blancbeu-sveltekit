<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { Video, Volume2, VolumeX, Mic, MicOff, Settings, Menu, Camera, Square, Send, X } from 'lucide-svelte';
	import VrmViewer from '$lib/components/VrmViewer.svelte';
	import { AudioAnalyser } from '$lib/audioAnalyser';

	// State
	let messages: { role: 'user' | 'assistant'; text: string }[] = $state([]);
	let inputText = $state('');
	let isThinking = $state(false);
	let isSpeaking = $state(false);
	let isMuted = $state(false);
	let isListening = $state(false);
	let mouthVolume = $state(0);
	let showMenu = $state(false);
	let showSubtitle = $state('');
	let recognition: any = null;

	// Reactive metadata from AI
	let activeEmotion = $state('Neutral');
	let activeAction = $state('None');
	let activeEffect = $state('None');

	// Debug test mode
	let debugMode = $state(false);

	// Particle re-trigger keys
	let heartsKey = $state(0);
	let petalsKey = $state(0);

	// Audio
	const audioAnalyser = new AudioAnalyser();
	let volumeRafId: number;

	function pollVolume() {
		volumeRafId = requestAnimationFrame(pollVolume);
		mouthVolume = audioAnalyser.getVolume();
		isSpeaking = audioAnalyser.isPlaying;
	}

	onMount(() => {
		pollVolume();

		if (typeof window !== 'undefined') {
			const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
			if (SR) {
				recognition = new SR();
				recognition.continuous = false;
				recognition.interimResults = false;
				recognition.lang = 'en-US';

				recognition.onresult = (event: any) => {
					const transcript = event.results[0][0].transcript;
					inputText = transcript;
					sendMessage();
				};
				recognition.onend = () => (isListening = false);
				recognition.onerror = () => (isListening = false);
			}
		}

		setTimeout(() => {
			showSubtitle = "Mm... welcome back, darling~";
			activeEmotion = 'Romantic';
			activeAction = 'Wave';
			activeEffect = 'Hearts';
			heartsKey++;
			setTimeout(() => { showSubtitle = ''; activeAction = 'None'; activeEffect = 'None'; activeEmotion = 'Neutral'; }, 6000);
		}, 2500);
	});

	onDestroy(() => {
		if (volumeRafId) cancelAnimationFrame(volumeRafId);
		audioAnalyser.dispose();
		if (recognition) { try { recognition.stop(); } catch {} }
	});

	async function sendMessage(text?: string) {
		const msg = text || inputText.trim();
		if (!msg || isThinking) return;

		inputText = '';
		messages = [...messages, { role: 'user', text: msg }];
		isThinking = true;
		activeEffect = 'None';

		try {
			const res = await fetch('/api/companion', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: msg })
			});

			const data = await res.json();
			const reply = data.reply || "Mm... I got lost in your eyes for a moment~";

			messages = [...messages, { role: 'assistant', text: reply }];
			isThinking = false;

			if (!isMuted) {
				// We pass 'data' so animations/emotions are delayed until TTS audio is ready
				await speakText(reply, data);
			} else {
				activeEmotion = data.emotion || 'Romantic';
				activeAction = data.action || 'None';
				activeEffect = data.effect || 'None';

				if (activeEffect === 'Hearts') heartsKey++;
				if (activeEffect === 'Petals') petalsKey++;

				showSubtitle = reply;
				// Reset action/emotion after reading time
				setTimeout(() => { showSubtitle = ''; activeEmotion = 'Neutral'; activeAction = 'None'; }, 8000);
			}
		} catch {
			const errorMsg = "Ah... my network fluttered for a second. Try once more, darling~";
			messages = [...messages, { role: 'assistant', text: errorMsg }];
			showSubtitle = errorMsg;
			isThinking = false;
			setTimeout(() => { showSubtitle = ''; }, 5000);
		}
	}

	async function speakText(text: string, data?: any) {
		try {
			const res = await fetch('/api/companion', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'tts', message: text })
			});
			const ttsData = await res.json();

			// Audio is ready to play, NOW we trigger the expressions and effects
			if (data) {
				activeEmotion = data.emotion || 'Romantic';
				activeAction = data.action || 'None';
				activeEffect = data.effect || 'None';
				if (activeEffect === 'Hearts') heartsKey++;
				if (activeEffect === 'Petals') petalsKey++;
			}

			if (ttsData.audio) {
				// Show subtitle only when audio starts
				showSubtitle = text;
				isSpeaking = true;
				await audioAnalyser.playPcm(ttsData.audio);
			} else {
				showSubtitle = text;
			}
		} catch (e) { 
			console.error('TTS playback error:', e); 
			showSubtitle = text; 
		} finally { 
			isSpeaking = false; 
			mouthVolume = 0; 
			setTimeout(() => { showSubtitle = ''; activeEmotion = 'Neutral'; activeAction = 'None'; }, 8000);
		}
	}

	function toggleMute() {
		isMuted = !isMuted;
		audioAnalyser.setMuted(isMuted);
		if (isMuted) { audioAnalyser.stop(); isSpeaking = false; mouthVolume = 0; }
	}

	function toggleListen() {
		if (!recognition) return;
		if (isListening) { recognition.stop(); }
		else { try { recognition.start(); isListening = true; } catch {} }
	}

	function stopSpeaking() {
		audioAnalyser.stop();
		isSpeaking = false;
		mouthVolume = 0;
		showSubtitle = '';
		activeAction = 'None';
		activeEmotion = 'Neutral';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
	}

	function goBack() { goto('/assistant'); }

	// Debug helpers
	const ALL_ACTIONS = ['None','FlyingKiss','Dance','TurnAround','RomanticPose','Bow','Wave','Sit','LeanForward','Laugh','Cry','StandCasual','ThinkingPose','Shrug'];
	const ALL_EMOTIONS = ['Neutral','Happy','Sad','Romantic','Flirty','Sarcastic','Enthusiastic','Blessed','Whisper'];
	const ALL_EFFECTS = ['None','Hearts','Petals'];

	function debugSetAction(a: string) {
		activeAction = a;
		showSubtitle = `Action: ${a}`;
		setTimeout(() => { showSubtitle = ''; }, 3000);
	}
	function debugSetEmotion(e: string) {
		activeEmotion = e;
		showSubtitle = `Emotion: ${e}`;
		setTimeout(() => { showSubtitle = ''; }, 3000);
	}
	function debugSetEffect(fx: string) {
		activeEffect = fx;
		if (fx === 'Hearts') heartsKey++;
		if (fx === 'Petals') petalsKey++;
		showSubtitle = `Effect: ${fx}`;
		setTimeout(() => { showSubtitle = ''; activeEffect = 'None'; }, 5000);
	}
	function debugSimulateSpeech() {
		isSpeaking = true;
		mouthVolume = 0.5;
		showSubtitle = 'Simulating speech (gestures active)...';
		let tick = 0;
		const iv = setInterval(() => {
			tick++;
			mouthVolume = 0.3 + Math.random() * 0.5;
			if (tick > 80) {
				clearInterval(iv);
				isSpeaking = false;
				mouthVolume = 0;
				showSubtitle = '';
			}
		}, 60);
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
		<VrmViewer {mouthVolume} {isSpeaking} emotion={activeEmotion} action={activeAction} />
	</div>

	<!-- Top bar -->
	<div class="top-bar">
		<button class="top-btn" onclick={() => showMenu = !showMenu} aria-label="Menu">
			<Menu size={22} strokeWidth={1.5} />
		</button>
		<div style="display:flex;gap:8px;">
			<button class="capture-btn" onclick={() => debugMode = !debugMode} style="background:{debugMode ? 'rgba(220,50,100,0.5)' : 'rgba(0,0,0,0.35)'}">
				<span>🎮 Debug</span>
			</button>
			<button class="capture-btn" aria-label="Capture">
				<Camera size={16} strokeWidth={2} />
				<span>Capture</span>
			</button>
		</div>
	</div>

	<!-- DEBUG TEST PANEL -->
	{#if debugMode}
		<div class="debug-panel" transition:fly={{ x: 300, duration: 250 }}>
			<div class="debug-header">
				<span>🎮 Debug Panel</span>
				<span class="debug-state">E:{activeEmotion} A:{activeAction}</span>
			</div>

			<div class="debug-section">
				<p class="debug-label">Actions / Choreographies</p>
				<div class="debug-grid">
					{#each ALL_ACTIONS as a}
						<button class="debug-btn" class:active={activeAction === a} onclick={() => debugSetAction(a)}>{a}</button>
					{/each}
				</div>
			</div>

			<div class="debug-section">
				<p class="debug-label">Emotions / Expressions</p>
				<div class="debug-grid">
					{#each ALL_EMOTIONS as e}
						<button class="debug-btn" class:active={activeEmotion === e} onclick={() => debugSetEmotion(e)}>{e}</button>
					{/each}
				</div>
			</div>

			<div class="debug-section">
				<p class="debug-label">Visual Effects</p>
				<div class="debug-grid">
					{#each ALL_EFFECTS as fx}
						<button class="debug-btn" class:active={activeEffect === fx} onclick={() => debugSetEffect(fx)}>{fx}</button>
					{/each}
				</div>
			</div>

			<div class="debug-section">
				<p class="debug-label">Simulate</p>
				<div class="debug-grid">
					<button class="debug-btn sim" onclick={debugSimulateSpeech}>▶ Simulate Speech (5s)</button>
				</div>
			</div>
		</div>
	{/if}

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

	<!-- Bottom controls -->
	<div class="bottom-controls">
		<div class="control-row">
			<button class="ctrl-btn" aria-label="Video" disabled><Video size={20} strokeWidth={1.8} /></button>
			<button class="ctrl-btn" class:active={!isMuted} onclick={toggleMute} aria-label="Speaker">
				{#if isMuted}<VolumeX size={20} strokeWidth={1.8} />{:else}<Volume2 size={20} strokeWidth={1.8} />{/if}
			</button>
			<button class="ctrl-btn" class:active={isListening} class:listening={isListening} onclick={toggleListen} aria-label="Microphone">
				{#if isListening}<MicOff size={20} strokeWidth={1.8} />{:else}<Mic size={20} strokeWidth={1.8} />{/if}
				{#if isListening}<div class="listen-ring"></div>{/if}
			</button>
			<button class="ctrl-btn" aria-label="Settings" disabled><Settings size={20} strokeWidth={1.8} /></button>
		</div>

		<div class="input-row">
			<div class="input-field">
				<input type="text" placeholder="Ask Ani Anything..." bind:value={inputText} onkeydown={handleKeydown} disabled={isThinking} />
			</div>
			{#if isSpeaking || isThinking}
				<button class="stop-btn" onclick={stopSpeaking} aria-label="Stop"><Square size={14} fill="white" /><span>Stop</span></button>
			{:else if inputText.trim()}
				<button class="stop-btn send-active" onclick={() => sendMessage()} aria-label="Send"><Send size={14} /><span>Send</span></button>
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
	.listen-ring { position: absolute; inset: -5px; border-radius: 50%; border: 2px solid rgba(220,80,80,0.5); animation: ring-expand 1.5s ease-out infinite; }
	@keyframes ring-expand { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }

	.input-row { display: flex; align-items: center; gap: 10px; }
	.input-field { flex: 1; height: 46px; background: rgba(30,20,35,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); border-radius: 25px; display: flex; align-items: center; padding: 0 18px; transition: border-color 0.2s; }
	.input-field:focus-within { border-color: rgba(220,50,100,0.4); }
	.input-field input { flex: 1; background: transparent; border: none; color: rgba(255,255,255,0.95); font-size: 0.9rem; outline: none; font-family: inherit; }
	.input-field input::placeholder { color: rgba(255,255,255,0.3); }

	.stop-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 25px; background: rgba(70,40,60,0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; font-family: inherit; }
	.stop-btn:active { transform: scale(0.95); }
	.stop-btn.send-active { background: rgba(200,50,90,0.6); border-color: rgba(220,50,100,0.5); }

	/* Debug Panel */
	.debug-panel {
		position: absolute; top: 60px; right: 8px; bottom: 170px; width: 200px;
		background: rgba(10,5,18,0.45); backdrop-filter: blur(8px);
		border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
		z-index: 25; overflow-y: auto; padding: 10px;
		display: flex; flex-direction: column; gap: 8px;
		scrollbar-width: thin; scrollbar-color: rgba(220,50,100,0.3) transparent;
	}
	.debug-header {
		display: flex; justify-content: space-between; align-items: center;
		padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.08);
		font-size: 0.75rem; color: rgba(255,255,255,0.9); font-weight: 600;
	}
	.debug-state { font-size: 0.6rem; color: rgba(220,50,100,0.8); font-weight: 400; }
	.debug-section { display: flex; flex-direction: column; gap: 4px; }
	.debug-label { font-size: 0.65rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; margin: 4px 0 2px; }
	.debug-grid { display: flex; flex-wrap: wrap; gap: 4px; }
	.debug-btn {
		padding: 5px 10px; border-radius: 8px; font-size: 0.68rem; font-weight: 500;
		background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.7); cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.debug-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
	.debug-btn:active { transform: scale(0.93); }
	.debug-btn.active { background: rgba(220,50,100,0.4); border-color: rgba(220,50,100,0.6); color: #fff; }
	.debug-btn.sim { width: 100%; background: rgba(50,120,220,0.3); border-color: rgba(50,120,220,0.4); }
	.debug-btn.sim:hover { background: rgba(50,120,220,0.5); }
</style>
