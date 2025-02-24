import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Book } from "lucide-react";
import { Document } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

const querySchema = z.object({
  query: z.string().min(1, "Please enter a question"),
  documentIds: z.array(z.number()).optional(),
});

type QueryForm = z.infer<typeof querySchema>;

interface QAResponse {
  answer: string;
  relevantDocs: Document[];
}

export default function QAInterface() {
  const [answer, setAnswer] = useState<QAResponse | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
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
    onSuccess: (data: QAResponse) => {
      setAnswer(data);
      form.reset({ query: "" });
    },
  });

  const handleSubmit = (data: QueryForm) => {
    askMutation.mutate({
      ...data,
      documentIds: selectedDocs,
    });
  };

  return (
    <div className="space-y-8">
      {documents && documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Documents to Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center space-x-2">
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
                  <label htmlFor={`doc-${doc.id}`} className="text-sm font-medium">
                    {doc.title}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                    className="min-h-[100px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            disabled={askMutation.isPending}
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