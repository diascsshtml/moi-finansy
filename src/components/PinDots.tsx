interface PinDotsProps {
  length: number;
  filled: number;
  shake?: boolean;
}

/** Ряд точек, показывающий сколько цифр PIN-кода уже введено. */
export function PinDots({ length, filled, shake }: PinDotsProps) {
  return (
    <div className={`pin-dots${shake ? ' pin-dots--shake' : ''}`}>
      {Array.from({ length }).map((_, i) => (
        <span key={i} className={`pin-dot${i < filled ? ' pin-dot--filled' : ''}`} />
      ))}
    </div>
  );
}
