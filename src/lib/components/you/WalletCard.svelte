<script lang="ts">
	import { Wallet, ChevronRight, Sparkles } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { onMount } from 'svelte';

	export let balance = 0;
	export let loading = false;

	let shouldAnimate = false;

	onMount(() => {
		if (sessionStorage.getItem('playWalletAnimation') === 'true') {
			shouldAnimate = true;
			sessionStorage.removeItem('playWalletAnimation');
		}
	});

	const animatedBalance = tweened(0, {
		duration: 2000,
		easing: cubicOut
	});

	// Animate whenever balance changes
	$: {
		if (!loading) {
			if (shouldAnimate && $animatedBalance === 0) {
				// Play the increasing animation once
				animatedBalance.set(balance, { duration: 2000 });
			} else {
				// Snap immediately for standard page loads
				animatedBalance.set(balance, { duration: 0 });
			}
		}
	}

	function handleUse() {
		goto('/booking');
	}
</script>

<div
	class="wallet-card glass-panel"
	class:jackpot={balance === 500 && !loading}
	role="button"
	tabindex="0"
>
	<div class="wallet-bg-glow"></div>
	<div class="wallet-content">
		<div class="wallet-left">
			<div class="icon-container">
				<Wallet size={24} />
			</div>
			<div class="wallet-info">
				<span class="wallet-label">Beu Cash Balance</span>
				<div class="balance-amount">
					<span class="currency">₹</span>
					{#if loading}
						<span class="loading-dots">
							<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
						</span>
					{:else}
						<span class="amount">{Math.floor($animatedBalance).toLocaleString()}</span>
					{/if}
				</div>
			</div>
		</div>
		<div class="wallet-right">
			<button class="history-btn" onclick={handleUse}>
				<Sparkles size={14} class="sparkle-icon" />
				<span>Use</span>
				<ChevronRight size={16} />
			</button>
		</div>
	</div>
</div>

<style>
	.wallet-card {
		background: var(--color-bg-glass, rgba(255, 255, 255, 0.05));
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
		border-radius: 20px;
		margin-bottom: 24px;
		position: relative;
		overflow: hidden;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wallet-card:active {
		transform: scale(0.98);
	}

	.wallet-bg-glow {
		position: absolute;
		top: -50%;
		left: -20%;
		width: 140%;
		height: 200%;
		background: radial-gradient(
			circle at 30% 50%,
			rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.12),
			transparent 50%
		);
		pointer-events: none;
		z-index: 0;
	}

	.wallet-content {
		padding: 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: relative;
		z-index: 1;
	}

	.wallet-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.icon-container {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.15);
		color: var(--color-accent-gold, #d4af37);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 0 10px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.2);
	}

	.wallet-info {
		display: flex;
		flex-direction: column;
	}

	.wallet-label {
		font-size: 0.85rem;
		color: var(--color-text-primary, #fff);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		margin-bottom: 4px;
	}

	.balance-amount {
		display: flex;
		align-items: baseline;
		gap: 2px;
		font-family: var(--font-heading, sans-serif);
		background: var(--gradient-gold, linear-gradient(135deg, #f5d061, #d4af37));
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.currency {
		font-size: 1.2rem;
		font-weight: 600;
	}

	.amount {
		font-size: 1.8rem;
		font-weight: 700;
		line-height: 1;
	}

	.history-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 8px 12px;
		border-radius: 20px;
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-primary, #fff);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.sparkle-icon {
		color: var(--color-accent-gold, #d4af37);
	}

	.wallet-card:hover .history-btn {
		background: rgba(255, 255, 255, 0.1);
	}

	/* Loading Dots Animation */
	.loading-dots {
		display: inline-flex;
		align-items: baseline;
		font-size: 1.8rem;
		font-weight: 700;
		line-height: 1;
		color: #fff;
	}

	.dot {
		animation: pulse-dot 1.4s infinite ease-in-out both;
	}

	.dot:nth-child(1) {
		animation-delay: -0.32s;
	}
	.dot:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes pulse-dot {
		0%,
		80%,
		100% {
			transform: scale(0);
			opacity: 0.3;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Jackpot 500 Styling */
	.wallet-card.jackpot {
		animation: border-sparkle 3s linear infinite;
	}

	.wallet-card.jackpot::before {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: 22px;
		padding: 2px;
		background: linear-gradient(
			45deg,
			#ff0000,
			#ff7300,
			#fffb00,
			#48ff00,
			#00ffd5,
			#002bff,
			#7a00ff,
			#ff00c8,
			#ff0000
		);
		background-size: 400%;
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		animation: rgb-border 3s linear infinite;
		z-index: 0;
	}

	@keyframes rgb-border {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0% 50%;
		}
	}

	@keyframes border-sparkle {
		0% {
			box-shadow: 0 0 15px rgba(255, 0, 0, 0.4);
		}
		33% {
			box-shadow: 0 0 15px rgba(0, 255, 0, 0.4);
		}
		66% {
			box-shadow: 0 0 15px rgba(0, 0, 255, 0.4);
		}
		100% {
			box-shadow: 0 0 15px rgba(255, 0, 0, 0.4);
		}
	}
</style>
