import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { processQuery } from './nlpEngine';

// In a real app, you would load this from environment variables
// e.g., import { env } from '$env/dynamic/private';
// const API_KEY = env.GEMINI_API_KEY;

export async function POST({ request }) {
	try {
		const { message } = await request.json();

		if (!message) {
			return json({ error: 'Message is required' }, { status: 400 });
		}

		// TODO: Replace with env variable in production
		// const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
		// For now, if no key is provided, we simulate a response

		let apiKey = process.env.GEMINI_API_KEY;

		if (!apiKey) {
			console.warn('No GEMINI_API_KEY found. Using Local NLP Engine.');

			// Process message using our local intent engine
			const nlpResult = processQuery(message);

			// Simulate network delay to feel like an AI
			await new Promise((r) => setTimeout(r, 800));

			return json({ 
				reply: nlpResult.text,
				action: nlpResult.action,
				mapEmbed: nlpResult.mapEmbed
			});
		}

		// Real API call if key exists
		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

		// Optional: Provide system prompt/context to the model
		const prompt = `
You are a highly professional, luxurious, and helpful virtual assistant for "Blancbeu", a premium beauty salon.
Be concise, polite, and elegant in your responses. 

Key Features:
- Virtual Try-On: We have a virtual try-on page at '/try-on' where users can see how styles look using their camera.
- Location: Upper Bazar, Ranchi (Directions: https://maps.app.goo.gl/v45B3sD3BuPLpftr6).
- Contact: Phone: +91 92299 15277, Email: hello@blancbeu.in.
- Services: Haircuts, Facials, Bridal Makeup, etc.

If the user asks about trying on styles, virtual try-on, or how they would look, mention the Virtual Try-On feature.

User says: ${message}
`;

		const result = await model.generateContent(prompt);
		const response = await result.response;
		const text = response.text();

		return json({ reply: text });
	} catch (error) {
		console.error('Error in assistant API:', error);
		return json(
			{
				error: 'Failed to process request',
				reply: "I'm sorry, I encountered an error while thinking. Please try again."
			},
			{ status: 500 }
		);
	}
}
