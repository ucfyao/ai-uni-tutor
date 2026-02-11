import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { RAG_CONFIG } from './config';

export async function chunkText(
  text: string,
  chunkSize: number = RAG_CONFIG.chunkSize,
  chunkOverlap: number = RAG_CONFIG.chunkOverlap,
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const output = await splitter.createDocuments([text]);
  return output.map((doc) => doc.pageContent);
}

export type PageContent = {
  text: string;
  page: number;
};

export type ChunkWithMetadata = {
  content: string;
  metadata: {
    page: number;
  };
};

export async function chunkPages(
  pages: PageContent[],
  chunkSize: number = RAG_CONFIG.chunkSize,
  chunkOverlap: number = RAG_CONFIG.chunkOverlap,
): Promise<ChunkWithMetadata[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const texts = pages.map((p) => p.text);
  const metadatas = pages.map((p) => ({ page: p.page }));

  const output = await splitter.createDocuments(texts, metadatas);

  return output.map((doc) => ({
    content: doc.pageContent,
    metadata: {
      page: doc.metadata.page,
    },
  }));
}
