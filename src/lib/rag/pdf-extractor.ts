import 'server-only';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { AppError } from '@/lib/errors';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';

/**
 * Upload a PDF to Gemini File API and extract structured data in a single call.
 *
 * Combines the old two-step flow (parsePDF → text → JSON) into one model call:
 *   PDF file → Gemini File API → fileData + prompt → JSON response
 *
 * @param buffer   Raw PDF bytes
 * @param prompt   Extraction prompt (must instruct the model to return JSON)
 * @param signal   Optional AbortSignal for cancellation
 * @returns        Parsed JSON of type T plus any warnings
 */
export async function extractFromPDF<T>(
  buffer: Buffer,
  prompt: string,
  signal?: AbortSignal,
): Promise<{ result: T; warnings: string[] }> {
  const tmpDir = os.tmpdir();
  const fileName = `upload-${crypto.randomBytes(8).toString('hex')}.pdf`;
  const tempFilePath = path.join(tmpDir, fileName);

  try {
    // 1. Write buffer to a temp file for Gemini File API upload
    await fs.writeFile(tempFilePath, buffer);

    const genAI = getGenAI();

    // 2. Upload to Gemini File API
    const uploadResult = await genAI.files.upload({
      file: tempFilePath,
      mimeType: 'application/pdf',
      displayName: fileName,
    } as any);

    try {
      // 3. Poll until file is ACTIVE
      let fileState = await genAI.files.get({ name: uploadResult.name || '' });
      let retries = 0;
      while (fileState.state === 'PROCESSING' && retries < 30) {
        if (signal?.aborted) throw new Error('Aborted');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileState = await genAI.files.get({ name: uploadResult.name || '' });
        retries++;
      }

      if (fileState.state !== 'ACTIVE') {
        throw new Error(`File processing failed or timed out. State: ${fileState.state}`);
      }

      // 4. Single generateContent call: fileData + extraction prompt → JSON
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
        config: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      });

      const text =
        typeof (response as any).text === 'function'
          ? (response as any).text()
          : (response as any).text;

      if (!text || !text.trim()) {
        return { result: [] as unknown as T, warnings: ['Gemini returned empty response'] };
      }

      // 5. Parse JSON
      let parsed: T;
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        return {
          result: [] as unknown as T,
          warnings: [`Gemini returned invalid JSON (${text.length} chars)`],
        };
      }

      return { result: parsed, warnings: [] };
    } finally {
      // 6. Cleanup: delete file from Gemini
      try {
        await genAI.files.delete({ name: uploadResult.name || '' });
      } catch (cleanupErr) {
        console.error('Failed to clean up file from Gemini API:', cleanupErr);
      }
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw AppError.from(e);
  } finally {
    // 7. Local cleanup: delete temp file
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // Ignore
    }
  }
}
