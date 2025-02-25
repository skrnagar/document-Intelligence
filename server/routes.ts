import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { generateEmbeddings, generateAnswer } from "./openai";
import { insertDocumentSchema } from "@shared/schema";
import { findRelevantDocuments } from "./rag";

function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Function to split text into chunks
function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Document management routes
  app.get("/api/documents", ensureAuthenticated, async (req, res) => {
    try {
      const docs = await storage.getDocuments(req.user!.id);
      res.json(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", ensureAuthenticated, async (req, res) => {
    try {
      const result = insertDocumentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json(result.error);
      }

      const doc = await storage.createDocument({
        ...result.data,
        userId: req.user!.id,
      });

      try {
        console.log("Processing document:", doc.id);
        const chunks = chunkText(doc.content);

        for (const [index, chunkContent] of chunks.entries()) {
          try {
            console.log(`Generating embeddings for chunk ${index + 1}/${chunks.length}`);
            const embedding = await generateEmbeddings(chunkContent);

            await storage.createDocumentChunk({
              documentId: doc.id,
              content: chunkContent,
              embedding,
              metadata: { position: index }
            });
          } catch (error) {
            console.error(`Failed to process chunk ${index + 1}:`, error);
          }
        }

        console.log("Document processing completed:", doc.id);
      } catch (error) {
        console.error("Failed to process document:", error);
      }

      res.status(201).json(doc);
    } catch (error) {
      console.error("Error creating document:", error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // Q&A routes
  app.post("/api/qa", ensureAuthenticated, async (req, res) => {
    try {
      const { query, documentIds } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      console.log("Processing Q&A request:", { query, documentIds });

      // Get user's documents
      const docs = await storage.getDocuments(req.user!.id);

      // Filter by selected documents if provided
      const availableDocs = documentIds && documentIds.length > 0
        ? docs.filter(doc => documentIds.includes(doc.id))
        : docs;

      if (!availableDocs.length) {
        return res.json({
          answer: "Please select some documents to search through.",
          relevantDocs: []
        });
      }

      // Find relevant documents using RAG
      const relevantDocs = await findRelevantDocuments(query, availableDocs);
      console.log("Found relevant documents:", relevantDocs.length);

      if (relevantDocs.length === 0) {
        return res.json({
          answer: "I couldn't find any relevant documents to answer your question. Try selecting different documents or rephrasing your question.",
          relevantDocs: []
        });
      }

      // Prepare context with document metadata for better context understanding
      const context = relevantDocs
        .map(doc => `Document Title: ${doc.title}\nDocument Content:\n${doc.content}\n---\n`)
        .join('\n');

      const answer = await generateAnswer(query, context);

      res.json({ answer, relevantDocs });
    } catch (error) {
      console.error("Error processing Q&A request:", error);
      res.status(500).json({ message: "Failed to process Q&A request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}