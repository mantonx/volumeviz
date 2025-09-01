export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  modified: Date;
  permissions?: string;
  extension?: string;
  mimeType?: string;
  thumbnail?: string;
}

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  expanded?: boolean;
  hasChildren?: boolean;
}