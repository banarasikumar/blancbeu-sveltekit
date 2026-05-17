import { env } from '$env/dynamic/private';
import { GoogleGenAI } from '@google/genai';

export async function POST({ request }) {
	try {
		const { audio, mimeType } = await request.json();

		if (!audio || !mimeType) {
			return new Response(JSON.stringify({ error: 'Audio data and mimeType are required' }), { status: 400 });
		}

		const apiKey = env.GOOGLE_AI_API_KEY;
		if (!apiKey) {
			return new Response(JSON.stringify({ error: 'API Key not configured' }), { status: 500 });
		}

		const ai = new GoogleGenAI({ apiKey });

		// Transcribe using gemini-2.5-flash which accepts audio natively
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [
				{
					role: 'user',
					parts: [
						{
							inlineData: {
								data: audio,
								mimeType: mimeType
							}
						},
						{
							text: 'Please transcribe the speech in this audio accurately and concisely. If there is no speech, return an empty string. Output only the transcription, nothing else.'
						}
					]
				}
			]
		});

		const transcription = response.text?.trim() || '';
		return new Response(JSON.stringify({ text: transcription }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: any) {
		console.error('[Transcribe API] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Transcription failed' }), { status: 500 });
	}
}
