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
			const reply = processQuery(message);

			// Simulate network delay to feel like an AI
			await new Promise((r) => setTimeout(r, 800));

			return json({ reply });
		}

		// Real API call if key exists
		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

		// Optional: Provide system prompt/context to the model
		const prompt = `
You are a highly professional, luxurious, and helpful virtual assistant for "Blancbeu", a premium beauty salon.
Be concise, polite, and elegant in your responses. 
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
