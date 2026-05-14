import { services } from '$lib/data/services';

// 1. Utility: Levenshtein Distance for fuzzy spelling matching
function levenshteinDistance(a: string, b: string): number {
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

	for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
	for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1, // deletion
				matrix[i][j - 1] + 1, // insertion
				matrix[i - 1][j - 1] + cost // substitution
			);
		}
	}
	return matrix[a.length][b.length];
}

// 2. Hinglish & Slang Dictionary Mapping
const synonymMap: Record<string, string> = {
	// Hindi/Hinglish to standard tokens
	baal: 'hair',
	bal: 'hair',
	katwana: 'cut',
	kaat: 'cut',
	kaatna: 'cut',
	kitna: 'price',
	paisa: 'price',
	paise: 'price',
	rupee: 'price',
	price: 'price',
	rate: 'price',
	cost: 'price',
	kaha: 'location',
	kahan: 'location',
	kidhar: 'location',
	dukaan: 'shop',
	salon: 'shop',
	parlour: 'shop',
	bhaiya: 'assistant',
	time: 'hours',
	baje: 'hours',
	khula: 'open',
	band: 'close',
	book: 'book',
	karna: 'do',
	hai: 'is',
	shadi: 'bridal',
	shaadi: 'bridal',
	dulhan: 'bridal',
	makeup: 'makeup',
	chehra: 'facial',
	facial: 'facial',
	massage: 'massage',
	malish: 'massage',
	// English slang / typos
	houurs: 'hours',
	locatn: 'location',
	locatd: 'location',
	hw: 'how',
	mch: 'much',
	pls: 'please',
	plz: 'please',
	thx: 'thanks',
	ty: 'thanks'
};

// 3. Known Vocabulary for Spell Checking (Fuzzy Matching)
const knownVocabulary = new Set(Object.keys(synonymMap).concat(Object.values(synonymMap)));

// Add service names to known vocabulary dynamically
services.forEach((s) => {
	const sTokens = s.name
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.split(/\s+/);
	sTokens.forEach((t) => knownVocabulary.add(t));
});

// Basic stop words to ignore
const stopWords = new Set([
	'the',
	'a',
	'an',
	'is',
	'are',
	'was',
	'were',
	'to',
	'for',
	'of',
	'in',
	'on',
	'at',
	'i',
	'want',
	'need',
	'can',
	'you',
	'my',
	'me',
	'please',
	'pls',
	'hi',
	'hello',
	'hey',
	'do',
	'and',
	'with'
]);

function tokenizeAndNormalize(text: string): string[] {
	// Lowercase, remove non-alphanumeric (keep spaces)
	const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
	const tokens = cleanText.split(/\s+/).filter((t) => t.length > 0 && !stopWords.has(t));

	// Fuzzy matching & synonym mapping
	return tokens.map((token) => {
		// Direct map
		if (synonymMap[token]) return synonymMap[token];
		if (knownVocabulary.has(token)) return token;

		// Find closest match if distance <= 2
		let closestWord = token;
		let minDistance = 3; // Max threshold
		for (const vocabWord of knownVocabulary) {
			// Only compare if length diff is small to save CPU
			if (Math.abs(vocabWord.length - token.length) > 2) continue;

			const dist = levenshteinDistance(token, vocabWord);
			if (dist < minDistance) {
				minDistance = dist;
				closestWord = vocabWord;
			}
		}

		// If we found a fuzzy match, map it again in case it's a synonym key
		if (minDistance < 3) {
			return synonymMap[closestWord] || closestWord;
		}

		return token;
	});
}

// 4. Intent Definitions
interface Intent {
	id: string;
	keywords: string[];
	response: (tokens: string[], originalMessage: string) => string;
}

const intents: Intent[] = [
	{
		id: 'hours',
		keywords: ['hours', 'open', 'close', 'time', 'baje'],
		response: () => 'We are open every day, Monday to Sunday, from 10:00 AM to 8:00 PM.'
	},
	{
		id: 'location',
		keywords: ['location', 'address', 'where', 'shop', 'kaha', 'kahan', 'kidhar'],
		response: () => 'We are located at Upper Bazar, Ranchi, Jharkhand 834001, India. Come visit us!'
	},
	{
		id: 'contact',
		keywords: ['contact', 'call', 'phone', 'number'],
		response: () => 'You can reach us directly at +91 92299 15277 or email us anytime.'
	},
	{
		id: 'booking',
		keywords: ['book', 'appointment', 'schedule', 'reservation'],
		response: () =>
			"I can help with that! You can easily book an appointment by tapping the 'Book' tab at the bottom of your screen. What service were you thinking of?"
	},
	{
		id: 'bridal',
		keywords: ['bridal', 'wedding', 'marriage', 'shadi', 'shaadi', 'dulhan'],
		response: () =>
			'Yes, we specialize in luxury bridal makeup and styling! We recommend booking a consultation at least 3 months in advance.'
	},
	{
		id: 'cancellation',
		keywords: ['cancel', 'cancellation', 'policy'],
		response: () =>
			'We require a 24-hour notice for all cancellations. Cancellations made within 24 hours will incur a 50% fee.'
	},
	{
		id: 'service_pricing',
		// 'price', 'much', 'cost', 'kitna paisa' combined with any service keyword
		keywords: ['price', 'much', 'cost', 'how', 'charge', 'kitna', 'paisa'],
		response: (tokens, original) => {
			// Fuzzy match the service name from `services` list
			let bestService = null;
			let highestScore = 0;

			// Normalize service names to tokens
			for (const s of services) {
				const sTokens = tokenizeAndNormalize(s.name);
				let score = 0;
				// Count overlap
				for (const t of tokens) {
					if (sTokens.includes(t)) score++;
				}

				// Extra weight if they mentioned exact partial name
				if (original.toLowerCase().includes(s.name.toLowerCase())) score += 5;

				if (score > highestScore) {
					highestScore = score;
					bestService = s;
				}
			}

			if (bestService && highestScore >= 1) {
				return `Our ${bestService.name} service costs ₹${bestService.price}. The session typically takes about ${bestService.duration}.`;
			}

			return 'Our services start from ₹99 up to ₹9999. Could you specify which service you are looking for?';
		}
	},
	{
		id: 'general_services',
		keywords: ['services', 'hair', 'cut', 'facial', 'massage', 'makeup', 'baal', 'katwana'],
		response: () =>
			"We offer a wide range of premium services, including precision haircuts, relaxing facials, keratin treatments, and bridal styling. Tap 'Services' in the navigation menu to see our full list!"
	}
];

// 5. Main Intent Matcher
export function processQuery(message: string): string {
	const tokens = tokenizeAndNormalize(message);

	if (tokens.length === 0) {
		return "I'm here to help! What would you like to know about Blancbeu?";
	}

	let bestIntent: Intent | null = null;
	let highestScore = 0;

	for (const intent of intents) {
		let score = 0;
		for (const token of tokens) {
			if (intent.keywords.includes(token)) {
				score += 1;
			}
		}

		// Calculate confidence: score / number of tokens in message
		// But also factor in absolute score to reward more keyword matches
		const confidence = score / tokens.length + score * 0.2;

		if (confidence > highestScore) {
			highestScore = confidence;
			bestIntent = intent;
		}
	}

	// Threshold of 0.35
	if (bestIntent && highestScore > 0.35) {
		return bestIntent.response(tokens, message);
	}

	return "I'm not quite sure I understand. I can help you with bookings, prices, our location, or opening hours! What do you need help with?";
}
