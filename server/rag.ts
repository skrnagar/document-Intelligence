import { Document, DocumentChunk } from "@shared/schema";
import { storage } from "./storage";
import { generateEmbeddings } from "./openai";

export type Embedding = number[];

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (normA * normB);
}

function textSimilarity(query: string, content: string): number {
  // Enhanced text similarity for biographical information
  const queryWords = query.toLowerCase().split(/\s+/);
  const contentWords = content.toLowerCase().split(/\s+/);

  // Give higher weight to matches of full names or professional terms
  const professionalTerms = ['experience', 'skills', 'work', 'developer', 'engineer'];
  const nameMatches = queryWords.filter(word => 
    contentWords.some(contentWord => contentWord.includes(word) && word.length > 3)
  ).length;

  const termMatches = queryWords.filter(word =>
    professionalTerms.includes(word) && contentWords.includes(word)
  ).length;

  const querySet = new Set(queryWords);
  const contentSet = new Set(contentWords);

  const baseScore = (nameMatches * 2 + termMatches * 1.5) / queryWords.length;
  const contextScore = queryWords.filter(x => contentSet.has(x)).length / queryWords.length;

  return Math.min(1, (baseScore + contextScore) / 2);
}

export async function findRelevantDocuments(query: string, documents: Document[]): Promise<Document[]> {
  try {
    const queryEmbedding = await generateEmbeddings(query);
    const relevantChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

    for (const doc of documents) {
      const chunks = await storage.getDocumentChunks(doc.id);

      for (const chunk of chunks) {
        const embedding = chunk.embedding as number[];
        if (embedding) {
          const score = cosineSimilarity(queryEmbedding, embedding);
          relevantChunks.push({ chunk, score });
        } else {
          // Enhanced fallback scoring for biographical queries
          const score = textSimilarity(query, chunk.content);
          relevantChunks.push({ chunk, score });
        }
      }
    }

    relevantChunks.sort((a, b) => b.score - a.score);

    // Get unique documents from top chunks, considering chunk scores
    const topChunks = relevantChunks.slice(0, 5);
    const relevantDocIds = new Set(topChunks.map(({ chunk }) => chunk.documentId));

    // Return documents with high relevance scores
    return documents.filter(doc => relevantDocIds.has(doc.id));
  } catch (error) {
    console.error("Error in findRelevantDocuments:", error);

    // Improved fallback handling for biographical queries
    return documents
      .map(doc => ({
        doc,
        score: textSimilarity(query, doc.content)
      }))
      .filter(({ score }) => score > 0.2) // Lower threshold for biographical matches
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