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

// Document collaboration table
export const documentCollaborations = pgTable("document_collaborations", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  userId: integer("user_id").notNull(),
  accessLevel: text("access_level").notNull().default("viewer"), // 'owner', 'editor', 'viewer'
  lastAccessed: timestamp("last_accessed").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Document changes for version control
export const documentChanges = pgTable("document_changes", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  userId: integer("user_id").notNull(),
  changeType: text("change_type").notNull(), // 'edit', 'comment', 'annotation'
  content: text("content").notNull(),
  position: jsonb("position"), // For annotations/comments
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User presence tracking
export const userPresence = pgTable("user_presence", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  documentId: integer("document_id").notNull(),
  lastActive: timestamp("last_active").notNull().defaultNow(),
  cursor: jsonb("cursor"), // Store cursor position for collaborative editing
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

// Schema for collaboration insertion
export const insertDocumentCollaborationSchema = createInsertSchema(documentCollaborations).pick({
  documentId: true,
  userId: true,
  accessLevel: true,
});

// Schema for document changes
export const insertDocumentChangeSchema = createInsertSchema(documentChanges).pick({
  documentId: true,
  userId: true,
  changeType: true,
  content: true,
  position: true,
});

// Schema for user presence
export const insertUserPresenceSchema = createInsertSchema(userPresence).pick({
  userId: true,
  documentId: true,
  cursor: true,
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type DocumentCollaboration = typeof documentCollaborations.$inferSelect;
export type InsertDocumentCollaboration = z.infer<typeof insertDocumentCollaborationSchema>;
export type DocumentChange = typeof documentChanges.$inferSelect;
export type InsertDocumentChange = z.infer<typeof insertDocumentChangeSchema>;
export type UserPresence = typeof userPresence.$inferSelect;
export type InsertUserPresence = z.infer<typeof insertUserPresenceSchema>;