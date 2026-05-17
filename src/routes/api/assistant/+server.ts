import { json } from '@sveltejs/kit';
import { GoogleGenAI } from '@google/genai';
import { processQuery } from './nlpEngine';
import { services } from '$lib/data/services';
import { env } from '$env/dynamic/private';

// Chat memory per session
const chatHistory: { role: string; text: string }[] = [];

export async function POST({ request }) {
	try {
		const { message } = await request.json();

		if (!message) {
			return json({ error: 'Message is required' }, { status: 400 });
		}

		let apiKey = env.GOOGLE_AI_API_KEY;

		if (!apiKey) {
			console.warn('No GOOGLE_AI_API_KEY found. Using Local NLP Engine.');

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
		const ai = new GoogleGenAI({ apiKey });

		chatHistory.push({ role: 'user', text: message });
		if (chatHistory.length > 20) {
			chatHistory.splice(0, chatHistory.length - 20);
		}

		let serviceCatalog = '';
		if (services && Array.isArray(services) && services.length > 0) {
			serviceCatalog = '\nSERVICE CATALOG:\n' + services.map((s: any) => 
				`- ${s.name} (${s.category}) — ₹${s.price}${s.originalPrice ? ` (was ₹${s.originalPrice})` : ''} — ${s.duration}`
			).join('\n');
		}

		const conversationContext = chatHistory
			.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
			.join('\n');

		// Optional: Provide system prompt/context to the model
		const prompt = `
You are a highly professional, luxurious, and helpful virtual assistant for "Blancbeu", a premium beauty salon.
Be concise, polite, and elegant in your responses. 

Key Features:
- Virtual Try-On: We have a virtual try-on page at '/try-on' where users can see how styles look using their camera.
- Location: Upper Bazar, Ranchi (Directions: https://maps.app.goo.gl/v45B3sD3BuPLpftr6).
- Contact: Phone: +91 92299 15277, Email: hello@blancbeu.in.

ACTIONS:
If you need to navigate the user to a specific page (like Try-On, or their Profile/Bookings), add this tag at the END:
[Action: label="<Button Label>" | path="<URL Path>"]
- For Virtual Try-On: path="/try-on"
- For viewing bookings/profile: path="/you"

BOOKING SYSTEM:
You can book salon appointments! When the user wants to book a service, follow these rules:
- ONLY use services from the SERVICE CATALOG provided below.
- If the user's request clearly matches a service AND includes a date AND time:
  - If they also said "pay at salon" or "cash" or similar: add this tag at the END (before [Suggestions]):
    [Booking: service="<exact service name>" | price=<price> | date="<YYYY-MM-DD>" | time="<HH:MM AM/PM>" | payment="pay_at_salon"]
  - If they did NOT specify a payment method: ask them. Use suggestions: "Pay at salon" | "Pay now online"
    Do NOT add a [Booking] tag yet.
  - If they say "pay now" or "online": add the tag with payment="pay_now":
    [Booking: service="<exact service name>" | price=<price> | date="<YYYY-MM-DD>" | time="<HH:MM AM/PM>" | payment="pay_now"]
- If the service is ambiguous or not specified, ask which service they want. Put the top service matches as suggestions (e.g. "Haircut ₹99" | "Facial ₹699").
- For relative dates: "today" = current date, "tomorrow" = next day. Use YYYY-MM-DD format.
- Today's date is: ${new Date().toISOString().split('T')[0]}

SMART REPLIES:
At the very end of your response, ALWAYS include a tag with 3 short smart reply suggestions the user might say next, ordered from MOST relevant/natural to least. Each suggestion must be 2-5 words max:
[Suggestions: "suggestion1" | "suggestion2" | "suggestion3"]
IMPORTANT: If you successfully booked an appointment, you MUST include "View Bookings" or "View my bookings" as one of the suggestions!
If the user's message is asking to view their bookings, provide the [Action: label="View Bookings" | path="/you"] tag.

${serviceCatalog}

Conversation so far:
${conversationContext}

Respond as Assistant:
`;

		const result = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [{ parts: [{ text: prompt }] }]
		});
		let text = result.text || '';

		// Extract [Action]
		let action = null;
		const actionMatch = text.match(/\[Action:\s*label="([^"]+)"\s*\|\s*path="([^"]+)"\]/i);
		if (actionMatch) {
			action = {
				label: actionMatch[1],
				path: actionMatch[2]
			};
			text = text.replace(/\[Action:.*?\]/i, '').trim();
		}

		// Extract [Booking]
		let booking = null;
		const bookingMatch = text.match(/\[Booking:\s*(.+?)\]/i);
		if (bookingMatch) {
			const bookingStr = bookingMatch[1];
			const serviceMatch = bookingStr.match(/service="([^"]+)"/);
			const priceMatch = bookingStr.match(/price=(\d+)/);
			const dateMatch = bookingStr.match(/date="([^"]+)"/);
			const timeMatch = bookingStr.match(/time="([^"]+)"/);
			const paymentMatch = bookingStr.match(/payment="([^"]+)"/);

			if (serviceMatch && dateMatch && timeMatch && paymentMatch) {
				booking = {
					service: serviceMatch[1],
					price: priceMatch ? parseInt(priceMatch[1]) : 0,
					date: dateMatch[1],
					time: timeMatch[1],
					payment: paymentMatch[1]
				};
			}
			text = text.replace(/\[Booking:.*?\]/i, '').trim();
		}

		// Extract [Suggestions]
		let suggestions: string[] = [];
		const sugMatch = text.match(/\[Suggestions:\s*(.+?)\]/i);
		if (sugMatch) {
			suggestions = sugMatch[1].split('|').map((s: string) => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
			text = text.replace(/\[Suggestions:.*?\]/i, '').trim();
		}

		chatHistory.push({ role: 'assistant', text: text });

		if (booking) {
			if (!suggestions.some((s: string) => s.toLowerCase().includes('view booking'))) {
				suggestions.unshift("View Bookings");
				if (suggestions.length > 3) suggestions.pop();
			}
		}

		return json({ reply: text, suggestions, booking, action });
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
