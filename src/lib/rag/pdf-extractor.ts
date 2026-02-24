import 'server-only';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import type { GoogleGenAI } from '@google/genai';
import { AppError } from '@/lib/errors';
import { GEMINI_MODELS, getDefaultPool } from '@/lib/gemini';

export interface ExtractFromPDFOptions {
  signal?: AbortSignal;
  /** Called at each sub-step so callers can relay progress to users. */
  onProgress?: (detail: string) => void;
}

/**
 * Upload a PDF to Gemini File API and extract structured data in a single call.
 *
 * Combines the old two-step flow (parsePDF → text → JSON) into one model call:
 *   PDF file → Gemini File API → fileData + prompt → JSON response
 *
 * @param buffer   Raw PDF bytes
 * @param prompt   Extraction prompt (must instruct the model to return JSON)
 * @param opts     Optional signal and progress callback
 * @returns        Parsed JSON of type T plus any warnings
 */
export async function extractFromPDF<T>(
  buffer: Buffer,
  prompt: string,
  opts?: AbortSignal | ExtractFromPDFOptions,
): Promise<{ result: T; warnings: string[] }> {
  // Backwards-compatible: accept AbortSignal directly or options object
  const signal = opts instanceof AbortSignal ? opts : opts?.signal;
  const onProgress = opts instanceof AbortSignal ? undefined : opts?.onProgress;
  const tmpDir = os.tmpdir();
  const fileName = `upload-${crypto.randomBytes(8).toString('hex')}.pdf`;
  const tempFilePath = path.join(tmpDir, fileName);

  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

  try {
    // 1. Write buffer to a temp file for Gemini File API upload
    onProgress?.(`Preparing PDF for upload (${sizeMB} MB)...`);
    await fs.writeFile(tempFilePath, buffer);

    // Wrap the entire upload → poll → generate → delete flow in a single
    // withRetry so all steps use the same key and only 2 Redis calls are made.
    return await getDefaultPool().withRetry(async (entry) => {
      const genAI = entry.client as GoogleGenAI;
      onProgress?.(`Using API key ${entry.maskedKey} (${entry.provider})`);

      // 2. Upload to Gemini File API
      onProgress?.(`Uploading PDF to AI service (${sizeMB} MB)...`);
      const uploadResult = await genAI.files.upload({
        file: tempFilePath,
        mimeType: 'application/pdf',
        displayName: fileName,
      } as any);
      onProgress?.(`PDF uploaded (${elapsed()}), waiting for AI to process...`);

      try {
        // 3. Poll until file is ACTIVE
        let fileState = await genAI.files.get({ name: uploadResult.name || '' });
        let retries = 0;
        while (fileState.state === 'PROCESSING' && retries < 30) {
          if (signal?.aborted) throw new Error('Aborted');
          retries++;
          onProgress?.(`AI processing file... (${retries * 2}s elapsed)`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          fileState = await genAI.files.get({ name: uploadResult.name || '' });
        }

        if (fileState.state !== 'ACTIVE') {
          throw new Error(`File processing failed or timed out. State: ${fileState.state}`);
        }
        onProgress?.(`File ready (${elapsed()}), starting AI analysis...`);

        // 4. Single generateContent call: fileData + extraction prompt → JSON
        onProgress?.(`AI analyzing document content (model: ${GEMINI_MODELS.parse})...`);
        const tGen = Date.now();
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

        const genSec = ((Date.now() - tGen) / 1000).toFixed(1);
        const textLen = text?.length ?? 0;
        onProgress?.(`AI response received (${genSec}s, ${textLen} chars), parsing...`);

        if (!text || !text.trim()) {
          return {
            result: [] as unknown as T,
            warnings: ['Gemini returned empty response'],
          } as { result: T; warnings: string[] };
        }

        // 5. Parse JSON
        let parsed: T;
        try {
          parsed = JSON.parse(text) as T;
        } catch {
          return {
            result: [] as unknown as T,
            warnings: [`Gemini returned invalid JSON (${textLen} chars)`],
          } as { result: T; warnings: string[] };
        }

        onProgress?.(`Extraction complete (total ${elapsed()})`);
        return { result: parsed, warnings: [] };
      } finally {
        // 6. Cleanup: delete file from Gemini
        try {
          await genAI.files.delete({ name: uploadResult.name || '' });
          onProgress?.('Remote file cleaned up');
        } catch (cleanupErr) {
          console.error('Failed to clean up file from Gemini API:', cleanupErr);
        }
      }
    });
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
