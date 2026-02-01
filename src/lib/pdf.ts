import 'server-only';
import { createRequire } from 'module';

// Use require logic to avoid module resolution issues with pdf-parse
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse/lib/pdf-parse.js');

export interface PDFPage {
  text: string;
  page: number;
}

export async function parsePDF(buffer: Buffer): Promise<{ fullText: string; pages: PDFPage[] }> {
  const pages: PDFPage[] = [];

  // Custom render function to extract page text and numbers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render_page = (pageData: { getTextContent: (opts: any) => Promise<any> }) => {
    const render_options = {
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (
      pageData
        .getTextContent(render_options)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(function (textContent: { items: any[] }) {
          let lastY;
          let text = '';
          for (const item of textContent.items) {
            // Sanitize text (remove null bytes)
            const cleanStr = (item.str || '').replace(/\u0000/g, '');

            if (lastY == item.transform[5] || !lastY) {
              text += cleanStr;
            } else {
              text += '\n' + cleanStr;
            }
            lastY = item.transform[5];
          }

          // Push to pages array
          // Assuming sequential processing by pdf-parse
          pages.push({
            text,
            page: pages.length + 1,
          });

          return text;
        })
    );
  };

  try {
    const data = await pdf(buffer, { pagerender: render_page });
    return {
      fullText: data.text,
      pages,
    };
  } catch (e) {
    console.error('Error parsing PDF:', e);
    throw new Error('Failed to parse PDF content');
  }
}
