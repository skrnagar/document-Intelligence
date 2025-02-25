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
          content: `You are a helpful assistant that answers questions based on provided document context. Keep your answers concise and relevant to the query. 
                   Format your response in a clear, easy-to-read manner. If the context doesn't contain enough information to answer the question confidently, 
                   acknowledge this and suggest what additional information might be needed.`,
        },
        {
          role: "user",
          content: `Using the following document context, please answer this question: "${query}"\n\nContext:\n${context}`,
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
  } catch (error) {
    console.warn("OpenAI answer generation failed, using fallback:", error);
    // Provide a basic answer using the context
    const sentences = context.split(/[.!?]+/).filter(Boolean);
    const relevantSentences = sentences.slice(0, 3).join('. ');

    return `Based on the available information:\n\n${relevantSentences}\n\nFor more detailed or specific information, please try refining your question or refer to the complete documents.`;
  }
}