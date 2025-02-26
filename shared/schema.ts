import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enhanced user table with roles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer"), // 'admin', 'editor', or 'viewer'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Main document table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'error'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Document chunks for RAG
export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding"), // Vector embedding for the chunk
  metadata: jsonb("metadata"), // Additional metadata like position in document
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema for user insertion
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
}).extend({
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
});

// Schema for document insertion
export const insertDocumentSchema = createInsertSchema(documents).pick({
  title: true,
  content: true,
}).extend({
  title: z.string().min(1, "Title is required"),
});

// Schema for document chunk insertion
export const insertDocumentChunkSchema = createInsertSchema(documentChunks).pick({
  documentId: true,
  content: true,
  embedding: true,
  metadata: true,
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;