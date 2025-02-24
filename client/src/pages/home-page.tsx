import Navbar from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { FileText, Search } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Welcome to DocQA</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <Link href="/documents">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-6 w-6" />
                  <span>Document Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Upload and manage your documents. Our system will automatically
                  process them for Q&A capabilities.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/qa">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-6 w-6" />
                  <span>Question & Answer</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Ask questions about your documents and get intelligent answers
                  powered by our RAG system.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}