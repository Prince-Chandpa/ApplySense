import React from 'react';
import type { VariantStats } from '../../types/analytics';

interface ConversionBarChartProps {
  control: VariantStats;
  treatment: VariantStats;
}

export const ConversionBarChart: React.FC<ConversionBarChartProps> = ({
  control,
  treatment,
}) => {
  const controlRate = control.completionRate ?? 0;
  const treatmentRate = treatment.completionRate ?? 0;
  const maxRate = Math.max(controlRate, treatmentRate, 60);
  const chartHeight = 220;
  const chartWidth = 480;
  const barWidth = 70;
  const baseY = 180;
  const usableHeight = 140;

  const controlBarHeight =
    maxRate > 0 ? (controlRate / maxRate) * usableHeight : 0;
  const treatmentBarHeight =
    maxRate > 0 ? (treatmentRate / maxRate) * usableHeight : 0;

  const controlY = baseY - controlBarHeight;
  const treatmentY = baseY - treatmentBarHeight;

  return (
    <div className="analytics-chart-container">
      <div className="chart-header">
        <h4>Conversion Rate by Variation</h4>
        <span className="chart-subtitle">Primary Metric: Application Completion (%)</span>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="analytics-svg-chart"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Conversion rate comparison bar chart"
      >
        <defs>
          <linearGradient id="controlGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="treatmentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#635bdb" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          if (pct > maxRate + 10) return null;
          const y = baseY - (pct / maxRate) * usableHeight;
          return (
            <g key={pct} className="grid-line-group">
              <line
                x1="45"
                y1={y}
                x2={chartWidth - 20}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x="38"
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94a3b8"
                fontFamily="inherit"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* X Axis line */}
        <line
          x1="45"
          y1={baseY}
          x2={chartWidth - 20}
          y2={baseY}
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />

        {/* Control Bar */}
        <g className="chart-bar-group">
          <rect
            x="110"
            y={controlY}
            width={barWidth}
            height={controlBarHeight}
            rx="6"
            fill="url(#controlGradient)"
            className="chart-bar-rect"
          />
          <text
            x={110 + barWidth / 2}
            y={controlY - 8}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#475569"
          >
            {control.completionRate === null ? 'N/A' : `${control.completionRate}%`}
          </text>
          <text
            x={110 + barWidth / 2}
            y={baseY + 20}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#64748b"
          >
            Control
          </text>
          <text
            x={110 + barWidth / 2}
            y={baseY + 34}
            textAnchor="middle"
            fontSize="10"
            fill="#94a3b8"
          >
            Standard Details
          </text>
        </g>

        {/* Treatment Bar */}
        <g className="chart-bar-group">
          <rect
            x="290"
            y={treatmentY}
            width={barWidth}
            height={treatmentBarHeight}
            rx="6"
            fill="url(#treatmentGradient)"
            className="chart-bar-rect"
          />
          <text
            x={290 + barWidth / 2}
            y={treatmentY - 8}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#635bdb"
          >
            {treatment.completionRate === null ? 'N/A' : `${treatment.completionRate}%`}
          </text>
          <text
            x={290 + barWidth / 2}
            y={baseY + 20}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#635bdb"
          >
            Treatment
          </text>
          <text
            x={290 + barWidth / 2}
            y={baseY + 34}
            textAnchor="middle"
            fontSize="10"
            fill="#818cf8"
          >
            FitLens Insights
          </text>
        </g>
      </svg>
    </div>
  );
};
