import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpToLine,
  Cable,
  Check,
  Circle,
  Copy,
  Eraser,
  FlipVertical2,
  Grid,
  Layers,
  Minus as LineIcon,
  MousePointer2,
  Pencil,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  TERMINAL_DYNAMIC_COLOR,
  type CustomTerminalDefinition,
  type CustomTerminalShape,
  type ViewMode,
} from '../types/diagram';
import {
  WIRE_COLOR_OPTIONS,
  useDiagramStore,
} from '../store/useDiagramStore';
import {
  TERMINAL_ATTACH_X,
  TERMINAL_ATTACH_Y,
  TERMINAL_CANVAS_HEIGHT,
  TERMINAL_CANVAS_WIDTH,
  TERMINAL_EDITOR_CABLE_HEIGHT,
  type TerminalResizeHandle,
  computeCustomTerminalBounds,
  duplicateTerminalShape,
  getCustomTerminalRenderMetrics,
  mirrorShapeVertically,
  moveTerminalShape,
  resizeTerminalShape,
} from '../utils/customTerminal';
import {
  CustomTerminalAttached,
  CustomTerminalShapes,
  CustomTerminalThumbnail,
} from './CustomTerminalSvg';

type DrawTool = 'select' | 'pencil' | 'line' | 'rect' | 'ellipse' | 'eraser';

interface SwatchOption {
  value: string;
  label: string;
  isDynamic?: boolean;
}

const DESIGNER_SWATCHES: SwatchOption[] = [
  {
    value: TERMINAL_DYNAMIC_COLOR,
    label: 'Cor do Terminal (Dinâmica)',
    isDynamic: true,
  },
  { value: '#cbd5e1', label: 'Metal Prata' },
  { value: '#94a3b8', label: 'Aço Fosco' },
  { value: '#64748b', label: 'Grafite' },
  { value: '#d97706', label: 'Cobre' },
  { value: '#eab308', label: 'Latão / Ouro' },
  { value: '#0f172a', label: 'Preto / Contorno' },
  { value: '#f8fafc', label: 'Branco' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#facc15', label: 'Amarelo' },
];

const STROKE_WIDTH_OPTIONS = [2, 4, 6, 10, 14];

const createShapeId = () =>
  `shape-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

export const TerminalDesignerTab: React.FC = () => {
  const customTerminals = useDiagramStore((state) => state.customTerminals);
  const editingCustomTerminalId = useDiagramStore(
    (state) => state.editingCustomTerminalId
  );
  const terminalDesignerTargetSide = useDiagramStore(
    (state) => state.terminalDesignerTargetSide
  );
  const closeTerminalDesigner = useDiagramStore(
    (state) => state.closeTerminalDesigner
  );
  const openTerminalDesigner = useDiagramStore(
    (state) => state.openTerminalDesigner
  );
  const addCustomTerminal = useDiagramStore((state) => state.addCustomTerminal);
  const updateCustomTerminal = useDiagramStore(
    (state) => state.updateCustomTerminal
  );
  const activeWirePreset = useDiagramStore((state) => state.activeWirePreset);
  const setActiveWirePreset = useDiagramStore(
    (state) => state.setActiveWirePreset
  );
  const edges = useDiagramStore((state) => state.edges);
  const editingEdgeId = useDiagramStore((state) => state.editingEdgeId);
  const updateEdgeWireParams = useDiagramStore(
    (state) => state.updateEdgeWireParams
  );
  const globalViewMode = useDiagramStore((state) => state.viewMode);

  const editingTerminal = useMemo(
    () =>
      editingCustomTerminalId
        ? customTerminals.find((t) => t.id === editingCustomTerminalId) ?? null
        : null,
    [customTerminals, editingCustomTerminalId]
  );

  const defaultName = editingTerminal
    ? editingTerminal.name
    : `Terminal Personalizado ${customTerminals.length + 1}`;

  const [name, setName] = useState<string>(defaultName);
  const [scale, setScale] = useState<number>(editingTerminal?.scale ?? 1);
  const [shapes, setShapes] = useState<CustomTerminalShape[]>(
    editingTerminal?.shapes ?? []
  );
  const [undoStack, setUndoStack] = useState<CustomTerminalShape[][]>([]);
  const [redoStack, setRedoStack] = useState<CustomTerminalShape[][]>([]);

  // Ferramentas de desenho
  const [tool, setTool] = useState<DrawTool>('pencil');
  const [color, setColor] = useState<string>('#cbd5e1');
  const [strokeWidth, setStrokeWidth] = useState<number>(6);
  const [fillMode, setFillMode] = useState<'filled' | 'outline'>('filled');
  const [darkBorderOnFill, setDarkBorderOnFill] = useState<boolean>(true);
  const [symmetry, setSymmetry] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);

  // Estado interativo do desenho em andamento
  const svgRef = useRef<SVGSVGElement>(null);
  const [draftShape, setDraftShape] = useState<CustomTerminalShape | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const draggingShapeRef = useRef<{
    id: string;
    startPt: { x: number; y: number };
    initialShapes: CustomTerminalShape[];
    moved: boolean;
  } | null>(null);
  const resizingShapeRef = useRef<{
    id: string;
    handle: TerminalResizeHandle;
    initialShape: CustomTerminalShape;
    initialShapes: CustomTerminalShape[];
    resized: boolean;
  } | null>(null);

  // Opções locais da pré-visualização no cabo
  const [previewViewMode, setPreviewViewMode] =
    useState<ViewMode>(globalViewMode);
  const [previewBgLight, setPreviewBgLight] = useState<boolean>(false);
  const [previewWireColor, setPreviewWireColor] = useState<string>(
    activeWirePreset.colorHex
  );
  const [previewTerminalColor, setPreviewTerminalColor] = useState<string>(
    terminalDesignerTargetSide === 'rightTerminal'
      ? activeWirePreset.rightTerminal.colorHex
      : activeWirePreset.leftTerminal.colorHex
  );

  // Sincroniza quando troca entre criar novo ou editar um terminal existente
  useEffect(() => {
    if (editingTerminal) {
      setName(editingTerminal.name);
      setScale(editingTerminal.scale ?? 1);
      setShapes(editingTerminal.shapes);
    } else {
      setName(`Terminal Personalizado ${customTerminals.length + 1}`);
      setScale(1);
      setShapes([]);
    }
    setUndoStack([]);
    setRedoStack([]);
    setDraftShape(null);
    setIsDrawing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCustomTerminalId]);

  const commitShapes = useCallback(
    (nextShapes: CustomTerminalShape[]) => {
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
      return prev.slice(0, -1);
    });
  }, [shapes]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setUndoStack((u) => [...u, shapes]);
      setShapes(next);
      return prev.slice(0, -1);
    });
  }, [shapes]);

  const selectedShape =
    selectedShapeId !== null
      ? shapes.find((s) => s.id === selectedShapeId) ?? null
      : null;

  const updateSelectedShape = useCallback(
    (updater: (shape: CustomTerminalShape) => CustomTerminalShape) => {
      if (!selectedShapeId) return;
      commitShapes(
        shapes.map((s) => (s.id === selectedShapeId ? updater(s) : s))
      );
    },
    [selectedShapeId, shapes, commitShapes]
  );

  // Atalhos de teclado Ctrl+Z / Ctrl+Y / Delete / Setas
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
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
        const step = event.shiftKey ? 4 : 1;
        const dx =
          event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy =
          event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        commitShapes(
          shapes.map((s) =>
            s.id === selectedShapeId ? moveTerminalShape(s, dx, dy) : s
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
    let x = ((event.clientX - rect.left) / rect.width) * TERMINAL_CANVAS_WIDTH;
    let y = ((event.clientY - rect.top) / rect.height) * TERMINAL_CANVAS_HEIGHT;
    x = Math.max(2, Math.min(TERMINAL_CANVAS_WIDTH - 2, x));
    y = Math.max(2, Math.min(TERMINAL_CANVAS_HEIGHT - 2, y));

    if (snapToGrid) {
      x = Math.round(x / 4) * 4;
      y = Math.round(y / 4) * 4;
    } else {
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
    }
    return { x, y };
  };

  const handleSelectColorSwatch = (nextColor: string) => {
    setColor(nextColor);
    if (tool === 'select' && selectedShape) {
      updateSelectedShape((s) => {
        if (s.kind === 'rect' || s.kind === 'ellipse') {
          return {
            ...s,
            fill: s.fill === 'none' ? 'none' : nextColor,
            stroke: s.fill === 'none' ? nextColor : s.stroke,
          };
        }
        return { ...s, stroke: nextColor };
      });
    }
  };

  const handleShapePointerDown = (
    shapeId: string,
    event: React.PointerEvent<SVGElement>
  ) => {
    if (tool !== 'select' || event.button !== 0) return;
    setSelectedShapeId(shapeId);
    svgRef.current?.setPointerCapture(event.pointerId);
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
    handle: TerminalResizeHandle,
    event: React.PointerEvent<SVGElement>
  ) => {
    if (tool !== 'select' || event.button !== 0) return;
    const targetShape = shapes.find((s) => s.id === shapeId);
    if (!targetShape) return;
    setSelectedShapeId(shapeId);
    svgRef.current?.setPointerCapture(event.pointerId);
    resizingShapeRef.current = {
      id: shapeId,
      handle,
      initialShape: targetShape,
      initialShapes: shapes,
      resized: false,
    };
  };

  const handleDuplicateSelected = () => {
    if (!selectedShape) return;
    const newId = createShapeId();
    const copy = duplicateTerminalShape(selectedShape, newId, 10, 10);
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

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || tool === 'eraser') return;
    if (tool === 'select') {
      setSelectedShapeId(null);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);

    const pt = getSvgCoords(event);
    startPointRef.current = pt;
    setIsDrawing(true);

    const id = createShapeId();
    if (tool === 'pencil') {
      setDraftShape({
        id,
        kind: 'path',
        points: [pt],
        stroke: color,
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
        stroke: color,
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
        fill: fillMode === 'filled' ? color : 'none',
        stroke:
          fillMode === 'outline'
            ? color
            : darkBorderOnFill
            ? '#0f172a'
            : 'none',
        strokeWidth: fillMode === 'outline' ? strokeWidth : 2,
        rx: 2,
      });
    } else if (tool === 'ellipse') {
      setDraftShape({
        id,
        kind: 'ellipse',
        cx: pt.x,
        cy: pt.y,
        rx: 1,
        ry: 1,
        fill: fillMode === 'filled' ? color : 'none',
        stroke:
          fillMode === 'outline'
            ? color
            : darkBorderOnFill
            ? '#0f172a'
            : 'none',
        strokeWidth: fillMode === 'outline' ? strokeWidth : 2,
      });
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (resizingShapeRef.current) {
      const pt = getSvgCoords(event);
      resizingShapeRef.current.resized = true;
      const { id, handle, initialShape, initialShapes } =
        resizingShapeRef.current;
      const updated = resizeTerminalShape(initialShape, handle, pt);
      setShapes(initialShapes.map((s) => (s.id === id ? updated : s)));
      return;
    }

    if (draggingShapeRef.current) {
      const pt = getSvgCoords(event);
      const dx = pt.x - draggingShapeRef.current.startPt.x;
      const dy = pt.y - draggingShapeRef.current.startPt.y;
      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
        draggingShapeRef.current.moved = true;
      }
      const dragId = draggingShapeRef.current.id;
      setShapes(
        draggingShapeRef.current.initialShapes.map((s) =>
          s.id === dragId ? moveTerminalShape(s, dx, dy) : s
        )
      );
      return;
    }

    if (!isDrawing || !draftShape || !startPointRef.current) return;
    const pt = getSvgCoords(event);
    const start = startPointRef.current;

    if (draftShape.kind === 'path') {
      const last = draftShape.points[draftShape.points.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return;
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
    } else if (draftShape.kind === 'rect') {
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
    }
  };

  const finishDrawing = () => {
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
    if (draftShape.kind === 'rect') {
      valid = draftShape.width >= 2 || draftShape.height >= 2;
    } else if (draftShape.kind === 'ellipse') {
      valid = draftShape.rx >= 2 || draftShape.ry >= 2;
    }

    if (valid) {
      const additions: CustomTerminalShape[] = [draftShape];
      if (symmetry) {
        const mirrored = mirrorShapeVertically(
          draftShape,
          TERMINAL_ATTACH_Y,
          createShapeId()
        );
        // Evita duplicar se a forma já for exatamente simétrica no eixo Y
        const isSelfSymmetric =
          (draftShape.kind === 'rect' &&
            Math.abs(
              draftShape.y + draftShape.height / 2 - TERMINAL_ATTACH_Y
            ) < 1.5) ||
          (draftShape.kind === 'ellipse' &&
            Math.abs(draftShape.cy - TERMINAL_ATTACH_Y) < 1.5);
        if (!isSelfSymmetric) {
          additions.push(mirrored);
        }
      }
      commitShapes([...shapes, ...additions]);
    }

    setIsDrawing(false);
    setDraftShape(null);
    startPointRef.current = null;
  };

  const handleEraseShape = (shapeId: string) => {
    commitShapes(shapes.filter((s) => s.id !== shapeId));
    setHoveredShapeId(null);
  };

  const liveShapes = useMemo(() => {
    if (!draftShape) return shapes;
    if (!symmetry) return [...shapes, draftShape];
    return [
      ...shapes,
      draftShape,
      mirrorShapeVertically(draftShape, TERMINAL_ATTACH_Y, `${draftShape.id}-mirror`),
    ];
  }, [shapes, draftShape, symmetry]);

  const liveBounds = useMemo(
    () =>
      computeCustomTerminalBounds(
        liveShapes,
        TERMINAL_ATTACH_X,
        TERMINAL_ATTACH_Y
      ),
    [liveShapes]
  );

  const liveTerminalDef: CustomTerminalDefinition = useMemo(
    () => ({
      id: editingTerminal?.id ?? 'draft-preview',
      name: name.trim() || 'Terminal Personalizado',
      canvasWidth: TERMINAL_CANVAS_WIDTH,
      canvasHeight: TERMINAL_CANVAS_HEIGHT,
      attachX: TERMINAL_ATTACH_X,
      attachY: TERMINAL_ATTACH_Y,
      tipX: liveBounds.tipX,
      scale,
      shapes: liveShapes,
      createdAt: editingTerminal?.createdAt ?? Date.now(),
    }),
    [editingTerminal, name, scale, liveBounds.tipX, liveShapes]
  );

  const handleSaveTerminal = () => {
    if (shapes.length === 0) return;

    const finalName =
      name.trim() || `Terminal Personalizado ${customTerminals.length + 1}`;
    const finalBounds = computeCustomTerminalBounds(
      shapes,
      TERMINAL_ATTACH_X,
      TERMINAL_ATTACH_Y
    );

    const payload = {
      name: finalName,
      canvasWidth: TERMINAL_CANVAS_WIDTH,
      canvasHeight: TERMINAL_CANVAS_HEIGHT,
      attachX: TERMINAL_ATTACH_X,
      attachY: TERMINAL_ATTACH_Y,
      tipX: finalBounds.tipX,
      scale,
      shapes,
    };

    let savedId: string;
    if (editingTerminal) {
      updateCustomTerminal(editingTerminal.id, payload);
      savedId = editingTerminal.id;
    } else {
      const created = addCustomTerminal(payload);
      savedId = created.id;
    }

    // Seleciona automaticamente o terminal salvo no lado correspondente (ou ambos se não especificado)
    const applyTerminalToPreset = (
      basePreset: typeof activeWirePreset
    ): typeof activeWirePreset => {
      const applyLeft =
        terminalDesignerTargetSide === null ||
        terminalDesignerTargetSide === 'leftTerminal';
      const applyRight =
        terminalDesignerTargetSide === null ||
        terminalDesignerTargetSide === 'rightTerminal';

      return {
        ...basePreset,
        leftTerminal: applyLeft
          ? {
              ...basePreset.leftTerminal,
              type: 'custom',
              customTerminalId: savedId,
              label: finalName,
            }
          : basePreset.leftTerminal,
        rightTerminal: applyRight
          ? {
              ...basePreset.rightTerminal,
              type: 'custom',
              customTerminalId: savedId,
              label: finalName,
            }
          : basePreset.rightTerminal,
      };
    };

    if (editingEdgeId) {
      const targetEdge = edges.find((e) => e.id === editingEdgeId);
      if (targetEdge?.data) {
        const currentAsPreset = {
          ...activeWirePreset,
          awg: targetEdge.data.awg,
          colorHex: targetEdge.data.colorHex,
          label: targetEdge.data.label,
          thickness: targetEdge.data.thickness,
          leftStripLength: targetEdge.data.leftStripLength ?? activeWirePreset.leftStripLength,
          rightStripLength: targetEdge.data.rightStripLength ?? activeWirePreset.rightStripLength,
          leftTinned: targetEdge.data.leftTinned ?? false,
          rightTinned: targetEdge.data.rightTinned ?? false,
          leftHeatShrink: targetEdge.data.leftHeatShrink ?? false,
          rightHeatShrink: targetEdge.data.rightHeatShrink ?? false,
          leftTerminal: targetEdge.data.leftTerminal ?? activeWirePreset.leftTerminal,
          rightTerminal: targetEdge.data.rightTerminal ?? activeWirePreset.rightTerminal,
          leftIdentifier: targetEdge.data.leftIdentifier ?? activeWirePreset.leftIdentifier,
          rightIdentifier: targetEdge.data.rightIdentifier ?? activeWirePreset.rightIdentifier,
        };
        updateEdgeWireParams(editingEdgeId, applyTerminalToPreset(currentAsPreset));
      }
    } else {
      setActiveWirePreset(applyTerminalToPreset(activeWirePreset));
    }

    closeTerminalDesigner();
  };

  // Cálculos da Pré-visualização no Cabo (cabo completo + zoom da ponta)
  const previewRealisticWidth = Math.max(6, activeWirePreset.thickness * 2.4);
  const previewCasingWidth = previewRealisticWidth + 3;
  const previewHighlightWidth = Math.max(1.5, previewRealisticWidth * 0.28);

  const fullCableRefHeight =
    previewViewMode === 'realistic'
      ? previewCasingWidth
      : Math.max(8, activeWirePreset.thickness + 5);

  const fullMetrics = getCustomTerminalRenderMetrics(
    liveTerminalDef,
    fullCableRefHeight,
    78
  );

  const fullCableStartX = 14 + fullMetrics.wireOffset;
  const fullCableEndX = 286 - fullMetrics.wireOffset;

  // Zoom da ponta (cabo maior para inspecionar o encaixe)
  const zoomCableWidth = 18;
  const zoomCasingWidth = zoomCableWidth + 4;
  const zoomMetrics = getCustomTerminalRenderMetrics(
    liveTerminalDef,
    zoomCasingWidth,
    130
  );
  const zoomTipStartX = 24;
  const zoomWireStartX = zoomTipStartX + zoomMetrics.wireOffset;

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Barra Superior de Abas */}
      <header className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-sm uppercase tracking-wider shrink-0">
            <Cable className="w-5 h-5" />
            <span className="hidden sm:inline">Chão de Fábrica CAD</span>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Abas de Navegação */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={closeTerminalDesigner}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Diagrama</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-sky-600/20 text-sky-300 border border-sky-500/50 shadow-sm">
              <PenTool className="w-3.5 h-3.5 text-sky-400" />
              <span>Personalizar Terminal</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={closeTerminalDesigner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Diagrama</span>
          </button>
          <button
            type="button"
            onClick={handleSaveTerminal}
            disabled={shapes.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white border border-emerald-400/50 text-xs font-bold shadow-md transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            <span>
              {editingTerminal ? 'Atualizar Terminal' : 'Salvar e Voltar'}
            </span>
          </button>
        </div>
      </header>

      {/* Área Principal: Editor de Desenho à esquerda + Pré-visualização no Cabo à direita */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* COLUNA DE DESENHO */}
        <section className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto min-w-0">
          {/* Barra de Ferramentas de Desenho */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            {/* Ferramentas */}
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  {
                    id: 'select' as const,
                    label: 'Mover / Ajustar',
                    icon: <MousePointer2 className="w-3.5 h-3.5" />,
                    tip: 'Selecionar, mover, redimensionar pelas alças ou ajustar cor e espessura',
                  },
                  {
                    id: 'pencil' as const,
                    label: 'Lápis',
                    icon: <Pencil className="w-3.5 h-3.5" />,
                    tip: 'Desenho livre à mão',
                  },
                  {
                    id: 'line' as const,
                    label: 'Linha',
                    icon: <LineIcon className="w-3.5 h-3.5" />,
                    tip: 'Linha reta entre dois pontos',
                  },
                  {
                    id: 'rect' as const,
                    label: 'Retângulo',
                    icon: <Square className="w-3.5 h-3.5" />,
                    tip: 'Retângulo (lâmina, saia, pino)',
                  },
                  {
                    id: 'ellipse' as const,
                    label: 'Círculo',
                    icon: <Circle className="w-3.5 h-3.5" />,
                    tip: 'Círculo / Elipse (olhal, anel, furo)',
                  },
                  {
                    id: 'eraser' as const,
                    label: 'Borracha',
                    icon: <Eraser className="w-3.5 h-3.5" />,
                    tip: 'Clique em um traço/forma para apagar',
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
                      ? item.id === 'eraser'
                        ? 'bg-rose-600 text-white border-rose-400 shadow'
                        : 'bg-sky-600 text-white border-sky-400 shadow'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Opções de Auxílio + Histórico */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSymmetry((prev) => !prev)}
                title="Espelhar desenho automaticamente em cima e embaixo do eixo do cabo"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                  symmetry
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/70'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <FlipVertical2 className="w-3.5 h-3.5" />
                <span>Simetria</span>
              </button>

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
                title="Alinhar traços à grade (4px)"
                className={`px-2 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                  snapToGrid
                    ? 'bg-sky-600/25 text-sky-300 border-sky-500/60'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                Snap
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
                  if (shapes.length > 0) commitShapes([]);
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

          {/* Barra de Cores, Espessura e Preenchimento */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
            {/* Cores */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Cor:
              </span>
              {DESIGNER_SWATCHES.map((swatch) => {
                const isSelected = color === swatch.value;
                return (
                  <button
                    key={swatch.value}
                    type="button"
                    onClick={() => handleSelectColorSwatch(swatch.value)}
                    title={swatch.label}
                    className={`relative w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'border-sky-400 scale-110 ring-2 ring-sky-400/50'
                        : 'border-white/30 hover:scale-110'
                    }`}
                    style={{
                      background: swatch.isDynamic
                        ? `conic-gradient(${previewTerminalColor} 0deg 180deg, #38bdf8 180deg 270deg, #facc15 270deg 360deg)`
                        : swatch.value,
                    }}
                  >
                    {swatch.isDynamic && (
                      <span className="text-[8px] font-black text-slate-950 bg-white/85 rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                        C
                      </span>
                    )}
                  </button>
                );
              })}

              <label
                title="Escolher cor personalizada"
                className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300 cursor-pointer hover:border-sky-500"
              >
                <input
                  type="color"
                  value={
                    color === TERMINAL_DYNAMIC_COLOR
                      ? previewTerminalColor
                      : color
                  }
                  onChange={(e) => handleSelectColorSwatch(e.target.value)}
                  className="w-4 h-4 bg-transparent border-0 cursor-pointer p-0"
                />
                <span>Outra</span>
              </label>
            </div>

            {/* Espessura e Modo Preenchido/Contorno */}
            <div className="flex items-center gap-3 flex-wrap">
              {(tool === 'rect' || tool === 'ellipse') && (
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFillMode('filled')}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
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
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      fillMode === 'outline'
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Vazado (Contorno)
                  </button>
                  {fillMode === 'filled' && (
                    <button
                      type="button"
                      onClick={() => setDarkBorderOnFill((prev) => !prev)}
                      title="Adicionar borda escura ao redor da forma preenchida"
                      className={`ml-1 px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                        darkBorderOnFill
                          ? 'bg-slate-800 text-amber-300 border-amber-500/50'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      Borda
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Traço:
                </span>
                {STROKE_WIDTH_OPTIONS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setStrokeWidth(w);
                      if (tool === 'select' && selectedShape) {
                        updateSelectedShape((s) => ({ ...s, strokeWidth: w }));
                      }
                    }}
                    title={`Espessura ${w}px`}
                    className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                      strokeWidth === w
                        ? 'bg-sky-600/30 border-sky-400 text-white'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="rounded-full bg-current block"
                      style={{
                        width: Math.min(14, Math.max(3, w)),
                        height: Math.min(14, Math.max(3, w)),
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Barra de ajuste fino quando uma forma está selecionada em Mover / Ajustar */}
            {tool === 'select' && selectedShape && (
              <div className="w-full flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-500/30 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono font-bold uppercase text-[10px]">
                    Ajustando: {selectedShape.kind}
                  </span>

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
                              fill: isFilled ? 'none' : color,
                              stroke: isFilled && s.stroke === 'none' ? color : s.stroke,
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
                                  stroke: s.stroke === 'none' ? '#0f172a' : 'none',
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
                    </>
                  )}

                  {selectedShape.kind === 'rect' && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Cantos:</span>
                      {[0, 2, 4, 8].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() =>
                            updateSelectedShape((s) =>
                              s.kind === 'rect' ? { ...s, rx: r } : s
                            )
                          }
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                            (selectedShape.rx ?? 2) === r
                              ? 'bg-sky-600 text-white border-sky-400'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
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
          </div>

          {/* Área de Desenho Vetorial (Canvas SVG Interativo) */}
          <div className="flex-1 min-h-[340px] flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner relative overflow-hidden">
            <div className="w-full max-w-[780px] flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>
                  Desenhe o terminal encostado na{' '}
                  <strong className="text-sky-300">entrada do cabo</strong> à
                  direita. A ponta mais à esquerda será o encaixe do pino.
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {shapes.length}{' '}
                  {shapes.length === 1 ? 'elemento' : 'elementos'}
                </span>
              </div>

              <div className="relative w-full aspect-[3/2] rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-slate-950">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${TERMINAL_CANVAS_WIDTH} ${TERMINAL_CANVAS_HEIGHT}`}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishDrawing}
                  onPointerCancel={finishDrawing}
                  className={`w-full h-full touch-none ${
                    tool === 'select'
                      ? 'cursor-default'
                      : tool === 'eraser'
                      ? 'cursor-pointer'
                      : 'cursor-crosshair'
                  }`}
                >
                  {/* Definição de grade CAD */}
                  <defs>
                    <pattern
                      id="terminal-grid-small"
                      width="8"
                      height="8"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 8 0 L 0 0 0 8"
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.08)"
                        strokeWidth="0.6"
                      />
                    </pattern>
                    <pattern
                      id="terminal-grid-large"
                      width="32"
                      height="32"
                      patternUnits="userSpaceOnUse"
                    >
                      <rect
                        width="32"
                        height="32"
                        fill="url(#terminal-grid-small)"
                      />
                      <path
                        d="M 32 0 L 0 0 0 32"
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.16)"
                        strokeWidth="0.8"
                      />
                    </pattern>
                  </defs>

                  {showGrid && (
                    <rect
                      x="0"
                      y="0"
                      width={TERMINAL_CANVAS_WIDTH}
                      height={TERMINAL_CANVAS_HEIGHT}
                      fill="url(#terminal-grid-large)"
                      className="pointer-events-none"
                    />
                  )}

                  {/* Zona destacada da entrada do cabo à direita */}
                  <rect
                    x={TERMINAL_ATTACH_X}
                    y="0"
                    width={TERMINAL_CANVAS_WIDTH - TERMINAL_ATTACH_X}
                    height={TERMINAL_CANVAS_HEIGHT}
                    fill="rgba(15, 23, 42, 0.45)"
                    className="pointer-events-none"
                  />

                  {/* Eixo central do cabo */}
                  <line
                    x1="0"
                    y1={TERMINAL_ATTACH_Y}
                    x2={TERMINAL_CANVAS_WIDTH}
                    y2={TERMINAL_ATTACH_Y}
                    stroke={
                      symmetry
                        ? 'rgba(251, 191, 36, 0.55)'
                        : 'rgba(56, 189, 248, 0.28)'
                    }
                    strokeWidth="0.9"
                    strokeDasharray="4 3"
                    className="pointer-events-none"
                  />

                  {/* Linha vertical de entrada do cabo */}
                  <line
                    x1={TERMINAL_ATTACH_X}
                    y1="0"
                    x2={TERMINAL_ATTACH_X}
                    y2={TERMINAL_CANVAS_HEIGHT}
                    stroke="rgba(56, 189, 248, 0.55)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    className="pointer-events-none"
                  />

                  {/* Cabo de referência entrando pela direita */}
                  <g className="pointer-events-none">
                    <rect
                      x={TERMINAL_ATTACH_X}
                      y={
                        TERMINAL_ATTACH_Y -
                        TERMINAL_EDITOR_CABLE_HEIGHT / 2 -
                        2
                      }
                      width={TERMINAL_CANVAS_WIDTH - TERMINAL_ATTACH_X + 4}
                      height={TERMINAL_EDITOR_CABLE_HEIGHT + 4}
                      fill="#0f172a"
                    />
                    <rect
                      x={TERMINAL_ATTACH_X}
                      y={TERMINAL_ATTACH_Y - TERMINAL_EDITOR_CABLE_HEIGHT / 2}
                      width={TERMINAL_CANVAS_WIDTH - TERMINAL_ATTACH_X + 4}
                      height={TERMINAL_EDITOR_CABLE_HEIGHT}
                      fill={previewWireColor}
                    />
                    <rect
                      x={TERMINAL_ATTACH_X}
                      y={TERMINAL_ATTACH_Y - 3}
                      width={TERMINAL_CANVAS_WIDTH - TERMINAL_ATTACH_X + 4}
                      height={5}
                      fill="rgba(255, 255, 255, 0.35)"
                    />
                    <text
                      x={TERMINAL_ATTACH_X + 30}
                      y={TERMINAL_ATTACH_Y - 19}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="6.5"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      CABO
                    </text>
                  </g>

                  {/* Marcador automático da ponta do terminal */}
                  {liveShapes.length > 0 && (
                    <g className="pointer-events-none">
                      <line
                        x1={liveBounds.tipX}
                        y1="8"
                        x2={liveBounds.tipX}
                        y2={TERMINAL_CANVAS_HEIGHT - 8}
                        stroke="rgba(52, 211, 153, 0.5)"
                        strokeWidth="0.9"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={liveBounds.tipX}
                        cy={TERMINAL_ATTACH_Y}
                        r="2.5"
                        fill="#34d399"
                        stroke="#0f172a"
                        strokeWidth="0.8"
                      />
                      <text
                        x={Math.max(14, liveBounds.tipX)}
                        y="13"
                        textAnchor="middle"
                        fill="#34d399"
                        fontSize="6"
                        fontFamily="monospace"
                        fontWeight="700"
                      >
                        PONTA
                      </text>
                    </g>
                  )}

                  {/* Formas desenhadas pelo usuário */}
                  <CustomTerminalShapes
                    shapes={shapes}
                    terminalColorHex={previewTerminalColor}
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

                  {/* Forma sendo desenhada em tempo real */}
                  {draftShape && (
                    <g className="pointer-events-none opacity-90">
                      <CustomTerminalShapes
                        shapes={
                          symmetry
                            ? [
                                draftShape,
                                mirrorShapeVertically(
                                  draftShape,
                                  TERMINAL_ATTACH_Y,
                                  `${draftShape.id}-draft-m`
                                ),
                              ]
                            : [draftShape]
                        }
                        terminalColorHex={previewTerminalColor}
                      />
                    </g>
                  )}

                  {/* Instrução central quando o canvas está vazio */}
                  {shapes.length === 0 && !draftShape && (
                    <g className="pointer-events-none">
                      <text
                        x={TERMINAL_ATTACH_X / 2}
                        y={TERMINAL_ATTACH_Y - 12}
                        textAnchor="middle"
                        fill="rgba(148, 163, 184, 0.55)"
                        fontSize="8.5"
                        fontFamily="sans-serif"
                        fontWeight="600"
                      >
                        Desenhe o terminal aqui
                      </text>
                      <text
                        x={TERMINAL_ATTACH_X / 2}
                        y={TERMINAL_ATTACH_Y + 4}
                        textAnchor="middle"
                        fill="rgba(148, 163, 184, 0.4)"
                        fontSize="6.5"
                        fontFamily="sans-serif"
                      >
                        Use Lápis, Linha, Retângulo ou Círculo e encoste no cabo →
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: CONFIGURAÇÕES + PRÉ-VISUALIZAÇÃO NO CABO */}
        <aside className="w-full lg:w-[400px] xl:w-[430px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 flex flex-col justify-between gap-4 overflow-y-auto shrink-0">
          <div className="space-y-4">
            {/* Nome do Terminal */}
            <div className="space-y-1.5">
              <label
                htmlFor="custom-terminal-name"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-400"
              >
                Nome do Terminal
              </label>
              <input
                id="custom-terminal-name"
                type="text"
                maxLength={32}
                placeholder="Ex: Terminal Olhal, Forquilha, Faston..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-sky-500 text-sm text-white font-medium focus:outline-none"
              />
            </div>

            {/* Escala do Terminal no Cabo */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tamanho no Cabo
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-sky-400">
                    {Math.round(scale * 100)}%
                  </span>
                  {scale !== 1 && (
                    <button
                      type="button"
                      onClick={() => setScale(1)}
                      title="Resetar escala para 100%"
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.05}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            {/* PRÉ-VISUALIZAÇÃO DO TERMINAL NO CABO */}
            <div className="p-3.5 rounded-xl bg-slate-950/85 border border-sky-500/40 shadow-lg space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Pré-visualização no Cabo
                  </h3>
                </div>

                {/* Alternadores de modo e fundo da prévia */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewViewMode((m) =>
                        m === 'realistic' ? 'schematic' : 'realistic'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-200 cursor-pointer"
                  >
                    {previewViewMode === 'realistic' ? 'Cabo Real' : 'Esquema'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewBgLight((b) => !b)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-200 cursor-pointer"
                  >
                    {previewBgLight ? 'Fundo Claro' : 'Fundo Escuro'}
                  </button>
                </div>
              </div>

              {/* 1. Cabo completo com terminal desenhado nas duas pontas */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>CABO COMPLETO (ESQ / DIR)</span>
                  <span>{activeWirePreset.awg}</span>
                </div>
                <div
                  className={`h-24 w-full rounded-lg border flex items-center justify-center px-2 overflow-hidden transition-colors ${
                    previewBgLight
                      ? 'bg-white border-slate-300'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox="0 0 300 72"
                  >
                    {previewViewMode === 'schematic' ? (
                      <line
                        x1={fullCableStartX}
                        y1="36"
                        x2={fullCableEndX}
                        y2="36"
                        stroke={previewWireColor}
                        strokeWidth={activeWirePreset.thickness}
                        strokeLinecap="butt"
                      />
                    ) : (
                      <>
                        <line
                          x1={fullCableStartX}
                          y1="39"
                          x2={fullCableEndX}
                          y2="39"
                          stroke="rgba(15, 23, 42, 0.45)"
                          strokeWidth={previewCasingWidth + 3}
                          strokeLinecap="butt"
                        />
                        <line
                          x1={fullCableStartX}
                          y1="36"
                          x2={fullCableEndX}
                          y2="36"
                          stroke="#0f172a"
                          strokeWidth={previewCasingWidth}
                          strokeLinecap="butt"
                        />
                        <line
                          x1={fullCableStartX}
                          y1="36"
                          x2={fullCableEndX}
                          y2="36"
                          stroke={previewWireColor}
                          strokeWidth={previewRealisticWidth}
                          strokeLinecap="butt"
                        />
                        <line
                          x1={fullCableStartX}
                          y1="36"
                          x2={fullCableEndX}
                          y2="36"
                          stroke="rgba(255, 255, 255, 0.42)"
                          strokeWidth={previewHighlightWidth}
                          strokeLinecap="butt"
                        />
                      </>
                    )}

                    {/* Terminal Esquerdo */}
                    {liveShapes.length > 0 && (
                      <g transform="translate(14, 36)">
                        <CustomTerminalAttached
                          terminal={liveTerminalDef}
                          terminalColorHex={previewTerminalColor}
                          renderScale={fullMetrics.renderScale}
                          tipX={fullMetrics.tipX}
                          attachY={fullMetrics.attachY}
                        />
                      </g>
                    )}

                    {/* Terminal Direito (espelhado) */}
                    {liveShapes.length > 0 && (
                      <g transform="translate(286, 36)">
                        <CustomTerminalAttached
                          terminal={liveTerminalDef}
                          terminalColorHex={previewTerminalColor}
                          renderScale={fullMetrics.renderScale}
                          tipX={fullMetrics.tipX}
                          attachY={fullMetrics.attachY}
                          mirrorX
                        />
                      </g>
                    )}
                  </svg>
                </div>
              </div>

              {/* 2. Zoom da Ponta do Terminal encaixada no Cabo */}
              <div className="space-y-1">
                <span className="block text-[10px] font-mono text-slate-400">
                  DETALHE AMPLIADO NO CABO
                </span>
                <div
                  className={`h-28 w-full rounded-lg border flex items-center justify-center px-2 overflow-hidden transition-colors ${
                    previewBgLight
                      ? 'bg-white border-slate-300'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox="0 0 260 110"
                  >
                    {/* Cabo ampliado */}
                    <line
                      x1={zoomWireStartX - 1}
                      y1="59"
                      x2="258"
                      y2="59"
                      stroke="rgba(15, 23, 42, 0.4)"
                      strokeWidth={zoomCasingWidth + 4}
                      strokeLinecap="butt"
                    />
                    <line
                      x1={zoomWireStartX - 1}
                      y1="55"
                      x2="258"
                      y2="55"
                      stroke="#0f172a"
                      strokeWidth={zoomCasingWidth}
                      strokeLinecap="butt"
                    />
                    <line
                      x1={zoomWireStartX - 1}
                      y1="55"
                      x2="258"
                      y2="55"
                      stroke={previewWireColor}
                      strokeWidth={zoomCableWidth}
                      strokeLinecap="butt"
                    />
                    <line
                      x1={zoomWireStartX - 1}
                      y1="55"
                      x2="258"
                      y2="55"
                      stroke="rgba(255, 255, 255, 0.38)"
                      strokeWidth={5}
                      strokeLinecap="butt"
                    />

                    {/* Terminal ampliado */}
                    {liveShapes.length > 0 ? (
                      <g transform={`translate(${zoomTipStartX}, 55)`}>
                        <CustomTerminalAttached
                          terminal={liveTerminalDef}
                          terminalColorHex={previewTerminalColor}
                          renderScale={zoomMetrics.renderScale}
                          tipX={zoomMetrics.tipX}
                          attachY={zoomMetrics.attachY}
                        />
                      </g>
                    ) : (
                      <text
                        x="85"
                        y="58"
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="10"
                        fontFamily="sans-serif"
                      >
                        Aguardando desenho...
                      </text>
                    )}
                  </svg>
                </div>
              </div>

              {/* Cores rápidas para testar na prévia */}
              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Testar Cabo:</span>
                  {WIRE_COLOR_OPTIONS.slice(0, 5).map((opt) => (
                    <button
                      key={opt.colorHex}
                      type="button"
                      onClick={() => setPreviewWireColor(opt.colorHex)}
                      title={`Testar cabo ${opt.colorName}`}
                      className={`w-4 h-4 rounded-full border cursor-pointer ${
                        previewWireColor.toLowerCase() ===
                        opt.colorHex.toLowerCase()
                          ? 'border-white scale-110 ring-1 ring-sky-400'
                          : 'border-white/30'
                      }`}
                      style={{ backgroundColor: opt.colorHex }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Cor Dinâmica:</span>
                  <input
                    type="color"
                    value={previewTerminalColor}
                    onChange={(e) => setPreviewTerminalColor(e.target.value)}
                    title="Testar cor dinâmica do terminal"
                    className="w-5 h-5 rounded bg-transparent border border-slate-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Terminais personalizados já criados */}
            {customTerminals.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Meus Terminais ({customTerminals.length})
                  </span>
                  {editingTerminal && (
                    <button
                      type="button"
                      onClick={() =>
                        openTerminalDesigner(null, terminalDesignerTargetSide)
                      }
                      className="flex items-center gap-1 text-[10px] font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Criar Novo
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                  {customTerminals.map((ct) => {
                    const isCurrent = editingTerminal?.id === ct.id;
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() =>
                          openTerminalDesigner(ct.id, terminalDesignerTargetSide)
                        }
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-sky-950/60 border-sky-500 text-sky-200 font-semibold'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CustomTerminalThumbnail
                            terminal={ct}
                            terminalColorHex={previewTerminalColor}
                          />
                          <span className="truncate">{ct.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {isCurrent ? 'Editando' : 'Editar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rodapé de Ações */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            {shapes.length === 0 && (
              <p className="text-[11px] text-amber-300/90 text-center">
                Desenhe o terminal na área à esquerda para habilitar o salvamento.
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeTerminalDesigner}
                className="flex-1 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSaveTerminal}
                disabled={shapes.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white border border-emerald-400/50 text-xs font-bold shadow-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>
                  {editingTerminal
                    ? 'Salvar Alterações e Voltar'
                    : 'Salvar e Usar no Cabo'}
                </span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
