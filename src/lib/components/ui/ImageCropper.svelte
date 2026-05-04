<script lang="ts">
	import Cropper from 'svelte-easy-crop';
	import { fade, fly } from 'svelte/transition';
	import { X, Check } from 'lucide-svelte';
	import Loader from '$lib/components/ui/Loader.svelte';
	import { showToast } from '$lib/stores/toast';

	export let image: string; // The selected image URL
	export let onCancel: () => void;
	export let onSave: (croppedWebPBlob: Blob) => Promise<void>;

	let crop = { x: 0, y: 0 };
	let zoom = 1;
	let croppedAreaPixels: any;
	let processing = false;

	function handleCropComplete(e: CustomEvent) {
		croppedAreaPixels = e.detail.pixels;
	}

	async function handleSave() {
		if (!image) return;
		processing = true;
		try {
			let pixelsToCrop = croppedAreaPixels;

			// If cropcomplete hasn't fired (user didn't move image), default to a centered square
			if (!pixelsToCrop) {
				pixelsToCrop = await Promise.race([
					new Promise((resolve, reject) => {
						const img = new Image();
						img.onload = () => {
							const minDim = Math.min(img.width, img.height);
							const x = (img.width - minDim) / 2;
							const y = (img.height - minDim) / 2;
							resolve({ x, y, width: minDim, height: minDim });
						};
						img.onerror = () => reject(new Error('Failed to load image'));
						img.src = image;
					}),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error('Image load timeout')), 3000)
					)
				]);
			}

			showToast('Processing crop...', 'info');
			const blob = await getCroppedImg(image, pixelsToCrop, 480);

			showToast('Uploading to secure storage...', 'info');
			await onSave(blob);
		} catch (e: any) {
			console.error('Error in handleSave:', e);
			showToast(e.message || 'Error processing image', 'error');
		} finally {
			processing = false;
		}
	}

	// Utility to generate a Blob from the cropped area
	function getCroppedImg(imageSrc: string, pixelCrop: any, finalSize = 480): Promise<Blob> {
		return Promise.race([
			new Promise<Blob>((resolve, reject) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement('canvas');
					canvas.width = finalSize;
					canvas.height = finalSize;
					const ctx = canvas.getContext('2d');

					if (!ctx) {
						reject(new Error('Canvas context not found'));
						return;
					}

					// Draw the cropped portion to the 480x480 canvas
					ctx.drawImage(
						img,
						pixelCrop.x,
						pixelCrop.y,
						pixelCrop.width,
						pixelCrop.height,
						0,
						0,
						finalSize,
						finalSize
					);

					// Convert to WebP format
					canvas.toBlob(
						(blob) => {
							if (!blob) {
								reject(new Error('Canvas is empty'));
								return;
							}
							resolve(blob);
						},
						'image/webp',
						0.9
					);
				};
				img.onerror = () => {
					reject(new Error('Failed to load image'));
				};
				img.src = imageSrc;
			}),
			new Promise<Blob>((_, reject) =>
				setTimeout(() => reject(new Error('Canvas crop timeout')), 5000)
			)
		]);
	}
</script>

<div class="cropper-overlay" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
	<div class="cropper-modal" in:fly={{ y: 50, duration: 300 }}>
		<div class="cropper-header">
			<h3>Crop Image</h3>
			<button class="close-btn" onclick={onCancel} disabled={processing}>
				<X size={20} />
			</button>
		</div>

		<div class="cropper-area">
			<Cropper
				{image}
				bind:crop
				bind:zoom
				aspect={1}
				cropShape="round"
				on:cropcomplete={handleCropComplete}
			/>

			{#if processing}
				<div class="processing-overlay" in:fade={{ duration: 200 }}>
					<Loader size={120} fullPage={false} />
					<span class="loading-text">Saving Profile...</span>
				</div>
			{/if}
		</div>

		<div class="cropper-footer">
			<button class="save-btn" onclick={handleSave} disabled={processing}>
				{#if processing}
					Saving...
				{:else}
					<Check size={18} />
					Save Profile Picture
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.cropper-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.cropper-modal {
		background: var(--color-bg-primary);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 400px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
		border: 1px solid var(--color-border);
	}

	.cropper-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.cropper-header h3 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.1rem;
		color: var(--color-text-primary);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		transition: background 0.2s;
	}

	.close-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.cropper-area {
		position: relative;
		height: 350px;
		width: 100%;
		background: #000;
	}

	.processing-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
	}

	.loading-text {
		color: #ffffff;
		font-family: var(--font-heading);
		font-size: 1.1rem;
		margin-top: 12px;
		letter-spacing: 0.5px;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0% {
			opacity: 0.7;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0.7;
		}
	}

	.cropper-footer {
		padding: 20px;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
	}

	.save-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px;
		background: var(--gradient-gold);
		color: #000; /* Contrast text */
		font-weight: 700;
		border: none;
		border-radius: var(--radius-full);
		font-size: 1rem;
		cursor: pointer;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}

	.save-btn:active {
		transform: scale(0.98);
	}

	.save-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.mini-spinner {
		border: 2px solid rgba(0, 0, 0, 0.1);
		border-top-color: #000;
		border-radius: 50%;
		width: 16px;
		height: 16px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
