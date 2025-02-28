import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Book, AlertCircle } from "lucide-react";
import { Document } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const querySchema = z.object({
  query: z.string().min(1, "Please enter a question"),
  documentIds: z.array(z.number()).optional(),
});

type QueryForm = z.infer<typeof querySchema>;

interface QAResponse {
  answer: string;
  relevantDocs: Document[];
  confidence?: number;
  processingTime?: number;
}

export default function QAInterface() {
  const { toast } = useToast();
  const [answer, setAnswer] = useState<QAResponse | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);

  const { data: documents, isLoading: isLoadingDocs, error: docsError } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    staleTime: 1000 * 60, // Cache for 1 minute
    gcTime: 1000 * 60 * 5, // Keep unused data for 5 minutes
    retry: 2,
    onError: (error: Error) => {
      toast({
        title: "Error loading documents",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<QueryForm>({
    resolver: zodResolver(querySchema),
    defaultValues: {
      query: "",
      documentIds: [],
    },
  });

  const askMutation = useMutation({
    mutationFn: async (data: QueryForm & { documentIds: number[] }) => {
      const res = await apiRequest("POST", "/api/qa", data);
      return res.json();
    },
    onMutate: () => {
      // Clear previous answer while loading
      setAnswer(null);
    },
    onSuccess: (data: QAResponse) => {
      setAnswer(data);
      form.reset({ query: "" });

      if (data.confidence && data.confidence < 0.7) {
        toast({
          title: "Low Confidence Answer",
          description: "The AI is not very confident about this answer. Consider rephrasing your question or selecting different documents.",
          variant: "warning",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error generating answer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: QueryForm) => {
    if (selectedDocs.length === 0) {
      form.setError("query", { message: "Please select at least one document to search through" });
      return;
    }
    askMutation.mutate({
      ...data,
      documentIds: selectedDocs,
    });
  };

  if (isLoadingDocs) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (docsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Documents</AlertTitle>
        <AlertDescription>
          Failed to load documents. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  if (!documents?.length) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Documents Found</AlertTitle>
        <AlertDescription>
          Upload some documents in the Documents section before using the Q&A feature.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Select Documents to Search</CardTitle>
          <CardDescription>
            Choose which documents to search through for answers to your questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`doc-${doc.id}`}
                  checked={selectedDocs.includes(doc.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedDocs([...selectedDocs, doc.id]);
                    } else {
                      setSelectedDocs(selectedDocs.filter(id => id !== doc.id));
                    }
                  }}
                />
                <div className="flex-1">
                  <label
                    htmlFor={`doc-${doc.id}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {doc.title}
                  </label>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {doc.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ask a Question</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    placeholder="What would you like to know about your documents?" 
                    className="min-h-[100px] resize-y"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            disabled={askMutation.isPending || selectedDocs.length === 0}
            className="w-full md:w-auto"
          >
            {askMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Documents...
              </>
            ) : (
              "Ask Question"
            )}
          </Button>
        </form>
      </Form>

      {answer && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Answer</CardTitle>
              {answer.processingTime && (
                <CardDescription>
                  Generated in {(answer.processingTime / 1000).toFixed(2)} seconds
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
            </CardContent>
          </Card>

          {answer.relevantDocs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  Source Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {answer.relevantDocs.map((doc) => (
                    <Card key={doc.id} className="bg-muted/50">
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-2">{doc.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {doc.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created: {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}