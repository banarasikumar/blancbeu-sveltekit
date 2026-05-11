import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Helper function to generate the perfect prompt based on the service
function generatePrompt(serviceName) {
	// InstructPix2Pix uses direct conversational commands
	const lowerService = serviceName.toLowerCase();
	const isColor = lowerService.includes('color') || lowerService.includes('balayage') || lowerService.includes('highlights') || lowerService.includes('dye') || lowerService.includes('blonde') || lowerService.includes('brunette') || lowerService.includes('red');
	
	if (isColor) {
		return `make the hair ${serviceName} color`;
	} else {
		return `make the haircut a ${serviceName}`;
	}
}

export async function POST({ request }) {
	try {
		const { imageBase64, serviceName } = await request.json();

		if (!imageBase64 || !serviceName) {
			return json({ error: 'Missing image or service name' }, { status: 400 });
		}

		const prompt = generatePrompt(serviceName);
		
		const apiKey = env.HF_TOKEN;

		if (!apiKey) {
			console.warn("HF_TOKEN is not set. Returning a simulated response.");
			await new Promise(resolve => setTimeout(resolve, 3000));
			return json({ 
				success: true, 
				resultImageBase64: imageBase64,
				message: "Simulated response. Add HF_TOKEN to .env to enable real AI image generation." 
			});
		}

		// Real Hugging Face Free API Implementation using InstructPix2Pix
		
		let formattedBase64 = imageBase64;
		if (!imageBase64.includes('data:')) {
			formattedBase64 = `data:image/jpeg;base64,${imageBase64}`;
		}

		console.log(`Sending image to Hugging Face with prompt: "${prompt}"`);

		const response = await fetch(`https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix`, {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}` 
			},
			body: JSON.stringify({
				inputs: {
					image: formattedBase64,
					prompt: prompt
				},
				parameters: {
					num_inference_steps: 20, 
					guidance_scale: 7.5,
					image_guidance_scale: 1.5
				}
			})
		});

		if (!response.ok) {
			let errorMessage = "Failed to generate image from AI";
			try {
				const errorData = await response.json();
				errorMessage = errorData.error || errorMessage;
				console.error("Hugging Face API Error:", errorData);
				
				// Handle Model Loading Error
				if (errorData.estimated_time) {
					return json({ error: `The free AI model is currently waking up. Please try again in about ${Math.ceil(errorData.estimated_time)} seconds.` }, { status: 503 });
				}
			} catch(e) {
				console.error("Hugging Face API Error Status:", response.status);
			}
			throw new Error(errorMessage);
		}

		// Hugging Face returns the actual image blob directly for this endpoint
		const imageBlob = await response.blob();
		const arrayBuffer = await imageBlob.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const resultBase64 = `data:${imageBlob.type};base64,${buffer.toString('base64')}`;

		console.log("Hugging Face successfully generated the new image!");

		return json({ 
			success: true, 
			resultImageBase64: resultBase64,
			message: "Image generated successfully!",
			promptUsed: prompt
		});

	} catch (error: any) {
		console.error('Error in Try-On API:', error);
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
