interface SparklineProps {
  points: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

/** Миниатюрный график тренда для строки списка — без осей и подписей:
 *  направление и так дублируется числом в пилюле рядом, цвет здесь чисто
 *  вспомогательный, а не единственный носитель смысла. */
export function Sparkline({ points, positive, width = 44, height = 22 }: SparklineProps) {
  if (points.length < 2) {
    return <svg width={width} height={height} className="sparkline" aria-hidden="true" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${(height - ((p - min) / range) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={positive ? 'var(--money-positive)' : 'var(--money-negative)'}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
