<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { Mic, Send, Bot, Sparkles, AudioLines } from 'lucide-svelte';
	import { db, auth } from '$lib/firebase';
	import { onAuthStateChanged } from 'firebase/auth';
	import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
	import { appServices, initAppServiceListener } from '$lib/stores/appData';
	import { cart } from '$lib/stores/booking';

	let messages: { 
		role: 'user' | 'assistant'; 
		text: string; 
		action?: { label: string; path: string };
		mapEmbed?: string;
	}[] = $state([
		{
			role: 'assistant',
			text: 'Hello! I am your Blancbeu virtual assistant. How can I help you elevate your style today?'
		}
	]);
	let inputText = $state('');
	let isListening = $state(false);
	let tagsExpanded = $state(true);
	let smartReplies: string[] = $state([]);
	let chatContainer: HTMLDivElement;
	let recognition: any = null;

	$effect(() => {
		if (inputText.trim().length > 0) {
			tagsExpanded = false;
		}
	});

	$effect(() => {
		if (isListening) {
			tagsExpanded = false;
		}
	});

	$effect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			// Just tracking auth state to ensure firebase is initialized correctly.
		});
		return unsubscribe;
	});

	const predefinedTags = [
		'📍 Location & Directions',
		'📞 Contact Number',
		'📅 Book Appointment',
		'✨ Virtual Try-On',
		'💇‍♀️ Services & Pricing',
		'👰 Bridal Packages',
		'⏱️ Opening Hours',
		'📝 Cancellation Policy',
		"💇‍♂️ Men's Grooming",
		'🎨 Hair Coloring Options',
		'💅 Nail Care Services',
		'💆‍♀️ Spa & Massages',
		'💳 Payment Methods',
		'🎁 Gift Cards',
		'⭐ Reviews & Testimonials',
		'🚗 Parking Availability',
		'🧴 Haircare Products',
		'🧖‍♀️ Skincare Treatments',
		'💎 Membership Benefits',
		'🎉 Special Offers & Discounts',
		'👶 Kids Haircuts',
		'🌿 Organic & Vegan Options',
		'👩‍🎨 Meet Our Stylists',
		'🤝 Reschedule Appointment',
		'💡 Style Inspiration'
	];

	onMount(() => {
		initAppServiceListener();
		// Initialize Web Speech API if supported
		if (typeof window !== 'undefined') {
			const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
			if (SpeechRecognition) {
				recognition = new SpeechRecognition();
				recognition.continuous = false;
				recognition.interimResults = false;
				recognition.lang = 'en-US';

				recognition.onresult = (event: any) => {
					const transcript = event.results[0][0].transcript;
					inputText = transcript;
					sendMessage();
				};

				recognition.onend = () => {
					isListening = false;
				};

				recognition.onerror = (event: any) => {
					console.error('Speech recognition error:', event.error);
					isListening = false;
				};
			}
		}
	});

	async function scrollToBottom() {
		await tick();
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	async function sendMessage(text?: string) {
		const messageText = text || inputText.trim();
		if (!messageText) return;

		// Add user message
		messages = [...messages, { role: 'user', text: messageText }];
		inputText = '';
		scrollToBottom();

		// Add temporary thinking message
		messages = [...messages, { role: 'assistant', text: '...' }];
		scrollToBottom();

		try {
			const response = await fetch('/api/assistant', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: messageText })
			});

			if (response.ok) {
				const data = await response.json();
				// Replace thinking message with real response
				messages[messages.length - 1] = { 
					role: 'assistant', 
					text: data.reply,
					action: data.action,
					mapEmbed: data.mapEmbed
				};
				smartReplies = data.suggestions || [];
				if (data.booking) {
					handleBookingEvent(data.booking);
				}
			} else {
				messages[messages.length - 1] = {
					role: 'assistant',
					text: "I'm sorry, I'm having trouble connecting right now."
				};
			}
		} catch (e) {
			messages[messages.length - 1] = { role: 'assistant', text: "I'm offline at the moment." };
		}
		scrollToBottom();
	}

	function handleTagClick(tag: string) {
		sendMessage(tag);
		tagsExpanded = false;
	}

	async function handleBookingEvent(data: any) {
		const { service, price, date, time, payment } = data;

		const user = auth.currentUser;
		if (!user) {
			messages = [...messages, { 
				role: 'assistant', 
				text: `I'd love to help you book the ${service}, but you need to log in first.`,
				action: { label: 'Log In', path: '/login' }
			}];
			scrollToBottom();
			return;
		}

		if (payment === 'pay_at_salon') {
			try {

				const bookingData = {
					services: [{ name: service, price: price, id: '' }],
					servicesList: [{ name: service, price: price, id: '' }],
					totalAmount: price,
					date: date,
					time: time,
					userName: user.displayName || 'Guest',
					userEmail: user.email || '',
					userPhone: user.phoneNumber || '',
					notes: `Booked via Assistant`,
					customer: {
						name: user.displayName || 'Guest',
						phone: user.phoneNumber || '',
						email: user.email || '',
						notes: 'Booked via Assistant'
					},
					payment: {
						type: 'free',
						method: 'pay_at_salon',
						amount: 0,
						status: 'unpaid',
						beuCashApplied: 0
					},
					userId: user.uid,
					createdAt: serverTimestamp(),
					status: 'pending',
					source: 'assistant'
				};

				await addDoc(collection(db, 'bookings'), bookingData);
				console.log('[Assistant Booking] Successfully created booking');
			} catch (err) {
				console.error('[Assistant Booking] Failed to create booking:', err);
			}
		} else if (payment === 'pay_now') {
			const matchedService = $appServices.find(s => s.name.toLowerCase() === service.toLowerCase());
			if (matchedService) {
				cart.clear();
				cart.add(matchedService);
			}
			setTimeout(() => {
				goto('/booking');
			}, 2000);
		}
	}

	function toggleListen() {
		if (!recognition) {
			alert('Voice recognition is not supported in this browser.');
			return;
		}

		if (isListening) {
			recognition.stop();
		} else {
			try {
				recognition.start();
				isListening = true;
			} catch (e) {
				console.error(e);
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			sendMessage();
		}
	}
</script>

<div class="assistant-page">
	<!-- Chat Area -->
	<div class="chat-container" bind:this={chatContainer}>
		{#each messages as msg}
			<div class="message-wrapper {msg.role}">
				{#if msg.role === 'assistant'}
					<div class="avatar-small">
						<img src="/ai_assistant.png" alt="AI" />
					</div>
				{/if}
				<div class="message-bubble {msg.role}" class:has-map={msg.mapEmbed}>
					{#if msg.text === '...'}
						<div class="typing-indicator">
							<span></span><span></span><span></span>
						</div>
					{:else}
						<div class="message-content">
							<div class="text-content">{msg.text}</div>
							
							{#if msg.mapEmbed}
								<div class="map-preview" transition:slide>
									<iframe
										title="Salon Location"
										src={msg.mapEmbed}
										width="100%"
										height="260"
										style="border:0; border-radius: 0;"
										allowfullscreen
										loading="lazy"
									></iframe>
								</div>
							{/if}

							{#if msg.action}
								<div class="message-action" transition:slide>
									<button 
										class="action-btn" 
										onclick={() => {
											if (msg.action.path.startsWith('tel:') || msg.action.path.startsWith('mailto:') || msg.action.path.startsWith('http')) {
												window.location.href = msg.action.path;
											} else {
												goto(msg.action.path);
											}
										}}
									>
										{msg.action.label}
									</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Bottom Area -->
	<div class="bottom-area">
		<!-- Smart Replies -->
		{#if smartReplies.length > 0}
			<div class="smart-replies" transition:slide={{ duration: 200 }}>
				{#each smartReplies as reply, i}
					<button 
						class="smart-pill"
						style="animation-delay: {i * 80}ms"
						onclick={() => { inputText = reply; sendMessage(); smartReplies = []; }}
					>{reply}</button>
				{/each}
			</div>
		{/if}

		<!-- Predefined Tags -->
		{#if tagsExpanded && smartReplies.length === 0}
			<div class="tags-container" transition:slide={{ duration: 200 }}>
				<div class="tags-row">
					{#each predefinedTags.filter((_, i) => i % 3 === 0) as tag}
						<button class="tag-chip" onclick={() => handleTagClick(tag)}>
							{tag}
						</button>
					{/each}
				</div>
				<div class="tags-row">
					{#each predefinedTags.filter((_, i) => i % 3 === 1) as tag}
						<button class="tag-chip" onclick={() => handleTagClick(tag)}>
							{tag}
						</button>
					{/each}
				</div>
				<div class="tags-row">
					{#each predefinedTags.filter((_, i) => i % 3 === 2) as tag}
						<button class="tag-chip" onclick={() => handleTagClick(tag)}>
							{tag}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Input Area -->
		<div class="input-container">
			<div class="input-box">
				<button 
					class="plus-btn" 
					class:expanded={tagsExpanded}
					onclick={() => tagsExpanded = !tagsExpanded}
					aria-label="Toggle Tags"
				>
					<Sparkles strokeWidth={1.5} size={22} />
				</button>

				<input
					type="text"
					placeholder="Ask Blancbeu..."
					bind:value={inputText}
					onkeydown={handleKeydown}
				/>
				
				<button 
					class="mic-btn" 
					class:listening={isListening}
					onclick={toggleListen}
					aria-label="Voice Typing"
				>
					{#if isListening}
						<div class="mic-ripple-small"></div>
					{/if}
					<Mic strokeWidth={1.5} size={22} />
				</button>

				<button 
					class="action-circle-btn" 
					onclick={() => {
						if (inputText.trim().length > 0) {
							sendMessage();
						} else {
							if (typeof sessionStorage !== 'undefined') {
								sessionStorage.setItem('fromAssistant', 'true');
							}
							goto('/assistant/companion');
						}
					}}
					aria-label={inputText.trim().length > 0 ? "Send Message" : "Live Assistant"}
				>
					{#if inputText.trim().length > 0}
						<Send size={18} strokeWidth={2} />
					{:else}
						<AudioLines size={20} strokeWidth={2} />
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.assistant-page {
		width: 100%;
		height: 100vh;
		background: var(--color-bg-primary, #121212);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: absolute;
		top: 0;
		left: 0;
		/* z-index removed to sit below global header */
	}

	.chat-container {
		flex: 1;
		overflow-y: auto;
		padding: 76px 24px 20px; /* added top padding to avoid header overlap */
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.message-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		max-width: 85%;
	}

	.message-wrapper.user {
		align-self: flex-end;
	}

	.message-wrapper.assistant {
		align-self: flex-start;
	}

	.avatar-small {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		border: 1px solid var(--color-accent-gold, #d4af37);
		background: var(--gradient-gold, linear-gradient(135deg, #d4af37, #aa842c)) !important;
	}

	.avatar-small img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: var(--gradient-gold, transparent);
	}

	.message-bubble {
		padding: 12px 16px;
		border-radius: 18px;
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.message-bubble.user {
		background: var(--color-bg-secondary, #f0f0f0);
		color: var(--color-text-primary, #000);
		border: 1px solid var(--color-border, #ddd);
		border-bottom-right-radius: 4px;
	}

	.message-bubble.assistant {
		background: rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.1);
		color: var(--color-text-primary, #000);
		border: 1px solid rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.2);
		border-bottom-left-radius: 4px;
		overflow: hidden; /* Ensure map stays within bubble */
	}

	.message-bubble.has-map {
		max-width: 95%;
		width: 100%;
		padding-left: 0;
		padding-right: 0;
	}

	.message-bubble.has-map .text-content,
	.message-bubble.has-map .message-action {
		padding: 0 16px;
	}

	.message-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.text-content {
		white-space: pre-wrap;
	}

	.map-preview {
		width: 100%;
		overflow: hidden;
		margin: 4px 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		border-top: 1px solid rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.2);
		border-bottom: 1px solid rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.2);
	}

	.message-action {
		margin-top: 4px;
	}

	.action-btn {
		background: var(--gradient-gold, linear-gradient(135deg, #d4af37, #aa842c));
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 10px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.2);
	}

	.action-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 15px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.3);
	}

	.action-btn:active {
		transform: translateY(0);
	}

	.typing-indicator {
		display: flex;
		gap: 4px;
		padding: 4px 0;
	}

	.typing-indicator span {
		width: 6px;
		height: 6px;
		background: var(--color-accent-gold, #d4af37);
		border-radius: 50%;
		animation: typing 1s infinite alternate;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.typing-indicator span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes typing {
		0% {
			transform: translateY(0);
			opacity: 0.5;
		}
		100% {
			transform: translateY(-4px);
			opacity: 1;
		}
	}

	.bottom-area {
		position: relative;
		padding: 12px 20px calc(16px + env(safe-area-inset-bottom, 16px));
		background: var(--color-bg-primary, #ffffff);
		border-top-left-radius: 28px;
		border-top-right-radius: 28px;
		box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.06);
		z-index: 10;
	}

	.tags-container {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-bottom: 12px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none; /* Firefox */
	}

	.tags-container::-webkit-scrollbar {
		display: none; /* Safari and Chrome */
	}

	.tags-row {
		display: flex;
		flex-direction: row;
		gap: 6px;
		width: max-content;
	}

	.input-container {
		display: flex;
		justify-content: center;
		width: 100%;
		padding-top: 4px;
	}

	.tag-chip {
		flex-shrink: 0;
		background: var(--color-bg-secondary, rgba(0, 0, 0, 0.03));
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
		color: var(--color-text-primary, #333);
		padding: 7px 14px;
		border-radius: 16px;
		font-size: 0.8rem;
		white-space: nowrap;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.input-box {
		flex: 1;
		max-width: 800px;
		background: var(--color-bg-secondary, #f0f0f0);
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
		border-radius: 30px;
		padding: 6px 6px 6px 16px;
		display: flex;
		align-items: center;
		gap: 12px;
		height: 56px;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
	}

	.plus-btn {
		background: transparent;
		border: none;
		color: var(--color-text-tertiary, #888);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 4px;
		transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.plus-btn:hover {
		color: var(--color-text-primary, #000);
	}

	.plus-btn.expanded {
		transform: rotate(225deg) scale(1.15); /* Spins and turns the stars into 'X' shapes */
		color: var(--color-accent-gold, #d4af37);
	}

	.input-box input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--color-text-primary, #000);
		font-size: 1rem;
		outline: none;
		min-width: 0;
	}

	.input-box input::placeholder {
		color: var(--color-text-tertiary, rgba(0, 0, 0, 0.4));
	}

	.mic-btn {
		background: transparent;
		border: none;
		color: var(--color-text-tertiary, #888);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 4px;
		transition: color 0.2s;
		position: relative;
	}

	.mic-btn:hover {
		color: var(--color-text-primary, #000);
	}

	.mic-btn.listening {
		color: #dc2626;
	}

	.action-circle-btn {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--color-text-primary, #111);
		color: var(--color-bg-primary, #fff);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 0.2s, opacity 0.2s;
	}

	.action-circle-btn:active {
		transform: scale(0.95);
	}

	.mic-ripple-small {
		position: absolute;
		inset: -8px;
		border-radius: 50%;
		border: 1px solid #dc2626;
		animation: ripple-small 1.5s infinite ease-out;
		pointer-events: none;
	}

	@keyframes ripple-small {
		0% {
			transform: scale(0.8);
			opacity: 1;
		}
		100% {
			transform: scale(1.5);
			opacity: 0;
		}
	}

	.smart-replies {
		display: flex;
		gap: 8px;
		padding-bottom: 12px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.smart-replies::-webkit-scrollbar {
		display: none;
	}

	.smart-pill {
		padding: 8px 18px;
		border-radius: 22px;
		background: var(--color-bg-secondary, rgba(0,0,0,0.03));
		border: 1px solid var(--color-accent-gold, #d4af37);
		color: var(--color-text-primary, #333);
		font-size: 0.85rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		box-shadow: 0 2px 8px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.15);
		opacity: 0;
		animation: pill-appear 0.3s ease forwards;
	}

	.smart-pill:hover {
		background: rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.1);
		transform: translateY(-2px);
	}

	.smart-pill:active {
		transform: scale(0.95);
	}

	@keyframes pill-appear {
		0% { opacity: 0; transform: translateY(8px); }
		100% { opacity: 1; transform: translateY(0); }
	}
</style>
