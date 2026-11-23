import React from 'react';
import type {
  CustomTerminalDefinition,
  CustomTerminalShape,
} from '../types/diagram';
import {
  buildSmoothPathD,
  computeCustomTerminalBounds,
  getTerminalShapeBounds,
  resolveTerminalShapeColor,
  TERMINAL_ATTACH_X,
  TERMINAL_ATTACH_Y,
  TERMINAL_CANVAS_HEIGHT,
  TERMINAL_CANVAS_WIDTH,
  type TerminalResizeHandle,
} from '../utils/customTerminal';

interface CustomTerminalShapesProps {
  shapes: CustomTerminalShape[];
  terminalColorHex: string;
  interactiveMode?: 'none' | 'select' | 'eraser';
  interactiveEraser?: boolean;
  selectedShapeId?: string | null;
  hoveredShapeId?: string | null;
  onShapeHover?: (id: string | null) => void;
  onShapeClick?: (id: string) => void;
  onShapePointerDown?: (id: string, event: React.PointerEvent<SVGElement>) => void;
  onHandlePointerDown?: (
    id: string,
    handle: TerminalResizeHandle,
    event: React.PointerEvent<SVGElement>
  ) => void;
}

export const CustomTerminalShapes: React.FC<CustomTerminalShapesProps> = ({
  shapes,
  terminalColorHex,
  interactiveMode,
  interactiveEraser = false,
  selectedShapeId = null,
  hoveredShapeId = null,
  onShapeHover,
  onShapeClick,
  onShapePointerDown,
  onHandlePointerDown,
}) => {
  const mode: 'none' | 'select' | 'eraser' =
    interactiveMode ?? (interactiveEraser ? 'eraser' : 'none');

  const selectedShape =
    mode === 'select' && selectedShapeId
      ? shapes.find((s) => s.id === selectedShapeId) ?? null
      : null;

  return (
    <>
      {shapes.map((shape) => {
        const isEraserHover = mode === 'eraser' && hoveredShapeId === shape.id;
        const isSelectHover = mode === 'select' && hoveredShapeId === shape.id;
        const isSelected = mode === 'select' && selectedShapeId === shape.id;

        const commonProps =
          mode === 'eraser'
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
                    ? 'drop-shadow(0 0 4px rgba(244, 63, 94, 0.95))'
                    : undefined,
                  opacity: isEraserHover ? 0.65 : 1,
                } as React.CSSProperties,
              }
            : mode === 'select'
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
                      ? 'drop-shadow(0 0 3px rgba(56, 189, 248, 0.85))'
                      : undefined,
                } as React.CSSProperties,
              }
            : {};

        if (shape.kind === 'path') {
          const strokeColor = isEraserHover
            ? '#fb7185'
            : resolveTerminalShapeColor(shape.stroke, terminalColorHex);
          const d = buildSmoothPathD(shape.points);
          return (
            <g key={shape.id} {...commonProps}>
              {mode !== 'none' && (
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(10, shape.strokeWidth + 8)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <path
                d={d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={shape.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        }

        if (shape.kind === 'line') {
          const strokeColor = isEraserHover
            ? '#fb7185'
            : resolveTerminalShapeColor(shape.stroke, terminalColorHex);
          return (
            <g key={shape.id} {...commonProps}>
              {mode !== 'none' && (
                <line
                  x1={shape.x1}
                  y1={shape.y1}
                  x2={shape.x2}
                  y2={shape.y2}
                  stroke="transparent"
                  strokeWidth={Math.max(10, shape.strokeWidth + 8)}
                  strokeLinecap="round"
                />
              )}
              <line
                x1={shape.x1}
                y1={shape.y1}
                x2={shape.x2}
                y2={shape.y2}
                stroke={strokeColor}
                strokeWidth={shape.strokeWidth}
                strokeLinecap="round"
              />
            </g>
          );
        }

        if (shape.kind === 'rect') {
          const fillColor =
            shape.fill === 'none'
              ? 'none'
              : resolveTerminalShapeColor(shape.fill, terminalColorHex);
          const strokeColor = isEraserHover
            ? '#fb7185'
            : shape.stroke === 'none'
            ? 'none'
            : resolveTerminalShapeColor(shape.stroke, terminalColorHex);
          return (
            <g key={shape.id} {...commonProps}>
              <rect
                x={shape.x}
                y={shape.y}
                width={Math.max(1, shape.width)}
                height={Math.max(1, shape.height)}
                rx={shape.rx ?? 2}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={shape.stroke === 'none' ? 0 : shape.strokeWidth}
                strokeLinejoin="round"
              />
              {mode !== 'none' && shape.fill === 'none' && (
                <rect
                  x={shape.x}
                  y={shape.y}
                  width={Math.max(1, shape.width)}
                  height={Math.max(1, shape.height)}
                  rx={shape.rx ?? 2}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(10, shape.strokeWidth + 6)}
                />
              )}
            </g>
          );
        }

        const fillColor =
          shape.fill === 'none'
            ? 'none'
            : resolveTerminalShapeColor(shape.fill, terminalColorHex);
        const strokeColor = isEraserHover
          ? '#fb7185'
          : shape.stroke === 'none'
          ? 'none'
          : resolveTerminalShapeColor(shape.stroke, terminalColorHex);

        return (
          <g key={shape.id} {...commonProps}>
            <ellipse
              cx={shape.cx}
              cy={shape.cy}
              rx={Math.max(1, shape.rx)}
              ry={Math.max(1, shape.ry)}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={shape.stroke === 'none' ? 0 : shape.strokeWidth}
            />
            {mode !== 'none' && shape.fill === 'none' && (
              <ellipse
                cx={shape.cx}
                cy={shape.cy}
                rx={Math.max(1, shape.rx)}
                ry={Math.max(1, shape.ry)}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(10, shape.strokeWidth + 6)}
              />
            )}
          </g>
        );
      })}

      {/* Alças interativas de ajuste/redimensionamento para o elemento selecionado */}
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
                strokeWidth="1"
                strokeDasharray="3 2"
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
                  r="4"
                  fill="#38bdf8"
                  stroke="#020617"
                  strokeWidth="1.2"
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

        const b = getTerminalShapeBounds(selectedShape);
        const left = b.minX - 2;
        const right = b.maxX + 2;
        const top = b.minY - 2;
        const bottom = b.maxY + 2;
        const midX = (left + right) / 2;
        const midY = (top + bottom) / 2;

        const handles: {
          id: TerminalResizeHandle;
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
              width={Math.max(4, right - left)}
              height={Math.max(4, bottom - top)}
              rx="2"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.1"
              strokeDasharray="3.5 2"
              className="pointer-events-none"
            />
            {handles.map((h) => (
              <rect
                key={h.id}
                x={h.x - 3}
                y={h.y - 3}
                width="6"
                height="6"
                rx="1.2"
                fill="#38bdf8"
                stroke="#020617"
                strokeWidth="1.1"
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

interface CustomTerminalAttachedProps {
  terminal: CustomTerminalDefinition;
  terminalColorHex: string;
  renderScale: number;
  tipX: number;
  attachY: number;
  mirrorX?: boolean;
}

/**
 * Renderiza o terminal customizado com a ponta (tipX, attachY) ancorada em (0, 0)
 * e a entrada do cabo estendendo-se para +X (ou -X quando mirrorX = true).
 */
export const CustomTerminalAttached: React.FC<CustomTerminalAttachedProps> = ({
  terminal,
  terminalColorHex,
  renderScale,
  tipX,
  attachY,
  mirrorX = false,
}) => {
  const sx = mirrorX ? -renderScale : renderScale;
  return (
    <g transform={`scale(${sx}, ${renderScale}) translate(${-tipX}, ${-attachY})`}>
      <CustomTerminalShapes
        shapes={terminal.shapes}
        terminalColorHex={terminalColorHex}
      />
    </g>
  );
};

interface CustomTerminalThumbnailProps {
  terminal: CustomTerminalDefinition;
  terminalColorHex?: string;
  className?: string;
}

export const CustomTerminalThumbnail: React.FC<CustomTerminalThumbnailProps> = ({
  terminal,
  terminalColorHex = '#ef4444',
  className = 'w-7 h-5 shrink-0',
}) => {
  const attachX = terminal.attachX || TERMINAL_ATTACH_X;
  const attachY = terminal.attachY || TERMINAL_ATTACH_Y;
  const bounds = computeCustomTerminalBounds(terminal.shapes, attachX, attachY);
  const pad = 12;
  const minX = Math.max(0, bounds.minX - pad);
  const maxX = Math.min(
    terminal.canvasWidth || TERMINAL_CANVAS_WIDTH,
    Math.max(bounds.maxX + pad, attachX + 24)
  );
  const minY = Math.max(0, Math.min(bounds.minY - pad, attachY - 26));
  const maxY = Math.min(
    terminal.canvasHeight || TERMINAL_CANVAS_HEIGHT,
    Math.max(bounds.maxY + pad, attachY + 26)
  );
  const vbW = Math.max(40, maxX - minX);
  const vbH = Math.max(30, maxY - minY);

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      className={className}
      aria-hidden="true"
    >
      {/* Pequeno trecho de cabo de referência à direita */}
      <line
        x1={attachX - 2}
        y1={attachY}
        x2={maxX}
        y2={attachY}
        stroke="#0f172a"
        strokeWidth="22"
        strokeLinecap="butt"
      />
      <line
        x1={attachX - 2}
        y1={attachY}
        x2={maxX}
        y2={attachY}
        stroke={terminalColorHex}
        strokeWidth="16"
        strokeLinecap="butt"
      />
      <CustomTerminalShapes
        shapes={terminal.shapes}
        terminalColorHex={terminalColorHex}
      />
    </svg>
  );
};
