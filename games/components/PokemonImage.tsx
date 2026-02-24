'use client';

interface PokemonImageProps {
  imageUrl: string;
  revealed: boolean;
  blurLevel: number;
}

export default function PokemonImage({ imageUrl, revealed, blurLevel }: PokemonImageProps) {
  const blurStyle = revealed ? 'blur-none' : `blur-[${blurLevel}px]`;

  return (
    <div className="relative w-full h-full flex-1 flex items-center justify-center">
      <img
        src={imageUrl}
        alt="Pokemon à deviner"
        className={`transition-all duration-1000 object-contain max-w-full max-h-full ${blurStyle}`}
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}