<script lang="ts">
	import { Gem, Wallet, Calendar } from 'lucide-svelte';

	export let currentPoints = 0;
	export let nextTierThreshold = 5000;
	export let currentTierName = 'Gold';
	export let nextTierName = 'Platinum';
	export let totalSaved = 0;
	export let bookingsCount = 0;

	$: progressPercent = Math.min(100, Math.max(0, (currentPoints / nextTierThreshold) * 100));
</script>

<div class="unified-card glass-panel">
	<!-- TOP SECTION: TIER STATUS -->
	<div class="card-top">
		<div class="tier-header">
			<div class="tier-title-group">
				<span class="tier-label">{currentTierName} Tier</span>
				<div class="tier-benefits-row">
					<span class="benefit-pill">✓ 15% OFF</span>
					<span class="benefit-pill">✓ Free Ship</span>
				</div>
			</div>
			<div class="points-progress">
				<span class="current">{currentPoints.toLocaleString()}</span>
				<span class="divider">/</span>
				<span class="total">{nextTierThreshold.toLocaleString()}</span>
			</div>
		</div>

		<div class="progress-track">
			<div class="progress-fill" style="width: {progressPercent}%"></div>
		</div>
		<div class="progress-subtext">
			{nextTierThreshold - currentPoints} points to {nextTierName}
		</div>
	</div>

	<div class="card-divider"></div>

	<!-- BOTTOM SECTION: STATS GRID -->
	<div class="stats-row">
		<div class="stat-item">
			<div class="stat-icon loyalty">
				<Gem size={16} />
			</div>
			<div class="stat-info">
				<span class="stat-val">{currentPoints.toLocaleString()}</span>
				<span class="stat-lbl">Points</span>
			</div>
		</div>

		<div class="stat-item">
			<div class="stat-icon savings">
				<Wallet size={16} />
			</div>
			<div class="stat-info">
				<span class="stat-val">₹{totalSaved.toLocaleString()}</span>
				<span class="stat-lbl">Saved</span>
			</div>
		</div>

		<div class="stat-item">
			<div class="stat-icon bookings">
				<Calendar size={16} />
			</div>
			<div class="stat-info">
				<span class="stat-val">{bookingsCount}</span>
				<span class="stat-lbl">Bookings</span>
			</div>
		</div>
	</div>
</div>

<style>
	.unified-card {
		background: var(--color-bg-glass);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		margin-bottom: 24px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		position: relative;
	}

	/* BACKGROUND GLOW EFFECT */
	.unified-card::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(
			circle at 50% 50%,
			rgba(var(--color-accent-gold-rgb), 0.08),
			transparent 60%
		);
		pointer-events: none;
		z-index: 0;
	}

	.card-top {
		padding: 20px 20px 16px;
		position: relative;
		z-index: 1;
	}

	.tier-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.tier-title-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tier-label {
		font-family: var(--font-heading);
		font-size: 1.4rem;
		font-weight: 700;
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		line-height: 1;
	}

	.tier-benefits-row {
		display: flex;
		gap: 6px;
	}

	.benefit-pill {
		font-size: 0.65rem;
		padding: 2px 8px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: var(--color-text-secondary);
		white-space: nowrap;
	}

	.points-progress {
		text-align: right;
		font-family: var(--font-heading);
	}
	.points-progress .current {
		font-size: 1.1rem;
		color: var(--color-text-primary);
		font-weight: 600;
	}
	.points-progress .divider {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		margin: 0 2px;
	}
	.points-progress .total {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.progress-track {
		width: 100%;
		height: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		margin-bottom: 6px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--gradient-gold);
		border-radius: 10px;
		box-shadow: 0 0 12px rgba(var(--color-accent-gold-rgb), 0.4);
		transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.progress-subtext {
		text-align: right;
		font-size: 0.75rem;
		color: var(--color-accent-gold);
		opacity: 0.9;
	}

	.card-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.05);
		width: 100%;
	}

	/* BOTTOM STATS */
	.stats-row {
		display: flex;
		justify-content: space-between;
		padding: 16px 20px;
		position: relative;
		z-index: 1;
		/* background: rgba(0, 0, 0, 0.1); Removed to unify the card */
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		justify-content: flex-start; /* Align left */
	}
	/* Center the middle item */
	.stat-item:nth-child(2) {
		justify-content: center;
		border-left: 1px solid rgba(255, 255, 255, 0.08);
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}
	/* Right align the last item */
	.stat-item:last-child {
		justify-content: flex-end;
	}

	.stat-icon {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.stat-icon.loyalty {
		background: rgba(var(--color-accent-gold-rgb), 0.15);
		color: var(--color-accent-gold);
	}
	.stat-icon.savings {
		background: rgba(255, 255, 255, 0.1);
		color: var(--color-text-primary);
	}
	.stat-icon.bookings {
		background: rgba(46, 204, 113, 0.15);
		color: #2ecc71;
	}

	.stat-info {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}
	.stat-val {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}
	.stat-lbl {
		font-size: 0.65rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
</style>
