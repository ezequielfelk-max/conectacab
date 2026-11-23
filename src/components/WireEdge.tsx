import React, { useState, useEffect } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  getSmoothStepPath,
  useInternalNode,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import {
  Move,
  RotateCcw,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Crosshair,
  Pencil,
  Copy,
  ClipboardPaste,
  Check,
  Trash2,
} from 'lucide-react';
import type { WireEdgeType, WireAlignmentMode } from '../types/diagram';
import { useDiagramStore } from '../store/useDiagramStore';
import { isClientPointInsideAnyConnector } from '../utils/connectorBounds';
import { getCustomTerminalRenderMetrics } from '../utils/customTerminal';
import { CustomTerminalAttached } from './CustomTerminalSvg';

interface Point2D {
  x: number;
  y: number;
}

const dist2D = (a: Point2D, b: Point2D) =>
  Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

const isCollinearBetween = (a: Point2D, b: Point2D, c: Point2D) =>
  (Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(b.x - c.x) < 0.5 &&
    (b.y - a.y) * (c.y - b.y) >= -0.5) ||
  (Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(b.y - c.y) < 0.5 &&
    (b.x - a.x) * (c.x - b.x) >= -0.5);

const getCornerBend = (
  a: Point2D,
  b: Point2D,
  c: Point2D,
  size: number
): string => {
  const bendSize = Math.min(dist2D(a, b) / 2, dist2D(b, c) / 2, size);
  const { x, y } = b;
  if (
    (Math.abs(a.x - x) < 0.5 && Math.abs(x - c.x) < 0.5) ||
    (Math.abs(a.y - y) < 0.5 && Math.abs(y - c.y) < 0.5) ||
    bendSize < 1
  ) {
    return `L${x} ${y}`;
  }
  if (Math.abs(a.y - y) < 0.5) {
    const xDir = a.x < c.x ? -1 : 1;
    const yDir = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir},${y} Q ${x},${y} ${x},${y + bendSize * yDir}`;
  }
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir} Q ${x},${y} ${x + bendSize * xDir},${y}`;
};

const buildRoundedOrthogonalPath = (
  rawPoints: Point2D[],
  borderRadius: number
): string => {
  const cleaned: Point2D[] = [];
  for (const pt of rawPoints) {
    const prev = cleaned[cleaned.length - 1];
    if (prev && dist2D(prev, pt) < 0.5) continue;
    const [a, b] = cleaned.slice(-2);
    if (a && b && isCollinearBetween(a, b, pt)) {
      cleaned.pop();
    }
    cleaned.push(pt);
  }
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return `M${cleaned[0].x} ${cleaned[0].y}`;
  let d = `M${cleaned[0].x} ${cleaned[0].y}`;
  for (let i = 1; i < cleaned.length - 1; i++) {
    d += getCornerBend(cleaned[i - 1], cleaned[i], cleaned[i + 1], borderRadius);
  }
  const last = cleaned[cleaned.length - 1];
  d += ` L${last.x} ${last.y}`;
  return d;
};

const POSITION_ROTATION_DEG: Record<Position, number> = {
  [Position.Right]: 0,
  [Position.Bottom]: 90,
  [Position.Left]: 180,
  [Position.Top]: 270,
};

const POSITION_DIRECTION_VEC: Record<Position, { dx: number; dy: number }> = {
  [Position.Right]: { dx: 1, dy: 0 },
  [Position.Bottom]: { dx: 0, dy: 1 },
  [Position.Left]: { dx: -1, dy: 0 },
  [Position.Top]: { dx: 0, dy: -1 },
};

const angleToPosition = (angleDeg: number): Position => {
  const norm = ((angleDeg % 360) + 360) % 360;
  if (norm >= 45 && norm < 135) return Position.Bottom;
  if (norm >= 135 && norm < 225) return Position.Left;
  if (norm >= 225 && norm < 315) return Position.Top;
  return Position.Right;
};

let sharedMeasurePath: SVGPathElement | null = null;
const getMeasurePath = (d: string): SVGPathElement | null => {
  if (typeof document === 'undefined' || !d) return null;
  if (!sharedMeasurePath) {
    sharedMeasurePath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
  }
  sharedMeasurePath.setAttribute('d', d);
  return sharedMeasurePath;
};

export const WireEdge: React.FC<EdgeProps<WireEdgeType>> = ({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) => {
  const viewMode = useDiagramStore((state) => state.viewMode);
  const updateEdgeAlignment = useDiagramStore(
    (state) => state.updateEdgeAlignment
  );
  const updateEdgeTerminal = useDiagramStore(
    (state) => state.updateEdgeTerminal
  );
  const updateEdgeIdentifier = useDiagramStore(
    (state) => state.updateEdgeIdentifier
  );
  const selectEdge = useDiagramStore((state) => state.selectEdge);
  const requestDeleteEdge = useDiagramStore((state) => state.requestDeleteEdge);
  const editingEdgeId = useDiagramStore((state) => state.editingEdgeId);
  const startEditingEdge = useDiagramStore((state) => state.startEditingEdge);
  const stopEditingEdge = useDiagramStore((state) => state.stopEditingEdge);
  const moveWireAnchorNode = useDiagramStore(
    (state) => state.moveWireAnchorNode
  );
  const isExportingDiagram = useDiagramStore(
    (state) => state.isExportingDiagram
  );
  const customTerminals = useDiagramStore((state) => state.customTerminals);
  const copiedWire = useDiagramStore((state) => state.copiedWire);
  const isPastingCableMode = useDiagramStore((state) => state.isPastingCableMode);
  const copyWire = useDiagramStore((state) => state.copyWire);
  const startPastingCableMode = useDiagramStore(
    (state) => state.startPastingCableMode
  );
  const isEditingThisEdge = editingEdgeId === id;
  const isVisuallySelected = Boolean(selected && !isExportingDiagram);
  const { screenToFlowPosition } = useReactFlow();
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const [justCopied, setJustCopied] = useState<boolean>(false);

  // Controla qual menu flutuante deve aparecer: apenas o da ponta esquerda, o da ponta direita ou o do corpo do cabo
  const [activeControlTarget, setActiveControlTarget] = useState<
    'cable' | 'leftTerminal' | 'rightTerminal' | null
  >('cable');

  useEffect(() => {
    if (!selected) {
      setActiveControlTarget('cable');
    }
  }, [selected]);

  useEffect(() => {
    if (!justCopied) return;
    const timer = window.setTimeout(() => setJustCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [justCopied]);

  const colorHex = data?.colorHex ?? '#ef4444';
  const thickness = data?.thickness ?? 3;
  const leftStripMm = data?.leftStripLength ?? 8;
  const rightStripMm = data?.rightStripLength ?? 8;
  const leftTinned = data?.leftTinned ?? false;
  const rightTinned = data?.rightTinned ?? false;
  const leftHeatShrink = leftTinned && (data?.leftHeatShrink ?? false);
  const rightHeatShrink = rightTinned && (data?.rightHeatShrink ?? false);
  const leftStripFillColor = leftTinned ? '#cbd5e1' : '#f59e0b';
  const rightStripFillColor = rightTinned ? '#cbd5e1' : '#f59e0b';
  const leftPinWidth = Math.max(3, Math.round(leftStripMm));
  const rightPinWidth = Math.max(3, Math.round(rightStripMm));
  const leftTerminalEnabled = data?.leftTerminal?.enabled ?? true;
  const rightTerminalEnabled = data?.rightTerminal?.enabled ?? true;
  const leftTerminalColor = data?.leftTerminal?.colorHex ?? colorHex;
  const rightTerminalColor = data?.rightTerminal?.colorHex ?? colorHex;
  const leftCustomDef =
    leftTerminalEnabled &&
    data?.leftTerminal?.type === 'custom' &&
    data.leftTerminal.customTerminalId
      ? customTerminals.find(
          (t) => t.id === data.leftTerminal?.customTerminalId
        ) ?? null
      : null;
  const rightCustomDef =
    rightTerminalEnabled &&
    data?.rightTerminal?.type === 'custom' &&
    data.rightTerminal.customTerminalId
      ? customTerminals.find(
          (t) => t.id === data.rightTerminal?.customTerminalId
        ) ?? null
      : null;
  const terminalRefHeight =
    viewMode === 'realistic'
      ? Math.max(6, thickness * 2.4) + 3
      : Math.max(8, thickness + 5);
  const leftCustomMetrics = leftCustomDef
    ? getCustomTerminalRenderMetrics(leftCustomDef, terminalRefHeight)
    : null;
  const rightCustomMetrics = rightCustomDef
    ? getCustomTerminalRenderMetrics(rightCustomDef, terminalRefHeight)
    : null;
  const leftIdentifier = data?.leftIdentifier;
  const rightIdentifier = data?.rightIdentifier;
  const leftIdEnabled = Boolean(
    leftIdentifier?.enabled && leftIdentifier.text.trim().length > 0
  );
  const rightIdEnabled = Boolean(
    rightIdentifier?.enabled && rightIdentifier.text.trim().length > 0
  );
  const leftIdText = leftIdentifier?.text.trim() ?? '';
  const rightIdText = rightIdentifier?.text.trim() ?? '';
  const leftIdWidth = leftIdEnabled
    ? Math.max(28, Math.round(leftIdText.length * 6.2 + 10))
    : 0;
  const rightIdWidth = rightIdEnabled
    ? Math.max(28, Math.round(rightIdText.length * 6.2 + 10))
    : 0;
  const alignmentMode: WireAlignmentMode = data?.alignmentMode ?? 'auto';
  const controlX = data?.controlX;
  const controlY = data?.controlY;

  const defaultSourceVec = POSITION_DIRECTION_VEC[sourcePosition] ?? {
    dx: 1,
    dy: 0,
  };
  const defaultTargetVec = POSITION_DIRECTION_VEC[targetPosition] ?? {
    dx: -1,
    dy: 0,
  };

  // Calcula o centro exato do Handle (bolinha numerada) no conector
  const sourceHandleObj = [
    ...(sourceNode?.internals.handleBounds?.source ?? []),
    ...(sourceNode?.internals.handleBounds?.target ?? []),
  ].find((h) => h.id === sourceHandleId);

  const targetHandleObj = [
    ...(targetNode?.internals.handleBounds?.source ?? []),
    ...(targetNode?.internals.handleBounds?.target ?? []),
  ].find((h) => h.id === targetHandleId);

  const baseSourceX =
    sourceNode && sourceHandleObj
      ? sourceNode.internals.positionAbsolute.x +
        sourceHandleObj.x +
        sourceHandleObj.width / 2
      : sourceX - defaultSourceVec.dx * 10;

  const baseSourceY =
    sourceNode && sourceHandleObj
      ? sourceNode.internals.positionAbsolute.y +
        sourceHandleObj.y +
        sourceHandleObj.height / 2
      : sourceY - defaultSourceVec.dy * 10;

  const baseTargetX =
    targetNode && targetHandleObj
      ? targetNode.internals.positionAbsolute.x +
        targetHandleObj.x +
        targetHandleObj.width / 2
      : targetX - defaultTargetVec.dx * 10;

  const baseTargetY =
    targetNode && targetHandleObj
      ? targetNode.internals.positionAbsolute.y +
        targetHandleObj.y +
        targetHandleObj.height / 2
      : targetY - defaultTargetVec.dy * 10;

  // Raio máximo do círculo numerado do pino (Handle) para limitar o movimento da ponta dentro dele
  const sourcePinRadius = sourceHandleObj
    ? Math.max(7, Math.min(sourceHandleObj.width, sourceHandleObj.height) / 2)
    : 10;
  const targetPinRadius = targetHandleObj
    ? Math.max(7, Math.min(targetHandleObj.width, targetHandleObj.height) / 2)
    : 10;

  const clampToPinCircle = (ox: number, oy: number, maxRadius: number) => {
    const dist = Math.hypot(ox, oy);
    if (dist <= maxRadius || dist === 0) {
      return { x: ox, y: oy };
    }
    const scale = maxRadius / dist;
    return {
      x: Math.round(ox * scale * 10) / 10,
      y: Math.round(oy * scale * 10) / 10,
    };
  };

  // Deslocamento e ângulo personalizados de cada ponta do terminal tubular (limitados ao círculo numerado)
  const clampedSourceOffset = clampToPinCircle(
    data?.leftTerminal?.offsetX ?? 0,
    data?.leftTerminal?.offsetY ?? 0,
    sourcePinRadius
  );
  const clampedTargetOffset = clampToPinCircle(
    data?.rightTerminal?.offsetX ?? 0,
    data?.rightTerminal?.offsetY ?? 0,
    targetPinRadius
  );

  const sourceOffsetX = clampedSourceOffset.x;
  const sourceOffsetY = clampedSourceOffset.y;
  const targetOffsetX = clampedTargetOffset.x;
  const targetOffsetY = clampedTargetOffset.y;

  const anchorSourceX = baseSourceX + sourceOffsetX;
  const anchorSourceY = baseSourceY + sourceOffsetY;
  const anchorTargetX = baseTargetX + targetOffsetX;
  const anchorTargetY = baseTargetY + targetOffsetY;

  const defaultSourceAngle = POSITION_ROTATION_DEG[sourcePosition] ?? 0;
  const defaultTargetAngle = POSITION_ROTATION_DEG[targetPosition] ?? 180;

  const sourceAngle = data?.leftTerminal?.angle ?? defaultSourceAngle;
  const targetAngle = data?.rightTerminal?.angle ?? defaultTargetAngle;

  const sourceRad = (sourceAngle * Math.PI) / 180;
  const targetRad = (targetAngle * Math.PI) / 180;

  const sourceVec = {
    dx: Math.cos(sourceRad),
    dy: Math.sin(sourceRad),
  };
  const targetVec = {
    dx: Math.cos(targetRad),
    dy: Math.sin(targetRad),
  };

  const effectiveSourcePosition = angleToPosition(sourceAngle);
  const effectiveTargetPosition = angleToPosition(targetAngle);

  // Desloca o início/fim do fio exatamente para onde inicia o terminal ou o decape
  const leftWireOffset = leftTerminalEnabled
    ? leftCustomMetrics
      ? leftCustomMetrics.wireOffset
      : leftPinWidth + 10
    : Math.round(leftStripMm);
  const rightWireOffset = rightTerminalEnabled
    ? rightCustomMetrics
      ? rightCustomMetrics.wireOffset
      : rightPinWidth + 10
    : Math.round(rightStripMm);

  const wireSourceX = anchorSourceX + sourceVec.dx * leftWireOffset;
  const wireSourceY = anchorSourceY + sourceVec.dy * leftWireOffset;

  const wireTargetX = anchorTargetX + targetVec.dx * rightWireOffset;
  const wireTargetY = anchorTargetY + targetVec.dy * rightWireOffset;

  const borderRadius = viewMode === 'realistic' ? 24 : 12;
  const stubOffset = Math.max(
    24,
    leftIdEnabled ? leftIdWidth + 12 : 20,
    rightIdEnabled ? rightIdWidth + 12 : 20
  );
  const gappedSource: Point2D = {
    x: wireSourceX + sourceVec.dx * stubOffset,
    y: wireSourceY + sourceVec.dy * stubOffset,
  };
  const gappedTarget: Point2D = {
    x: wireTargetX + targetVec.dx * stubOffset,
    y: wireTargetY + targetVec.dy * stubOffset,
  };

  let edgePath = '';
  let handleX = (gappedSource.x + gappedTarget.x) / 2;
  let handleY = (gappedSource.y + gappedTarget.y) / 2;

  if (alignmentMode === 'straight') {
    edgePath = `M${wireSourceX} ${wireSourceY} L${wireTargetX} ${wireTargetY}`;
    handleX = (wireSourceX + wireTargetX) / 2;
    handleY = (wireSourceY + wireTargetY) / 2;
  } else if (alignmentMode === 'bezier') {
    if (controlX !== undefined && controlY !== undefined) {
      const qx = 2 * controlX - 0.5 * (wireSourceX + wireTargetX);
      const qy = 2 * controlY - 0.5 * (wireSourceY + wireTargetY);
      edgePath = `M${wireSourceX} ${wireSourceY} Q ${qx} ${qy} ${wireTargetX} ${wireTargetY}`;
      handleX = controlX;
      handleY = controlY;
    } else {
      const [bPath, bx, by] = getBezierPath({
        sourceX: wireSourceX,
        sourceY: wireSourceY,
        sourcePosition: effectiveSourcePosition,
        targetX: wireTargetX,
        targetY: wireTargetY,
        targetPosition: effectiveTargetPosition,
      });
      edgePath = bPath;
      handleX = bx;
      handleY = by;
    }
  } else if (alignmentMode === 'vertical') {
    const midX = controlX ?? (gappedSource.x + gappedTarget.x) / 2;
    const midY = controlY ?? (gappedSource.y + gappedTarget.y) / 2;
    edgePath = buildRoundedOrthogonalPath(
      [
        { x: wireSourceX, y: wireSourceY },
        gappedSource,
        { x: midX, y: gappedSource.y },
        { x: midX, y: gappedTarget.y },
        gappedTarget,
        { x: wireTargetX, y: wireTargetY },
      ],
      borderRadius
    );
    handleX = midX;
    handleY = midY;
  } else if (alignmentMode === 'horizontal') {
    const midX = controlX ?? (gappedSource.x + gappedTarget.x) / 2;
    const midY = controlY ?? (gappedSource.y + gappedTarget.y) / 2;
    edgePath = buildRoundedOrthogonalPath(
      [
        { x: wireSourceX, y: wireSourceY },
        gappedSource,
        { x: gappedSource.x, y: midY },
        { x: gappedTarget.x, y: midY },
        gappedTarget,
        { x: wireTargetX, y: wireTargetY },
      ],
      borderRadius
    );
    handleX = midX;
    handleY = midY;
  } else if (alignmentMode === 'corner-hv') {
    const cornerX = controlX ?? gappedTarget.x;
    const cornerY = controlY ?? gappedSource.y;
    edgePath = buildRoundedOrthogonalPath(
      [
        { x: wireSourceX, y: wireSourceY },
        gappedSource,
        { x: cornerX, y: gappedSource.y },
        { x: cornerX, y: cornerY },
        { x: gappedTarget.x, y: cornerY },
        gappedTarget,
        { x: wireTargetX, y: wireTargetY },
      ],
      borderRadius
    );
    handleX = cornerX;
    handleY = cornerY;
  } else if (alignmentMode === 'corner-vh') {
    const cornerX = controlX ?? gappedSource.x;
    const cornerY = controlY ?? gappedTarget.y;
    edgePath = buildRoundedOrthogonalPath(
      [
        { x: wireSourceX, y: wireSourceY },
        gappedSource,
        { x: gappedSource.x, y: cornerY },
        { x: cornerX, y: cornerY },
        { x: cornerX, y: gappedTarget.y },
        gappedTarget,
        { x: wireTargetX, y: wireTargetY },
      ],
      borderRadius
    );
    handleX = cornerX;
    handleY = cornerY;
  } else {
    const [sPath, lx, ly] = getSmoothStepPath({
      sourceX: wireSourceX,
      sourceY: wireSourceY,
      sourcePosition: effectiveSourcePosition,
      targetX: wireTargetX,
      targetY: wireTargetY,
      targetPosition: effectiveTargetPosition,
      borderRadius,
      centerX: controlX,
      centerY: controlY,
    });
    edgePath = sPath;
    handleX = controlX ?? lx;
    handleY = controlY ?? ly;
  }

  // Arrastar diretamente a ponta do terminal tubular (Origem ou Destino) no diagrama
  const handleDragTerminal = (
    side: 'leftTerminal' | 'rightTerminal',
    event: React.MouseEvent<Element>
  ) => {
    event.stopPropagation();
    event.preventDefault();

    setActiveControlTarget(side);
    if (!selected) {
      selectEdge(id);
    }

    const startFlow = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const isFreeEnd =
      side === 'leftTerminal'
        ? sourceNode?.type === 'wireAnchor'
        : targetNode?.type === 'wireAnchor';
    const anchorNodeId = side === 'leftTerminal' ? source : target;
    const initialAnchorX =
      side === 'leftTerminal' ? baseSourceX : baseTargetX;
    const initialAnchorY =
      side === 'leftTerminal' ? baseSourceY : baseTargetY;

    const initialOffsetX =
      side === 'leftTerminal' ? sourceOffsetX : targetOffsetX;
    const initialOffsetY =
      side === 'leftTerminal' ? sourceOffsetY : targetOffsetY;

    const maxRadius =
      side === 'leftTerminal' ? sourcePinRadius : targetPinRadius;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentFlow = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      const dx = currentFlow.x - startFlow.x;
      const dy = currentFlow.y - startFlow.y;

      if (isFreeEnd) {
        // Ponta livre: permite mover livremente em qualquer área fora dos componentes
        if (
          isClientPointInsideAnyConnector(moveEvent.clientX, moveEvent.clientY)
        ) {
          return;
        }
        moveWireAnchorNode(anchorNodeId, {
          x: initialAnchorX + dx,
          y: initialAnchorY + dy,
        });
        return;
      }

      const clamped = clampToPinCircle(
        initialOffsetX + dx,
        initialOffsetY + dy,
        maxRadius
      );

      updateEdgeTerminal(id, side, {
        offsetX: clamped.x,
        offsetY: clamped.y,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDragAlignmentPoint = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    event.preventDefault();

    const startFlow = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const initialX = handleX;
    const initialY = handleY;
    let lockedMode: WireAlignmentMode = alignmentMode;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentFlow = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      const dx = currentFlow.x - startFlow.x;
      const dy = currentFlow.y - startFlow.y;

      if (lockedMode === 'auto' && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        lockedMode = Math.abs(dx) >= Math.abs(dy) ? 'vertical' : 'horizontal';
      }

      updateEdgeAlignment(id, {
        alignmentMode: lockedMode === 'straight' ? 'bezier' : lockedMode,
        controlX: Math.round(initialX + dx),
        controlY: Math.round(initialY + dy),
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleNudge = (dx: number, dy: number) => {
    const nextMode: WireAlignmentMode =
      alignmentMode === 'auto' || alignmentMode === 'straight'
        ? Math.abs(dx) >= Math.abs(dy)
          ? 'vertical'
          : 'horizontal'
        : alignmentMode;

    updateEdgeAlignment(id, {
      alignmentMode: nextMode,
      controlX: Math.round(handleX + dx),
      controlY: Math.round(handleY + dy),
    });
  };

  const renderTerminalTipControl = (
    side: 'leftTerminal' | 'rightTerminal',
    tipX: number,
    tipY: number,
    currentAngle: number,
    offsetX: number,
    offsetY: number,
    customAngle: number | undefined,
    titleLabel: string
  ) => {
    const isCustomized =
      Math.abs(offsetX) > 0 ||
      Math.abs(offsetY) > 0 ||
      customAngle !== undefined;
    const normAngle = ((currentAngle % 360) + 360) % 360;

    return (
      <div
        key={side}
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${tipX}px, ${tipY}px)`,
          pointerEvents: 'all',
          zIndex: 3100,
        }}
        className="nodrag nopan flex flex-col items-center select-none"
      >
        {/* Painel compacto de orientação e posição da ponta do terminal tubular */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="-mt-14 mb-1 flex items-center gap-1 px-1.5 py-1 rounded-md bg-slate-900/95 border border-amber-400/80 shadow-lg backdrop-blur-md text-[9px] font-mono text-slate-200 whitespace-nowrap"
        >
          <span className="font-bold text-amber-300 px-1">{titleLabel}</span>

          {(
            [
              { angle: 0, icon: <ArrowLeft className="w-2.5 h-2.5" />, tip: 'Ponta p/ Esquerda (0°)' },
              { angle: 90, icon: <ArrowUp className="w-2.5 h-2.5" />, tip: 'Ponta p/ Cima (90°)' },
              { angle: 180, icon: <ArrowRight className="w-2.5 h-2.5" />, tip: 'Ponta p/ Direita (180°)' },
              { angle: 270, icon: <ArrowDown className="w-2.5 h-2.5" />, tip: 'Ponta p/ Baixo (270°)' },
            ]
          ).map((dir) => {
            const isActive = Math.round(normAngle) === dir.angle;
            return (
              <button
                key={dir.angle}
                type="button"
                onClick={() =>
                  updateEdgeTerminal(id, side, { angle: dir.angle })
                }
                title={dir.tip}
                className={`p-1 rounded border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {dir.icon}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() =>
              updateEdgeTerminal(id, side, {
                angle: (Math.round(normAngle) + 45) % 360,
              })
            }
            title="Girar ponta do terminal em +45°"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-sky-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            <RotateCw className="w-2.5 h-2.5 text-amber-300" />
            <span>45°</span>
          </button>

          {isCustomized && (
            <button
              type="button"
              onClick={() =>
                updateEdgeTerminal(id, side, {
                  offsetX: 0,
                  offsetY: 0,
                  angle: undefined,
                })
              }
              title="Voltar ponta do terminal para o pino original"
              className="p-1 rounded bg-slate-800 hover:bg-rose-900/80 text-rose-300 border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Alça exatamente na ponta do terminal tubular para arrastar livremente */}
        <button
          type="button"
          onMouseDown={(e) => handleDragTerminal(side, e)}
          title={`Arraste para posicionar a ${titleLabel.toLowerCase()} em qualquer lugar`}
          className="w-5 h-5 rounded-full bg-amber-400 hover:bg-sky-400 text-slate-950 border-2 border-slate-950 shadow-md flex items-center justify-center cursor-move transition-transform hover:scale-125"
        >
          <Crosshair className="w-3 h-3" />
        </button>
      </div>
    );
  };

  const handleCopyCable = () => {
    const centerX = (anchorSourceX + anchorTargetX) / 2;
    const centerY = (anchorSourceY + anchorTargetY) / 2;
    copyWire({
      data: {
        awg: data?.awg ?? '24 AWG',
        colorHex,
        label: data?.label ?? data?.awg ?? '24 AWG',
        thickness,
        leftStripLength: leftStripMm,
        rightStripLength: rightStripMm,
        leftTinned,
        rightTinned,
        leftHeatShrink,
        rightHeatShrink,
        leftTerminal: {
          enabled: leftTerminalEnabled,
          type: data?.leftTerminal?.type ?? 'tubular',
          customTerminalId: data?.leftTerminal?.customTerminalId,
          label: data?.leftTerminal?.label ?? 'Terminal Tubular',
          colorHex: leftTerminalColor,
          colorName: data?.leftTerminal?.colorName ?? '',
          angle: sourceAngle,
        },
        rightTerminal: {
          enabled: rightTerminalEnabled,
          type: data?.rightTerminal?.type ?? 'tubular',
          customTerminalId: data?.rightTerminal?.customTerminalId,
          label: data?.rightTerminal?.label ?? 'Terminal Tubular',
          colorHex: rightTerminalColor,
          colorName: data?.rightTerminal?.colorName ?? '',
          angle: targetAngle,
        },
        leftIdentifier: leftIdentifier ? { ...leftIdentifier } : undefined,
        rightIdentifier: rightIdentifier ? { ...rightIdentifier } : undefined,
        alignmentMode,
      },
      halfDx: Math.round(((anchorTargetX - anchorSourceX) / 2) * 10) / 10,
      halfDy: Math.round(((anchorTargetY - anchorSourceY) / 2) * 10) / 10,
      sourceAngle,
      targetAngle,
      controlOffsetX:
        controlX !== undefined ? Math.round((controlX - centerX) * 10) / 10 : undefined,
      controlOffsetY:
        controlY !== undefined ? Math.round((controlY - centerY) * 10) / 10 : undefined,
    });
    setJustCopied(true);
  };

  const renderAlignmentControls = () => {
    if (!isVisuallySelected || !activeControlTarget) return null;

    return (
      <EdgeLabelRenderer>
        {/* Exibe as opções da Ponta Esq. SOMENTE se tiver clicado na ponta esquerda */}
        {activeControlTarget === 'leftTerminal' &&
          renderTerminalTipControl(
            'leftTerminal',
            anchorSourceX,
            anchorSourceY,
            sourceAngle,
            sourceOffsetX,
            sourceOffsetY,
            data?.leftTerminal?.angle,
            'Ponta Esq.'
          )}

        {/* Exibe as opções da Ponta Dir. SOMENTE se tiver clicado na ponta direita */}
        {activeControlTarget === 'rightTerminal' &&
          renderTerminalTipControl(
            'rightTerminal',
            anchorTargetX,
            anchorTargetY,
            targetAngle,
            targetOffsetX,
            targetOffsetY,
            data?.rightTerminal?.angle,
            'Ponta Dir.'
          )}

        {/* Exibe as opções de posição do cabo SOMENTE se tiver clicado no corpo do cabo */}
        {activeControlTarget === 'cable' && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${handleX}px, ${handleY}px)`,
              pointerEvents: 'all',
              zIndex: 3000,
            }}
            className="nodrag nopan flex flex-col items-center gap-1.5 select-none"
          >
            {/* Barra flutuante de alinhamento do cabo selecionado (Setas, Reta e Auto) */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="-mt-12 flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-900/95 border border-sky-500/80 shadow-xl backdrop-blur-md text-[10px] font-mono text-slate-200"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleNudge(-20, 0)}
                  title="Deslocar fio para a esquerda"
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(20, 0)}
                  title="Deslocar fio para a direita"
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(0, -20)}
                  title="Deslocar fio para cima"
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(0, 20)}
                  title="Deslocar fio para baixo"
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateEdgeAlignment(id, {
                    alignmentMode: 'straight',
                    controlX: undefined,
                    controlY: undefined,
                  })
                }
                title="Linha reta direta"
                className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  alignmentMode === 'straight'
                    ? 'bg-sky-600 text-white border-sky-400 font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Reta
              </button>

              <button
                type="button"
                onClick={() =>
                  updateEdgeAlignment(id, {
                    alignmentMode: 'auto',
                    controlX: undefined,
                    controlY: undefined,
                  })
                }
                title="Resetar alinhamento automático"
                className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  alignmentMode === 'auto' &&
                  controlX === undefined &&
                  controlY === undefined
                    ? 'bg-sky-600 text-white border-sky-400 font-bold'
                    : 'bg-slate-800 hover:bg-rose-900/70 text-slate-300 hover:text-rose-200 border border-slate-700'
                }`}
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Auto</span>
              </button>

              <div className="w-px h-4 bg-slate-700 mx-0.5" />

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditingThisEdge) {
                    stopEditingEdge();
                  } else {
                    startEditingEdge(id);
                  }
                }}
                title={
                  isEditingThisEdge
                    ? 'Concluir edição dos parâmetros deste cabo'
                    : 'Editar parâmetros deste cabo na coluna esquerda'
                }
                aria-label="Editar parâmetros do cabo"
                className={`p-1 rounded border transition-colors cursor-pointer ${
                  isEditingThisEdge
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow'
                    : 'bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white border-slate-700'
                }`}
              >
                <Pencil className="w-3 h-3" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyCable();
                }}
                title="Copiar este cabo"
                aria-label="Copiar cabo"
                className={`p-1 rounded border transition-colors cursor-pointer ${
                  justCopied
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                    : 'bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white border-slate-700'
                }`}
              >
                {justCopied ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                disabled={!copiedWire}
                onClick={(e) => {
                  e.stopPropagation();
                  startPastingCableMode();
                }}
                title={
                  copiedWire
                    ? 'Colar cabo copiado em um local selecionado do diagrama'
                    : 'Copie um cabo primeiro para colar'
                }
                aria-label="Colar cabo"
                className={`p-1 rounded border transition-colors ${
                  !copiedWire
                    ? 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed'
                    : isPastingCableMode
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow cursor-pointer'
                    : 'bg-slate-800 hover:bg-emerald-600 text-emerald-300 hover:text-white border-slate-700 cursor-pointer'
                }`}
              >
                <ClipboardPaste className="w-3 h-3" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  requestDeleteEdge(id);
                }}
                title="Apagar cabo"
                aria-label="Apagar cabo"
                className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/60 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Alça arrastável em cima do cabo para mover o alinhamento com o mouse */}
            <button
              type="button"
              onMouseDown={handleDragAlignmentPoint}
              title="Arraste para alinhar o fio livremente"
              className="w-6 h-6 rounded-full bg-sky-500 hover:bg-amber-400 text-slate-950 border-2 border-white shadow-lg flex items-center justify-center cursor-move transition-transform hover:scale-110"
            >
              <Move className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    );
  };

  // Linhas guia tracejadas exibidas apenas quando o cabo está selecionado e a ponta foi movida do pino
  const renderPinGuideLines = () => {
    if (!isVisuallySelected) return null;
    const showSourceGuide = Math.hypot(sourceOffsetX, sourceOffsetY) > 3;
    const showTargetGuide = Math.hypot(targetOffsetX, targetOffsetY) > 3;
    return (
      <>
        {showSourceGuide && (
          <line
            x1={baseSourceX}
            y1={baseSourceY}
            x2={anchorSourceX}
            y2={anchorSourceY}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            className="pointer-events-none"
          />
        )}
        {showTargetGuide && (
          <line
            x1={baseTargetX}
            y1={baseTargetY}
            x2={anchorTargetX}
            y2={anchorTargetY}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            className="pointer-events-none"
          />
        )}
      </>
    );
  };

  const isAngleFlipped = (angleDeg: number) => {
    const norm = ((angleDeg % 360) + 360) % 360;
    return norm > 90 && norm <= 270;
  };

  // Arrastar o identificador diretamente ao longo do caminho do fio (edgePath)
  const handleDragIdentifier = (
    side: 'leftIdentifier' | 'rightIdentifier',
    boxWidth: number,
    event: React.MouseEvent<Element>
  ) => {
    event.stopPropagation();
    event.preventDefault();

    setActiveControlTarget(null);
    if (!selected) {
      selectEdge(id);
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const cursorFlow = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });

      const pathEl = getMeasurePath(edgePath);
      if (!pathEl) return;
      const totalLen = pathEl.getTotalLength();
      if (totalLen <= 1) return;

      const minDist = Math.min(totalLen * 0.5, boxWidth / 2 + 2);
      const maxDist = Math.max(totalLen * 0.5, totalLen - boxWidth / 2 - 2);

      const coarseSamples = 80;
      const step = (maxDist - minDist) / coarseSamples;
      let bestDist = minDist;
      let bestSq = Infinity;

      for (let i = 0; i <= coarseSamples; i++) {
        const d = minDist + i * step;
        const pt = pathEl.getPointAtLength(d);
        const sq =
          (pt.x - cursorFlow.x) * (pt.x - cursorFlow.x) +
          (pt.y - cursorFlow.y) * (pt.y - cursorFlow.y);
        if (sq < bestSq) {
          bestSq = sq;
          bestDist = d;
        }
      }

      const fineStart = Math.max(minDist, bestDist - step);
      const fineEnd = Math.min(maxDist, bestDist + step);
      const fineSamples = 20;
      const fineStep = (fineEnd - fineStart) / fineSamples;

      for (let i = 0; i <= fineSamples; i++) {
        const d = fineStart + i * fineStep;
        const pt = pathEl.getPointAtLength(d);
        const sq =
          (pt.x - cursorFlow.x) * (pt.x - cursorFlow.x) +
          (pt.y - cursorFlow.y) * (pt.y - cursorFlow.y);
        if (sq < bestSq) {
          bestSq = sq;
          bestDist = d;
        }
      }

      const nextOffset =
        Math.round(Math.max(0, Math.min(1, bestDist / totalLen)) * 1000) / 1000;
      updateEdgeIdentifier(id, side, { offset: nextOffset });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Calcula a posição e ângulo tangente exato sobre a linha do cabo e renderiza os identificadores arrastáveis
  const renderMovableCableIdentifiers = (boxHeight: number) => {
    if (!leftIdEnabled && !rightIdEnabled) return null;

    const pathEl = getMeasurePath(edgePath);
    const totalLen = pathEl ? pathEl.getTotalLength() : 0;

    const renderSingleIdentifier = (
      side: 'leftIdentifier' | 'rightIdentifier',
      text: string,
      boxWidth: number,
      customOffset: number | undefined
    ) => {
      let cx = side === 'leftIdentifier' ? wireSourceX : wireTargetX;
      let cy = side === 'leftIdentifier' ? wireSourceY : wireTargetY;
      let angleDeg = side === 'leftIdentifier' ? sourceAngle : targetAngle;

      if (pathEl && totalLen > 1) {
        const minDist = Math.min(totalLen * 0.5, boxWidth / 2 + 4);
        const maxDist = Math.max(totalLen * 0.5, totalLen - boxWidth / 2 - 4);
        const defaultDist =
          side === 'leftIdentifier'
            ? Math.min(totalLen * 0.45, boxWidth / 2 + 6)
            : Math.max(totalLen * 0.55, totalLen - boxWidth / 2 - 6);

        const targetDist =
          customOffset !== undefined
            ? Math.max(minDist, Math.min(maxDist, customOffset * totalLen))
            : defaultDist;

        const pt = pathEl.getPointAtLength(targetDist);
        const pBefore = pathEl.getPointAtLength(Math.max(0, targetDist - 4));
        const pAfter = pathEl.getPointAtLength(
          Math.min(totalLen, targetDist + 4)
        );
        cx = pt.x;
        cy = pt.y;
        angleDeg =
          (Math.atan2(pAfter.y - pBefore.y, pAfter.x - pBefore.x) * 180) /
          Math.PI;
      }

      const flipText = isAngleFlipped(angleDeg);

      return (
        <g
          key={side}
          transform={`translate(${cx}, ${cy}) rotate(${angleDeg})`}
          onMouseDown={(e) => handleDragIdentifier(side, boxWidth, e)}
          className="nodrag nopan cursor-grab active:cursor-grabbing select-none"
        >
          <title>
            Clique e arraste para mover o identificador ao longo do fio
          </title>
          {/* Área de clique ampliada para facilitar pegar e deslizar pelo fio */}
          <rect
            x={-boxWidth / 2 - 4}
            y={-boxHeight / 2 - 4}
            width={boxWidth + 8}
            height={boxHeight + 8}
            fill="transparent"
          />
          <rect
            x={-boxWidth / 2}
            y={-boxHeight / 2}
            width={boxWidth}
            height={boxHeight}
            rx="2"
            fill="#ffffff"
            stroke="#000000"
            strokeWidth="1.5"
          />
          <text
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#000000"
            fontSize="9.5"
            fontWeight="700"
            fontFamily="monospace"
            transform={flipText ? 'rotate(180, 0, 0)' : undefined}
          >
            {text}
          </text>
        </g>
      );
    };

    return (
      <>
        {leftIdEnabled &&
          renderSingleIdentifier(
            'leftIdentifier',
            leftIdText,
            leftIdWidth,
            leftIdentifier?.offset
          )}
        {rightIdEnabled &&
          renderSingleIdentifier(
            'rightIdentifier',
            rightIdText,
            rightIdWidth,
            rightIdentifier?.offset
          )}
      </>
    );
  };

  const handleClickCableBody = (event: React.MouseEvent<Element>) => {
    event.stopPropagation();
    setActiveControlTarget('cable');
    if (!selected) {
      selectEdge(id);
    }
  };

  if (viewMode === 'schematic') {
    const schIdHeight = Math.max(14, thickness + 8);
    return (
      <>
        {renderPinGuideLines()}
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: colorHex,
            strokeWidth: isVisuallySelected ? thickness + 1.5 : thickness,
            strokeLinecap: 'butt',
            filter: isVisuallySelected
              ? 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.8))'
              : undefined,
          }}
        />
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(18, thickness + 12)}
          onMouseDown={handleClickCableBody}
          className="cursor-pointer"
        />
        <g
          transform={`translate(${anchorSourceX}, ${anchorSourceY}) rotate(${sourceAngle})`}
          onMouseDown={(e) => handleDragTerminal('leftTerminal', e)}
          className="nodrag nopan cursor-move"
        >
          <title>Clique ou arraste para ajustar a Ponta Esq.</title>
          <rect
            x="-6"
            y="-10"
            width={Math.max(16, leftWireOffset + 8)}
            height="20"
            fill="transparent"
          />
          {leftTerminalEnabled ? (
            leftCustomDef && leftCustomMetrics ? (
              <CustomTerminalAttached
                terminal={leftCustomDef}
                terminalColorHex={leftTerminalColor}
                renderScale={leftCustomMetrics.renderScale}
                tipX={leftCustomMetrics.tipX}
                attachY={leftCustomMetrics.attachY}
              />
            ) : (
              <>
                <rect
                  x="0"
                  y="-3"
                  width={leftPinWidth}
                  height="6"
                  rx="1"
                  fill="#cbd5e1"
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
                {leftHeatShrink && (
                  <rect
                    x="0"
                    y="-4"
                    width={leftPinWidth + 1}
                    height="8"
                    rx="1.5"
                    fill="#09090b"
                    stroke="#52525b"
                    strokeWidth="1.2"
                  />
                )}
                <rect
                  x={leftPinWidth - 1}
                  y="-4.5"
                  width="12"
                  height="9"
                  rx="1.5"
                  fill={leftTerminalColor}
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
              </>
            )
          ) : (
            leftStripMm > 0 && (
              <>
                <rect
                  x="0"
                  y="-2"
                  width={Math.round(leftStripMm)}
                  height="4"
                  rx="1"
                  fill={leftStripFillColor}
                  stroke="#0f172a"
                  strokeWidth="1"
                />
                {leftHeatShrink && (
                  <rect
                    x="0"
                    y="-3.5"
                    width={Math.round(leftStripMm) + 2}
                    height="7"
                    rx="1.5"
                    fill="#09090b"
                    stroke="#52525b"
                    strokeWidth="1"
                  />
                )}
              </>
            )
          )}
        </g>
        <g
          transform={`translate(${anchorTargetX}, ${anchorTargetY}) rotate(${targetAngle})`}
          onMouseDown={(e) => handleDragTerminal('rightTerminal', e)}
          className="nodrag nopan cursor-move"
        >
          <title>Clique ou arraste para ajustar a Ponta Dir.</title>
          <rect
            x="-6"
            y="-10"
            width={Math.max(16, rightWireOffset + 8)}
            height="20"
            fill="transparent"
          />
          {rightTerminalEnabled ? (
            rightCustomDef && rightCustomMetrics ? (
              <CustomTerminalAttached
                terminal={rightCustomDef}
                terminalColorHex={rightTerminalColor}
                renderScale={rightCustomMetrics.renderScale}
                tipX={rightCustomMetrics.tipX}
                attachY={rightCustomMetrics.attachY}
              />
            ) : (
              <>
                <rect
                  x="0"
                  y="-3"
                  width={rightPinWidth}
                  height="6"
                  rx="1"
                  fill="#cbd5e1"
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
                {rightHeatShrink && (
                  <rect
                    x="0"
                    y="-4"
                    width={rightPinWidth + 1}
                    height="8"
                    rx="1.5"
                    fill="#09090b"
                    stroke="#52525b"
                    strokeWidth="1.2"
                  />
                )}
                <rect
                  x={rightPinWidth - 1}
                  y="-4.5"
                  width="12"
                  height="9"
                  rx="1.5"
                  fill={rightTerminalColor}
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
              </>
            )
          ) : (
            rightStripMm > 0 && (
              <>
                <rect
                  x="0"
                  y="-2"
                  width={Math.round(rightStripMm)}
                  height="4"
                  rx="1"
                  fill={rightStripFillColor}
                  stroke="#0f172a"
                  strokeWidth="1"
                />
                {rightHeatShrink && (
                  <rect
                    x="0"
                    y="-3.5"
                    width={Math.round(rightStripMm) + 2}
                    height="7"
                    rx="1.5"
                    fill="#09090b"
                    stroke="#52525b"
                    strokeWidth="1"
                  />
                )}
              </>
            )
          )}
        </g>
        {renderMovableCableIdentifiers(schIdHeight)}
        {renderAlignmentControls()}
      </>
    );
  }

  // MODO REALISTA: Renderiza o cabo físico cilíndrico terminando exatamente onde inicia o terminal
  const realisticWidth = Math.max(6, thickness * 2.4);
  const casingWidth = realisticWidth + 3;
  const highlightWidth = Math.max(1.5, realisticWidth * 0.28);
  const collarHeight = Math.max(10, realisticWidth + 4);
  const pinHeight = Math.max(4, Math.round(realisticWidth * 0.55));
  const sleeveHeight = Math.max(8, pinHeight + 4);
  const idSleeveHeight = Math.max(15, casingWidth + 3);

  return (
    <>
      {renderPinGuideLines()}

      {/* 1. Sombra projetada do cabo físico */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(15, 23, 42, 0.45)"
        strokeWidth={casingWidth + 3}
        strokeLinecap="butt"
        strokeLinejoin="round"
        style={{ transform: 'translate(2px, 4px)' }}
        className="pointer-events-none"
      />

      {/* 2. Contorno externo escuro da capa do fio */}
      <path
        d={edgePath}
        fill="none"
        stroke={isVisuallySelected ? '#38bdf8' : '#0f172a'}
        strokeWidth={casingWidth}
        strokeLinecap="butt"
        strokeLinejoin="round"
        className="pointer-events-none"
      />

      {/* 3. Isolamento principal de PVC na cor real do cabo */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: colorHex,
          strokeWidth: realisticWidth,
          strokeLinecap: 'butt',
          strokeLinejoin: 'round',
        }}
      />

      {/* 4. Reflexo especular cilíndrico central */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(255, 255, 255, 0.42)"
        strokeWidth={highlightWidth}
        strokeLinecap="butt"
        strokeLinejoin="round"
        className="pointer-events-none"
      />

      {/* Área clicável do corpo do cabo (para abrir apenas as opções de posição do cabo) */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(20, casingWidth + 10)}
        onMouseDown={handleClickCableBody}
        className="cursor-pointer"
      />

      {/* 5. Ponta Esquerda / Origem (Decape + Termoretrátil + Terminal Tubular) */}
      <g
        transform={`translate(${anchorSourceX}, ${anchorSourceY}) rotate(${sourceAngle})`}
        onMouseDown={(e) => handleDragTerminal('leftTerminal', e)}
        className="nodrag nopan cursor-move"
      >
        <title>Clique ou arraste para ajustar a Ponta Esq.</title>
        <rect
          x="-6"
          y={-collarHeight / 2 - 4}
          width={Math.max(18, leftWireOffset + 8)}
          height={collarHeight + 8}
          fill="transparent"
        />

        {leftTerminalEnabled ? (
          leftCustomDef && leftCustomMetrics ? (
            <CustomTerminalAttached
              terminal={leftCustomDef}
              terminalColorHex={leftTerminalColor}
              renderScale={leftCustomMetrics.renderScale}
              tipX={leftCustomMetrics.tipX}
              attachY={leftCustomMetrics.attachY}
            />
          ) : (
            <>
              <rect
                x="0"
                y={-pinHeight / 2}
                width={leftPinWidth}
                height={pinHeight}
                rx="1"
                fill="#cbd5e1"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              {leftHeatShrink && (
                <>
                  <rect
                    x="0"
                    y={-sleeveHeight / 2}
                    width={leftPinWidth + 1}
                    height={sleeveHeight}
                    rx="1.5"
                    fill="#09090b"
                    stroke="#3f3f46"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="1.5"
                    y1={-sleeveHeight * 0.22}
                    x2={Math.max(2, leftPinWidth - 1)}
                    y2={-sleeveHeight * 0.22}
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </>
              )}
              <rect
                x={leftPinWidth - 1}
                y={-collarHeight / 2}
                width="12"
                height={collarHeight}
                rx="2"
                fill={leftTerminalColor}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            </>
          )
        ) : (
          leftStripMm > 0 && (
            <>
              <rect
                x="0"
                y={-pinHeight / 2}
                width={Math.round(leftStripMm)}
                height={pinHeight}
                rx="1"
                fill={leftStripFillColor}
                stroke="#0f172a"
                strokeWidth="1.2"
              />
              {leftHeatShrink && (
                <>
                  <rect
                    x="0"
                    y={-sleeveHeight / 2}
                    width={Math.round(leftStripMm) + 2}
                    height={sleeveHeight}
                    rx="1.5"
                    fill="#09090b"
                    stroke="#3f3f46"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="1.5"
                    y1={-sleeveHeight * 0.22}
                    x2={Math.max(2, Math.round(leftStripMm))}
                    y2={-sleeveHeight * 0.22}
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </>
              )}
            </>
          )
        )}
      </g>

      {/* 6. Ponta Direita / Destino (Decape + Termoretrátil + Terminal Tubular) */}
      <g
        transform={`translate(${anchorTargetX}, ${anchorTargetY}) rotate(${targetAngle})`}
        onMouseDown={(e) => handleDragTerminal('rightTerminal', e)}
        className="nodrag nopan cursor-move"
      >
        <title>Clique ou arraste para ajustar a Ponta Dir.</title>
        <rect
          x="-6"
          y={-collarHeight / 2 - 4}
          width={Math.max(18, rightWireOffset + 8)}
          height={collarHeight + 8}
          fill="transparent"
        />

        {rightTerminalEnabled ? (
          rightCustomDef && rightCustomMetrics ? (
            <CustomTerminalAttached
              terminal={rightCustomDef}
              terminalColorHex={rightTerminalColor}
              renderScale={rightCustomMetrics.renderScale}
              tipX={rightCustomMetrics.tipX}
              attachY={rightCustomMetrics.attachY}
            />
          ) : (
            <>
              <rect
                x="0"
                y={-pinHeight / 2}
                width={rightPinWidth}
                height={pinHeight}
                rx="1"
                fill="#cbd5e1"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              {rightHeatShrink && (
                <>
                  <rect
                    x="0"
                    y={-sleeveHeight / 2}
                    width={rightPinWidth + 1}
                    height={sleeveHeight}
                    rx="1.5"
                    fill="#09090b"
                    stroke="#3f3f46"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="1.5"
                    y1={-sleeveHeight * 0.22}
                    x2={Math.max(2, rightPinWidth - 1)}
                    y2={-sleeveHeight * 0.22}
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </>
              )}
              <rect
                x={rightPinWidth - 1}
                y={-collarHeight / 2}
                width="12"
                height={collarHeight}
                rx="2"
                fill={rightTerminalColor}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            </>
          )
        ) : (
          rightStripMm > 0 && (
            <>
              <rect
                x="0"
                y={-pinHeight / 2}
                width={Math.round(rightStripMm)}
                height={pinHeight}
                rx="1"
                fill={rightStripFillColor}
                stroke="#0f172a"
                strokeWidth="1.2"
              />
              {rightHeatShrink && (
                <>
                  <rect
                    x="0"
                    y={-sleeveHeight / 2}
                    width={Math.round(rightStripMm) + 2}
                    height={sleeveHeight}
                    rx="1.5"
                    fill="#09090b"
                    stroke="#3f3f46"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="1.5"
                    y1={-sleeveHeight * 0.22}
                    x2={Math.max(2, Math.round(rightStripMm))}
                    y2={-sleeveHeight * 0.22}
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </>
              )}
            </>
          )
        )}
      </g>

      {/* 7. Identificadores sobre a linha do cabo (clicáveis e arrastáveis ao longo de todo o fio) */}
      {renderMovableCableIdentifiers(idSleeveHeight)}

      {renderAlignmentControls()}
    </>
  );
};
