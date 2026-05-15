<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { Mic, Send, ChevronUp, ChevronDown, Bot } from 'lucide-svelte';

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
	let chatContainer: HTMLDivElement;
	let recognition: any = null;

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
		<div class="expander-wrapper">
			<button
				class="expand-btn"
				onclick={() => (tagsExpanded = !tagsExpanded)}
				aria-label="Toggle Tags"
			>
				{#if tagsExpanded}
					<ChevronDown size={20} />
				{:else}
					<ChevronUp size={20} />
				{/if}
			</button>
		</div>
		<!-- Predefined Tags -->
		{#if tagsExpanded}
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
				<input
					type="text"
					placeholder="Ask me anything..."
					bind:value={inputText}
					onkeydown={handleKeydown}
				/>
				{#if inputText.trim().length > 0}
					<button class="send-btn" onclick={() => sendMessage()}>
						<Send size={20} />
					</button>
				{/if}
			</div>

			<!-- Action Buttons Container -->
			<div class="action-buttons-col">
				<!-- Companion Assistant Button -->
				<button class="companion-btn" aria-label="Companion Assistant" onclick={() => goto('/assistant/companion')}>
					<Bot size={20} />
				</button>

				<!-- Prominent Mic Orb -->
				<button
					class="mic-orb"
					class:listening={isListening}
					onclick={toggleListen}
					aria-label="Use Microphone"
				>
					<Mic size={24} color={isListening ? '#fff' : 'var(--color-bg-primary)'} />
					{#if isListening}
						<div class="mic-ripple"></div>
						<div class="mic-ripple r2"></div>
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
	}

	.avatar-small img {
		width: 100%;
		height: 100%;
		object-fit: cover;
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
		background: rgba(212, 175, 55, 0.1);
		color: var(--color-text-primary, #000);
		border: 1px solid rgba(212, 175, 55, 0.2);
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
		border-top: 1px solid rgba(212, 175, 55, 0.2);
		border-bottom: 1px solid rgba(212, 175, 55, 0.2);
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
		box-shadow: 0 4px 10px rgba(212, 175, 55, 0.2);
	}

	.action-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 15px rgba(212, 175, 55, 0.3);
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

	.expander-wrapper {
		display: flex;
		justify-content: center;
		padding-bottom: 12px;
		margin-top: -4px;
	}

	.expand-btn {
		background: transparent;
		border: none;
		color: var(--color-text-tertiary, rgba(0, 0, 0, 0.3));
		width: 48px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.expand-btn:hover {
		color: var(--color-accent-gold, #d4af37);
	}

	.tags-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 16px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none; /* Firefox */
	}

	.tags-row {
		display: flex;
		flex-direction: row;
		gap: 8px;
		width: max-content;
	}

	.tags-container::-webkit-scrollbar {
		display: none; /* Safari and Chrome */
	}

	.tag-chip {
		flex-shrink: 0;
		background: var(--color-bg-secondary, rgba(0, 0, 0, 0.03));
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
		color: var(--color-text-primary, #333);
		padding: 6px 12px;
		border-radius: 16px;
		font-size: 0.75rem;
		white-space: normal;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tag-chip:hover {
		background: rgba(212, 175, 55, 0.1);
		border-color: rgba(212, 175, 55, 0.5);
		color: var(--color-accent-gold, #d4af37);
	}

	.input-container {
		display: flex;
		gap: 12px;
		align-items: flex-end;
	}

	.input-box {
		flex: 1;
		background: var(--color-bg-secondary, rgba(0, 0, 0, 0.03));
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
		border-radius: 24px;
		padding: 4px 16px;
		display: flex;
		align-items: center;
		height: 48px;
		margin-bottom: 3px;
	}

	.input-box input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--color-text-primary, #000);
		font-size: 0.95rem;
		outline: none;
	}

	.input-box input::placeholder {
		color: var(--color-text-tertiary, rgba(0, 0, 0, 0.4));
	}

	.send-btn {
		background: transparent;
		border: none;
		color: var(--color-accent-gold, #d4af37);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 4px;
	}

	.action-buttons-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.companion-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-bg-secondary, rgba(0, 0, 0, 0.03));
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
		color: var(--color-accent-gold, #d4af37);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}

	.companion-btn:hover {
		background: rgba(212, 175, 55, 0.1);
		border-color: rgba(212, 175, 55, 0.5);
	}

	.mic-orb {
		width: 54px;
		height: 54px;
		border-radius: 50%;
		background: var(--gradient-gold, linear-gradient(135deg, #d4af37, #aa842c));
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
		position: relative;
		transition: transform 0.2s;
	}

	.mic-orb:active {
		transform: scale(0.95);
	}

	.mic-orb.listening {
		background: #dc2626; /* Red for recording */
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
	}

	.mic-ripple {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 2px solid #dc2626;
		animation: ripple 1.5s infinite ease-out;
		pointer-events: none;
	}

	.mic-ripple.r2 {
		animation-delay: 0.75s;
	}

	@keyframes ripple {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(1.6);
			opacity: 0;
		}
	}
</style>
