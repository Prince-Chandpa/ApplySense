import React from 'react';
import type { VariantStats } from '../../types/analytics';

interface FunnelChartProps {
  control: VariantStats;
  treatment: VariantStats;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ control, treatment }) => {
  const chartHeight = 220;
  const chartWidth = 500;
  const maxEvents = Math.max(control.starts, treatment.starts, 10);
  const maxBarLength = 240;

  const getBarWidth = (val: number) =>
    maxEvents > 0 ? Math.max((val / maxEvents) * maxBarLength, 4) : 4;

  return (
    <div className="analytics-chart-container">
      <div className="chart-header">
        <h4>Application Starts vs Completions</h4>
        <span className="chart-subtitle">Event Counts by Variation</span>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="analytics-svg-chart"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Starts versus completions funnel chart"
      >
        {/* Row 1: Control Starts */}
        <g transform="translate(10, 30)">
          <text x="120" y="16" textAnchor="end" fontSize="12" fontWeight="600" fill="#475569">
            Control Starts
          </text>
          <rect
            x="130"
            y="2"
            width={getBarWidth(control.starts)}
            height="20"
            rx="4"
            fill="#94a3b8"
          />
          <text
            x={140 + getBarWidth(control.starts)}
            y="16"
            fontSize="12"
            fontWeight="700"
            fill="#334155"
          >
            {control.starts}
          </text>
        </g>

        {/* Row 2: Control Completions */}
        <g transform="translate(10, 65)">
          <text x="120" y="16" textAnchor="end" fontSize="12" fontWeight="600" fill="#64748b">
            Control Completed
          </text>
          <rect
            x="130"
            y="2"
            width={getBarWidth(control.completions)}
            height="20"
            rx="4"
            fill="#cbd5e1"
          />
          <text
            x={140 + getBarWidth(control.completions)}
            y="16"
            fontSize="12"
            fontWeight="700"
            fill="#475569"
          >
            {control.completions}
          </text>
        </g>

        {/* Divider */}
        <line x1="20" y1="105" x2={chartWidth - 20} y2="105" stroke="#f1f5f9" strokeWidth="1" />

        {/* Row 3: Treatment Starts */}
        <g transform="translate(10, 120)">
          <text x="120" y="16" textAnchor="end" fontSize="12" fontWeight="600" fill="#4338ca">
            Treatment Starts
          </text>
          <rect
            x="130"
            y="2"
            width={getBarWidth(treatment.starts)}
            height="20"
            rx="4"
            fill="#818cf8"
          />
          <text
            x={140 + getBarWidth(treatment.starts)}
            y="16"
            fontSize="12"
            fontWeight="700"
            fill="#4338ca"
          >
            {treatment.starts}
          </text>
        </g>

        {/* Row 4: Treatment Completions */}
        <g transform="translate(10, 155)">
          <text x="120" y="16" textAnchor="end" fontSize="12" fontWeight="600" fill="#635bdb">
            Treatment Completed
          </text>
          <rect
            x="130"
            y="2"
            width={getBarWidth(treatment.completions)}
            height="20"
            rx="4"
            fill="#635bdb"
          />
          <text
            x={140 + getBarWidth(treatment.completions)}
            y="16"
            fontSize="12"
            fontWeight="700"
            fill="#635bdb"
          >
            {treatment.completions}
          </text>
        </g>
      </svg>
    </div>
  );
};
