<script lang="ts">
	import { adminAuthState, adminSignIn } from '$lib/stores/adminAuth';
	import { handleWhatsAppLogin, checkMagicLink } from '$lib/services/authService';
	import { MessageCircle } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let loading = $state(false);
	let error = $state('');
	let denied = $state(false);

	onMount(async () => {
		// Check for magic link token in URL on load
		await checkMagicLink('admin');
	});

	// Watch for denied state
	$effect(() => {
		if ($adminAuthState === 'denied') {
			denied = true;
			loading = false;
		}
	});

	async function handleLogin() {
		error = '';
		denied = false;
		loading = true;
		try {
			await adminSignIn();
		} catch (e: any) {
			error = e.message || 'Login failed. Please try again.';
			loading = false;
		}
	}
</script>

<div class="admin-auth-container">
	<div class="admin-auth-card">
		<!-- Logo -->
		<div style="margin-bottom: 28px;">
			<div
				style="width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #007AFF, #5856D6); display: flex; align-items: center; justify-content: center; margin: 0 auto; box-shadow: 0 8px 32px rgba(0, 122, 255, 0.3);"
			>
				<svg
					width="32"
					height="32"
					viewBox="0 0 24 24"
					fill="none"
					stroke="white"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 15v2" />
					<path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
					<path d="M17.5 19a2.5 2.5 0 0 0 0-5H17" />
					<path d="M6.5 19a2.5 2.5 0 0 1 0-5H7" />
					<rect x="2" y="4" width="20" height="16" rx="3" />
				</svg>
			</div>
		</div>

		<h1>Admin Panel</h1>
		<p>Sign in with your authorized account to access the Blancbeu administration dashboard.</p>

		<button class="admin-login-btn" onclick={handleLogin} disabled={loading}>
			{#if loading}
				<div class="admin-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
				<span>Signing in...</span>
			{:else}
				<svg width="20" height="20" viewBox="0 0 48 48">
					<path
						fill="#EA4335"
						d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
					/>
					<path
						fill="#4285F4"
						d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
					/>
					<path
						fill="#FBBC05"
						d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
					/>
					<path
						fill="#34A853"
						d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
					/>
				</svg>
				<span>Sign in with Google</span>
			{/if}
		</button>

		<div class="admin-divider">
			<span>OR</span>
		</div>

		<div class="phone-auth-container">
			<button
				class="admin-login-btn whatsapp-btn"
				onclick={async () => await handleWhatsAppLogin('admin')}
			>
				<MessageCircle size={20} class="whatsapp-icon" />
				<span>Continue with WhatsApp</span>
			</button>
			<p class="whatsapp-hint">We'll send you a magic login link via WhatsApp</p>
		</div>

		{#if error}
			<div class="admin-auth-error">
				{error}
			</div>
		{/if}

		{#if denied}
			<div class="admin-access-denied">
				🚫 Access Denied — Your account does not have admin privileges.
			</div>
		{/if}
	</div>
</div>

<style>
	.admin-divider {
		display: flex;
		align-items: center;
		margin: 24px 0;
		color: var(--color-text-secondary, #8e8e93);
		font-size: 0.8rem;
		width: 100%;
	}
	.admin-divider::before,
	.admin-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border, #e5e5ea);
	}
	.admin-divider span {
		padding: 0 10px;
	}

	.whatsapp-btn {
		background: #25d366 !important;
		color: white !important;
		border-color: #25d366 !important;
	}

	.whatsapp-btn:hover {
		background: #20bd5a !important;
		border-color: #20bd5a !important;
	}

	.whatsapp-hint {
		color: var(--color-text-secondary, #8e8e93);
		font-size: 0.85rem;
		margin-top: 12px;
		text-align: center;
	}
</style>
