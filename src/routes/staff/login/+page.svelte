<script lang="ts">
	import { staffSignIn, staffAuthState } from '$lib/stores/staffAuth';
	import { handleWhatsAppLogin, checkMagicLink } from '$lib/services/authService';
	import { MessageCircle } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let isLoading = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		// Check for magic link token in URL on load
		await checkMagicLink('staff');
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
			<h1>Blancbeu</h1>
			<span class="badge">Staff</span>
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

			<button class="login-btn whatsapp-btn" onclick={async () => await handleWhatsAppLogin('staff')}>
				<MessageCircle size={20} class="whatsapp-icon" />
				Continue with WhatsApp
			</button>
			<p class="whatsapp-hint">We'll send you a magic login link via WhatsApp</p>
		</div>
	</div>
</div>

<style>
	.login-container {
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f5f7;
		padding: 20px;
	}

	.login-card {
		background: white;
		padding: 40px;
		border-radius: 24px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
		width: 100%;
		max-width: 400px;
		text-align: center;
	}

	.brand {
		margin-bottom: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.brand h1 {
		font-family: 'Outfit', sans-serif;
		font-size: 2rem;
		font-weight: 700;
		color: #1c1c1e;
		margin: 0;
	}

	.badge {
		background: #000;
		color: white;
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.subtitle {
		color: #8e8e93;
		margin-bottom: 32px;
	}

	.login-btn {
		width: 100%;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid #e5e5ea;
		background: white;
		color: #1c1c1e;
		font-weight: 500;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.login-btn:hover {
		background: #f5f5f7;
		transform: translateY(-1px);
	}

	.login-btn:active {
		transform: scale(0.98);
	}

	.login-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.error-msg {
		color: #ff3b30;
		background: rgba(255, 59, 48, 0.1);
		padding: 12px;
		border-radius: 8px;
		margin-bottom: 20px;
		font-size: 0.9rem;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(0, 0, 0, 0.1);
		border-top-color: #000;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.divider {
		display: flex;
		align-items: center;
		margin: 24px 0;
		color: #8e8e93;
		font-size: 0.8rem;
		width: 100%;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #e5e5ea;
	}
	.divider span {
		padding: 0 10px;
	}

	.whatsapp-btn {
		background: #25d366;
		color: white;
		border-color: #25d366;
	}

	.whatsapp-btn:hover {
		background: #20bd5a;
		border-color: #20bd5a;
	}

	.whatsapp-hint {
		color: #8e8e93;
		font-size: 0.85rem;
		margin-top: 12px;
	}
</style>
