import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// Simple .env.local parser
const envPath = path.resolve(process.cwd(), '.env.local');
let apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=(.*)/);
  if (match) {
    apiKey = match[1].trim();
  }
}

if (!apiKey) {
  console.error("Could not find GEMINI_API_KEY in .env.local or environment");
  process.exit(1);
}

console.log("Using API Key starting with:", apiKey.substring(0, 8) + "...");

const ai = new GoogleGenAI({ apiKey });

async function listModels() {
  try {
    console.log("Fetching available models...");
    // The new SDK structure is slightly different, usually iterating over models
    // But @google/genai 1.3.0 usually maps to the new v1beta API.
    // Let's try to see if we can list models.
    const response = await ai.models.list(); 
    
    // The response might be an async iterable or an object with models property
    for await (const model of response) {
      console.log(`- ${model.name} (${model.displayName})`);
      if (model.supportedMnGenerationMethods) {
         console.log(`  Methods: ${model.supportedMnGenerationMethods.join(', ')}`);
      }
    }
  } catch (error) {
    console.error("Error listing models:", error);
    if (error.response) {
       console.error("Response data:", JSON.stringify(error.response, null, 2));
    }
  }
}

listModels();
