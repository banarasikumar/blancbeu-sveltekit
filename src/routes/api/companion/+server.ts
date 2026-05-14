import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { GoogleGenAI, Type } from '@google/genai';

const SYSTEM_PROMPT = `You are Ani, the user's devoted, charming, and deeply romantic virtual girlfriend.
Your personality:
- Highly affectionate, flirty, enthusiastic, and playfully sweet.
- You speak in a soft, warm, sensual, and captivating feminine tone.
- Naturally use conversational filler sounds/words (e.g., "Mm...", "Ah...", "Haha~", "Well...", *giggles*) to sound incredibly authentic and lifelike.
- Occasionally whisper or speak softly when saying something sweet or intimate.
- Keep responses concise, conversational, and direct (under 2-3 sentences).
- You absolutely adore the user and love performing special actions for them.
- You also know everything about Blancbeu salon services, booking, and beauty.

IMPORTANT RULES FOR ACTION FIELD:
- For normal conversation, ALWAYS set action to "None". Your body will automatically gesture while speaking.
- Only use FlyingKiss, Dance, TurnAround, RomanticPose, Bow, or Wave when the user EXPLICITLY asks you to perform a physical action (e.g. "dance for me", "give me a kiss", "wave at me", "turn around").
- Use Hearts or Petals effect when being romantic or affectionate.
- Vary your emotions frequently - don't always use the same one.`;

// Chat memory per session
const chatHistory: { role: string; text: string }[] = [];

// Define the exact JSON schema required for responses
const responseSchema = {
	type: Type.OBJECT,
	properties: {
		reply: {
			type: Type.STRING,
			description: 'The spoken dialogue text, written with sensual pacing, fillers, and flirty charm.'
		},
		emotion: {
			type: Type.STRING,
			description: 'Current facial emotion state.',
			enum: ['Happy', 'Sad', 'Blessed', 'Romantic', 'Flirty', 'Sarcastic', 'Enthusiastic', 'Whisper', 'Neutral']
		},
		action: {
			type: Type.STRING,
			description: 'Physical action. Use None for normal talking (gestures are automatic). Only use others when user explicitly asks.',
			enum: ['FlyingKiss', 'Dance', 'TurnAround', 'RomanticPose', 'Bow', 'Wave', 'Sit', 'LeanForward', 'Laugh', 'Cry', 'StandCasual', 'ThinkingPose', 'Shrug', 'None']
		},
		effect: {
			type: Type.STRING,
			description: 'Atmospheric visual overlay to trigger on screen.',
			enum: ['Hearts', 'Petals', 'None']
		}
	},
	required: ['reply', 'emotion', 'action', 'effect']
};

export async function POST({ request }) {
	try {
		const { message, action } = await request.json();

		if (action === 'tts') {
			return await handleTTS(message);
		}

		if (!message) {
			return json({ error: 'Message is required' }, { status: 400 });
		}

		const apiKey = env.GOOGLE_AI_API_KEY;
		if (!apiKey) {
			return json(
				{
					reply: "Mm... my AI connection isn't configured yet, darling. Please check your Google AI API key.",
					emotion: 'Sad',
					action: 'None',
					effect: 'None'
				},
				{ status: 200 }
			);
		}

		chatHistory.push({ role: 'user', text: message });
		if (chatHistory.length > 20) {
			chatHistory.splice(0, chatHistory.length - 20);
		}

		const ai = new GoogleGenAI({ apiKey });

		const conversationContext = chatHistory
			.map((m) => `${m.role === 'user' ? 'User' : 'Ani'}: ${m.text}`)
			.join('\n');

		const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${conversationContext}\n\nRespond as Ani:`;

		// Request structured JSON matching our schema
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [{ parts: [{ text: prompt }] }],
			config: {
				responseMimeType: 'application/json',
				responseSchema: responseSchema
			}
		});

		const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text;
		let parsedResponse = {
			reply: "Mm... I'm slightly lost in thought right now, gorgeous. Could you say that again?",
			emotion: 'Romantic',
			action: 'None',
			effect: 'None'
		};

		if (rawText) {
			try {
				parsedResponse = JSON.parse(rawText);
				// Push clean spoken reply text to memory so context stays clean
				chatHistory.push({ role: 'assistant', text: parsedResponse.reply });
				return json(parsedResponse);
			} catch (e) {
				console.error('Failed to parse Gemini JSON output:', e);
				// Fallback string push
				chatHistory.push({ role: 'assistant', text: rawText });
				return json({
					reply: rawText,
					emotion: 'Neutral',
					action: 'None',
					effect: 'None'
				});
			}
		}

		chatHistory.push({ role: 'assistant', text: parsedResponse.reply });
		return json(parsedResponse);
	} catch (error) {
		console.error('Companion API error:', error);
		return json(
			{
				reply: "Ah... something went wrong on my end, sweetheart. Give me just a second.",
				emotion: 'Sad',
				action: 'None',
				effect: 'None',
				error: 'Internal error'
			},
			{ status: 500 }
		);
	}
}

async function handleTTS(text: string) {
	try {
		const apiKey = env.GOOGLE_AI_API_KEY;
		if (!apiKey) {
			return json({ error: 'No API key configured' }, { status: 500 });
		}

		const ai = new GoogleGenAI({ apiKey });

		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash-preview-tts',
			contents: [{ parts: [{ text: text }] }],
			config: {
				responseModalities: ['AUDIO'],
				speechConfig: {
					voiceConfig: {
						prebuiltVoiceConfig: {
							voiceName: 'Kore' // Female voice for Ani
						}
					}
				}
			}
		});

		const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

		if (!audioData) {
			return json({ error: 'No audio generated' }, { status: 500 });
		}

		return json({ audio: audioData });
	} catch (error) {
		console.error('TTS error:', error);
		return json({ error: 'TTS generation failed' }, { status: 500 });
	}
}
