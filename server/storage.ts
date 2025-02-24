import { User, InsertUser, Document, InsertDocument } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import type { Embedding } from "./rag";

const MemoryStore = createMemoryStore(session);

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  currentUserId: number;
  currentDocId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.currentUserId = 1;
    this.currentDocId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, isAdmin: false };
    this.users.set(id, user);
    return user;
  }

  async getDocuments(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId,
    );
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(doc: InsertDocument & { userId: number }): Promise<Document> {
    const id = this.currentDocId++;
    const document: Document = {
      ...doc,
      id,
      embeddings: null,
      createdAt: new Date().toISOString(),
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocumentEmbeddings(id: number, embeddings: Embedding[]): Promise<void> {
    const doc = await this.getDocument(id);
    if (doc) {
      doc.embeddings = embeddings;
      this.documents.set(id, doc);
    }
  }
}

export const storage = new MemStorage();
