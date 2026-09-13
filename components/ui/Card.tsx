import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'bg-[#1E2358] border-4 border-[#05061A] shadow-[0_6px_0_#05061A]',
      'text-white rounded-[22px]',
      className
    )}>
      {children}
    </div>
  );
}
