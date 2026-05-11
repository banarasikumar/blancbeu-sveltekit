import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function list() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_AI_API_KEY}`);
        const data = await response.json();
        
        console.log("Available Models:");
        data.models.forEach(m => {
            console.log(`- Name: ${m.name}`);
            console.log(`  Supported Generation Methods: ${m.supportedGenerationMethods.join(', ')}`);
        });
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

list();
