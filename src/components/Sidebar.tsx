import React, { useState, useEffect, useRef } from 'react';
import {
  Cable,
  Cpu,
  Radio,
  GripVertical,
  Sparkles,
  Plus,
  Minus,
  X,
  Image as ImageIcon,
  Pencil,
  Check,
  ChevronDown,
  PenTool,
} from 'lucide-react';
import {
  WIRE_GAUGE_STEPS,
  WIRE_COLOR_OPTIONS,
  MIN_STRIP_LENGTH,
  MAX_STRIP_LENGTH,
  DEFAULT_STRIP_LENGTH,
  useDiagramStore,
} from '../store/useDiagramStore';
import type {
  ConnectorType,
  CustomTerminalDefinition,
  WireEdgeType,
  WirePreset,
} from '../types/diagram';
import { getCustomTerminalRenderMetrics } from '../utils/customTerminal';
import {
  CustomTerminalAttached,
  CustomTerminalThumbnail,
} from './CustomTerminalSvg';
import { CustomComponentThumbnail } from './CustomComponentSvg';

const CONNECTOR_ICONS: Record<ConnectorType, React.ReactNode> = {
  terminal: <Cable className="w-5 h-5 text-amber-400" />,
  db9: <Cpu className="w-5 h-5 text-indigo-400" />,
  sensor: <Radio className="w-5 h-5 text-emerald-400" />,
  custom: <PenTool className="w-5 h-5 text-sky-400" />,
};

const findWireColorName = (colorHex: string): string => {
  const match = WIRE_COLOR_OPTIONS.find(
    (opt) => opt.colorHex.toLowerCase() === colorHex.toLowerCase()
  );
  return match ? match.colorName : `Custom (${colorHex.toUpperCase()})`;
};

const findShortColorName = (colorHex: string): string => {
  const full = findWireColorName(colorHex);
  return full.replace(/\s*\(.*?\)\s*/g, '').trim() || full;
};

const edgeToWirePreset = (edge: WireEdgeType): WirePreset => {
  const data = edge.data;
  const awg = data?.awg ?? '24 AWG';
  const colorHex = data?.colorHex ?? '#ef4444';
  const thickness = data?.thickness ?? 2.5;
  const leftTermHex = data?.leftTerminal?.colorHex ?? colorHex;
  const rightTermHex = data?.rightTerminal?.colorHex ?? colorHex;

  return {
    id: edge.id,
    awg,
    colorHex,
    colorName: findWireColorName(colorHex),
    label: data?.label ?? awg,
    thickness,
    leftStripLength: data?.leftStripLength ?? DEFAULT_STRIP_LENGTH,
    rightStripLength: data?.rightStripLength ?? DEFAULT_STRIP_LENGTH,
    leftTinned: data?.leftTinned ?? false,
    rightTinned: data?.rightTinned ?? false,
    leftHeatShrink: data?.leftHeatShrink ?? false,
    rightHeatShrink: data?.rightHeatShrink ?? false,
    leftTerminal: {
      enabled: data?.leftTerminal?.enabled ?? true,
      type: data?.leftTerminal?.type ?? 'tubular',
      customTerminalId: data?.leftTerminal?.customTerminalId,
      label: data?.leftTerminal?.label ?? 'Terminal Tubular',
      colorHex: leftTermHex,
      colorName:
        data?.leftTerminal?.colorName || findShortColorName(leftTermHex),
    },
    rightTerminal: {
      enabled: data?.rightTerminal?.enabled ?? true,
      type: data?.rightTerminal?.type ?? 'tubular',
      customTerminalId: data?.rightTerminal?.customTerminalId,
      label: data?.rightTerminal?.label ?? 'Terminal Tubular',
      colorHex: rightTermHex,
      colorName:
        data?.rightTerminal?.colorName || findShortColorName(rightTermHex),
    },
    leftIdentifier: {
      enabled: data?.leftIdentifier?.enabled ?? false,
      text: data?.leftIdentifier?.text ?? 'CABO-ESQ',
    },
    rightIdentifier: {
      enabled: data?.rightIdentifier?.enabled ?? false,
      text: data?.rightIdentifier?.text ?? 'CABO-DIR',
    },
  };
};

export const Sidebar: React.FC = () => {
  const catalog = useDiagramStore((state) => state.catalog);
  const openComponentDesigner = useDiagramStore(
    (state) => state.openComponentDesigner
  );
  const removeCatalogItem = useDiagramStore((state) => state.removeCatalogItem);
  const storedActiveWirePreset = useDiagramStore(
    (state) => state.activeWirePreset
  );
  const setStoredActiveWirePreset = useDiagramStore(
    (state) => state.setActiveWirePreset
  );
  const edges = useDiagramStore((state) => state.edges);
  const editingEdgeId = useDiagramStore((state) => state.editingEdgeId);
  const stopEditingEdge = useDiagramStore((state) => state.stopEditingEdge);
  const updateEdgeWireParams = useDiagramStore(
    (state) => state.updateEdgeWireParams
  );
  const isAddingCableMode = useDiagramStore((state) => state.isAddingCableMode);
  const toggleAddingCableMode = useDiagramStore(
    (state) => state.toggleAddingCableMode
  );
  const viewMode = useDiagramStore((state) => state.viewMode);
  const customTerminals = useDiagramStore((state) => state.customTerminals);
  const openTerminalDesigner = useDiagramStore(
    (state) => state.openTerminalDesigner
  );
  const removeCustomTerminal = useDiagramStore(
    (state) => state.removeCustomTerminal
  );

  const wireSectionRef = useRef<HTMLDivElement>(null);
  const terminalMenuRef = useRef<HTMLDivElement>(null);
  const [openTerminalMenuSide, setOpenTerminalMenuSide] = useState<
    'leftTerminal' | 'rightTerminal' | null
  >(null);

  useEffect(() => {
    if (!openTerminalMenuSide) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        terminalMenuRef.current &&
        !terminalMenuRef.current.contains(event.target as Node)
      ) {
        setOpenTerminalMenuSide(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [openTerminalMenuSide]);

  const editingEdge =
    editingEdgeId !== null
      ? edges.find((edge) => edge.id === editingEdgeId) ?? null
      : null;

  const activeWirePreset: WirePreset = editingEdge
    ? edgeToWirePreset(editingEdge)
    : storedActiveWirePreset;

  const setActiveWirePreset = (nextPreset: WirePreset) => {
    if (editingEdge) {
      updateEdgeWireParams(editingEdge.id, nextPreset);
    } else {
      setStoredActiveWirePreset(nextPreset);
    }
  };

  const activeLeftCustomTerminal =
    activeWirePreset.leftTerminal.type === 'custom' &&
    activeWirePreset.leftTerminal.customTerminalId
      ? customTerminals.find(
          (t) => t.id === activeWirePreset.leftTerminal.customTerminalId
        ) ?? null
      : null;

  const activeRightCustomTerminal =
    activeWirePreset.rightTerminal.type === 'custom' &&
    activeWirePreset.rightTerminal.customTerminalId
      ? customTerminals.find(
          (t) => t.id === activeWirePreset.rightTerminal.customTerminalId
        ) ?? null
      : null;

  const handleSelectTubularTerminal = (
    side: 'leftTerminal' | 'rightTerminal'
  ) => {
    setActiveWirePreset({
      ...activeWirePreset,
      [side]: {
        ...activeWirePreset[side],
        type: 'tubular',
        customTerminalId: undefined,
        label: 'Terminal Tubular',
      },
    });
    setOpenTerminalMenuSide(null);
  };

  const handleSelectCustomTerminal = (
    side: 'leftTerminal' | 'rightTerminal',
    customDef: CustomTerminalDefinition
  ) => {
    setActiveWirePreset({
      ...activeWirePreset,
      [side]: {
        ...activeWirePreset[side],
        type: 'custom',
        customTerminalId: customDef.id,
        label: customDef.name,
      },
    });
    setOpenTerminalMenuSide(null);
  };

  // Estado da aba de seleção de cor (cabo, terminal esquerdo ou terminal direito)
  const [activeColorPickerTarget, setActiveColorPickerTarget] = useState<
    'wire' | 'leftTerminal' | 'rightTerminal' | null
  >(null);

  useEffect(() => {
    setActiveColorPickerTarget(null);
    setOpenTerminalMenuSide(null);
    if (editingEdgeId) {
      wireSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [editingEdgeId]);

  const currentGaugeIndex = Math.max(
    0,
    WIRE_GAUGE_STEPS.findIndex((step) => step.awg === activeWirePreset.awg)
  );

  const handleChangeGauge = (delta: number) => {
    const nextIndex = Math.max(
      0,
      Math.min(WIRE_GAUGE_STEPS.length - 1, currentGaugeIndex + delta)
    );
    const nextStep = WIRE_GAUGE_STEPS[nextIndex];
    setActiveWirePreset({
      ...activeWirePreset,
      id: `${nextStep.awg.toLowerCase().replace(/\s+/g, '')}-${activeWirePreset.colorHex}`,
      awg: nextStep.awg,
      label: nextStep.awg,
      thickness: nextStep.thickness,
    });
  };

  const handleSelectColor = (colorHex: string, colorName: string) => {
    setActiveWirePreset({
      ...activeWirePreset,
      id: `${activeWirePreset.awg.toLowerCase().replace(/\s+/g, '')}-${colorHex}`,
      colorHex,
      colorName,
    });
  };

  const handleSelectTerminalColor = (
    side: 'leftTerminal' | 'rightTerminal',
    colorHex: string,
    colorName: string
  ) => {
    const shortColorName = colorName.replace(/\s*\(.*?\)\s*/g, '').trim() || colorName;
    setActiveWirePreset({
      ...activeWirePreset,
      [side]: {
        ...activeWirePreset[side],
        colorHex,
        colorName: shortColorName,
      },
    });
  };

  const handleToggleTerminal = (side: 'leftTerminal' | 'rightTerminal') => {
    const nextEnabled = !activeWirePreset[side].enabled;
    setActiveWirePreset({
      ...activeWirePreset,
      [side]: {
        ...activeWirePreset[side],
        enabled: nextEnabled,
      },
    });
    if (!nextEnabled && activeColorPickerTarget === side) {
      setActiveColorPickerTarget(null);
    }
    if (!nextEnabled && openTerminalMenuSide === side) {
      setOpenTerminalMenuSide(null);
    }
  };

  const handleChangeStripLength = (
    side: 'leftStripLength' | 'rightStripLength',
    delta: number
  ) => {
    const currentVal = activeWirePreset[side] ?? 8;
    const nextVal = Math.max(
      MIN_STRIP_LENGTH,
      Math.min(MAX_STRIP_LENGTH, currentVal + delta)
    );
    setActiveWirePreset({
      ...activeWirePreset,
      [side]: nextVal,
    });
  };

  const handleSetTinned = (side: 'left' | 'right', tinned: boolean) => {
    if (side === 'left') {
      setActiveWirePreset({
        ...activeWirePreset,
        leftTinned: tinned,
        leftHeatShrink: tinned ? activeWirePreset.leftHeatShrink : false,
      });
    } else {
      setActiveWirePreset({
        ...activeWirePreset,
        rightTinned: tinned,
        rightHeatShrink: tinned ? activeWirePreset.rightHeatShrink : false,
      });
    }
  };

  const handleSetHeatShrink = (side: 'left' | 'right', heatShrink: boolean) => {
    if (side === 'left') {
      if (!activeWirePreset.leftTinned) return;
      setActiveWirePreset({
        ...activeWirePreset,
        leftHeatShrink: heatShrink,
      });
    } else {
      if (!activeWirePreset.rightTinned) return;
      setActiveWirePreset({
        ...activeWirePreset,
        rightHeatShrink: heatShrink,
      });
    }
  };

  const handleToggleIdentifier = (
    side: 'leftIdentifier' | 'rightIdentifier'
  ) => {
    const current = activeWirePreset[side] ?? {
      enabled: false,
      text: side === 'leftIdentifier' ? 'CABO-ESQ' : 'CABO-DIR',
    };
    setActiveWirePreset({
      ...activeWirePreset,
      [side]: {
        ...current,
        enabled: !current.enabled,
      },
    });
  };

  const handleChangeIdentifierText = (
    side: 'leftIdentifier' | 'rightIdentifier',
    text: string
  ) => {
    const current = activeWirePreset[side] ?? {
      enabled: true,
      text: '',
    };
    setActiveWirePreset({
      ...activeWirePreset,
      [side]: {
        ...current,
        text,
      },
    });
  };

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    catalogId: string
  ) => {
    event.dataTransfer.setData('application/reactflow', catalogId);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 flex flex-col justify-between z-20 select-none shrink-0">
        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Identificação do Sistema */}
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm uppercase tracking-wider">
                <Cable className="w-5 h-5" />
                <span>ConectaCab</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-semibold text-amber-300 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Em desenvolvimento</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Desenhe seus conectores, arraste ao diagrama e personalize os cabos.
            </p>
          </div>

          {/* Catálogo Drag-and-Drop de Conectores + Botão Novo Componente */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Conectores ({catalog.length})
              </h2>
              <button
                type="button"
                onClick={() => openComponentDesigner(null)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold shadow transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Componente</span>
              </button>
            </div>

            {catalog.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-dashed border-slate-700 text-center space-y-2.5">
                <div className="w-9 h-9 mx-auto rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <PenTool className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-200">
                    Nenhum componente criado
                  </p>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Desenhe conectores, borneiras ou sensores com acabamento industrial e adicione ao seu catálogo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openComponentDesigner(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold shadow transition-colors cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Desenhar Componente</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {catalog.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.id)}
                    className="group relative flex items-start gap-3 p-3 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/60 cursor-grab active:cursor-grabbing transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-md bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                      {item.drawing ? (
                        <CustomComponentThumbnail drawing={item.drawing} />
                      ) : item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.label}
                          className="w-full h-full object-contain p-0.5"
                        />
                      ) : (
                        CONNECTOR_ICONS[item.type] ?? CONNECTOR_ICONS.custom
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openComponentDesigner(item.id);
                            }}
                            title="Editar desenho do componente"
                            className="p-0.5 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-900 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCatalogItem(item.id);
                            }}
                            title="Remover do catálogo"
                            className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <GripVertical className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/50">
                          {item.partNumber}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {item.pinCount} Pinos
                        </span>
                        {item.drawing && (
                          <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/50 flex items-center gap-1">
                            <PenTool className="w-2.5 h-2.5" /> Desenhado
                          </span>
                        )}
                        {!item.drawing && item.imageUrl && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50 flex items-center gap-1">
                            <ImageIcon className="w-2.5 h-2.5" /> PNG Mapeado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seletor de Bitola e Cor do Fio para novas conexões ou edição do cabo selecionado */}
          <div
            ref={wireSectionRef}
            className={
              editingEdge
                ? 'p-3 -mx-1 rounded-xl bg-amber-500/10 border border-amber-400/60 shadow-lg transition-all'
                : ''
            }
          >
            {editingEdge && (
              <div className="mb-3 flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-amber-500/20 border border-amber-400/50">
                <div className="flex items-center gap-2 min-w-0">
                  <Pencil className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 truncate">
                    Editando Cabo Selecionado
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopEditingEdge}
                  title="Concluir edição deste cabo"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Check className="w-3 h-3" />
                  <span>Concluir</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-2.5">
              <h2
                className={`text-xs font-bold uppercase tracking-wider ${
                  editingEdge ? 'text-amber-300' : 'text-slate-400'
                }`}
              >
                {editingEdge
                  ? 'Parâmetros do Cabo Selecionado'
                  : 'Bitola / Cor do Cabo Ativo'}
              </h2>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              {editingEdge ? (
                <>
                  As alterações abaixo são aplicadas em tempo real no{' '}
                  <strong className="text-amber-200">cabo selecionado</strong>:
                </>
              ) : (
                <>
                  Clique na bolinha para escolher a cor e use <strong>-</strong>{' '}
                  / <strong>+</strong> para ajustar a bitola do cabo:
                </>
              )}
            </p>

            {/* Único item da lista com botão (-) à esquerda e (+) à direita */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleChangeGauge(-1)}
                disabled={currentGaugeIndex <= 0}
                title="Diminuir bitola do cabo"
                className="flex items-center justify-center w-8 h-9 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors cursor-pointer shrink-0"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex-1 flex items-center px-3 py-2 rounded-md text-xs font-mono bg-slate-800 border border-sky-500 text-white shadow-sm min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveColorPickerTarget((prev) =>
                        prev === 'wire' ? null : 'wire'
                      )
                    }
                    title="Clique para selecionar a cor do cabo"
                    className="w-4 h-4 rounded-full border-2 border-white/70 hover:scale-125 transition-transform shrink-0 cursor-pointer shadow-sm ring-2 ring-sky-400/30"
                    style={{ backgroundColor: activeWirePreset.colorHex }}
                  />
                  <span className="font-semibold shrink-0">
                    {activeWirePreset.awg}
                  </span>
                  <span className="text-slate-300 text-[11px] font-sans truncate">
                    {activeWirePreset.colorName}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleChangeGauge(1)}
                disabled={currentGaugeIndex >= WIRE_GAUGE_STEPS.length - 1}
                title="Aumentar bitola do cabo"
                className="flex items-center justify-center w-8 h-9 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Aba de seleção de cor do cabo ao clicar na bolinha colorida */}
            {activeColorPickerTarget === 'wire' && (
              <div className="mt-2 p-3 rounded-lg bg-slate-950/90 border border-slate-700 shadow-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Selecionar Cor do Cabo
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveColorPickerTarget(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    title="Fechar aba de cores"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {WIRE_COLOR_OPTIONS.map((option) => {
                    const isCurrentColor =
                      activeWirePreset.colorHex.toLowerCase() ===
                      option.colorHex.toLowerCase();
                    return (
                      <button
                        key={option.colorHex}
                        type="button"
                        onClick={() => {
                          handleSelectColor(option.colorHex, option.colorName);
                          setActiveColorPickerTarget(null);
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] transition-colors border cursor-pointer ${
                          isCurrentColor
                            ? 'bg-slate-800 border-sky-500 text-white font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                          style={{ backgroundColor: option.colorHex }}
                        />
                        <span className="truncate">{option.colorName}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Cor personalizada:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeWirePreset.colorHex}
                      onChange={(e) =>
                        handleSelectColor(
                          e.target.value,
                          `Custom (${e.target.value.toUpperCase()})`
                        )
                      }
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border border-slate-700"
                    />
                    <span className="text-[11px] font-mono text-slate-400 uppercase">
                      {activeWirePreset.colorHex}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Seção de Decape do Cabo (Lado Esquerdo e Lado Direito) depois de Bitola/Cor e antes de Terminais */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Decape do Cabo (Esq / Dir)
                </h3>
                <span className="text-[10px] font-mono text-sky-400">
                  Tamanho (mm)
                </span>
              </div>

              <div className="space-y-1.5">
                {(
                  [
                    {
                      key: 'leftStripLength' as const,
                      side: 'left' as const,
                      sideBadge: 'ESQ',
                      sideTitle: 'Decape Esquerdo',
                    },
                    {
                      key: 'rightStripLength' as const,
                      side: 'right' as const,
                      sideBadge: 'DIR',
                      sideTitle: 'Decape Direito',
                    },
                  ]
                ).map(({ key, side, sideBadge, sideTitle }) => {
                  const stripValue = activeWirePreset[key] ?? 8;
                  const sideTinned =
                    side === 'left'
                      ? activeWirePreset.leftTinned
                      : activeWirePreset.rightTinned;
                  const sideHeatShrink =
                    side === 'left'
                      ? activeWirePreset.leftTinned &&
                        activeWirePreset.leftHeatShrink
                      : activeWirePreset.rightTinned &&
                        activeWirePreset.rightHeatShrink;

                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleChangeStripLength(key, -1)}
                        disabled={stripValue <= MIN_STRIP_LENGTH}
                        title={`Diminuir tamanho do ${sideTitle.toLowerCase()}`}
                        className="flex items-center justify-center w-8 h-9 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors cursor-pointer shrink-0"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div
                        className={`relative flex-1 flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono border text-white shadow-sm min-w-0 overflow-hidden transition-all ${
                          sideHeatShrink
                            ? 'bg-zinc-950 border-zinc-500 ring-1 ring-zinc-400/40'
                            : 'bg-slate-800/90 border-slate-700'
                        }`}
                      >
                        {sideHeatShrink && (
                          <div
                            title="Capinha de Termoretrátil Preto aplicada sobre o decape"
                            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-zinc-900 via-zinc-500 to-zinc-900 opacity-90 pointer-events-none"
                          />
                        )}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="relative flex items-center justify-center shrink-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-sm border ${
                                sideTinned
                                  ? 'bg-slate-300 border-white/60'
                                  : 'bg-amber-400 border-amber-200/60'
                              }`}
                            />
                            {sideHeatShrink && (
                              <span
                                title="Capinha preta (termoretrátil)"
                                className="absolute -inset-0.5 rounded-sm bg-zinc-950/90 border border-zinc-400 shadow-inner"
                              />
                            )}
                          </span>
                          <span className="font-semibold truncate">
                            {sideTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {sideHeatShrink && (
                            <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-600">
                              CAPA PRETA
                            </span>
                          )}
                          <span className="text-[11px] font-mono font-bold text-sky-300">
                            {stripValue} mm
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                            {sideBadge}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleChangeStripLength(key, 1)}
                        disabled={stripValue >= MAX_STRIP_LENGTH}
                        title={`Aumentar tamanho do ${sideTitle.toLowerCase()}`}
                        className="flex items-center justify-center w-8 h-9 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Seção de Estanhar (Esq / Dir) logo após o decape com duas opções: Sim e Não */}
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Estanhar (Esq / Dir)
                  </h4>
                  <span className="text-[10px] font-mono text-sky-400">
                    Sim / Não
                  </span>
                </div>

                {(
                  [
                    {
                      side: 'left' as const,
                      sideBadge: 'ESQ',
                      sideTitle: 'Estanhar Esquerdo',
                      isActive: activeWirePreset.leftTinned,
                    },
                    {
                      side: 'right' as const,
                      sideBadge: 'DIR',
                      sideTitle: 'Estanhar Direito',
                      isActive: activeWirePreset.rightTinned,
                    },
                  ]
                ).map(({ side, sideBadge, sideTitle, isActive }) => (
                  <div
                    key={side}
                    className="flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono bg-slate-800/90 border border-slate-700 text-white shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 border ${
                          isActive
                            ? 'bg-slate-300 border-white/70'
                            : 'bg-amber-400 border-amber-200/70'
                        }`}
                      />
                      <span className="font-semibold truncate">{sideTitle}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                        {sideBadge}
                      </span>
                      <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-md border border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleSetTinned(side, true)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-sky-600 text-white shadow'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          SIM
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetTinned(side, false)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                            !isActive
                              ? 'bg-slate-700 text-white shadow'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          NÃO
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Seção de Termoretrátil Preto (Esq / Dir) abaixo de Estanhar, habilitada apenas no lado em que Estanhar estiver ativo */}
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Termoretrátil Preto (Esq / Dir)
                  </h4>
                  <span className="text-[10px] font-mono text-sky-400">
                    Requer Estanhar
                  </span>
                </div>

                {(
                  [
                    {
                      side: 'left' as const,
                      sideBadge: 'ESQ',
                      sideTitle: 'Termoretrátil Esquerdo',
                      canEnable: activeWirePreset.leftTinned,
                      isActive:
                        activeWirePreset.leftTinned &&
                        activeWirePreset.leftHeatShrink,
                    },
                    {
                      side: 'right' as const,
                      sideBadge: 'DIR',
                      sideTitle: 'Termoretrátil Direito',
                      canEnable: activeWirePreset.rightTinned,
                      isActive:
                        activeWirePreset.rightTinned &&
                        activeWirePreset.rightHeatShrink,
                    },
                  ]
                ).map(({ side, sideBadge, sideTitle, canEnable, isActive }) => (
                  <div
                    key={side}
                    title={
                      canEnable
                        ? `Ativar/desativar ${sideTitle.toLowerCase()}`
                        : `Ative o Estanhar (${sideBadge}) para habilitar o termoretrátil neste lado`
                    }
                    className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono border transition-all shadow-sm ${
                      canEnable
                        ? isActive
                          ? 'bg-zinc-950 border-zinc-500 text-white'
                          : 'bg-slate-800/90 border-slate-700 text-white'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-500 opacity-55'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-sm shrink-0 border ${
                          isActive
                            ? 'bg-zinc-950 border-zinc-300 ring-1 ring-white/40'
                            : 'bg-slate-700 border-slate-500'
                        }`}
                      />
                      <span className="font-semibold truncate">{sideTitle}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                        {sideBadge}
                      </span>
                      <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-md border border-slate-700">
                        <button
                          type="button"
                          disabled={!canEnable}
                          onClick={() => handleSetHeatShrink(side, true)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            !canEnable
                              ? 'text-slate-600 cursor-not-allowed'
                              : isActive
                              ? 'bg-zinc-950 text-white border border-zinc-500 shadow cursor-pointer'
                              : 'text-slate-400 hover:text-slate-200 cursor-pointer'
                          }`}
                        >
                          SIM
                        </button>
                        <button
                          type="button"
                          disabled={!canEnable}
                          onClick={() => handleSetHeatShrink(side, false)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            !canEnable
                              ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                              : !isActive
                              ? 'bg-slate-700 text-white shadow cursor-pointer'
                              : 'text-slate-400 hover:text-slate-200 cursor-pointer'
                          }`}
                        >
                          NÃO
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seção de Terminais (Lado Esquerdo e Lado Direito) antes da pré-visualização */}
            <div
              ref={terminalMenuRef}
              className="mt-3 pt-3 border-t border-slate-800/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Terminais do Cabo (Esq / Dir)
                </h3>
              </div>

              <div className="space-y-2">
                {(
                  [
                    {
                      key: 'leftTerminal' as const,
                      sideBadge: 'ESQ',
                      sideTitle: 'Terminal Esquerdo',
                      sideCustomTerminal: activeLeftCustomTerminal,
                    },
                    {
                      key: 'rightTerminal' as const,
                      sideBadge: 'DIR',
                      sideTitle: 'Terminal Direito',
                      sideCustomTerminal: activeRightCustomTerminal,
                    },
                  ]
                ).map(({ key, sideBadge, sideTitle, sideCustomTerminal }) => {
                  const terminal = activeWirePreset[key];
                  const isPickerOpen = activeColorPickerTarget === key;
                  const isTypeMenuOpen = openTerminalMenuSide === key;
                  const sideTerminalTypeLabel = sideCustomTerminal
                    ? sideCustomTerminal.name
                    : 'Tubular';

                  return (
                    <div key={key} className="space-y-1.5">
                      <div
                        className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono border transition-all shadow-sm ${
                          terminal.enabled
                            ? 'bg-slate-800/90 border-slate-700 hover:border-sky-500/60 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-2.5 min-w-0 ${
                            terminal.enabled ? '' : 'opacity-50'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={!terminal.enabled}
                            onClick={() => {
                              setOpenTerminalMenuSide(null);
                              setActiveColorPickerTarget((prev) =>
                                prev === key ? null : key
                              );
                            }}
                            title={`Clique para selecionar a cor do ${sideTitle.toLowerCase()}`}
                            className="w-4 h-4 rounded-full border-2 border-white/70 hover:scale-125 disabled:hover:scale-100 transition-transform shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-sm ring-2 ring-sky-400/30"
                            style={{ backgroundColor: terminal.colorHex }}
                          />
                          <span
                            title={terminal.label}
                            className="font-semibold truncate"
                          >
                            {terminal.label}
                          </span>
                          <span className="text-[11px] font-sans text-slate-300 truncate shrink-0 max-w-[64px]">
                            {terminal.colorName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                            {sideBadge}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleTerminal(key)}
                            title={
                              terminal.enabled
                                ? `Desativar ${sideTitle.toLowerCase()}`
                                : `Ativar ${sideTitle.toLowerCase()}`
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                              terminal.enabled
                                ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400/50'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                            }`}
                          >
                            {terminal.enabled ? 'ATIVO' : 'OFF'}
                          </button>
                        </div>
                      </div>

                      {/* Seletor de tipo de terminal (Tubular / Personalizado) exclusivo deste lado */}
                      <div className="relative">
                        <button
                          type="button"
                          disabled={!terminal.enabled}
                          onClick={() => {
                            setActiveColorPickerTarget(null);
                            setOpenTerminalMenuSide((prev) =>
                              prev === key ? null : key
                            );
                          }}
                          aria-expanded={isTypeMenuOpen}
                          title={`Clique para alterar o tipo do ${sideTitle.toLowerCase()}`}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs font-mono border transition-colors shadow-sm ${
                            terminal.enabled
                              ? 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/90 hover:border-sky-500/70 text-sky-400 cursor-pointer'
                              : 'bg-slate-900/40 border-slate-800/80 text-slate-500 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {sideCustomTerminal ? (
                              <CustomTerminalThumbnail
                                terminal={sideCustomTerminal}
                                terminalColorHex={terminal.colorHex}
                                className="w-6 h-4 shrink-0"
                              />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                            )}
                            <span className="font-semibold text-sky-300 truncate">
                              {sideTerminalTypeLabel}
                            </span>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                              isTypeMenuOpen ? 'rotate-180 text-sky-400' : ''
                            }`}
                          />
                        </button>

                        {isTypeMenuOpen && terminal.enabled && (
                          <div className="mt-1 rounded-lg bg-slate-950/95 border border-slate-700 shadow-xl overflow-hidden divide-y divide-slate-800/80">
                            <div className="p-1 space-y-0.5">
                              {/* Opção padrão: Tubular */}
                              <button
                                type="button"
                                onClick={() => handleSelectTubularTerminal(key)}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                                  !sideCustomTerminal
                                    ? 'bg-sky-600/20 text-sky-200 border border-sky-500/50 font-bold'
                                    : 'text-slate-200 hover:bg-slate-800/90 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                                  <span className="truncate">Tubular</span>
                                </div>
                                {!sideCustomTerminal && (
                                  <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                )}
                              </button>

                              {/* Terminais personalizados criados pelo usuário */}
                              {customTerminals.map((ct) => {
                                const isSelected = sideCustomTerminal?.id === ct.id;
                                return (
                                  <div
                                    key={ct.id}
                                    className={`flex items-center justify-between gap-1 px-1.5 py-1 rounded-md border transition-colors ${
                                      isSelected
                                        ? 'bg-sky-600/20 text-sky-200 border-sky-500/50'
                                        : 'text-slate-200 hover:bg-slate-800/90 border-transparent'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSelectCustomTerminal(key, ct)
                                      }
                                      className="flex-1 flex items-center gap-2 px-1 py-1 text-left text-xs font-mono min-w-0 cursor-pointer"
                                    >
                                      <CustomTerminalThumbnail
                                        terminal={ct}
                                        terminalColorHex={terminal.colorHex}
                                        className="w-6 h-4 shrink-0"
                                      />
                                      <span
                                        className={`truncate ${
                                          isSelected ? 'font-bold' : ''
                                        }`}
                                      >
                                        {ct.name}
                                      </span>
                                    </button>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-sky-400 mr-0.5" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenTerminalMenuSide(null);
                                          openTerminalDesigner(ct.id, key);
                                        }}
                                        title="Editar desenho deste terminal"
                                        className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-900 transition-colors cursor-pointer"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeCustomTerminal(ct.id);
                                        }}
                                        title="Excluir terminal personalizado"
                                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Ação: Personalizar Terminal (abre aba de desenho) */}
                            <div className="p-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenTerminalMenuSide(null);
                                  openTerminalDesigner(null, key);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-semibold text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 transition-colors cursor-pointer"
                              >
                                <PenTool className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Personalizar Terminal</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {isPickerOpen && (
                        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-700 shadow-lg space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                              Cor: {sideTitle} ({sideBadge})
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveColorPickerTarget(null)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                              title="Fechar aba de cores"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {WIRE_COLOR_OPTIONS.map((option) => {
                              const isCurrentColor =
                                terminal.colorHex.toLowerCase() ===
                                option.colorHex.toLowerCase();
                              const shortName =
                                option.colorName
                                  .replace(/\s*\(.*?\)\s*/g, '')
                                  .trim() || option.colorName;
                              return (
                                <button
                                  key={option.colorHex}
                                  type="button"
                                  onClick={() => {
                                    handleSelectTerminalColor(
                                      key,
                                      option.colorHex,
                                      shortName
                                    );
                                    setActiveColorPickerTarget(null);
                                  }}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] transition-colors border cursor-pointer ${
                                    isCurrentColor
                                      ? 'bg-slate-800 border-sky-500 text-white font-semibold'
                                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                                  }`}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                                    style={{ backgroundColor: option.colorHex }}
                                  />
                                  <span className="truncate">{shortName}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                            <label className="text-[11px] text-slate-300 font-medium">
                              Cor personalizada:
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={terminal.colorHex}
                                onChange={(e) =>
                                  handleSelectTerminalColor(
                                    key,
                                    e.target.value,
                                    `Custom (${e.target.value.toUpperCase()})`
                                  )
                                }
                                className="w-7 h-7 rounded cursor-pointer bg-transparent border border-slate-700"
                              />
                              <span className="text-[11px] font-mono text-slate-400 uppercase">
                                {terminal.colorHex}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seção de Identificadores do Cabo (Esq / Dir) após a seção de Terminal Tubular */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Identificadores (Esq / Dir)
                </h3>
                <span className="text-[10px] font-mono text-sky-400">
                  Etiqueta Branca
                </span>
              </div>

              <div className="space-y-1.5">
                {(
                  [
                    {
                      key: 'leftIdentifier' as const,
                      sideBadge: 'ESQ',
                      sideTitle: 'Identificador Esquerdo',
                      placeholder: 'Ex: X1:1 / VCC 24V',
                    },
                    {
                      key: 'rightIdentifier' as const,
                      sideBadge: 'DIR',
                      sideTitle: 'Identificador Direito',
                      placeholder: 'Ex: CLP-A1 / SINAL',
                    },
                  ]
                ).map(({ key, sideBadge, sideTitle, placeholder }) => {
                  const identifier = activeWirePreset[key] ?? {
                    enabled: false,
                    text: key === 'leftIdentifier' ? 'CABO-ESQ' : 'CABO-DIR',
                  };

                  return (
                    <div key={key} className="space-y-1.5">
                      <div
                        className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono border transition-all shadow-sm ${
                          identifier.enabled
                            ? 'bg-slate-800/90 border-slate-700 hover:border-sky-500/60 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-2 min-w-0 ${
                            identifier.enabled ? '' : 'opacity-50'
                          }`}
                        >
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-white text-black border border-black text-[9px] font-mono font-bold leading-none shrink-0 shadow-sm">
                            ID
                          </span>
                          <span className="font-semibold truncate">
                            {sideTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                            {sideBadge}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleIdentifier(key)}
                            title={
                              identifier.enabled
                                ? `Desativar ${sideTitle.toLowerCase()}`
                                : `Ativar ${sideTitle.toLowerCase()}`
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                              identifier.enabled
                                ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400/50'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                            }`}
                          >
                            {identifier.enabled ? 'ATIVO' : 'OFF'}
                          </button>
                        </div>
                      </div>

                      {/* Aba aberta automaticamente quando o identificador está ativo para digitar a frase */}
                      {identifier.enabled && (
                        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-700 shadow-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                              Texto Impresso ({sideBadge})
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {identifier.text.length}/24
                            </span>
                          </div>

                          <input
                            type="text"
                            maxLength={24}
                            placeholder={placeholder}
                            value={identifier.text}
                            onChange={(e) =>
                              handleChangeIdentifierText(key, e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                          />

                          {/* Amostra real do identificador: retângulo branco, borda preta e fonte preta legível */}
                          <div className="pt-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400">
                              Etiqueta:
                            </span>
                            <div className="px-2.5 py-1 bg-white border-2 border-black rounded-[2px] shadow-sm max-w-[180px] overflow-hidden">
                              <span className="block text-[11px] font-mono font-bold text-black tracking-tight truncate">
                                {identifier.text.trim() || 'SEM TEXTO'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pré-visualização da linha simulando o cabo abaixo do item */}
            <div className="mt-2.5 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                <span>PRÉ-VISUALIZAÇÃO DO CABO</span>
                <span>
                  {activeWirePreset.awg} | Decape: {activeWirePreset.leftStripLength ?? 8}mm /{' '}
                  {activeWirePreset.rightStripLength ?? 8}mm
                </span>
              </div>
              <div className="relative h-12 w-full flex items-center justify-center bg-slate-900/90 rounded border border-slate-800/80 px-3 overflow-hidden">
                {(() => {
                  const realisticWidth = Math.max(
                    6,
                    activeWirePreset.thickness * 2.4
                  );
                  const casingWidth = realisticWidth + 3;
                  const highlightWidth = Math.max(1.5, realisticWidth * 0.28);
                  const collarHeight = Math.max(10, realisticWidth + 4);
                  const pinHeight = Math.max(4, Math.round(realisticWidth * 0.55));
                  const leftEnabled = activeWirePreset.leftTerminal.enabled;
                  const rightEnabled = activeWirePreset.rightTerminal.enabled;
                  const leftColor = activeWirePreset.leftTerminal.colorHex;
                  const rightColor = activeWirePreset.rightTerminal.colorHex;
                  const leftCustomDef = leftEnabled ? activeLeftCustomTerminal : null;
                  const rightCustomDef = rightEnabled ? activeRightCustomTerminal : null;
                  const leftIdConfig = activeWirePreset.leftIdentifier;
                  const rightIdConfig = activeWirePreset.rightIdentifier;
                  const leftIdText = leftIdConfig?.text?.trim() || 'ID';
                  const rightIdText = rightIdConfig?.text?.trim() || 'ID';
                  const leftIdBoxW = Math.max(
                    26,
                    Math.min(68, leftIdText.length * 5.2 + 8)
                  );
                  const rightIdBoxW = Math.max(
                    26,
                    Math.min(68, rightIdText.length * 5.2 + 8)
                  );

                  const leftStripMm = activeWirePreset.leftStripLength ?? 8;
                  const rightStripMm = activeWirePreset.rightStripLength ?? 8;
                  const leftTinned = activeWirePreset.leftTinned ?? false;
                  const rightTinned = activeWirePreset.rightTinned ?? false;
                  const leftHeatShrink =
                    leftTinned && (activeWirePreset.leftHeatShrink ?? false);
                  const rightHeatShrink =
                    rightTinned && (activeWirePreset.rightHeatShrink ?? false);
                  const leftStripFillColor = leftTinned ? '#cbd5e1' : '#f59e0b';
                  const rightStripFillColor = rightTinned ? '#cbd5e1' : '#f59e0b';
                  const leftStripStrokeSchematic = leftTinned ? '#94a3b8' : '#d97706';
                  const rightStripStrokeSchematic = rightTinned ? '#94a3b8' : '#d97706';
                  const sleeveHeight = Math.max(8, pinHeight + 4);
                  const leftStripPx = Math.round(leftStripMm * 1.5);
                  const rightStripPx = Math.round(rightStripMm * 1.5);

                  const leftPinW = Math.max(3, leftStripPx);
                  const rightPinW = Math.max(3, rightStripPx);

                  const leftCustomMetrics = leftCustomDef
                    ? getCustomTerminalRenderMetrics(leftCustomDef, casingWidth, 58)
                    : null;
                  const rightCustomMetrics = rightCustomDef
                    ? getCustomTerminalRenderMetrics(rightCustomDef, casingWidth, 58)
                    : null;

                  const wireStartX = leftEnabled
                    ? leftCustomMetrics
                      ? 4 + leftCustomMetrics.wireOffset
                      : 4 + leftPinW + 15
                    : 6 + leftStripPx;
                  const wireEndX = rightEnabled
                    ? rightCustomMetrics
                      ? 216 - rightCustomMetrics.wireOffset
                      : 216 - rightPinW - 15
                    : 214 - rightStripPx;

                  if (viewMode === 'schematic') {
                    const schLeftPinW = Math.max(3, Math.round(leftStripMm * 1.25));
                    const schRightPinW = Math.max(3, Math.round(rightStripMm * 1.25));
                    const schRefH = Math.max(8, activeWirePreset.thickness + 5);
                    const schLeftCustomMetrics = leftCustomDef
                      ? getCustomTerminalRenderMetrics(leftCustomDef, schRefH, 56)
                      : null;
                    const schRightCustomMetrics = rightCustomDef
                      ? getCustomTerminalRenderMetrics(rightCustomDef, schRefH, 56)
                      : null;
                    const schWireStart = leftEnabled
                      ? schLeftCustomMetrics
                        ? 6 + schLeftCustomMetrics.wireOffset
                        : 6 + schLeftPinW + 12
                      : 6 + Math.round(leftStripMm * 1.25);
                    const schWireEnd = rightEnabled
                      ? schRightCustomMetrics
                        ? 214 - schRightCustomMetrics.wireOffset
                        : 214 - schRightPinW - 12
                      : 214 - Math.round(rightStripMm * 1.25);

                    return (
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 220 32">
                        {/* Condutor decapado esquerdo (sem terminal) */}
                        {!leftEnabled && leftStripMm > 0 && (
                          <>
                            <line
                              x1="6"
                              y1="16"
                              x2={schWireStart}
                              y2="16"
                              stroke={leftStripStrokeSchematic}
                              strokeWidth={Math.max(1.5, activeWirePreset.thickness * 0.7)}
                              strokeLinecap="butt"
                            />
                            {leftHeatShrink && (
                              <rect
                                x="6"
                                y="12"
                                width={Math.max(4, schWireStart - 4)}
                                height="8"
                                rx="1.5"
                                fill="#09090b"
                                stroke="#52525b"
                                strokeWidth="1.2"
                              />
                            )}
                          </>
                        )}
                        {/* Condutor decapado direito (sem terminal) */}
                        {!rightEnabled && rightStripMm > 0 && (
                          <>
                            <line
                              x1={schWireEnd}
                              y1="16"
                              x2="214"
                              y2="16"
                              stroke={rightStripStrokeSchematic}
                              strokeWidth={Math.max(1.5, activeWirePreset.thickness * 0.7)}
                              strokeLinecap="butt"
                            />
                            {rightHeatShrink && (
                              <rect
                                x={schWireEnd - 2}
                                y="12"
                                width={Math.max(4, 214 - schWireEnd + 2)}
                                height="8"
                                rx="1.5"
                                fill="#09090b"
                                stroke="#52525b"
                                strokeWidth="1.2"
                              />
                            )}
                          </>
                        )}
                        {/* Cabo central */}
                        <line
                          x1={schWireStart}
                          y1="16"
                          x2={schWireEnd}
                          y2="16"
                          stroke={activeWirePreset.colorHex}
                          strokeWidth={activeWirePreset.thickness}
                          strokeLinecap="butt"
                        />
                        {/* Terminal Esquerdo (Esquema) */}
                        {leftEnabled &&
                          (leftCustomDef && schLeftCustomMetrics ? (
                            <g transform="translate(6, 16)">
                              <CustomTerminalAttached
                                terminal={leftCustomDef}
                                terminalColorHex={leftColor}
                                renderScale={schLeftCustomMetrics.renderScale}
                                tipX={schLeftCustomMetrics.tipX}
                                attachY={schLeftCustomMetrics.attachY}
                              />
                            </g>
                          ) : (
                            <>
                              <rect
                                x="6"
                                y="13"
                                width={schLeftPinW}
                                height="6"
                                rx="1"
                                fill="#cbd5e1"
                                stroke="#0f172a"
                                strokeWidth="1.5"
                              />
                              {leftHeatShrink && (
                                <rect
                                  x="6"
                                  y="11.5"
                                  width={schLeftPinW + 2}
                                  height="9"
                                  rx="1.5"
                                  fill="#09090b"
                                  stroke="#52525b"
                                  strokeWidth="1.2"
                                />
                              )}
                              <rect
                                x={6 + schLeftPinW}
                                y="11"
                                width="12"
                                height="10"
                                rx="2"
                                fill={leftColor}
                                stroke="#0f172a"
                                strokeWidth="1.5"
                              />
                            </>
                          ))}
                        {/* Terminal Direito (Esquema) */}
                        {rightEnabled &&
                          (rightCustomDef && schRightCustomMetrics ? (
                            <g transform="translate(214, 16)">
                              <CustomTerminalAttached
                                terminal={rightCustomDef}
                                terminalColorHex={rightColor}
                                renderScale={schRightCustomMetrics.renderScale}
                                tipX={schRightCustomMetrics.tipX}
                                attachY={schRightCustomMetrics.attachY}
                                mirrorX
                              />
                            </g>
                          ) : (
                            <>
                              <rect
                                x={214 - schRightPinW - 12}
                                y="11"
                                width="12"
                                height="10"
                                rx="2"
                                fill={rightColor}
                                stroke="#0f172a"
                                strokeWidth="1.5"
                              />
                              <rect
                                x={214 - schRightPinW}
                                y="13"
                                width={schRightPinW}
                                height="6"
                                rx="1"
                                fill="#cbd5e1"
                                stroke="#0f172a"
                                strokeWidth="1.5"
                              />
                              {rightHeatShrink && (
                                <rect
                                  x={214 - schRightPinW - 2}
                                  y="11.5"
                                  width={schRightPinW + 2}
                                  height="9"
                                  rx="1.5"
                                  fill="#09090b"
                                  stroke="#52525b"
                                  strokeWidth="1.2"
                                />
                              )}
                            </>
                          ))}
                        {/* Identificador Esquerdo no Modo Esquema */}
                        {leftIdConfig?.enabled && (
                          <g>
                            <rect
                              x={schWireStart + 3}
                              y="9"
                              width={leftIdBoxW}
                              height="14"
                              rx="1.5"
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth="1.5"
                            />
                            <text
                              x={schWireStart + 3 + leftIdBoxW / 2}
                              y="16.5"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#000000"
                              fontSize="7.5"
                              fontWeight="700"
                              fontFamily="monospace"
                            >
                              {leftIdText.slice(0, 12)}
                            </text>
                          </g>
                        )}
                        {/* Identificador Direito no Modo Esquema */}
                        {rightIdConfig?.enabled && (
                          <g>
                            <rect
                              x={schWireEnd - 3 - rightIdBoxW}
                              y="9"
                              width={rightIdBoxW}
                              height="14"
                              rx="1.5"
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth="1.5"
                            />
                            <text
                              x={schWireEnd - 3 - rightIdBoxW / 2}
                              y="16.5"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#000000"
                              fontSize="7.5"
                              fontWeight="700"
                              fontFamily="monospace"
                            >
                              {rightIdText.slice(0, 12)}
                            </text>
                          </g>
                        )}
                      </svg>
                    );
                  }

                  return (
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 220 32">
                      {/* Filamento decapado exposto esquerdo (quando terminal está OFF) */}
                      {!leftEnabled && leftStripPx > 0 && (
                        <>
                          <rect
                            x="6"
                            y={16 - pinHeight / 2}
                            width={leftStripPx}
                            height={pinHeight}
                            rx="1"
                            fill={leftStripFillColor}
                            stroke="#0f172a"
                            strokeWidth="1.2"
                          />
                          {leftHeatShrink && (
                            <>
                              <rect
                                x="6"
                                y={16 - sleeveHeight / 2}
                                width={leftStripPx + 3}
                                height={sleeveHeight}
                                rx="2"
                                fill="#09090b"
                                stroke="#3f3f46"
                                strokeWidth="1.2"
                              />
                              <line
                                x1="8"
                                y1={16 - sleeveHeight * 0.22}
                                x2={Math.max(9, 6 + leftStripPx)}
                                y2={16 - sleeveHeight * 0.22}
                                stroke="rgba(255, 255, 255, 0.22)"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </>
                          )}
                        </>
                      )}
                      {/* Filamento decapado exposto direito (quando terminal está OFF) */}
                      {!rightEnabled && rightStripPx > 0 && (
                        <>
                          <rect
                            x={214 - rightStripPx}
                            y={16 - pinHeight / 2}
                            width={rightStripPx}
                            height={pinHeight}
                            rx="1"
                            fill={rightStripFillColor}
                            stroke="#0f172a"
                            strokeWidth="1.2"
                          />
                          {rightHeatShrink && (
                            <>
                              <rect
                                x={214 - rightStripPx - 3}
                                y={16 - sleeveHeight / 2}
                                width={rightStripPx + 3}
                                height={sleeveHeight}
                                rx="2"
                                fill="#09090b"
                                stroke="#3f3f46"
                                strokeWidth="1.2"
                              />
                              <line
                                x1={214 - rightStripPx}
                                y1={16 - sleeveHeight * 0.22}
                                x2="212"
                                y2={16 - sleeveHeight * 0.22}
                                stroke="rgba(255, 255, 255, 0.22)"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </>
                          )}
                        </>
                      )}
                      {/* Sombra projetada do cabo */}
                      <line
                        x1={wireStartX}
                        y1="19"
                        x2={wireEndX}
                        y2="19"
                        stroke="rgba(15, 23, 42, 0.55)"
                        strokeWidth={casingWidth + 3}
                        strokeLinecap="butt"
                      />
                      {/* Contorno externo escuro da capa */}
                      <line
                        x1={wireStartX}
                        y1="16"
                        x2={wireEndX}
                        y2="16"
                        stroke="#0f172a"
                        strokeWidth={casingWidth}
                        strokeLinecap="butt"
                      />
                      {/* Isolamento principal de PVC na cor selecionada */}
                      <line
                        x1={wireStartX}
                        y1="16"
                        x2={wireEndX}
                        y2="16"
                        stroke={activeWirePreset.colorHex}
                        strokeWidth={realisticWidth}
                        strokeLinecap="butt"
                      />
                      {/* Reflexo cilíndrico central */}
                      <line
                        x1={wireStartX}
                        y1="16"
                        x2={wireEndX}
                        y2="16"
                        stroke="rgba(255, 255, 255, 0.42)"
                        strokeWidth={highlightWidth}
                        strokeLinecap="butt"
                      />

                      {/* TERMINAL ESQUERDO */}
                      {leftEnabled &&
                        (leftCustomDef && leftCustomMetrics ? (
                          <g transform="translate(4, 16)">
                            <CustomTerminalAttached
                              terminal={leftCustomDef}
                              terminalColorHex={leftColor}
                              renderScale={leftCustomMetrics.renderScale}
                              tipX={leftCustomMetrics.tipX}
                              attachY={leftCustomMetrics.attachY}
                            />
                          </g>
                        ) : (
                          <>
                            {/* Ponteira metálica estanhada esquerda */}
                            <rect
                              x="4"
                              y={16 - pinHeight / 2}
                              width={leftPinW}
                              height={pinHeight}
                              rx="1.5"
                              fill="#cbd5e1"
                              stroke="#0f172a"
                              strokeWidth="1.5"
                            />
                            {/* Capinha preta de termoretrátil sobre a seção de decape esquerda */}
                            {leftHeatShrink && (
                              <>
                                <rect
                                  x="4"
                                  y={16 - sleeveHeight / 2}
                                  width={leftPinW + 2}
                                  height={sleeveHeight}
                                  rx="2"
                                  fill="#09090b"
                                  stroke="#3f3f46"
                                  strokeWidth="1.2"
                                />
                                <line
                                  x1="6"
                                  y1={16 - sleeveHeight * 0.22}
                                  x2={Math.max(7, 4 + leftPinW - 1)}
                                  y2={16 - sleeveHeight * 0.22}
                                  stroke="rgba(255, 255, 255, 0.22)"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                              </>
                            )}
                            {/* Saia isolante plástica esquerda (cor personalizável) */}
                            <rect
                              x={4 + leftPinW - 1}
                              y={16 - collarHeight / 2}
                              width="16"
                              height={collarHeight}
                              rx="2.5"
                              fill={leftColor}
                              stroke="#0f172a"
                              strokeWidth="1.5"
                            />
                            <line
                              x1={4 + leftPinW + 1}
                              y1={16 - collarHeight * 0.2}
                              x2={4 + leftPinW + 13}
                              y2={16 - collarHeight * 0.2}
                              stroke="rgba(255, 255, 255, 0.45)"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </>
                        ))}

                      {/* TERMINAL DIREITO */}
                      {rightEnabled &&
                        (rightCustomDef && rightCustomMetrics ? (
                          <g transform="translate(216, 16)">
                            <CustomTerminalAttached
                              terminal={rightCustomDef}
                              terminalColorHex={rightColor}
                              renderScale={rightCustomMetrics.renderScale}
                              tipX={rightCustomMetrics.tipX}
                              attachY={rightCustomMetrics.attachY}
                              mirrorX
                            />
                          </g>
                        ) : (
                          <>
                            {/* Ponteira metálica estanhada direita */}
                            <rect
                              x={216 - rightPinW}
                              y={16 - pinHeight / 2}
                              width={rightPinW}
                              height={pinHeight}
                              rx="1.5"
                              fill="#cbd5e1"
                              stroke="#0f172a"
                              strokeWidth="1.5"
                            />
                            {/* Capinha preta de termoretrátil sobre a seção de decape direita */}
                            {rightHeatShrink && (
                              <>
                                <rect
                                  x={216 - rightPinW - 2}
                                  y={16 - sleeveHeight / 2}
                                  width={rightPinW + 2}
                                  height={sleeveHeight}
                                  rx="2"
                                  fill="#09090b"
                                  stroke="#3f3f46"
                                  strokeWidth="1.2"
                                />
                                <line
                                  x1={216 - rightPinW + 1}
                                  y1={16 - sleeveHeight * 0.22}
                                  x2="214"
                                  y2={16 - sleeveHeight * 0.22}
                                  stroke="rgba(255, 255, 255, 0.22)"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                              </>
                            )}
                            {/* Saia isolante plástica direita (cor personalizável) */}
                            <rect
                              x={216 - rightPinW - 15}
                              y={16 - collarHeight / 2}
                              width="16"
                              height={collarHeight}
                              rx="2.5"
                              fill={rightColor}
                              stroke="#0f172a"
                              strokeWidth="1.5"
                            />
                            <line
                              x1={216 - rightPinW - 13}
                              y1={16 - collarHeight * 0.2}
                              x2={216 - rightPinW - 1}
                              y2={16 - collarHeight * 0.2}
                              stroke="rgba(255, 255, 255, 0.45)"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </>
                        ))}

                      {/* IDENTIFICADOR ESQUERDO (Retângulo branco, borda preta e fonte preta legível) */}
                      {leftIdConfig?.enabled && (() => {
                        const idBoxH = Math.max(15, casingWidth + 3);
                        return (
                          <g>
                            <rect
                              x={wireStartX + 3}
                              y={16 - idBoxH / 2}
                              width={leftIdBoxW}
                              height={idBoxH}
                              rx="1.5"
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth="1.5"
                            />
                            <text
                              x={wireStartX + 3 + leftIdBoxW / 2}
                              y="16"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#000000"
                              fontSize="7.5"
                              fontWeight="700"
                              fontFamily="monospace"
                            >
                              {leftIdText.slice(0, 12)}
                            </text>
                          </g>
                        );
                      })()}

                      {/* IDENTIFICADOR DIREITO (Retângulo branco, borda preta e fonte preta legível) */}
                      {rightIdConfig?.enabled && (() => {
                        const idBoxH = Math.max(15, casingWidth + 3);
                        return (
                          <g>
                            <rect
                              x={wireEndX - 3 - rightIdBoxW}
                              y={16 - idBoxH / 2}
                              width={rightIdBoxW}
                              height={idBoxH}
                              rx="1.5"
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth="1.5"
                            />
                            <text
                              x={wireEndX - 3 - rightIdBoxW / 2}
                              y="16"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#000000"
                              fontSize="7.5"
                              fontWeight="700"
                              fontFamily="monospace"
                            >
                              {rightIdText.slice(0, 12)}
                            </text>
                          </g>
                        );
                      })()}
                    </svg>
                  );
                })()}
              </div>

              {/* Botão Adicionar Cabo: libera/bloqueia a adição de novos cabos no diagrama */}
              <div className="pt-1 space-y-1.5">
                <button
                  type="button"
                  onClick={toggleAddingCableMode}
                  aria-pressed={isAddingCableMode}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer shadow-md ${
                    isAddingCableMode
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-400/40'
                      : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400/60'
                  }`}
                >
                  <Cable className="w-4 h-4" />
                  <span>Adicionar Cabo</span>
                  {isAddingCableMode && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-950/40 text-emerald-100 text-[9px] font-mono">
                      ATIVO
                    </span>
                  )}
                </button>
                <p className="text-[10px] text-center text-slate-400 leading-tight">
                  {isAddingCableMode
                    ? 'Modo ativo: conecte pontos numerados ou clique na área livre fora dos componentes. Clique novamente para desativar.'
                    : 'Clique em "Adicionar Cabo" para liberar a adição de cabos no diagrama.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé fixo com créditos */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 text-center shrink-0">
          <p className="text-[11px] text-slate-400">
            Desenvolvido por{' '}
            <span className="font-semibold text-slate-200">
              Gilvan Ezequiel Felker
            </span>
          </p>
        </div>
      </aside>
    </>
  );
};
