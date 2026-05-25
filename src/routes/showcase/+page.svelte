<script lang="ts">
	import './showcase.css';
	import { onMount, tick } from 'svelte';

	let mounted = $state(false);

	// Fullscreen logic for immersive experience
	function requestFullscreen() {
		if (typeof document === 'undefined' || document.fullscreenElement) return;
		try {
			const docEl = document.documentElement as any;
			if (docEl.requestFullscreen) {
				docEl.requestFullscreen();
			} else if (docEl.webkitRequestFullscreen) {
				docEl.webkitRequestFullscreen();
			}
		} catch (err) {
			console.warn('Fullscreen request failed:', err);
		}
	}

	// Intersection Observer for scroll reveal and marquee playback
	onMount(async () => {
		mounted = true;
		await tick();
		
		// Attach fullscreen triggers for first interaction
		document.addEventListener('click', requestFullscreen, { once: true });
		document.addEventListener('touchstart', requestFullscreen, { once: true, passive: true });
		
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (e.isIntersecting) {
						e.target.classList.add('visible');
						// If the screenshots wrapper enters the viewport, start the CSS marquee
						if (e.target.classList.contains('sc-screenshots')) {
							const track = e.target.querySelector('.sc-slides-track');
							if (track) track.classList.add('is-running');
						}
					} else {
						// Pause the CSS marquee when out of view to save battery
						if (e.target.classList.contains('sc-screenshots')) {
							const track = e.target.querySelector('.sc-slides-track');
							if (track) track.classList.remove('is-running');
						}
					}
				});
			},
			{ threshold: 0, rootMargin: '100px 0px 100px 0px' }
		);
		document.querySelectorAll('.sc-reveal, .sc-screenshots').forEach((el) => observer.observe(el));
		
		return () => {
			observer.disconnect();
			document.removeEventListener('click', requestFullscreen);
			document.removeEventListener('touchstart', requestFullscreen);
		};
	});

	// ========== DATA ==========
	const usps = [
		{
			title: 'Virtual AI Assistant',
			desc: 'Intelligent AI handles customer questions and books appointments instantly via voice or text.',
			icon: '<img src="/Assistant.webp" alt="AI Assistant" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" />'
		},
		{
			title: 'Companion "Ani" Avatar',
			desc: 'Interactive 3D avatar that engages customers, handles queries, and drives sales conversationally.',
			icon: '<img src="/Ani.webp" alt="Ani" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" />'
		},
		{
			title: 'Virtual Try-On',
			desc: 'Upload a photo or use the camera to see real-time previews of haircuts and colors before booking.',
			icon: '📸'
		},
		{
			title: 'Live Slots & Booking',
			desc: 'Real-time slot availability powered by Firebase RTDB. No double bookings. Millisecond sync.',
			icon: '⚡'
		},
		{
			title: 'Comprehensive Payment Gateway',
			desc: 'Seamless checkout experience with full support for local and international payment methods.',
			icon: '💳'
		},
		{
			title: 'Desktop-Class Admin & Staff Panels',
			desc: 'Full desktop support with installable apps. Easily assign tasks, optimize your workforce, and track staff performance with crystal clarity.',
			icon: '💻'
		},
		{
			title: 'Premium Desktop Simulator',
			desc: 'The User Web App features a specialized smartphone simulator on desktop, preserving the flawless mobile aesthetic and usability perfectly.',
			icon: '📱'
		},
		{
			title: 'Coupons & Beu Cash',
			desc: 'Built-in loyalty program with Beu Cash per user, plus robust promotional coupon management.',
			icon: '🎁'
		},
		{
			title: 'Cost-Free WhatsApp Auth',
			desc: 'Custom WhatsApp login bot — no paid Business API required. Save thousands monthly.',
			icon: '💬'
		},
		{
			title: 'Multi-Branch Expansion',
			desc: 'Scale from a single salon to a premium multi-branch brand. Centralized control, branch-level analytics, and unified customer experience across all locations.',
			icon: '🏢'
		}
	];

	const appEcosystem = [
		{
			title: 'Customer Web App',
			platform: 'Web (PWA)',
			pages: '12+ Pages',
			color: '#7c3aed',
			features: [
				'Immersive Mobile-First UI',
				'Virtual Try-On Integration',
				'AI Voice Assistant Booking',
				'Live Slot Availability',
				'Coupons & Beu Cash Wallet'
			]
		},
		{
			title: 'Customer Android',
			platform: 'Android App',
			pages: 'Native',
			color: '#a855f7',
			features: [
				'Native Performance & Feel',
				'Push Notifications',
				'Camera Integration for Try-On',
				'Offline Caching',
				'Seamless Payment Gateway'
			]
		},
		{
			title: 'Admin Dashboard',
			platform: 'Desktop Web',
			pages: '20+ Pages',
			color: '#06b6d4',
			features: [
				'Advanced Analytics Overview',
				'Staff Role Management',
				'Service & Pricing Config',
				'Invoice & Tax Generation',
				'Total Customer Database Control'
			]
		},
		{
			title: 'Staff Web Portal',
			platform: 'Web (PWA)',
			pages: '8+ Pages',
			color: '#0ea5e9',
			features: [
				'Daily Schedule View',
				'One-Tap Status Updates',
				'WhatsApp Customer Link',
				'Earnings & Commission Tracking',
				'Offline-Ready'
			]
		},
		{
			title: 'Staff Android App',
			platform: 'Android App',
			pages: 'Native',
			color: '#f59e0b',
			features: [
				'Instant Booking Alerts',
				'QR Code Scanner for Check-ins',
				'Native Device Calendar Sync',
				'Leave & Shift Management',
				'Performance Analytics'
			]
		},
		{
			title: 'Companion Ani',
			platform: 'Android App',
			pages: 'Native AI',
			color: '#ef4444',
			features: [
				'Grok-like Avatar Interface',
				'Conversational Booking Engine',
				'Voice-activated Commands',
				'Service Recommendations',
				'Deep Customer Engagement'
			]
		}
	];

	const megaFeatures = [
		'Glassmorphic UI/UX',
		'SvelteKit 5 Runes',
		'Firebase Cloud Messaging',
		'Razorpay/Stripe Gateway',
		'Offline Fallback',
		'Capacitor Native Bridge',
		'Multi-Theme Engines',
		'Role-Based Access Control',
		'Virtual Try-On Engine',
		'AI LLM Integration',
		'Container Queries',
		'SVG Invoice Engine'
	];

	// Screenshots
	const screenshots: string[] = [
		'/screenshots/1.png',
		'/screenshots/2.png',
		'/screenshots/3.png',
		'/screenshots/3aa.png',
		'/screenshots/3b.png',
		'/screenshots/4.png',
		'/screenshots/4ab.png',
		'/screenshots/4b.png',
		'/screenshots/6.png',
		'/screenshots/7.png',
		'/screenshots/7a.png',
		'/screenshots/7b.png',
		'/screenshots/8.png',
		'/screenshots/9.png',
		'/screenshots/9a.png',
		'/screenshots/localhost_5173_(Samsung Galaxy S20 Ultra) (23).png',
		'/screenshots/localhost_5173_(Samsung Galaxy S20 Ultra) (24).png',
		'/screenshots/localhost_5173_(Samsung Galaxy S20 Ultra) (28).png'
	];

	// ========== PRICING STATE ==========
	let selectedPlanIndex = $state(1);

	const pricingCategories = [
		{
			name: 'Starter',
			price: '79,999',
			priceUsd: '949',
			priceValue: 79999,
			priceUsdValue: 949,
			target: 'Single salons & independent spas',
			details: [
				'Customer & Staff Web Apps (PWA)',
				'Admin Dashboard (Desktop)',
				'Live Slot Booking & Scheduling',
				'WhatsApp Authentication Bot',
				'Fully Hosted on Vercel (1 Year)',
				'Standard Email Support'
			]
		},
		{
			name: 'Professional',
			price: '1,49,999',
			priceUsd: '1,799',
			priceValue: 149999,
			priceUsdValue: 1799,
			target: 'Growing brands & multi-staff salons',
			details: [
				'Everything in Starter',
				'3 Native Android Apps (APKs)',
				'Virtual AI Assistant (Text & Voice)',
				'Payment Gateway Integration',
				'Coupons & Beu Cash Loyalty System',
				'Desktop Smartphone Simulator',
				'Custom Branding & Logo',
				'Priority Support (48hr SLA)'
			]
		},
		{
			name: 'Enterprise AI',
			price: '2,49,999',
			priceUsd: '2,999',
			priceValue: 249999,
			priceUsdValue: 2999,
			target: 'Premium chains & franchise brands',
			details: [
				'Everything in Professional',
				'Companion "Ani" Avatar App',
				'Virtual Try-On Engine',
				'Staff Performance Analytics',
				'Full SvelteKit Source Code',
				'White-Label & IP Rights',
				'Firebase Security Hardening',
				'Lifetime Usage Rights',
				'Dedicated Account Manager'
			]
		}
	];

	let addons = $state([
		{
			title: 'Domain (.in / .com) + SSL',
			desc: 'Premium domain registration, DNS configuration & SSL certificate for 1 year.',
			icon: '🌐',
			prevPrice: '',
			price: '4,999',
			priceUsd: '59',
			priceValue: 4999,
			priceUsdValue: 59,
			selected: false
		},
		{
			title: 'SEO & Google Business Profile',
			desc: 'Complete local SEO setup, Google Business Profile optimization & on-page salon SEO.',
			icon: '📈',
			prevPrice: '',
			price: '24,999',
			priceUsd: '299',
			priceValue: 24999,
			priceUsdValue: 299,
			selected: false
		},
		{
			title: 'WhatsApp Business API & Badge',
			desc: 'Official Meta API, verified green tick badge, automated booking reminders & flows.',
			icon: '✅',
			prevPrice: '',
			price: '29,999',
			priceUsd: '349',
			priceValue: 29999,
			priceUsdValue: 349,
			selected: false
		},
		{
			title: 'AI Companion Customization',
			desc: 'Custom 3D avatar models, tailored LLM personality, and branded voice for your salon.',
			icon: '🧠',
			prevPrice: '',
			price: '49,999',
			priceUsd: '599',
			priceValue: 49999,
			priceUsdValue: 599,
			selected: false
		},
		{
			title: 'Multi-Branch Salon Support',
			desc: 'Expand to a premium multi-branch brand. Centralized control, branch-level analytics & unified customer experience across all locations.',
			icon: '🏢',
			prevPrice: '99,999',
			price: '69,999',
			priceUsd: '849',
			priceValue: 69999,
			priceUsdValue: 849,
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
				<div class="sc-badge"><span class="sc-badge-dot"></span> Next-Gen AI Ecosystem</div>
				<h1>Transform your salon into a <span class="sc-gradient">Premium Brand</span></h1>
				<p>
					A revolutionary 6-app ecosystem. Virtual Try-On, Conversational AI Booking, Companion Avatars, 
					and an all-in-one Dashboard designed to dramatically increase your revenue and bookings.
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
						<div class="sc-stat-num sc-gradient">6</div>
						<div class="sc-stat-label">Applications</div>
					</div>
					<div>
						<div class="sc-stat-num sc-gradient">3</div>
						<div class="sc-stat-label">Native Android Apps</div>
					</div>
					<div>
						<div class="sc-stat-num sc-gradient">AI</div>
						<div class="sc-stat-label">Virtual Assistants</div>
					</div>
					<div>
						<div class="sc-stat-num sc-gradient">300%</div>
						<div class="sc-stat-label">Revenue Growth</div>
					</div>
				</div>
			</div>
		</section>

		<!-- ===== USPs ===== -->
		<section class="sc-section" id="features">
			<div class="sc-container">
				<div class="sc-sec-head sc-reveal">
					<h2>Why this stands apart</h2>
					<p>Engineered to maximize customer engagement, automate bookings, and scale your business effortlessly.</p>
				</div>
				<div class="sc-usp-grid">
					{#each usps as usp}
						<div class="sc-usp-card sc-glass sc-reveal sc-glow-hover">
							<div class="sc-usp-icon">{@html usp.icon}</div>
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
						<p>Stunning interfaces across all 6 applications.</p>
					</div>
				</div>
				<div class="sc-slides-track">
					{#each Array(6) as _, i}
						<div class="sc-slide"><div class="sc-slide-placeholder">Interface {i + 1}</div></div>
					{/each}
					{#each Array(6) as _, i}
						<div class="sc-slide"><div class="sc-slide-placeholder">Interface {i + 1}</div></div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- ===== ECOSYSTEM ===== -->
		<section class="sc-section">
			<div class="sc-container">
				<div class="sc-sec-head sc-reveal">
					<h2>3 Web Apps. 3 Android Apps. <span class="sc-muted">One Ecosystem.</span></h2>
					<p>A completely unified experience for your customers, staff, and management.</p>
				</div>
				<div class="sc-eco-grid">
					{#each appEcosystem as app}
						<div class="sc-eco-card sc-glass sc-reveal sc-glow-hover">
							<div class="sc-eco-head">
								<h3 style="color: {app.color}">{app.title}</h3>
								<div class="sc-eco-meta">
									<span class="sc-eco-tag platform" style="background: {app.color}15; color: {app.color}; border-color: {app.color}30;">{app.platform}</span>
									<span class="sc-eco-tag pages">{app.pages}</span>
								</div>
							</div>
							<ul class="sc-feat-list">
								{#each app.features as feat}
									<li>
										<span class="dot" style="background:{app.color};box-shadow:0 0 6px {app.color}"></span>{feat}
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
						<p class="sc-muted">Enterprise-grade architecture & state-of-the-art tech stack.</p>
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
					<p>Invest in your salon's future. One-time purchase, lifetime value.</p>
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
										{#if addon.prevPrice}<span class="sc-addon-prev">₹{addon.prevPrice}</span>{/if}
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
				<p>Elevate your brand. Multiply your bookings. Own the entire ecosystem.</p>
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
