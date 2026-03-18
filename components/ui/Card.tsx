import { cn } from '@/lib/utils';
import * as React from 'react';

interface CardProps {
  variant?: 'default' | 'inner';
  className?: string;
  children: React.ReactNode;
}

export function Card({ variant = 'default', children, className }: CardProps) {
  return (
    <div className={cn(variant === 'inner' ? 'card-inner' : 'card', className)}>
      {children}
    </div>
  );
}
