import Navbar from "@/components/navbar";
import DocumentList from "@/components/document-list";
import DocumentUpload from "@/components/document-upload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorBoundary } from "@/components/error-boundary";

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Document Management</h1>

        <Tabs defaultValue="list">
          <TabsList className="mb-4">
            <TabsTrigger value="list">My Documents</TabsTrigger>
            <TabsTrigger value="upload">Upload Document</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <ErrorBoundary>
              <DocumentList />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="upload">
            <div className="max-w-2xl">
              <ErrorBoundary>
                <DocumentUpload />
              </ErrorBoundary>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}