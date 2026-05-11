import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Helper function to generate the perfect prompt based on the service
function generatePrompt(serviceName) {
	// Base instruction for all try-ons
	const baseInstruction = "Keep the person's face, skin tone, identity, eyes, and the background completely unchanged. Only modify the hair.";
	
	const lowerService = serviceName.toLowerCase();
	
	// Determine if it's a color or a cut/style based on keywords
	const isColor = lowerService.includes('color') || lowerService.includes('balayage') || lowerService.includes('highlights') || lowerService.includes('dye') || lowerService.includes('blonde') || lowerService.includes('brunette') || lowerService.includes('red');
	
	if (isColor) {
		return `Change the person's hair color to match a professional "${serviceName}" salon treatment. Make it look highly realistic, blending naturally with the hair texture. ${baseInstruction}`;
	} else {
		// It's likely a haircut or styling
		return `Change the person's hairstyle to a professional "${serviceName}". Ensure the new hair texture and styling look highly realistic and natural on this person. ${baseInstruction}`;
	}
}

export async function POST({ request }) {
	try {
		const { imageBase64, serviceName } = await request.json();

		if (!imageBase64 || !serviceName) {
			return json({ error: 'Missing image or service name' }, { status: 400 });
		}

		const prompt = generatePrompt(serviceName);
		
		const apiKey = env.GEMINI_API_KEY;

		if (!apiKey) {
			console.warn("GEMINI_API_KEY is not set. Returning a simulated response.");
			await new Promise(resolve => setTimeout(resolve, 3000));
			return json({ 
				success: true, 
				resultImageBase64: imageBase64,
				message: "Simulated response. Add GEMINI_API_KEY to .env to enable real AI generation." 
			});
		}

		// Real Gemini API Implementation using REST
		// We use the flash-latest model as requested, sending the image and prompt.
		// Note: Standard Gemini generateContent returns text. If you want image editing, 
		// you might need the Imagen endpoint. We'll pass it to Gemini and expect the response.
		
		const base64Data = imageBase64.split(',')[1] || imageBase64;
		const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';

		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{ text: prompt },
							{
								inlineData: {
									mimeType: mimeType,
									data: base64Data
								}
							}
						]
					}
				]
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error("Gemini API Error:", errorData);
			throw new Error(errorData.error?.message || "Failed to generate image from AI");
		}

		const data = await response.json();
		const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
		
		// Note: Since standard Gemini returns text descriptions rather than actual image bytes,
		// for a true visual try-on, you'd need the Imagen 3 API or Vertex AI Image Editing API.
		// We will simulate returning an image here by logging the Gemini text response and returning the original image.
		console.log("Gemini Response:", resultText);

		return json({ 
			success: true, 
			// In a real image-to-image API, you'd return the generated base64 here.
			// Since Gemini Flash returns text, we just pass the original image back for now.
			resultImageBase64: imageBase64, 
			message: "Gemini analyzed the image (Check console). For full image generation, the Imagen endpoint is required.",
			promptUsed: prompt
		});

	} catch (error) {
		console.error('Error in Try-On API:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
