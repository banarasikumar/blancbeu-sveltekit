<script lang="ts">
	import HeroCarousel from '$lib/components/home/HeroCarousel.svelte';
	import ServiceHighlight from '$lib/components/home/ServiceHighlight.svelte';
	import { appServices } from '$lib/stores/appData';
	import SpecialOffers from '$lib/components/home/SpecialOffers.svelte';
	import HomeGallery from '$lib/components/home/HomeGallery.svelte';
	import TransformationGallery from '$lib/components/home/TransformationGallery.svelte';
	import StaffSpotlight from '$lib/components/home/StaffSpotlight.svelte';
	import Testimonials from '$lib/components/home/Testimonials.svelte';
	import AboutSection from '$lib/components/home/AboutSection.svelte';
	import StatsSection from '$lib/components/home/StatsSection.svelte';
	import CtaSection from '$lib/components/home/CtaSection.svelte';
	import FaqSection from '$lib/components/home/FaqSection.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import ServiceCart from '$lib/components/home/ServiceCart.svelte';
	import MembershipTiers from '$lib/components/home/MembershipTiers.svelte';

	// Derive featured services from the store (e.g., take first 4)
	// In the future, we could add a 'isFeatured' flag to the Service model
	// Filter out inactive services (isActive !== false)
	let featuredServices = $derived($appServices.filter((s) => s.isActive !== false).slice(0, 4));
</script>

<div class="home-page">
	<HeroCarousel />

	<section class="container section">
		<div class="section-header">
			<h2>Featured Services</h2>
			<p>Popular premium treatments</p>
		</div>

		<!-- Filter Removed -->

		<div class="services-grid">
			{#each featuredServices as service (service.id)}
				<ServiceHighlight {service} />
			{/each}
		</div>

		<div style="text-align: center; margin-top: 10px; margin-bottom: 20px;">
			<a href="/services" class="view-all-link">View All Services →</a>
		</div>
	</section>

	<SpecialOffers />
	<HomeGallery />
	<TransformationGallery />
	<StaffSpotlight />
	<Testimonials />
	<AboutSection />
	<StatsSection />
	<MembershipTiers />
	<CtaSection />
	<FaqSection />
	<Footer />

	<ServiceCart />
</div>

<style>
	.section {
		padding-top: 40px;
		padding-bottom: 40px;
	}

	.section-header {
		text-align: center;
		margin-bottom: 24px;
	}

	.section-header h2 {
		font-size: 1.5rem;
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		display: inline-block;
		margin-bottom: 4px;
	}

	.section-header p {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.services-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
		margin-bottom: 24px;
	}

	.no-services {
		grid-column: 1 / -1;
		text-align: center;
		padding: 40px;
		color: var(--color-text-secondary);
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
	}

	.view-all-link {
		color: var(--color-accent-gold);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
		border-bottom: 1px solid transparent;
		transition: all 0.2s;
	}

	.view-all-link:hover {
		border-bottom-color: var(--color-accent-gold);
		letter-spacing: 0.5px;
	}
</style>
