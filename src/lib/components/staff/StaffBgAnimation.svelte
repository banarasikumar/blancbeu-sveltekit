<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let paused = $state(false);

	function handleVisibilityChange() {
		paused = document.hidden;
	}

	onMount(() => {
		document.addEventListener('visibilitychange', handleVisibilityChange);
	});

	onDestroy(() => {
		document.removeEventListener('visibilitychange', handleVisibilityChange);
	});

	const particles = Array.from({ length: 22 }, (_, i) => ({
		id: i,
		left: `${(i * 23 + 7) % 93}%`,
		delay: `${((i * 1.3) % 6).toFixed(1)}s`,
		dur: `${7 + (i % 6)}s`,
		size: `${2 + (i % 4)}px`,
		tx: i % 2 === 0 ? '35px' : '-35px',
		hue: (i * 53) % 360
	}));
</script>

<div class="s-bg-anim" class:paused aria-hidden="true">
	<!-- Aurora orbs -->
	<div class="orb orb-violet"></div>
	<div class="orb orb-rose"></div>
	<div class="orb orb-gold"></div>
	<div class="orb orb-teal"></div>
	<div class="orb orb-indigo"></div>
	<div class="orb orb-pink"></div>

	<!-- Floating sparkle particles -->
	{#each particles as p (p.id)}
		<div
			class="s-particle"
			style="left:{p.left};--delay:{p.delay};--dur:{p.dur};--size:{p.size};--tx:{p.tx};--hue:{p.hue}"
		></div>
	{/each}
</div>

<style>
	.s-bg-anim {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
	}

	/* ── Stop ALL animations when screen/tab is hidden ── */
	.s-bg-anim.paused * {
		animation-play-state: paused !important;
	}

	/* ── Aurora Orbs ── */
	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(90px);
		will-change: transform;
		animation-timing-function: ease-in-out;
		animation-iteration-count: infinite;
		animation-direction: alternate;
	}

	/* Light mode opacities (subtle) */
	:global(.staff-app.light) .orb {
		opacity: 0.55;
	}

	/* Dark mode opacities (vivid) */
	:global(.staff-app.dark) .orb {
		opacity: 0.75;
	}

	.orb-violet {
		width: 380px;
		height: 380px;
		background: radial-gradient(circle, rgba(124, 58, 237, 0.6), transparent 70%);
		top: -140px;
		left: -100px;
		animation: driftA 13s ease-in-out infinite alternate;
	}

	.orb-rose {
		width: 340px;
		height: 340px;
		background: radial-gradient(circle, rgba(244, 63, 94, 0.5), transparent 70%);
		top: 25%;
		right: -130px;
		animation: driftB 15s ease-in-out infinite alternate;
	}

	.orb-gold {
		width: 310px;
		height: 310px;
		background: radial-gradient(circle, rgba(232, 167, 48, 0.55), transparent 70%);
		bottom: 5%;
		left: 5%;
		animation: driftC 11s ease-in-out infinite alternate;
	}

	.orb-teal {
		width: 290px;
		height: 290px;
		background: radial-gradient(circle, rgba(20, 184, 166, 0.45), transparent 70%);
		bottom: -90px;
		right: -70px;
		animation: driftD 17s ease-in-out infinite alternate;
	}

	.orb-indigo {
		width: 260px;
		height: 260px;
		background: radial-gradient(circle, rgba(99, 102, 241, 0.45), transparent 70%);
		top: 55%;
		left: 25%;
		animation: driftE 10s ease-in-out infinite alternate;
	}

	.orb-pink {
		width: 230px;
		height: 230px;
		background: radial-gradient(circle, rgba(236, 72, 153, 0.4), transparent 70%);
		top: 10%;
		left: 55%;
		animation: driftF 12s ease-in-out infinite alternate;
	}

	/* ── Dark mode: more vivid gradients ── */
	:global(.staff-app.dark) .orb-violet {
		background: radial-gradient(circle, rgba(139, 92, 246, 0.7), transparent 70%);
	}
	:global(.staff-app.dark) .orb-rose {
		background: radial-gradient(circle, rgba(244, 63, 94, 0.6), transparent 70%);
	}
	:global(.staff-app.dark) .orb-gold {
		background: radial-gradient(circle, rgba(251, 191, 36, 0.55), transparent 70%);
	}
	:global(.staff-app.dark) .orb-teal {
		background: radial-gradient(circle, rgba(45, 212, 191, 0.5), transparent 70%);
	}
	:global(.staff-app.dark) .orb-indigo {
		background: radial-gradient(circle, rgba(129, 140, 248, 0.55), transparent 70%);
	}
	:global(.staff-app.dark) .orb-pink {
		background: radial-gradient(circle, rgba(244, 114, 182, 0.5), transparent 70%);
	}

	/* ── Drift Keyframes ── */
	@keyframes driftA {
		0% { transform: translate(0, 0) scale(1); }
		100% { transform: translate(90px, 110px) scale(1.18); }
	}
	@keyframes driftB {
		0% { transform: translate(0, 0) scale(1); }
		100% { transform: translate(-100px, 80px) scale(0.88); }
	}
	@keyframes driftC {
		0% { transform: translate(0, 0) scale(1) rotate(0deg); }
		100% { transform: translate(80px, -90px) scale(1.12) rotate(25deg); }
	}
	@keyframes driftD {
		0% { transform: translate(0, 0) scale(1); }
		100% { transform: translate(-70px, -80px) scale(1.22); }
	}
	@keyframes driftE {
		0% { transform: translate(0, 0) scale(1); }
		100% { transform: translate(60px, 70px) scale(0.82); }
	}
	@keyframes driftF {
		0% { transform: translate(0, 0) scale(1); }
		100% { transform: translate(-50px, 50px) scale(1.14); }
	}

	/* ── Floating Sparkle Particles ── */
	.s-particle {
		position: absolute;
		bottom: -20px;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: radial-gradient(
			circle,
			hsla(var(--hue), 90%, 75%, 0.9),
			hsla(var(--hue), 70%, 60%, 0.4)
		);
		box-shadow: 0 0 6px 2px hsla(var(--hue), 80%, 70%, 0.4);
		opacity: 0;
		animation: floatUp var(--dur) ease-in var(--delay) infinite;
		will-change: transform, opacity;
	}

	:global(.staff-app.light) .s-particle {
		opacity: 0;
	}

	@keyframes floatUp {
		0% {
			transform: translateY(0) translateX(0) scale(1);
			opacity: 0;
		}
		8% {
			opacity: 0.8;
		}
		85% {
			opacity: 0.35;
		}
		100% {
			transform: translateY(-105vh) translateX(var(--tx)) scale(0.4);
			opacity: 0;
		}
	}
</style>
