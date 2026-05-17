<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { appServices } from '$lib/stores/appData';
	import { cart } from '$lib/stores/booking';
	import { Camera, Image, Download, Sparkles, X, ShoppingBag, Plus, RefreshCw, RotateCcw } from 'lucide-svelte';
	import { DotLottieSvelte } from '@lottiefiles/dotlottie-svelte';
	import { writable } from 'svelte/store';
	import { auth } from '$lib/firebase';
	import { onAuthStateChanged } from 'firebase/auth';
	import { tryOnPicker, tryOnOriginalImage, tryOnResultImage, tryOnSelectedShadeIdx } from '$lib/stores/tryOnPicker';

	// Background processing notification store
	export const tryOnResult = writable<{ ready: boolean; image: string | null }>({
		ready: false,
		image: null
	});

	const hairColorShades = [
		{ name: 'Platinum Blonde', hex: '#E8D5B7' },
		{ name: 'Ash Blonde', hex: '#C2B280' },
		{ name: 'Golden Blonde', hex: '#DAA520' },
		{ name: 'Honey Brown', hex: '#A0522D' },
		{ name: 'Copper', hex: '#B87333' },
		{ name: 'Auburn', hex: '#922724' },
		{ name: 'Burgundy', hex: '#6C1D45' },
		{ name: 'Mahogany', hex: '#4E1609' },
		{ name: 'Chocolate Brown', hex: '#3B1F0B' },
		{ name: 'Jet Black', hex: '#1B1B1B' },
		{ name: 'Caramel', hex: '#C68E17' },
		{ name: 'Rose Gold', hex: '#B76E79' }
	];

	const COLOR_KEYWORDS = [
		'color',
		'balayage',
		'highlights',
		'dye',
		'blonde',
		'brunette',
		'ombre',
		'sombre',
		'tint',
		'streak',
		'global hair'
	];
	function isColorService(name: string) {
		return COLOR_KEYWORDS.some((kw) => name.toLowerCase().includes(kw));
	}

	let hairServices = $derived($appServices.filter((s) => s.category === 'Hair'));
	let selectedServices: { name: string; id: string; price: number; shade?: string }[] = $state([]);
	let hasColorService = $derived(selectedServices.some((s) => isColorService(s.name)));
	let availableServices = $derived(
		hairServices.filter((s) => !selectedServices.find((sel) => sel.id === s.id))
	);

	let fileInput: HTMLInputElement;
	let cameraInput: HTMLInputElement;
	let isProcessing = $state(false);
	let errorMsg = $state('');
	let showUploadModal = $state(false);
	let showResultBanner = $state(false);
	let demoVideo: HTMLVideoElement | undefined = $state();

	$effect(() => {
		if (demoVideo) {
			demoVideo.playbackRate = 0.5;
		}
	});

	// Slider (copied from TransformationGallery pattern)
	let sliderPosition = $state(50);
	let container: HTMLElement;
	let containerWidth = $state(0);
	let isDragging = $state(false);
	let startX = 0;
	let startY = 0;
	let isHorizontalSwipe = false;
	let isVerticalSwipe = false;
	let innerStyle = $derived(containerWidth ? `width: ${containerWidth}px` : 'width: 100%');

	$effect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (!user) {
				goto('/login', { replaceState: true });
			}
		});
		return unsubscribe;
	});

	onMount(() => {
		// Check if returning from picker mode
		if ($tryOnPicker.active && $tryOnPicker.selectedServices.length > 0) {
			selectedServices = [...$tryOnPicker.selectedServices];
			tryOnPicker.deactivate();
			return;
		}
		// Deactivate picker if active but empty (user pressed back)
		if ($tryOnPicker.active) {
			tryOnPicker.deactivate();
		}

		const urlService = $page.url.searchParams.get('serviceName');
		if (urlService) {
			const f = hairServices.find((s) => s.name === urlService);
			if (f) addService(f);
		}
	});

	function addService(svc: any) {
		if (selectedServices.length >= 3 || selectedServices.find((s) => s.id === svc.id)) return;
		selectedServices = [...selectedServices, { name: svc.name, id: svc.id, price: svc.price }];
	}
	function removeService(id: string) {
		selectedServices = selectedServices.filter((s) => s.id !== id);
		if (!selectedServices.some((s) => isColorService(s.name))) $tryOnSelectedShadeIdx = null;
	}

	function openStylePicker() {
		tryOnPicker.activate(selectedServices);
		goto('/services');
	}
	function selectShade(idx: number) {
		$tryOnSelectedShadeIdx = idx;
		selectedServices = selectedServices.map((s) =>
			isColorService(s.name) ? { ...s, shade: hairColorShades[idx].name } : s
		);
	}

	function cropTo2x3(file: File): Promise<string> {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new window.Image();
				img.onload = () => {
					const targetRatio = 2 / 3;
					let sw = img.width,
						sh = img.height;
					let cw, ch, cx, cy;
					if (sw / sh > targetRatio) {
						ch = sh;
						cw = sh * targetRatio;
						cx = (sw - cw) / 2;
						cy = 0;
					} else {
						cw = sw;
						ch = sw / targetRatio;
						cx = 0;
						cy = (sh - ch) / 2;
					}
					let dw = Math.min(cw, 720),
						dh = Math.min(ch, 1080);
					if (cw > 720) {
						dw = 720;
						dh = 1080;
					}
					const canvas = document.createElement('canvas');
					canvas.width = dw;
					canvas.height = dh;
					const ctx = canvas.getContext('2d')!;
					ctx.drawImage(img, cx, cy, cw, ch, 0, 0, dw, dh);
					resolve(canvas.toDataURL('image/jpeg', 0.85));
				};
				img.src = e.target?.result as string;
			};
			reader.readAsDataURL(file);
		});
	}

	async function handleFile(file: File) {
		showUploadModal = false;
		$tryOnOriginalImage = await cropTo2x3(file);
		$tryOnResultImage = null;
		errorMsg = '';
	}
	function onGalleryChange(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (f) handleFile(f);
	}
	function onCameraChange(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (f) handleFile(f);
	}

	async function processTryOn() {
		if (!$tryOnOriginalImage || selectedServices.length === 0) return;
		isProcessing = true;
		errorMsg = '';
		window.scrollTo({ top: 0, behavior: 'smooth' });
		try {
			const response = await fetch('/api/try-on', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageBase64: $tryOnOriginalImage, services: selectedServices })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'Failed to process');
			$tryOnResultImage = data.resultImageBase64;
			sliderPosition = 50;
			if (document.hidden) {
				showResultBanner = true;
			}
		} catch (err: any) {
			errorMsg = err.message || 'An error occurred.';
		} finally {
			isProcessing = false;
		}
	}

	function handleDownload() {
		if (!$tryOnResultImage) return;
		const a = document.createElement('a');
		a.href = $tryOnResultImage;
		a.download = `blancbeu-tryon-${Date.now()}.jpg`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	function resetAll() {
		$tryOnOriginalImage = null;
		$tryOnResultImage = null;
		selectedServices = [];
		$tryOnSelectedShadeIdx = null;
		showResultBanner = false;
	}
	function bookServices() {
		for (const svc of selectedServices) {
			const full = $appServices.find((s) => s.id === svc.id);
			if (full) cart.add(full);
		}
		goto('/booking');
	}

	// Slider handlers (same pattern as TransformationGallery)
	const handleStart = (e: MouseEvent | TouchEvent) => {
		isDragging = true;
		isHorizontalSwipe = false;
		isVerticalSwipe = false;
		if ('touches' in e) {
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
		} else {
			startX = e.clientX;
			startY = e.clientY;
			isHorizontalSwipe = true;
		}
	};
	const handleEnd = () => {
		isDragging = false;
		isHorizontalSwipe = false;
		isVerticalSwipe = false;
	};
	const handleMove = (e: MouseEvent | TouchEvent) => {
		if (!isDragging || !container) return;
		let clientX;
		if ('touches' in e) {
			const touch = e.touches[0];
			clientX = touch.clientX;
			if (!isHorizontalSwipe && !isVerticalSwipe) {
				const dx = Math.abs(clientX - startX),
					dy = Math.abs(touch.clientY - startY);
				if (dx > 5 || dy > 5) {
					if (dx > dy) isHorizontalSwipe = true;
					else isVerticalSwipe = true;
				}
			}
			if (isVerticalSwipe) return;
			if (isHorizontalSwipe && e.cancelable) e.preventDefault();
			if (!isHorizontalSwipe) return;
		} else {
			clientX = e.clientX;
			e.preventDefault();
		}
		const rect = container.getBoundingClientRect();
		sliderPosition = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
	};

	function getTransformCopy(): string {
		const n = selectedServices.map((s) => s.name);
		if (n.length === 1)
			return `Experience the elegance of our ${n[0]} — expertly crafted to enhance your natural beauty.`;
		if (n.length === 2)
			return `The perfect combination of ${n[0]} and ${n[1]} — designed to elevate your look.`;
		return `A stunning trio of ${n.join(', ')} — a complete transformation for your most radiant self.`;
	}
</script>

<div class="tryon-page container">
	<div class="tryon-subtitle-bar">
		<p>Preview your new look instantly</p>
	</div>

	{#if !$tryOnOriginalImage}
		<!-- UPLOAD STATE -->
		<div class="demo-card-section">
			<div class="preview-wrap demo-wrap" onclick={() => (showUploadModal = true)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (showUploadModal = true)}>
				<video 
					src="/assets/tryOnDemo.webm" 
					autoplay 
					loop 
					muted 
					playsinline 
					class="preview-img demo-video"
					bind:this={demoVideo}
				></video>
				<div class="demo-overlay-gradient"></div>
				<div class="demo-content">
					<div class="demo-badge">
						<Sparkles size={14} color="var(--color-accent-gold)" /> Live Demo
					</div>
					<div class="demo-text-box">
						<h2>See it before you get it</h2>
						<p>Upload a front-facing photo and preview stunning salon transformations instantly.</p>
					</div>
				</div>
			</div>
			<div class="demo-action-area">
				{#if selectedServices.length > 0}
					<div class="selection-area">
						<h3 class="label-text">Styles to Preview <span class="dim">(max 3)</span></h3>
						{#if selectedServices.length > 0}
							<div class="chips">
								{#each selectedServices as svc}
									<span class="chip">
										{svc.name}
										<button aria-label="Remove style" onclick={(e) => { e.stopPropagation(); removeService(svc.id); }}><X size={13} /></button>
									</span>
								{/each}
							</div>
						{/if}
						
						{#if selectedServices.length < 3 && availableServices.length > 0}
							<button class="add-style-btn" onclick={openStylePicker}>
								<Plus size={16} />
								{selectedServices.length > 0 ? 'Add another style' : 'Add a style'}
							</button>
						{/if}
					</div>
				{/if}
				<button class="gold-btn full demo-btn" onclick={() => (showUploadModal = true)}>
					<Camera size={20} /> Upload Your Photo
				</button>
			</div>
		</div>
	{:else if !$tryOnResultImage}
		<!-- CONFIGURE STATE & PROCESSING OVERLAY -->
		<div class="config-section">
			<div class="preview-wrap">
				<img src={$tryOnOriginalImage} alt="Your photo" class="preview-img" class:dimmed={isProcessing} />
				
				{#if isProcessing}
					<div class="processing-overlay">
						<div class="lottie-wrap">
							<DotLottieSvelte src="/AI_logo_Foriday.lottie" autoplay loop />
						</div>
						<div class="processing-text">
							<h3 class="processing-title">Transforming your look...</h3>
							<p class="processing-sub">Applying selected styles</p>
						</div>
					</div>
				{:else}
					<span class="preview-badge">Your Photo</span>
				{/if}
			</div>

			<div class="config-area selection-area">
				<h3 class="label-text">Styles to Preview <span class="dim">(max 3)</span></h3>
				{#if selectedServices.length > 0}
					<div class="chips">
						{#each selectedServices as svc}<span class="chip"
								>{svc.name}<button onclick={() => removeService(svc.id)}><X size={13} /></button
								></span
							>{/each}
					</div>
				{/if}
				{#if selectedServices.length < 3 && availableServices.length > 0}
					<button class="add-style-btn" onclick={openStylePicker}>
						<Plus size={16} />
						{selectedServices.length > 0 ? 'Add another style' : 'Add a style'}
					</button>
				{/if}

				{#if hasColorService}
					<h3 class="label-text" style="margin-top:16px;">Choose a Shade</h3>
					<div class="shade-row">
						{#each hairColorShades as shade, i}<button
								class="shade-dot"
								class:active={$tryOnSelectedShadeIdx === i}
								style="background:{shade.hex}"
								onclick={() => selectShade(i)}
								title={shade.name}
								>{#if $tryOnSelectedShadeIdx === i}<span class="shade-tick">✓</span>{/if}</button
							>{/each}
					</div>
					{#if $tryOnSelectedShadeIdx !== null}<p class="shade-label">
							{hairColorShades[$tryOnSelectedShadeIdx].name}
						</p>{/if}
				{/if}

				{#if errorMsg}<div class="err">{errorMsg}</div>{/if}
				<div class="config-actions">
					<button
						class="gold-btn full modern-action-btn"
						class:processing={isProcessing}
						onclick={processTryOn}
						disabled={selectedServices.length === 0 || isProcessing}>
						{#if isProcessing}
							<div class="spinner"></div> Processing...
						{:else}
							<Sparkles size={16} /> See My New Look
						{/if}
					</button>
					<button class="link-btn small-link" onclick={resetAll} disabled={isProcessing}>Choose Different Photo</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- RESULT STATE — Transformation Card (same as homepage) -->
		<div class="result-section">
			<div class="carousel-card">
				<div
					class="comparison-slider"
					bind:this={container}
					bind:clientWidth={containerWidth}
					onmousedown={handleStart}
					ontouchstart={handleStart}
					onmousemove={handleMove}
					ontouchmove={handleMove}
					onmouseup={handleEnd}
					ontouchend={handleEnd}
					onmouseleave={handleEnd}
				>
					<!-- After (background) -->
					<div class="after-container">
						<img src={$tryOnResultImage} alt="After" class="slider-img" />
						<div class="label-container after">
							<span class="img-label label-after">AFTER</span>
						</div>
					</div>
					<!-- Before (clipped foreground) -->
					<div class="before-container" style="width:{sliderPosition}%">
						<div class="inner-fixed-wrapper" style={innerStyle}>
							<img src={$tryOnOriginalImage} alt="Before" class="slider-img" />
							<div class="label-container before">
								<span class="img-label label-before">BEFORE</span>
							</div>
						</div>
					</div>
					<!-- Handle -->
					<div class="slider-handle" style="left:{sliderPosition}%">
						<div class="handle-line"></div>
						<div class="handle-circle"><span class="handle-icon">↔</span></div>
					</div>
				</div>
				<div class="info-box">
					<h4>{selectedServices.map((s) => s.name).join(' + ')}</h4>
					<p>{getTransformCopy()}</p>
				</div>
			</div>

			<div class="result-actions">
				<button class="gold-btn full" onclick={bookServices}
					><ShoppingBag size={20} /> Book These Services</button
				>
				<button class="outline-btn full" onclick={handleDownload}
					><Download size={18} /> Save Image</button
				>
				<div class="row-btns">
					<button
						class="try-another-btn"
						onclick={() => {
							$tryOnResultImage = null;
						}}
					>
						<RefreshCw size={12} />
						Try Another Style
					</button>
					<button class="start-over-btn" onclick={resetAll}>
						<RotateCcw size={12} />
						Start Over
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Upload Modal -->
{#if showUploadModal}
	<div class="modal-overlay" onclick={() => (showUploadModal = false)}>
		<div class="modal-sheet" onclick={(e) => e.stopPropagation()}>
			<div class="modal-handle"></div>
			<h3>Choose Photo</h3>
			<button class="modal-option" onclick={() => cameraInput.click()}
				><Camera size={22} /> Take a Selfie</button
			>
			<button class="modal-option" onclick={() => fileInput.click()}
				><Image size={22} /> Choose from Gallery</button
			>
			<button class="modal-cancel" onclick={() => (showUploadModal = false)}>Cancel</button>
		</div>
	</div>
{/if}

<input
	type="file"
	accept="image/*"
	capture="user"
	bind:this={cameraInput}
	onchange={onCameraChange}
	style="display:none"
/>
<input
	type="file"
	accept="image/*"
	bind:this={fileInput}
	onchange={onGalleryChange}
	style="display:none"
/>

<!-- Result Ready Banner -->
{#if showResultBanner && $tryOnResultImage}
	<div
		class="result-banner"
		onclick={() => {
			showResultBanner = false;
		}}
	>
		<Sparkles size={16} /> Transformation ready — tap to view
	</div>
{/if}

<style>
	.tryon-page {
		padding-top: 8px;
		padding-bottom: 100px;
		min-height: 80vh;
	}
	.tryon-subtitle-bar {
		text-align: center;
		margin-bottom: 20px;
	}
	.tryon-subtitle-bar p {
		color: var(--color-text-secondary);
		font-size: 0.82rem;
		margin: 0;
		letter-spacing: 0.03em;
		opacity: 0.8;
	}

	/* Demo Card / Upload */
	.demo-card-section {
		padding: 0;
		animation: fadeIn 0.4s ease-out;
	}
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.demo-wrap {
		position: relative;
		cursor: pointer;
		box-shadow: 0 12px 36px rgba(0,0,0,0.15);
		transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
		margin-bottom: 20px;
	}
	.demo-wrap:active {
		transform: scale(0.97);
	}
	.demo-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.demo-overlay-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.85) 100%);
		pointer-events: none;
	}
	.demo-content {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 24px;
		color: white;
	}
	.demo-badge {
		align-self: flex-start;
		background: rgba(0,0,0,0.6);
		backdrop-filter: blur(10px);
		padding: 8px 16px;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid rgba(255,255,255,0.15);
		box-shadow: 0 4px 12px rgba(0,0,0,0.2);
	}
	.demo-text-box {
		text-align: center;
		margin-bottom: 10px;
	}
	.demo-text-box h2 {
		font-size: 1.8rem;
		font-weight: 800;
		margin-bottom: 12px;
		text-shadow: 0 2px 12px rgba(0,0,0,0.6);
		letter-spacing: 0.02em;
	}
	.demo-text-box p {
		font-size: 1rem;
		line-height: 1.5;
		margin-bottom: 0;
		color: rgba(255,255,255,0.95);
		text-shadow: 0 1px 6px rgba(0,0,0,0.6);
		padding: 0 10px;
	}
	.demo-action-area {
		padding: 0;
	}
	.selection-area {
		margin-bottom: 24px;
	}
	.demo-btn {
		box-shadow: 0 8px 24px rgba(212, 175, 55, 0.4);
		font-size: 1.05rem;
		padding: 18px;
	}

	/* Buttons */
	.gold-btn {
		background: var(--gradient-gold);
		color: #1a1a1a;
		border: none;
		border-radius: 999px;
		padding: 14px 28px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		box-shadow: 0 4px 16px rgba(212, 175, 55, 0.3);
		transition: transform 0.2s;
	}
	.gold-btn:active {
		transform: scale(0.96);
	}
	.gold-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.gold-btn.processing {
		opacity: 0.8;
	}
	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(26, 26, 26, 0.3);
		border-top-color: #1a1a1a;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	.gold-btn.full {
		width: 100%;
		justify-content: center;
		border-radius: 14px;
		padding: 16px;
	}
	.outline-btn {
		background: transparent;
		border: 1px solid rgba(212, 175, 55, 0.4);
		color: var(--color-accent-gold);
		border-radius: 14px;
		padding: 14px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: transform 0.2s;
	}
	.outline-btn.full {
		width: 100%;
		margin-top: 10px;
	}
	.outline-btn:active {
		transform: scale(0.97);
	}
	.link-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		text-decoration: underline;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 8px;
	}
	.row-btns {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 20px;
	}
	.try-another-btn, .start-over-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px 20px;
		border-radius: 999px;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		color: var(--color-text-secondary);
	}
	.try-another-btn {
		border-color: rgba(212, 175, 55, 0.25);
		background: rgba(212, 175, 55, 0.04);
		color: var(--color-accent-gold);
	}
	.try-another-btn:hover, .try-another-btn:active {
		background: rgba(212, 175, 55, 0.12);
		border-color: rgba(212, 175, 55, 0.5);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.15);
	}
	.start-over-btn:hover, .start-over-btn:active {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.15);
		color: var(--color-text-primary);
		transform: translateY(-1px);
	}
	.try-another-btn:active, .start-over-btn:active {
		transform: scale(0.97) translateY(0);
	}

	/* Processing Overlay */
	.processing-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(4px);
		z-index: 10;
		animation: fadeIn 0.3s ease-out;
		padding: 20px;
		text-align: center;
	}
	.lottie-wrap {
		width: 240px;
		height: 240px;
		margin-bottom: 20px;
	}
	.processing-text {
		width: 100%;
		max-width: 320px;
		background: rgba(20, 20, 20, 0.85);
		padding: 16px 24px;
		border-radius: 20px;
		border: 1px solid rgba(212, 175, 55, 0.2);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(12px);
	}
	.processing-title {
		font-size: 1.15rem;
		font-weight: 700;
		margin-bottom: 4px;
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.processing-sub {
		color: rgba(255, 255, 255, 0.8);
		font-size: 0.85rem;
		margin: 0;
	}

	/* Configure */
	.config-section {
	}
	.preview-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 2/3;
		border-radius: var(--radius-lg);
		overflow: hidden;
		margin-bottom: 20px;
	}
	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: filter 0.3s ease, transform 0.3s ease;
	}
	.preview-img.dimmed {
		filter: brightness(0.6) blur(2px);
		transform: scale(1.02);
	}
	.preview-badge {
		position: absolute;
		bottom: 10px;
		left: 10px;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(6px);
		color: #fff;
		padding: 4px 12px;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
	}
	.config-area {
	}
	.label-text {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-secondary);
		margin-bottom: 10px;
	}
	.dim {
		font-weight: 400;
		opacity: 0.6;
		text-transform: none;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 10px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(212, 175, 55, 0.1);
		border: 1px solid rgba(212, 175, 55, 0.3);
		color: var(--color-accent-gold);
		padding: 6px 12px;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.chip button {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		display: flex;
		padding: 0;
	}
	/* Add Style Button */
	.add-style-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px 16px;
		border-radius: 14px;
		border: 1.5px dashed rgba(212, 175, 55, 0.4);
		background: rgba(212, 175, 55, 0.04);
		color: var(--color-accent-gold);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.25s ease;
		margin-bottom: 8px;
	}
	.add-style-btn:active {
		transform: scale(0.97);
		background: rgba(212, 175, 55, 0.1);
	}

	/* Style Picker Bottom Sheet */
	.style-sheet {
		background: var(--color-bg-secondary);
		border-radius: 24px 24px 0 0;
		padding: 20px;
		width: 100%;
		max-width: 480px;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		animation: sheetSlideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@keyframes sheetSlideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
	.style-sheet-title {
		text-align: center;
		font-size: 1.15rem;
		font-weight: 700;
		margin-bottom: 4px;
	}
	.style-sheet-sub {
		text-align: center;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-bottom: 18px;
		opacity: 0.7;
	}
	.style-list {
		overflow-y: auto;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 8px;
		scrollbar-width: none;
	}
	.style-list::-webkit-scrollbar {
		display: none;
	}
	.style-card {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		background: var(--color-bg-primary);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 16px;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.style-card:active {
		transform: scale(0.98);
		background: rgba(212, 175, 55, 0.08);
		border-color: rgba(212, 175, 55, 0.3);
	}
	.style-card-info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 3px;
	}
	.style-card-name {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}
	.style-card-price {
		font-size: 0.8rem;
		color: var(--color-accent-gold);
		font-weight: 500;
	}
	.style-card-add {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(212, 175, 55, 0.12);
		color: var(--color-accent-gold);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.no-styles-msg {
		text-align: center;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		padding: 24px;
		opacity: 0.6;
	}
	.err {
		color: #ff6b6b;
		font-size: 0.85rem;
		text-align: center;
		background: rgba(255, 107, 107, 0.1);
		padding: 10px;
		border-radius: 8px;
		margin: 10px 0;
	}

	.config-actions {
		margin-top: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.modern-action-btn {
		padding: 14px 24px !important;
		font-size: 0.95rem !important;
		border-radius: 999px !important;
		box-shadow: 0 4px 15px rgba(212, 175, 55, 0.25) !important;
		letter-spacing: 0.02em;
	}
	.small-link {
		font-size: 0.8rem !important;
		color: var(--color-text-secondary) !important;
		padding: 4px !important;
		opacity: 0.8;
		transition: opacity 0.2s;
	}
	.small-link:hover {
		opacity: 1;
	}

	/* Shade picker */
	.shade-row {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding: 6px 0 10px;
		scrollbar-width: none;
	}
	.shade-row::-webkit-scrollbar {
		display: none;
	}
	.shade-dot {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: 3px solid transparent;
		flex-shrink: 0;
		cursor: pointer;
		position: relative;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}
	.shade-dot.active {
		border-color: var(--color-accent-gold);
		transform: scale(1.15);
		box-shadow:
			0 0 0 2px var(--color-accent-gold),
			0 4px 12px rgba(212, 175, 55, 0.4);
	}
	.shade-tick {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 15px;
		font-weight: 700;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
	}
	.shade-label {
		text-align: center;
		font-size: 0.85rem;
		color: var(--color-accent-gold);
		font-weight: 600;
	}

	/* Transformation Card — exact match to TransformationGallery */
	.carousel-card {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-glass);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.comparison-slider {
		position: relative;
		width: 100%;
		aspect-ratio: 2/3;
		overflow: hidden;
		cursor: col-resize;
		user-select: none;
		touch-action: none;
	}
	.slider-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		display: block;
	}
	.after-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}
	.before-container {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		overflow: hidden;
		background: #000;
		border-right: 2px solid white;
		z-index: 10;
		will-change: width;
	}
	.inner-fixed-wrapper {
		height: 100%;
		position: relative;
	}
	.before-container .slider-img {
		width: 100%;
		max-width: none;
		height: 100%;
	}
	.slider-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 40px;
		transform: translateX(-50%);
		z-index: 20;
		cursor: col-resize;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.handle-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: rgba(255, 255, 255, 0.8);
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
	}
	.handle-circle {
		width: 44px;
		height: 44px;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(5px);
		border: 2px solid white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
	}
	.handle-icon {
		color: white;
		font-size: 18px;
		line-height: 1;
		font-weight: bold;
	}
	.label-container {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.img-label {
		position: absolute;
		bottom: 16px;
		padding: 6px 16px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		font-weight: 700;
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		border-radius: 4px;
		text-transform: uppercase;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
	.label-before {
		left: 16px;
	}
	.label-after {
		right: 16px;
	}
	.info-box {
		padding: 18px;
		text-align: center;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	.info-box h4 {
		margin-bottom: 4px;
		color: var(--color-accent-gold);
		font-size: 1.15rem;
	}
	.info-box p {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		line-height: 1.5;
		margin: 0;
	}
	.result-section {
	}
	.result-actions {
		margin-top: 20px;
	}

	/* Upload Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 2000;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.modal-sheet {
		background: var(--color-bg-secondary);
		border-radius: 20px 20px 0 0;
		padding: 20px;
		width: 100%;
		max-width: 480px;
	}
	.modal-handle {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.2);
		margin: 0 auto 16px;
	}
	.modal-sheet h3 {
		text-align: center;
		margin-bottom: 16px;
		font-size: 1.1rem;
	}
	.modal-option {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px;
		background: var(--color-bg-primary);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		color: var(--color-text-primary);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 10px;
		transition: background 0.2s;
	}
	.modal-option:active {
		background: rgba(212, 175, 55, 0.1);
	}
	.modal-cancel {
		width: 100%;
		background: none;
		border: none;
		color: var(--color-text-secondary);
		padding: 14px;
		font-size: 0.95rem;
		cursor: pointer;
	}

	/* Result Banner */
	.result-banner {
		position: fixed;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--gradient-gold);
		color: #1a1a1a;
		padding: 12px 24px;
		border-radius: 999px;
		font-weight: 700;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 8px;
		box-shadow: 0 6px 24px rgba(212, 175, 55, 0.4);
		z-index: 1500;
		cursor: pointer;
		animation: bannerSlide 0.4s ease-out;
		white-space: nowrap;
	}
	@keyframes bannerSlide {
		from {
			transform: translateX(-50%) translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateX(-50%) translateY(0);
			opacity: 1;
		}
	}
</style>
