<script lang="ts">
	import { staffSignIn, staffAuthState } from '$lib/stores/staffAuth';
	import { handleWhatsAppLogin, checkMagicLink } from '$lib/services/authService';
	import { MessageCircle } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';

	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let prevState = $state<string>('loading');

	let stateUnsub: (() => void) | null = null;

	onMount(() => {
		// React to auth state changes to surface denial errors in the UI
		stateUnsub = staffAuthState.subscribe((state) => {
			if (state === 'denied') {
				error = 'Access denied. This Google account is not authorized for the staff portal.';
				isLoading = false;
			} else if (state === 'unauthenticated' && prevState === 'checking') {
				// Signed out after failed role check — reset loading so button re-enables
				isLoading = false;
			}
			prevState = state;
		});
	});

	onDestroy(() => {
		if (stateUnsub) stateUnsub();
	});

	$effect(() => {
		// Reactively check for magic links when the URL parameters update (Deep Link fix)
		if (page.url.searchParams.has('token')) {
			checkMagicLink('staff');
		}
	});

	async function handleLogin() {
		isLoading = true;
		error = null;
		try {
			await staffSignIn();
			// Auth state listener in layout will handle redirect
		} catch (e: any) {
			console.error(e);
			error = 'Login failed. Please try again.';
			isLoading = false;
		}
	}
</script>

<div class="login-container">
	<div class="login-card">
		<div class="brand">
			<div class="brand-logo">
				<span class="brand-logo-letter">B</span>
			</div>
			<h1>Blancbeu</h1>
			<span class="brand-badge">Stylist Portal</span>
		</div>

		<p class="subtitle">Sign in to manage appointments</p>

		{#if error}
			<div class="error-msg">{error}</div>
		{/if}

		<button class="login-btn" onclick={handleLogin} disabled={isLoading}>
			{#if isLoading}
				<span class="spinner"></span>
			{:else}
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
				Sign in with Google
			{/if}
		</button>

		<div class="divider">
			<span>OR</span>
		</div>

		<div class="phone-auth-container">
			<button
				class="login-btn whatsapp-btn"
				onclick={async () => await handleWhatsAppLogin('staff')}
			>
				<MessageCircle size={20} class="whatsapp-icon" />
				Continue with WhatsApp
			</button>
			<p class="whatsapp-hint">We'll send you a magic login link via WhatsApp</p>
		</div>
	</div>
</div>

<style>
	.login-container {
		position: relative;
		height: 100vh;
		height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		z-index: 1;
	}

	.login-card {
		background: var(--s-bg-glass-strong, rgba(253, 252, 255, 0.92));
		backdrop-filter: var(--s-blur-strong, blur(32px));
		-webkit-backdrop-filter: var(--s-blur-strong, blur(32px));
		padding: 40px 36px;
		border-radius: 28px;
		border: 1px solid var(--s-border, rgba(100, 80, 160, 0.08));
		box-shadow:
			0 8px 40px rgba(100, 60, 200, 0.12),
			0 0 0 1px rgba(255, 255, 255, 0.5) inset;
		width: 100%;
		max-width: 380px;
		text-align: center;
		animation: s-fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global(.staff-app.dark) .login-card {
		background: var(--s-bg-glass-strong, rgba(16, 14, 26, 0.94));
		border-color: var(--s-border, rgba(180, 160, 255, 0.07));
		box-shadow:
			0 8px 48px rgba(0, 0, 0, 0.6),
			0 0 0 1px rgba(180, 160, 255, 0.06) inset;
	}

	.brand {
		margin-bottom: 28px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.brand-logo {
		width: 72px;
		height: 72px;
		border-radius: 20px;
		background: var(--s-grad-hero, linear-gradient(135deg, #1a0a2e 0%, #3730a3 40%, #7c3aed 100%));
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 8px 28px rgba(124, 58, 237, 0.45),
			0 0 0 1px rgba(255, 255, 255, 0.1) inset;
		margin-bottom: 4px;
		animation: s-float 3.5s ease-in-out infinite;
		position: relative;
	}

	.brand-logo-letter {
		font-family: 'Outfit', sans-serif;
		font-size: 2.2rem;
		font-weight: 800;
		background: linear-gradient(135deg, #ffffff 0%, #f5c866 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.brand h1 {
		font-family: 'Outfit', sans-serif;
		font-size: 2rem;
		font-weight: 800;
		margin: 0;
		letter-spacing: -0.04em;
		background: var(--s-grad-hero, linear-gradient(135deg, #1a0a2e 0%, #7c3aed 100%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	:global(.staff-app.dark) .brand h1 {
		background: var(--s-grad-aurora, linear-gradient(135deg, #a78bfa 0%, #fb7185 50%, #f5c040 100%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.brand-badge {
		background: var(--s-grad-violet, linear-gradient(135deg, #7c3aed, #4f46e5));
		color: white;
		padding: 3px 14px;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		box-shadow: 0 2px 10px rgba(124, 58, 237, 0.35);
	}

	.subtitle {
		color: var(--s-text-secondary, #6b6680);
		margin-bottom: 28px;
		font-size: 0.92rem;
		font-weight: 500;
	}

	.login-btn {
		width: 100%;
		padding: 13px 16px;
		border-radius: 14px;
		border: 1px solid var(--s-border-strong, rgba(100, 80, 160, 0.15));
		background: var(--s-surface, rgba(255, 255, 255, 0.95));
		color: var(--s-text-primary, #12091e);
		font-family: 'Inter', sans-serif;
		font-weight: 600;
		font-size: 0.95rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 2px 12px rgba(100, 60, 200, 0.06);
	}

	:global(.staff-app.dark) .login-btn {
		background: var(--s-surface, #1a1628);
		border-color: var(--s-border-strong, rgba(180, 160, 255, 0.14));
		color: var(--s-text-primary, #f0eeff);
	}

	.login-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(100, 60, 200, 0.14);
		border-color: var(--s-border-accent, rgba(232, 167, 48, 0.3));
	}

	.login-btn:active {
		transform: scale(0.97);
		box-shadow: 0 2px 8px rgba(100, 60, 200, 0.08);
	}

	.login-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.error-msg {
		color: var(--s-error, #ef4444);
		background: var(--s-error-bg, #fef2f2);
		padding: 12px 16px;
		border-radius: 12px;
		margin-bottom: 20px;
		font-size: 0.88rem;
		font-weight: 500;
		border: 1px solid rgba(239, 68, 68, 0.2);
		text-align: left;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2.5px solid var(--s-accent-2-bg, rgba(124, 58, 237, 0.15));
		border-top-color: var(--s-accent-2, #7c3aed);
		border-radius: 50%;
		animation: s-spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	.divider {
		display: flex;
		align-items: center;
		margin: 22px 0;
		color: var(--s-text-tertiary, #b0aac0);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		width: 100%;
		gap: 12px;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--s-border, rgba(100, 80, 160, 0.08));
	}

	.whatsapp-btn {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
	}

	.whatsapp-btn:hover {
		background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
		border-color: transparent;
		box-shadow: 0 6px 24px rgba(34, 197, 94, 0.4);
		transform: translateY(-2px);
	}

	.whatsapp-hint {
		color: var(--s-text-tertiary, #b0aac0);
		font-size: 0.8rem;
		margin-top: 10px;
		font-weight: 500;
	}

	@keyframes s-fadeInUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@keyframes s-spin {
		to { transform: rotate(360deg); }
	}
	@keyframes s-float {
		0%, 100% { transform: translateY(0px); }
		50% { transform: translateY(-8px); }
	}
</style>
