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

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Document management routes
  app.get("/api/documents", ensureAuthenticated, async (req, res) => {
    try {
      const docs = await storage.getDocuments(req.user!.id);
      res.json(docs);
    } catch (error) {
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

      // Generate embeddings asynchronously
      try {
        const embeddings = await generateEmbeddings(doc.content);
        await storage.updateDocumentEmbeddings(doc.id, embeddings);
      } catch (error) {
        console.error("Failed to generate embeddings:", error);
        // Don't fail the request if embeddings generation fails
      }

      res.status(201).json(doc);
    } catch (error) {
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

      // Get user's documents
      const docs = await storage.getDocuments(req.user!.id);

      // Filter by selected documents if provided
      const availableDocs = documentIds 
        ? docs.filter(doc => documentIds.includes(doc.id))
        : docs;

      // Find relevant documents
      const relevantDocs = findRelevantDocuments(query, availableDocs);

      if (relevantDocs.length === 0) {
        return res.json({
          answer: "I couldn't find any relevant documents to answer your question. Try rephrasing or uploading more relevant content.",
          relevantDocs: []
        });
      }

      // Generate context from relevant documents
      const context = relevantDocs
        .map(doc => `Document: ${doc.title}\n${doc.content}`)
        .join('\n\n');

      // Generate answer using OpenAI
      const answer = await generateAnswer(query, context);

      res.json({ answer, relevantDocs });
    } catch (error) {
      res.status(500).json({ message: "Failed to process Q&A request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}