<script lang="ts">
	import { uploadStore } from '$lib/stores/uploadStore';
	import { CheckCircle2, XCircle, UploadCloud, Clock, Trash2 } from 'lucide-svelte';

	let uploads = $derived($uploadStore);

	function clearCompleted() {
		uploadStore.clearCompleted();
	}
</script>

<div class="admin-view-header">
	<div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
		<h2 class="admin-view-title">Uploads & Downloads</h2>
		<button class="admin-btn-secondary" style="height: 36px; padding: 0 12px; font-size: 13px; width: auto;" onclick={clearCompleted}>
			<Trash2 size={16} style="margin-right: 6px;" /> Clear Completed
		</button>
	</div>
</div>

<div class="uploads-container">
	{#if uploads.length === 0}
		<div class="empty-state">
			<UploadCloud size={48} color="var(--admin-text-tertiary)" />
			<p>No active or recent uploads.</p>
		</div>
	{:else}
		<div class="uploads-list">
			{#each uploads as upload (upload.id)}
				<div class="upload-item">
					<div class="upload-info">
						<div class="upload-icon">
							{#if upload.status === 'completed'}
								<CheckCircle2 size={24} color="#34C759" />
							{:else if upload.status === 'error'}
								<XCircle size={24} color="#FF3B30" />
							{:else if upload.status === 'uploading'}
								<UploadCloud size={24} color="var(--admin-accent)" class="animate-bounce-subtle" />
							{:else}
								<Clock size={24} color="var(--admin-text-secondary)" />
							{/if}
						</div>
						<div class="upload-details">
							<span class="upload-name">{upload.fileName}</span>
							{#if upload.status === 'error'}
								<span class="upload-status error">{upload.error || 'Upload failed'}</span>
							{:else if upload.status === 'completed'}
								<span class="upload-status success">Completed</span>
							{:else if upload.status === 'uploading'}
								<span class="upload-status uploading">Uploading... {Math.round(upload.progress)}%</span>
							{:else}
								<span class="upload-status">Pending</span>
							{/if}
						</div>
					</div>

					{#if upload.status === 'uploading' || upload.status === 'pending'}
						<div class="progress-bar-container">
							<div class="progress-bar" style="width: {upload.progress}%"></div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.uploads-container {
		padding-bottom: 40px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 300px;
		gap: 16px;
		color: var(--admin-text-tertiary);
	}

	.uploads-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.upload-item {
		background: var(--admin-surface);
		border-radius: 16px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.upload-info {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.upload-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--admin-bg);
	}

	.upload-details {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 4px;
	}

	.upload-name {
		font-weight: 600;
		color: var(--admin-text);
		font-size: 15px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 250px;
	}

	.upload-status {
		font-size: 13px;
		color: var(--admin-text-secondary);
	}

	.upload-status.error {
		color: #FF3B30;
	}

	.upload-status.success {
		color: #34C759;
	}

	.upload-status.uploading {
		color: var(--admin-accent);
	}

	.progress-bar-container {
		height: 6px;
		background: var(--admin-bg);
		border-radius: 3px;
		overflow: hidden;
		width: 100%;
	}

	.progress-bar {
		height: 100%;
		background: var(--admin-accent);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	:global(.animate-bounce-subtle) {
		animation: bounceSubtle 2s infinite ease-in-out;
	}

	@keyframes bounceSubtle {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-3px);
		}
	}
</style>
