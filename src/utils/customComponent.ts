import type {
  ComponentFillPreset,
  ComponentShape,
  PinCoordinate,
  PinSide,
} from '../types/diagram';

export const COMPONENT_CANVAS_WIDTH = 320;
export const COMPONENT_CANVAS_HEIGHT = 320;

export interface FillPresetMeta {
  id: ComponentFillPreset;
  value: string;
  label: string;
  shortLabel: string;
  cssGradient: string;
  direction: 'horizontal' | 'vertical';
  stops: { offset: string; color: string }[];
  defaultStroke: string;
}

export const COMPONENT_FILL_PRESETS: FillPresetMeta[] = [
  {
    id: 'grad-inox-h',
    value: 'preset:grad-inox-h',
    label: 'Aço Inox / Sensor M12',
    shortLabel: 'Inox',
    cssGradient: 'linear-gradient(90deg, #0369a1 0%, #d4d4d8 50%, #27272a 100%)',
    direction: 'horizontal',
    stops: [
      { offset: '0%', color: '#0369a1' },
      { offset: '50%', color: '#d4d4d8' },
      { offset: '100%', color: '#27272a' },
    ],
    defaultStroke: '#52525b',
  },
  {
    id: 'grad-stone-v',
    value: 'preset:grad-stone-v',
    label: 'Bege Poliamida / Borneira DIN',
    shortLabel: 'Borneira',
    cssGradient: 'linear-gradient(180deg, #d6d3d1 0%, #e7e5e4 50%, #d6d3d1 100%)',
    direction: 'vertical',
    stops: [
      { offset: '0%', color: '#d6d3d1' },
      { offset: '50%', color: '#e7e5e4' },
      { offset: '100%', color: '#d6d3d1' },
    ],
    defaultStroke: '#57534e',
  },
  {
    id: 'grad-metal-v',
    value: 'preset:grad-metal-v',
    label: 'Carcaça Metálica / D-Sub DB9',
    shortLabel: 'Metal DB',
    cssGradient: 'linear-gradient(180deg, #d4d4d8 0%, #a1a1aa 50%, #71717a 100%)',
    direction: 'vertical',
    stops: [
      { offset: '0%', color: '#d4d4d8' },
      { offset: '50%', color: '#a1a1aa' },
      { offset: '100%', color: '#71717a' },
    ],
    defaultStroke: '#52525b',
  },
  {
    id: 'grad-metal-h',
    value: 'preset:grad-metal-h',
    label: 'Alumínio Escovado',
    shortLabel: 'Alumínio',
    cssGradient: 'linear-gradient(90deg, #cbd5e1 0%, #f8fafc 48%, #94a3b8 100%)',
    direction: 'horizontal',
    stops: [
      { offset: '0%', color: '#cbd5e1' },
      { offset: '48%', color: '#f8fafc' },
      { offset: '100%', color: '#94a3b8' },
    ],
    defaultStroke: '#475569',
  },
  {
    id: 'grad-dark-v',
    value: 'preset:grad-dark-v',
    label: 'Chassi Industrial Escuro',
    shortLabel: 'Grafite',
    cssGradient: 'linear-gradient(180deg, #475569 0%, #1e293b 55%, #0f172a 100%)',
    direction: 'vertical',
    stops: [
      { offset: '0%', color: '#475569' },
      { offset: '55%', color: '#1e293b' },
      { offset: '100%', color: '#0f172a' },
    ],
    defaultStroke: '#64748b',
  },
  {
    id: 'grad-copper-v',
    value: 'preset:grad-copper-v',
    label: 'Cobre / Latão Metálico',
    shortLabel: 'Latão',
    cssGradient: 'linear-gradient(180deg, #fde68a 0%, #d97706 55%, #92400e 100%)',
    direction: 'vertical',
    stops: [
      { offset: '0%', color: '#fde68a' },
      { offset: '55%', color: '#d97706' },
      { offset: '100%', color: '#92400e' },
    ],
    defaultStroke: '#78350f',
  },
  {
    id: 'grad-amber-v',
    value: 'preset:grad-amber-v',
    label: 'Amarelo Industrial',
    shortLabel: 'Amarelo',
    cssGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #ca8a04 100%)',
    direction: 'vertical',
    stops: [
      { offset: '0%', color: '#fef08a' },
      { offset: '50%', color: '#facc15' },
      { offset: '100%', color: '#ca8a04' },
    ],
    defaultStroke: '#854d0e',
  },
  {
    id: 'grad-blue-v',
    value: 'preset:grad-blue-v',
    label: 'Azul CLP / Módulo',
    shortLabel: 'Azul CLP',
    cssGradient: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 52%, #0c4a6e 100%)',
    direction: 'vertical',
    stops: [
      { offset: '0%', color: '#38bdf8' },
      { offset: '52%', color: '#0284c7' },
      { offset: '100%', color: '#0c4a6e' },
    ],
    defaultStroke: '#075985',
  },
];

export const resolveComponentFill = (fill: string, uid: string): string => {
  if (fill.startsWith('preset:')) {
    const presetId = fill.slice('preset:'.length);
    return `url(#${uid}-${presetId})`;
  }
  return fill;
};

export const buildComponentPathD = (
  points: { x: number; y: number }[]
): string => {
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

export interface ShapeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getShapeBounds = (shape: ComponentShape): ShapeBounds => {
  switch (shape.kind) {
    case 'rect':
    case 'badge':
    case 'threads': {
      const pad = shape.kind === 'rect' && shape.stroke !== 'none' ? shape.strokeWidth / 2 : 1;
      return {
        minX: shape.x - pad,
        minY: shape.y - pad,
        maxX: shape.x + shape.width + pad,
        maxY: shape.y + shape.height + pad,
      };
    }
    case 'ellipse': {
      const pad = shape.stroke !== 'none' ? shape.strokeWidth / 2 : 0;
      return {
        minX: shape.cx - shape.rx - pad,
        minY: shape.cy - shape.ry - pad,
        maxX: shape.cx + shape.rx + pad,
        maxY: shape.cy + shape.ry + pad,
      };
    }
    case 'screw':
    case 'led':
      return {
        minX: shape.cx - shape.radius - 2,
        minY: shape.cy - shape.radius - 2,
        maxX: shape.cx + shape.radius + 2,
        maxY: shape.cy + shape.radius + 2,
      };
    case 'line': {
      const pad = shape.strokeWidth / 2;
      return {
        minX: Math.min(shape.x1, shape.x2) - pad,
        minY: Math.min(shape.y1, shape.y2) - pad,
        maxX: Math.max(shape.x1, shape.x2) + pad,
        maxY: Math.max(shape.y1, shape.y2) + pad,
      };
    }
    case 'path': {
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
        return { minX: 0, minY: 0, maxX: COMPONENT_CANVAS_WIDTH, maxY: COMPONENT_CANVAS_HEIGHT };
      }
      return { minX, minY, maxX, maxY };
    }
  }
};

export const computeComponentBounds = (
  shapes: ComponentShape[]
): ShapeBounds => {
  if (shapes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: COMPONENT_CANVAS_WIDTH,
      maxY: COMPONENT_CANVAS_HEIGHT,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    const b = getShapeBounds(shape);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  if (!Number.isFinite(minX)) {
    return {
      minX: 0,
      minY: 0,
      maxX: COMPONENT_CANVAS_WIDTH,
      maxY: COMPONENT_CANVAS_HEIGHT,
    };
  }
  return { minX, minY, maxX, maxY };
};

export const moveComponentShape = (
  shape: ComponentShape,
  dx: number,
  dy: number
): ComponentShape => {
  const round = (v: number) => Math.round(v * 10) / 10;
  switch (shape.kind) {
    case 'rect':
    case 'badge':
    case 'threads':
      return {
        ...shape,
        x: round(shape.x + dx),
        y: round(shape.y + dy),
      };
    case 'ellipse':
    case 'screw':
    case 'led':
      return {
        ...shape,
        cx: round(shape.cx + dx),
        cy: round(shape.cy + dy),
      };
    case 'line':
      return {
        ...shape,
        x1: round(shape.x1 + dx),
        y1: round(shape.y1 + dy),
        x2: round(shape.x2 + dx),
        y2: round(shape.y2 + dy),
      };
    case 'path':
      return {
        ...shape,
        points: shape.points.map((pt) => ({
          x: round(pt.x + dx),
          y: round(pt.y + dy),
        })),
      };
  }
};

export const duplicateComponentShape = (
  shape: ComponentShape,
  newId: string,
  offsetX = 14,
  offsetY = 14
): ComponentShape => {
  const moved = moveComponentShape(shape, offsetX, offsetY);
  return { ...moved, id: newId };
};

export type ComponentResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'start'
  | 'end'
  | 'radius';

export const resizeComponentShape = (
  initialShape: ComponentShape,
  handle: ComponentResizeHandle,
  pt: { x: number; y: number }
): ComponentShape => {
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

  if (initialShape.kind === 'screw') {
    const dist = Math.hypot(pt.x - initialShape.cx, pt.y - initialShape.cy);
    return {
      ...initialShape,
      radius: Math.max(5, Math.min(48, Math.round(dist))),
    };
  }

  if (initialShape.kind === 'led') {
    const dist = Math.hypot(pt.x - initialShape.cx, pt.y - initialShape.cy);
    return {
      ...initialShape,
      radius: Math.max(3, Math.min(32, Math.round(dist))),
    };
  }

  // Caixa delimitadora inicial para rect, threads, badge, ellipse, path
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;

  if (
    initialShape.kind === 'rect' ||
    initialShape.kind === 'threads' ||
    initialShape.kind === 'badge'
  ) {
    left = initialShape.x;
    top = initialShape.y;
    right = initialShape.x + initialShape.width;
    bottom = initialShape.y + initialShape.height;
  } else if (initialShape.kind === 'ellipse') {
    left = initialShape.cx - initialShape.rx;
    right = initialShape.cx + initialShape.rx;
    top = initialShape.cy - initialShape.ry;
    bottom = initialShape.cy + initialShape.ry;
  } else if (initialShape.kind === 'path') {
    const b = getShapeBounds(initialShape);
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

  const minSize = initialShape.kind === 'badge' ? 16 : 6;
  if (nextRight - nextLeft < minSize) {
    if (handle.includes('w')) nextLeft = nextRight - minSize;
    else nextRight = nextLeft + minSize;
  }
  if (nextBottom - nextTop < minSize) {
    if (handle.includes('n')) nextTop = nextBottom - minSize;
    else nextBottom = nextTop + minSize;
  }

  const x = round(Math.max(0, Math.min(COMPONENT_CANVAS_WIDTH - minSize, nextLeft)));
  const y = round(Math.max(0, Math.min(COMPONENT_CANVAS_HEIGHT - minSize, nextTop)));
  const rEdge = round(Math.max(x + minSize, Math.min(COMPONENT_CANVAS_WIDTH, nextRight)));
  const bEdge = round(Math.max(y + minSize, Math.min(COMPONENT_CANVAS_HEIGHT, nextBottom)));
  const width = round(rEdge - x);
  const height = round(bEdge - y);

  if (
    initialShape.kind === 'rect' ||
    initialShape.kind === 'threads' ||
    initialShape.kind === 'badge'
  ) {
    return {
      ...initialShape,
      x,
      y,
      width,
      height,
    };
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

  // path: reescala os pontos proporcionalmente para a nova caixa
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

export const createDistributedPinPositions = (
  count: number,
  side: PinSide
): PinCoordinate[] => {
  const safeCount = Math.max(1, Math.min(24, count));
  return Array.from({ length: safeCount }, (_, idx) => {
    const pct = Math.round((((idx + 1) / (safeCount + 1)) * 76 + 12) * 10) / 10;
    if (side === 'left') return { x: 10, y: pct };
    if (side === 'top') return { x: pct, y: 12 };
    if (side === 'bottom') return { x: pct, y: 88 };
    return { x: 90, y: pct };
  });
};
