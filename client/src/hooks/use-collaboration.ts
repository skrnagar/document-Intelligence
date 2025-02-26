import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './use-auth';
import { DocumentChange, UserPresence } from '@shared/schema';

interface DocumentCursor {
  x: number;
  y: number;
  userId: number;
  username: string;
}

interface UseCollaborationProps {
  documentId: number;
  onDocumentChange?: (change: DocumentChange) => void;
}

export function useCollaboration({ documentId, onDocumentChange }: UseCollaborationProps) {
  const { user } = useAuth();
  const [activeUsers, setActiveUsers] = useState<{ userId: number; username: string }[]>([]);
  const [cursors, setCursors] = useState<DocumentCursor[]>([]);
  const socketRef = useRef<Socket>();

  useEffect(() => {
    if (!user || !documentId) return;

    // Connect to WebSocket server
    socketRef.current = io();

    // Join document room
    socketRef.current.emit('join-document', {
      documentId,
      userId: user.id
    });

    // Handle user joining
    socketRef.current.on('user-joined', (userData: { userId: number; username: string }) => {
      setActiveUsers(prev => [...prev, userData]);
    });

    // Handle cursor updates
    socketRef.current.on('cursor-update', (cursor: DocumentCursor) => {
      setCursors(prev => {
        const filtered = prev.filter(c => c.userId !== cursor.userId);
        return [...filtered, cursor];
      });
    });

    // Handle document updates
    socketRef.current.on('document-updated', (change: DocumentChange) => {
      if (onDocumentChange) {
        onDocumentChange(change);
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, documentId, onDocumentChange]);

  // Function to emit cursor movement
  const updateCursor = (x: number, y: number) => {
    if (!socketRef.current || !user) return;

    const cursor: DocumentCursor = {
      x,
      y,
      userId: user.id,
      username: user.username
    };

    socketRef.current.emit('cursor-move', {
      documentId,
      cursor
    });
  };

  // Function to emit document changes
  const emitChange = (change: Omit<DocumentChange, 'id' | 'userId' | 'documentId' | 'createdAt'>) => {
    if (!socketRef.current || !user) return;

    socketRef.current.emit('document-change', {
      ...change,
      userId: user.id,
      documentId
    });
  };

  return {
    activeUsers,
    cursors,
    updateCursor,
    emitChange
  };
}