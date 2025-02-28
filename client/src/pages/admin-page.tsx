import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/error-boundary";

type Role = 'admin' | 'editor' | 'viewer';

function AdminPanel() {
  const { toast } = useToast();

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep unused data for 10 minutes
    retry: 2,
    onError: (error: Error) => {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: Role }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
      return res.json();
    },
    onMutate: async ({ userId, role }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/admin/users"] });

      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData<User[]>(["/api/admin/users"]);

      // Optimistically update the cache
      if (previousUsers) {
        queryClient.setQueryData<User[]>(["/api/admin/users"],
          previousUsers.map(user =>
            user.id === userId ? { ...user, role } : user
          )
        );
      }

      return { previousUsers };
    },
    onError: (error: Error, variables, context) => {
      // Revert the optimistic update
      if (context?.previousUsers) {
        queryClient.setQueryData(["/api/admin/users"], context.previousUsers);
      }
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role updated",
        description: "User role has been updated successfully.",
      });
    },
  });

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        Failed to load users. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {users?.map((user) => (
        <Card key={user.id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{user.username}</span>
              <Select
                defaultValue={user.role}
                onValueChange={(role: Role) =>
                  updateRoleMutation.mutate({ userId: user.id, role })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Current Role: {user.role}
            </p>
            <p className="text-xs text-muted-foreground">
              Joined: {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Wrap with error boundary for better error handling
export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">User Management</h1>
        <ErrorBoundary>
          <AdminPanel />
        </ErrorBoundary>
      </main>
    </div>
  );
}