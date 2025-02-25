import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { parseDocument, getFileType } from './utils/document-parser';
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

// Helper function to add demo content
async function addDemoContent(userId: number) {
  // Technical documentation
  await storage.createDocument({
    title: "Machine Learning Fundamentals",
    content: `Machine Learning (ML) is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. Key concepts include:

1. Supervised Learning: Training with labeled data
2. Unsupervised Learning: Finding patterns in unlabeled data
3. Reinforcement Learning: Learning through trial and error

Common applications include Optical Character Recognition (OCR), Natural Language Processing (NLP), and Computer Vision. OCR technology converts typed, handwritten, or printed text into machine-encoded text, while OMR (Optical Mark Recognition) is used for processing multiple-choice forms and surveys.`,
    userId
  });

  // Professional experience
  await storage.createDocument({
    title: "Professional Profile",
    content: `Sarah Chen
Senior Software Engineer with 8+ years of experience in full-stack development. 

Technical Skills:
- Languages: Python, TypeScript, Go
- Frontend: React, Angular, Vue.js
- Backend: Node.js, Django, FastAPI
- Cloud: AWS, Google Cloud Platform
- DevOps: Docker, Kubernetes, CI/CD

Professional Experience:
2020-Present: Lead Engineer at TechCorp
- Led a team of 6 developers
- Implemented microservices architecture
- Reduced system latency by 40%

2018-2020: Senior Developer at DataFlow
- Developed real-time analytics platform
- Managed cloud infrastructure
- Mentored junior developers`,
    userId
  });

  // Product description
  await storage.createDocument({
    title: "Smart Home Security System",
    content: `The SecureHome Pro 2000 is our latest smart home security solution. 

Key Features:
1. AI-Powered Motion Detection
2. 4K HDR Cameras with Night Vision
3. Smart Door Locks with Biometric Authentication
4. Mobile App Integration

Technical Specifications:
- Camera Resolution: 3840 x 2160p
- Battery Life: 12 months
- Wireless Protocol: WiFi 6
- Storage: 1TB Local + Cloud Backup

The system uses advanced machine learning algorithms to distinguish between routine activity and potential security threats, reducing false alarms by 85%.`,
    userId
  });

  // Academic content
  await storage.createDocument({
    title: "Introduction to Quantum Computing",
    content: `Quantum computing represents a paradigm shift in computational capability. Unlike classical computers that use bits (0 or 1), quantum computers use quantum bits or qubits.

Key Concepts:
1. Superposition: Qubits can exist in multiple states simultaneously
2. Entanglement: Quantum correlation between qubits
3. Quantum Gates: Basic building blocks of quantum circuits

Applications:
- Cryptography
- Drug Discovery
- Financial Modeling
- Climate Simulation

Current challenges include maintaining qubit coherence and scaling quantum systems to practical sizes.`,
    userId
  });
}

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      callback(null, true);
    } else {
      callback(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
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

  // Update document creation endpoint to handle file uploads
  app.post("/api/documents", ensureAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Parse the uploaded document
      const fileType = getFileType(req.file.originalname);
      const parsedDoc = await parseDocument(req.file.path, fileType);

      // Create document with parsed content
      const doc = await storage.createDocument({
        title: req.body.title || parsedDoc.metadata.title || path.basename(req.file.originalname),
        content: parsedDoc.content,
        userId: req.user!.id,
      });

      // Process document chunks for RAG
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
              metadata: { 
                position: index,
                format: parsedDoc.metadata.format,
                pageCount: parsedDoc.metadata.pageCount
              }
            });
          } catch (error) {
            console.error(`Failed to process chunk ${index + 1}:`, error);
          }
        }

        // Cleanup uploaded file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error removing uploaded file:", err);
        });

        res.status(201).json(doc);
      } catch (error) {
        console.error("Failed to process document:", error);
        // Cleanup uploaded file on error
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error removing uploaded file:", err);
        });
        res.status(500).json({ message: "Failed to process document" });
      }
    } catch (error) {
      console.error("Error creating document:", error);
      // Cleanup uploaded file on error
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error removing uploaded file:", err);
        });
      }
      if (error.message.includes('Invalid file type')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create document" });
      }
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
      let relevantDocs;
      try {
        relevantDocs = await findRelevantDocuments(query, availableDocs);
        console.log("Found relevant documents:", relevantDocs.length);

        if (relevantDocs.length === 0) {
          return res.json({
            answer: "I couldn't find any relevant information in the selected documents. Try selecting different documents or rephrasing your question to be more specific.",
            relevantDocs: []
          });
        }
      } catch (error) {
        console.error("Error finding relevant documents:", error);
        // If embeddings fail, try direct text search
        relevantDocs = availableDocs.filter(doc =>
          doc.content.toLowerCase().includes(query.toLowerCase()) ||
          doc.title.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Prepare context with document metadata for better context understanding
      const context = relevantDocs
        .map(doc => `Document Title: ${doc.title}\nDocument Content:\n${doc.content}\n---\n`)
        .join('\n');

      try {
        const answer = await generateAnswer(query, context);
        res.json({ answer, relevantDocs });
      } catch (error) {
        console.error("Error generating answer:", error);
        res.json({
          answer: "I'm currently experiencing technical limitations. Please try again in a moment. In the meantime, you can try searching with different keywords or selecting different documents.",
          relevantDocs
        });
      }
    } catch (error) {
      console.error("Error processing Q&A request:", error);
      res.status(500).json({ message: "Failed to process Q&A request" });
    }
  });

  // Add a route to create demo content
  app.post("/api/demo-content", ensureAuthenticated, async (req, res) => {
    try {
      await addDemoContent(req.user!.id);
      res.json({ message: "Demo content created successfully" });
    } catch (error) {
      console.error("Error creating demo content:", error);
      res.status(500).json({ message: "Failed to create demo content" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}