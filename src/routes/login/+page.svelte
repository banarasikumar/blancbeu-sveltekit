<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/firebase';
	import { onAuthStateChanged } from 'firebase/auth';
	import { MessageCircle } from 'lucide-svelte';
	import {
		handleGoogleLogin,
		handleWhatsAppLogin,
		checkRedirectLogin,
		checkMagicLink,
		handleLoginRedirect
	} from '$lib/services/authService';

	let loading = true;
	let unsubscribe: () => void;
	let isLoggingIn = false;

	onMount(async () => {
		// Set up auth state listener IMMEDIATELY
		// This ensures the UI updates to "Guest View" or "Logged In" without waiting for redirect checks
		unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			loading = false;
			if (currentUser) {
				// Redirect if logged in
				handleLoginRedirect();
			}
		});

		// Check for redirect result from Google auth (Non-blocking for UI)
		await checkRedirectLogin();

		// Check for magic link token in URL (Non-blocking for UI)
		await checkMagicLink();
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	const onGoogleLogin = async () => {
		if (isLoggingIn) return;
		isLoggingIn = true;
		try {
			await handleGoogleLogin();
		} finally {
			isLoggingIn = false;
		}
	};

	const onWhatsAppLogin = () => {
		handleWhatsAppLogin();
	};
</script>

<div class="page-container">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
		</div>
	{:else}
		<!-- GUEST VIEW -->
		<div class="guest-view" in:fade>
			<div class="hero-section">
				<div class="logo-wrapper">
					<span class="logo-icon">✨</span>
				</div>
				<h1 class="guest-title">Welcome to Blancbeu</h1>
				<p class="guest-subtitle">
					Sign in to unlock exclusive member benefits, track your rewards, and manage appointments.
				</p>

				<button class="auth-btn google-btn" on:click={onGoogleLogin} disabled={isLoggingIn}>
					<svg viewBox="0 0 24 24" width="20" height="20" class="google-icon">
						<path
							fill="#4285F4"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="#34A853"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="#FBBC05"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="#EA4335"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
					{isLoggingIn ? 'Signing in...' : 'Continue with Google'}
				</button>

				<div class="divider">
					<span>OR</span>
				</div>

				<!-- WHATSAPP LOGIN -->
				<div class="phone-auth-container">
					<button class="auth-btn whatsapp-btn" on:click={onWhatsAppLogin}>
						<MessageCircle size={20} class="whatsapp-icon" />
						Continue with WhatsApp
					</button>
					<p class="whatsapp-hint">We'll send you a magic login link via WhatsApp</p>
				</div>
			</div>

			<div class="preview-benefits">
				<h3>Member Perks</h3>
				<div class="benefits-grid">
					<div class="benefit-item">🎉 Birthday Gifts</div>
					<div class="benefit-item">💰 Loyalty Points</div>
					<div class="benefit-item">🚀 Priority Booking</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container {
		padding: 0 20px 100px;
		min-height: 100vh;
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		overflow-x: hidden;
	}

	/* LOADING */
	.loading-state {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 60vh;
	}
	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--color-accent-gold);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* GUEST STYLES */
	.guest-view {
		text-align: center;
		padding-top: 40px;
	}
	.logo-icon {
		font-size: 3rem;
		margin-bottom: 20px;
		display: block;
		text-shadow: 0 0 20px var(--color-accent-gold);
	}
	.guest-title {
		font-family: var(--font-heading);
		font-size: 2.5rem;
		margin-bottom: 12px;
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 4px 10px rgba(212, 175, 55, 0.3));
	}
	.guest-subtitle {
		color: var(--color-text-secondary);
		margin-bottom: 40px;
		line-height: 1.6;
		font-size: 1.1rem;
	}
	.auth-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		width: 100%;
		max-width: 320px;
		margin: 0 auto;
		padding: 16px;
		border-radius: var(--radius-full);
		border: none;
		font-weight: 600;
		cursor: pointer;
		font-size: 1.1rem;
		transition:
			transform 0.2s,
			box-shadow 0.2s,
			opacity 0.2s;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
	}
	.auth-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.google-btn {
		background: white;
		color: black;
	}
	.google-btn:active:not(:disabled) {
		transform: scale(0.98);
	}
	.google-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
	}

	.preview-benefits {
		margin-top: 60px;
		opacity: 1;
	}
	.benefits-grid {
		display: grid;
		gap: 16px;
		margin-top: 24px;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	}

	.benefit-item {
		background: rgba(255, 255, 255, 0.03);
		padding: 12px;
		border-radius: var(--radius-md);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	/* DIVIDERS & PHONE */
	.divider {
		display: flex;
		align-items: center;
		margin: 24px 0;
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		width: 100%;
		max-width: 320px;
		margin-left: auto;
		margin-right: auto;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(255, 255, 255, 0.1);
	}
	.divider span {
		padding: 0 10px;
		opacity: 0.5;
	}

	.whatsapp-btn {
		background: #25d366;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}
	.whatsapp-btn:hover {
		background: #20bd5a;
		box-shadow: 0 8px 25px rgba(37, 211, 102, 0.3);
	}

	.whatsapp-hint {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		margin-top: 12px;
		opacity: 0.7;
	}

	.phone-auth-container {
		max-width: 320px;
		margin: 0 auto;
	}
</style>
