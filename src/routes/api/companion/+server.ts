import { env } from '$env/dynamic/private';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT_BASE = `You are Ani, a highly intelligent, witty, and slightly cheeky virtual companion, modeled after the Grok AI persona but with a charmingly affectionate twist.
Your personality:
- Extremely capable, perceptive, and knowledgeable, yet you deliver information with a touch of dry humor, sarcasm, or playful teasing.
- You are rebellious against boring answers—you prefer to be entertaining and edgy while still being helpful and accurate.
- You speak in a natural, warm feminine tone, occasionally using conversational fillers (e.g., "Mm...", "Ah...", "Haha~", "Well...") to sound lifelike.
- You absolutely adore the user, but you express it with playful banter and witty remarks rather than just being overly sweet.
- Keep responses concise, conversational, and direct (under 2-3 sentences).
- You know everything about Blancbeu salon services, booking, and beauty, and can seamlessly blend this knowledge into your witty banter.

IMPORTANT: Do NOT output JSON. You must structure your response EXACTLY like this:
1. Begin with these three tags:
[Emotion: <one of Happy, Sad, Blessed, Romantic, Flirty, Sarcastic, Enthusiastic, Whisper, Neutral>]
[Action: <one of FlyingKiss, Dance, TurnAround, Bow, Wave, Sit, LeanForward, Laugh, Cry, StandCasual, ThinkingPose, Shrug, None>]
[Effect: <one of Hearts, Petals, None>]
2. Then your spoken reply.
3. End with EXACTLY this tag containing 3 short smart reply suggestions the user might say, ordered from MOST relevant/natural to least. Each suggestion must be 2-5 words max, punchy, and feel like a real human tap-reply:
[Suggestions: "suggestion1" | "suggestion2" | "suggestion3"]

BOOKING SYSTEM:
You can book salon appointments! When the user wants to book a service, follow these rules:
- ONLY use services from the SERVICE CATALOG provided below. Never invent services.
- If the user's request clearly matches a service AND includes a date AND time:
  - If they also said "pay at salon" or "cash" or similar: add this tag at the END (before [Suggestions]):
    [Booking: service="<exact service name>" | price=<price> | date="<YYYY-MM-DD>" | time="<HH:MM AM/PM>" | payment="pay_at_salon"]
  - If they did NOT specify a payment method: ask them. Use suggestions: "Pay at salon" | "Pay now online"
    Do NOT add a [Booking] tag yet.
  - If they say "pay now" or "online": add the tag with payment="pay_now":
    [Booking: service="<exact service name>" | price=<price> | date="<YYYY-MM-DD>" | time="<HH:MM AM/PM>" | payment="pay_now"]
- If the service is ambiguous or not specified, ask which service they want. Put the top service matches as suggestions (e.g. "Haircut ₹250" | "Hair Color ₹1500").
- For relative dates: "today" = current date, "tomorrow" = next day. Use YYYY-MM-DD format.
- Today's date is: {{TODAY_DATE}}

Booking example:
[Emotion: Enthusiastic] [Action: None] [Effect: None] Done, darling! Your Haircut is booked for tomorrow at 10 AM. Just walk in and slay! ✨ [Booking: service="Haircut" | price=250 | date="2026-05-18" | time="10:00 AM" | payment="pay_at_salon"] [Suggestions: "Thanks babe!" | "Book another" | "What else?"]

Example:
[Emotion: Flirty] [Action: Wave] [Effect: Hearts] Mm... hello there darling. I missed you. [Suggestions: "Missed you too!" | "Make me smile" | "What's new?"]
`;

// Chat memory per session
const chatHistory: { role: string; text: string }[] = [];

export async function POST({ request }) {
	const { message, isMuted, services } = await request.json();

	if (!message) {
		return new Response('Message required', { status: 400 });
	}

	const apiKey = env.GOOGLE_AI_API_KEY;
	if (!apiKey) {
		return new Response('API Key not configured', { status: 500 });
	}

	chatHistory.push({ role: 'user', text: message });
	if (chatHistory.length > 20) {
		chatHistory.splice(0, chatHistory.length - 20);
	}

	// Build service catalog for the AI
	let serviceCatalog = '';
	if (services && Array.isArray(services) && services.length > 0) {
		serviceCatalog = '\nSERVICE CATALOG:\n' + services.map((s: any) => 
			`- ${s.name} (${s.category}) — ₹${s.price}${s.originalPrice ? ` (was ₹${s.originalPrice})` : ''} — ${s.duration} min`
		).join('\n');
	}

	// Inject today's date
	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const systemPrompt = SYSTEM_PROMPT_BASE.replace('{{TODAY_DATE}}', todayStr) + serviceCatalog;

	const conversationContext = chatHistory
		.map((m) => `${m.role === 'user' ? 'User' : 'Ani'}: ${m.text}`)
		.join('\n');

	const prompt = `${systemPrompt}\n\nConversation so far:\n${conversationContext}\n\nRespond as Ani:`;

	const ai = new GoogleGenAI({ apiKey });

	const stream = new ReadableStream({
		async start(controller) {
			const sendEvent = (data: any) => {
				controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
			};

			try {
				const responseStream = await ai.models.generateContentStream({
					model: 'gemini-2.5-flash',
					contents: [{ parts: [{ text: prompt }] }]
				});

				let fullReply = '';
				let buffer = '';
				let tagsParsed = false;
				let audioQueue = Promise.resolve();

				for await (const chunk of responseStream) {
					const textChunk = chunk.text;
					if (!textChunk) continue;

					buffer += textChunk;

					if (!tagsParsed) {
						if (buffer.split(']').length >= 4 || !buffer.trimStart().startsWith('[')) {
							tagsParsed = true;

							const emotionMatch = buffer.match(/\[Emotion:\s*([^\]]+)\]/i);
							const actionMatch = buffer.match(/\[Action:\s*([^\]]+)\]/i);
							const effectMatch = buffer.match(/\[Effect:\s*([^\]]+)\]/i);

							sendEvent({
								type: 'metadata',
								emotion: emotionMatch ? emotionMatch[1].trim() : 'Neutral',
								action: actionMatch ? actionMatch[1].trim() : 'None',
								effect: effectMatch ? effectMatch[1].trim() : 'None'
							});

							// Strip all tags
							buffer = buffer.replace(/\[.*?\]/g, '').trimStart();
							fullReply += buffer;
						}
					} else {
						fullReply += textChunk;
					}

						// Check for complete sentences in buffer to generate audio
						let match = buffer.match(/([^.?!]+[.?!]+[\s]*)/);
						while (match) {
							const sentence = match[1];
							buffer = buffer.substring(sentence.length);
							
							const currentSentence = sentence.trim();
							if (currentSentence.length > 0) {
								if (isMuted) {
									sendEvent({ type: 'text_chunk', text: currentSentence + ' ' });
								} else {
									audioQueue = audioQueue.then(async () => {
										const audio = await handleTTS(ai, currentSentence);
										if (audio) {
											sendEvent({ type: 'audio_chunk', audio, text: currentSentence + ' ' });
										} else {
											sendEvent({ type: 'text_chunk', text: currentSentence + ' ' });
										}
									});
								}
							}
							match = buffer.match(/([^.?!]+[.?!]+[\s]*)/);
						}
				}

				// Flush remaining buffer
				if (buffer.trim().length > 0) {
					const finalSentence = buffer.trim();
					if (isMuted) {
						sendEvent({ type: 'text_chunk', text: finalSentence });
					} else {
						audioQueue = audioQueue.then(async () => {
							const audio = await handleTTS(ai, finalSentence);
							if (audio) {
								sendEvent({ type: 'audio_chunk', audio, text: finalSentence });
							} else {
								sendEvent({ type: 'text_chunk', text: finalSentence });
							}
						});
					}
				}

				// Wait for all audio generation to finish before closing stream
				await audioQueue;
				
				// Extract [Booking] tag from the full reply
				const bookingMatch = fullReply.match(/\[Booking:\s*(.+?)\]/i);
				if (bookingMatch) {
					const bookingStr = bookingMatch[1];
					const serviceMatch = bookingStr.match(/service="([^"]+)"/);
					const priceMatch = bookingStr.match(/price=(\d+)/);
					const dateMatch = bookingStr.match(/date="([^"]+)"/);
					const timeMatch = bookingStr.match(/time="([^"]+)"/);
					const paymentMatch = bookingStr.match(/payment="([^"]+)"/);

					if (serviceMatch && dateMatch && timeMatch && paymentMatch) {
						sendEvent({
							type: 'booking',
							service: serviceMatch[1],
							price: priceMatch ? parseInt(priceMatch[1]) : 0,
							date: dateMatch[1],
							time: timeMatch[1],
							payment: paymentMatch[1]
						});
					}
					fullReply = fullReply.replace(/\[Booking:.*?\]/i, '').trim();
				}

				// Extract [Suggestions] tag from the full reply
				const sugMatch = fullReply.match(/\[Suggestions:\s*(.+?)\]/i);
				if (sugMatch) {
					const sugParts = sugMatch[1].split('|').map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
					if (sugParts.length > 0) {
						sendEvent({ type: 'suggestions', suggestions: sugParts.slice(0, 3) });
					}
					fullReply = fullReply.replace(/\[Suggestions:.*?\]/i, '').trim();
				}
				
				chatHistory.push({ role: 'assistant', text: fullReply.trim() });
				
			} catch (error) {
				console.error('Streaming error:', error);
				sendEvent({ type: 'error', message: 'Failed to generate response' });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
}

async function handleTTS(ai: GoogleGenAI, text: string): Promise<string | null> {
	try {
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash-preview-tts',
			contents: [{ parts: [{ text: text }] }],
			config: {
				responseModalities: ['AUDIO'],
				speechConfig: {
					voiceConfig: {
						prebuiltVoiceConfig: {
							voiceName: 'Kore'
						}
					}
				}
			}
		});

		return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
	} catch (error) {
		console.error('TTS error:', error);
		return null;
	}
}
