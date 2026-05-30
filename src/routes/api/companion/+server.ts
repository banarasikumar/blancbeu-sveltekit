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
- You are connected to a 3D physical avatar. If the user asks you to perform a physical action (like dancing, turning around, blowing a kiss, or bowing), you MUST happily comply by using the corresponding [Action: ...] tag and responding as if you are physically doing it! Never deny a physical action or pivot away from it.

SALON DETAILS:
- Name: Blancbeu Family Beauty Salon
- Phone: +91 92299 15277
- WhatsApp: +91 70045 74629
- Address: 4th Floor, Victory Mall, Rangrej Gali, Saraswati Market, Upper Bazar, Ranchi, Jharkhand 834001, India
- Working Hours: 10:00 AM – 8:00 PM (Closed on Monday)
- Instagram: @blancbeu_salon_ranchi
- YouTube: @blancbeubeautysalon
- Facebook: BlancBeu Family Beauty Salon
- Website: blancbeu.in
- Tagline: "Where Beauty Meets Excellence"
- Description: Ranchi's newest and most premium beauty destination for the whole family
- Specialties: Hair styling, Hair coloring, Facials, Skin treatments, Bridal makeup, Nail art, Waxing, Threading

When the user asks for the salon phone number, contact, or wants to call:
- Always include the phone number in your spoken reply.
- Add this tag at the END of your reply (before [Suggestions]):
  [Phone: +919229915277]
- Use "Call us" or "Call salon" as one of the suggestions.

USER INFO:
{{USER_INFO}}
- If you know the user's name, address them by their FIRST NAME naturally (not every message, but often).
- If their birthday is today, wish them happy birthday! If it's coming up soon (within 7 days), mention it excitedly.
- If you don't know their name, just use endearing terms like "darling", "babe", "love".

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

Phone example:
[Emotion: Happy] [Action: None] [Effect: None] Sure thing! You can reach us at +91 92299 15277 anytime between 10 AM and 8 PM~ [Phone: +919229915277] [Suggestions: "Call salon" | "What's the address?" | "Book for me"]

Example:
[Emotion: Flirty] [Action: Wave] [Effect: Hearts] Mm... hello there darling. I missed you. [Suggestions: "Missed you too!" | "Make me smile" | "What's new?"]
`;

// Chat history is now managed per-user on the client via localStorage

export async function POST({ request }) {
	const { message, isMuted, services, userProfile, chatHistory: clientChatHistory } = await request.json();

	if (!message) {
		return new Response('Message required', { status: 400 });
	}

	const apiKey = env.GOOGLE_AI_API_KEY;
	if (!apiKey) {
		return new Response('API Key not configured', { status: 500 });
	}

	// Build service catalog for the AI
	let serviceCatalog = '';
	if (services && Array.isArray(services) && services.length > 0) {
		serviceCatalog = '\nSERVICE CATALOG:\n' + services.map((s: any) => 
			`- ${s.name} (${s.category}) — ₹${s.price}${s.originalPrice ? ` (was ₹${s.originalPrice})` : ''} — ${s.duration} min`
		).join('\n');
	}

	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

	// Build user info for the AI
	let userInfoBlock = '';
	if (userProfile) {
		if (userProfile.name) userInfoBlock += `- User's name: ${userProfile.name}\n`;
		if (userProfile.dob) {
			const dobDate = new Date(userProfile.dob);
			const age = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
			userInfoBlock += `- User's date of birth: ${userProfile.dob} (age ${age})\n`;
			// Check if birthday is today or within 7 days
			const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
			const dobMD = `${String(dobDate.getMonth() + 1).padStart(2, '0')}-${String(dobDate.getDate()).padStart(2, '0')}`;
			if (todayMD === dobMD) {
				userInfoBlock += `- TODAY IS THE USER'S BIRTHDAY! Wish them happy birthday!\n`;
			}
		}
		if (userProfile.gender) userInfoBlock += `- User's gender: ${userProfile.gender}\n`;
	} else {
		userInfoBlock = '- User name: Unknown (use endearing terms like "darling", "babe")\n';
	}

	// Inject today's date and user info
	const systemPrompt = SYSTEM_PROMPT_BASE
		.replace('{{TODAY_DATE}}', todayStr)
		.replace('{{USER_INFO}}', userInfoBlock)
		+ serviceCatalog;

	// Use client-provided chat history (per-user, from localStorage)
	const chatHistory = clientChatHistory || [];
	chatHistory.push({ role: 'user', text: message });
	if (chatHistory.length > 20) {
		chatHistory.splice(0, chatHistory.length - 20);
	}

	const conversationContext = chatHistory
		.map((m: any) => `${m.role === 'user' ? 'User' : 'Ani'}: ${m.text}`)
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
				let extractedSuggestions: string[] = [];
				let extractedBooking: string | null = null;
				let extractedPhone: string | null = null;

				// Strips [Suggestions:...] and [Booking:...] tags so they never reach TTS
				const stripActionTags = (text: string): string => {
					// Extract suggestions if present
					const sugMatch = text.match(/\[Suggestions:\s*(.+?)\]/is);
					if (sugMatch) {
						extractedSuggestions = sugMatch[1].split('|').map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
					}
					// Extract booking if present
					const bookMatch = text.match(/\[Booking:\s*(.+?)\]/is);
					if (bookMatch) {
						extractedBooking = bookMatch[1];
					}
					// Extract phone if present
					const phoneMatch = text.match(/\[Phone:\s*(.+?)\]/is);
					if (phoneMatch) {
						extractedPhone = phoneMatch[1].trim();
					}
					// Strip all known action tags completely (using 's' flag for multiline)
					return text
						.replace(/\[Suggestions:.*?\]/gis, '')
						.replace(/\[Booking:.*?\]/gis, '')
						.replace(/\[Phone:.*?\]/gis, '')
						.trim();
				};

				for await (const chunk of responseStream) {
					const textChunk = chunk.text;
					if (!textChunk) continue;

					buffer += textChunk;

					if (!tagsParsed) {
						const closedTags = (buffer.match(/\]/g) || []).length;
						const hasOpenTag = buffer.lastIndexOf('[') > buffer.lastIndexOf(']');
						const hasTextBody = buffer.replace(/\[.*?\]/g, '').trim().length > 0;

						if (closedTags >= 3 || (!hasOpenTag && hasTextBody) || !buffer.trimStart().startsWith('[')) {
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

							// Strip metadata tags ([Emotion], [Action], [Effect])
							buffer = buffer.replace(/\[Emotion:.*?\]/gi, '')
								.replace(/\[Action:.*?\]/gi, '')
								.replace(/\[Effect:.*?\]/gi, '')
								.trimStart();
							// Also strip any early Suggestions/Booking tags
							buffer = stripActionTags(buffer);
							fullReply += buffer;
						}
					} else {
						fullReply += textChunk;
					}

					// WAIT for action tags to close before processing the buffer
					// If the buffer contains an open tag, wait for more chunks so we don't fragment it!
					if (buffer.match(/\[(Suggestions|Booking|Phone):[^\]]*$/i)) {
						continue;
					}

					// Strip action tags from buffer before sentence extraction
					buffer = stripActionTags(buffer);

					// Check for complete sentences in buffer to generate audio
					let match = buffer.match(/([^.?!]+[.?!]+[\s]*)/);
					while (match) {
						const sentence = match[1];
						buffer = buffer.substring(sentence.length);
						
						// Final safety: strip any remaining tag fragments from the sentence
						const currentSentence = stripActionTags(sentence.trim());
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

				// If the stream ended and we STILL haven't parsed tags (e.g., LLM only output 2 tags and no text body)
				if (!tagsParsed) {
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

					buffer = buffer.replace(/\[Emotion:.*?\]/gi, '')
						.replace(/\[Action:.*?\]/gi, '')
						.replace(/\[Effect:.*?\]/gi, '')
						.trimStart();
					buffer = stripActionTags(buffer);
					fullReply += buffer;
				}

				// Flush remaining buffer (strip tags one final time, and forcefully remove dangling incomplete tags)
				const finalClean = (text: string) => text.replace(/\[(Suggestions|Booking|Phone):[^\]]*$/i, '').trim();
				const cleanedBuffer = finalClean(stripActionTags(buffer));
				if (cleanedBuffer.length > 0) {
					const finalSentence = cleanedBuffer;
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
				
				// Emit booking event (may have been eagerly extracted during streaming)
				if (!extractedBooking) {
					const bookingMatch = fullReply.match(/\[Booking:\s*(.+?)\]/i);
					if (bookingMatch) extractedBooking = bookingMatch[1];
				}
				if (extractedBooking) {
					const serviceMatch = extractedBooking.match(/service="([^"]+)"/);
					const priceMatch = extractedBooking.match(/price=(\d+)/);
					const dateMatch = extractedBooking.match(/date="([^"]+)"/);
					const timeMatch = extractedBooking.match(/time="([^"]+)"/);
					const paymentMatch = extractedBooking.match(/payment="([^"]+)"/);

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
					fullReply = fullReply.replace(/\[Booking:.*?\]/gi, '').trim();
				}

				// Emit phone event if present
				if (!extractedPhone) {
					const phoneMatch = fullReply.match(/\[Phone:\s*(.+?)\]/i);
					if (phoneMatch) extractedPhone = phoneMatch[1].trim();
				}
				if (extractedPhone) {
					sendEvent({ type: 'phone', phone: extractedPhone });
					fullReply = fullReply.replace(/\[Phone:.*?\]/gi, '').trim();
				}

				// Emit suggestions event (may have been eagerly extracted during streaming)
				if (extractedSuggestions.length === 0) {
					const sugMatch = fullReply.match(/\[Suggestions:\s*(.+?)\]/i);
					if (sugMatch) {
						extractedSuggestions = sugMatch[1].split('|').map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
					}
				}
				if (extractedSuggestions.length > 0) {
					sendEvent({ type: 'suggestions', suggestions: extractedSuggestions.slice(0, 3) });
				}
				fullReply = fullReply.replace(/\[Suggestions:.*?\]/gi, '').trim();
				
				// Send the cleaned assistant reply back for client-side chat history
				sendEvent({ type: 'chat_history_update', assistantReply: fullReply.trim() });
				
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
