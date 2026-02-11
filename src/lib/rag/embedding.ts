import { genAI } from '../gemini';

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await genAI.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: {
        outputDimensionality: 768, // Force 768 dimensions to match DB
      },
    });
    return result.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
