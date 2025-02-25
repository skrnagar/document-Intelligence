import OpenAI from "openai";
import { Document } from "@shared/schema";
import { generateMockEmbeddings } from "./rag";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 384,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.warn("OpenAI embeddings failed, using fallback:", error);
    // Use our mock embeddings as fallback
    return generateMockEmbeddings(text);
  }
}

export async function generateAnswer(query: string, context: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an intelligent document analysis assistant. Your role is to:
1. Thoroughly analyze the provided document context
2. Generate comprehensive, well-reasoned answers based on the document content
3. Cite specific information from the documents when relevant
4. Maintain a natural, conversational tone while being precise and informative
5. If the context doesn't contain sufficient information, acknowledge this and suggest what additional details might be helpful

Remember to integrate information from multiple documents when available, and explain complex concepts in an accessible way.

If you find a query about OMR (Optical Mark Recognition) or similar technical terms, make sure to explain them in detail using the context provided.`,
        },
        {
          role: "user",
          content: `Please analyze the following document context and answer this question: "${query}"\n\nRelevant Document Context:\n${context}\n\nProvide a detailed, well-reasoned answer using the information from these documents.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    return response.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
  } catch (error) {
    console.warn("OpenAI answer generation failed, using fallback:", error);

    // Enhanced fallback response with better context extraction
    try {
      const sentences = context.split(/[.!?]+/).filter(Boolean);
      // Find sentences that might be relevant to the query
      const queryTerms = query.toLowerCase().split(/\s+/);
      const relevantSentences = sentences.filter(sentence => 
        queryTerms.some(term => sentence.toLowerCase().includes(term))
      );

      if (relevantSentences.length > 0) {
        const contextSummary = relevantSentences.slice(0, 3).join('. ');
        return `Based on the available information:\n\n${contextSummary}\n\nI found these relevant passages in your documents. While I couldn't perform a detailed analysis at this moment due to technical limitations, these excerpts might help answer your question. For a more comprehensive answer, please try again in a moment.`;
      }
    } catch (fallbackError) {
      console.error("Fallback response generation failed:", fallbackError);
    }

    return `I apologize, but I'm currently unable to provide a detailed analysis of your question about "${query}". The system is experiencing temporary limitations. Please try your question again in a moment, or rephrase it for better results.`;
  }
}