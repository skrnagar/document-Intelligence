import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InsertDocument, insertDocumentSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { z } from "zod";

// Extend the schema to include file
const uploadSchema = insertDocumentSchema.extend({
  file: z.instanceof(FileList)
    .refine((files) => files.length === 1, "Please select a file")
    .refine(
      (files) => {
        const file = files[0];
        const validTypes = [".pdf", ".docx", ".txt"];
        return validTypes.some(type => file.name.toLowerCase().endsWith(type));
      },
      "Invalid file type. Only PDF, DOCX, and TXT files are allowed."
    )
    .refine(
      (files) => files[0].size <= 5 * 1024 * 1024,
      "File size must be less than 5MB"
    )
});

type UploadFormData = z.infer<typeof uploadSchema>;

export default function DocumentUpload() {
  const { toast } = useToast();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('file', data.file[0]);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Upload failed');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      form.reset();
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded and is being processed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => uploadMutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter document title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="file"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel>Upload Document</FormLabel>
              <FormControl>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => onChange(e.target.files)}
                    {...field}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
              </FormControl>
              <p className="text-sm text-muted-foreground">
                Supported formats: PDF, DOCX, TXT (Max size: 5MB)
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={uploadMutation.isPending}
          className="w-full"
        >
          {uploadMutation.isPending ? (
            <>Processing...</>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}