import { genAI } from '../gemini';

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await genAI.models.embedContent({
      model: 'text-embedding-004',
      contents: [
        {
          parts: [{ text }],
        },
      ],
      config: {
        outputDimensionality: 768, // Force 768 dimensions to match DB
      },
    });
    // SDK returns embeddings array
    const embedding = result.embeddings?.[0];
    return embedding?.values || [];
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
