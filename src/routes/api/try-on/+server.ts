import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';

// Keywords that identify a service as a "color" service
const COLOR_KEYWORDS = [
	'color',
	'colour',
	'balayage',
	'highlights',
	'highlight',
	'dye',
	'blonde',
	'brunette',
	'red',
	'ombre',
	'sombre',
	'tint',
	'streak',
	'global hair'
];

function isColorService(name: string): boolean {
	const lower = name.toLowerCase();
	return COLOR_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Generates a professional "Premium Makeover" prompt from an array of services.
 * Combines haircut + color + shade into a single instruction.
 * Preserves original background with portrait-style bokeh for HD professional feel.
 */
function generatePrompt(services: { name: string; shade?: string }[]): string {
	const edits: string[] = [];

	for (const svc of services) {
		if (isColorService(svc.name)) {
			const shadeText = svc.shade ? ` in a beautiful ${svc.shade} shade` : '';
			edits.push(
				`apply a realistic ${svc.name}${shadeText} to the hair with natural-looking color distribution, subtle highlights, lowlights, and realistic hair texture and shine`
			);
		} else {
			edits.push(
				`transform the hairstyle into a high-quality ${svc.name} that blends perfectly and naturally with the face shape`
			);
		}
	}

	const editInstructions = edits.join('; and also ');

	return `Professional salon portrait edit. Using the uploaded photo as the fixed identity reference, apply the following changes: ${editInstructions}. IMPORTANT BACKGROUND RULE: Do NOT replace or change the background scene. Instead, keep the EXACT same background but apply a natural portrait-style bokeh blur effect to it, creating a professional DSLR shallow depth-of-field look. The background should be softly blurred while the person remains perfectly sharp and in focus, giving an HD professional portrait photography feel. This creates visual attention on the person and the hair transformation. CRITICAL CONSTRAINTS: Keep the original facial structure, proportions, eye color, skin tone, and exact pose completely untouched and identical to the original image. The person must remain perfectly recognizable. Maintain natural skin texture. The final image should look like a high-end salon portfolio photo with beautiful bokeh background blur.`;
}

export async function POST({ request }) {
	try {
		const body = await request.json();

		// Support both legacy single-service and new multi-service format
		let services: { name: string; shade?: string }[] = [];
		if (body.services && Array.isArray(body.services)) {
			services = body.services;
		} else if (body.serviceName) {
			services = [{ name: body.serviceName }];
		}

		const imageBase64 = body.imageBase64;

		if (!imageBase64 || services.length === 0) {
			return json({ error: 'Missing image or services' }, { status: 400 });
		}

		if (services.length > 3) {
			return json({ error: 'Maximum 3 services allowed at once' }, { status: 400 });
		}

		if (!env.GOOGLE_AI_API_KEY) {
			return json(
				{ error: 'Google AI API key is missing from environment variables.' },
				{ status: 500 }
			);
		}

		const prompt = generatePrompt(services);
		console.log(`[Try-On] Prompt: "${prompt}"`);
		console.log(`[Try-On] Services:`, JSON.stringify(services));

		const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

		const model = genAI.getGenerativeModel({
			model: 'gemini-3.1-flash-image-preview',
			generationConfig: {
				// @ts-ignore
				responseModalities: ['IMAGE']
			}
		});

		// Clean the base64 string
		const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

		const imagePart = {
			inlineData: {
				data: base64Data,
				mimeType: 'image/jpeg'
			}
		};

		const result = await model.generateContent([prompt, imagePart]);
		const response = await result.response;

		// Check for image data in the response
		const outputPart = response.candidates?.[0]?.content?.parts?.[0];
		let outputUrl = null;

		if (outputPart?.inlineData) {
			const mimeType = outputPart.inlineData.mimeType || 'image/jpeg';
			outputUrl = `data:${mimeType};base64,${outputPart.inlineData.data}`;
		} else if (outputPart?.text) {
			console.error('[Try-On] Model returned text instead of an image:', outputPart.text);
			throw new Error(
				'Model failed to return an edited image. It returned text description instead.'
			);
		}

		if (!outputUrl) {
			console.error(
				'[Try-On] Could not parse output image from result:',
				JSON.stringify(response.candidates?.[0])
			);
			throw new Error('API succeeded but returned no image data.');
		}

		console.log('[Try-On] Successfully generated image from Google AI Studio!');

		return json({
			success: true,
			resultImageBase64: outputUrl,
			message: 'Image generated successfully!',
			promptUsed: prompt
		});
	} catch (error: any) {
		console.error('[Try-On] Error:', error);
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
