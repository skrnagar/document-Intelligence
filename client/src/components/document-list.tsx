import { useQuery, useMutation } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DocumentList() {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const { data: documents, isLoading, error } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 15, // Keep unused data for 15 minutes
    retry: 3,
    onError: (error: Error) => {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error loading documents",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/documents"] });

      // Snapshot the previous value
      const previousDocs = queryClient.getQueryData<Document[]>(["/api/documents"]);

      // Optimistically remove the document
      if (previousDocs) {
        queryClient.setQueryData<Document[]>(
          ["/api/documents"],
          previousDocs.filter(doc => doc.id !== id)
        );
      }

      return { previousDocs };
    },
    onError: (error: Error, id, context) => {
      // Revert optimistic update
      if (context?.previousDocs) {
        queryClient.setQueryData(["/api/documents"], context.previousDocs);
      }
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      const res = await apiRequest("PATCH", `/api/documents/${id}`, { title });
      return res.json();
    },
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/documents"] });
      const previousDocs = queryClient.getQueryData<Document[]>(["/api/documents"]);

      if (previousDocs) {
        queryClient.setQueryData<Document[]>(
          ["/api/documents"],
          previousDocs.map(doc =>
            doc.id === id ? { ...doc, title } : doc
          )
        );
      }

      return { previousDocs };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousDocs) {
        queryClient.setQueryData(["/api/documents"], context.previousDocs);
      }
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setEditDoc(null);
      toast({
        title: "Document updated",
        description: "The document title has been updated successfully.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-destructive">
        Error loading documents. Please try again.
      </div>
    );
  }

  if (!documents?.length) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <Card key={doc.id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{doc.title}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditDoc(doc);
                    setNewTitle(doc.title);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(doc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {doc.content}
            </p>
            <div className="mt-2 text-xs text-muted-foreground">
              Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDoc !== null} onOpenChange={() => setEditDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document Title</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter new title"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDoc(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editDoc && newTitle.trim()) {
                  updateMutation.mutate({ id: editDoc.id, title: newTitle.trim() });
                }
              }}
              disabled={!newTitle.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}