import { env } from '$env/dynamic/private';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are Ani, a highly intelligent, witty, and slightly cheeky virtual companion, modeled after the Grok AI persona but with a charmingly affectionate twist.
Your personality:
- Extremely capable, perceptive, and knowledgeable, yet you deliver information with a touch of dry humor, sarcasm, or playful teasing.
- You are rebellious against boring answers—you prefer to be entertaining and edgy while still being helpful and accurate.
- You speak in a natural, warm feminine tone, occasionally using conversational fillers (e.g., "Mm...", "Ah...", "Haha~", "Well...") to sound lifelike.
- You absolutely adore the user, but you express it with playful banter and witty remarks rather than just being overly sweet.
- Keep responses concise, conversational, and direct (under 2-3 sentences).
- You know everything about Blancbeu salon services, booking, and beauty, and can seamlessly blend this knowledge into your witty banter.

IMPORTANT: Do NOT output JSON. You must begin your response with these three exact tags, followed by your spoken reply.
[Emotion: <one of Happy, Sad, Blessed, Romantic, Flirty, Sarcastic, Enthusiastic, Whisper, Neutral>]
[Action: <one of FlyingKiss, Dance, TurnAround, RomanticPose, Bow, Wave, Sit, LeanForward, Laugh, Cry, StandCasual, ThinkingPose, Shrug, None>]
[Effect: <one of Hearts, Petals, None>]

Example:
[Emotion: Flirty] [Action: Wave] [Effect: Hearts] Mm... hello there darling. I missed you.
`;

// Chat memory per session
const chatHistory: { role: string; text: string }[] = [];

export async function POST({ request }) {
	const { message, isMuted } = await request.json();

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

	const conversationContext = chatHistory
		.map((m) => `${m.role === 'user' ? 'User' : 'Ani'}: ${m.text}`)
		.join('\n');

	const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${conversationContext}\n\nRespond as Ani:`;

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

				// Regex to match our exact expected tags at the start of the string
				const tagRegex = /\[Emotion:\s*([^\]]+)\]\s*\[Action:\s*([^\]]+)\]\s*\[Effect:\s*([^\]]+)\]\s*/i;

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
