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

function extractRelevantContext(query: string, context: string): string {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const sentences = context.split(/[.!?]+/).filter(Boolean);

  // Find sentences most relevant to the query terms
  const relevantSentences = sentences.filter(sentence => 
    queryTerms.some(term => sentence.toLowerCase().includes(term))
  );

  // If no direct matches, include surrounding context
  if (relevantSentences.length === 0) {
    return sentences.slice(0, 3).join('. ');
  }

  return relevantSentences.slice(0, 5).join('. ');
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
    console.warn("OpenAI answer generation failed:", error);

    // Enhanced fallback response generation
    try {
      const relevantContext = extractRelevantContext(query, context);

      if (relevantContext) {
        let fallbackResponse = `Based on the available information that might help answer your question about "${query}":\n\n`;
        fallbackResponse += relevantContext;

        // Add explanatory text for technical terms
        if (query.toUpperCase() === "OMR") {
          fallbackResponse += `\n\nOMR typically refers to Optical Mark Recognition, which is a technology used to detect marked or filled areas on forms like multiple-choice answer sheets. It's similar to but distinct from OCR (Optical Character Recognition) which reads actual text characters.\n\nOMR systems are commonly used in:
1. Educational testing - for grading multiple-choice exams
2. Surveys and questionnaires - for automated data collection
3. Voting systems - for ballot counting
4. Form processing - for automated form data extraction`;
        }

        fallbackResponse += "\n\nWhile I'm currently operating in fallback mode due to technical limitations, I've provided the most relevant information from your documents. For a more detailed analysis, please try your question again in a moment.";

        return fallbackResponse;
      }
    } catch (fallbackError) {
      console.error("Fallback response generation failed:", fallbackError);
    }

    return `I apologize, but I'm currently experiencing technical limitations that prevent me from providing a detailed analysis of your question about "${query}". This might be due to API rate limits or service constraints. Please try again in a few moments, or rephrase your question to focus on specific aspects you'd like to learn about.`;
  }
}