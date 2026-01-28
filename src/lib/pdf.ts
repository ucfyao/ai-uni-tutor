import 'server-only';
import { createRequire } from 'module';

// Use require logic to avoid module resolution issues with pdf-parse
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse/lib/pdf-parse.js");

export interface PDFPage {
    text: string;
    page: number;
}

export async function parsePDF(buffer: Buffer): Promise<{ fullText: string; pages: PDFPage[] }> {
    const pages: PDFPage[] = [];

    // Custom render function to extract page text and numbers
    const render_page = (pageData: any) => {
        const render_options = {
            normalizeWhitespace: false,
            disableCombineTextItems: false
        };

        return pageData.getTextContent(render_options)
            .then(function (textContent: any) {
                let lastY, text = '';
                for (let item of textContent.items) {
                    // Sanitize text (remove null bytes)
                    const cleanStr = (item.str || "").replace(/\u0000/g, '');

                    if (lastY == item.transform[5] || !lastY) {
                        text += cleanStr;
                    }
                    else {
                        text += '\n' + cleanStr;
                    }
                    lastY = item.transform[5];
                }

                // Push to pages array
                // Assuming sequential processing by pdf-parse
                pages.push({
                    text,
                    page: pages.length + 1
                });

                return text;
            });
    }

    try {
        const data = await pdf(buffer, { pagerender: render_page });
        return {
            fullText: data.text,
            pages
        };
    } catch (e) {
        console.error('Error parsing PDF:', e);
        throw new Error('Failed to parse PDF content');
    }
}
