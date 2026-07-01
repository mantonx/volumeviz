import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetchClient } from '@/api/fetch-client';

export interface FileOperationsReturn {
  downloadFile: {
    mutateAsync: (params: {
      fileId: string;
      filename?: string;
      path?: string;
    }) => Promise<void>;
    isLoading: boolean;
  };
  generatePreview: {
    mutateAsync: (params: {
      fileId: string;
      type?: string;
      size?: string;
    }) => Promise<any>;
    isLoading: boolean;
  };
}

export function useFileOperations(): FileOperationsReturn {
  const queryClient = useQueryClient();

  // File download mutation
  const downloadFileMutation = useMutation({
    mutationFn: async ({
      fileId,
      filename,
      path,
    }: {
      fileId: string;
      filename?: string;
      path?: string;
    }) => {
      // For now, we'll use a direct download approach
      // This would need to be updated based on the actual API endpoints
      const downloadUrl = path
        ? `/api/v1/files/download?path=${encodeURIComponent(path)}`
        : `/api/v1/files/${fileId}/download`;

      const response = await customFetchClient(downloadUrl, {
        method: 'GET',
        // Return blob response for file downloads
      });

      // Create download link and trigger download
      const blob = new Blob([response as any]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `file-${fileId}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });

  // Preview generation mutation
  const previewMutation = useMutation({
    mutationFn: async ({
      fileId,
      type = 'thumbnail',
      size = 'medium',
    }: {
      fileId: string;
      type?: string;
      size?: string;
    }) => {
      return customFetchClient(`/api/v1/files/${fileId}/preview`, {
        method: 'POST',
        body: JSON.stringify({ type, size }),
      });
    },
    onSuccess: (_data, variables) => {
      // Invalidate file queries to refresh preview info
      queryClient.invalidateQueries({ queryKey: ['explorer', 'browse'] });
      queryClient.invalidateQueries({
        queryKey: ['files', 'detail', variables.fileId],
      });
    },
  });

  return {
    downloadFile: {
      mutateAsync: downloadFileMutation.mutateAsync,
      isLoading: downloadFileMutation.isPending,
    },
    generatePreview: {
      mutateAsync: previewMutation.mutateAsync,
      isLoading: previewMutation.isPending,
    },
  };
}
