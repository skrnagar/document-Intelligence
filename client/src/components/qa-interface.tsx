import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Book } from "lucide-react";
import { Document } from "@shared/schema";

const querySchema = z.object({
  query: z.string().min(1, "Please enter a question"),
});

type QueryForm = z.infer<typeof querySchema>;

interface QAResponse {
  answer: string;
  relevantDocs: Document[];
}

export default function QAInterface() {
  const [answer, setAnswer] = useState<QAResponse | null>(null);

  const form = useForm<QueryForm>({
    resolver: zodResolver(querySchema),
    defaultValues: {
      query: "",
    },
  });

  const askMutation = useMutation({
    mutationFn: async (data: QueryForm) => {
      const res = await apiRequest("POST", "/api/qa", data);
      return res.json();
    },
    onSuccess: (data: QAResponse) => {
      setAnswer(data);
      form.reset();
    },
  });

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => askMutation.mutate(data))} className="space-y-4">
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
              <p className="text-lg leading-relaxed">{answer.answer}</p>
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