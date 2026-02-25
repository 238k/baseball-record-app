"use client";

import { type ReactNode } from "react";
import { FIELD_VIEWBOX, BASE_POSITIONS, BASE_SIZE } from "./constants";

interface BaseballFieldSvgProps {
  /** "full" renders outfield + diamond; "diamond" renders diamond only */
  variant?: "full" | "diamond";
  /** Overlay elements rendered on top of the field */
  children?: ReactNode;
  className?: string;
}

export function BaseballFieldSvg({
  variant = "full",
  children,
  className,
}: BaseballFieldSvgProps) {
  const { home, first, second, third } = BASE_POSITIONS;

  return (
    <svg
      viewBox={FIELD_VIEWBOX}
      className={className}
      data-testid="baseball-field-svg"
      role="img"
      aria-label="野球フィールド"
    >
      {variant === "full" && (
        <>
          {/* Outfield grass arc */}
          <path
            d="M 20,350 Q 20,20 200,20 Q 380,20 380,350 Z"
            fill="#4ade80"
            opacity={0.3}
            data-testid="outfield-grass"
          />
          {/* Outfield boundary arc */}
          <path
            d="M 20,350 Q 20,20 200,20 Q 380,20 380,350"
            fill="none"
            stroke="#16a34a"
            strokeWidth={2}
          />
        </>
      )}

      {/* Infield dirt diamond */}
      <polygon
        points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
        fill="#d4a574"
        opacity={0.4}
        data-testid="infield-diamond"
      />

      {/* Baselines */}
      <line x1={home.x} y1={home.y} x2={first.x} y2={first.y} stroke="white" strokeWidth={2} />
      <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke="white" strokeWidth={2} />
      <line x1={second.x} y1={second.y} x2={third.x} y2={third.y} stroke="white" strokeWidth={2} />
      <line x1={third.x} y1={third.y} x2={home.x} y2={home.y} stroke="white" strokeWidth={2} />

      {/* Bases (rotated squares) */}
      {([
        { pos: first, testId: "base-first" },
        { pos: second, testId: "base-second" },
        { pos: third, testId: "base-third" },
      ] as const).map(({ pos, testId }) => (
        <rect
          key={testId}
          data-testid={testId}
          x={pos.x - BASE_SIZE}
          y={pos.y - BASE_SIZE}
          width={BASE_SIZE * 2}
          height={BASE_SIZE * 2}
          fill="white"
          transform={`rotate(45 ${pos.x} ${pos.y})`}
        />
      ))}

      {/* Home plate (pentagon) */}
      <polygon
        points={`${home.x},${home.y + 8} ${home.x - 8},${home.y + 2} ${home.x - 6},${home.y - 6} ${home.x + 6},${home.y - 6} ${home.x + 8},${home.y + 2}`}
        fill="white"
        data-testid="home-plate"
      />

      {/* Pitcher's mound */}
      <circle
        cx={200}
        cy={260}
        r={8}
        fill="#c4956a"
        stroke="#a17a52"
        strokeWidth={1}
        data-testid="pitchers-mound"
      />

      {children}
    </svg>
  );
}
