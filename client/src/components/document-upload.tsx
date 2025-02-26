import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InsertDocument, insertDocumentSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { z } from "zod";
import { Progress } from "@/components/ui/progress";
import React from 'react';
import { queryClient } from "@/lib/queryClient";

// Extend the schema to include file
const uploadSchema = insertDocumentSchema.extend({
  file: z.instanceof(FileList)
    .transform(list => list.item(0))
    .refine(file => file != null, "Please select a file")
    .refine(
      file => {
        if (!file) return false;
        const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
        return validTypes.includes(file.type);
      },
      "Invalid file type. Only PDF, DOCX, and TXT files are allowed."
    )
    .refine(
      file => file && file.size <= 5 * 1024 * 1024,
      "File size must be less than 5MB"
    ),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export default function DocumentUpload() {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      const file = data.file;
      if (!file) {
        throw new Error('No file selected');
      }

      console.log('Starting upload with data:', {
        title: data.title,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('file', file);

      try {
        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });

        const responseData = await response.json();
        console.log('Upload response:', {
          status: response.status,
          data: responseData
        });

        if (!response.ok) {
          throw new Error(responseData.message || 'Upload failed');
        }

        return responseData;
      } catch (error) {
        console.error('Upload error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      form.reset();
      setUploadProgress(0);
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: UploadFormData) => {
    try {
      console.log('Form submitted with data:', {
        title: data.title,
        file: data.file && {
          name: data.file.name,
          size: data.file.size,
          type: data.file.type
        }
      });
      await uploadMutation.mutateAsync(data);
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    onChange={(e) => {
                      const files = e.target.files;
                      console.log('File selected:', files);
                      if (files && files.length > 0) {
                        onChange(files);
                      }
                    }}
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

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Uploading... {Math.round(uploadProgress)}%
            </p>
          </div>
        )}

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