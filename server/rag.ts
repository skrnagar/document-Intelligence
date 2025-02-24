import { Document } from "@shared/schema";

export type Embedding = number[];

// Simple mock embedding generation since we can't use real models
function generateMockEmbeddings(text: string): Embedding {
  return Array.from({ length: 384 }, () => Math.random());
}

// Simple cosine similarity for vector comparison
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (normA * normB);
}

export function generateEmbeddings(text: string): Embedding {
  return generateMockEmbeddings(text);
}

export function findRelevantDocuments(query: string, documents: Document[]): Document[] {
  const queryEmbedding = generateMockEmbeddings(query);
  return documents
    .filter((doc) => doc.embeddings)
    .sort((a, b) => {
      const simA = cosineSimilarity(queryEmbedding, a.embeddings as number[]);
      const simB = cosineSimilarity(queryEmbedding, b.embeddings as number[]);
      return simB - simA;
    })
    .slice(0, 3);
}

export function generateAnswer(query: string, relevantDocs: Document[]): string {
  // Mock answer generation
  const context = relevantDocs.map(doc => doc.content).join("\n");
  return `Here is a mock answer based on the query: "${query}" and the available context from ${relevantDocs.length} documents.`;
}
