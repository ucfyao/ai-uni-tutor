import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: 'Reply with JSON: {"hello": "world"}',
    config: { responseMimeType: 'application/json' },
  });
  let all = '';
  for await (const chunk of res) {
    if (typeof chunk.text === 'string') {
      console.log('Chunk is string:', chunk.text);
      all += chunk.text;
    } else {
      console.log('Chunk text is NOT string:', typeof chunk.text);
    }
  }
  console.log('ALL TEXT:', JSON.stringify(all));
}
run().catch(console.error);
