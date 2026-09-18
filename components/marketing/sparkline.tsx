interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

// Hand-rolled inline SVG, not a charting library — this milestone only needs a
// small illustrative trend line. aria-hidden because the adjacent price and
// MovementIndicator text already carry the real signal.
export function Sparkline({ data, width = 96, height = 32, className }: SparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const trend = data[data.length - 1] > data[0] ? "up" : data[data.length - 1] < data[0] ? "down" : "flat";
  const strokeColor =
    trend === "up"
      ? "var(--positive)"
      : trend === "down"
        ? "var(--negative)"
        : "var(--muted-foreground)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className={className}
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
