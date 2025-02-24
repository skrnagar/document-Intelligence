import { Document } from "@shared/schema";

export type Embedding = number[];

export function generateMockEmbeddings(text: string): Embedding {
  // Generate embeddings with semantic context
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = Array.from(new Set(words));

  // Create a 384-dimensional vector with word-based patterns
  return Array.from({ length: 384 }, (_, i) => {
    if (i < uniqueWords.length) {
      // Use word length and position to create meaningful patterns
      return (uniqueWords[i].length * Math.random() + i / uniqueWords.length) / 10;
    }
    return Math.random() * 0.1;
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (normA * normB);
}

// Improved text similarity as fallback when embeddings aren't available
function textSimilarity(query: string, content: string): number {
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const contentWords = new Set(content.toLowerCase().split(/\s+/));

  const intersection = new Set([...queryWords].filter(x => contentWords.has(x)));
  const union = new Set([...queryWords, ...contentWords]);

  return intersection.size / union.size;
}

export function findRelevantDocuments(query: string, documents: Document[]): Document[] {
  const queryEmbedding = generateMockEmbeddings(query);

  const docsWithScores = documents.map((doc) => {
    let score: number;

    if (doc.embeddings && Array.isArray(doc.embeddings) && doc.embeddings.length > 0) {
      // Use vector similarity if embeddings exist (take first embedding)
      score = cosineSimilarity(queryEmbedding, doc.embeddings[0]);
    } else {
      // Fallback to text similarity
      score = textSimilarity(query, doc.content);
    }

    return { doc, score };
  });

  // Sort by score and take top results
  const sortedDocs = docsWithScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Only return docs with reasonable similarity
  return sortedDocs
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

  return `Based on your documents, here's what I found:\n\n${context}\n\nThis information comes from ${relevantDocs.length} relevant document${relevantDocs.length > 1 ? 's' : ''}.\nFor more detailed information, please refer to the source documents shown below.`;
}