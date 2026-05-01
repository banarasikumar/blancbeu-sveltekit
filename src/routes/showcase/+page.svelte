<script lang="ts">
	import './showcase.css';
	import { onMount, tick } from 'svelte';

	let mounted = $state(false);

	// Intersection Observer for scroll reveal
	onMount(async () => {
		mounted = true;
		await tick();
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (e.isIntersecting) {
						e.target.classList.add('visible');
					}
				});
			},
			{ threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
		);
		document.querySelectorAll('.sc-reveal').forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	});

	// ========== DATA ==========
	const usps = [
		{
			title: 'Cost-Free WhatsApp Auth',
			desc: 'Custom WhatsApp login bot — no paid Business API required. Save thousands monthly.',
			icon: '💬'
		},
		{
			title: 'Edge Deployment',
			desc: 'Deployed on Vercel\u0027s global edge network with auto load-balancing & zero downtime.',
			icon: '🚀'
		},
		{
			title: 'SVG-to-PDF Invoices',
			desc: 'Pixel-perfect invoice generation on the client-side. No server overhead.',
			icon: '📄'
		},
		{
			title: 'Real-Time Sync',
			desc: 'Firebase RTDB — bookings update across all apps in milliseconds.',
			icon: '⚡'
		}
	];

	const appEcosystem = [
		{
			title: 'Customer App',
			platform: 'Web & Android',
			pages: '12+ Pages',
			color: '#6366f1',
			features: [
				'Immersive Mobile-First UI',
				'WhatsApp OTP Auth',
				'Real-time Slot Booking',
				'Service Categories & Gallery',
				'Profile & History',
				'Push Notifications',
				'PWA Installable'
			]
		},
		{
			title: 'Admin Dashboard',
			platform: 'Desktop Web',
			pages: '15+ Pages',
			color: '#a855f7',
			features: [
				'Analytics Overview',
				'Staff Role Management',
				'Service & Pricing Config',
				'Real-time Appointments',
				'Invoice Generation',
				'Multi-Theme Engine',
				'Customer Database'
			]
		},
		{
			title: 'Staff Portal',
			platform: 'Web & Android',
			pages: '8+ Pages',
			color: '#f97316',
			features: [
				'Daily Schedule View',
				'One-Tap Status Updates',
				'WhatsApp Customer Link',
				'Earnings Tracking',
				'Offline-Ready',
				'Personal Profile'
			]
		}
	];

	const megaFeatures = [
		'Glassmorphic UI/UX',
		'SvelteKit 5 Runes',
		'Firebase Cloud Messaging',
		'PWA Installable',
		'Offline Fallback',
		'Capacitor Native Bridge',
		'4 Theme Engines',
		'Role-Based Access Control',
		'Dynamic Route Guards',
		'Lazy Loading',
		'Container Queries',
		'SVG Invoice Engine'
	];

	// Screenshots — put your image paths here
	const screenshots: string[] = [
		// '/showcase/screen1.png', '/showcase/screen2.png', etc.
	];

	// ========== PRICING STATE ==========
	let selectedPlanIndex = $state(1);

	const pricingCategories = [
		{
			name: 'Essential SaaS',
			price: '49,999',
			priceUsd: '599',
			priceValue: 49999,
			priceUsdValue: 599,
			target: 'Single salons & spas',
			details: [
				'Fully Hosted on Vercel',
				'Customer & Staff Web Apps',
				'Admin Control Panel',
				'Cost-free WhatsApp Bot',
				'1 Year Free Hosting',
				'Standard Support'
			]
		},
		{
			name: 'Professional Suite',
			price: '89,999',
			priceUsd: '1,099',
			priceValue: 89999,
			priceUsdValue: 1099,
			target: 'Growing brands',
			details: [
				'Everything in Essential',
				'Customer Android APK',
				'Staff Android APK',
				'Custom Branding & Logo',
				'Push Notification Setup',
				'Dedicated Account Manager'
			]
		},
		{
			name: 'Enterprise Source',
			price: '1,49,999',
			priceUsd: '1,799',
			priceValue: 149999,
			priceUsdValue: 1799,
			target: 'Agencies & developers',
			details: [
				'Full SvelteKit Source Code',
				'Android Studio Projects',
				'White-label & IP Rights',
				'Deployment Support',
				'Firebase Security Config',
				'Lifetime Usage Rights'
			]
		}
	];

	let addons = $state([
		{
			title: 'Payment Gateway',
			desc: 'Razorpay / Stripe setup for online bookings.',
			icon: '💳',
			price: '14,999',
			priceUsd: '179',
			priceValue: 14999,
			priceUsdValue: 179,
			selected: false
		},
		{
			title: 'WhatsApp Business API & Badge',
			desc: 'Official API, green tick badge & automated flows.',
			icon: '✅',
			price: '24,999',
			priceUsd: '299',
			priceValue: 24999,
			priceUsdValue: 299,
			selected: false
		},
		{
			title: 'SEO & Google Profile',
			desc: 'Google Business Profile & on-page salon SEO.',
			icon: '📈',
			price: '19,999',
			priceUsd: '239',
			priceValue: 19999,
			priceUsdValue: 239,
			selected: false
		},
		{
			title: 'Domain (.in / .com)',
			desc: 'One year registration & DNS configuration.',
			icon: '🌐',
			price: '2,999',
			priceUsd: '35',
			priceValue: 2999,
			priceUsdValue: 35,
			selected: false
		}
	]);

	let totalInr = $derived(
		pricingCategories[selectedPlanIndex].priceValue +
			addons.filter((a) => a.selected).reduce((s, a) => s + a.priceValue, 0)
	);
	let totalUsd = $derived(
		pricingCategories[selectedPlanIndex].priceUsdValue +
			addons.filter((a) => a.selected).reduce((s, a) => s + a.priceUsdValue, 0)
	);
	let fmtInr = $derived(totalInr.toLocaleString('en-IN'));
	let fmtUsd = $derived(totalUsd.toLocaleString('en-US'));
</script>

<svelte:head>
	<title>Blancbeu — Premium Salon & Spa Software Ecosystem</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

{#if mounted}
	<div class="sc-page">
		<!-- ===== HERO ===== -->
		<section class="sc-hero sc-section">
			<div class="sc-container sc-hero-inner">
				<div class="sc-badge"><span class="sc-badge-dot"></span> Enterprise Ready</div>
				<h1>The complete <span class="sc-gradient">Salon & Spa</span> software ecosystem</h1>
				<p>
					3 web apps. 2 native Android apps. Zero-cost WhatsApp auth. One unified Firebase backend —
					deployed on Vercel's global edge.
				</p>
				<div class="sc-hero-actions">
					<a href="#pricing" class="sc-btn sc-btn-primary sc-btn-lg">View Pricing</a>
					<a href="#features" class="sc-btn sc-btn-ghost sc-btn-lg">Explore Features</a>
				</div>
			</div>
		</section>

		<!-- ===== STATS BAR ===== -->
		<section class="sc-stats sc-section" style="padding: 3rem 0;">
			<div class="sc-container">
				<div class="sc-stats-grid">
					<div>
						<div class="sc-stat-num sc-gradient">5</div>
						<div class="sc-stat-label">Applications</div>
					</div>
					<div>
						<div class="sc-stat-num sc-gradient">35+</div>
						<div class="sc-stat-label">Total Pages</div>
					</div>
					<div>
						<div class="sc-stat-num sc-gradient">2</div>
						<div class="sc-stat-label">Android APKs</div>
					</div>
					<div>
						<div class="sc-stat-num sc-gradient">0</div>
						<div class="sc-stat-label">Monthly API Fees</div>
					</div>
				</div>
			</div>
		</section>

		<!-- ===== USPs ===== -->
		<section class="sc-section" id="features">
			<div class="sc-container">
				<div class="sc-sec-head sc-reveal">
					<h2>Why this stands apart</h2>
					<p>Built for salon owners who refuse to pay monthly API subscriptions.</p>
				</div>
				<div class="sc-usp-grid">
					{#each usps as usp}
						<div class="sc-usp-card sc-glass sc-reveal">
							<div class="sc-usp-icon">{usp.icon}</div>
							<h3>{usp.title}</h3>
							<p>{usp.desc}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- ===== SCREENSHOTS SLIDESHOW ===== -->
		{#if screenshots.length > 0}
			<section class="sc-section sc-screenshots">
				<div class="sc-container">
					<div class="sc-sec-head sc-reveal">
						<h2>See it in action</h2>
						<p>Live screenshots from the production apps.</p>
					</div>
				</div>
				<div class="sc-slides-track">
					{#each [...screenshots, ...screenshots] as src}
						<div class="sc-slide"><img {src} alt="App screenshot" loading="lazy" /></div>
					{/each}
				</div>
			</section>
		{:else}
			<section class="sc-section sc-screenshots">
				<div class="sc-container">
					<div class="sc-sec-head sc-reveal">
						<h2>See it in action</h2>
						<p>Live screenshots from all production applications.</p>
					</div>
				</div>
				<div class="sc-slides-track">
					{#each Array(8) as _, i}
						<div class="sc-slide"><div class="sc-slide-placeholder">Screenshot {i + 1}</div></div>
					{/each}
					{#each Array(8) as _, i}
						<div class="sc-slide"><div class="sc-slide-placeholder">Screenshot {i + 1}</div></div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- ===== ECOSYSTEM ===== -->
		<section class="sc-section">
			<div class="sc-container">
				<div class="sc-sec-head sc-reveal">
					<h2>3 Apps. 2 Android builds. <span class="sc-muted">One database.</span></h2>
					<p>Each application is production-ready with comprehensive page coverage.</p>
				</div>
				<div class="sc-eco-grid">
					{#each appEcosystem as app}
						<div class="sc-eco-card sc-glass sc-reveal">
							<div class="sc-eco-head">
								<h3 style="color: {app.color}">{app.title}</h3>
								<div class="sc-eco-meta">
									<span class="sc-eco-tag platform">{app.platform}</span>
									<span class="sc-eco-tag pages">{app.pages}</span>
								</div>
							</div>
							<ul class="sc-feat-list">
								{#each app.features as feat}
									<li>
										<span class="dot" style="background:{app.color};box-shadow:0 0 6px {app.color}"
										></span>{feat}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- ===== UNDER THE HOOD ===== -->
		<section class="sc-section">
			<div class="sc-container">
				<div class="sc-glass sc-mega sc-reveal">
					<div class="sc-mega-head">
						<h2>Under the hood</h2>
						<p class="sc-muted">Enterprise-grade architecture & developer experience.</p>
					</div>
					<div class="sc-mega-grid">
						{#each megaFeatures as item}
							<div class="sc-mega-item"><span class="sc-mega-dot"></span>{item}</div>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<!-- ===== PRICING ===== -->
		<section class="sc-section" id="pricing">
			<div class="sc-container">
				<div class="sc-sec-head sc-reveal">
					<h2>Transparent pricing</h2>
					<p>Select a plan. Toggle add-ons. See your total instantly.</p>
				</div>
				<div class="sc-pricing-grid sc-reveal">
					{#each pricingCategories as cat, i}
						<!-- svelte-ignore a11y_click_events_have_key_events --><!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="sc-price-card sc-glass {selectedPlanIndex === i ? 'active' : ''}"
							onclick={() => (selectedPlanIndex = i)}
						>
							{#if selectedPlanIndex === i}<div class="sc-sel-badge">Selected</div>{/if}
							<div class="sc-price-head">
								<h3>{cat.name}</h3>
								<p class="sc-price-target">{cat.target}</p>
								<div class="sc-price-amount"><span class="sc-price-curr">₹</span>{cat.price}</div>
								<div class="sc-price-usd">${cat.priceUsd} USD</div>
							</div>
							<div class="sc-price-body">
								<ul class="sc-price-list">
									{#each cat.details as d}
										<li>
											<svg class="sc-price-check" viewBox="0 0 20 20" fill="currentColor"
												><path
													fill-rule="evenodd"
													d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
													clip-rule="evenodd"
												/></svg
											>{d}
										</li>
									{/each}
								</ul>
							</div>
							<button
								class="sc-btn {selectedPlanIndex === i
									? 'sc-btn-primary'
									: 'sc-btn-ghost'} sc-btn-full"
								>{selectedPlanIndex === i ? '✓ Selected' : 'Select Plan'}</button
							>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- ===== ADD-ONS ===== -->
		<section class="sc-section" style="padding-top: 2rem;">
			<div class="sc-container">
				<div class="sc-sec-head sc-reveal">
					<h2>Optional add-ons</h2>
					<p>Enhance your platform with premium integrations.</p>
				</div>
				<div class="sc-addons-grid sc-reveal">
					{#each addons as addon}
						<!-- svelte-ignore a11y_click_events_have_key_events --><!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="sc-addon sc-glass {addon.selected ? 'active' : ''}"
							onclick={() => (addon.selected = !addon.selected)}
						>
							<div class="sc-addon-check">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"
									width="14"
									height="14"
									>{#if addon.selected}<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M5 13l4 4L19 7"
										/>{/if}</svg
								>
							</div>
							<div class="sc-addon-icon">{addon.icon}</div>
							<div class="sc-addon-body">
								<div class="sc-addon-top">
									<h3>{addon.title}</h3>
									<div class="sc-addon-pricing">
										<span class="sc-addon-inr">₹{addon.price}</span><span class="sc-addon-usd"
											>${addon.priceUsd}</span
										>
									</div>
								</div>
								<p>{addon.desc}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- ===== FOOTER CTA ===== -->
		<footer class="sc-footer sc-section sc-center" style="z-index:1;">
			<div class="sc-container">
				<h2>Ready to own your platform?</h2>
				<p>Skip the monthly subscriptions. Own the entire ecosystem.</p>
				<div class="sc-total-box">
					<div class="sc-total-label">Your Estimated Total</div>
					<div class="sc-total-row">
						<span class="sc-total-inr">₹{fmtInr}</span>
						<span class="sc-total-usd">${fmtUsd} USD</span>
					</div>
				</div>
				<a
					href="https://wa.me/917004574629?text=Hi%2C%20I'm%20interested%20in%20the%20Blancbeu%20Ecosystem.%20Selected%20total%3A%20%E2%82%B9{fmtInr}"
					target="_blank"
					rel="noopener noreferrer"
					class="sc-btn sc-btn-primary sc-btn-lg sc-wa-btn"
				>
					<svg class="sc-wa-icon" viewBox="0 0 24 24" fill="currentColor"
						><path
							d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
						/></svg
					>
					Contact Us to Purchase
				</a>
			</div>
		</footer>
	</div>
{/if}
