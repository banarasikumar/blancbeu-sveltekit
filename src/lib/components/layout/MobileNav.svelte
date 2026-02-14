<script lang="ts">
	import { page, navigating } from '$app/stores';
	import { goto } from '$app/navigation';
	import { saveScrollPosition, restoreScrollPosition, scrollToTop } from '$lib/stores/scroll';

	// Simple active check
	$: activeRoute = $page.url.pathname;

	// Navigation items config
	const navItems = [
		{ href: '/', label: 'Home', iconId: 'home', matcher: (path: string) => path === '/' },
		{
			href: '/services',
			label: 'Services',
			iconId: 'services',
			matcher: (path: string) => path.startsWith('/services')
		},
		{
			href: '/gallery',
			label: 'Gallery',
			iconId: 'gallery',
			matcher: (path: string) => path.startsWith('/gallery')
		},
		{
			href: '/you',
			label: 'You',
			iconId: 'you',
			matcher: (path: string) => path.startsWith('/you')
		},
		{
			href: '/booking',
			label: 'Book',
			iconId: 'book',
			isCta: true,
			matcher: (path: string) => path.startsWith('/booking')
		}
	];

	// Handle navigation click
	function handleNavClick(e: MouseEvent, item: (typeof navItems)[0]) {
		// Prevent double-clicks or conflicting navigations
		if ($navigating) {
			e.preventDefault();
			return;
		}

		const isActive = item.matcher(activeRoute);

		if (isActive) {
			e.preventDefault();
			// Force scroll to top manually since navigation won't trigger layout reset
			const containerId = 'mobile-viewport';
			const simulatorContainer = document.getElementById(containerId);

			if (simulatorContainer) {
				simulatorContainer.scrollTo({ top: 0, behavior: 'smooth' });
			}
			// Always try window/body too
			window.scrollTo({ top: 0, behavior: 'smooth' });
			document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
			document.body.scrollTo({ top: 0, behavior: 'smooth' });

			// Also try explicit scrollTop assignment for immediate effect if smooth fails
			// or if user prefers instant. But 'smooth' is usually desired for "back to top".
		} else {
			e.preventDefault();
			saveScrollPosition(activeRoute);
			goto(item.href, { noScroll: true });
		}
	}

	// Restore scroll position after navigation
</script>

<nav class="mobile-nav">
	<!-- Subtle gold gradient line at top of nav -->
	<div class="nav-glow-line"></div>

	{#each navItems as item}
		{@const isActive = item.matcher(activeRoute)}
		<a
			href={item.href}
			class="nav-item"
			class:active={isActive}
			class:cta={item.isCta}
			on:click={(e) => handleNavClick(e, item)}
		>
			<!-- Active pill indicator -->
			{#if isActive && !item.isCta}
				<div class="active-pill"></div>
			{/if}

			<div class="icon-box" class:cta-icon={item.isCta}>
				{#if item.iconId === 'home'}
					<!-- Premium Home: Elegant arch doorway -->
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H15V15C15 13.34 13.66 12 12 12C10.34 12 9 13.34 9 15V21H4C3.45 21 3 20.55 3 20V10.5Z"
							stroke="currentColor"
							stroke-width={isActive ? 1.8 : 1.3}
							stroke-linecap="round"
							stroke-linejoin="round"
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.15 : 0}
						/>
						<path
							d="M12 3L2 11"
							stroke="currentColor"
							stroke-width={isActive ? 1.8 : 1.3}
							stroke-linecap="round"
						/>
						<path
							d="M12 3L22 11"
							stroke="currentColor"
							stroke-width={isActive ? 1.8 : 1.3}
							stroke-linecap="round"
						/>
					</svg>
				{:else if item.iconId === 'services'}
					<!-- Premium Sparkles: Luxury 4-point star cluster -->
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<!-- Main large 4-point star -->
						<path
							d="M12 2C12 2 13.5 7.5 14.5 9.5C15.5 11.5 18 12 22 12C18 12 15.5 12.5 14.5 14.5C13.5 16.5 12 22 12 22C12 22 10.5 16.5 9.5 14.5C8.5 12.5 6 12 2 12C6 12 8.5 11.5 9.5 9.5C10.5 7.5 12 2 12 2Z"
							stroke="currentColor"
							stroke-width={isActive ? 1.5 : 1.2}
							stroke-linejoin="round"
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.2 : 0}
						/>
						<!-- Small accent star top-right -->
						<path
							d="M18.5 2C18.5 2 19 3.5 19.5 4C20 4.5 21.5 5 21.5 5C21.5 5 20 5.5 19.5 6C19 6.5 18.5 8 18.5 8C18.5 8 18 6.5 17.5 6C17 5.5 15.5 5 15.5 5C15.5 5 17 4.5 17.5 4C18 3.5 18.5 2 18.5 2Z"
							stroke="currentColor"
							stroke-width={isActive ? 1.3 : 1}
							stroke-linejoin="round"
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.3 : 0}
						/>
					</svg>
				{:else if item.iconId === 'gallery'}
					<!-- Premium Gallery: Elegant grid mosaic -->
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<!-- Top-left large tile -->
						<rect
							x="3"
							y="3"
							width="9"
							height="9"
							rx="2.5"
							stroke="currentColor"
							stroke-width={isActive ? 1.6 : 1.2}
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.12 : 0}
						/>
						<!-- Top-right small tile -->
						<rect
							x="14.5"
							y="3"
							width="6.5"
							height="6.5"
							rx="2"
							stroke="currentColor"
							stroke-width={isActive ? 1.6 : 1.2}
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.12 : 0}
						/>
						<!-- Bottom-left small tile -->
						<rect
							x="3"
							y="14.5"
							width="6.5"
							height="6.5"
							rx="2"
							stroke="currentColor"
							stroke-width={isActive ? 1.6 : 1.2}
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.12 : 0}
						/>
						<!-- Bottom-right large tile -->
						<rect
							x="12"
							y="12"
							width="9"
							height="9"
							rx="2.5"
							stroke="currentColor"
							stroke-width={isActive ? 1.6 : 1.2}
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.12 : 0}
						/>
					</svg>
				{:else if item.iconId === 'you'}
					<!-- Premium User: Elegant profile silhouette -->
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<!-- Head circle -->
						<circle
							cx="12"
							cy="8.5"
							r="4"
							stroke="currentColor"
							stroke-width={isActive ? 1.6 : 1.2}
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.15 : 0}
						/>
						<!-- Body arc -->
						<path
							d="M4 21C4 17.13 7.58 14 12 14C16.42 14 20 17.13 20 21"
							stroke="currentColor"
							stroke-width={isActive ? 1.6 : 1.2}
							stroke-linecap="round"
							fill={isActive ? 'currentColor' : 'none'}
							fill-opacity={isActive ? 0.1 : 0}
						/>
						<!-- Subtle accent line under -->
						{#if isActive}
							<path
								d="M6 21H18"
								stroke="currentColor"
								stroke-width="1.2"
								stroke-linecap="round"
								opacity="0.4"
							/>
						{/if}
					</svg>
				{:else if item.iconId === 'book'}
					<!-- Premium Calendar: Bold booking icon -->
					<svg
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<!-- Calendar body -->
						<rect
							x="3"
							y="5"
							width="18"
							height="16"
							rx="3"
							stroke="currentColor"
							stroke-width="1.8"
							fill="none"
						/>
						<!-- Calendar top hooks -->
						<path d="M8 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<path d="M16 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<!-- Divider line -->
						<path d="M3 10H21" stroke="currentColor" stroke-width="1.5" />
						<!-- Plus icon in center -->
						<path d="M12 13.5V18.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<path d="M9.5 16H14.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					</svg>
				{/if}
			</div>
			<span class="label">{item.label}</span>

			<!-- Gold glow dot under active item -->
			{#if isActive && !item.isCta}
				<div class="glow-dot"></div>
			{/if}
		</a>
	{/each}
</nav>

<style>
	.mobile-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 72px;
		padding-bottom: env(safe-area-inset-bottom);
		background: rgba(var(--color-bg-primary-rgb), 0.85);
		backdrop-filter: blur(24px) saturate(1.4);
		-webkit-backdrop-filter: blur(24px) saturate(1.4);
		border-top: 1px solid rgba(var(--color-accent-gold-rgb), 0.08);
		box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
		display: flex;
		justify-content: space-evenly;
		align-items: center;
		z-index: 1000;
	}

	/* Subtle gold gradient glow at top of nav */
	.nav-glow-line {
		position: absolute;
		top: -1px;
		left: 10%;
		width: 80%;
		height: 2px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(var(--color-accent-gold-rgb), 0.25) 30%,
			rgba(var(--color-accent-gold-rgb), 0.4) 50%,
			rgba(var(--color-accent-gold-rgb), 0.25) 70%,
			transparent 100%
		);
		pointer-events: none;
	}

	.nav-item {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: var(--color-text-secondary);
		opacity: 0.7;
		width: 56px;
		padding: 6px 0;
		transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
		-webkit-tap-highlight-color: transparent;
	}

	.nav-item:active:not(.cta) {
		transform: scale(0.92);
	}

	.nav-item.active {
		color: var(--color-accent-gold);
		opacity: 1;
	}

	/* Pill-shaped active highlight behind icon */
	.active-pill {
		position: absolute;
		top: 2px;
		left: 50%;
		transform: translateX(-50%);
		width: 40px;
		height: 32px;
		background: radial-gradient(
			ellipse at center,
			rgba(var(--color-accent-gold-rgb), 0.12) 0%,
			rgba(var(--color-accent-gold-rgb), 0.04) 60%,
			transparent 100%
		);
		border-radius: 16px;
		pointer-events: none;
		animation: pillFadeIn 0.4s ease-out;
	}

	@keyframes pillFadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) scale(0.7);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) scale(1);
		}
	}

	.icon-box {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		margin-bottom: 3px;
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		z-index: 1;
	}

	.icon-box :global(svg) {
		transition: filter 0.35s ease;
	}

	.nav-item.active .icon-box {
		transform: translateY(-2px);
	}

	.nav-item.active .icon-box :global(svg) {
		filter: drop-shadow(0 0 6px rgba(var(--color-accent-gold-rgb), 0.4));
	}

	.label {
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		z-index: 1;
		transition: all 0.35s ease;
	}

	.nav-item.active .label {
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	/* Gold glow dot indicator */
	.glow-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--color-accent-gold);
		margin-top: 3px;
		box-shadow:
			0 0 6px rgba(var(--color-accent-gold-rgb), 0.6),
			0 0 12px rgba(var(--color-accent-gold-rgb), 0.3);
		animation: dotPulse 2.5s ease-in-out infinite;
	}

	@keyframes dotPulse {
		0%,
		100% {
			opacity: 1;
			box-shadow:
				0 0 6px rgba(var(--color-accent-gold-rgb), 0.6),
				0 0 12px rgba(var(--color-accent-gold-rgb), 0.3);
		}
		50% {
			opacity: 0.7;
			box-shadow:
				0 0 8px rgba(var(--color-accent-gold-rgb), 0.8),
				0 0 16px rgba(var(--color-accent-gold-rgb), 0.4);
		}
	}

	/* CTA Item Special Styling (Book Button) */
	.nav-item.cta {
		position: relative;
		bottom: 14px;
		right: auto;
	}

	.cta-icon {
		width: 50px;
		height: 50px;
		background: var(--gradient-gold);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 4px 16px rgba(var(--color-accent-gold-rgb), 0.45),
			0 1px 3px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		border: 3px solid var(--color-bg-primary);
		color: var(--color-bg-primary);
		animation: pulse-gold 3.5s infinite;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.nav-item.cta:active .cta-icon {
		transform: scale(0.93);
		box-shadow: 0 2px 8px rgba(var(--color-accent-gold-rgb), 0.3);
	}

	.nav-item.cta .label {
		color: var(--color-text-primary, #fff);
		font-weight: 700;
		margin-top: 4px;
		font-size: 9px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	@keyframes pulse-gold {
		0% {
			box-shadow:
				0 4px 16px rgba(var(--color-accent-gold-rgb), 0.45),
				0 1px 3px rgba(0, 0, 0, 0.3),
				inset 0 1px 0 rgba(255, 255, 255, 0.2),
				0 0 0 0 rgba(var(--color-accent-gold-rgb), 0.25);
		}
		50% {
			box-shadow:
				0 4px 16px rgba(var(--color-accent-gold-rgb), 0.45),
				0 1px 3px rgba(0, 0, 0, 0.3),
				inset 0 1px 0 rgba(255, 255, 255, 0.2),
				0 0 0 10px rgba(var(--color-accent-gold-rgb), 0);
		}
		100% {
			box-shadow:
				0 4px 16px rgba(var(--color-accent-gold-rgb), 0.45),
				0 1px 3px rgba(0, 0, 0, 0.3),
				inset 0 1px 0 rgba(255, 255, 255, 0.2),
				0 0 0 0 rgba(var(--color-accent-gold-rgb), 0);
		}
	}
</style>
