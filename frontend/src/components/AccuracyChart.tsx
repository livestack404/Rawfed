import React from 'react';
import { Target } from 'lucide-react';

interface AccuracyPoint {
  round: number;
  accuracy: number;
}

interface AccuracyChartProps {
  history: AccuracyPoint[];
  currentRound: number;
  totalRounds?: number;
}

export const AccuracyChart: React.FC<AccuracyChartProps> = ({
  history,
  currentRound,
  totalRounds = 10,
}) => {
  const width = 500;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 30, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // X scale: round 1 to totalRounds (fixed 10)
  const getX = (round: number) => {
    if (totalRounds <= 1) return padding.left;
    return padding.left + ((round - 1) / (totalRounds - 1)) * graphWidth;
  };

  // Y scale: 0% to 100% (fixed)
  const getY = (acc: number) => {
    // acc is in [0, 1] or [0, 100]
    const val = acc > 1 ? acc / 100 : acc;
    const clamped = Math.max(0, Math.min(1, val));
    return padding.top + (1 - clamped) * graphHeight;
  };

  const points = history.map((pt) => ({
    x: getX(pt.round),
    y: getY(pt.accuracy),
    round: pt.round,
    accuracy: pt.accuracy > 1 ? pt.accuracy : pt.accuracy * 100,
  }));

  const pathD = points.length > 0
    ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`
    : '';

  const latestVal = history.length > 0
    ? (history[history.length - 1].accuracy > 1 ? history[history.length - 1].accuracy : history[history.length - 1].accuracy * 100).toFixed(1)
    : '--';

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={16} color="var(--cyan-bright)" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
              Validation Accuracy by Round
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            Real per-round evaluation on validation set (fixed 0–100%, no smoothing)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Latest:</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--cyan-bright)' }}>
            {latestVal}%
          </span>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', maxHeight: '180px', display: 'block' }}
        >
          <defs>
            <linearGradient id="accAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines at 0, 25, 50, 75, 100% */}
          {[0, 0.25, 0.50, 0.75, 1.0].map((val) => {
            const y = getY(val);
            return (
              <g key={`grid-${val}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="3,3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                >
                  {Math.round(val * 100)}%
                </text>
              </g>
            );
          })}

          {/* Vertical Round markers for 1 to totalRounds */}
          {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
            const x = getX(r);
            return (
              <g key={`x-axis-${r}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + graphHeight}
                  stroke="rgba(255, 255, 255, 0.04)"
                />
                <text
                  x={x}
                  y={padding.top + graphHeight + 16}
                  textAnchor="middle"
                  fill={r === currentRound ? 'var(--cyan-bright)' : 'var(--text-muted)'}
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  fontWeight={r === currentRound ? 700 : 400}
                >
                  R{r}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#accAreaGradient)" />}

          {/* Straight line segments */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--cyan-bright)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {points.map((p) => (
            <g key={`dot-${p.round}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#0b1220"
                stroke="var(--cyan-bright)"
                strokeWidth="2"
              />
              <circle cx={p.x} cy={p.y} r="2" fill="var(--cyan-bright)" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
