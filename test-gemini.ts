import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';

config({ path: '.env.local' });
console.log(Object.keys(new GoogleGenAI({ apiKey: 'test' })));
