import { Client } from "@gradio/client";

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
		
		console.log(`Connecting to free Hugging Face model with prompt: "${prompt}"`);

		// Clean the base64 string and convert to Blob
		const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
		const buffer = Buffer.from(base64Data, 'base64');
		const imageBlob = new Blob([buffer], { type: 'image/jpeg' });

		// Connect to the free Gradio Space
		const client = await Client.connect("TejAndrewsACC/AI-Image-Editor");
		
		console.log("Connected to AI-Image-Editor! Sending prediction request...");
		
		const result = await client.predict("/lambda", { 
			img_path: imageBlob, 		
			pr: prompt, 
		});

		console.log("Prediction complete! Result:", result);

		let outputUrl = null;

		// Extract the URL from the result (Gradio usually returns an array in 'data')
		if (result && result.data && result.data.length > 0) {
			const outputData = result.data[0];
			
			// If it's a string URL
			if (typeof outputData === 'string') {
				outputUrl = outputData;
			} 
			// If it's a FileData object (Gradio v4)
			else if (typeof outputData === 'object' && outputData.url) {
				outputUrl = outputData.url;
			}
		}

		if (!outputUrl) {
			console.error("Could not parse output URL from result:", result);
			throw new Error("API succeeded but returned no image URL.");
		}

		console.log("Successfully generated the new image from Hugging Face Space!");

		return json({ 
			success: true, 
			resultImageBase64: outputUrl, // We return the URL hosted by HF Space
			message: "Image generated successfully!",
			promptUsed: prompt
		});

	} catch (error: any) {
		console.error('Error in Try-On API:', error);
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
