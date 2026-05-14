<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { AvatarManager } from '$lib/avatar/AvatarManager';

	let {
		mouthVolume = 0,
		isSpeaking = false,
		emotion = 'Neutral',
		action = 'None'
	}: {
		mouthVolume?: number;
		isSpeaking?: boolean;
		emotion?: string;
		action?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let avatarManager: AvatarManager;
	let isLoading = $state(true);
	let loadError = $state('');

	onMount(async () => {
		try {
			avatarManager = new AvatarManager(canvas);
			await avatarManager.loadModel('/Ani.vrm');
			isLoading = false;
		} catch (e) {
			console.error('Failed to load Ani', e);
			loadError = 'Could not load companion';
			isLoading = false;
		}
	});

	onDestroy(() => {
		if (avatarManager) avatarManager.dispose();
	});

	// Reactive update
	$effect(() => {
		if (avatarManager) {
			avatarManager.updateState(mouthVolume, isSpeaking, emotion, action);
		}
	});
</script>

<div class="vrm-container">
	<canvas bind:this={canvas}></canvas>

	{#if isLoading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
			<p>Waking Ani up...</p>
		</div>
	{/if}

	{#if loadError}
		<div class="error-overlay">
			<p>⚠️ {loadError}</p>
		</div>
	{/if}
</div>

<style>
	.vrm-container { position: relative; width: 100%; height: 100%; overflow: hidden; }
	canvas { display: block; width: 100%; height: 100%; }

	.loading-overlay, .error-overlay {
		position: absolute; inset: 0; display: flex; flex-direction: column;
		align-items: center; justify-content: center; gap: 16px;
		color: rgba(255,255,255,0.75); font-size: 0.92rem; font-family: 'Inter', sans-serif;
	}

	.loading-spinner {
		width: 38px; height: 38px;
		border: 3px solid rgba(220,50,100,0.2);
		border-top-color: rgba(220,50,100,0.9);
		border-radius: 50%; animation: spin 0.8s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }
	.error-overlay { color: rgba(255,100,100,0.8); }
</style>
