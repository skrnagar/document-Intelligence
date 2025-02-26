import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";
import { storage } from "./storage";
import { DocumentChange, UserPresence } from "@shared/schema";

interface DocumentCursor {
  x: number;
  y: number;
  userId: number;
  username: string;
}

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Handle document collaboration rooms
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Join document collaboration room
    socket.on("join-document", async (data: { documentId: number, userId: number }) => {
      const { documentId, userId } = data;

      // Check if user has access to the document
      const doc = await storage.getDocument(documentId);
      if (!doc) {
        socket.emit("error", "Document not found");
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) {
        socket.emit("error", "User not found");
        return;
      }

      const collaboration = await storage.getDocumentCollaboration(documentId, userId);
      if (!collaboration) {
        socket.emit("error", "Not authorized to access this document");
        return;
      }

      socket.join(`document-${documentId}`);

      // Update user presence
      await storage.updateUserPresence({
        userId,
        documentId,
        lastActive: new Date(),
        cursor: null
      });

      // Notify others about new user
      socket.to(`document-${documentId}`).emit("user-joined", {
        userId,
        username: user.username,
      });
    });

    // Handle cursor movement
    socket.on("cursor-move", async (data: { documentId: number, cursor: DocumentCursor }) => {
      const { documentId, cursor } = data;
      socket.to(`document-${documentId}`).emit("cursor-update", cursor);

      // Update cursor position in database
      await storage.updateUserPresence({
        userId: cursor.userId,
        documentId,
        cursor,
        lastActive: new Date(),
      });
    });

    // Handle document changes
    socket.on("document-change", async (change: { documentId: number, userId: number, content: string, changeType: string, position?: any }) => {
      const { documentId } = change;

      // Save change to database
      const savedChange = await storage.createDocumentChange({
        documentId: change.documentId,
        userId: change.userId,
        changeType: change.changeType,
        content: change.content,
        position: change.position
      });

      // Broadcast change to other users
      socket.to(`document-${documentId}`).emit("document-updated", savedChange);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}