import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import {
  ArrowLeft,
  Cable,
  Check,
  Circle,
  Copy,
  Crosshair,
  Eraser,
  Grid,
  Image as ImageIcon,
  Layers,
  Minus as LineIcon,
  MousePointer2,
  Pencil,
  PenTool,
  Redo2,
  RotateCcw,
  Sparkles,
  Square,
  Tag,
  Trash2,
  Undo2,
  Upload,
  Wrench,
  AlignJustify,
  ArrowUpToLine,
  ArrowDownToLine,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import type {
  ComponentShape,
  ConnectorType,
  CustomComponentDrawing,
  PinCoordinate,
  PinSide,
  ViewMode,
} from '../types/diagram';
import { useDiagramStore } from '../store/useDiagramStore';
import {
  COMPONENT_CANVAS_HEIGHT,
  COMPONENT_CANVAS_WIDTH,
  COMPONENT_FILL_PRESETS,
  type ComponentResizeHandle,
  createDistributedPinPositions,
  duplicateComponentShape,
  moveComponentShape,
  resizeComponentShape,
} from '../utils/customComponent';
import {
  ComponentSvgDefs,
  CustomComponentShapes,
} from './CustomComponentSvg';

type DesignerMode = 'draw' | 'image';
type DrawTool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'pencil'
  | 'screw'
  | 'led'
  | 'threads'
  | 'badge'
  | 'pin'
  | 'eraser';

const SOLID_COLOR_SWATCHES = [
  { value: '#0f172a', label: 'Preto / Contorno' },
  { value: '#27272a', label: 'Zinco Escuro' },
  { value: '#52525b', label: 'Grafite' },
  { value: '#cbd5e1', label: 'Prata Metálico' },
  { value: '#e7e5e4', label: 'Pedra / Bege Claro' },
  { value: '#f8fafc', label: 'Branco' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#f59e0b', label: 'Âmbar / Cobre' },
  { value: '#facc15', label: 'Amarelo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#0284c7', label: 'Azul Industrial' },
  { value: '#6366f1', label: 'Índigo' },
  { value: '#92400e', label: 'Marrom (+24V)' },
];

const LED_COLORS = [
  { value: '#34d399', label: 'Verde (Power)' },
  { value: '#facc15', label: 'Âmbar (Output)' },
  { value: '#ef4444', label: 'Vermelho (Falha)' },
  { value: '#38bdf8', label: 'Azul (Status)' },
  { value: '#f8fafc', label: 'Branco' },
];

const BADGE_STYLE_PRESETS = [
  {
    label: 'Inox / Escuro',
    bgColor: '#18181b',
    textColor: '#7dd3fc',
    borderColor: '#71717a',
  },
  {
    label: 'Borneira DIN',
    bgColor: '#44403c',
    textColor: '#f5f5f4',
    borderColor: '#78716c',
  },
  {
    label: 'DB9 Âmbar',
    bgColor: '#27272a',
    textColor: '#fcd34d',
    borderColor: '#52525b',
  },
  {
    label: 'Etiqueta Clara',
    bgColor: '#e7e5e4',
    textColor: '#1c1917',
    borderColor: '#78716c',
  },
  {
    label: 'Fio +24V (BN)',
    bgColor: '#92400e',
    textColor: '#fef3c7',
    borderColor: '#d97706',
  },
  {
    label: 'Fio 0V (BU)',
    bgColor: '#1d4ed8',
    textColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  {
    label: 'Fio OUT (BK)',
    bgColor: '#18181b',
    textColor: '#f4f4f5',
    borderColor: '#52525b',
  },
];

const STROKE_WIDTH_OPTIONS = [1.5, 2.5, 4, 6, 10];
const RADIUS_OPTIONS = [0, 6, 12, 20, 32];

const createShapeId = () =>
  `cshape-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

export const ComponentDesignerTab: React.FC = () => {
  const rawUid = useId();
  const editorUid = `ed-${rawUid.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const previewUid = `pv-${rawUid.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const catalog = useDiagramStore((state) => state.catalog);
  const editingCatalogItemId = useDiagramStore(
    (state) => state.editingCatalogItemId
  );
  const closeComponentDesigner = useDiagramStore(
    (state) => state.closeComponentDesigner
  );
  const addCatalogItem = useDiagramStore((state) => state.addCatalogItem);
  const updateCatalogItem = useDiagramStore((state) => state.updateCatalogItem);

  const editingItem = editingCatalogItemId
    ? catalog.find((item) => item.id === editingCatalogItemId) ?? null
    : null;

  // Modo: Desenho Vetorial (principal) ou Importar PNG (opcional)
  const [designerMode, setDesignerMode] = useState<DesignerMode>(
    editingItem?.imageUrl && !editingItem?.drawing ? 'image' : 'draw'
  );

  // Metadados do componente
  const [label, setLabel] = useState<string>(editingItem?.label ?? '');
  const [partNumber, setPartNumber] = useState<string>(
    editingItem?.partNumber ?? ''
  );
  const [pinCount, setPinCount] = useState<number>(editingItem?.pinCount ?? 4);
  const [type, setType] = useState<ConnectorType>(
    editingItem?.type ?? 'custom'
  );
  const [defaultPinSide, setDefaultPinSide] = useState<PinSide>(
    editingItem?.defaultPinSide ?? 'right'
  );
  const [description, setDescription] = useState<string>(
    editingItem?.description ?? ''
  );

  // Estado do desenho vetorial
  const [shapes, setShapes] = useState<ComponentShape[]>(
    editingItem?.drawing?.shapes ?? []
  );
  const [undoStack, setUndoStack] = useState<ComponentShape[][]>([]);
  const [redoStack, setRedoStack] = useState<ComponentShape[][]>([]);

  // Estado de imagem opcional (modo PNG)
  const [imageUrl, setImageUrl] = useState<string | undefined>(
    editingItem?.imageUrl
  );

  // Posições dos pinos (em % 0..100)
  const [pinPositions, setPinPositions] = useState<PinCoordinate[]>(() =>
    editingItem?.pinPositions && editingItem.pinPositions.length > 0
      ? editingItem.pinPositions
      : createDistributedPinPositions(
          editingItem?.pinCount ?? 4,
          editingItem?.defaultPinSide ?? 'right'
        )
  );
  const [activePinIndex, setActivePinIndex] = useState<number>(0);
  const [showPinsOnCanvas, setShowPinsOnCanvas] = useState<boolean>(true);

  // Ferramentas e opções de desenho
  const [tool, setTool] = useState<DrawTool>('rect');
  const [fillValue, setFillValue] = useState<string>('preset:grad-metal-v');
  const [strokeColor, setStrokeColor] = useState<string>('#52525b');
  const [strokeWidth, setStrokeWidth] = useState<number>(2.5);
  const [fillMode, setFillMode] = useState<'filled' | 'outline'>('filled');
  const [borderEnabled, setBorderEnabled] = useState<boolean>(true);
  const [shadowEnabled, setShadowEnabled] = useState<boolean>(true);
  const [cornerRadius, setCornerRadius] = useState<number>(12);

  // Opções das ferramentas industriais (Parafuso, LED, Rosca, Etiqueta)
  const [screwRadius, setScrewRadius] = useState<number>(11);
  const [screwAngle, setScrewAngle] = useState<number>(45);
  const [ledColor, setLedColor] = useState<string>('#facc15');
  const [ledRadius, setLedRadius] = useState<number>(7);
  const [threadsOrientation, setThreadsOrientation] = useState<
    'vertical' | 'horizontal'
  >('vertical');
  const [threadsCount, setThreadsCount] = useState<number>(10);
  const [badgeText, setBadgeText] = useState<string>('COMPONENTE');
  const [badgeBgColor, setBadgeBgColor] = useState<string>('#18181b');
  const [badgeTextColor, setBadgeTextColor] = useState<string>('#7dd3fc');
  const [badgeBorderColor, setBadgeBorderColor] = useState<string>('#71717a');
  const [badgeFontSize, setBadgeFontSize] = useState<number>(12);

  // Opções do canvas
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [canvasLightBg, setCanvasLightBg] = useState<boolean>(false);

  // Seleção, hover e desenho ativo
  const svgRef = useRef<SVGSVGElement>(null);
  const [draftShape, setDraftShape] = useState<ComponentShape | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const draggingShapeRef = useRef<{
    id: string;
    startPt: { x: number; y: number };
    initialShapes: ComponentShape[];
    moved: boolean;
  } | null>(null);
  const resizingShapeRef = useRef<{
    id: string;
    handle: ComponentResizeHandle;
    initialShape: ComponentShape;
    initialShapes: ComponentShape[];
    resized: boolean;
  } | null>(null);
  const draggingPinRef = useRef<number | null>(null);

  // Pré-visualização à direita
  const [previewMode, setPreviewMode] = useState<ViewMode>('realistic');
  const [previewLightBg, setPreviewLightBg] = useState<boolean>(false);
  const [previewHidePins, setPreviewHidePins] = useState<boolean>(false);

  // Mensagem de validação
  const [validationError, setValidationError] = useState<string | null>(null);

  // Ajusta array de pinos quando pinCount muda
  useEffect(() => {
    const safeCount = Math.max(1, Math.min(24, Number(pinCount) || 1));
    setPinPositions((prev) => {
      if (prev.length === safeCount) return prev;
      if (prev.length > safeCount) return prev.slice(0, safeCount);
      const distributed = createDistributedPinPositions(
        safeCount,
        defaultPinSide
      );
      return [...prev, ...distributed.slice(prev.length)];
    });
    setActivePinIndex((prev) => Math.min(prev, safeCount - 1));
  }, [pinCount, defaultPinSide]);

  const commitShapes = useCallback(
    (nextShapes: ComponentShape[]) => {
      setUndoStack((prev) => [...prev.slice(-39), shapes]);
      setRedoStack([]);
      setShapes(nextShapes);
    },
    [shapes]
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setRedoStack((r) => [...r, shapes]);
      setShapes(previous);
      setSelectedShapeId(null);
      return prev.slice(0, -1);
    });
  }, [shapes]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setUndoStack((u) => [...u, shapes]);
      setShapes(next);
      setSelectedShapeId(null);
      return prev.slice(0, -1);
    });
  }, [shapes]);

  const selectedShape =
    selectedShapeId !== null
      ? shapes.find((s) => s.id === selectedShapeId) ?? null
      : null;

  const updateSelectedShape = useCallback(
    (updater: (shape: ComponentShape) => ComponentShape) => {
      if (!selectedShapeId) return;
      commitShapes(
        shapes.map((s) => (s.id === selectedShapeId ? updater(s) : s))
      );
    },
    [selectedShapeId, shapes, commitShapes]
  );

  // Atalhos Ctrl+Z, Ctrl+Y, Delete/Backspace e Setas (mover fino)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'y'
      ) {
        event.preventDefault();
        handleRedo();
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedShapeId &&
        tool === 'select'
      ) {
        event.preventDefault();
        commitShapes(shapes.filter((s) => s.id !== selectedShapeId));
        setSelectedShapeId(null);
      } else if (
        selectedShapeId &&
        tool === 'select' &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 8 : 1;
        const dx =
          event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy =
          event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        commitShapes(
          shapes.map((s) =>
            s.id === selectedShapeId ? moveComponentShape(s, dx, dy) : s
          )
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, selectedShapeId, tool, shapes, commitShapes]);

  const getSvgCoords = (
    event: React.PointerEvent<Element>
  ): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    let x = ((event.clientX - rect.left) / rect.width) * COMPONENT_CANVAS_WIDTH;
    let y = ((event.clientY - rect.top) / rect.height) * COMPONENT_CANVAS_HEIGHT;
    x = Math.max(2, Math.min(COMPONENT_CANVAS_WIDTH - 2, x));
    y = Math.max(2, Math.min(COMPONENT_CANVAS_HEIGHT - 2, y));
    if (snapToGrid) {
      x = Math.round(x / 8) * 8;
      y = Math.round(y / 8) * 8;
    } else {
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
    }
    return { x, y };
  };

  const toPinPercent = (pt: { x: number; y: number }): PinCoordinate => ({
    x:
      Math.round(
        Math.max(2, Math.min(98, (pt.x / COMPONENT_CANVAS_WIDTH) * 100)) * 10
      ) / 10,
    y:
      Math.round(
        Math.max(2, Math.min(98, (pt.y / COMPONENT_CANVAS_HEIGHT) * 100)) * 10
      ) / 10,
  });

  const handleSelectColorOrMaterial = (
    nextValue: string,
    suggestedStroke?: string
  ) => {
    setFillValue(nextValue);
    if (suggestedStroke) {
      setStrokeColor(suggestedStroke);
    }

    // Se estiver com um elemento selecionado, aplica diretamente nele também
    if (tool === 'select' && selectedShape) {
      if (selectedShape.kind === 'rect' || selectedShape.kind === 'ellipse') {
        updateSelectedShape((s) =>
          s.kind === 'rect' || s.kind === 'ellipse'
            ? {
                ...s,
                fill: s.fill === 'none' ? 'none' : nextValue,
                stroke:
                  s.fill === 'none' && !nextValue.startsWith('preset:')
                    ? nextValue
                    : suggestedStroke && s.stroke !== 'none'
                    ? suggestedStroke
                    : s.stroke,
              }
            : s
        );
      } else if (
        (selectedShape.kind === 'line' || selectedShape.kind === 'path') &&
        !nextValue.startsWith('preset:')
      ) {
        updateSelectedShape((s) =>
          s.kind === 'line' || s.kind === 'path'
            ? { ...s, stroke: nextValue }
            : s
        );
      } else if (
        selectedShape.kind === 'led' &&
        !nextValue.startsWith('preset:')
      ) {
        updateSelectedShape((s) =>
          s.kind === 'led' ? { ...s, color: nextValue } : s
        );
      }
    }
  };

  const handleShapePointerDown = (
    shapeId: string,
    event: React.PointerEvent<SVGElement>
  ) => {
    if (tool !== 'select' || event.button !== 0) return;
    setSelectedShapeId(shapeId);
    const svg = svgRef.current;
    if (svg) {
      svg.setPointerCapture(event.pointerId);
    }
    const pt = getSvgCoords(event);
    draggingShapeRef.current = {
      id: shapeId,
      startPt: pt,
      initialShapes: shapes,
      moved: false,
    };
  };

  const handleResizePointerDown = (
    shapeId: string,
    handle: ComponentResizeHandle,
    event: React.PointerEvent<SVGElement>
  ) => {
    if (tool !== 'select' || event.button !== 0) return;
    const targetShape = shapes.find((s) => s.id === shapeId);
    if (!targetShape) return;
    setSelectedShapeId(shapeId);
    const svg = svgRef.current;
    if (svg) {
      svg.setPointerCapture(event.pointerId);
    }
    resizingShapeRef.current = {
      id: shapeId,
      handle,
      initialShape: targetShape,
      initialShapes: shapes,
      resized: false,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    if (tool === 'eraser') return;

    const pt = getSvgCoords(event);

    if (tool === 'select') {
      // Clicou fora das formas -> limpa seleção
      setSelectedShapeId(null);
      return;
    }

    if (tool === 'pin') {
      const safeCount = Math.max(1, Math.min(24, Number(pinCount) || 1));
      const nextCoord = toPinPercent(pt);
      setPinPositions((prev) => {
        const next = [...prev];
        next[activePinIndex] = nextCoord;
        return next;
      });
      setActivePinIndex((prev) => (prev + 1) % safeCount);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    startPointRef.current = pt;
    setIsDrawing(true);

    const id = createShapeId();
    const effectiveLineColor = fillValue.startsWith('preset:')
      ? strokeColor
      : fillValue;

    if (tool === 'pencil') {
      setDraftShape({
        id,
        kind: 'path',
        points: [pt],
        stroke: effectiveLineColor,
        strokeWidth,
      });
    } else if (tool === 'line') {
      setDraftShape({
        id,
        kind: 'line',
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
        stroke: effectiveLineColor,
        strokeWidth,
      });
    } else if (tool === 'rect') {
      setDraftShape({
        id,
        kind: 'rect',
        x: pt.x,
        y: pt.y,
        width: 1,
        height: 1,
        rx: cornerRadius,
        fill: fillMode === 'filled' ? fillValue : 'none',
        stroke:
          fillMode === 'outline'
            ? effectiveLineColor
            : borderEnabled
            ? strokeColor
            : 'none',
        strokeWidth: fillMode === 'outline' ? strokeWidth : Math.max(2, strokeWidth),
        shadow: shadowEnabled,
      });
    } else if (tool === 'ellipse') {
      setDraftShape({
        id,
        kind: 'ellipse',
        cx: pt.x,
        cy: pt.y,
        rx: 1,
        ry: 1,
        fill: fillMode === 'filled' ? fillValue : 'none',
        stroke:
          fillMode === 'outline'
            ? effectiveLineColor
            : borderEnabled
            ? strokeColor
            : 'none',
        strokeWidth: fillMode === 'outline' ? strokeWidth : Math.max(2, strokeWidth),
        shadow: shadowEnabled,
      });
    } else if (tool === 'screw') {
      setDraftShape({
        id,
        kind: 'screw',
        cx: pt.x,
        cy: pt.y,
        radius: screwRadius,
        angle: screwAngle,
      });
    } else if (tool === 'led') {
      setDraftShape({
        id,
        kind: 'led',
        cx: pt.x,
        cy: pt.y,
        radius: ledRadius,
        color: ledColor,
      });
    } else if (tool === 'threads') {
      setDraftShape({
        id,
        kind: 'threads',
        x: pt.x,
        y: pt.y,
        width: 1,
        height: 1,
        count: threadsCount,
        orientation: threadsOrientation,
        opacity: 0.28,
      });
    } else if (tool === 'badge') {
      const cleanText = badgeText.trim() || 'ETIQUETA';
      const defaultW = Math.max(64, Math.round(cleanText.length * (badgeFontSize * 0.68) + 20));
      const defaultH = Math.max(24, Math.round(badgeFontSize + 14));
      setDraftShape({
        id,
        kind: 'badge',
        x: Math.round((pt.x - defaultW / 2) * 10) / 10,
        y: Math.round((pt.y - defaultH / 2) * 10) / 10,
        width: defaultW,
        height: defaultH,
        rx: 5,
        text: cleanText,
        bgColor: badgeBgColor,
        textColor: badgeTextColor,
        borderColor: badgeBorderColor,
        fontSize: badgeFontSize,
      });
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    // Arrastando pino diretamente no canvas
    if (draggingPinRef.current !== null) {
      const pt = getSvgCoords(event);
      const nextCoord = toPinPercent(pt);
      const idx = draggingPinRef.current;
      setPinPositions((prev) => {
        const next = [...prev];
        next[idx] = nextCoord;
        return next;
      });
      return;
    }

    // Redimensionando/ajustando alça da forma selecionada
    if (resizingShapeRef.current) {
      const pt = getSvgCoords(event);
      resizingShapeRef.current.resized = true;
      const { id, handle, initialShape, initialShapes } =
        resizingShapeRef.current;
      const updated = resizeComponentShape(initialShape, handle, pt);
      setShapes(initialShapes.map((s) => (s.id === id ? updated : s)));
      return;
    }

    // Arrastando forma selecionada
    if (draggingShapeRef.current) {
      const pt = getSvgCoords(event);
      const dx = pt.x - draggingShapeRef.current.startPt.x;
      const dy = pt.y - draggingShapeRef.current.startPt.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        draggingShapeRef.current.moved = true;
      }
      const dragId = draggingShapeRef.current.id;
      setShapes(
        draggingShapeRef.current.initialShapes.map((s) =>
          s.id === dragId ? moveComponentShape(s, dx, dy) : s
        )
      );
      return;
    }

    if (!isDrawing || !draftShape || !startPointRef.current) return;
    const pt = getSvgCoords(event);
    const start = startPointRef.current;

    if (draftShape.kind === 'path') {
      const last = draftShape.points[draftShape.points.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.8) return;
      setDraftShape({
        ...draftShape,
        points: [...draftShape.points, pt],
      });
    } else if (draftShape.kind === 'line') {
      setDraftShape({
        ...draftShape,
        x2: pt.x,
        y2: pt.y,
      });
    } else if (draftShape.kind === 'rect' || draftShape.kind === 'threads') {
      const x = Math.min(start.x, pt.x);
      const y = Math.min(start.y, pt.y);
      const width = Math.abs(pt.x - start.x);
      const height = Math.abs(pt.y - start.y);
      setDraftShape({
        ...draftShape,
        x,
        y,
        width,
        height,
      });
    } else if (draftShape.kind === 'ellipse') {
      const cx = (start.x + pt.x) / 2;
      const cy = (start.y + pt.y) / 2;
      const rx = Math.abs(pt.x - start.x) / 2;
      const ry = Math.abs(pt.y - start.y) / 2;
      setDraftShape({
        ...draftShape,
        cx: Math.round(cx * 10) / 10,
        cy: Math.round(cy * 10) / 10,
        rx: Math.round(rx * 10) / 10,
        ry: Math.round(ry * 10) / 10,
      });
    } else if (draftShape.kind === 'screw') {
      const dist = Math.hypot(pt.x - start.x, pt.y - start.y);
      if (dist > 4) {
        setDraftShape({
          ...draftShape,
          radius: Math.max(6, Math.min(28, Math.round(dist))),
        });
      }
    } else if (draftShape.kind === 'led') {
      const dist = Math.hypot(pt.x - start.x, pt.y - start.y);
      if (dist > 4) {
        setDraftShape({
          ...draftShape,
          radius: Math.max(4, Math.min(20, Math.round(dist))),
        });
      }
    } else if (draftShape.kind === 'badge') {
      const dist = Math.hypot(pt.x - start.x, pt.y - start.y);
      if (dist > 10) {
        const x = Math.min(start.x, pt.x);
        const y = Math.min(start.y, pt.y);
        const width = Math.max(40, Math.abs(pt.x - start.x));
        const height = Math.max(20, Math.abs(pt.y - start.y));
        setDraftShape({
          ...draftShape,
          x,
          y,
          width,
          height,
        });
      }
    }
  };

  const finishInteraction = () => {
    if (draggingPinRef.current !== null) {
      draggingPinRef.current = null;
      return;
    }

    if (resizingShapeRef.current) {
      const { initialShapes, resized } = resizingShapeRef.current;
      resizingShapeRef.current = null;
      if (resized) {
        setUndoStack((prev) => [...prev.slice(-39), initialShapes]);
        setRedoStack([]);
      }
      return;
    }

    if (draggingShapeRef.current) {
      const { initialShapes, moved } = draggingShapeRef.current;
      draggingShapeRef.current = null;
      if (moved) {
        setUndoStack((prev) => [...prev.slice(-39), initialShapes]);
        setRedoStack([]);
      }
      return;
    }

    if (!isDrawing || !draftShape) {
      setIsDrawing(false);
      setDraftShape(null);
      return;
    }

    let valid = true;
    if (draftShape.kind === 'rect' || draftShape.kind === 'threads') {
      valid = draftShape.width >= 4 && draftShape.height >= 4;
    } else if (draftShape.kind === 'ellipse') {
      valid = draftShape.rx >= 3 || draftShape.ry >= 3;
    } else if (draftShape.kind === 'line') {
      valid =
        Math.hypot(
          draftShape.x2 - draftShape.x1,
          draftShape.y2 - draftShape.y1
        ) >= 3;
    }

    if (valid) {
      commitShapes([...shapes, draftShape]);
      setValidationError(null);
    }

    setIsDrawing(false);
    setDraftShape(null);
    startPointRef.current = null;
  };

  const handleEraseShape = (shapeId: string) => {
    commitShapes(shapes.filter((s) => s.id !== shapeId));
    if (selectedShapeId === shapeId) setSelectedShapeId(null);
    setHoveredShapeId(null);
  };

  const handleDuplicateSelected = () => {
    if (!selectedShape) return;
    const newId = createShapeId();
    const copy = duplicateComponentShape(selectedShape, newId, 16, 16);
    commitShapes([...shapes, copy]);
    setSelectedShapeId(newId);
  };

  const handleBringForward = () => {
    if (!selectedShapeId) return;
    const idx = shapes.findIndex((s) => s.id === selectedShapeId);
    if (idx < 0 || idx === shapes.length - 1) return;
    const next = [...shapes];
    const [item] = next.splice(idx, 1);
    next.push(item);
    commitShapes(next);
  };

  const handleSendBackward = () => {
    if (!selectedShapeId) return;
    const idx = shapes.findIndex((s) => s.id === selectedShapeId);
    if (idx <= 0) return;
    const next = [...shapes];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    commitShapes(next);
  };

  const handleDeleteSelected = () => {
    if (!selectedShapeId) return;
    commitShapes(shapes.filter((s) => s.id !== selectedShapeId));
    setSelectedShapeId(null);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setActivePinIndex(0);
        setValidationError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x =
      Math.round(
        Math.max(
          2,
          Math.min(98, ((event.clientX - rect.left) / rect.width) * 100)
        ) * 10
      ) / 10;
    const y =
      Math.round(
        Math.max(
          2,
          Math.min(98, ((event.clientY - rect.top) / rect.height) * 100)
        ) * 10
      ) / 10;
    const safeCount = Math.max(1, Math.min(24, Number(pinCount) || 1));
    setPinPositions((prev) => {
      const next = [...prev];
      next[activePinIndex] = { x, y };
      return next;
    });
    setActivePinIndex((prev) => (prev + 1) % safeCount);
  };

  const liveShapes = draftShape ? [...shapes, draftShape] : shapes;
  const liveDrawing: CustomComponentDrawing = {
    canvasWidth: COMPONENT_CANVAS_WIDTH,
    canvasHeight: COMPONENT_CANVAS_HEIGHT,
    shapes: liveShapes,
  };

  const handleSave = () => {
    const trimmedLabel = label.trim();
    const trimmedPN = partNumber.trim().toUpperCase();

    if (!trimmedLabel) {
      setValidationError('Informe o Nome da Peça / Conector.');
      return;
    }
    if (!trimmedPN) {
      setValidationError('Informe o Part Number (PN) do componente.');
      return;
    }
    if (designerMode === 'draw' && shapes.length === 0) {
      setValidationError(
        'Desenhe pelo menos um elemento no canvas antes de salvar o componente.'
      );
      return;
    }
    if (designerMode === 'image' && !imageUrl) {
      setValidationError(
        'Selecione uma imagem (PNG/SVG/JPG) ou mude para a aba Desenhar.'
      );
      return;
    }

    const safeCount = Math.max(1, Math.min(24, Number(pinCount) || 1));
    const finalPins = pinPositions.slice(0, safeCount);

    const payload = {
      label: trimmedLabel,
      partNumber: trimmedPN,
      pinCount: safeCount,
      type,
      defaultPinSide,
      description:
        description.trim() ||
        `Componente desenhado ${safeCount} pinos (${trimmedPN})`,
      imageUrl: designerMode === 'image' ? imageUrl : undefined,
      drawing:
        designerMode === 'draw'
          ? {
              canvasWidth: COMPONENT_CANVAS_WIDTH,
              canvasHeight: COMPONENT_CANVAS_HEIGHT,
              shapes,
            }
          : undefined,
      pinPositions: finalPins,
    };

    if (editingItem) {
      updateCatalogItem(editingItem.id, payload);
    } else {
      addCatalogItem(payload);
    }

    closeComponentDesigner();
  };

  const canSave =
    label.trim().length > 0 &&
    partNumber.trim().length > 0 &&
    (designerMode === 'draw' ? shapes.length > 0 : Boolean(imageUrl));

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Barra Superior */}
      <header className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-sm uppercase tracking-wider shrink-0">
            <Cable className="w-5 h-5" />
            <span className="hidden sm:inline">ConectaCab</span>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={closeComponentDesigner}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Diagrama</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-sky-600/20 text-sky-300 border border-sky-500/50 shadow-sm">
              <PenTool className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {editingItem ? 'Editar Componente' : 'Novo Componente'}
              </span>
            </div>
          </nav>

          {/* Alternador Desenhar vs Importar PNG */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setDesignerMode('draw')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                designerMode === 'draw'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenTool className="w-3 h-3" />
              <span>Desenhar</span>
            </button>
            <button
              type="button"
              onClick={() => setDesignerMode('image')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                designerMode === 'image'
                  ? 'bg-sky-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Importar PNG</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={closeComponentDesigner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancelar</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white border text-xs font-bold shadow-md transition-colors cursor-pointer ${
              canSave
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50'
                : 'bg-emerald-800/60 hover:bg-emerald-700/70 border-emerald-700/60 text-emerald-100/80'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {editingItem ? 'Atualizar Componente' : 'Salvar no Catálogo'}
            </span>
          </button>
        </div>
      </header>

      {/* Banner de validação se tentar salvar sem preencher campos obrigatórios */}
      {validationError && (
        <div className="px-4 py-2 bg-rose-950/90 border-b border-rose-500/60 text-rose-200 text-xs flex items-center justify-between shrink-0">
          <span className="font-semibold">{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Corpo Principal: Área de Desenho (esquerda) + Propriedades & Preview (direita) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* COLUNA ESQUERDA: EDITOR */}
        <section className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto min-w-0">
          {designerMode === 'draw' ? (
            <>
              {/* Barra 1: Ferramentas de Desenho + Peças Industriais + Ações */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      {
                        id: 'select' as const,
                        label: 'Mover / Ajustar',
                        icon: <MousePointer2 className="w-3.5 h-3.5" />,
                        tip: 'Selecionar, mover, redimensionar pelas alças, editar cor/texto ou duplicar',
                      },
                      {
                        id: 'rect' as const,
                        label: 'Corpo',
                        icon: <Square className="w-3.5 h-3.5" />,
                        tip: 'Retângulo / Chassi industrial com gradiente e bordas arredondadas',
                      },
                      {
                        id: 'ellipse' as const,
                        label: 'Círculo',
                        icon: <Circle className="w-3.5 h-3.5" />,
                        tip: 'Círculo ou elipse (furos, conectores redondos, alojamentos)',
                      },
                      {
                        id: 'line' as const,
                        label: 'Linha',
                        icon: <LineIcon className="w-3.5 h-3.5" />,
                        tip: 'Linha reta (divisórias de borneira, detalhes)',
                      },
                      {
                        id: 'pencil' as const,
                        label: 'Lápis',
                        icon: <Pencil className="w-3.5 h-3.5" />,
                        tip: 'Traço livre à mão',
                      },
                    ]
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTool(item.id);
                        if (item.id !== 'select') setSelectedShapeId(null);
                      }}
                      title={item.tip}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        tool === item.id
                          ? 'bg-sky-600 text-white border-sky-400 shadow'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  {/* Ferramentas de Detalhes Industriais (mesmo visual dos pré-renderizados) */}
                  {(
                    [
                      {
                        id: 'screw' as const,
                        label: 'Parafuso',
                        icon: <Wrench className="w-3.5 h-3.5" />,
                        tip: 'Inserir parafuso metálico com fenda (estilo Borneira DIN)',
                      },
                      {
                        id: 'led' as const,
                        label: 'LED',
                        icon: <Sparkles className="w-3.5 h-3.5" />,
                        tip: 'Inserir LED indicador com brilho (estilo Sensor M12)',
                      },
                      {
                        id: 'threads' as const,
                        label: 'Rosca',
                        icon: <AlignJustify className="w-3.5 h-3.5" />,
                        tip: 'Arraste para criar ranhuras/roscas metálicas (estilo Sensor M12)',
                      },
                      {
                        id: 'badge' as const,
                        label: 'Etiqueta',
                        icon: <Tag className="w-3.5 h-3.5" />,
                        tip: 'Inserir plaqueta industrial com texto (ex: M12x1 INOX, X1:1, DB9)',
                      },
                    ]
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTool(item.id);
                        setSelectedShapeId(null);
                      }}
                      title={item.tip}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        tool === item.id
                          ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-amber-200/90 border-slate-700'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setTool('pin');
                      setShowPinsOnCanvas(true);
                      setSelectedShapeId(null);
                    }}
                    title="Clique no desenho para posicionar os pinos conectáveis (P1, P2...)"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      tool === 'pin'
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-emerald-300 border-slate-700'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Pinos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTool('eraser');
                      setSelectedShapeId(null);
                    }}
                    title="Clique em qualquer elemento desenhado para apagar"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      tool === 'eraser'
                        ? 'bg-rose-600 text-white border-rose-400 shadow'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Borracha</span>
                  </button>
                </div>

                {/* Auxiliares e Histórico */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowGrid((prev) => !prev)}
                    title="Mostrar ou ocultar grade"
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      showGrid
                        ? 'bg-slate-800 text-sky-300 border-sky-500/50'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Grade</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSnapToGrid((prev) => !prev)}
                    title="Alinhar traços à grade (8px)"
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                      snapToGrid
                        ? 'bg-sky-600/25 text-sky-300 border-sky-500/60'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    Snap
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPinsOnCanvas((prev) => !prev)}
                    title="Mostrar ou ocultar marcadores de pinos sobre o desenho"
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      showPinsOnCanvas
                        ? 'bg-slate-800 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {showPinsOnCanvas ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    <span>Pinos</span>
                  </button>

                  <div className="w-px h-5 bg-slate-800 mx-0.5" />

                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    title="Desfazer (Ctrl+Z)"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 border border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    title="Refazer (Ctrl+Y)"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 border border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (shapes.length > 0) {
                        commitShapes([]);
                        setSelectedShapeId(null);
                      }
                    }}
                    disabled={shapes.length === 0}
                    title="Limpar todo o desenho"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 disabled:opacity-35 text-rose-200 border border-rose-800/60 text-[11px] font-semibold cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar</span>
                  </button>
                </div>
              </div>

              {/* Barra 2: Materiais Industriais (Gradientes) e Cores Sólidas */}
              <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Acabamentos Industriais com Gradiente */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 mr-1">
                      Acabamentos:
                    </span>
                    {COMPONENT_FILL_PRESETS.map((preset) => {
                      const isSelected = fillValue === preset.value;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            handleSelectColorOrMaterial(
                              preset.value,
                              preset.defaultStroke
                            )
                          }
                          title={preset.label}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-800 border-sky-400 text-white ring-1 ring-sky-400/50'
                              : 'bg-slate-950/70 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded border border-white/30 shrink-0"
                            style={{ background: preset.cssGradient }}
                          />
                          <span>{preset.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cores Sólidas + Opções Contextuais da Ferramenta */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                      Cores:
                    </span>
                    {SOLID_COLOR_SWATCHES.map((swatch) => {
                      const isSelected = fillValue === swatch.value;
                      return (
                        <button
                          key={swatch.value}
                          type="button"
                          onClick={() =>
                            handleSelectColorOrMaterial(swatch.value)
                          }
                          title={swatch.label}
                          className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                            isSelected
                              ? 'border-sky-400 scale-115 ring-2 ring-sky-400/40'
                              : 'border-white/30 hover:scale-110'
                          }`}
                          style={{ backgroundColor: swatch.value }}
                        />
                      );
                    })}
                    <label
                      title="Cor personalizada"
                      className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300 cursor-pointer hover:border-sky-500"
                    >
                      <input
                        type="color"
                        value={
                          fillValue.startsWith('preset:')
                            ? '#a1a1aa'
                            : fillValue
                        }
                        onChange={(e) =>
                          handleSelectColorOrMaterial(e.target.value)
                        }
                        className="w-4 h-4 bg-transparent border-0 cursor-pointer p-0"
                      />
                      <span>Outra</span>
                    </label>
                  </div>

                  {/* Controles específicos de cada ferramenta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(tool === 'rect' || tool === 'ellipse') && (
                      <>
                        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setFillMode('filled')}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                              fillMode === 'filled'
                                ? 'bg-sky-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Preenchido
                          </button>
                          <button
                            type="button"
                            onClick={() => setFillMode('outline')}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                              fillMode === 'outline'
                                ? 'bg-sky-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Vazado
                          </button>
                        </div>

                        {fillMode === 'filled' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setBorderEnabled((v) => !v)}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                                borderEnabled
                                  ? 'bg-slate-800 text-amber-300 border-amber-500/50'
                                  : 'bg-slate-950 text-slate-500 border-slate-800'
                              }`}
                            >
                              Borda
                            </button>
                            <button
                              type="button"
                              onClick={() => setShadowEnabled((v) => !v)}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                                shadowEnabled
                                  ? 'bg-slate-800 text-sky-300 border-sky-500/50'
                                  : 'bg-slate-950 text-slate-500 border-slate-800'
                              }`}
                            >
                              Sombra 3D
                            </button>
                          </>
                        )}

                        {tool === 'rect' && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-semibold">
                              Cantos:
                            </span>
                            {RADIUS_OPTIONS.map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setCornerRadius(r)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                                  cornerRadius === r
                                    ? 'bg-sky-600/30 border-sky-400 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {(tool === 'line' ||
                      tool === 'pencil' ||
                      tool === 'rect' ||
                      tool === 'ellipse') && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Traço:
                        </span>
                        {STROKE_WIDTH_OPTIONS.map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setStrokeWidth(w)}
                            title={`Espessura ${w}px`}
                            className={`w-6 h-6 rounded border flex items-center justify-center cursor-pointer ${
                              strokeWidth === w
                                ? 'bg-sky-600/30 border-sky-400 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            <span
                              className="rounded-full bg-current block"
                              style={{
                                width: Math.min(12, Math.max(3, w)),
                                height: Math.min(12, Math.max(3, w)),
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {tool === 'screw' && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400 font-semibold">
                          Tamanho:
                        </span>
                        {[8, 11, 15, 20].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setScrewRadius(r)}
                            className={`px-2 py-0.5 rounded font-mono border cursor-pointer ${
                              screwRadius === r
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {r}px
                          </button>
                        ))}
                        <span className="text-slate-400 font-semibold ml-1">
                          Fenda:
                        </span>
                        {[0, 45, 90, 135].map((ang) => (
                          <button
                            key={ang}
                            type="button"
                            onClick={() => setScrewAngle(ang)}
                            className={`px-2 py-0.5 rounded font-mono border cursor-pointer ${
                              screwAngle === ang
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {ang}°
                          </button>
                        ))}
                      </div>
                    )}

                    {tool === 'led' && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400 font-semibold">
                          Cor LED:
                        </span>
                        {LED_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setLedColor(c.value)}
                            title={c.label}
                            className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                              ledColor === c.value
                                ? 'border-white scale-115 ring-2 ring-amber-400'
                                : 'border-slate-600'
                            }`}
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                        <span className="text-slate-400 font-semibold ml-1">
                          Raio:
                        </span>
                        {[5, 7, 10, 13].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setLedRadius(r)}
                            className={`px-2 py-0.5 rounded font-mono border cursor-pointer ${
                              ledRadius === r
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}

                    {tool === 'threads' && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400 font-semibold">
                          Direção:
                        </span>
                        <button
                          type="button"
                          onClick={() => setThreadsOrientation('vertical')}
                          className={`px-2 py-0.5 rounded border cursor-pointer ${
                            threadsOrientation === 'vertical'
                              ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          Vertical
                        </button>
                        <button
                          type="button"
                          onClick={() => setThreadsOrientation('horizontal')}
                          className={`px-2 py-0.5 rounded border cursor-pointer ${
                            threadsOrientation === 'horizontal'
                              ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          Horizontal
                        </button>
                        <span className="text-slate-400 font-semibold ml-1">
                          Filetes:
                        </span>
                        {[6, 10, 14, 18].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setThreadsCount(n)}
                            className={`px-2 py-0.5 rounded font-mono border cursor-pointer ${
                              threadsCount === n
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}

                    {tool === 'badge' && (
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        <input
                          type="text"
                          value={badgeText}
                          onChange={(e) => setBadgeText(e.target.value)}
                          placeholder="Texto da placa (ex: M12x1 INOX)"
                          className="w-44 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-amber-400"
                        />
                        <div className="flex items-center gap-1 flex-wrap">
                          {BADGE_STYLE_PRESETS.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => {
                                setBadgeBgColor(p.bgColor);
                                setBadgeTextColor(p.textColor);
                                setBadgeBorderColor(p.borderColor);
                              }}
                              title={p.label}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer"
                              style={{
                                backgroundColor: p.bgColor,
                                color: p.textColor,
                                borderColor: p.borderColor,
                              }}
                            >
                              {p.label.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">
                            Fonte:
                          </span>
                          {[10, 12, 14, 16].map((fs) => (
                            <button
                              key={fs}
                              type="button"
                              onClick={() => setBadgeFontSize(fs)}
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                                badgeFontSize === fs
                                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {fs}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra contextual quando um elemento está selecionado na ferramenta Mover / Ajustar */}
                {tool === 'select' && selectedShape && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-500/30 text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono font-bold uppercase text-[10px]">
                        Ajustando: {selectedShape.kind}
                      </span>

                      {(selectedShape.kind === 'rect' ||
                        selectedShape.kind === 'threads' ||
                        selectedShape.kind === 'badge') && (
                        <div className="flex items-center gap-1.5">
                          <label className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>L</span>
                            <input
                              type="number"
                              min={8}
                              max={316}
                              value={Math.round(selectedShape.width)}
                              onChange={(e) => {
                                const w = Math.max(8, Math.min(316, Number(e.target.value) || 8));
                                updateSelectedShape((s) =>
                                  s.kind === 'rect' || s.kind === 'threads' || s.kind === 'badge'
                                    ? { ...s, width: w }
                                    : s
                                );
                              }}
                              className="w-12 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-[10px]"
                            />
                          </label>
                          <label className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>A</span>
                            <input
                              type="number"
                              min={8}
                              max={316}
                              value={Math.round(selectedShape.height)}
                              onChange={(e) => {
                                const h = Math.max(8, Math.min(316, Number(e.target.value) || 8));
                                updateSelectedShape((s) =>
                                  s.kind === 'rect' || s.kind === 'threads' || s.kind === 'badge'
                                    ? { ...s, height: h }
                                    : s
                                );
                              }}
                              className="w-12 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-[10px]"
                            />
                          </label>
                        </div>
                      )}

                      {selectedShape.kind === 'ellipse' && (
                        <div className="flex items-center gap-1.5">
                          <label className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>Rx</span>
                            <input
                              type="number"
                              min={4}
                              max={158}
                              value={Math.round(selectedShape.rx)}
                              onChange={(e) => {
                                const rx = Math.max(4, Math.min(158, Number(e.target.value) || 4));
                                updateSelectedShape((s) =>
                                  s.kind === 'ellipse' ? { ...s, rx } : s
                                );
                              }}
                              className="w-12 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-[10px]"
                            />
                          </label>
                          <label className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>Ry</span>
                            <input
                              type="number"
                              min={4}
                              max={158}
                              value={Math.round(selectedShape.ry)}
                              onChange={(e) => {
                                const ry = Math.max(4, Math.min(158, Number(e.target.value) || 4));
                                updateSelectedShape((s) =>
                                  s.kind === 'ellipse' ? { ...s, ry } : s
                                );
                              }}
                              className="w-12 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-[10px]"
                            />
                          </label>
                        </div>
                      )}

                      {(selectedShape.kind === 'rect' ||
                        selectedShape.kind === 'ellipse') && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedShape((s) => {
                                if (s.kind !== 'rect' && s.kind !== 'ellipse') return s;
                                const isFilled = s.fill !== 'none';
                                return {
                                  ...s,
                                  fill: isFilled ? 'none' : fillValue,
                                  stroke: isFilled && s.stroke === 'none' ? '#cbd5e1' : s.stroke,
                                };
                              })
                            }
                            className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                              selectedShape.fill !== 'none'
                                ? 'bg-sky-600/30 border-sky-400 text-sky-200'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            {selectedShape.fill !== 'none' ? 'Preenchido' : 'Vazado'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedShape((s) =>
                                s.kind === 'rect' || s.kind === 'ellipse'
                                  ? {
                                      ...s,
                                      stroke: s.stroke === 'none' ? strokeColor : 'none',
                                    }
                                  : s
                              )
                            }
                            className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                              selectedShape.stroke !== 'none'
                                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            Borda
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedShape((s) =>
                                s.kind === 'rect' || s.kind === 'ellipse'
                                  ? { ...s, shadow: !s.shadow }
                                  : s
                              )
                            }
                            className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                              selectedShape.shadow
                                ? 'bg-sky-600/30 border-sky-400 text-sky-200'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            Sombra 3D
                          </button>
                        </>
                      )}

                      {selectedShape.kind === 'rect' && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">
                            Cantos:
                          </span>
                          {RADIUS_OPTIONS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() =>
                                updateSelectedShape((s) =>
                                  s.kind === 'rect' ? { ...s, rx: r } : s
                                )
                              }
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                                selectedShape.rx === r
                                  ? 'bg-sky-600 text-white border-sky-400'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}

                      {(selectedShape.kind === 'rect' ||
                        selectedShape.kind === 'ellipse' ||
                        selectedShape.kind === 'line' ||
                        selectedShape.kind === 'path') && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Traço:</span>
                          {STROKE_WIDTH_OPTIONS.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() =>
                                updateSelectedShape((s) =>
                                  s.kind === 'rect' ||
                                  s.kind === 'ellipse' ||
                                  s.kind === 'line' ||
                                  s.kind === 'path'
                                    ? { ...s, strokeWidth: w }
                                    : s
                                )
                              }
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                                selectedShape.strokeWidth === w
                                  ? 'bg-sky-600 text-white border-sky-400'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedShape.kind === 'screw' && (
                        <>
                          <label className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>Raio</span>
                            <input
                              type="number"
                              min={5}
                              max={48}
                              value={Math.round(selectedShape.radius)}
                              onChange={(e) => {
                                const radius = Math.max(5, Math.min(48, Number(e.target.value) || 5));
                                updateSelectedShape((s) =>
                                  s.kind === 'screw' ? { ...s, radius } : s
                                );
                              }}
                              className="w-12 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-[10px]"
                            />
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Fenda:</span>
                            {[0, 45, 90, 135].map((ang) => (
                              <button
                                key={ang}
                                type="button"
                                onClick={() =>
                                  updateSelectedShape((s) =>
                                    s.kind === 'screw' ? { ...s, angle: ang } : s
                                  )
                                }
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                                  selectedShape.angle === ang
                                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {ang}°
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {selectedShape.kind === 'led' && (
                        <>
                          <label className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>Raio</span>
                            <input
                              type="number"
                              min={3}
                              max={32}
                              value={Math.round(selectedShape.radius)}
                              onChange={(e) => {
                                const radius = Math.max(3, Math.min(32, Number(e.target.value) || 3));
                                updateSelectedShape((s) =>
                                  s.kind === 'led' ? { ...s, radius } : s
                                );
                              }}
                              className="w-12 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-[10px]"
                            />
                          </label>
                          <div className="flex items-center gap-1">
                            {LED_COLORS.map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() =>
                                  updateSelectedShape((s) =>
                                    s.kind === 'led' ? { ...s, color: c.value } : s
                                  )
                                }
                                title={c.label}
                                className={`w-4 h-4 rounded-full border cursor-pointer ${
                                  selectedShape.color === c.value
                                    ? 'border-white scale-115 ring-1 ring-amber-400'
                                    : 'border-slate-600'
                                }`}
                                style={{ backgroundColor: c.value }}
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {selectedShape.kind === 'threads' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedShape((s) =>
                                s.kind === 'threads'
                                  ? {
                                      ...s,
                                      orientation:
                                        s.orientation === 'vertical'
                                          ? 'horizontal'
                                          : 'vertical',
                                    }
                                  : s
                              )
                            }
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 text-[10px] cursor-pointer"
                          >
                            {selectedShape.orientation === 'vertical'
                              ? 'Vertical'
                              : 'Horizontal'}
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Filetes:</span>
                            {[6, 10, 14, 18].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() =>
                                  updateSelectedShape((s) =>
                                    s.kind === 'threads' ? { ...s, count: n } : s
                                  )
                                }
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                                  selectedShape.count === n
                                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {selectedShape.kind === 'badge' && (
                        <>
                          <input
                            type="text"
                            value={selectedShape.text}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateSelectedShape((s) =>
                                s.kind === 'badge' ? { ...s, text: val } : s
                              );
                            }}
                            className="w-36 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-sky-400"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Fonte:</span>
                            {[9, 11, 13, 16].map((fs) => (
                              <button
                                key={fs}
                                type="button"
                                onClick={() =>
                                  updateSelectedShape((s) =>
                                    s.kind === 'badge' ? { ...s, fontSize: fs } : s
                                  )
                                }
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                                  selectedShape.fontSize === fs
                                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {fs}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            {BADGE_STYLE_PRESETS.slice(0, 4).map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() =>
                                  updateSelectedShape((s) =>
                                    s.kind === 'badge'
                                      ? {
                                          ...s,
                                          bgColor: p.bgColor,
                                          textColor: p.textColor,
                                          borderColor: p.borderColor,
                                        }
                                      : s
                                  )
                                }
                                title={p.label}
                                className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer"
                                style={{
                                  backgroundColor: p.bgColor,
                                  color: p.textColor,
                                  borderColor: p.borderColor,
                                }}
                              >
                                {p.label.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDuplicateSelected}
                        title="Duplicar elemento"
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-sky-700 text-slate-200 border border-slate-700 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Duplicar</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleBringForward}
                        title="Trazer para frente"
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                      >
                        <ArrowUpToLine className="w-3 h-3" />
                        <span>Frente</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSendBackward}
                        title="Enviar para trás"
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                      >
                        <ArrowDownToLine className="w-3 h-3" />
                        <span>Trás</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelected}
                        title="Remover elemento (Delete)"
                        className="flex items-center gap-1 px-2 py-1 rounded bg-rose-700/80 hover:bg-rose-600 text-white border border-rose-500/60 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Barra contextual quando a ferramenta Pinos está ativa */}
                {tool === 'pin' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-500/30 text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-emerald-300 font-bold">
                        Clique no desenho p/ marcar P{activePinIndex + 1} (ou arraste os círculos):
                      </span>
                      {pinPositions.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActivePinIndex(idx)}
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                            idx === activePinIndex
                              ? 'bg-amber-400 text-slate-950 border-white shadow'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          P{idx + 1}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">
                        Alinhar na borda:
                      </span>
                      {(
                        [
                          { side: 'right' as const, label: 'DIR' },
                          { side: 'left' as const, label: 'ESQ' },
                          { side: 'top' as const, label: 'TOPO' },
                          { side: 'bottom' as const, label: 'BAIXO' },
                        ]
                      ).map((opt) => (
                        <button
                          key={opt.side}
                          type="button"
                          onClick={() => {
                            setDefaultPinSide(opt.side);
                            setPinPositions(
                              createDistributedPinPositions(pinCount, opt.side)
                            );
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-700 text-slate-200 border border-slate-700 font-mono text-[10px] cursor-pointer"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Canvas Vetorial Interativo 320x320 */}
              <div className="flex-1 min-h-[380px] flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner relative overflow-hidden">
                <div className="w-full max-w-[480px] flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>
                      {tool === 'pin'
                        ? 'Clique para posicionar os pinos conectáveis sobre seu componente.'
                        : tool === 'select'
                        ? 'Clique em qualquer peça para mover, duplicar ou ajustar camadas.'
                        : tool === 'eraser'
                        ? 'Clique em qualquer elemento desenhado para apagá-lo.'
                        : 'Desenhe o corpo, adicione parafusos, LEDs, roscas e etiquetas.'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCanvasLightBg((v) => !v)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] cursor-pointer"
                      >
                        {canvasLightBg ? 'Fundo Escuro' : 'Fundo Branco'}
                      </button>
                      <span className="font-mono text-[10px] text-slate-500">
                        {shapes.length}{' '}
                        {shapes.length === 1 ? 'elem.' : 'elems.'}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`relative aspect-square w-full rounded-xl border-2 overflow-hidden shadow-2xl ${
                      tool === 'pin'
                        ? 'border-emerald-500/80'
                        : 'border-sky-500/60'
                    } ${canvasLightBg ? 'bg-white' : 'bg-slate-950'}`}
                  >
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${COMPONENT_CANVAS_WIDTH} ${COMPONENT_CANVAS_HEIGHT}`}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={finishInteraction}
                      onPointerCancel={finishInteraction}
                      className={`w-full h-full touch-none ${
                        tool === 'select'
                          ? 'cursor-default'
                          : tool === 'eraser'
                          ? 'cursor-pointer'
                          : 'cursor-crosshair'
                      }`}
                    >
                      <ComponentSvgDefs uid={editorUid} />

                      {/* Grade de fundo */}
                      {showGrid && (
                        <g className="pointer-events-none">
                          {Array.from({
                            length: COMPONENT_CANVAS_WIDTH / 16 - 1,
                          }).map((_, i) => {
                            const pos = (i + 1) * 16;
                            const isMajor = pos % 64 === 0;
                            return (
                              <React.Fragment key={pos}>
                                <line
                                  x1={pos}
                                  y1={0}
                                  x2={pos}
                                  y2={COMPONENT_CANVAS_HEIGHT}
                                  stroke={
                                    canvasLightBg
                                      ? isMajor
                                        ? '#cbd5e1'
                                        : '#e2e8f0'
                                      : isMajor
                                      ? '#1e293b'
                                      : '#0f172a'
                                  }
                                  strokeWidth={isMajor ? 1 : 0.6}
                                />
                                <line
                                  x1={0}
                                  y1={pos}
                                  x2={COMPONENT_CANVAS_WIDTH}
                                  y2={pos}
                                  stroke={
                                    canvasLightBg
                                      ? isMajor
                                        ? '#cbd5e1'
                                        : '#e2e8f0'
                                      : isMajor
                                      ? '#1e293b'
                                      : '#0f172a'
                                  }
                                  strokeWidth={isMajor ? 1 : 0.6}
                                />
                              </React.Fragment>
                            );
                          })}
                          {/* Eixos centrais sutis */}
                          <line
                            x1={COMPONENT_CANVAS_WIDTH / 2}
                            y1={0}
                            x2={COMPONENT_CANVAS_WIDTH / 2}
                            y2={COMPONENT_CANVAS_HEIGHT}
                            stroke={
                              canvasLightBg
                                ? 'rgba(14,165,233,0.28)'
                                : 'rgba(56,189,248,0.18)'
                            }
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                          <line
                            x1={0}
                            y1={COMPONENT_CANVAS_HEIGHT / 2}
                            x2={COMPONENT_CANVAS_WIDTH}
                            y2={COMPONENT_CANVAS_HEIGHT / 2}
                            stroke={
                              canvasLightBg
                                ? 'rgba(14,165,233,0.28)'
                                : 'rgba(56,189,248,0.18)'
                            }
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                        </g>
                      )}

                      {/* Formas desenhadas */}
                      <CustomComponentShapes
                        shapes={liveShapes}
                        uid={editorUid}
                        interactiveMode={
                          tool === 'eraser'
                            ? 'eraser'
                            : tool === 'select'
                            ? 'select'
                            : 'none'
                        }
                        selectedShapeId={selectedShapeId}
                        hoveredShapeId={hoveredShapeId}
                        onShapeHover={setHoveredShapeId}
                        onShapeClick={handleEraseShape}
                        onShapePointerDown={handleShapePointerDown}
                        onHandlePointerDown={handleResizePointerDown}
                      />

                      {/* Pinos conectáveis sobre o desenho */}
                      {showPinsOnCanvas &&
                        pinPositions.map((pos, idx) => {
                          const cx = (pos.x / 100) * COMPONENT_CANVAS_WIDTH;
                          const cy = (pos.y / 100) * COMPONENT_CANVAS_HEIGHT;
                          const isCurrent =
                            tool === 'pin' && idx === activePinIndex;
                          const pinInteractive = tool === 'pin';

                          return (
                            <g
                              key={idx}
                              transform={`translate(${cx}, ${cy})`}
                              opacity={pinInteractive ? 1 : 0.65}
                              className={
                                pinInteractive
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'pointer-events-none'
                              }
                              onPointerDown={
                                pinInteractive
                                  ? (e) => {
                                      e.stopPropagation();
                                      setActivePinIndex(idx);
                                      draggingPinRef.current = idx;
                                      svgRef.current?.setPointerCapture(
                                        e.pointerId
                                      );
                                    }
                                  : undefined
                              }
                            >
                              <circle
                                cx="0"
                                cy="0"
                                r={isCurrent ? 11 : 9}
                                fill={isCurrent ? '#facc15' : '#fbbf24'}
                                stroke={isCurrent ? '#ffffff' : '#020617'}
                                strokeWidth={isCurrent ? 2.4 : 1.8}
                              />
                              <text
                                x="0"
                                y="0"
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#020617"
                                fontSize="9.5"
                                fontWeight="800"
                                fontFamily="monospace"
                                className="pointer-events-none"
                              >
                                {idx + 1}
                              </text>
                            </g>
                          );
                        })}
                    </svg>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* MODO IMPORTAR PNG / IMAGEM */
            <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/90 border border-slate-800 gap-4">
              <div className="w-full max-w-md space-y-3">
                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-600 hover:border-sky-400 bg-slate-950 text-slate-200 cursor-pointer transition-colors text-xs font-semibold">
                  <Upload className="w-4 h-4 text-sky-400" />
                  <span>
                    {imageUrl
                      ? 'Trocar arquivo de imagem (PNG/SVG/JPG)...'
                      : 'Selecionar foto/PNG do conector...'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                {imageUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-xs">
                      <span className="text-slate-300">
                        Clique na imagem para posicionar{' '}
                        <strong className="text-amber-300 font-mono">
                          P{activePinIndex + 1}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPinPositions(
                            createDistributedPinPositions(
                              pinCount,
                              defaultPinSide
                            )
                          );
                          setActivePinIndex(0);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Resetar
                      </button>
                    </div>

                    <div className="flex justify-center">
                      <div
                        onClick={handleImageClick}
                        className="relative w-72 h-72 rounded-xl border-2 border-sky-500/80 bg-slate-950 cursor-crosshair overflow-hidden"
                      >
                        <img
                          src={imageUrl}
                          alt="Mapeamento"
                          className="w-full h-full object-contain pointer-events-none select-none"
                        />
                        {pinPositions.map((pos, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePinIndex(idx);
                            }}
                            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full font-mono text-[10px] font-extrabold border-2 shadow cursor-pointer ${
                              idx === activePinIndex
                                ? 'bg-amber-400 text-slate-950 border-white scale-120 z-20'
                                : 'bg-sky-500 text-white border-slate-950 z-10'
                            }`}
                          >
                            P{idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* COLUNA DIREITA: DADOS DO COMPONENTE + PRÉ-VISUALIZAÇÃO AO VIVO */}
        <aside className="w-full lg:w-[370px] shrink-0 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Dados do Componente */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Dados do Componente</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Nome da Peça / Conector *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Borneira 4P, Sensor M12, Relé..."
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Part Number (PN) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: PN-TRM-004"
                    value={partNumber}
                    onChange={(e) => {
                      setPartNumber(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono uppercase focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Qtd. de Pinos *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={pinCount}
                    onChange={(e) =>
                      setPinCount(
                        Math.max(1, Math.min(24, Number(e.target.value) || 1))
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Categoria (Esquema)
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as ConnectorType)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="custom">Personalizado</option>
                    <option value="terminal">Borneira / Terminal</option>
                    <option value="db9">Conector Multipinos</option>
                    <option value="sensor">Sensor Industrial</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Saída Padrão Fios
                  </label>
                  <select
                    value={defaultPinSide}
                    onChange={(e) => {
                      const nextSide = e.target.value as PinSide;
                      setDefaultPinSide(nextSide);
                    }}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="right">Direita (DIR)</option>
                    <option value="bottom">Baixo (BAIXO)</option>
                    <option value="left">Esquerda (ESQ)</option>
                    <option value="top">Topo (TOPO)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Descrição Curta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Bloco terminal 4 vias com parafusos DIN"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Pré-visualização em Tempo Real */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5 flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Pré-visualização
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewMode('realistic')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    previewMode === 'realistic'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Real
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('schematic')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    previewMode === 'schematic'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Esquema
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLightBg((v) => !v)}
                  className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                >
                  {previewLightBg ? 'Escuro' : 'Branco'}
                </button>
              </div>
            </div>

            <div
              className={`flex-1 min-h-[240px] rounded-xl border border-slate-700 flex flex-col items-center justify-center p-4 relative ${
                previewLightBg ? 'bg-white' : 'bg-slate-950'
              }`}
            >
              {previewMode === 'realistic' ? (
                <div className="relative w-52 h-52 flex items-center justify-center">
                  {designerMode === 'draw' ? (
                    liveShapes.length > 0 ? (
                      <svg
                        viewBox={`0 0 ${liveDrawing.canvasWidth} ${liveDrawing.canvasHeight}`}
                        className="w-full h-full drop-shadow-xl"
                      >
                        <ComponentSvgDefs uid={previewUid} />
                        <CustomComponentShapes
                          shapes={liveDrawing.shapes}
                          uid={previewUid}
                        />
                      </svg>
                    ) : (
                      <span className="text-[11px] text-slate-500 text-center px-4">
                        Desenhe à esquerda para ver seu componente aqui.
                      </span>
                    )
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-contain drop-shadow-xl"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-500 text-center px-4">
                      Envie uma imagem para visualizar.
                    </span>
                  )}

                  {!previewHidePins &&
                    (designerMode === 'draw'
                      ? liveShapes.length > 0
                      : Boolean(imageUrl)) &&
                    pinPositions.map((pos, idx) => (
                      <div
                        key={idx}
                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-amber-400/95 border-2 border-slate-950 shadow flex items-center justify-center text-[8px] font-mono font-extrabold text-slate-950 pointer-events-none"
                      >
                        {idx + 1}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="w-52 rounded-lg bg-slate-800 border-2 border-sky-500/80 text-slate-100 shadow-xl overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex items-center justify-between text-[11px] font-bold">
                    <span className="truncate uppercase">
                      {label.trim() || 'NOVO COMPONENTE'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-600 text-[9px] font-mono">
                      {pinCount}P
                    </span>
                  </div>
                  <div className="px-3 py-1 text-[10px] font-mono text-slate-400 border-b border-slate-700/70">
                    PN: {partNumber.trim().toUpperCase() || 'PN-000'}
                  </div>
                  <div className="p-3 text-center text-[10px] font-mono text-slate-400">
                    {pinCount} PINOS ({defaultPinSide.toUpperCase()})
                  </div>
                </div>
              )}

              {previewMode === 'realistic' && (
                <button
                  type="button"
                  onClick={() => setPreviewHidePins((v) => !v)}
                  className="mt-2 px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono cursor-pointer"
                >
                  {previewHidePins ? 'Mostrar pinos' : 'Ocultar pinos'}
                </button>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
              <strong className="text-sky-300">Dica de acabamento:</strong> Use{' '}
              <span className="text-slate-200 font-semibold">Corpo</span> com os
              acabamentos metálicos/bege +{' '}
              <span className="text-amber-300 font-semibold">
                Parafuso, LED, Rosca e Etiqueta
              </span>{' '}
              e finalize posicionando os{' '}
              <span className="text-emerald-300 font-semibold">Pinos</span> nos
              pontos exatos de conexão dos fios.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
