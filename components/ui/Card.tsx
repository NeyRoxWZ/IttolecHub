import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'bg-white border-4 border-[#14142B] shadow-[0_6px_0_#14142B]',
      'text-[#14142B] rounded-[22px]',
      className
    )}>
      {children}
    </div>
  );
}
