import 'server-only';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';

export interface PDFPage {
  text: string;
  page: number;
}

const PAGE_DELIMITER = '---PAGE_CONTENT_START---';

export async function parsePDF(buffer: Buffer): Promise<{ fullText: string; pages: PDFPage[] }> {
  const tmpDir = os.tmpdir();
  const fileName = `upload-${crypto.randomBytes(8).toString('hex')}.pdf`;
  const tempFilePath = path.join(tmpDir, fileName);

  try {
    // 1. Write the buffer to a temporary file
    await fs.writeFile(tempFilePath, buffer);

    const genAI = getGenAI();

    // 2. Upload the file to Gemini File API
    const uploadResult = await genAI.files.upload({
      file: tempFilePath,
      mimeType: 'application/pdf',
      displayName: fileName,
    } as any);

    try {
      // 3. Wait for the file to be processed (it must be ACTIVE to be used for generation)
      // Note: For most small PDFs this is fast, but we should poll.
      let fileState = await genAI.files.get({ name: uploadResult.name || '' });
      let retries = 0;
      while (fileState.state === 'PROCESSING' && retries < 30) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileState = await genAI.files.get({ name: uploadResult.name || '' });
        retries++;
      }

      if (fileState.state !== 'ACTIVE') {
        throw new Error(`File processing failed or timed out. State: ${fileState.state}`);
      }

      // 4. Generate content to extract text page by page
      const prompt = `You are a highly accurate document transcription assistant. 
Your task is to extract all text, tables, and significant textual content from this PDF Document, preserving the reading order and semantic meaning (using markdown to represent lists, headings, and tables).

CRITICAL INSTRUCTION: You MUST output the content strictly page by page. 
Before the content of EACH page, you MUST print exactly this delimiter on a new line: ${PAGE_DELIMITER}
For example:
${PAGE_DELIMITER}
Content of page 1...
${PAGE_DELIMITER}
Content of page 2...

Do not include any other conversational filler. Just the delimiters and the extracted markdown text.`;

      const response = await genAI.models.generateContent({
        model: GEMINI_MODELS.parse,
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: uploadResult.uri,
                  mimeType: uploadResult.mimeType || 'application/pdf',
                },
              },
              { text: prompt },
            ],
          },
        ],
      });

      const fullTextResponse =
        typeof (response as any).text === 'function'
          ? (response as any).text()
          : (response as any).text;

      // 5. Parse the output back into the expected pages format
      // Split by the delimiter, ignoring empty chunks at the start
      const rawPages = (fullTextResponse || '')
        .split(PAGE_DELIMITER)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);

      const pages: PDFPage[] = rawPages.map((text: string, i: number) => ({
        text,
        page: i + 1,
      }));

      return {
        fullText: pages.map((p: PDFPage) => p.text).join('\n\n'),
        pages,
      };
    } finally {
      // 6. Global Cleanup: Delete the file from Gemini
      try {
        await genAI.files.delete({ name: uploadResult.name || '' });
      } catch (cleanupErr) {
        console.error('Failed to clean up file from Gemini API:', cleanupErr);
      }
    }
  } catch (e) {
    console.error('Error parsing PDF with Gemini:', e);
    throw new Error('Failed to parse PDF content');
  } finally {
    // 7. Local Cleanup: Delete the temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // Ignore local cleanup errors (e.g., if file wasn't created)
    }
  }
}
