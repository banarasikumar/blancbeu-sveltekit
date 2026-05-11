<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { appServices } from '$lib/stores/appData';
	import { Camera, Upload, Download, RefreshCw, Sparkles, ChevronLeft } from 'lucide-svelte';

	let serviceName = $state($page.url.searchParams.get('serviceName') || '');
	let hairServices = $derived($appServices.filter(s => s.category === 'Hair'));

	let fileInput: HTMLInputElement;
	let originalImageBase64 = $state<string | null>(null);
	let resultImageBase64 = $state<string | null>(null);
	let isProcessing = $state(false);
	let errorMsg = $state('');

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];
			const reader = new FileReader();
			reader.onload = (e) => {
				originalImageBase64 = e.target?.result as string;
				resultImageBase64 = null; // Reset result when new image is chosen
				errorMsg = '';
			};
			reader.readAsDataURL(file);
		}
	}

	async function processTryOn() {
		if (!originalImageBase64) return;
		if (!serviceName && hairServices.length > 0) {
			serviceName = hairServices[0].name; // Default to first if none selected
		}

		isProcessing = true;
		errorMsg = '';

		try {
			const response = await fetch('/api/try-on', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					imageBase64: originalImageBase64,
					serviceName: serviceName
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to process image');
			}

			resultImageBase64 = data.resultImageBase64;
			if (data.message) {
				// We can optionally show the API warning message in console or UI
				console.log(data.message);
			}

		} catch (err: any) {
			errorMsg = err.message || 'An error occurred during processing.';
		} finally {
			isProcessing = false;
		}
	}

	function handleDownload() {
		if (!resultImageBase64) return;
		const a = document.createElement('a');
		a.href = resultImageBase64;
		a.download = `my-tryon-${serviceName.replace(/\s+/g, '-').toLowerCase()}.jpg`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	
	function resetTryOn() {
		originalImageBase64 = null;
		resultImageBase64 = null;
		if (fileInput) fileInput.value = '';
	}
</script>

<div class="try-on-page container">
	<header class="page-header">
		<a href="javascript:history.back()" class="back-btn"><ChevronLeft size={24} /></a>
		<h1>Virtual Try-On</h1>
		<p>AI Powered Style Preview</p>
	</header>

	<div class="try-on-card">
		{#if !originalImageBase64}
			<!-- Step 1: Upload or Camera -->
			<div class="upload-section">
				<div class="icon-circle">
					<Sparkles size={32} color="var(--color-accent-gold)" />
				</div>
				<h2>Upload your photo</h2>
				<p>For best results, use a clear, well-lit photo looking straight at the camera.</p>
				
				<div class="action-buttons">
					<button class="primary-btn" on:click={() => fileInput.click()}>
						<Camera size={20} />
						Take Photo or Upload
					</button>
					<input 
						type="file" 
						accept="image/*" 
						bind:this={fileInput} 
						on:change={handleFileChange} 
						style="display: none;" 
					/>
				</div>
			</div>
		{:else}
			<!-- Step 2: Configuration & Result -->
			<div class="preview-section">
				
				{#if !resultImageBase64}
					<div class="image-preview original">
						<img src={originalImageBase64} alt="Original" />
					</div>
					
					<div class="controls">
						<label for="serviceSelect">Select Style/Color:</label>
						<select id="serviceSelect" bind:value={serviceName} class="service-dropdown">
							{#if hairServices.length === 0}
								<!-- Fallback if no services loaded yet -->
								<option value="Balayage">Balayage Color</option>
								<option value="Pixie Cut">Pixie Cut</option>
							{:else}
								{#each hairServices as service}
									<option value={service.name}>{service.name}</option>
								{/each}
							{/if}
						</select>

						{#if errorMsg}
							<div class="error-msg">{errorMsg}</div>
						{/if}

						<button class="process-btn" on:click={processTryOn} disabled={isProcessing}>
							{#if isProcessing}
								<RefreshCw class="spin" size={20} />
								Processing AI Magic...
							{:else}
								<Sparkles size={20} />
								See My New Look
							{/if}
						</button>
						
						<button class="text-btn mt-2" on:click={resetTryOn} disabled={isProcessing}>
							Choose Different Photo
						</button>
					</div>
				{:else}
					<!-- Result State -->
					<div class="result-comparison">
						<div class="image-wrapper">
							<span class="badge">Before</span>
							<img src={originalImageBase64} alt="Original" class="result-img" />
						</div>
						<div class="image-wrapper">
							<span class="badge gold">After</span>
							<img src={resultImageBase64} alt="Result" class="result-img" />
						</div>
					</div>
					
					<div class="result-actions">
						<button class="primary-btn full-width" on:click={handleDownload}>
							<Download size={20} />
							Download Result
						</button>
						<button class="outline-btn full-width mt-3" on:click={() => { resultImageBase64 = null; }}>
							Try Another Style
						</button>
						<button class="text-btn full-width mt-2" on:click={resetTryOn}>
							Start Over
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.try-on-page {
		padding-top: 20px;
		padding-bottom: 40px;
		min-height: 80vh;
	}

	.page-header {
		text-align: center;
		margin-bottom: 24px;
		position: relative;
	}

	.back-btn {
		position: absolute;
		left: 0;
		top: 5px;
		color: var(--color-text-primary);
		opacity: 0.8;
	}

	.page-header h1 {
		font-size: 1.8rem;
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.page-header p {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.try-on-card {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		padding: 24px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.upload-section {
		text-align: center;
		padding: 40px 20px;
	}

	.icon-circle {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: rgba(212, 175, 55, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 20px;
		border: 1px solid rgba(212, 175, 55, 0.3);
	}

	.upload-section h2 {
		font-size: 1.5rem;
		margin-bottom: 12px;
	}

	.upload-section p {
		color: var(--color-text-secondary);
		margin-bottom: 30px;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.primary-btn {
		background: var(--gradient-gold);
		color: #1a1a1a;
		border: none;
		border-radius: var(--radius-full);
		padding: 14px 24px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		max-width: 300px;
		margin: 0 auto;
		transition: transform 0.2s;
	}

	.primary-btn:active {
		transform: scale(0.98);
	}
	
	.primary-btn.full-width {
		max-width: 100%;
	}

	.outline-btn {
		background: transparent;
		color: var(--color-accent-gold);
		border: 1px solid var(--color-accent-gold);
		border-radius: var(--radius-full);
		padding: 12px 24px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		width: 100%;
		transition: all 0.2s;
	}

	.text-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		text-decoration: underline;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.mt-2 { margin-top: 12px; }
	.mt-3 { margin-top: 20px; }

	.preview-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.image-preview {
		width: 100%;
		border-radius: var(--radius-md);
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.image-preview img {
		width: 100%;
		height: auto;
		display: block;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.controls label {
		font-size: 0.9rem;
		color: var(--color-text-secondary);
	}

	.service-dropdown {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-text-secondary);
		color: var(--color-text-primary);
		padding: 12px 16px;
		border-radius: var(--radius-md);
		font-size: 1rem;
		outline: none;
		width: 100%;
	}

	.service-dropdown:focus {
		border-color: var(--color-accent-gold);
	}

	.process-btn {
		background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
		border: 1px solid rgba(212, 175, 55, 0.5);
		color: var(--color-accent-gold);
		padding: 14px;
		border-radius: var(--radius-lg);
		font-size: 1.1rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		transition: all 0.3s;
		box-shadow: 0 4px 15px rgba(212, 175, 55, 0.1);
	}

	.process-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% { transform: rotate(360deg); }
	}

	.error-msg {
		color: #ff6b6b;
		font-size: 0.85rem;
		text-align: center;
		background: rgba(255, 107, 107, 0.1);
		padding: 8px;
		border-radius: 4px;
	}

	.result-comparison {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.image-wrapper {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.result-img {
		width: 100%;
		height: auto;
		display: block;
	}

	.badge {
		position: absolute;
		top: 8px;
		left: 8px;
		background: rgba(0,0,0,0.6);
		backdrop-filter: blur(4px);
		color: white;
		padding: 4px 10px;
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		font-weight: 600;
		z-index: 2;
	}

	.badge.gold {
		background: var(--gradient-gold);
		color: #000;
	}

	.result-actions {
		margin-top: 24px;
	}
</style>
