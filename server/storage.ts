import { User, InsertUser, Document, InsertDocument } from "@shared/schema";
import session from "express-session";
import type { Embedding } from "./rag";
import { db } from "./db";
import { documents, users } from "@shared/schema";
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
  updateDocumentEmbeddings(id: number, embeddings: Embedding[]): Promise<void>;
  sessionStore: session.Store;
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
    const [document] = await db
      .insert(documents)
      .values({
        ...doc,
        embeddings: null,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return document;
  }

  async updateDocumentEmbeddings(id: number, embeddings: Embedding[]): Promise<void> {
    await db
      .update(documents)
      .set({ embeddings: JSON.stringify(embeddings) })
      .where(eq(documents.id, id));
  }
}

export const storage = new DatabaseStorage();