import { Document } from "@shared/schema";

export type Embedding = number[];

// Enhanced mock embedding generation with some semantic structure
function generateMockEmbeddings(text: string): Embedding {
  // Generate embeddings with some basic text-based patterns
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = [...new Set(words)];

  // Create a 384-dimensional vector with some word-based patterns
  return Array.from({ length: 384 }, (_, i) => {
    if (i < uniqueWords.length) {
      return (uniqueWords[i].length * Math.random()) / 10;
    }
    return Math.random() * 0.1;
  });
}

// Improved cosine similarity calculation
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
  const docsWithScores = documents
    .filter((doc) => doc.embeddings)
    .map((doc) => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.embeddings as number[])
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Only return docs with reasonable similarity
  return docsWithScores
    .filter(({ score }) => score > 0.1)
    .map(({ doc }) => doc);
}

export function generateAnswer(query: string, relevantDocs: Document[]): string {
  if (relevantDocs.length === 0) {
    return "I couldn't find any relevant information in your documents to answer this question. Please try rephrasing your question or upload more relevant documents.";
  }

  // Extract relevant context from documents
  const context = relevantDocs
    .map(doc => {
      const sentences = doc.content.split(/[.!?]+/).filter(Boolean);
      return sentences.slice(0, 3).join('. '); // Take first 3 sentences for context
    })
    .join('\n\n');

  // Generate a more structured mock answer
  return `Based on your documents, here's what I found:

${context}

This information comes from ${relevantDocs.length} relevant document${relevantDocs.length > 1 ? 's' : ''}.
For more detailed information, please refer to the source documents shown below.`;
}