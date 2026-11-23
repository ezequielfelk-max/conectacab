import {
  TERMINAL_DYNAMIC_COLOR,
  type CustomTerminalDefinition,
  type CustomTerminalShape,
} from '../types/diagram';

export const TERMINAL_CANVAS_WIDTH = 240;
export const TERMINAL_CANVAS_HEIGHT = 160;
export const TERMINAL_ATTACH_X = 180;
export const TERMINAL_ATTACH_Y = 80;
export const TERMINAL_EDITOR_CABLE_HEIGHT = 24;

export const resolveTerminalShapeColor = (
  color: string,
  terminalColorHex: string
): string => {
  if (color === TERMINAL_DYNAMIC_COLOR) {
    return terminalColorHex;
  }
  return color;
};

export interface CustomTerminalBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  tipX: number;
}

export const computeCustomTerminalBounds = (
  shapes: CustomTerminalShape[],
  attachX: number = TERMINAL_ATTACH_X,
  attachY: number = TERMINAL_ATTACH_Y
): CustomTerminalBounds => {
  if (shapes.length === 0) {
    return {
      minX: 60,
      maxX: attachX,
      minY: attachY - 20,
      maxY: attachY + 20,
      tipX: 60,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    if (shape.kind === 'path') {
      const pad = shape.strokeWidth / 2;
      for (const pt of shape.points) {
        if (pt.x - pad < minX) minX = pt.x - pad;
        if (pt.x + pad > maxX) maxX = pt.x + pad;
        if (pt.y - pad < minY) minY = pt.y - pad;
        if (pt.y + pad > maxY) maxY = pt.y + pad;
      }
    } else if (shape.kind === 'line') {
      const pad = shape.strokeWidth / 2;
      minX = Math.min(minX, shape.x1 - pad, shape.x2 - pad);
      maxX = Math.max(maxX, shape.x1 + pad, shape.x2 + pad);
      minY = Math.min(minY, shape.y1 - pad, shape.y2 - pad);
      maxY = Math.max(maxY, shape.y1 + pad, shape.y2 + pad);
    } else if (shape.kind === 'rect') {
      const pad = shape.stroke !== 'none' ? shape.strokeWidth / 2 : 0;
      minX = Math.min(minX, shape.x - pad);
      maxX = Math.max(maxX, shape.x + shape.width + pad);
      minY = Math.min(minY, shape.y - pad);
      maxY = Math.max(maxY, shape.y + shape.height + pad);
    } else if (shape.kind === 'ellipse') {
      const pad = shape.stroke !== 'none' ? shape.strokeWidth / 2 : 0;
      minX = Math.min(minX, shape.cx - shape.rx - pad);
      maxX = Math.max(maxX, shape.cx + shape.rx + pad);
      minY = Math.min(minY, shape.cy - shape.ry - pad);
      maxY = Math.max(maxY, shape.cy + shape.ry + pad);
    }
  }

  if (!Number.isFinite(minX)) {
    return {
      minX: 60,
      maxX: attachX,
      minY: attachY - 20,
      maxY: attachY + 20,
      tipX: 60,
    };
  }

  const tipX = Math.max(0, Math.min(attachX - 10, minX));

  return {
    minX,
    maxX,
    minY,
    maxY,
    tipX: Math.round(tipX * 10) / 10,
  };
};

export const getCustomTerminalRenderMetrics = (
  terminal: CustomTerminalDefinition,
  referenceCableHeightPx: number,
  maxLengthPx?: number
): {
  renderScale: number;
  wireOffset: number;
  tipX: number;
  attachX: number;
  attachY: number;
} => {
  const attachX = terminal.attachX || TERMINAL_ATTACH_X;
  const attachY = terminal.attachY || TERMINAL_ATTACH_Y;
  const tipX =
    typeof terminal.tipX === 'number'
      ? terminal.tipX
      : computeCustomTerminalBounds(terminal.shapes, attachX, attachY).tipX;

  const editorSpanX = Math.max(12, attachX - tipX);
  const userScale = Math.max(0.4, Math.min(2.2, terminal.scale || 1));
  let renderScale =
    (Math.max(8, referenceCableHeightPx) / TERMINAL_EDITOR_CABLE_HEIGHT) *
    userScale;

  if (maxLengthPx !== undefined && editorSpanX * renderScale > maxLengthPx) {
    renderScale = maxLengthPx / editorSpanX;
  }

  const wireOffset = Math.max(6, Math.round(editorSpanX * renderScale * 10) / 10);

  return {
    renderScale,
    wireOffset,
    tipX,
    attachX,
    attachY,
  };
};

export const buildSmoothPathD = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
};

export const mirrorShapeVertically = (
  shape: CustomTerminalShape,
  axisY: number = TERMINAL_ATTACH_Y,
  newId: string
): CustomTerminalShape => {
  const mirrorY = (y: number) => Math.round((2 * axisY - y) * 10) / 10;

  if (shape.kind === 'path') {
    return {
      ...shape,
      id: newId,
      points: shape.points.map((pt) => ({ x: pt.x, y: mirrorY(pt.y) })),
    };
  }
  if (shape.kind === 'line') {
    return {
      ...shape,
      id: newId,
      y1: mirrorY(shape.y1),
      y2: mirrorY(shape.y2),
    };
  }
  if (shape.kind === 'rect') {
    const nextTop = mirrorY(shape.y + shape.height);
    return {
      ...shape,
      id: newId,
      y: nextTop,
    };
  }
  return {
    ...shape,
    id: newId,
    cy: mirrorY(shape.cy),
  };
};

export type TerminalResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'start'
  | 'end';

export interface TerminalShapeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getTerminalShapeBounds = (
  shape: CustomTerminalShape
): TerminalShapeBounds => {
  if (shape.kind === 'rect') {
    const pad = shape.stroke !== 'none' ? shape.strokeWidth / 2 : 0;
    return {
      minX: shape.x - pad,
      minY: shape.y - pad,
      maxX: shape.x + shape.width + pad,
      maxY: shape.y + shape.height + pad,
    };
  }
  if (shape.kind === 'ellipse') {
    const pad = shape.stroke !== 'none' ? shape.strokeWidth / 2 : 0;
    return {
      minX: shape.cx - shape.rx - pad,
      minY: shape.cy - shape.ry - pad,
      maxX: shape.cx + shape.rx + pad,
      maxY: shape.cy + shape.ry + pad,
    };
  }
  if (shape.kind === 'line') {
    const pad = shape.strokeWidth / 2;
    return {
      minX: Math.min(shape.x1, shape.x2) - pad,
      minY: Math.min(shape.y1, shape.y2) - pad,
      maxX: Math.max(shape.x1, shape.x2) + pad,
      maxY: Math.max(shape.y1, shape.y2) + pad,
    };
  }
  const pad = shape.strokeWidth / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of shape.points) {
    if (pt.x - pad < minX) minX = pt.x - pad;
    if (pt.y - pad < minY) minY = pt.y - pad;
    if (pt.x + pad > maxX) maxX = pt.x + pad;
    if (pt.y + pad > maxY) maxY = pt.y + pad;
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: TERMINAL_CANVAS_WIDTH, maxY: TERMINAL_CANVAS_HEIGHT };
  }
  return { minX, minY, maxX, maxY };
};

export const moveTerminalShape = (
  shape: CustomTerminalShape,
  dx: number,
  dy: number
): CustomTerminalShape => {
  const round = (v: number) => Math.round(v * 10) / 10;
  if (shape.kind === 'rect') {
    return { ...shape, x: round(shape.x + dx), y: round(shape.y + dy) };
  }
  if (shape.kind === 'ellipse') {
    return { ...shape, cx: round(shape.cx + dx), cy: round(shape.cy + dy) };
  }
  if (shape.kind === 'line') {
    return {
      ...shape,
      x1: round(shape.x1 + dx),
      y1: round(shape.y1 + dy),
      x2: round(shape.x2 + dx),
      y2: round(shape.y2 + dy),
    };
  }
  return {
    ...shape,
    points: shape.points.map((pt) => ({
      x: round(pt.x + dx),
      y: round(pt.y + dy),
    })),
  };
};

export const duplicateTerminalShape = (
  shape: CustomTerminalShape,
  newId: string,
  offsetX = 10,
  offsetY = 10
): CustomTerminalShape => {
  const moved = moveTerminalShape(shape, offsetX, offsetY);
  return { ...moved, id: newId };
};

export const resizeTerminalShape = (
  initialShape: CustomTerminalShape,
  handle: TerminalResizeHandle,
  pt: { x: number; y: number }
): CustomTerminalShape => {
  const round = (v: number) => Math.round(v * 10) / 10;

  if (initialShape.kind === 'line') {
    if (handle === 'start') {
      return { ...initialShape, x1: round(pt.x), y1: round(pt.y) };
    }
    if (handle === 'end') {
      return { ...initialShape, x2: round(pt.x), y2: round(pt.y) };
    }
    return initialShape;
  }

  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;

  if (initialShape.kind === 'rect') {
    left = initialShape.x;
    top = initialShape.y;
    right = initialShape.x + initialShape.width;
    bottom = initialShape.y + initialShape.height;
  } else if (initialShape.kind === 'ellipse') {
    left = initialShape.cx - initialShape.rx;
    right = initialShape.cx + initialShape.rx;
    top = initialShape.cy - initialShape.ry;
    bottom = initialShape.cy + initialShape.ry;
  } else {
    const b = getTerminalShapeBounds(initialShape);
    const pad = initialShape.strokeWidth / 2;
    left = b.minX + pad;
    right = b.maxX - pad;
    top = b.minY + pad;
    bottom = b.maxY - pad;
  }

  let nextLeft = left;
  let nextRight = right;
  let nextTop = top;
  let nextBottom = bottom;

  if (handle.includes('w')) nextLeft = pt.x;
  if (handle.includes('e')) nextRight = pt.x;
  if (handle.includes('n')) nextTop = pt.y;
  if (handle.includes('s')) nextBottom = pt.y;

  const minSize = 4;
  if (nextRight - nextLeft < minSize) {
    if (handle.includes('w')) nextLeft = nextRight - minSize;
    else nextRight = nextLeft + minSize;
  }
  if (nextBottom - nextTop < minSize) {
    if (handle.includes('n')) nextTop = nextBottom - minSize;
    else nextBottom = nextTop + minSize;
  }

  const x = round(Math.max(1, Math.min(TERMINAL_CANVAS_WIDTH - minSize, nextLeft)));
  const y = round(Math.max(1, Math.min(TERMINAL_CANVAS_HEIGHT - minSize, nextTop)));
  const rEdge = round(Math.max(x + minSize, Math.min(TERMINAL_CANVAS_WIDTH - 1, nextRight)));
  const bEdge = round(Math.max(y + minSize, Math.min(TERMINAL_CANVAS_HEIGHT - 1, nextBottom)));
  const width = round(rEdge - x);
  const height = round(bEdge - y);

  if (initialShape.kind === 'rect') {
    return { ...initialShape, x, y, width, height };
  }

  if (initialShape.kind === 'ellipse') {
    return {
      ...initialShape,
      cx: round(x + width / 2),
      cy: round(y + height / 2),
      rx: round(width / 2),
      ry: round(height / 2),
    };
  }

  const oldW = Math.max(1, right - left);
  const oldH = Math.max(1, bottom - top);
  return {
    ...initialShape,
    points: initialShape.points.map((p) => ({
      x: round(x + ((p.x - left) / oldW) * width),
      y: round(y + ((p.y - top) / oldH) * height),
    })),
  };
};
