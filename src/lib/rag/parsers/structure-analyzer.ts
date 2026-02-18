import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import { RAG_CONFIG } from '../config';
import type { ContentType, DocumentStructure, SectionInfo } from './types';

const sectionSchema = z.object({
  title: z.string().min(1),
  startPage: z.number().int().positive(),
  endPage: z.number().int().positive(),
  contentType: z.enum(['definitions', 'theorems', 'examples', 'exercises', 'overview', 'mixed']),
  parentSection: z.string().optional(),
});

const structureSchema = z.object({
  subject: z.string().min(1),
  documentType: z.string().min(1),
  sections: z.array(sectionSchema).min(1),
});

function createFallbackStructure(pages: PDFPage[]): DocumentStructure {
  const pageCount = pages.length;
  const segmentSize = 10;
  const sections: SectionInfo[] = [];

  for (let i = 0; i < pageCount; i += segmentSize) {
    sections.push({
      title: `Section ${sections.length + 1}`,
      startPage: i + 1,
      endPage: Math.min(i + segmentSize, pageCount),
      contentType: 'mixed' as ContentType,
    });
  }

  return { subject: 'Unknown', documentType: 'unknown', sections };
}

export async function analyzeStructure(pages: PDFPage[]): Promise<DocumentStructure> {
  if (pages.length <= RAG_CONFIG.shortDocumentThreshold) {
    return {
      subject: 'Unknown',
      documentType: 'unknown',
      sections: [
        {
          title: 'Full Document',
          startPage: 1,
          endPage: pages.length,
          contentType: 'mixed',
        },
      ],
    };
  }

  const pageSummaries = pages.map((p) => {
    const trimmed = p.text.slice(0, RAG_CONFIG.structurePageSummaryLength);
    return `[Page ${p.page}]\n${trimmed}`;
  });

  const prompt = `You are a document structure analysis expert. Analyze the following academic document and identify its structure.

For each section, provide:
- title: The section/chapter heading
- startPage: First page number
- endPage: Last page number
- contentType: One of "definitions", "theorems", "examples", "exercises", "overview", "mixed"
  - "overview" = table of contents, introduction, references, administrative info
  - "definitions" = concept definitions, explanations
  - "theorems" = proofs, derivations, formulas
  - "examples" = worked examples, case studies
  - "exercises" = practice problems, homework
  - "mixed" = combination of the above

Also identify:
- subject: The academic discipline (e.g., "Computer Science", "Economics")
- documentType: The type of document (e.g., "lecture slides", "textbook chapter", "course notes")

Rules:
- If no clear chapter headings exist, segment by topic changes
- Mark table of contents, cover pages, and reference sections as "overview"
- Sections must cover all pages with no gaps

Return ONLY valid JSON. No markdown, no explanation.

Document pages (${pages.length} total):
${pageSummaries.join('\n\n')}`;

  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0 },
    });

    const text = response.text ?? '';
    const raw = JSON.parse(text);
    const result = structureSchema.safeParse(raw);

    if (!result.success) {
      console.warn('Structure analysis validation failed, using fallback:', result.error.message);
      return createFallbackStructure(pages);
    }
    return result.data;
  } catch (error) {
    console.warn('Structure analysis failed, using fallback segmentation:', error);
    return createFallbackStructure(pages);
  }
}
