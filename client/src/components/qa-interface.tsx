import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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
                <FormLabel>Your Question</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Ask a question about your documents..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={askMutation.isPending}>
            {askMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Thinking...
              </>
            ) : (
              "Ask Question"
            )}
          </Button>
        </form>
      </Form>

      {answer && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Answer:</h3>
              <p className="text-muted-foreground">{answer.answer}</p>
            </CardContent>
          </Card>

          {answer.relevantDocs.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Relevant Documents:</h3>
              <div className="space-y-2">
                {answer.relevantDocs.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="py-3">
                      <h4 className="font-medium">{doc.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {doc.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
