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
		
		const apiKey = env.FAL_KEY;

		if (!apiKey) {
			console.warn("FAL_KEY is not set. Returning a simulated response.");
			await new Promise(resolve => setTimeout(resolve, 3000));
			return json({ 
				success: true, 
				resultImageBase64: imageBase64,
				message: "Simulated response. Add FAL_KEY to .env to enable real AI image generation." 
			});
		}

		// Real Fal.ai API Implementation using InstructPix2Pix
		// This model is specifically fine-tuned to modify images based on a text instruction.
		// It expects the full data URI (e.g., data:image/jpeg;base64,...)
		
		let formattedBase64 = imageBase64;
		if (!imageBase64.includes('data:')) {
			// Fallback if the frontend strips the prefix
			formattedBase64 = `data:image/jpeg;base64,${imageBase64}`;
		}

		console.log(`Sending image to Fal.ai InstructPix2Pix with prompt: "${prompt}"`);

		const response = await fetch(`https://fal.run/fal-ai/instruct-pix2pix`, {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `Key ${apiKey}` 
			},
			body: JSON.stringify({
				image_url: formattedBase64,
				prompt: prompt,
				num_inference_steps: 30, // Good balance of quality and speed
				guidance_scale: 7.5,
				image_guidance_scale: 1.5 // Controls how much the original image is preserved
			})
		});

		if (!response.ok) {
			let errorMessage = "Failed to generate image from AI";
			try {
				const errorData = await response.json();
				errorMessage = errorData.detail || errorData.error || errorMessage;
				console.error("Fal.ai API Error:", errorData);
			} catch(e) {
				console.error("Fal.ai API Error Status:", response.status);
			}
			throw new Error(errorMessage);
		}

		const data = await response.json();
		
		// Fal.ai returns an array of generated images with their URLs
		const generatedImageResult = data.images?.[0];
		
		if (!generatedImageResult || !generatedImageResult.url) {
			throw new Error("API succeeded but returned no image data.");
		}

		console.log("Fal.ai successfully generated the new image!");

		return json({ 
			success: true, 
			resultImageBase64: generatedImageResult.url, // Usually Fal returns a temporary public URL or base64
			message: "Image generated successfully!",
			promptUsed: prompt
		});

	} catch (error: any) {
		console.error('Error in Try-On API:', error);
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
