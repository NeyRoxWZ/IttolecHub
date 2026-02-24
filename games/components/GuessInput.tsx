'use client';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Send } from 'lucide-react';

interface GuessInputProps {
  guess: string;
  setGuess: (value: string) => void;
  handleGuess: (e: React.FormEvent) => void;
  disabled: boolean;
}

export default function GuessInput({ guess, setGuess, handleGuess, disabled }: GuessInputProps) {
  return (
    <form onSubmit={handleGuess} className="flex gap-2">
      <Input
        type="text"
        placeholder="Nom du Pokémon..."
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        className="rounded-xl flex-grow"
        disabled={disabled}
      />
      <Button type="submit" className="rounded-xl" disabled={disabled}>
        <Send className="h-5 w-5" />
      </Button>
    </form>
  );
}