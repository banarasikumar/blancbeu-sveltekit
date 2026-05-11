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
		
		const apiKey = env.REPLICATE_API_TOKEN;

		if (!apiKey) {
			console.warn("REPLICATE_API_TOKEN is not set. Returning a simulated response.");
			await new Promise(resolve => setTimeout(resolve, 3000));
			return json({ 
				success: true, 
				resultImageBase64: imageBase64,
				message: "Simulated response. Add REPLICATE_API_TOKEN to .env to enable real AI image generation." 
			});
		}

		// Real Replicate API Implementation using InstructPix2Pix
		let formattedBase64 = imageBase64;
		if (!imageBase64.includes('data:')) {
			formattedBase64 = `data:image/jpeg;base64,${imageBase64}`;
		}

		console.log(`Sending image to Replicate with prompt: "${prompt}"`);

		// We use the "Prefer: wait" header so Replicate keeps the connection open
		// and returns the completed result, making it synchronous for our frontend!
		const response = await fetch(`https://api.replicate.com/v1/predictions`, {
			method: 'POST',
			headers: { 
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'Prefer': 'wait'
			},
			body: JSON.stringify({
				version: "30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f",
				input: {
					image: formattedBase64,
					prompt: prompt,
					num_inference_steps: 20,
					guidance_scale: 7.5,
					image_guidance_scale: 1.5
				}
			})
		});

		if (!response.ok) {
			let errorMessage = `Replicate API Error ${response.status}: ${response.statusText}`;
			try {
				const errorText = await response.text();
				console.error("Raw Replicate Error:", errorText);
				
				try {
					const errorData = JSON.parse(errorText);
					errorMessage = errorData.detail || errorData.error || errorMessage;
				} catch(e) {
					errorMessage = `${errorMessage} - ${errorText.substring(0, 100)}`;
				}
			} catch(e) {
				console.error("Could not read error response");
			}
			throw new Error(errorMessage);
		}

		const data = await response.json();
		
		// If Prefer: wait timed out (it waits up to 60s), status will be 'processing' or 'starting'
		if (data.status !== "succeeded") {
			throw new Error(`Replicate prediction failed or timed out. Status: ${data.status}`);
		}

		// Replicate returns an array of output URLs
		const outputUrl = data.output?.[0];

		if (!outputUrl) {
			throw new Error("API succeeded but returned no image URL.");
		}

		console.log("Replicate successfully generated the new image!");

		return json({ 
			success: true, 
			resultImageBase64: outputUrl, // Replicate hosts the result image for us
			message: "Image generated successfully!",
			promptUsed: prompt
		});

	} catch (error: any) {
		console.error('Error in Try-On API:', error);
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
