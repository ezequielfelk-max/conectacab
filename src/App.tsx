import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type OnConnectEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Trash2, Cable, X, AlertCircle, ClipboardPaste } from 'lucide-react';

import { useDiagramStore } from './store/useDiagramStore';
import { ConnectorNode } from './components/ConnectorNode';
import { WireAnchorNode } from './components/WireAnchorNode';
import { WireEdge } from './components/WireEdge';
import { Sidebar } from './components/Sidebar';
import { BomPanel } from './components/BomPanel';
import { ExportButton } from './components/ExportButton';
import { TerminalDesignerTab } from './components/TerminalDesignerTab';
import { ComponentDesignerTab } from './components/ComponentDesignerTab';
import type { ConnectorNodeType } from './types/diagram';
import { isClientPointInsideAnyConnector } from './utils/connectorBounds';

const nodeTypes: NodeTypes = {
  connector: ConnectorNode,
  wireAnchor: WireAnchorNode,
};

const edgeTypes: EdgeTypes = {
  wire: WireEdge,
};

const DiagramCanvas: React.FC = () => {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const onNodesChange = useDiagramStore((state) => state.onNodesChange);
  const onEdgesChange = useDiagramStore((state) => state.onEdgesChange);
  const onConnect = useDiagramStore((state) => state.onConnect);
  const addConnectorNode = useDiagramStore((state) => state.addConnectorNode);
  const addFreeCable = useDiagramStore((state) => state.addFreeCable);
  const activeWirePreset = useDiagramStore((state) => state.activeWirePreset);
  const pendingDeleteTarget = useDiagramStore(
    (state) => state.pendingDeleteTarget
  );
  const cancelDelete = useDiagramStore((state) => state.cancelDelete);
  const confirmDelete = useDiagramStore((state) => state.confirmDelete);
  const isAddingCableMode = useDiagramStore((state) => state.isAddingCableMode);
  const setAddingCableMode = useDiagramStore(
    (state) => state.setAddingCableMode
  );
  const copiedWire = useDiagramStore((state) => state.copiedWire);
  const isPastingCableMode = useDiagramStore(
    (state) => state.isPastingCableMode
  );
  const startPastingCableMode = useDiagramStore(
    (state) => state.startPastingCableMode
  );
  const cancelPastingCableMode = useDiagramStore(
    (state) => state.cancelPastingCableMode
  );
  const clearCopiedWire = useDiagramStore((state) => state.clearCopiedWire);
  const pasteCopiedWireAt = useDiagramStore((state) => state.pasteCopiedWireAt);
  const isTerminalDesignerOpen = useDiagramStore(
    (state) => state.isTerminalDesignerOpen
  );
  const isComponentDesignerOpen = useDiagramStore(
    (state) => state.isComponentDesignerOpen
  );

  const mainRef = useRef<HTMLElement>(null);
  const warningTimerRef = useRef<number | null>(null);
  const justFinishedFreeCableRef = useRef<boolean>(false);
  const [freeCableStart, setFreeCableStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [cursorFlowPos, setCursorFlowPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pasteCursorFlowPos, setPasteCursorFlowPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isCursorBlocked, setIsCursorBlocked] = useState<boolean>(false);
  const [cablePlacementWarning, setCablePlacementWarning] = useState<
    string | null
  >(null);

  const showCableWarning = useCallback((message: string) => {
    setCablePlacementWarning(message);
    if (warningTimerRef.current !== null) {
      window.clearTimeout(warningTimerRef.current);
    }
    warningTimerRef.current = window.setTimeout(() => {
      setCablePlacementWarning(null);
      warningTimerRef.current = null;
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (warningTimerRef.current !== null) {
        window.clearTimeout(warningTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAddingCableMode) {
      setFreeCableStart(null);
      setCursorFlowPos(null);
      setIsCursorBlocked(false);
    }
  }, [isAddingCableMode]);

  useEffect(() => {
    if (!isPastingCableMode) {
      setPasteCursorFlowPos(null);
    }
  }, [isPastingCableMode]);

  const pendingDeleteNode =
    pendingDeleteTarget?.type === 'node'
      ? nodes.find(
          (node): node is ConnectorNodeType =>
            node.type === 'connector' && node.id === pendingDeleteTarget.id
        ) ?? null
      : null;

  const pendingDeleteEdge =
    pendingDeleteTarget?.type === 'edge'
      ? edges.find((edge) => edge.id === pendingDeleteTarget.id) ?? null
      : null;

  const hasPendingDelete = Boolean(pendingDeleteNode || pendingDeleteEdge);

  useEffect(() => {
    if (
      !hasPendingDelete &&
      !isAddingCableMode &&
      !isPastingCableMode &&
      !copiedWire
    ) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (event.key === 'Escape') {
        if (hasPendingDelete) {
          cancelDelete();
        } else if (isPastingCableMode) {
          cancelPastingCableMode();
        } else if (freeCableStart) {
          setFreeCableStart(null);
          setCursorFlowPos(null);
          setIsCursorBlocked(false);
        } else if (isAddingCableMode) {
          setAddingCableMode(false);
        }
      } else if (
        !isTyping &&
        !isTerminalDesignerOpen &&
        !isComponentDesignerOpen &&
        copiedWire &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'v'
      ) {
        event.preventDefault();
        startPastingCableMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hasPendingDelete,
    freeCableStart,
    isAddingCableMode,
    isPastingCableMode,
    copiedWire,
    isTerminalDesignerOpen,
    isComponentDesignerOpen,
    cancelDelete,
    setAddingCableMode,
    cancelPastingCableMode,
    startPastingCableMode,
  ]);

  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();

  // Ao arrastar de um pino numerado e soltar em área livre fora dos componentes, cria cabo com ponta livre
  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!isAddingCableMode) return;
      if (connectionState.isValid) return;
      if (!connectionState.fromNode || !connectionState.fromHandle?.id) return;

      const targetEl = event.target as HTMLElement | null;
      if (targetEl?.closest('.react-flow__handle')) return;

      const point =
        'changedTouches' in event
          ? event.changedTouches[0]
          : (event as MouseEvent);
      if (!point) return;

      const dropFlowPos = screenToFlowPosition({
        x: point.clientX,
        y: point.clientY,
      });

      const fromPos = connectionState.from;
      if (
        fromPos &&
        Math.hypot(dropFlowPos.x - fromPos.x, dropFlowPos.y - fromPos.y) < 12
      ) {
        return;
      }

      if (isClientPointInsideAnyConnector(point.clientX, point.clientY)) {
        showCableWarning(
          'Dentro do componente, conecte o cabo apenas nos pontos numerados.'
        );
        return;
      }

      addFreeCable(
        {
          kind: 'pin',
          nodeId: connectionState.fromNode.id,
          handleId: connectionState.fromHandle.id,
          position: fromPos ?? undefined,
        },
        {
          kind: 'free',
          position: dropFlowPos,
        }
      );
      justFinishedFreeCableRef.current = true;
      window.setTimeout(() => {
        justFinishedFreeCableRef.current = false;
      }, 150);
    },
    [isAddingCableMode, screenToFlowPosition, addFreeCable, showCableWarning]
  );

  // Inicia um cabo livre ao clicar em qualquer área aberta fora dos componentes
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isAddingCableMode) return;
      if (justFinishedFreeCableRef.current) {
        justFinishedFreeCableRef.current = false;
        return;
      }
      if (freeCableStart !== null) return;

      if (isClientPointInsideAnyConnector(event.clientX, event.clientY)) {
        showCableWarning(
          'Dentro do componente, conecte o cabo apenas nos pontos numerados.'
        );
        return;
      }

      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setFreeCableStart(flowPos);
      setCursorFlowPos(flowPos);
      setIsCursorBlocked(false);
    },
    [isAddingCableMode, freeCableStart, screenToFlowPosition, showCableWarning]
  );

  // Atualiza a linha de pré-visualização enquanto o usuário escolhe o ponto final do cabo livre ou onde colar
  const handleMainMouseMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (isPastingCableMode && copiedWire) {
        setPasteCursorFlowPos(
          screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          })
        );
        return;
      }

      if (!isAddingCableMode || !freeCableStart) return;
      const targetEl = event.target as HTMLElement | null;
      const isOverHandle = Boolean(targetEl?.closest('.react-flow__handle'));
      const insideConnector = isClientPointInsideAnyConnector(
        event.clientX,
        event.clientY
      );
      setIsCursorBlocked(!isOverHandle && insideConnector);
      setCursorFlowPos(
        screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
      );
    },
    [
      isPastingCableMode,
      copiedWire,
      isAddingCableMode,
      freeCableStart,
      screenToFlowPosition,
    ]
  );

  // Finaliza colagem de cabo copiado ou cabo livre ao clicar no diagrama
  const handleMainMouseDownCapture = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (isPastingCableMode && copiedWire) {
        if (event.button === 2) {
          event.preventDefault();
          event.stopPropagation();
          cancelPastingCableMode();
          return;
        }

        if (event.button !== 0) return;

        const targetEl = event.target as HTMLElement | null;
        if (
          !targetEl?.closest('.react-flow') ||
          targetEl.closest('.react-flow__controls') ||
          targetEl.closest('.print-hide')
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        const pastePos = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        pasteCopiedWireAt(pastePos);
        return;
      }

      if (!isAddingCableMode || !freeCableStart) return;

      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        setFreeCableStart(null);
        setCursorFlowPos(null);
        setIsCursorBlocked(false);
        justFinishedFreeCableRef.current = true;
        window.setTimeout(() => {
          justFinishedFreeCableRef.current = false;
        }, 150);
        return;
      }

      if (event.button !== 0) return;

      const targetEl = event.target as HTMLElement | null;
      if (
        !targetEl?.closest('.react-flow') ||
        targetEl.closest('.react-flow__controls')
      ) {
        return;
      }

      const handleEl = targetEl.closest(
        '.react-flow__handle'
      ) as HTMLElement | null;

      if (handleEl) {
        const nodeId = handleEl.getAttribute('data-nodeid');
        const handleId = handleEl.getAttribute('data-handleid');
        if (nodeId && handleId && handleId !== 'anchor') {
          event.stopPropagation();
          event.preventDefault();
          const rect = handleEl.getBoundingClientRect();
          const pinFlowPos = screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
          addFreeCable(
            { kind: 'free', position: freeCableStart },
            { kind: 'pin', nodeId, handleId, position: pinFlowPos }
          );
          setFreeCableStart(null);
          setCursorFlowPos(null);
          setIsCursorBlocked(false);
          justFinishedFreeCableRef.current = true;
          window.setTimeout(() => {
            justFinishedFreeCableRef.current = false;
          }, 150);
          return;
        }
      }

      if (isClientPointInsideAnyConnector(event.clientX, event.clientY)) {
        event.stopPropagation();
        event.preventDefault();
        showCableWarning(
          'Dentro do componente, conecte o cabo apenas nos pontos numerados.'
        );
        return;
      }

      event.stopPropagation();
      event.preventDefault();
      const endFlowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (
        Math.hypot(
          endFlowPos.x - freeCableStart.x,
          endFlowPos.y - freeCableStart.y
        ) < 8
      ) {
        return;
      }

      addFreeCable(
        { kind: 'free', position: freeCableStart },
        { kind: 'free', position: endFlowPos }
      );
      setFreeCableStart(null);
      setCursorFlowPos(null);
      setIsCursorBlocked(false);
      justFinishedFreeCableRef.current = true;
      window.setTimeout(() => {
        justFinishedFreeCableRef.current = false;
      }, 150);
    },
    [
      isPastingCableMode,
      copiedWire,
      cancelPastingCableMode,
      pasteCopiedWireAt,
      isAddingCableMode,
      freeCableStart,
      screenToFlowPosition,
      addFreeCable,
      showCableWarning,
    ]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const catalogId = event.dataTransfer.getData('application/reactflow');
      if (!catalogId) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addConnectorNode(catalogId, position);
    },
    [screenToFlowPosition, addConnectorNode]
  );

  const previewLineCoords = (() => {
    if (!isAddingCableMode || !freeCableStart || !cursorFlowPos || !mainRef.current) {
      return null;
    }
    const mainRect = mainRef.current.getBoundingClientRect();
    const startScreen = flowToScreenPosition(freeCableStart);
    const endScreen = flowToScreenPosition(cursorFlowPos);
    return {
      x1: startScreen.x - mainRect.left,
      y1: startScreen.y - mainRect.top,
      x2: endScreen.x - mainRect.left,
      y2: endScreen.y - mainRect.top,
    };
  })();

  const pastePreviewCoords = (() => {
    if (
      !isPastingCableMode ||
      !copiedWire ||
      !pasteCursorFlowPos ||
      !mainRef.current
    ) {
      return null;
    }
    const mainRect = mainRef.current.getBoundingClientRect();
    const startScreen = flowToScreenPosition({
      x: pasteCursorFlowPos.x - copiedWire.halfDx,
      y: pasteCursorFlowPos.y - copiedWire.halfDy,
    });
    const endScreen = flowToScreenPosition({
      x: pasteCursorFlowPos.x + copiedWire.halfDx,
      y: pasteCursorFlowPos.y + copiedWire.halfDy,
    });
    const centerScreen = flowToScreenPosition(pasteCursorFlowPos);
    return {
      x1: startScreen.x - mainRect.left,
      y1: startScreen.y - mainRect.top,
      x2: endScreen.x - mainRect.left,
      y2: endScreen.y - mainRect.top,
      cx: centerScreen.x - mainRect.left,
      cy: centerScreen.y - mainRect.top,
    };
  })();

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-slate-950">
      {/* Sidebar fixa na lateral esquerda */}
      <Sidebar />

      {/* Wrapper do Canvas de tela cheia */}
      <main
        ref={mainRef}
        className="relative flex-1 h-full"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMouseMove={handleMainMouseMove}
        onMouseDownCapture={handleMainMouseDownCapture}
      >
        {/* Indicador flutuante quando o modo Colar Cabo está ativo */}
        {isPastingCableMode && copiedWire && (
          <div className="print-hide absolute top-4 left-4 z-20 flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sky-950/95 border border-sky-400/80 shadow-lg backdrop-blur-md text-xs text-sky-100">
            <ClipboardPaste className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-semibold">
              Clique no local do diagrama onde deseja colar o cabo (ESC ou botão direito cancela)
            </span>
            <button
              type="button"
              onClick={cancelPastingCableMode}
              title="Cancelar colagem"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-800/80 hover:bg-sky-700 text-sky-100 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Cancelar</span>
            </button>
          </div>
        )}

        {/* Barra compacta indicando cabo copiado pronto para colar */}
        {!isPastingCableMode && !isAddingCableMode && copiedWire && (
          <div className="print-hide absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/95 border border-slate-700 shadow-lg backdrop-blur-md text-xs text-slate-200">
            <span
              className="w-3 h-3 rounded-full border border-white/60 shrink-0"
              style={{ backgroundColor: copiedWire.data.colorHex }}
            />
            <span className="font-medium">
              Cabo copiado ({copiedWire.data.awg})
            </span>
            <button
              type="button"
              onClick={startPastingCableMode}
              title="Escolher local no diagrama para colar o cabo"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <ClipboardPaste className="w-3 h-3" />
              <span>Colar</span>
            </button>
            <button
              type="button"
              onClick={clearCopiedWire}
              title="Limpar cabo copiado"
              className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Indicador flutuante quando o modo Adicionar Cabo está ativo */}
        {isAddingCableMode && (
          <div className="print-hide absolute top-4 left-4 z-20 flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-950/95 border border-emerald-500/70 shadow-lg backdrop-blur-md text-xs text-emerald-100">
            <Cable className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">
              {freeCableStart
                ? 'Clique em qualquer área livre ou em um ponto numerado para finalizar o cabo'
                : 'Modo Adicionar Cabo ativo — conecte pinos ou clique na área livre'}
            </span>
            <button
              type="button"
              onClick={() => setAddingCableMode(false)}
              title="Desativar modo Adicionar Cabo"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Desativar</span>
            </button>
          </div>
        )}

        {/* Aviso temporário se tentar soltar cabo dentro da caixa de um componente fora dos pinos */}
        {cablePlacementWarning && (
          <div className="print-hide absolute top-16 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-950/95 border border-rose-500/80 shadow-xl backdrop-blur-md text-xs text-rose-100">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{cablePlacementWarning}</span>
          </div>
        )}

        {/* Barra Superior Flutuante com Exportação de Artefato Técnico */}
        <div className="print-hide absolute top-4 right-4 z-20 flex items-center gap-3">
          <ExportButton />
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={handleConnectEnd}
          onPaneClick={handlePaneClick}
          nodesConnectable={isAddingCableMode}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect={true}
          defaultEdgeOptions={{ type: 'wire', zIndex: 2000 }}
          fitView
          className={`bg-slate-950 [&_.react-flow__edges]:!z-[2000] [&_.react-flow__nodes]:!z-[10] ${
            isAddingCableMode || isPastingCableMode
              ? '[&_.react-flow__pane]:!cursor-crosshair'
              : ''
          }`}
        >
          <Controls className="!bg-slate-800 !border-slate-700 !shadow-lg [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!fill-slate-200 hover:[&>button]:!bg-slate-700" />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="#334155"
          />
        </ReactFlow>

        {/* Pré-visualização em tempo real do cabo copiado seguindo o mouse antes de colar */}
        {pastePreviewCoords && copiedWire && (
          <svg className="pointer-events-none absolute inset-0 w-full h-full z-[2500] overflow-visible">
            <line
              x1={pastePreviewCoords.x1}
              y1={pastePreviewCoords.y1}
              x2={pastePreviewCoords.x2}
              y2={pastePreviewCoords.y2}
              stroke="#0f172a"
              strokeWidth={Math.max(5, copiedWire.data.thickness + 3)}
              strokeLinecap="round"
              strokeDasharray="8 5"
              opacity={0.7}
            />
            <line
              x1={pastePreviewCoords.x1}
              y1={pastePreviewCoords.y1}
              x2={pastePreviewCoords.x2}
              y2={pastePreviewCoords.y2}
              stroke={copiedWire.data.colorHex}
              strokeWidth={Math.max(2.5, copiedWire.data.thickness)}
              strokeLinecap="round"
              strokeDasharray="8 5"
              opacity={0.9}
            />
            <circle
              cx={pastePreviewCoords.x1}
              cy={pastePreviewCoords.y1}
              r={5}
              fill={
                copiedWire.data.leftTerminal?.colorHex ??
                copiedWire.data.colorHex
              }
              stroke="#ffffff"
              strokeWidth={2}
            />
            <circle
              cx={pastePreviewCoords.x2}
              cy={pastePreviewCoords.y2}
              r={5}
              fill={
                copiedWire.data.rightTerminal?.colorHex ??
                copiedWire.data.colorHex
              }
              stroke="#ffffff"
              strokeWidth={2}
            />
            <circle
              cx={pastePreviewCoords.cx}
              cy={pastePreviewCoords.cy}
              r={3.5}
              fill="#38bdf8"
              stroke="#0f172a"
              strokeWidth={1.5}
            />
          </svg>
        )}

        {/* Pré-visualização em tempo real do cabo livre sendo desenhado */}
        {previewLineCoords && (
          <svg className="pointer-events-none absolute inset-0 w-full h-full z-[2500] overflow-visible">
            <line
              x1={previewLineCoords.x1}
              y1={previewLineCoords.y1}
              x2={previewLineCoords.x2}
              y2={previewLineCoords.y2}
              stroke="#0f172a"
              strokeWidth={Math.max(5, activeWirePreset.thickness + 3)}
              strokeLinecap="round"
              strokeDasharray="8 6"
              opacity={0.75}
            />
            <line
              x1={previewLineCoords.x1}
              y1={previewLineCoords.y1}
              x2={previewLineCoords.x2}
              y2={previewLineCoords.y2}
              stroke={isCursorBlocked ? '#f43f5e' : activeWirePreset.colorHex}
              strokeWidth={Math.max(2.5, activeWirePreset.thickness)}
              strokeLinecap="round"
              strokeDasharray="8 6"
            />
            <circle
              cx={previewLineCoords.x1}
              cy={previewLineCoords.y1}
              r={5}
              fill={activeWirePreset.colorHex}
              stroke="#ffffff"
              strokeWidth={2}
            />
            <circle
              cx={previewLineCoords.x2}
              cy={previewLineCoords.y2}
              r={5}
              fill={isCursorBlocked ? '#f43f5e' : '#38bdf8'}
              stroke="#ffffff"
              strokeWidth={2}
            />
          </svg>
        )}

        {/* Módulo de Lista de Materiais (BOM) */}
        <BomPanel />
      </main>

      {/* Modal de confirmação para apagar componente ou cabo do diagrama */}
      {hasPendingDelete && (
        <div
          className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          onClick={cancelDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-item-modal-title"
        >
          <div
            className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-11 h-11 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>

              <h3
                id="delete-item-modal-title"
                className="text-base font-bold text-slate-100"
              >
                Você tem certeza que quer apagar?
              </h3>

              {pendingDeleteNode && (
                <p className="text-xs text-slate-400">
                  Componente:{' '}
                  <span className="font-semibold text-slate-200">
                    {pendingDeleteNode.data.label}
                  </span>
                </p>
              )}

              {pendingDeleteEdge && (
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <span>Cabo:</span>
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-white/60 shrink-0"
                    style={{
                      backgroundColor:
                        pendingDeleteEdge.data?.colorHex ?? '#ef4444',
                    }}
                  />
                  <span className="font-semibold text-slate-200">
                    {pendingDeleteEdge.data?.awg ?? 'Cabo selecionado'}
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-800/70 border-t border-slate-700/80">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Não
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Aba de Personalização e Desenho de Terminal */}
      {isTerminalDesignerOpen && <TerminalDesignerTab />}
      {/* Aba de Desenho e Cadastro de Novo Componente */}
      {isComponentDesignerOpen && <ComponentDesignerTab />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DiagramCanvas />
    </ReactFlowProvider>
  );
};

export default App;
