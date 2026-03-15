'use client';

import { useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export default function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(String(value));

  useEffect(() => {
    const interval = setInterval(() => {
      // Always show a random number that goes up
      const randomUp = Math.floor(Math.random() * 9999);
      setDisplay(String(randomUp).padStart(4, '0'));
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return <span className={className}>{display}</span>;
}
