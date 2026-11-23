import React, { useId } from 'react';
import type {
  ComponentShape,
  CustomComponentDrawing,
} from '../types/diagram';
import {
  COMPONENT_CANVAS_HEIGHT,
  COMPONENT_CANVAS_WIDTH,
  COMPONENT_FILL_PRESETS,
  type ComponentResizeHandle,
  buildComponentPathD,
  computeComponentBounds,
  getShapeBounds,
  resolveComponentFill,
} from '../utils/customComponent';

interface ComponentSvgDefsProps {
  uid: string;
}

export const ComponentSvgDefs: React.FC<ComponentSvgDefsProps> = ({ uid }) => {
  return (
    <defs>
      {COMPONENT_FILL_PRESETS.map((preset) => (
        <linearGradient
          key={preset.id}
          id={`${uid}-${preset.id}`}
          x1="0%"
          y1="0%"
          x2={preset.direction === 'horizontal' ? '100%' : '0%'}
          y2={preset.direction === 'vertical' ? '100%' : '0%'}
        >
          {preset.stops.map((stop, idx) => (
            <stop key={idx} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      ))}

      {/* Gradiente metálico padrão para parafusos de fenda */}
      <linearGradient id={`${uid}-screw-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f4f4f5" />
        <stop offset="50%" stopColor="#a1a1aa" />
        <stop offset="100%" stopColor="#52525b" />
      </linearGradient>

      {/* Gradiente para filetes de rosca verticais */}
      <linearGradient id={`${uid}-thread-v`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#09090b" />
        <stop offset="50%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#09090b" />
      </linearGradient>

      {/* Gradiente para filetes de rosca horizontais */}
      <linearGradient id={`${uid}-thread-h`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#09090b" />
        <stop offset="50%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#09090b" />
      </linearGradient>

      {/* Sombra 3D industrial para corpos/carcaças */}
      <filter id={`${uid}-drop-shadow`} x="-15%" y="-15%" width="130%" height="135%">
        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="4.5"
          floodColor="#020617"
          floodOpacity="0.48"
        />
      </filter>

      {/* Brilho suave para LEDs */}
      <filter id={`${uid}-led-glow`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="3.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
};

interface CustomComponentShapesProps {
  shapes: ComponentShape[];
  uid: string;
  interactiveMode?: 'none' | 'select' | 'eraser';
  selectedShapeId?: string | null;
  hoveredShapeId?: string | null;
  onShapeHover?: (id: string | null) => void;
  onShapeClick?: (id: string) => void;
  onShapePointerDown?: (id: string, event: React.PointerEvent<SVGElement>) => void;
  onHandlePointerDown?: (
    id: string,
    handle: ComponentResizeHandle,
    event: React.PointerEvent<SVGElement>
  ) => void;
}

export const CustomComponentShapes: React.FC<CustomComponentShapesProps> = ({
  shapes,
  uid,
  interactiveMode = 'none',
  selectedShapeId = null,
  hoveredShapeId = null,
  onShapeHover,
  onShapeClick,
  onShapePointerDown,
  onHandlePointerDown,
}) => {
  const selectedShape =
    interactiveMode === 'select' && selectedShapeId
      ? shapes.find((s) => s.id === selectedShapeId) ?? null
      : null;

  return (
    <>
      {shapes.map((shape) => {
        const isEraserHover =
          interactiveMode === 'eraser' && hoveredShapeId === shape.id;
        const isSelectHover =
          interactiveMode === 'select' && hoveredShapeId === shape.id;
        const isSelected =
          interactiveMode === 'select' && selectedShapeId === shape.id;

        const interactionProps =
          interactiveMode === 'eraser'
            ? {
                onMouseEnter: () => onShapeHover?.(shape.id),
                onMouseLeave: () => onShapeHover?.(null),
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onShapeClick?.(shape.id);
                },
                style: {
                  cursor: 'pointer',
                  filter: isEraserHover
                    ? 'drop-shadow(0 0 6px rgba(244, 63, 94, 0.95))'
                    : undefined,
                  opacity: isEraserHover
                    ? 0.55
                    : shape.kind === 'screw' ||
                      shape.kind === 'led' ||
                      shape.kind === 'badge'
                    ? 1
                    : shape.opacity ?? 1,
                } as React.CSSProperties,
              }
            : interactiveMode === 'select'
            ? {
                onMouseEnter: () => onShapeHover?.(shape.id),
                onMouseLeave: () => onShapeHover?.(null),
                onPointerDown: (e: React.PointerEvent<SVGElement>) => {
                  e.stopPropagation();
                  onShapePointerDown?.(shape.id, e);
                },
                style: {
                  cursor: 'move',
                  filter:
                    isSelectHover && !isSelected
                      ? 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.75))'
                      : undefined,
                } as React.CSSProperties,
              }
            : {};

        let element: React.ReactNode = null;

        if (shape.kind === 'rect') {
          const fillVal =
            shape.fill === 'none' ? 'none' : resolveComponentFill(shape.fill, uid);
          const strokeVal = isEraserHover ? '#fb7185' : shape.stroke;
          element = (
            <g {...interactionProps}>
              <rect
                x={shape.x}
                y={shape.y}
                width={Math.max(1, shape.width)}
                height={Math.max(1, shape.height)}
                rx={shape.rx}
                fill={fillVal}
                stroke={strokeVal}
                strokeWidth={shape.stroke === 'none' ? 0 : shape.strokeWidth}
                strokeLinejoin="round"
                opacity={shape.opacity ?? 1}
                filter={
                  shape.shadow && !isEraserHover
                    ? `url(#${uid}-drop-shadow)`
                    : undefined
                }
              />
              {interactiveMode !== 'none' && shape.fill === 'none' && (
                <rect
                  x={shape.x}
                  y={shape.y}
                  width={Math.max(1, shape.width)}
                  height={Math.max(1, shape.height)}
                  rx={shape.rx}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(12, shape.strokeWidth + 8)}
                />
              )}
            </g>
          );
        } else if (shape.kind === 'ellipse') {
          const fillVal =
            shape.fill === 'none' ? 'none' : resolveComponentFill(shape.fill, uid);
          const strokeVal = isEraserHover ? '#fb7185' : shape.stroke;
          element = (
            <g {...interactionProps}>
              <ellipse
                cx={shape.cx}
                cy={shape.cy}
                rx={Math.max(1, shape.rx)}
                ry={Math.max(1, shape.ry)}
                fill={fillVal}
                stroke={strokeVal}
                strokeWidth={shape.stroke === 'none' ? 0 : shape.strokeWidth}
                opacity={shape.opacity ?? 1}
                filter={
                  shape.shadow && !isEraserHover
                    ? `url(#${uid}-drop-shadow)`
                    : undefined
                }
              />
              {interactiveMode !== 'none' && shape.fill === 'none' && (
                <ellipse
                  cx={shape.cx}
                  cy={shape.cy}
                  rx={Math.max(1, shape.rx)}
                  ry={Math.max(1, shape.ry)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(12, shape.strokeWidth + 8)}
                />
              )}
            </g>
          );
        } else if (shape.kind === 'line') {
          element = (
            <g {...interactionProps}>
              {interactiveMode !== 'none' && (
                <line
                  x1={shape.x1}
                  y1={shape.y1}
                  x2={shape.x2}
                  y2={shape.y2}
                  stroke="transparent"
                  strokeWidth={Math.max(14, shape.strokeWidth + 10)}
                  strokeLinecap="round"
                />
              )}
              <line
                x1={shape.x1}
                y1={shape.y1}
                x2={shape.x2}
                y2={shape.y2}
                stroke={isEraserHover ? '#fb7185' : shape.stroke}
                strokeWidth={shape.strokeWidth}
                strokeLinecap="round"
                opacity={shape.opacity ?? 1}
              />
            </g>
          );
        } else if (shape.kind === 'path') {
          const d = buildComponentPathD(shape.points);
          element = (
            <g {...interactionProps}>
              {interactiveMode !== 'none' && (
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(14, shape.strokeWidth + 10)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <path
                d={d}
                fill="none"
                stroke={isEraserHover ? '#fb7185' : shape.stroke}
                strokeWidth={shape.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={shape.opacity ?? 1}
              />
            </g>
          );
        } else if (shape.kind === 'screw') {
          const r = Math.max(4, shape.radius);
          const slotHalf = r * 0.68;
          element = (
            <g
              transform={`translate(${shape.cx}, ${shape.cy})`}
              {...interactionProps}
            >
              <circle
                cx="0"
                cy="0"
                r={r + 1.5}
                fill="#e7e5e4"
                stroke={isEraserHover ? '#fb7185' : '#57534e'}
                strokeWidth="1.4"
              />
              <circle
                cx="0"
                cy="0"
                r={r}
                fill={`url(#${uid}-screw-metal)`}
                stroke="#3f3f46"
                strokeWidth="1.2"
              />
              <g transform={`rotate(${shape.angle})`}>
                <line
                  x1={-slotHalf}
                  y1="0"
                  x2={slotHalf}
                  y2="0"
                  stroke="#18181b"
                  strokeWidth={Math.max(1.8, r * 0.24)}
                  strokeLinecap="round"
                />
                <line
                  x1={-slotHalf + 0.8}
                  y1={-Math.max(0.8, r * 0.14)}
                  x2={slotHalf - 0.8}
                  y2={-Math.max(0.8, r * 0.14)}
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
              </g>
            </g>
          );
        } else if (shape.kind === 'led') {
          const r = Math.max(3, shape.radius);
          element = (
            <g
              transform={`translate(${shape.cx}, ${shape.cy})`}
              {...interactionProps}
            >
              <circle
                cx="0"
                cy="0"
                r={r * 1.45}
                fill={shape.color}
                opacity="0.35"
                filter={`url(#${uid}-led-glow)`}
              />
              <circle
                cx="0"
                cy="0"
                r={r}
                fill={shape.color}
                stroke={isEraserHover ? '#fb7185' : '#ffffff'}
                strokeWidth="1.3"
                filter={`url(#${uid}-led-glow)`}
              />
              <circle
                cx={-r * 0.3}
                cy={-r * 0.3}
                r={Math.max(1.2, r * 0.28)}
                fill="rgba(255,255,255,0.85)"
              />
            </g>
          );
        } else if (shape.kind === 'threads') {
          const count = Math.max(2, Math.min(30, shape.count));
          const isVertical = shape.orientation === 'vertical';
          const barThickness = isVertical
            ? Math.max(2, Math.min(6, (shape.width / count) * 0.28))
            : Math.max(2, Math.min(6, (shape.height / count) * 0.28));

          element = (
            <g opacity={shape.opacity ?? 0.26} {...interactionProps}>
              <rect
                x={shape.x}
                y={shape.y}
                width={Math.max(1, shape.width)}
                height={Math.max(1, shape.height)}
                fill="transparent"
                stroke={isEraserHover ? '#fb7185' : 'none'}
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              {Array.from({ length: count }).map((_, idx) => {
                const ratio = count === 1 ? 0.5 : idx / (count - 1);
                if (isVertical) {
                  const bx = shape.x + ratio * Math.max(0, shape.width - barThickness);
                  return (
                    <rect
                      key={idx}
                      x={bx}
                      y={shape.y}
                      width={barThickness}
                      height={Math.max(1, shape.height)}
                      rx="1"
                      fill={`url(#${uid}-thread-v)`}
                    />
                  );
                }
                const by = shape.y + ratio * Math.max(0, shape.height - barThickness);
                return (
                  <rect
                    key={idx}
                    x={shape.x}
                    y={by}
                    width={Math.max(1, shape.width)}
                    height={barThickness}
                    rx="1"
                    fill={`url(#${uid}-thread-h)`}
                  />
                );
              })}
            </g>
          );
        } else if (shape.kind === 'badge') {
          const w = Math.max(18, shape.width);
          const h = Math.max(14, shape.height);
          element = (
            <g {...interactionProps}>
              <rect
                x={shape.x}
                y={shape.y}
                width={w}
                height={h}
                rx={shape.rx}
                fill={shape.bgColor}
                stroke={isEraserHover ? '#fb7185' : shape.borderColor}
                strokeWidth="1.6"
              />
              <text
                x={shape.x + w / 2}
                y={shape.y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={shape.textColor}
                fontSize={shape.fontSize}
                fontWeight="700"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {shape.text}
              </text>
            </g>
          );
        }

        return <React.Fragment key={shape.id}>{element}</React.Fragment>;
      })}

      {/* Sobreposição interativa de seleção e alças de ajuste/redimensionamento (sempre no topo) */}
      {selectedShape && (() => {
        if (selectedShape.kind === 'line') {
          return (
            <g>
              <line
                x1={selectedShape.x1}
                y1={selectedShape.y1}
                x2={selectedShape.x2}
                y2={selectedShape.y2}
                stroke="#38bdf8"
                strokeWidth="1.4"
                strokeDasharray="4 3"
                className="pointer-events-none"
              />
              {(
                [
                  { id: 'start' as const, x: selectedShape.x1, y: selectedShape.y1 },
                  { id: 'end' as const, x: selectedShape.x2, y: selectedShape.y2 },
                ]
              ).map((pt) => (
                <circle
                  key={pt.id}
                  cx={pt.x}
                  cy={pt.y}
                  r="5.5"
                  fill="#38bdf8"
                  stroke="#020617"
                  strokeWidth="1.8"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onHandlePointerDown?.(selectedShape.id, pt.id, e);
                  }}
                />
              ))}
            </g>
          );
        }

        if (selectedShape.kind === 'screw' || selectedShape.kind === 'led') {
          const r = selectedShape.radius + 4;
          const pts = [
            { x: selectedShape.cx + r, y: selectedShape.cy, cursor: 'ew-resize' },
            { x: selectedShape.cx - r, y: selectedShape.cy, cursor: 'ew-resize' },
            { x: selectedShape.cx, y: selectedShape.cy - r, cursor: 'ns-resize' },
            { x: selectedShape.cx, y: selectedShape.cy + r, cursor: 'ns-resize' },
          ];
          return (
            <g>
              <circle
                cx={selectedShape.cx}
                cy={selectedShape.cy}
                r={r}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="pointer-events-none"
              />
              {pts.map((pt, idx) => (
                <rect
                  key={idx}
                  x={pt.x - 4}
                  y={pt.y - 4}
                  width="8"
                  height="8"
                  rx="2"
                  fill="#38bdf8"
                  stroke="#020617"
                  strokeWidth="1.5"
                  style={{ cursor: pt.cursor }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onHandlePointerDown?.(selectedShape.id, 'radius', e);
                  }}
                />
              ))}
            </g>
          );
        }

        const b = getShapeBounds(selectedShape);
        const left = b.minX - 3;
        const right = b.maxX + 3;
        const top = b.minY - 3;
        const bottom = b.maxY + 3;
        const midX = (left + right) / 2;
        const midY = (top + bottom) / 2;

        const handles: {
          id: ComponentResizeHandle;
          x: number;
          y: number;
          cursor: string;
        }[] = [
          { id: 'nw', x: left, y: top, cursor: 'nwse-resize' },
          { id: 'n', x: midX, y: top, cursor: 'ns-resize' },
          { id: 'ne', x: right, y: top, cursor: 'nesw-resize' },
          { id: 'e', x: right, y: midY, cursor: 'ew-resize' },
          { id: 'se', x: right, y: bottom, cursor: 'nwse-resize' },
          { id: 's', x: midX, y: bottom, cursor: 'ns-resize' },
          { id: 'sw', x: left, y: bottom, cursor: 'nesw-resize' },
          { id: 'w', x: left, y: midY, cursor: 'ew-resize' },
        ];

        return (
          <g>
            <rect
              x={left}
              y={top}
              width={Math.max(8, right - left)}
              height={Math.max(8, bottom - top)}
              rx="3"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="5 3"
              className="pointer-events-none"
            />
            {handles.map((h) => (
              <rect
                key={h.id}
                x={h.x - 4.2}
                y={h.y - 4.2}
                width="8.4"
                height="8.4"
                rx="1.8"
                fill="#38bdf8"
                stroke="#020617"
                strokeWidth="1.5"
                style={{ cursor: h.cursor }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onHandlePointerDown?.(selectedShape.id, h.id, e);
                }}
              />
            ))}
          </g>
        );
      })()}
    </>
  );
};

interface CustomComponentCanvasSvgProps {
  drawing: CustomComponentDrawing;
  rotationDegrees?: number;
  className?: string;
}

export const CustomComponentCanvasSvg: React.FC<CustomComponentCanvasSvgProps> = ({
  drawing,
  rotationDegrees = 0,
  className = 'w-full h-full pointer-events-none select-none',
}) => {
  const rawId = useId();
  const uid = `comp-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const w = drawing.canvasWidth || COMPONENT_CANVAS_WIDTH;
  const h = drawing.canvasHeight || COMPONENT_CANVAS_HEIGHT;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ transform: `rotate(${rotationDegrees}deg)` }}
      className={className}
    >
      <ComponentSvgDefs uid={uid} />
      <CustomComponentShapes shapes={drawing.shapes} uid={uid} />
    </svg>
  );
};

interface CustomComponentThumbnailProps {
  drawing: CustomComponentDrawing;
  className?: string;
}

export const CustomComponentThumbnail: React.FC<CustomComponentThumbnailProps> = ({
  drawing,
  className = 'w-full h-full p-0.5',
}) => {
  const rawId = useId();
  const uid = `thumb-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const w = drawing.canvasWidth || COMPONENT_CANVAS_WIDTH;
  const h = drawing.canvasHeight || COMPONENT_CANVAS_HEIGHT;
  const bounds = computeComponentBounds(drawing.shapes);
  const pad = 16;
  const minX = Math.max(0, bounds.minX - pad);
  const minY = Math.max(0, bounds.minY - pad);
  const maxX = Math.min(w, bounds.maxX + pad);
  const maxY = Math.min(h, bounds.maxY + pad);
  const vbW = Math.max(40, maxX - minX);
  const vbH = Math.max(40, maxY - minY);

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      className={className}
      aria-hidden="true"
    >
      <ComponentSvgDefs uid={uid} />
      <CustomComponentShapes shapes={drawing.shapes} uid={uid} />
    </svg>
  );
};
