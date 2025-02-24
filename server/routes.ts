import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { generateEmbeddings, findRelevantDocuments, generateAnswer } from "./rag";
import { insertDocumentSchema } from "@shared/schema";

function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).send("Unauthorized");
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Document management routes
  app.get("/api/documents", ensureAuthenticated, async (req, res) => {
    const docs = await storage.getDocuments(req.user!.id);
    res.json(docs);
  });

  app.post("/api/documents", ensureAuthenticated, async (req, res) => {
    const result = insertDocumentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    const doc = await storage.createDocument({
      ...result.data,
      userId: req.user!.id,
    });

    // Generate embeddings asynchronously
    const embeddings = generateEmbeddings(doc.content);
    await storage.updateDocumentEmbeddings(doc.id, embeddings);

    res.status(201).json(doc);
  });

  // Q&A routes
  app.post("/api/qa", ensureAuthenticated, async (req, res) => {
    const { query } = req.body;
    if (!query) {
      return res.status(400).send("Query is required");
    }

    const docs = await storage.getDocuments(req.user!.id);
    const relevantDocs = findRelevantDocuments(query, docs);
    const answer = generateAnswer(query, relevantDocs);

    res.json({ answer, relevantDocs });
  });

  const httpServer = createServer(app);
  return httpServer;
}
