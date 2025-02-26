import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/">
            <Button variant="link" className="text-xl font-bold p-0">DocQA</Button>
          </Link>
          <div className="hidden md:flex space-x-4">
            <Link href="/documents">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">Documents</Button>
            </Link>
            <Link href="/qa">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">Q&A</Button>
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground">Admin</Button>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">
            Welcome, {user?.username} ({user?.role})
          </span>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}