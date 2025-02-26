import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InsertDocument } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2 } from "lucide-react";
import { z } from "zod";
import { Progress } from "@/components/ui/progress";
import React from 'react';
import { queryClient } from "@/lib/queryClient";

// Extend the schema to include file
const uploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  file: z.instanceof(FileList)
    .transform(list => list.item(0))
    .refine(file => file != null, "Please select a file")
    .refine(
      file => {
        if (!file) return false;
        const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
        console.log('Validating file type:', {
          fileName: file.name,
          fileType: file.type,
          isValid: validTypes.includes(file.type)
        });
        return validTypes.includes(file.type);
      },
      "Invalid file type. Only PDF, DOCX, and TXT files are allowed."
    )
    .refine(
      file => {
        if (!file) return false;
        const isValidSize = file.size <= 5 * 1024 * 1024;
        console.log('Validating file size:', {
          fileName: file.name,
          fileSize: file.size,
          maxSize: 5 * 1024 * 1024,
          isValid: isValidSize
        });
        return isValidSize;
      },
      "File size must be less than 5MB"
    ),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export default function DocumentUpload() {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
    },
  });

  console.log('Form state:', {
    errors: form.formState.errors,
    isDirty: form.formState.isDirty,
    isSubmitting: form.formState.isSubmitting
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      console.log('Starting upload mutation with data:', {
        title: data.title,
        file: data.file && {
          name: data.file.name,
          type: data.file.type,
          size: data.file.size
        }
      });

      const file = data.file;
      if (!file) {
        console.error('No file selected for upload');
        throw new Error('No file selected');
      }

      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('file', file);

      try {
        console.log('Sending upload request...');
        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });

        console.log('Upload response received:', {
          status: response.status,
          statusText: response.statusText
        });

        const responseData = await response.json();
        console.log('Upload response data:', responseData);

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
      console.log('Upload successful, resetting form');
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      form.reset();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploadProgress(0);
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Upload mutation error:', error);
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit((data) => uploadMutation.mutate(data))} 
        className="space-y-4"
      >
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
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => {
                      const files = e.target.files;
                      console.log('File input change event:', {
                        files: files ? Array.from(files).map(f => ({
                          name: f.name,
                          type: f.type,
                          size: f.size
                        })) : null
                      });
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
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
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