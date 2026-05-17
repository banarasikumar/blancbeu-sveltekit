import { json } from '@sveltejs/kit';
import { GoogleGenAI } from '@google/genai';
import { services } from '$lib/data/services';
import { env } from '$env/dynamic/private';

export async function GET() {
	try {
		let apiKey = env.GOOGLE_AI_API_KEY;
		if (!apiKey) return json({ error: 'No API Key' }, { status: 500 });

		const ai = new GoogleGenAI({ apiKey });

		const prompt = `Hello`;

		const result = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [{ parts: [{ text: prompt }] }]
		});
		let text = result.text; // Try both .text and .text() to see which one works

		return json({ text, type: typeof result.text });
	} catch (error) {
		console.error('Error in test:', error);
		return json({ error: String(error) }, { status: 500 });
	}
}
