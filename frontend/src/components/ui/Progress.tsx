import { ProgressBar } from './ProgressBar';

interface ProgressProps {
  value: number;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  className = '',
}) => {
  return <ProgressBar value={value} className={className} />;
};
