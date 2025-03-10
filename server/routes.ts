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
import { roleGuard } from './middleware/role-guard';
import axios from 'axios';

function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('Multer storing file:', {
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    console.log('Generating filename for:', file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    console.log('Filtering file:', {
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      console.log('File type accepted:', ext);
      cb(null, true);
    } else {
      console.log('File type rejected:', ext);
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

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

  // Admin-only user management routes
  app.get("/api/admin/users", ensureAuthenticated, roleGuard('admin'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id/role", ensureAuthenticated, roleGuard('admin'), async (req, res) => {
    try {
      const { role } = req.body;
      if (!['admin', 'editor', 'viewer'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updatedUser = await storage.updateUserRole(parseInt(req.params.id), role);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Document ingestion management routes
  app.post("/api/documents/:id/ingest", ensureAuthenticated, roleGuard('admin', 'editor'), async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Update document status to processing
      await storage.updateDocument(doc.id, { status: 'processing' });

      // Send document to Python backend for processing
      try {
        await axios.post('http://localhost:5001/process', {
          document_id: doc.id,
          content: doc.content,
          metadata: {
            title: doc.title,
            userId: doc.userId
          }
        });

        res.json({ message: "Document ingestion started", documentId: doc.id });
      } catch (error) {
        console.error("Error sending document to Python backend:", error);
        // Revert document status
        await storage.updateDocument(doc.id, { status: 'error' });
        throw new Error("Failed to start document processing");
      }
    } catch (error) {
      console.error("Error starting document ingestion:", error);
      res.status(500).json({ message: "Failed to start document ingestion" });
    }
  });

  // Callback endpoint for Python backend
  app.post("/api/documents/:id/callback", async (req, res) => {
    try {
      const { status, error } = req.body;
      const documentId = parseInt(req.params.id);

      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.updateDocument(documentId, { 
        status: status,
        ...(error && { errorMessage: error })
      });

      res.json({ message: "Status updated successfully" });
    } catch (error) {
      console.error("Error processing callback:", error);
      res.status(500).json({ message: "Failed to process callback" });
    }
  });

  // Get document processing status
  app.get("/api/documents/:id/status", ensureAuthenticated, async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Get detailed status from Python backend
      try {
        const response = await axios.get(`http://localhost:5001/status/${doc.id}`);
        res.json({ ...response.data, documentId: doc.id });
      } catch (error) {
        // Fallback to basic status if Python backend is unavailable
        res.json({ status: doc.status, documentId: doc.id });
      }
    } catch (error) {
      console.error("Error fetching document status:", error);
      res.status(500).json({ message: "Failed to fetch document status" });
    }
  });


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
    let uploadedFile = null;
    try {
      console.log('File upload request received:', {
        body: req.body,
        file: req.file ? {
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path
        } : null
      });

      if (!req.file) {
        console.error('No file uploaded in request');
        return res.status(400).json({ message: "No file uploaded" });
      }

      uploadedFile = req.file;
      const fileType = getFileType(req.file.originalname);
      console.log('Processing file type:', fileType);

      try {
        const parsedDoc = await parseDocument(req.file.path, fileType);
        console.log('Document parsed successfully:', {
          title: req.body.title || parsedDoc.metadata.title,
          contentLength: parsedDoc.content.length,
          metadata: parsedDoc.metadata
        });

        // Create document with parsed content
        const doc = await storage.createDocument({
          title: req.body.title || parsedDoc.metadata.title || path.basename(req.file.originalname),
          content: parsedDoc.content,
          userId: req.user!.id,
        });

        console.log('Document created in database:', {
          id: doc.id,
          title: doc.title
        });

        // Process document chunks for RAG
        const chunks = chunkText(doc.content);
        console.log(`Processing ${chunks.length} chunks for document ${doc.id}`);

        for (const [index, chunkContent] of chunks.entries()) {
          try {
            console.log(`Processing chunk ${index + 1}/${chunks.length}`);
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
            console.error(`Error processing chunk ${index + 1}:`, error);
          }
        }

        // Clean up uploaded file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error removing uploaded file:", err);
        });

        console.log('Upload process completed successfully');
        res.status(201).json(doc);
      } catch (parseError) {
        console.error('Error parsing document:', parseError);
        throw parseError;
      }
    } catch (error) {
      console.error("Error processing document upload:", error);

      // Clean up uploaded file if it exists
      if (uploadedFile) {
        fs.unlink(uploadedFile.path, (err) => {
          if (err) console.error("Error removing uploaded file:", err);
        });
      }

      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to process document"
      });
    }
  });

  // Add routes for document management
  app.delete("/api/documents/:id", ensureAuthenticated, async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (doc.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteDocument(parseInt(req.params.id));
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.patch("/api/documents/:id", ensureAuthenticated, async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (doc.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedDoc = await storage.updateDocument(parseInt(req.params.id), {
        title: req.body.title,
      });
      res.json(updatedDoc);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  // Q&A routes
  app.post("/api/qa", ensureAuthenticated, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      // Get user's documents
      const docs = await storage.getDocuments(req.user!.id);

      if (!docs.length) {
        return res.json({
          answer: "You haven't uploaded any documents yet. Please upload some documents first.",
          relevantDocs: []
        });
      }

      // Find relevant documents using RAG
      const relevantDocs = await findRelevantDocuments(query, docs);
      console.log("Found relevant documents:", relevantDocs.length);

      if (relevantDocs.length === 0) {
        return res.json({
          answer: "I couldn't find any relevant information in your documents. Try rephrasing your question or uploading more relevant documents.",
          relevantDocs: []
        });
      }

      // Prepare context with document metadata
      const context = relevantDocs
        .map(doc => `Document Title: ${doc.title}\nDocument Content:\n${doc.content}\n---\n`)
        .join('\n');

      try {
        const answer = await generateAnswer(query, context);
        res.json({ answer, relevantDocs });
      } catch (error) {
        console.error("Error generating answer:", error);
        res.json({
          answer: "I'm currently experiencing technical limitations. Please try again in a moment.",
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