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
		
		const apiKey = env.SEGMIND_KEY;

		if (!apiKey) {
			console.warn("SEGMIND_KEY is not set. Returning a simulated response.");
			await new Promise(resolve => setTimeout(resolve, 3000));
			return json({ 
				success: true, 
				resultImageBase64: imageBase64,
				message: "Simulated response. Add SEGMIND_KEY to .env to enable real AI image generation." 
			});
		}

		// Real Segmind API Implementation using InstructPix2Pix
		// Segmind provides 100 free reliable requests per day.
		
		let formattedBase64 = imageBase64;
		if (imageBase64.includes('base64,')) {
			// Segmind expects raw base64 string
			formattedBase64 = imageBase64.split('base64,')[1];
		}

		console.log(`Sending image to Segmind with prompt: "${prompt}"`);

		const response = await fetch(`https://api.segmind.com/v1/instruct-pix2pix`, {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'x-api-key': apiKey 
			},
			body: JSON.stringify({
				image: formattedBase64,
				prompt: prompt,
				num_inference_steps: 20, 
				guidance_scale: 7.5,
				image_guidance_scale: 1.5,
				base64: true // Tell Segmind to return the image as base64 instead of a URL
			})
		});

		if (!response.ok) {
			let errorMessage = `Segmind API Error ${response.status}: ${response.statusText}`;
			try {
				const errorText = await response.text();
				console.error("Raw Segmind Error:", errorText);
				
				try {
					const errorData = JSON.parse(errorText);
					errorMessage = errorData.error || errorData.message || errorMessage;
				} catch(e) {
					errorMessage = `${errorMessage} - ${errorText.substring(0, 100)}`;
				}
			} catch(e) {
				console.error("Could not read error response");
			}
			throw new Error(errorMessage);
		}

		let resultBase64 = null;
		
		// Depending on the 'base64: true' parameter, Segmind either returns a raw image blob or a JSON with base64/url
		const contentType = response.headers.get("content-type");
		if (contentType && contentType.includes("application/json")) {
			const data = await response.json();
			if (data.image) {
				resultBase64 = `data:image/jpeg;base64,${data.image}`;
			} else {
				throw new Error("Segmind API succeeded but returned no image data.");
			}
		} else {
			// It returned a blob
			const imageBlob = await response.blob();
			const arrayBuffer = await imageBlob.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			resultBase64 = `data:${imageBlob.type};base64,${buffer.toString('base64')}`;
		}

		console.log("Segmind successfully generated the new image!");

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
