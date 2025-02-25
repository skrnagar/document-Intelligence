import { Document, DocumentChunk } from "@shared/schema";
import { storage } from "./storage";
import { generateEmbeddings } from "./openai";

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

function textSimilarity(query: string, content: string): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const contentWords = content.toLowerCase().split(/\s+/);

  const querySet = new Set(queryWords);
  const contentSet = new Set(contentWords);

  const intersection = queryWords.filter(x => contentSet.has(x)).length;
  const union = new Set([...queryWords, ...contentWords]).size;

  return intersection / union;
}

export async function findRelevantDocuments(query: string, documents: Document[]): Promise<Document[]> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbeddings(query);

    // Get all chunks for the provided documents
    const relevantChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

    for (const doc of documents) {
      const chunks = await storage.getDocumentChunks(doc.id);

      for (const chunk of chunks) {
        const embedding = chunk.embedding as number[];
        if (embedding) {
          const score = cosineSimilarity(queryEmbedding, embedding);
          relevantChunks.push({ chunk, score });
        } else {
          // Fallback to text similarity if embedding is not available
          const score = textSimilarity(query, chunk.content);
          relevantChunks.push({ chunk, score });
        }
      }
    }

    // Sort chunks by relevance score
    relevantChunks.sort((a, b) => b.score - a.score);

    // Get unique documents from top chunks
    const topChunks = relevantChunks.slice(0, 5);
    const relevantDocIds = new Set(topChunks.map(({ chunk }) => chunk.documentId));

    // Return full documents for the relevant chunks
    return documents.filter(doc => relevantDocIds.has(doc.id));
  } catch (error) {
    console.error("Error in findRelevantDocuments:", error);

    // Fallback to basic text similarity if embedding comparison fails
    return documents
      .map(doc => ({
        doc,
        score: textSimilarity(query, doc.content)
      }))
      .filter(({ score }) => score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ doc }) => doc);
  }
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