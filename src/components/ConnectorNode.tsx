import React, { useEffect } from 'react';
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react';
import { Cpu, Cable, Radio, RotateCw, Trash2, PenTool } from 'lucide-react';
import type {
  ConnectorNodeType,
  ConnectorType,
  PinSide,
  PinCoordinate,
} from '../types/diagram';
import { useDiagramStore } from '../store/useDiagramStore';
import { CustomComponentCanvasSvg } from './CustomComponentSvg';

const PIN_SIDE_ORDER: PinSide[] = ['right', 'bottom', 'left', 'top'];

const HEADER_STYLES: Record<
  ConnectorType,
  { badgeBg: string; border: string; icon: React.ReactNode; tag: string }
> = {
  terminal: {
    badgeBg: 'bg-amber-600 text-white',
    border: 'border-amber-500/80',
    icon: <Cable className="w-4 h-4 text-amber-400" />,
    tag: 'TERMINAL BLOCK',
  },
  db9: {
    badgeBg: 'bg-indigo-600 text-white',
    border: 'border-indigo-500/80',
    icon: <Cpu className="w-4 h-4 text-indigo-400" />,
    tag: 'MULTIPIN CONNECTOR',
  },
  sensor: {
    badgeBg: 'bg-emerald-600 text-white',
    border: 'border-emerald-500/80',
    icon: <Radio className="w-4 h-4 text-emerald-400" />,
    tag: 'FIELD SENSOR',
  },
  custom: {
    badgeBg: 'bg-sky-600 text-white',
    border: 'border-sky-500/80',
    icon: <PenTool className="w-4 h-4 text-sky-400" />,
    tag: 'CUSTOM COMPONENT',
  },
};

const SIDE_TO_POSITION: Record<PinSide, Position> = {
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
  top: Position.Top,
};

const SIDE_LABELS: Record<PinSide, string> = {
  right: 'DIR',
  bottom: 'BAIXO',
  left: 'ESQ',
  top: 'TOPO',
};

// Rotaciona uma coordenada percentual (0..100, 0..100) em passos de 90° no sentido horário
const rotatePinCoordinate = (
  coord: PinCoordinate,
  rotationSteps: number
): PinCoordinate => {
  const step = ((rotationSteps % 4) + 4) % 4;
  switch (step) {
    case 1: // 90° horário
      return { x: 100 - coord.y, y: coord.x };
    case 2: // 180°
      return { x: 100 - coord.x, y: 100 - coord.y };
    case 3: // 270° horário
      return { x: coord.y, y: 100 - coord.x };
    default: // 0°
      return coord;
  }
};

export const ConnectorNode: React.FC<NodeProps<ConnectorNodeType>> = ({
  id,
  data,
  selected,
}) => {
  const viewMode = useDiagramStore((state) => state.viewMode);
  const rotateConnectorNode = useDiagramStore(
    (state) => state.rotateConnectorNode
  );
  const toggleHideNodePins = useDiagramStore(
    (state) => state.toggleHideNodePins
  );
  const resizeConnectorNode = useDiagramStore(
    (state) => state.resizeConnectorNode
  );
  const requestDeleteNode = useDiagramStore((state) => state.requestDeleteNode);
  const isAddingCableMode = useDiagramStore((state) => state.isAddingCableMode);
  const isExportingDiagram = useDiagramStore(
    (state) => state.isExportingDiagram
  );
  const showSelectionUi = Boolean(selected && !isExportingDiagram);
  const updateNodeInternals = useUpdateNodeInternals();
  const { screenToFlowPosition } = useReactFlow();

  const { label, partNumber, pinCount, type, imageUrl, drawing, pinPositions } =
    data;
  const hidePinNumbers = Boolean(data.hidePinNumbers);
  const imageSize = data.imageSize ?? 224;
  const nodeScale = Math.round((imageSize / 224) * 1000) / 1000;
  const pinSide: PinSide = data.pinSide ?? 'right';
  const defaultPinSide: PinSide = data.defaultPinSide ?? 'right';
  const handlePosition = SIDE_TO_POSITION[pinSide];
  const isHorizontalPins = pinSide === 'top' || pinSide === 'bottom';

  // Calcula quantos passos de 90° a imagem/desenho e as coordenadas dos pinos devem girar
  const defaultIndex = PIN_SIDE_ORDER.indexOf(defaultPinSide);
  const currentIndex = PIN_SIDE_ORDER.indexOf(pinSide);
  const rotationSteps = (currentIndex - defaultIndex + 4) % 4;
  const rotationDegrees = rotationSteps * 90;

  useEffect(() => {
    updateNodeInternals(id);
    const raf = requestAnimationFrame(() => {
      updateNodeInternals(id);
    });
    return () => cancelAnimationFrame(raf);
  }, [id, pinSide, viewMode, pinPositions, imageSize, drawing, updateNodeInternals]);

  const handleStartResize = (
    direction: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se',
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.stopPropagation();
    event.preventDefault();

    const startFlow = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const initialSize = imageSize;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentFlow = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      const dx = currentFlow.x - startFlow.x;
      const dy = currentFlow.y - startFlow.y;

      let delta = 0;
      if (direction === 'e') delta = dx;
      else if (direction === 'w') delta = -dx;
      else if (direction === 's') delta = dy;
      else if (direction === 'n') delta = -dy;
      else if (direction === 'se') delta = Math.max(dx, dy);
      else if (direction === 'nw') delta = Math.max(-dx, -dy);
      else if (direction === 'ne') delta = Math.max(dx, -dy);
      else if (direction === 'sw') delta = Math.max(-dx, dy);

      resizeConnectorNode(id, initialSize + delta);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Alças nas 4 laterais e nas 4 pontas da região completa do componente
  const renderResizeHandles = () => {
    if (!showSelectionUi) return null;
    return (
      <div className="contents print:hidden">
        <div
          onMouseDown={(e) => handleStartResize('n', e)}
          title="Arraste para redimensionar todo o componente"
          className="nodrag nopan absolute -top-2 inset-x-3 h-3 cursor-ns-resize z-30 flex items-center justify-center group"
        >
          <div className="w-10 h-1 rounded-full bg-sky-400 group-hover:bg-amber-400 shadow" />
        </div>
        <div
          onMouseDown={(e) => handleStartResize('s', e)}
          title="Arraste para redimensionar todo o componente"
          className="nodrag nopan absolute -bottom-2 inset-x-3 h-3 cursor-ns-resize z-30 flex items-center justify-center group"
        >
          <div className="w-10 h-1 rounded-full bg-sky-400 group-hover:bg-amber-400 shadow" />
        </div>
        <div
          onMouseDown={(e) => handleStartResize('w', e)}
          title="Arraste para redimensionar todo o componente"
          className="nodrag nopan absolute -left-2 inset-y-3 w-3 cursor-ew-resize z-30 flex items-center justify-center group"
        >
          <div className="h-10 w-1 rounded-full bg-sky-400 group-hover:bg-amber-400 shadow" />
        </div>
        <div
          onMouseDown={(e) => handleStartResize('e', e)}
          title="Arraste para redimensionar todo o componente"
          className="nodrag nopan absolute -right-2 inset-y-3 w-3 cursor-ew-resize z-30 flex items-center justify-center group"
        >
          <div className="h-10 w-1 rounded-full bg-sky-400 group-hover:bg-amber-400 shadow" />
        </div>

        <div
          onMouseDown={(e) => handleStartResize('nw', e)}
          title="Arraste a ponta para aumentar ou diminuir todo o componente"
          className="nodrag nopan absolute -top-2.5 -left-2.5 w-3.5 h-3.5 rounded-sm bg-sky-400 hover:bg-amber-400 border border-slate-950 shadow cursor-nwse-resize z-40"
        />
        <div
          onMouseDown={(e) => handleStartResize('ne', e)}
          title="Arraste a ponta para aumentar ou diminuir todo o componente"
          className="nodrag nopan absolute -top-2.5 -right-2.5 w-3.5 h-3.5 rounded-sm bg-sky-400 hover:bg-amber-400 border border-slate-950 shadow cursor-nesw-resize z-40"
        />
        <div
          onMouseDown={(e) => handleStartResize('sw', e)}
          title="Arraste a ponta para aumentar ou diminuir todo o componente"
          className="nodrag nopan absolute -bottom-2.5 -left-2.5 w-3.5 h-3.5 rounded-sm bg-sky-400 hover:bg-amber-400 border border-slate-950 shadow cursor-nesw-resize z-40"
        />
        <div
          onMouseDown={(e) => handleStartResize('se', e)}
          title="Arraste a ponta para aumentar ou diminuir todo o componente"
          className="nodrag nopan absolute -bottom-2.5 -right-2.5 w-3.5 h-3.5 rounded-sm bg-sky-400 hover:bg-amber-400 border border-slate-950 shadow cursor-nwse-resize z-40"
        />
      </div>
    );
  };

  // Botão com ícone de lixeira exibido quando o componente está selecionado
  const renderDeleteButton = (inline = false) => {
    if (!showSelectionUi) return null;
    return (
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          requestDeleteNode(id);
        }}
        title="Apagar componente"
        aria-label="Apagar componente"
        className={`nodrag nopan flex items-center justify-center w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-500 text-white border-2 border-slate-950 shadow-lg transition-transform hover:scale-105 cursor-pointer shrink-0 print:hidden ${
          inline ? '' : 'absolute -top-12 right-0 z-50'
        }`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    );
  };

  const styleConfig = HEADER_STYLES[type] ?? HEADER_STYLES.custom;
  const pins = Array.from({ length: pinCount }, (_, index) => index + 1);

  const bodyMinHeight = isHorizontalPins
    ? 110
    : Math.max(112, pinCount * 30 + 28);
  const bodyMinWidth = isHorizontalPins
    ? Math.max(240, pinCount * 44 + 32)
    : 240;

  // Renderiza os pinos padrão na borda (usado no Modo Esquema e como fallback genérico)
  const renderBorderHandlesAndPins = (realistic: boolean) => {
    return pins.map((pinNumber, idx) => {
      const percent = ((idx + 1) / (pinCount + 1)) * 100;
      const handlePositionStyle: React.CSSProperties = isHorizontalPins
        ? { left: `${percent}%` }
        : { top: `${percent}%` };

      const pinIndicatorStyle: React.CSSProperties =
        pinSide === 'right'
          ? { top: `${percent}%`, right: '10px', transform: 'translateY(-50%)' }
          : pinSide === 'left'
          ? { top: `${percent}%`, left: '10px', transform: 'translateY(-50%)' }
          : pinSide === 'bottom'
          ? {
              left: `${percent}%`,
              bottom: '10px',
              transform: 'translateX(-50%)',
            }
          : { left: `${percent}%`, top: '10px', transform: 'translateX(-50%)' };

      return (
        <div key={pinNumber} className="contents">
          <Handle
            type="source"
            position={handlePosition}
            id={`pin-${pinNumber}`}
            isConnectable={isAddingCableMode}
            style={handlePositionStyle}
            className={
              realistic
                ? '!w-4 !h-3.5 !rounded-sm !bg-amber-400 !border-2 !border-slate-950 hover:!bg-sky-300 transition-colors'
                : '!w-3.5 !h-3.5 !bg-sky-400 !border-2 !border-slate-950 hover:!bg-amber-300 transition-colors'
            }
          />

          <div
            style={pinIndicatorStyle}
            className={`absolute pointer-events-none flex items-center gap-1.5 z-10 ${
              pinSide === 'left'
                ? 'flex-row'
                : pinSide === 'right'
                ? 'flex-row-reverse'
                : pinSide === 'top'
                ? 'flex-col'
                : 'flex-col-reverse'
            }`}
          >
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shadow-sm ${
                realistic
                  ? 'bg-zinc-900/95 text-amber-300 border-zinc-600'
                  : 'bg-slate-900/95 text-slate-200 border-slate-700'
              }`}
            >
              P{pinNumber}
            </span>
          </div>
        </div>
      );
    });
  };

  // MODO ESQUEMA: Sempre renderiza o bloco técnico padronizado com pinos na tabela/borda
  if (viewMode === 'schematic') {
    return (
      <div
        style={{
          minWidth: `${bodyMinWidth}px`,
          transform: `scale(${nodeScale})`,
          transformOrigin: 'top left',
        }}
        className={`relative rounded-lg bg-slate-800 text-slate-100 border-2 shadow-xl transition-shadow ${
          styleConfig.border
        } ${
          showSelectionUi
            ? 'ring-2 ring-sky-400 shadow-sky-500/20 print:ring-0'
            : ''
        }`}
      >
        {renderResizeHandles()}
        {renderDeleteButton()}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 rounded-t-md border-b border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            {styleConfig.icon}
            <span className="font-bold text-xs tracking-wide uppercase truncate text-slate-100">
              {label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {showSelectionUi && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => rotateConnectorNode(id)}
                title="Girar posição dos pinos (90°)"
                className="nodrag nopan flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white border border-slate-600 text-[10px] font-mono font-semibold transition-colors cursor-pointer print:hidden"
              >
                <RotateCw className="w-3 h-3" />
                <span>{SIDE_LABELS[pinSide]}</span>
              </button>
            )}
            <span
              className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${styleConfig.badgeBg}`}
            >
              {pinCount}P
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-1 bg-slate-800/80 border-b border-slate-700/70 text-[11px] font-mono text-slate-400">
          <span>PN: {partNumber}</span>
          <span className="text-[10px] uppercase text-slate-400">
            PINOS: {SIDE_LABELS[pinSide]}
          </span>
        </div>

        <div
          className="relative px-4 py-3 flex items-center justify-center bg-slate-800 rounded-b-md"
          style={{ minHeight: `${bodyMinHeight}px` }}
        >
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 select-none pointer-events-none">
            {styleConfig.tag}
          </span>
          {renderBorderHandlesAndPins(false)}
        </div>
      </div>
    );
  }

  // MODO REALISTA COM DESENHO VETORIAL OU IMAGEM ENVIADA: Renderiza a peça e pontos redimensionáveis; descrição e controles só aparecem ao clicar (e somem na impressão)
  if (drawing || imageUrl) {
    return (
      <div
        style={{
          transform: `scale(${nodeScale})`,
          transformOrigin: 'top left',
        }}
        className={`relative select-none flex flex-col items-center p-1 ${
          showSelectionUi ? 'ring-2 ring-sky-400 rounded-xl print:ring-0' : ''
        }`}
      >
        {renderResizeHandles()}

        {/* Plaqueta de Identificação Física + Ocultar num. (ON/OFF) + Girar 90° + Lixeira (flutuante acima do componente, visível apenas ao clicar e oculta na impressão) */}
        {showSelectionUi && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag nopan absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 print:hidden"
          >
            <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-md font-mono min-w-[260px] whitespace-nowrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-extrabold uppercase tracking-tight truncate">
                  {label}
                </span>
                <span className="text-[9px] font-bold bg-slate-900 text-amber-300 px-1.5 py-0.5 rounded shrink-0">
                  {partNumber}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="nodrag flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-mono font-bold shadow">
                  <span className="text-slate-200">Ocultar num.</span>
                  <button
                    type="button"
                    onClick={() => toggleHideNodePins(id)}
                    title={
                      hidePinNumbers
                        ? 'Mostrar pontos numerados'
                        : 'Ocultar (deixar transparentes) os pontos numerados'
                    }
                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-extrabold border transition-colors cursor-pointer ${
                      hidePinNumbers
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                    }`}
                  >
                    {hidePinNumbers ? 'ON' : 'OFF'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => rotateConnectorNode(id)}
                  title="Girar componente e pinos (90°)"
                  className="nodrag flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-sky-700 text-white text-[10px] font-mono font-bold shadow transition-colors cursor-pointer shrink-0"
                >
                  <RotateCw className="w-3 h-3 text-amber-300" />
                  <span>{SIDE_LABELS[pinSide]}</span>
                </button>
              </div>
            </div>

            {renderDeleteButton(true)}
          </div>
        )}

        {/* Desenho vetorial do usuário ou imagem PNG com pinos (<Handle>) posicionados nos pontos mapeados */}
        <div className="relative w-56 h-56 flex items-center justify-center">
          {drawing ? (
            <CustomComponentCanvasSvg
              drawing={drawing}
              rotationDegrees={rotationDegrees}
              className="w-full h-full pointer-events-none select-none drop-shadow-xl"
            />
          ) : (
            <img
              src={imageUrl}
              alt={label}
              style={{ transform: `rotate(${rotationDegrees}deg)` }}
              className="w-full h-full object-contain pointer-events-none select-none drop-shadow-xl"
            />
          )}

          {pins.map((pinNumber, idx) => {
            const rawCoord: PinCoordinate = pinPositions?.[idx] ?? {
              x: 85,
              y: ((idx + 1) / (pinCount + 1)) * 100,
            };
            const rotatedCoord = rotatePinCoordinate(rawCoord, rotationSteps);

            return (
              <div key={pinNumber} className="contents">
                {/* Handle posicionado exatamente no ponto do pino (transparente quando Ocultar num. está ON) */}
                <Handle
                  type="source"
                  position={handlePosition}
                  id={`pin-${pinNumber}`}
                  isConnectable={isAddingCableMode}
                  style={{
                    left: `${rotatedCoord.x}%`,
                    top: `${rotatedCoord.y}%`,
                    right: 'auto',
                    bottom: 'auto',
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={
                    hidePinNumbers
                      ? '!w-5 !h-5 !rounded-full !bg-transparent !border-0 !shadow-none opacity-0 flex items-center justify-center z-20'
                      : '!w-5 !h-5 !rounded-full !bg-amber-400/95 hover:!bg-sky-300 !border-2 !border-slate-950 shadow-md flex items-center justify-center transition-transform hover:scale-125 z-20'
                  }
                >
                  <span
                    className={`pointer-events-none text-[8px] font-mono font-extrabold text-slate-950 leading-none ${
                      hidePinNumbers ? 'opacity-0' : ''
                    }`}
                  >
                    {pinNumber}
                  </span>
                </Handle>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback genérico (para componentes antigos salvos sem desenho nem imagem)
  return (
    <div
      style={{
        minWidth: `${bodyMinWidth}px`,
        transform: `scale(${nodeScale})`,
        transformOrigin: 'top left',
      }}
      className={`relative select-none p-1 ${
        showSelectionUi ? 'ring-2 ring-sky-400 rounded-xl print:ring-0' : ''
      }`}
    >
      {renderResizeHandles()}

      {showSelectionUi && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag nopan absolute bottom-full mb-3 left-0 min-w-full z-50 flex items-center gap-1.5 print:hidden"
        >
          <div className="flex-1 flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-md font-mono whitespace-nowrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-extrabold uppercase tracking-tight truncate">
                {label}
              </span>
              <span className="text-[9px] font-bold bg-slate-900 text-amber-300 px-1.5 py-0.5 rounded shrink-0">
                {partNumber}
              </span>
            </div>

            <button
              type="button"
              onClick={() => rotateConnectorNode(id)}
              title="Girar lado dos pinos do conector (90°)"
              className="nodrag flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-sky-700 text-white text-[10px] font-mono font-bold shadow transition-colors cursor-pointer shrink-0"
            >
              <RotateCw className="w-3 h-3 text-amber-300" />
              <span>Girar ({SIDE_LABELS[pinSide]})</span>
            </button>
          </div>

          {renderDeleteButton(true)}
        </div>
      )}

      <div
        className="relative rounded-xl border-2 border-slate-600 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 text-slate-100 shadow-2xl flex items-center justify-center"
        style={{ minHeight: `${bodyMinHeight}px` }}
      >
        <div className="px-3 py-1 rounded bg-slate-950/90 text-sky-300 border border-slate-600 text-[10px] font-mono font-bold pointer-events-none shadow">
          {label} ({pinCount}P)
        </div>

        {renderBorderHandlesAndPins(true)}
      </div>
    </div>
  );
};
