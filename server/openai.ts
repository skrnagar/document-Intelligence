import OpenAI from "openai";
import { Document } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await retryWithExponentialBackoff(() => 
      openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 384,
      })
    );
    return response.data[0].embedding;
  } catch (error) {
    console.error("OpenAI embeddings failed after retries:", error);
    throw new Error("Failed to generate embeddings");
  }
}

export async function generateAnswer(query: string, context: string): Promise<string> {
  try {
    const response = await retryWithExponentialBackoff(() => 
      openai.chat.completions.create({
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

If you find a query about OMR (Optical Mark Recognition) or similar technical terms, make sure to explain them in detail using the context provided.

For queries about professional experience or background:
1. Focus on extracting and summarizing relevant skills and expertise
2. Highlight years of experience and key technologies when mentioned
3. Structure the response to clearly present professional background information
4. Suggest what additional details might be helpful if the information is incomplete

Additional guidelines for response formatting:
1. Start with a clear, direct answer to the question
2. Break down complex information into easily digestible parts
3. Use bullet points or numbered lists when appropriate
4. Include relevant examples or analogies to clarify concepts
5. End with a summary or key takeaway when appropriate
6. Always maintain factual accuracy based on the provided documents`,
          },
          {
            role: "user",
            content: `Please analyze the following document context and answer this question: "${query}"\n\nRelevant Document Context:\n${context}\n\nProvide a detailed, well-reasoned answer using the information from these documents.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      })
    );

    return response.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
  } catch (error) {
    console.error("OpenAI answer generation failed:", error);

    // Enhanced fallback response generation
    try {
      const relevantContext = extractRelevantContext(query, context);

      if (relevantContext) {
        let fallbackResponse = `Based on the available information that might help answer your question about "${query}":\n\n`;
        fallbackResponse += relevantContext;

        // Add explanatory text for technical terms if no relevant context is found
        if (query.toUpperCase() === "OMR" && !relevantContext.toLowerCase().includes("optical mark recognition")) {
          fallbackResponse += `\n\nOMR typically refers to Optical Mark Recognition, which is a technology used to detect marked or filled areas on forms like multiple-choice answer sheets. It's similar to but distinct from OCR (Optical Character Recognition) which reads actual text characters.\n\nOMR systems are commonly used in:
1. Educational testing - for grading multiple-choice exams
2. Surveys and questionnaires - for automated data collection
3. Voting systems - for ballot counting
4. Form processing - for automated form data extraction`;
        }

        // Add explanatory text for biographical queries
        if (query.toLowerCase().includes("experience") || query.toLowerCase().includes("background")) {
          const nameMatch = context.match(/([A-Z][a-z]+ )+[A-Z][a-z]+/);
          if (nameMatch) {
            fallbackResponse += `\n\nI found some information about professional experience in the documents. To get more detailed information about specific skills or work history, you might want to try searching for specific technologies or time periods.`;
          }
        }

        return fallbackResponse;
      }
    } catch (fallbackError) {
      console.error("Fallback response generation failed:", fallbackError);
    }

    return `I apologize, but I'm currently experiencing technical limitations that prevent me from providing a detailed analysis of your question about "${query}". This might be due to API rate limits or service constraints. Please try again in a few moments, or rephrase your question to focus on specific aspects you'd like to learn about.`;
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