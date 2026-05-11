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
		
		const apiKey = env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGNvbWluZy4uLiBiaXRjaA=='; // Fallback to free test key if not provided

		// Real DeepAI API Implementation
		let formattedBase64 = imageBase64;
		if (!imageBase64.includes('data:')) {
			formattedBase64 = `data:image/jpeg;base64,${imageBase64}`;
		}

		console.log(`Sending image to DeepAI with prompt: "${prompt}"`);

		// DeepAI expects multipart/form-data
		const formData = new FormData();
		formData.append('text', prompt);
		formData.append('image', formattedBase64);

		const response = await fetch(`https://api.deepai.org/api/image-editor`, {
			method: 'POST',
			headers: { 
				'api-key': apiKey 
			},
			body: formData
		});

		if (!response.ok) {
			let errorMessage = `DeepAI API Error ${response.status}: ${response.statusText}`;
			try {
				const errorText = await response.text();
				console.error("Raw DeepAI Error:", errorText);
				
				try {
					const errorData = JSON.parse(errorText);
					errorMessage = errorData.error || errorData.message || errorData.status || errorMessage;
				} catch(e) {
					errorMessage = `${errorMessage} - ${errorText.substring(0, 100)}`;
				}
			} catch(e) {
				console.error("Could not read error response");
			}
			throw new Error(errorMessage);
		}

		const data = await response.json();
		
		if (!data.output_url) {
			throw new Error("API succeeded but returned no image URL.");
		}

		console.log("DeepAI successfully generated the new image!");

		// Since DeepAI returns a URL, we can just pass that back directly as the source!
		return json({ 
			success: true, 
			resultImageBase64: data.output_url,
			message: "Image generated successfully!",
			promptUsed: prompt
		});

	} catch (error: any) {
		console.error('Error in Try-On API:', error);
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
