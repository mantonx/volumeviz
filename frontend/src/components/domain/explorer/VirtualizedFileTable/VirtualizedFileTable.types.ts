export interface FileItem {
  id?: number;
  name: string;
  path: string;
  size?: number;
  is_directory: boolean;
  modified_time?: string;
  extension?: string;
  media_type?: string;
}

export interface VirtualizedFileTableProps {
  files: FileItem[];
  selectedFiles?: Set<string>;
  onFileSelect?: (path: string, isMulti?: boolean) => void;
  onFileClick?: (file: FileItem) => void;
  onFileDoubleClick?: (file: FileItem) => void;
  className?: string;
}
