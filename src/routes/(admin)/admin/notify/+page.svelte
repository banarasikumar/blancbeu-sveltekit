<script lang="ts">
	import { auth, storage } from '$lib/firebase';
	import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
	import { allUsers, getUserDisplayName, getUserPhoto, getUserPhone, type AppUser } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import { requestUserNotificationPermission } from '$lib/stores/userNotifications';
	import {
		Megaphone,
		Send,
		Users,
		Bell,
		BellRing,
		Clock,
		CheckCircle2,
		XCircle,
		ChevronDown,
		ChevronUp,
		Search,
		Sparkles,
		Gift,
		CalendarCheck,
		Star,
		AlertTriangle,
		RefreshCw,
		Image,
		X,
		Trash2,
		Smartphone,
		Wifi,
		Battery,
		Eye,
		Link2,
		Plus,
		Pencil,
		Save,
		BookmarkPlus,
		FileText,
		Palette
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { collection, query, orderBy, limit as firestoreLimit, getDocs, doc, setDoc, deleteDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';

	// --- Tabs ---
	type Tab = 'compose' | 'subscribers' | 'history';
	let activeTab = $state<Tab>('compose');
	let showAllTemplates = $state(false);

	// --- Compose State ---
	let notifTitle = $state('');
	let notifBody = $state('');
	let notifUrl = $state('');
	let isSending = $state(false);
	let sendResult = $state<{ success: boolean; sentCount: number; targetUserCount: number } | null>(null);

	// --- Image State ---
	let imageFile = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let isUploadingImage = $state(false);
	let imageInputRef = $state<HTMLInputElement | null>(null);

	// --- Target Audience ---
	type Audience = 'all' | 'users_only' | 'staff_only' | 'test_self';
	let targetAudience = $state<Audience>('all');

	// --- Preview Mode ---
	let showPhonePreview = $state(false);

	// --- Subscribers ---
	let subscriberSearch = $state('');
	let showAllSubscribers = $state(false);

	const subscribers = $derived.by(() => {
		const result = $allUsers.filter((u) => {
			const tokens = u.fcmTokens;
			return tokens && Array.isArray(tokens) && tokens.length > 0;
		});
		console.log('[Notify] Total users:', $allUsers.length, '| With FCM tokens:', result.length);
		if (result.length === 0 && $allUsers.length > 0) {
			// Debug: log first few users to check fcmTokens field
			console.log('[Notify] Sample user fields:', $allUsers.slice(0, 5).map(u => ({
				id: u.id,
				fcmTokens: u.fcmTokens,
				fcmTokensType: typeof u.fcmTokens,
				role: u.role,
				displayName: u.displayName || u.name || 'Unknown'
			})));
		}
		return result;
	});

	const audienceFilteredSubscribers = $derived.by(() => {
		if (targetAudience === 'test_self') {
			const me = auth.currentUser;
			if (!me) return [];
			return subscribers.filter(u => u.id === me.uid);
		}
		if (targetAudience === 'users_only') return subscribers.filter(u => u.role !== 'staff' && u.role !== 'admin');
		if (targetAudience === 'staff_only') return subscribers.filter(u => u.role === 'staff' || u.role === 'admin');
		return subscribers;
	});

	const filteredSubscribers = $derived.by(() => {
		let list = audienceFilteredSubscribers;
		if (subscriberSearch) {
			const q = subscriberSearch.toLowerCase();
			list = list.filter(
				(u) =>
					getUserDisplayName(u).toLowerCase().includes(q) ||
					(u.email || '').toLowerCase().includes(q) ||
					(getUserPhone(u) || '').includes(q)
			);
		}
		return list;
	});

	const displayedSubscribers = $derived(
		showAllSubscribers ? filteredSubscribers : filteredSubscribers.slice(0, 10)
	);

	// Check if any field has content
	const hasContent = $derived(notifTitle.trim() !== '' || notifBody.trim() !== '' || notifUrl.trim() !== '' || imageFile !== null);

	// --- Notification History ---
	interface NotifHistoryItem {
		id: string;
		title: string;
		body: string;
		imageUrl?: string;
		clickUrl?: string;
		targetAudience: string;
		sentAt: any;
		targetUserCount: number;
		sentCount: number;
		failureCount: number;
		status: string;
	}

	let history = $state<NotifHistoryItem[]>([]);
	let isLoadingHistory = $state(false);
	let showAllHistory = $state(false);

	const displayedHistory = $derived(
		showAllHistory ? history : history.slice(0, 5)
	);

	// --- Templates ---
	interface NotifTemplate {
		id: string;
		label: string;
		color: string;
		title: string;
		body: string;
		url?: string;
		createdAt?: any;
		builtIn?: boolean;
	}

	const templateColors = [
		'var(--admin-accent)', 'var(--admin-pink)', 'var(--admin-green)',
		'var(--admin-purple)', 'var(--admin-orange)', 'var(--admin-indigo)',
		'#0A84FF', '#FF375F', '#30D158', '#BF5AF2'
	];

	const defaultTemplates: NotifTemplate[] = [
		{ id: '_offer', label: 'New Offer', color: 'var(--admin-accent)', title: '\u2728 Special Offer Just For You!', body: 'Get exclusive discounts on our premium services. Book now and save!', builtIn: true },
		{ id: '_promo', label: 'Promo', color: 'var(--admin-pink)', title: '\uD83C\uDF81 Limited Time Promotion!', body: 'Enjoy special prices on selected services this week. Don\'t miss out!', builtIn: true },
		{ id: '_reminder', label: 'Reminder', color: 'var(--admin-green)', title: '\uD83D\uDCC5 Appointment Reminder', body: 'Just a friendly reminder about your upcoming appointment at Blancbeu Salon.', builtIn: true },
		{ id: '_service', label: 'New Service', color: 'var(--admin-purple)', title: '\u2B50 New Service Available!', body: 'We\'ve added an exciting new service to our menu. Check it out and book today!', builtIn: true },
		{ id: '_update', label: 'Update', color: 'var(--admin-orange)', title: '\uD83D\uDCE2 Important Update', body: 'We have an important update regarding our services. Please check the app for details.', builtIn: true },
		{ id: '_general', label: 'General', color: 'var(--admin-indigo)', title: '\uD83D\uDD14 Hello from Blancbeu!', body: 'We miss you! It\'s been a while since your last visit. Book your next appointment today.', builtIn: true }
	];

	let savedTemplates = $state<NotifTemplate[]>([]);
	let isLoadingTemplates = $state(false);
	let isSavingTemplate = $state(false);

	// Combined: built-in + saved (for the quick-pick scroll)
	const allTemplates = $derived([...defaultTemplates, ...savedTemplates]);

	// Template editor state
	let showTemplateEditor = $state(false);
	let editingTemplate = $state<NotifTemplate | null>(null);
	let tplLabel = $state('');
	let tplTitle = $state('');
	let tplBody = $state('');
	let tplUrl = $state('');
	let tplColor = $state(templateColors[0]);

	function applyTemplate(tpl: NotifTemplate) {
		notifTitle = tpl.title;
		notifBody = tpl.body;
		if (tpl.url) notifUrl = tpl.url;
		showAllTemplates = false;
		showToast(`Template "${tpl.label}" applied`, 'success');
	}

	async function loadTemplates() {
		isLoadingTemplates = true;
		try {
			const q = query(collection(db, 'notificationTemplates'), orderBy('createdAt', 'desc'));
			const snap = await getDocs(q);
			savedTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotifTemplate));
		} catch (err) {
			console.error('[Notify] Templates load error:', err);
		} finally {
			isLoadingTemplates = false;
		}
	}

	function openTemplateEditor(tpl?: NotifTemplate) {
		if (tpl && !tpl.builtIn) {
			editingTemplate = tpl;
			tplLabel = tpl.label;
			tplTitle = tpl.title;
			tplBody = tpl.body;
			tplUrl = tpl.url || '';
			tplColor = tpl.color || templateColors[0];
		} else {
			editingTemplate = null;
			tplLabel = '';
			tplTitle = '';
			tplBody = '';
			tplUrl = '';
			tplColor = templateColors[0];
		}
		showTemplateEditor = true;
	}

	function closeTemplateEditor() {
		showTemplateEditor = false;
		editingTemplate = null;
	}

	function openSaveAsTemplate() {
		editingTemplate = null;
		tplLabel = '';
		tplTitle = notifTitle;
		tplBody = notifBody;
		tplUrl = notifUrl;
		tplColor = templateColors[Math.floor(Math.random() * templateColors.length)];
		showTemplateEditor = true;
	}

	async function saveTemplate() {
		if (!tplLabel.trim() || !tplTitle.trim() || !tplBody.trim()) {
			showToast('Please fill in label, title, and message', 'error');
			return;
		}
		isSavingTemplate = true;
		try {
			const data: any = {
				label: tplLabel.trim(),
				title: tplTitle.trim(),
				body: tplBody.trim(),
				color: tplColor,
				...(tplUrl.trim() && { url: tplUrl.trim() }),
				createdAt: serverTimestamp()
			};

			if (editingTemplate) {
				await setDoc(doc(db, 'notificationTemplates', editingTemplate.id), data, { merge: true });
				showToast('Template updated', 'success');
			} else {
				await addDoc(collection(db, 'notificationTemplates'), data);
				showToast('Template saved', 'success');
			}
			await loadTemplates();
			closeTemplateEditor();
		} catch (err) {
			console.error('[Notify] Save template error:', err);
			showToast('Failed to save template', 'error');
		} finally {
			isSavingTemplate = false;
		}
	}

	async function deleteTemplate(tpl: NotifTemplate) {
		if (tpl.builtIn) return;
		if (!confirm(`Delete template "${tpl.label}"?`)) return;
		try {
			await deleteDoc(doc(db, 'notificationTemplates', tpl.id));
			showToast('Template deleted', 'success');
			await loadTemplates();
		} catch (err) {
			console.error('[Notify] Delete template error:', err);
			showToast('Failed to delete template', 'error');
		}
	}

	// --- Clear All Fields ---
	function clearAllFields() {
		notifTitle = '';
		notifBody = '';
		notifUrl = '';
		imageFile = null;
		imagePreview = null;
		sendResult = null;
		targetAudience = 'all';
		if (imageInputRef) imageInputRef.value = '';
		showToast('All fields cleared', 'success');
	}

	// --- Image Handling ---
	function handleImageSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || !input.files[0]) return;
		const file = input.files[0];

		if (!file.type.startsWith('image/')) {
			showToast('Please select an image file', 'error');
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			showToast('Image must be under 5MB', 'error');
			return;
		}

		imageFile = file;
		const reader = new FileReader();
		reader.onload = () => {
			imagePreview = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function removeImage() {
		imageFile = null;
		imagePreview = null;
		if (imageInputRef) imageInputRef.value = '';
	}

	async function uploadNotifImage(): Promise<string | null> {
		if (!imageFile) return null;
		try {
			isUploadingImage = true;
			const storageRef = ref(storage, `notifications/${Date.now()}_${imageFile.name}`);
			await uploadBytes(storageRef, imageFile);
			return await getDownloadURL(storageRef);
		} catch (err) {
			console.error('[Notify] Image upload error:', err);
			showToast('Failed to upload image', 'error');
			return null;
		} finally {
			isUploadingImage = false;
		}
	}

	// --- Current Time for preview ---
	let currentTime = $state('');
	function updateTime() {
		const now = new Date();
		currentTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
	}

	// --- Send Broadcast ---
	async function sendBroadcast() {
		if (!notifTitle.trim() || !notifBody.trim()) {
			showToast('Please fill in both title and message', 'error');
			return;
		}

		if (!auth.currentUser) {
			showToast('Not authenticated', 'error');
			return;
		}

		const audienceLabel = targetAudience === 'test_self' ? 'yourself (test)' : targetAudience === 'all' ? 'all' : targetAudience === 'users_only' ? 'user' : 'staff';
		if (!confirm(`Send this notification to ${targetAudience === 'test_self' ? audienceLabel : audienceFilteredSubscribers.length + ' ' + audienceLabel + ' subscriber(s)'}?`)) return;

		isSending = true;
		sendResult = null;

		try {
			// Upload image if present
			let imageUrl: string | null = null;
			if (imageFile) {
				imageUrl = await uploadNotifImage();
			}

			const idToken = await auth.currentUser.getIdToken();
			const res = await fetch('/api/notifications/broadcast', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`
				},
				body: JSON.stringify({
					title: notifTitle.trim(),
					body: notifBody.trim(),
					targetAudience: targetAudience === 'test_self' ? 'specific' : targetAudience,
					...(targetAudience === 'test_self' && auth.currentUser && { userIds: [auth.currentUser.uid] }),
					...(imageUrl && { imageUrl }),
					...(notifUrl.trim() && { clickUrl: notifUrl.trim() })
				})
			});

			const data = await res.json();

			if (res.ok && data.success) {
				sendResult = {
					success: true,
					sentCount: data.sentCount ?? 0,
					targetUserCount: data.targetUserCount ?? 0
				};
				showToast(`Notification sent to ${data.sentCount} device(s)!`, 'success');
				notifTitle = '';
				notifBody = '';
				notifUrl = '';
				imageFile = null;
				imagePreview = null;
				if (imageInputRef) imageInputRef.value = '';
				loadHistory();
			} else {
				sendResult = { success: false, sentCount: 0, targetUserCount: 0 };
				showToast(data.error || 'Failed to send notification', 'error');
			}
		} catch (err) {
			console.error('[Notify] Send error:', err);
			sendResult = { success: false, sentCount: 0, targetUserCount: 0 };
			showToast('Failed to send notification', 'error');
		} finally {
			isSending = false;
		}
	}

	// --- Load History ---
	async function loadHistory() {
		isLoadingHistory = true;
		try {
			const q = query(
				collection(db, 'notificationHistory'),
				orderBy('sentAt', 'desc'),
				firestoreLimit(50)
			);
			const snap = await getDocs(q);
			history = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotifHistoryItem));
		} catch (err) {
			console.error('[Notify] History load error:', err);
		} finally {
			isLoadingHistory = false;
		}
	}

	function formatDate(timestamp: any): string {
		if (!timestamp) return 'Unknown';
		const date = timestamp.seconds
			? new Date(timestamp.seconds * 1000)
			: new Date(timestamp);
		if (isNaN(date.getTime())) return 'Unknown';
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// Avatar colors
	const avatarColors = ['#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#FF375F', '#AC8E68', '#5E5CE6', '#32ADE6'];
	function getColor(name: string): string {
		return avatarColors[(name || '?').charCodeAt(0) % avatarColors.length];
	}

	onMount(() => {
		loadHistory();
		loadTemplates();
		updateTime();
		const interval = setInterval(updateTime, 30000);

		// Debug: check subscriber data after store loads
		const debugUnsub = allUsers.subscribe(users => {
			console.log('[Notify Debug] allUsers store updated. Total:', users.length);
			const withTokens = users.filter(u => u.fcmTokens && Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0);
			console.log('[Notify Debug] Users with fcmTokens:', withTokens.length);

			// Detailed breakdown
			const withTokensArray = users.filter(u => Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0);
			const withEmptyTokens = users.filter(u => Array.isArray(u.fcmTokens) && u.fcmTokens.length === 0);
			const withUndefinedTokens = users.filter(u => u.fcmTokens === undefined);
			const withNullTokens = users.filter(u => u.fcmTokens === null);
			const withOtherType = users.filter(u => u.fcmTokens !== undefined && !Array.isArray(u.fcmTokens));

			console.log('[Notify Debug] Breakdown:', {
				total: users.length,
				withValidTokens: withTokensArray.length,
				withEmptyTokens: withEmptyTokens.length,
				withUndefinedTokens: withUndefinedTokens.length,
				withNullTokens: withNullTokens.length,
				withOtherType: withOtherType.length
			});

			if (withTokens.length > 0) {
				console.log('[Notify Debug] Subscriber sample:', withTokens.slice(0, 3).map(u => ({ id: u.id, name: u.displayName || u.name, tokenCount: u.fcmTokens?.length })));
			} else if (users.length > 0) {
				console.log('[Notify Debug] Sample user keys:', Object.keys(users[0]));
				console.log('[Notify Debug] First user fcmTokens value:', users[0].fcmTokens);
				console.log('[Notify Debug] First user fcmTokens type:', typeof users[0].fcmTokens);
			}
		});

		return () => {
			clearInterval(interval);
			debugUnsub();
		};
	});
</script>

<!-- Page Header -->
<div class="admin-view-header">
	<h2 class="admin-view-title">Notify</h2>
	<div style="display: flex; align-items: center; gap: 8px;">
		<div class="notify-subscriber-badge">
			<BellRing size={14} />
			<span>{subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}</span>
		</div>
	</div>
</div>

<!-- Tab Navigation -->
<div class="notify-tabs">
	<button
		class="notify-tab"
		class:active={activeTab === 'compose'}
		onclick={() => (activeTab = 'compose')}
	>
		<Send size={16} />
		<span>Compose</span>
	</button>
	<button
		class="notify-tab"
		class:active={activeTab === 'subscribers'}
		onclick={() => (activeTab = 'subscribers')}
	>
		<Users size={16} />
		<span>Subscribers</span>
	</button>
	<button
		class="notify-tab"
		class:active={activeTab === 'history'}
		onclick={() => { activeTab = 'history'; loadHistory(); }}
	>
		<Clock size={16} />
		<span>History</span>
	</button>
</div>

<!-- ===================== COMPOSE TAB ===================== -->
{#if activeTab === 'compose'}
	<!-- Templates Section -->
	<div class="notify-section">
		<div class="notify-tpl-header-row">
			<div class="notify-tpl-toggle">
				<button class="notify-tpl-toggle-btn" class:active={!showAllTemplates} onclick={() => (showAllTemplates = false)}>Quick Templates</button>
				<button class="notify-tpl-toggle-btn" class:active={showAllTemplates} onclick={() => { showAllTemplates = true; loadTemplates(); }}>All Templates</button>
			</div>
			{#if showAllTemplates}
				<button class="notify-add-tpl-btn" onclick={() => openTemplateEditor()}>
					<Plus size={14} />
					<span>New</span>
				</button>
			{/if}
		</div>

		{#if !showAllTemplates}
			<!-- Quick template chips -->
			<div class="notify-templates-scroll">
				{#each allTemplates as tpl (tpl.id)}
					<button class="notify-template-chip" onclick={() => applyTemplate(tpl)}>
						<div class="notify-template-icon" style="background: {tpl.color};">
							<FileText size={15} color="#fff" />
						</div>
						<span>{tpl.label}</span>
					</button>
				{/each}
			</div>
		{:else}
			<!-- Full template management inline -->
			<div class="notify-tpl-group-label">Built-in Templates</div>
			{#each defaultTemplates as tpl (tpl.id)}
				<div class="notify-tpl-card">
					<div class="notify-tpl-color" style="background: {tpl.color};"></div>
					<div class="notify-tpl-content">
						<div class="notify-tpl-label">{tpl.label}</div>
						<div class="notify-tpl-title">{tpl.title}</div>
						<div class="notify-tpl-body">{tpl.body}</div>
					</div>
					<button class="notify-tpl-use-btn" onclick={() => applyTemplate(tpl)} title="Use">
						<Send size={13} />
					</button>
				</div>
			{/each}

			<div class="notify-tpl-group-label" style="margin-top: 20px;">
				Your Templates
				{#if savedTemplates.length > 0}
					<span class="notify-tpl-count">{savedTemplates.length}</span>
				{/if}
			</div>

			{#if isLoadingTemplates}
				<div class="notify-empty" style="padding: 24px;">
					<div class="notify-btn-spinner" style="width: 24px; height: 24px;"></div>
					<p>Loading templates...</p>
				</div>
			{:else if savedTemplates.length === 0}
				<div class="notify-empty" style="padding: 30px 20px;">
					<BookmarkPlus size={32} color="var(--admin-text-tertiary)" />
					<p>No saved templates yet</p>
					<span style="font-size: 12px; color: var(--admin-text-tertiary);">
						Compose a notification and save it, or create one here
					</span>
					<button class="notify-add-tpl-btn" style="margin-top: 8px;" onclick={() => openTemplateEditor()}>
						<Plus size={14} />
						<span>Create Template</span>
					</button>
				</div>
			{:else}
				{#each savedTemplates as tpl (tpl.id)}
					<div class="notify-tpl-card">
						<div class="notify-tpl-color" style="background: {tpl.color};"></div>
						<div class="notify-tpl-content">
							<div class="notify-tpl-label">{tpl.label}</div>
							<div class="notify-tpl-title">{tpl.title}</div>
							<div class="notify-tpl-body">{tpl.body}</div>
							{#if tpl.url}
								<div class="notify-tpl-url"><Link2 size={10} /> {tpl.url}</div>
							{/if}
						</div>
						<div class="notify-tpl-actions">
							<button class="notify-tpl-use-btn" onclick={() => applyTemplate(tpl)} title="Use">
								<Send size={13} />
							</button>
							<button class="notify-tpl-edit-btn" onclick={() => openTemplateEditor(tpl)} title="Edit">
								<Pencil size={13} />
							</button>
							<button class="notify-tpl-del-btn" onclick={() => deleteTemplate(tpl)} title="Delete">
								<Trash2 size={13} />
							</button>
						</div>
					</div>
				{/each}
			{/if}
		{/if}
	</div>

	{#if !showAllTemplates}
	<!-- Compose Form -->
	<div class="notify-section">
		<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
			<h3 class="notify-section-title" style="margin-bottom: 0;">Compose Notification</h3>
			{#if hasContent}
				<button class="notify-clear-btn" onclick={clearAllFields} title="Clear all fields">
					<Trash2 size={14} />
					<span>Clear All</span>
				</button>
			{/if}
		</div>
		<div class="notify-compose-card">
			<!-- Title Input -->
			<div class="notify-input-group">
				<div class="notify-label-row">
					<label for="notif-title">Title</label>
					{#if notifTitle}
						<button class="notify-field-clear" onclick={() => (notifTitle = '')} title="Clear title">
							<X size={12} />
						</button>
					{/if}
				</div>
				<input
					id="notif-title"
					type="text"
					placeholder="e.g. Special Offer This Weekend!"
					bind:value={notifTitle}
					maxlength="100"
				/>
				<span class="notify-char-count" class:warn={notifTitle.length > 80}>{notifTitle.length}/100</span>
			</div>

			<!-- Message Input -->
			<div class="notify-input-group">
				<div class="notify-label-row">
					<label for="notif-body">Message</label>
					{#if notifBody}
						<button class="notify-field-clear" onclick={() => (notifBody = '')} title="Clear message">
							<X size={12} />
						</button>
					{/if}
				</div>
				<textarea
					id="notif-body"
					placeholder="Write your notification message..."
					bind:value={notifBody}
					rows="4"
					maxlength="500"
				></textarea>
				<span class="notify-char-count" class:warn={notifBody.length > 400}>{notifBody.length}/500</span>
			</div>

			<!-- Image Upload -->
			<div class="notify-input-group">
				<div class="notify-label-row">
					<label>Image <span style="font-weight: 500; text-transform: none; letter-spacing: 0;">(optional)</span></label>
					{#if imageFile}
						<button class="notify-field-clear" onclick={removeImage} title="Remove image">
							<X size={12} />
						</button>
					{/if}
				</div>
				{#if imagePreview}
					<div class="notify-image-preview-wrapper">
						<img src={imagePreview} alt="Notification" class="notify-image-preview" />
						<button class="notify-image-remove" onclick={removeImage}>
							<X size={14} />
						</button>
					</div>
				{:else}
					<label class="notify-image-upload">
						<Image size={20} color="var(--admin-text-tertiary)" />
						<span>Tap to add an image</span>
						<span class="notify-image-hint">JPG, PNG, WebP &middot; Max 5MB</span>
						<input
							type="file"
							accept="image/*"
							onchange={handleImageSelect}
							bind:this={imageInputRef}
							style="display: none;"
						/>
					</label>
				{/if}
			</div>

			<!-- Click URL -->
			<div class="notify-input-group">
				<div class="notify-label-row">
					<label>Click URL <span style="font-weight: 500; text-transform: none; letter-spacing: 0;">(optional)</span></label>
					{#if notifUrl}
						<button class="notify-field-clear" onclick={() => (notifUrl = '')} title="Clear URL">
							<X size={12} />
						</button>
					{/if}
				</div>
				<div class="notify-url-input-wrapper">
					<Link2 size={16} class="notify-url-icon" />
					<input
						id="notif-url"
						type="url"
						placeholder="https://blancbeu.in/booking"
						bind:value={notifUrl}
						maxlength="500"
					/>
				</div>
				<span class="notify-url-hint">Opens when user taps the notification</span>
			</div>

			<!-- Save as Template (bottom of compose part) -->
			{#if hasContent && notifTitle.trim() && notifBody.trim()}
				<div style="display: flex; justify-content: flex-end; padding-top: 4px;">
					<button class="notify-save-tpl-inline" onclick={openSaveAsTemplate}>
						<BookmarkPlus size={13} />
						<span>Save as Template</span>
					</button>
				</div>
			{/if}

			<!-- Divider -->
			<div class="notify-card-divider">
				<span>Send To</span>
			</div>

			<!-- Target Audience -->
			<div class="notify-input-group">
				<div class="notify-audience-pills">
					<button
						class="notify-pill"
						class:active={targetAudience === 'all'}
						onclick={() => (targetAudience = 'all')}
					>
						<Users size={13} />
						All ({subscribers.length})
					</button>
					<button
						class="notify-pill"
						class:active={targetAudience === 'users_only'}
						onclick={() => (targetAudience = 'users_only')}
					>
						<Bell size={13} />
						Users Only
					</button>
					<button
						class="notify-pill"
						class:active={targetAudience === 'staff_only'}
						onclick={() => (targetAudience = 'staff_only')}
					>
						<Star size={13} />
						Staff Only
					</button>
					<button
						class="notify-pill test"
						class:active={targetAudience === 'test_self'}
						onclick={() => (targetAudience = 'test_self')}
					>
						<Smartphone size={13} />
						Test (Me)
					</button>
				</div>
			</div>

			<!-- Realistic Phone Preview -->
			{#if notifTitle || notifBody}
				<div class="notify-preview-section">
					<button class="notify-preview-toggle" onclick={() => (showPhonePreview = !showPhonePreview)}>
						<Eye size={14} />
						<span>{showPhonePreview ? 'Hide' : 'Show'} Device Preview</span>
						{#if showPhonePreview}
							<ChevronUp size={14} />
						{:else}
							<ChevronDown size={14} />
						{/if}
					</button>

					{#if showPhonePreview}
						<div class="phone-frame">
							<!-- Phone Status Bar -->
							<div class="phone-statusbar">
								<span class="phone-time">{currentTime || '9:41 AM'}</span>
								<div class="phone-statusbar-icons">
									<Wifi size={12} />
									<Battery size={12} />
								</div>
							</div>

							<!-- Notification Card on Lock Screen -->
							<div class="phone-lockscreen">
								<div class="phone-notif-card">
									<div class="phone-notif-top">
										<img src="/favicon.png" alt="App" width="18" height="18" style="border-radius: 4px;" />
										<span class="phone-notif-app">
											{#if notifUrl}
												Chrome &bull; {notifUrl.replace(/^https?:\/\//, '').split('/')[0]} &bull; now
											{:else}
												BLANCBEU
											{/if}
										</span>
										<span class="phone-notif-time">{notifUrl ? '' : 'now'}</span>
									</div>
									<div class="phone-notif-body">
										<div class="phone-notif-text">
											<strong>{notifTitle || 'Notification Title'}</strong>
											<p>{notifBody || 'Notification message...'}</p>
										</div>
										{#if imagePreview}
											<img src={imagePreview} alt="" class="phone-notif-thumb" />
										{/if}
									</div>
									{#if imagePreview}
										<img src={imagePreview} alt="" class="phone-notif-bigimage" />
									{/if}
								</div>
							{#if notifUrl}
								<div class="phone-url-hint">
									<Link2 size={10} />
									Opens: <span>{notifUrl}</span>
								</div>
							{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Inline mini preview (always visible) -->
				{#if !showPhonePreview}
					<div class="notify-mini-preview">
						<img src="/favicon.png" alt="App" width="22" height="22" style="border-radius: 5px; flex-shrink: 0;" />
						<div style="flex: 1; min-width: 0;">
							<strong>{notifTitle || 'Title'}</strong>
							<p>{notifBody || 'Message...'}</p>
						</div>
						{#if imagePreview}
							<img src={imagePreview} alt="" class="notify-mini-thumb" />
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Audience Info -->
			<div class="notify-audience-info">
				<Megaphone size={16} color="var(--admin-accent)" />
				<span>
					{#if targetAudience === 'test_self'}
						Sending test to <strong>yourself</strong>
					{:else}
						Sending to <strong>{audienceFilteredSubscribers.length}</strong>
						{targetAudience === 'users_only' ? 'user' : targetAudience === 'staff_only' ? 'staff' : ''}
						subscriber{audienceFilteredSubscribers.length !== 1 ? 's' : ''}
					{/if}
				</span>
			</div>

			<!-- Action Buttons -->
			<div class="notify-action-row">
				<button
					class="notify-send-btn"
					onclick={sendBroadcast}
					disabled={isSending || !notifTitle.trim() || !notifBody.trim()}
				>
					{#if isSending}
						<div class="notify-btn-spinner"></div>
						{isUploadingImage ? 'Uploading...' : 'Sending...'}
					{:else}
						<Send size={18} />
						Send Now
					{/if}
				</button>
			</div>

			<!-- Send Result -->
			{#if sendResult}
				<div class="notify-result" class:success={sendResult.success} class:error={!sendResult.success}>
					{#if sendResult.success}
						<CheckCircle2 size={18} />
						<span>Sent to {sendResult.sentCount} device(s) across {sendResult.targetUserCount} user(s)</span>
					{:else}
						<XCircle size={18} />
						<span>Failed to send notification. Please try again.</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
	{/if}

<!-- ===================== SUBSCRIBERS TAB ===================== -->
{:else if activeTab === 'subscribers'}
	<div class="notify-section">
		<!-- Debug Panel -->
		<div class="notify-debug-panel" style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
			<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
				<h4 style="margin: 0; font-size: 14px; color: #495057;">Debug Tools</h4>
				<div style="display: flex; gap: 8px;">
					<button
						onclick={async () => {
							console.log('[Notify Debug] Fetching users directly from Firestore...');
							const snapshot = await getDocs(collection(db, 'users'));
							const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
							console.log('[Notify Debug] Raw Firestore users count:', users.length);

							const withTokens = users.filter((u: any) => u.fcmTokens && Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0);
							console.log('[Notify Debug] Users with fcmTokens in Firestore:', withTokens.length);

							if (withTokens.length > 0) {
								console.log('[Notify Debug] Sample subscribers from Firestore:', withTokens.slice(0, 3).map((u: any) => ({
									id: u.id,
									name: u.displayName || u.name || 'Unknown',
									tokenCount: u.fcmTokens.length,
									tokens: u.fcmTokens.map((t: string) => t.substring(0, 20) + '...')
								})));
							} else {
								console.log('[Notify Debug] No users with fcmTokens found in Firestore');
								console.log('[Notify Debug] First 3 users sample:', users.slice(0, 3).map((u: any) => ({
									id: u.id,
									fcmTokens: u.fcmTokens,
									fcmTokensType: typeof u.fcmTokens,
									role: u.role,
									name: u.displayName || u.name || 'Unknown'
								})));
							}
							alert(`Firestore check complete. ${withTokens.length} users with tokens. Check console.`);
						}}
						style="padding: 8px 12px; background: #6c757d; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;"
					>
						Refresh & Check Firestore
					</button>
					<button
						onclick={async () => {
							console.log('[Notify Debug] Test Subscribe button CLICKED');
							if (!auth.currentUser) {
								console.error('[Notify Debug] No current user');
								alert('No current user logged in!');
								return;
							}
							console.log('[Notify Debug] Starting subscription process for user:', auth.currentUser.uid);
							console.log('[Notify Debug] Notification.permission before request:', Notification.permission);
							try {
								const result = await requestUserNotificationPermission(auth.currentUser.uid);
								console.log('[Notify Debug] Manual subscription result:', result);
								if (result.success) {
									alert('Successfully subscribed! Token saved. Check console for details.');
								} else {
									alert(`Subscription failed: ${result.error}\nStep: ${result.step}`);
								}
							} catch (err) {
								console.error('[Notify Debug] Unexpected error:', err);
								alert(`Unexpected error: ${err}`);
							}
						}}
						style="padding: 8px 12px; background: var(--admin-accent); color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;"
					>
						Test Subscribe (Me)
					</button>
				</div>
			</div>
			<div style="font-size: 12px; color: #6c757d; font-family: monospace;">
				<div>Current User: {auth.currentUser?.uid || 'Not logged in'}</div>
				<div>Notification Permission: {typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}</div>
				<div>Service Worker API: {typeof navigator !== 'undefined' && navigator.serviceWorker ? 'Supported' : 'Not Supported'}</div>
				{#await (async () => {
					if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
						try {
							const reg = await navigator.serviceWorker.getRegistration();
							return reg ? `Registered: ${reg.scope}` : 'No SW registered';
						} catch (e) {
							return `Error: ${e.message}`;
						}
					}
					return 'N/A';
				})() then swStatus}
					<div>SW Status: {swStatus}</div>
				{/await}
			</div>
			{#if auth.currentUser}
				<button
					onclick={async () => {
						const userId = auth.currentUser!.uid;
						console.log('[Notify Debug] Checking Firestore doc for user:', userId);
						const userDoc = await getDoc(doc(db, 'users', userId));
						if (userDoc.exists()) {
							const data = userDoc.data();
							console.log('[Notify Debug] User doc found:', {
								id: userDoc.id,
								fcmTokens: data.fcmTokens,
								fcmTokensType: typeof data.fcmTokens,
								isArray: Array.isArray(data.fcmTokens),
								tokenCount: Array.isArray(data.fcmTokens) ? data.fcmTokens.length : 0,
								role: data.role,
								displayName: data.displayName || data.name
							});
							alert(`User doc found! fcmTokens: ${Array.isArray(data.fcmTokens) ? data.fcmTokens.length : 'not array'} tokens. Check console.`);
						} else {
							console.log('[Notify Debug] User doc NOT found for:', userId);
							alert('User document not found in Firestore!');
						}
					}}
					style="margin-top: 8px; padding: 6px 10px; background: #ffc107; color: #000; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;"
				>
					Check My Firestore Doc
				</button>
			{/if}
		</div>

		<!-- Stats Row -->
		<div class="notify-stats-row">
			<div class="notify-stat-card">
				<div class="notify-stat-icon" style="background: var(--admin-green-light); color: var(--admin-green);">
					<BellRing size={20} />
				</div>
				<div>
					<div class="notify-stat-value">{subscribers.length}</div>
					<div class="notify-stat-label">Active Subscribers</div>
				</div>
			</div>
			<div class="notify-stat-card">
				<div class="notify-stat-icon" style="background: var(--admin-accent-light); color: var(--admin-accent);">
					<Users size={20} />
				</div>
				<div>
					<div class="notify-stat-value">{$allUsers.length}</div>
					<div class="notify-stat-label">Total Users</div>
				</div>
			</div>
		</div>

		<!-- Subscription Rate -->
		<div class="notify-rate-bar">
			<div class="notify-rate-header">
				<span>Subscription Rate</span>
				<span class="notify-rate-pct">
					{$allUsers.length > 0 ? Math.round((subscribers.length / $allUsers.length) * 100) : 0}%
				</span>
			</div>
			<div class="notify-progress-track">
				<div
					class="notify-progress-fill"
					style="width: {$allUsers.length > 0 ? (subscribers.length / $allUsers.length) * 100 : 0}%"
				></div>
			</div>
		</div>

		<!-- Search -->
		<div class="admin-search-bar" style="margin-top: 16px;">
			<div style="position: relative;">
				<Search size={16} class="admin-search-icon" />
				<input
					type="text"
					placeholder="Search subscribers..."
					bind:value={subscriberSearch}
					style="width: 100%;"
				/>
			</div>
		</div>

		<!-- Subscriber List -->
		<div class="notify-subscriber-list">
			{#if displayedSubscribers.length === 0}
				<div class="notify-empty">
					<Bell size={36} color="var(--admin-text-tertiary)" />
					<p>No subscribers found</p>
				</div>
			{:else}
				{#each displayedSubscribers as user (user.id)}
					{@const name = getUserDisplayName(user)}
					{@const photo = getUserPhoto(user)}
					{@const phone = getUserPhone(user)}
					{@const tokenCount = ((user as any).fcmTokens || []).length}

					<div class="notify-subscriber-card">
						{#if photo}
							<img src={photo} alt={name} class="notify-subscriber-avatar" />
						{:else}
							<div class="notify-subscriber-avatar-fallback" style="background: {getColor(name)};">
								{name.charAt(0).toUpperCase()}
							</div>
						{/if}

						<div class="notify-subscriber-info">
							<div class="notify-subscriber-name">{name}</div>
							<div class="notify-subscriber-detail">
								{user.email || phone || 'No contact info'}
							</div>
						</div>

						<div class="notify-subscriber-meta">
							<div class="notify-device-badge" title="{tokenCount} device(s)">
								<Bell size={12} />
								{tokenCount}
							</div>
							{#if user.role === 'admin'}
								<span class="notify-role-badge admin">Admin</span>
							{:else if user.role === 'staff'}
								<span class="notify-role-badge staff">Staff</span>
							{:else}
								<span class="notify-role-badge user">User</span>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Show More / Less -->
		{#if filteredSubscribers.length > 10}
			<button class="notify-show-more" onclick={() => (showAllSubscribers = !showAllSubscribers)}>
				{#if showAllSubscribers}
					<ChevronUp size={16} />
					Show Less
				{:else}
					<ChevronDown size={16} />
					Show All ({filteredSubscribers.length})
				{/if}
			</button>
		{/if}
	</div>

<!-- ===================== HISTORY TAB ===================== -->
{:else if activeTab === 'history'}
	<div class="notify-section">
		<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
			<h3 class="notify-section-title" style="margin-bottom: 0;">Sent Notifications</h3>
			<button class="notify-refresh-btn" onclick={loadHistory} disabled={isLoadingHistory}>
				<RefreshCw size={16} class={isLoadingHistory ? 'spinning' : ''} />
			</button>
		</div>

		{#if isLoadingHistory && history.length === 0}
			<div class="notify-empty">
				<div class="notify-btn-spinner" style="width: 24px; height: 24px;"></div>
				<p>Loading history...</p>
			</div>
		{:else if history.length === 0}
			<div class="notify-empty">
				<Clock size={36} color="var(--admin-text-tertiary)" />
				<p>No notifications sent yet</p>
				<span style="font-size: 12px; color: var(--admin-text-tertiary);">
					Sent notifications will appear here
				</span>
			</div>
		{:else}
			{#each displayedHistory as item (item.id)}
				<div class="notify-history-card">
					<div class="notify-history-header">
						<div class="notify-history-status" class:sent={item.status === 'sent'} class:failed={item.status === 'failed'} class:no-subs={item.status === 'no_subscribers'}>
							{#if item.status === 'sent'}
								<CheckCircle2 size={14} />
							{:else if item.status === 'failed'}
								<XCircle size={14} />
							{:else}
								<AlertTriangle size={14} />
							{/if}
							<span>
								{item.status === 'sent' ? 'Sent' : item.status === 'failed' ? 'Failed' : 'No Subscribers'}
							</span>
						</div>
						<span class="notify-history-time">{formatDate(item.sentAt)}</span>
					</div>

					<div class="notify-history-content">
						<strong>{item.title}</strong>
						<p>{item.body}</p>
					</div>

					{#if item.imageUrl}
						<img src={item.imageUrl} alt="" class="notify-history-image" />
					{/if}

					{#if item.clickUrl}
						<div class="notify-history-url">
							<Link2 size={12} />
							<a href={item.clickUrl} target="_blank" rel="noopener">{item.clickUrl}</a>
						</div>
					{/if}

					<div class="notify-history-stats">
						<span>
							<Users size={12} />
							{item.targetUserCount} user{item.targetUserCount !== 1 ? 's' : ''}
						</span>
						<span>
							<Send size={12} />
							{item.sentCount} delivered
						</span>
						{#if item.failureCount > 0}
							<span class="notify-failure">
								<XCircle size={12} />
								{item.failureCount} failed
							</span>
						{/if}
					</div>
				</div>
			{/each}

			<!-- Show More / Less -->
			{#if history.length > 5}
				<button class="notify-show-more" onclick={() => (showAllHistory = !showAllHistory)}>
					{#if showAllHistory}
						<ChevronUp size={16} />
						Show Less
					{:else}
						<ChevronDown size={16} />
						Show All ({history.length})
					{/if}
				</button>
			{/if}
		{/if}
	</div>
{/if}

<!-- ===================== TEMPLATE EDITOR OVERLAY ===================== -->
{#if showTemplateEditor}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="tpl-overlay" onclick={closeTemplateEditor}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="tpl-editor" onclick={(e) => e.stopPropagation()}>
			<div class="tpl-editor-header">
				<h3>{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
				<button class="tpl-close-btn" onclick={closeTemplateEditor}>
					<X size={18} />
				</button>
			</div>

			<div class="tpl-editor-body">
				<div class="notify-input-group">
					<label for="tpl-label">Template Name</label>
					<input id="tpl-label" type="text" placeholder="e.g. Weekend Offer" bind:value={tplLabel} maxlength="40" />
				</div>

				<div class="notify-input-group">
					<label for="tpl-title">Notification Title</label>
					<input id="tpl-title" type="text" placeholder="e.g. ✨ Special Offer!" bind:value={tplTitle} maxlength="100" />
				</div>

				<div class="notify-input-group">
					<label for="tpl-body">Notification Message</label>
					<textarea id="tpl-body" placeholder="Write message..." bind:value={tplBody} rows="3" maxlength="500"></textarea>
				</div>

				<div class="notify-input-group">
					<label for="tpl-url">Click URL <span style="font-weight: 500; text-transform: none; letter-spacing: 0;">(optional)</span></label>
					<input id="tpl-url" type="url" placeholder="https://blancbeu.in/booking" bind:value={tplUrl} maxlength="500" />
				</div>

				<!-- Color Picker -->
				<div class="notify-input-group">
					<label>Color</label>
					<div class="tpl-color-grid">
						{#each templateColors as c}
							<button
								class="tpl-color-swatch"
								class:active={tplColor === c}
								style="background: {c};"
								onclick={() => (tplColor = c)}
							></button>
						{/each}
					</div>
				</div>
			</div>

			<div class="tpl-editor-footer">
				<button class="tpl-cancel-btn" onclick={closeTemplateEditor}>Cancel</button>
				<button
					class="tpl-save-btn"
					onclick={saveTemplate}
					disabled={isSavingTemplate || !tplLabel.trim() || !tplTitle.trim() || !tplBody.trim()}
				>
					{#if isSavingTemplate}
						<div class="notify-btn-spinner" style="width: 14px; height: 14px;"></div>
						Saving...
					{:else}
						<Save size={14} />
						{editingTemplate ? 'Update' : 'Save'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* --- Tabs --- */
	.notify-tabs {
		display: flex;
		background: var(--admin-surface);
		border-radius: var(--admin-radius-md);
		border: 1px solid var(--admin-border);
		padding: 4px;
		margin-bottom: 20px;
		gap: 4px;
	}

	.notify-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px 8px;
		border: none;
		background: transparent;
		border-radius: var(--admin-radius-sm);
		font-size: 13px;
		font-weight: 600;
		color: var(--admin-text-tertiary);
		cursor: pointer;
		transition: all 0.2s;
		font-family: var(--admin-font);
	}

	.notify-tab.active {
		background: var(--admin-accent);
		color: #000;
		box-shadow: 0 2px 8px var(--admin-accent-light);
	}

	:global([data-theme='clean']) .notify-tab.active {
		color: #fff;
	}

	/* --- Subscriber Badge (header) --- */
	.notify-subscriber-badge {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border-radius: var(--admin-radius-full);
		background: var(--admin-green-light);
		color: var(--admin-green);
		font-size: 12px;
		font-weight: 700;
	}

	/* --- Section --- */
	.notify-section {
		margin-bottom: 24px;
	}

	.notify-section-title {
		font-family: var(--admin-font-display);
		font-size: 15px;
		font-weight: 700;
		color: var(--admin-text-primary);
		margin-bottom: 12px;
		letter-spacing: -0.2px;
	}

	/* --- Clear All Button --- */
	.notify-clear-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border: 1px solid var(--admin-red-light);
		background: transparent;
		border-radius: var(--admin-radius-full);
		color: var(--admin-red);
		font-size: 12px;
		font-weight: 600;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.2s;
	}

	.notify-clear-btn:hover {
		background: var(--admin-red-light);
	}

	.notify-clear-btn:active {
		transform: scale(0.95);
	}

	/* --- Per-field clear button --- */
	.notify-label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.notify-field-clear {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: none;
		background: var(--admin-red-light);
		color: var(--admin-red);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
		padding: 0;
	}

	.notify-field-clear:hover {
		background: var(--admin-red);
		color: #fff;
	}

	/* --- Templates Horizontal Scroll --- */
	.notify-templates-scroll {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 6px;
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.notify-templates-scroll::-webkit-scrollbar {
		display: none;
	}

	.notify-template-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		cursor: pointer;
		transition: all 0.2s;
		font-family: var(--admin-font);
		flex-shrink: 0;
		min-width: 72px;
	}

	.notify-template-chip:active {
		transform: scale(0.95);
		background: var(--admin-surface-hover);
	}

	.notify-template-icon {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.notify-template-chip span {
		font-size: 10px;
		font-weight: 600;
		color: var(--admin-text-primary);
		white-space: nowrap;
	}

	/* --- Compose Card --- */
	.notify-compose-card {
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-lg);
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.notify-input-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		position: relative;
	}

	.notify-input-group label {
		font-size: 12px;
		font-weight: 700;
		color: var(--admin-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.notify-input-group input,
	.notify-input-group textarea {
		width: 100%;
		padding: 12px 14px;
		border-radius: var(--admin-radius-sm);
		border: 1px solid var(--admin-border);
		background: var(--admin-bg);
		font-size: 14px;
		font-family: var(--admin-font);
		color: var(--admin-text-primary);
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
		resize: vertical;
	}

	.notify-input-group input:focus,
	.notify-input-group textarea:focus {
		border-color: var(--admin-accent);
		box-shadow: 0 0 0 3px var(--admin-accent-light);
	}

	.notify-input-group input::placeholder,
	.notify-input-group textarea::placeholder {
		color: var(--admin-text-tertiary);
	}

	.notify-char-count {
		position: absolute;
		right: 10px;
		bottom: 8px;
		font-size: 10px;
		color: var(--admin-text-tertiary);
		font-weight: 500;
		transition: color 0.2s;
	}

	.notify-char-count.warn {
		color: var(--admin-orange);
		font-weight: 700;
	}

	/* --- URL Input --- */
	.notify-url-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.notify-url-input-wrapper input {
		width: 100%;
		padding: 12px 14px 12px 38px;
		border-radius: var(--admin-radius-sm);
		border: 1px solid var(--admin-border);
		background: var(--admin-bg);
		font-size: 14px;
		font-family: var(--admin-font);
		color: var(--admin-text-primary);
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.notify-url-input-wrapper input:focus {
		border-color: var(--admin-accent);
		box-shadow: 0 0 0 3px var(--admin-accent-light);
	}

	.notify-url-input-wrapper input::placeholder {
		color: var(--admin-text-tertiary);
	}

	:global(.notify-url-icon) {
		position: absolute;
		left: 12px;
		color: var(--admin-text-tertiary);
		pointer-events: none;
	}

	.notify-url-hint {
		font-size: 11px;
		color: var(--admin-text-tertiary);
		font-weight: 500;
		margin-top: -2px;
	}

	/* --- Image Upload --- */
	.notify-image-upload {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 24px 16px;
		border: 2px dashed var(--admin-border);
		border-radius: var(--admin-radius-md);
		background: var(--admin-bg);
		cursor: pointer;
		transition: all 0.2s;
	}

	.notify-image-upload:hover {
		border-color: var(--admin-accent);
		background: var(--admin-accent-light);
	}

	.notify-image-upload span {
		font-size: 13px;
		font-weight: 600;
		color: var(--admin-text-secondary);
	}

	.notify-image-hint {
		font-size: 11px !important;
		color: var(--admin-text-tertiary) !important;
		font-weight: 400 !important;
	}

	.notify-image-preview-wrapper {
		position: relative;
		border-radius: var(--admin-radius-md);
		overflow: hidden;
		border: 1px solid var(--admin-border);
	}

	.notify-image-preview {
		width: 100%;
		max-height: 200px;
		object-fit: cover;
		display: block;
	}

	.notify-image-remove {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		backdrop-filter: blur(4px);
		transition: background 0.2s;
	}

	.notify-image-remove:hover {
		background: var(--admin-red);
	}

	/* --- Audience Pills --- */
	.notify-audience-pills {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.notify-pill {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 7px 14px;
		border-radius: var(--admin-radius-full);
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		font-size: 12px;
		font-weight: 600;
		color: var(--admin-text-tertiary);
		cursor: pointer;
		transition: all 0.2s;
		font-family: var(--admin-font);
	}

	.notify-pill.active {
		background: var(--admin-accent);
		color: #000;
		border-color: transparent;
		box-shadow: 0 2px 8px var(--admin-accent-light);
		font-weight: 700;
	}

	:global([data-theme='clean']) .notify-pill.active {
		color: #fff;
	}

	.notify-pill.test.active {
		background: var(--admin-orange);
	}

	.notify-pill:active {
		transform: scale(0.95);
	}

	/* --- Phone Preview --- */
	.notify-preview-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.notify-preview-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 1px solid var(--admin-border);
		background: var(--admin-bg);
		border-radius: var(--admin-radius-full);
		font-size: 12px;
		font-weight: 600;
		color: var(--admin-text-secondary);
		cursor: pointer;
		font-family: var(--admin-font);
		transition: all 0.2s;
		align-self: flex-start;
	}

	.notify-preview-toggle:hover {
		border-color: var(--admin-accent);
		color: var(--admin-accent);
	}

	/* Realistic Phone Frame */
	.phone-frame {
		width: 100%;
		max-width: 320px;
		margin: 0 auto;
		background: #000;
		border-radius: 28px;
		border: 3px solid #333;
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
		animation: fadeIn 0.3s ease;
	}

	.phone-statusbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 24px 6px;
		color: #fff;
	}

	.phone-time {
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.2px;
	}

	.phone-statusbar-icons {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #fff;
	}

	.phone-lockscreen {
		padding: 16px 14px 28px;
		min-height: 180px;
	}

	.phone-notif-card {
		background: rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(30px);
		-webkit-backdrop-filter: blur(30px);
		border-radius: 16px;
		padding: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.phone-notif-top {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
	}

	.phone-notif-app {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		letter-spacing: 0.5px;
		flex: 1;
	}

	.phone-notif-time {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.4);
	}

	.phone-notif-body {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}

	.phone-notif-text {
		flex: 1;
		min-width: 0;
	}

	.phone-notif-text strong {
		display: block;
		font-size: 13px;
		font-weight: 700;
		color: #fff;
		margin-bottom: 2px;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.phone-notif-text p {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.7);
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.phone-notif-thumb {
		width: 38px;
		height: 38px;
		border-radius: 6px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.phone-notif-bigimage {
		width: 100%;
		max-height: 140px;
		object-fit: cover;
		border-radius: 10px;
		margin-top: 8px;
	}

	/* Phone URL hint below notification card */
	.phone-url-hint {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 10px;
		padding: 0 4px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.45);
		font-weight: 500;
	}

	.phone-url-hint span {
		color: rgba(120, 180, 255, 0.7);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* --- Mini Preview (inline) --- */
	.notify-mini-preview {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 10px 12px;
		background: var(--admin-bg);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		animation: fadeIn 0.2s ease;
	}

	.notify-mini-preview strong {
		display: block;
		font-size: 13px;
		font-weight: 700;
		color: var(--admin-text-primary);
		margin-bottom: 2px;
		line-height: 1.3;
	}

	.notify-mini-preview p {
		font-size: 12px;
		color: var(--admin-text-secondary);
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.notify-mini-thumb {
		width: 36px;
		height: 36px;
		border-radius: 6px;
		object-fit: cover;
		flex-shrink: 0;
	}

	/* --- Audience Info --- */
	.notify-audience-info {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: var(--admin-accent-light);
		border-radius: var(--admin-radius-sm);
		font-size: 13px;
		color: var(--admin-text-secondary);
	}

	.notify-audience-info strong {
		color: var(--admin-accent);
	}

	/* --- Action Row --- */
	.notify-action-row {
		display: flex;
		gap: 10px;
	}

	/* --- Send Button --- */
	.notify-send-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 14px 24px;
		background: var(--admin-accent);
		color: #000;
		border: none;
		border-radius: var(--admin-radius-sm);
		font-size: 15px;
		font-weight: 700;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 16px var(--admin-accent-light);
	}

	:global([data-theme='clean']) .notify-send-btn {
		color: #fff;
	}

	.notify-send-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		filter: brightness(1.1);
	}

	.notify-send-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.notify-send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.notify-btn-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-left-color: #000;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	/* --- Send Result --- */
	.notify-result {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		border-radius: var(--admin-radius-sm);
		font-size: 13px;
		font-weight: 600;
		animation: fadeIn 0.3s ease;
	}

	.notify-result.success {
		background: var(--admin-green-light);
		color: var(--admin-green);
	}

	.notify-result.error {
		background: var(--admin-red-light);
		color: var(--admin-red);
	}

	/* --- Stats Row --- */
	.notify-stats-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 16px;
	}

	.notify-stat-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-lg);
		box-shadow: var(--admin-shadow-sm);
	}

	.notify-stat-icon {
		width: 42px;
		height: 42px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.notify-stat-value {
		font-family: var(--admin-font-display);
		font-size: 22px;
		font-weight: 800;
		color: var(--admin-text-primary);
		line-height: 1.1;
	}

	.notify-stat-label {
		font-size: 11px;
		color: var(--admin-text-secondary);
		font-weight: 500;
	}

	/* --- Subscription Rate --- */
	.notify-rate-bar {
		padding: 14px 16px;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		margin-bottom: 4px;
	}

	.notify-rate-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--admin-text-secondary);
	}

	.notify-rate-pct {
		font-weight: 800;
		color: var(--admin-accent);
	}

	.notify-progress-track {
		width: 100%;
		height: 8px;
		background: var(--admin-bg);
		border-radius: 4px;
		overflow: hidden;
	}

	.notify-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--admin-green), var(--admin-accent));
		border-radius: 4px;
		transition: width 0.5s ease;
		min-width: 2px;
	}

	/* --- Subscriber List --- */
	.notify-subscriber-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.notify-subscriber-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		transition: background 0.15s;
	}

	.notify-subscriber-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.notify-subscriber-avatar-fallback {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		font-weight: 700;
		color: #fff;
		flex-shrink: 0;
	}

	.notify-subscriber-info {
		flex: 1;
		min-width: 0;
	}

	.notify-subscriber-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--admin-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.notify-subscriber-detail {
		font-size: 12px;
		color: var(--admin-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.notify-subscriber-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		flex-shrink: 0;
	}

	.notify-device-badge {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 11px;
		font-weight: 700;
		color: var(--admin-green);
		background: var(--admin-green-light);
		padding: 2px 8px;
		border-radius: var(--admin-radius-full);
	}

	.notify-role-badge {
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: var(--admin-radius-full);
	}

	.notify-role-badge.admin {
		background: var(--admin-accent-light);
		color: var(--admin-accent);
	}

	.notify-role-badge.staff {
		background: var(--admin-purple-light);
		color: var(--admin-purple);
	}

	.notify-role-badge.user {
		background: rgba(142, 142, 147, 0.15);
		color: var(--admin-text-secondary);
	}

	/* --- Show More Button --- */
	.notify-show-more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 10px;
		margin-top: 8px;
		border: 1px dashed var(--admin-border);
		background: transparent;
		border-radius: var(--admin-radius-sm);
		color: var(--admin-text-secondary);
		font-size: 13px;
		font-weight: 600;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.2s;
	}

	.notify-show-more:hover {
		background: var(--admin-surface);
		color: var(--admin-accent);
		border-color: var(--admin-accent);
	}

	/* --- History --- */
	.notify-history-card {
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		padding: 14px;
		margin-bottom: 10px;
	}

	.notify-history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.notify-history-status {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		padding: 3px 10px;
		border-radius: var(--admin-radius-full);
	}

	.notify-history-status.sent {
		background: var(--admin-green-light);
		color: var(--admin-green);
	}

	.notify-history-status.failed {
		background: var(--admin-red-light);
		color: var(--admin-red);
	}

	.notify-history-status.no-subs {
		background: var(--admin-orange-light);
		color: var(--admin-orange);
	}

	.notify-history-time {
		font-size: 11px;
		color: var(--admin-text-tertiary);
		font-weight: 500;
	}

	.notify-history-content {
		margin-bottom: 10px;
	}

	.notify-history-content strong {
		display: block;
		font-size: 14px;
		font-weight: 700;
		color: var(--admin-text-primary);
		margin-bottom: 3px;
	}

	.notify-history-content p {
		font-size: 12px;
		color: var(--admin-text-secondary);
		line-height: 1.4;
	}

	.notify-history-image {
		width: 100%;
		max-height: 140px;
		object-fit: cover;
		border-radius: var(--admin-radius-sm);
		margin-bottom: 10px;
	}

	.notify-history-url {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-bottom: 10px;
		font-size: 12px;
		color: var(--admin-text-tertiary);
	}

	.notify-history-url a {
		color: var(--admin-accent);
		text-decoration: none;
		word-break: break-all;
		font-weight: 500;
	}

	.notify-history-url a:hover {
		text-decoration: underline;
	}

	.notify-history-stats {
		display: flex;
		gap: 14px;
		padding-top: 10px;
		border-top: 1px solid var(--admin-border);
	}

	.notify-history-stats span {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 600;
		color: var(--admin-text-secondary);
	}

	.notify-history-stats .notify-failure {
		color: var(--admin-red);
	}

	/* --- Refresh Button --- */
	.notify-refresh-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: var(--admin-text-secondary);
		transition: all 0.2s;
	}

	.notify-refresh-btn:hover {
		background: var(--admin-surface-hover);
		color: var(--admin-accent);
	}

	.notify-refresh-btn:disabled {
		opacity: 0.5;
	}

	:global(.spinning) {
		animation: spin 0.8s linear infinite;
	}

	/* --- Empty State --- */
	.notify-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		gap: 10px;
		text-align: center;
	}

	.notify-empty p {
		font-size: 14px;
		color: var(--admin-text-secondary);
		font-weight: 500;
	}

	/* --- Template Toggle Row --- */
	.notify-tpl-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.notify-tpl-toggle {
		display: flex;
		background: var(--admin-bg);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-full);
		padding: 2px;
		gap: 2px;
	}

	.notify-tpl-toggle-btn {
		padding: 5px 12px;
		border: none;
		background: transparent;
		border-radius: var(--admin-radius-full);
		font-size: 12px;
		font-weight: 600;
		font-family: var(--admin-font);
		color: var(--admin-text-tertiary);
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.notify-tpl-toggle-btn.active {
		background: var(--admin-accent);
		color: #000;
		box-shadow: 0 1px 4px var(--admin-accent-light);
	}

	:global([data-theme='clean']) .notify-tpl-toggle-btn.active {
		color: #fff;
	}

	.notify-tpl-toggle-btn:not(.active):hover {
		color: var(--admin-text-primary);
	}

	/* --- Card Divider --- */
	.notify-card-divider {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 6px 0 2px;
	}

	.notify-card-divider::before,
	.notify-card-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--admin-border);
	}

	.notify-card-divider span {
		font-size: 11px;
		font-weight: 700;
		color: var(--admin-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	/* --- Save as Template Inline --- */
	.notify-save-tpl-inline {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 5px 10px;
		border: 1px solid var(--admin-accent);
		background: transparent;
		border-radius: var(--admin-radius-full);
		color: var(--admin-accent);
		font-size: 11px;
		font-weight: 600;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.notify-save-tpl-inline:hover {
		background: var(--admin-accent-light);
	}

	.notify-save-tpl-inline:active {
		transform: scale(0.95);
	}

	/* --- Add Template Button --- */
	.notify-add-tpl-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border: 1px solid var(--admin-accent);
		background: transparent;
		border-radius: var(--admin-radius-full);
		color: var(--admin-accent);
		font-size: 12px;
		font-weight: 600;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.2s;
	}

	.notify-add-tpl-btn:hover {
		background: var(--admin-accent-light);
	}

	.notify-add-tpl-btn:active {
		transform: scale(0.95);
	}

	/* --- Template Group Label --- */
	.notify-tpl-group-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		font-weight: 700;
		color: var(--admin-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 0 2px;
		margin-bottom: 10px;
	}

	.notify-tpl-count {
		background: var(--admin-accent);
		color: #000;
		font-size: 10px;
		font-weight: 800;
		padding: 1px 7px;
		border-radius: var(--admin-radius-full);
	}

	:global([data-theme='clean']) .notify-tpl-count {
		color: #fff;
	}

	/* --- Template Card --- */
	.notify-tpl-card {
		display: flex;
		align-items: stretch;
		gap: 12px;
		padding: 12px;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		margin-bottom: 8px;
		transition: background 0.15s;
	}

	.notify-tpl-color {
		width: 4px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.notify-tpl-content {
		flex: 1;
		min-width: 0;
	}

	.notify-tpl-label {
		font-size: 13px;
		font-weight: 700;
		color: var(--admin-text-primary);
		margin-bottom: 2px;
	}

	.notify-tpl-title {
		font-size: 12px;
		color: var(--admin-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-bottom: 1px;
	}

	.notify-tpl-body {
		font-size: 11px;
		color: var(--admin-text-tertiary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.3;
	}

	.notify-tpl-url {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		color: var(--admin-accent);
		margin-top: 3px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.notify-tpl-actions {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex-shrink: 0;
	}

	.notify-tpl-use-btn,
	.notify-tpl-edit-btn,
	.notify-tpl-del-btn {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 1px solid var(--admin-border);
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
		padding: 0;
	}

	.notify-tpl-use-btn {
		color: var(--admin-green);
	}

	.notify-tpl-use-btn:hover {
		background: var(--admin-green-light);
		border-color: var(--admin-green);
	}

	.notify-tpl-edit-btn {
		color: var(--admin-accent);
	}

	.notify-tpl-edit-btn:hover {
		background: var(--admin-accent-light);
		border-color: var(--admin-accent);
	}

	.notify-tpl-del-btn {
		color: var(--admin-red);
	}

	.notify-tpl-del-btn:hover {
		background: var(--admin-red-light);
		border-color: var(--admin-red);
	}

	/* --- Template Editor Overlay --- */
	.tpl-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}

	.tpl-editor {
		width: 100%;
		max-width: 480px;
		max-height: 90vh;
		background: var(--admin-surface);
		border-radius: 20px 20px 0 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.3s ease;
	}

	.tpl-editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 18px;
		border-bottom: 1px solid var(--admin-border);
	}

	.tpl-editor-header h3 {
		font-family: var(--admin-font-display);
		font-size: 17px;
		font-weight: 700;
		color: var(--admin-text-primary);
	}

	.tpl-close-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: var(--admin-bg);
		color: var(--admin-text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tpl-close-btn:hover {
		background: var(--admin-red-light);
		color: var(--admin-red);
	}

	.tpl-editor-body {
		padding: 18px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
		flex: 1;
	}

	.tpl-color-grid {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.tpl-color-swatch {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.15s;
		padding: 0;
	}

	.tpl-color-swatch.active {
		border-color: #fff;
		box-shadow: 0 0 0 2px var(--admin-accent);
		transform: scale(1.15);
	}

	.tpl-color-swatch:hover:not(.active) {
		transform: scale(1.1);
		opacity: 0.8;
	}

	.tpl-editor-footer {
		display: flex;
		gap: 10px;
		padding: 14px 18px;
		border-top: 1px solid var(--admin-border);
	}

	.tpl-cancel-btn {
		flex: 1;
		padding: 12px;
		border: 1px solid var(--admin-border);
		background: transparent;
		border-radius: var(--admin-radius-sm);
		color: var(--admin-text-secondary);
		font-size: 14px;
		font-weight: 600;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.2s;
	}

	.tpl-cancel-btn:hover {
		background: var(--admin-surface-hover);
	}

	.tpl-save-btn {
		flex: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 12px;
		background: var(--admin-accent);
		color: #000;
		border: none;
		border-radius: var(--admin-radius-sm);
		font-size: 14px;
		font-weight: 700;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 2px 8px var(--admin-accent-light);
	}

	:global([data-theme='clean']) .tpl-save-btn {
		color: #fff;
	}

	.tpl-save-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.tpl-save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* --- Animations --- */
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
</style>
