import 'server-only';
import { getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { KnowledgePoint } from './types';

export async function parseLecture(pages: PDFPage[]): Promise<KnowledgePoint[]> {
  const genAI = getGenAI();
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  const prompt = `You are an expert academic content analyzer. Analyze the following lecture content and extract structured knowledge points.

For each knowledge point, extract:
- title: A clear, concise title for the concept
- definition: A comprehensive explanation/definition
- keyFormulas: Any relevant mathematical formulas (optional, omit if none)
- keyConcepts: Related key terms and concepts (optional, omit if none)
- examples: Concrete examples mentioned (optional, omit if none)
- sourcePages: Array of page numbers where this concept appears

Return ONLY a valid JSON array of knowledge points. No markdown, no explanation.

Lecture content:
${pagesText}`;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '';
  const parsed = JSON.parse(text) as KnowledgePoint[];
  return parsed;
}
