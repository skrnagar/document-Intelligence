import { User, InsertUser, Document, InsertDocument, DocumentChunk, InsertDocumentChunk } from "@shared/schema";
import session from "express-session";
import type { Embedding } from "./rag";
import { db } from "./db";
import { documents, users, documentChunks } from "@shared/schema";
import { eq } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getDocuments(userId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument & { userId: number }): Promise<Document>;
  getDocumentChunks(documentId: number): Promise<DocumentChunk[]>;
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  sessionStore: session.Store;
  deleteDocument(id: number): Promise<void>;
  updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getDocuments(userId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.userId, userId));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(doc: InsertDocument & { userId: number }): Promise<Document> {
    try {
      const [document] = await db
        .insert(documents)
        .values({
          title: doc.title,
          content: doc.content,
          userId: doc.userId,
          status: 'pending'
        })
        .returning();
      return document;
    } catch (error) {
      console.error('Error creating document:', error);
      throw new Error('Failed to create document in database');
    }
  }

  async getDocumentChunks(documentId: number): Promise<DocumentChunk[]> {
    return db.select().from(documentChunks).where(eq(documentChunks.documentId, documentId));
  }

  async createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [documentChunk] = await db
      .insert(documentChunks)
      .values(chunk)
      .returning();
    return documentChunk;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document> {
    const [document] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return document;
  }
}

export const storage = new DatabaseStorage();