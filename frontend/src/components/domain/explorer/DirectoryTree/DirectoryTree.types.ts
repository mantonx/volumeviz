export interface DirectoryTreeProps {
  volumeId: string;
  onPathSelect?: (path: string) => void;
  selectedPath?: string;
  className?: string;
}
