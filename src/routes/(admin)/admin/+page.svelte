<script lang="ts">
	import { adminUser } from '$lib/stores/adminAuth';
	import {
		allBookings,
		allUsers,
		bookingCount,
		pendingCount,
		userCount,
		serviceCount
	} from '$lib/stores/adminData';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import {
		CalendarCheck,
		Users,
		Clock,
		Star,
		Plus,
		UserPlus,
		Megaphone,
		BarChart3,
		FileText,
		Scissors
	} from 'lucide-svelte';
	import { flip } from 'svelte/animate';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	let userName = $derived(($adminUser?.displayName || 'Admin').split(' ')[0]);

	const stats = $derived([
		{
			label: 'Total Bookings',
			value: $bookingCount,
			icon: CalendarCheck,
			bg: 'var(--admin-accent-light)',
			color: 'var(--admin-accent)',
			action: () => goto('/admin/bookings')
		},
		{
			label: 'Active Users',
			value: $userCount,
			icon: Users,
			bg: 'var(--admin-green-light)',
			color: 'var(--admin-green)',
			action: () => goto('/admin/users')
		},
		{
			label: 'Pending Appts',
			value: $pendingCount,
			icon: Clock,
			bg: 'var(--admin-orange-light)',
			color: 'var(--admin-orange)',
			action: () => goto('/admin/bookings')
		},
		{
			label: 'Total Services',
			value: $serviceCount,
			icon: Scissors,
			bg: 'var(--admin-purple-light)',
			color: 'var(--admin-purple)',
			action: () => goto('/admin/services')
		}
	]);

	let actions = $state([
		{
			label: 'Invoice',
			icon: FileText,
			bg: 'var(--admin-purple)',
			handler: () => goto('/admin/invoice')
		},
		{
			label: 'Service',
			icon: Plus,
			bg: 'var(--admin-accent)',
			handler: () => goto('/admin/services')
		},
		{
			label: 'Staff',
			icon: UserPlus,
			bg: 'var(--admin-green)',
			handler: () => showToast('Add Staff — coming soon!', 'success')
		},
		{
			label: 'Notify',
			icon: Megaphone,
			bg: 'var(--admin-indigo)',
			handler: () => showToast('Notifications — coming soon!', 'success')
		},
		{
			label: 'Reports',
			icon: BarChart3,
			bg: 'var(--admin-pink)',
			handler: () => showToast('Reports — coming soon!', 'success')
		}
	]);

	/* --- Drag & Drop Reordering --- */
	let isEditing = $state(false);
	let draggingIndex = $state<number | null>(null);

	onMount(() => {
		if (browser) {
			const saved = localStorage.getItem('adminActionOrder');
			if (saved) {
				try {
					const order = JSON.parse(saved);
					actions.sort((a, b) => {
						const idxA = order.indexOf(a.label);
						const idxB = order.indexOf(b.label);
						if (idxA === -1) return 1;
						if (idxB === -1) return -1;
						return idxA - idxB;
					});
				} catch {
					/* ignore bad data */
				}
			}
		}
	});

	function handlePointerDown(e: PointerEvent, index: number) {
		if (!isEditing) return;
		e.preventDefault();
		draggingIndex = index;
		window.addEventListener('pointermove', handleGlobalPointerMove);
		window.addEventListener('pointerup', handleGlobalPointerUp);
	}

	function handleGlobalPointerMove(e: PointerEvent) {
		if (draggingIndex === null) return;
		const elements = document.elementsFromPoint(e.clientX, e.clientY);
		const target = elements.find((el) => el.closest('.admin-action-btn'));
		if (target) {
			const btn = target.closest('.admin-action-btn') as HTMLElement;
			if (btn && btn.dataset.index) {
				const newIndex = parseInt(btn.dataset.index);
				if (newIndex !== draggingIndex) {
					const item = actions[draggingIndex];
					actions.splice(draggingIndex, 1);
					actions.splice(newIndex, 0, item);
					draggingIndex = newIndex;
				}
			}
		}
	}

	function handleGlobalPointerUp() {
		draggingIndex = null;
		window.removeEventListener('pointermove', handleGlobalPointerMove);
		window.removeEventListener('pointerup', handleGlobalPointerUp);
		if (browser) {
			const order = actions.map((a) => a.label);
			localStorage.setItem('adminActionOrder', JSON.stringify(order));
		}
	}

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('pointermove', handleGlobalPointerMove);
			window.removeEventListener('pointerup', handleGlobalPointerUp);
		}
	});

	function toggleEdit() {
		isEditing = !isEditing;
	}
</script>

<!-- Hero Section -->
<div class="admin-hero">
	<span class="admin-hero-badge">BLANCBEU SALON</span>
	<h1>Hello, {userName}</h1>
	<p>Overview for today.</p>
</div>

<!-- Stats Grid -->
<div style="margin-bottom: 32px;">
	<h3 class="admin-section-title">Overview</h3>
	<div class="admin-stats-grid">
		{#each stats as stat}
			<button class="admin-stat-card" onclick={stat.action}>
				<div class="admin-stat-icon" style="background: {stat.bg}; color: {stat.color};">
					<stat.icon size={20} />
				</div>
				<div class="admin-stat-value">{stat.value}</div>
				<div class="admin-stat-label">{stat.label}</div>
			</button>
		{/each}
	</div>
</div>

<!-- Quick Actions -->
<div>
	<div
		style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;"
	>
		<h3 class="admin-section-title" style="margin-bottom: 0;">Quick Actions</h3>
		<button
			onclick={toggleEdit}
			style="background: none; border: none; font-size: 14px; font-weight: 600; color: var(--admin-accent); cursor: pointer;"
		>
			{isEditing ? 'Done' : 'Edit'}
		</button>
	</div>

	<div class="admin-actions-grid">
		{#each actions as action, i (action.label)}
			<button
				class="admin-action-btn"
				class:editing={isEditing}
				class:dragging={draggingIndex === i}
				data-index={i}
				onclick={!isEditing ? action.handler : undefined}
				onpointerdown={(e) => handlePointerDown(e, i)}
				style="touch-action: none;"
				animate:flip={{ duration: 300 }}
			>
				<div
					class="admin-action-icon"
					style="background: {action.bg}; opacity: {isEditing ? 0.8 : 1};"
				>
					<action.icon size={20} color="#000" />
				</div>
				<span>{action.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.admin-stat-card {
		text-align: left;
		cursor: pointer;
		border: none;
		font-family: inherit;
	}

	.admin-action-btn.editing {
		cursor: grab;
		animation: jiggle 0.8s ease-in-out infinite;
		transform-origin: center center;
	}

	.admin-action-btn.editing:nth-child(2n) {
		animation-delay: -0.2s;
	}

	.admin-action-btn.editing:nth-child(3n) {
		animation-delay: -0.5s;
	}

	.admin-action-btn.dragging {
		cursor: grabbing;
		opacity: 0.6;
		transform: scale(1.05);
		z-index: 10;
		animation: none;
	}

	@keyframes jiggle {
		0% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(3deg);
		}
		50% {
			transform: rotate(0deg);
		}
		75% {
			transform: rotate(-3deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}
</style>
