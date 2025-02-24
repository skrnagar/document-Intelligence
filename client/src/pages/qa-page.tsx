import Navbar from "@/components/navbar";
import QAInterface from "@/components/qa-interface";

export default function QAPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Question & Answer</h1>
        
        <div className="max-w-3xl">
          <QAInterface />
        </div>
      </main>
    </div>
  );
}
