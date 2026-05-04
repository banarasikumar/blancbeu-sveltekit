<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import confetti from 'canvas-confetti';
	import { Sparkles, Heart, Star, X } from 'lucide-svelte';
	import { auth, db } from '$lib/firebase';
	import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

	export let user: any;
	export let onClose: () => void;

	let isVisible = false;

	onMount(() => {
		isVisible = true;

		// Fire confetti after a slight delay for better effect
		setTimeout(() => {
			fireConfetti();
		}, 300);
	});

	function fireConfetti() {
		const duration = 3000;
		const animationEnd = Date.now() + duration;
		const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

		function randomInRange(min: number, max: number) {
			return Math.random() * (max - min) + min;
		}

		const interval: any = setInterval(function () {
			const timeLeft = animationEnd - Date.now();

			if (timeLeft <= 0) {
				return clearInterval(interval);
			}

			const particleCount = 50 * (timeLeft / duration);

			// Fire from two sides
			confetti(
				Object.assign({}, defaults, {
					particleCount,
					origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
					colors: ['#d4af37', '#ff4b4b', '#ffffff', '#ff9999']
				})
			);
			confetti(
				Object.assign({}, defaults, {
					particleCount,
					origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
					colors: ['#d4af37', '#ff4b4b', '#ffffff', '#ff9999']
				})
			);
		}, 250);
	}

	async function handleClaim() {
		await updateBonusClaimed();
		sessionStorage.setItem('playWalletAnimation', 'true');
		goto('/you');
		onClose();
	}

	async function handleDismiss() {
		await updateBonusClaimed();
		sessionStorage.setItem('playWalletAnimation', 'true');
		onClose();
	}

	async function updateBonusClaimed() {
		if (!user?.uid) return;
		try {
			const userRef = doc(db, 'users', user.uid);
			await updateDoc(userRef, {
				welcomeBonusClaimed: true,
				beuCash: increment(500)
			});
			console.log('Welcome bonus claimed and Beu Cash updated.');
		} catch (error) {
			console.error('Error claiming welcome bonus:', error);
		}
	}
</script>

{#if isVisible}
	<div class="welcome-overlay" in:fade={{ duration: 400 }} out:fade={{ duration: 300 }}>
		<div class="welcome-card" in:fly={{ y: 50, duration: 600, delay: 100 }}>
			<!-- Close Button -->
			<button class="close-btn" on:click={handleDismiss}>
				<X size={20} />
			</button>

			<!-- Floating Red Hot Shapes & Sparkles -->
			<div class="floating-shapes">
				<div class="shape shape-1"><Heart fill="#ff4b4b" color="#ff4b4b" size={32} /></div>
				<div class="shape shape-2"><Sparkles color="#d4af37" size={24} /></div>
				<div class="shape shape-3"><Heart fill="#ff9999" color="#ff9999" size={20} /></div>
				<div class="shape shape-4"><Star fill="#d4af37" color="#d4af37" size={28} /></div>
			</div>

			<!-- Main Content -->
			<div class="content-wrapper">
				<div class="icon-container" in:scale={{ duration: 500, delay: 400 }}>
					<span class="emoji">✨</span>
				</div>

				<h2 class="title">Welcome to Blancbeu!</h2>
				<p class="subtitle">We're so glad you're here.</p>

				<div class="bonus-box">
					<span class="bonus-label">Your Welcome Gift</span>
					<div class="bonus-amount">
						<span class="currency">₹</span>
						<span class="amount">500</span>
					</div>
					<span class="bonus-text">Beu Cash added to your wallet!</span>
				</div>

				<p class="terms">Use it towards your first booking. <br />*T&C Apply</p>

				<button class="claim-btn" on:click={handleClaim}>
					View My Wallet
					<Sparkles size={18} />
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.welcome-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 9990; /* Very high z-index to sit on top of everything */
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.welcome-card {
		background: rgba(30, 30, 30, 0.85); /* Dark premium glass */
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(212, 175, 55, 0.3); /* Gold border */
		border-radius: 28px;
		width: 100%;
		max-width: 420px;
		position: relative;
		overflow: hidden;
		box-shadow:
			0 20px 50px rgba(0, 0, 0, 0.5),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.welcome-card::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.15), transparent 60%);
		pointer-events: none;
	}

	.close-btn {
		position: absolute;
		top: 16px;
		right: 16px;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		cursor: pointer;
		z-index: 10;
		transition: background 0.2s;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	/* Floating Shapes */
	.floating-shapes {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 1;
	}

	.shape {
		position: absolute;
		animation: float 6s ease-in-out infinite;
		opacity: 0.8;
	}

	.shape-1 {
		top: 15%;
		left: 10%;
		animation-delay: 0s;
	}
	.shape-2 {
		top: 25%;
		right: 15%;
		animation-delay: -2s;
	}
	.shape-3 {
		bottom: 30%;
		left: 15%;
		animation-delay: -4s;
	}
	.shape-4 {
		bottom: 20%;
		right: 10%;
		animation-delay: -1s;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0) rotate(0deg);
		}
		50% {
			transform: translateY(-15px) rotate(10deg);
		}
	}

	/* Content */
	.content-wrapper {
		position: relative;
		z-index: 2;
		padding: 40px 30px 30px;
		text-align: center;
	}

	.icon-container {
		width: 70px;
		height: 70px;
		background: var(--gradient-gold);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 20px;
		box-shadow: 0 0 30px rgba(212, 175, 55, 0.4);
	}

	.emoji {
		font-size: 2rem;
		line-height: 1;
	}

	.title {
		font-family: var(--font-heading, 'Playfair Display', serif);
		font-size: 2rem;
		color: #fff;
		margin: 0 0 8px;
		line-height: 1.2;
	}

	.subtitle {
		color: rgba(255, 255, 255, 0.7);
		font-size: 1.1rem;
		margin: 0 0 30px;
	}

	.bonus-box {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(212, 175, 55, 0.2);
		border-radius: 20px;
		padding: 24px;
		margin-bottom: 24px;
		position: relative;
		overflow: hidden;
	}

	.bonus-box::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), transparent);
		pointer-events: none;
	}

	.bonus-label {
		display: block;
		color: var(--color-accent-gold, #d4af37);
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 8px;
	}

	.bonus-amount {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		margin-bottom: 8px;
	}

	.currency {
		font-size: 2rem;
		font-weight: 600;
		color: #fff;
		margin-top: -10px;
	}

	.amount {
		font-size: 3.5rem;
		font-weight: 800;
		color: #fff;
		line-height: 1;
		font-family: var(--font-heading, sans-serif);
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.bonus-text {
		display: block;
		color: rgba(255, 255, 255, 0.9);
		font-size: 1rem;
		font-weight: 500;
	}

	.terms {
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 30px;
		line-height: 1.4;
	}

	.claim-btn {
		width: 100%;
		padding: 16px;
		border-radius: 100px;
		background: var(--gradient-gold);
		color: #1a1a1a;
		font-size: 1.1rem;
		font-weight: 700;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
	}

	.claim-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
	}

	.claim-btn:active {
		transform: translateY(1px);
	}
</style>
