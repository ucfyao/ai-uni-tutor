import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in environment variables');
}

export const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
