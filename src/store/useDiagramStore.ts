import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import type {
  ConnectorNodeType,
  WireAnchorNodeType,
  DiagramNodeType,
  WireEdgeType,
  ConnectorCatalogItem,
  WirePreset,
  WireTerminalConfig,
  WireIdentifierConfig,
  WireAlignmentMode,
  CableEndpointSpec,
  CopiedWireSnapshot,
  CustomTerminalDefinition,
  ViewMode,
  PinSide,
} from '../types/diagram';
import { WIRE_ANCHOR_HALF_SIZE } from '../components/WireAnchorNode';

const PIN_SIDE_ORDER: PinSide[] = ['right', 'bottom', 'left', 'top'];
const CUSTOM_CATALOG_STORAGE_KEY = 'wire_editor_custom_catalog_v1';
const CUSTOM_TERMINALS_STORAGE_KEY = 'wire_editor_custom_terminals_v1';

const getCardinalAngle = (dx: number, dy: number): number => {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 0 : 180;
  }
  return dy >= 0 ? 90 : 270;
};

const pruneUnusedWireAnchors = (
  nodes: DiagramNodeType[],
  edges: WireEdgeType[]
): DiagramNodeType[] => {
  const usedIds = new Set<string>();
  for (const edge of edges) {
    usedIds.add(edge.source);
    usedIds.add(edge.target);
  }
  return nodes.filter(
    (node) => node.type !== 'wireAnchor' || usedIds.has(node.id)
  );
};

export const DEFAULT_CONNECTOR_CATALOG: ConnectorCatalogItem[] = [];

const loadInitialCatalog = (): ConnectorCatalogItem[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_CATALOG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONNECTOR_CATALOG;
    const customItems = JSON.parse(raw) as ConnectorCatalogItem[];
    if (!Array.isArray(customItems)) return DEFAULT_CONNECTOR_CATALOG;
    return [...DEFAULT_CONNECTOR_CATALOG, ...customItems];
  } catch {
    return DEFAULT_CONNECTOR_CATALOG;
  }
};

const saveCustomCatalog = (catalog: ConnectorCatalogItem[]) => {
  try {
    const customOnly = catalog.filter((item) => item.isCustom);
    localStorage.setItem(CUSTOM_CATALOG_STORAGE_KEY, JSON.stringify(customOnly));
  } catch (err) {
    console.error('Erro ao salvar catálogo customizado no localStorage:', err);
  }
};

const loadCustomTerminals = (): CustomTerminalDefinition[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_TERMINALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomTerminalDefinition[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCustomTerminals = (terminals: CustomTerminalDefinition[]) => {
  try {
    localStorage.setItem(
      CUSTOM_TERMINALS_STORAGE_KEY,
      JSON.stringify(terminals)
    );
  } catch (err) {
    console.error('Erro ao salvar terminais customizados no localStorage:', err);
  }
};

export interface WireGaugeStep {
  awg: string;
  thickness: number;
}

export interface WireColorOption {
  colorHex: string;
  colorName: string;
}

export const WIRE_GAUGE_STEPS: WireGaugeStep[] = [
  { awg: '28 AWG', thickness: 1.5 },
  { awg: '26 AWG', thickness: 2.0 },
  { awg: '24 AWG', thickness: 2.5 },
  { awg: '22 AWG', thickness: 3.0 },
  { awg: '20 AWG', thickness: 3.5 },
  { awg: '18 AWG', thickness: 4.5 },
  { awg: '16 AWG', thickness: 5.5 },
  { awg: '14 AWG', thickness: 6.5 },
  { awg: '12 AWG', thickness: 7.5 },
  { awg: '10 AWG', thickness: 9.0 },
];

export const WIRE_COLOR_OPTIONS: WireColorOption[] = [
  { colorHex: '#ef4444', colorName: 'Vermelho (VCC)' },
  { colorHex: '#3b82f6', colorName: 'Azul (GND)' },
  { colorHex: '#1e293b', colorName: 'Preto (Sinal)' },
  { colorHex: '#eab308', colorName: 'Amarelo (Campo)' },
  { colorHex: '#22c55e', colorName: 'Verde (Terra/PE)' },
  { colorHex: '#f97316', colorName: 'Laranja (Auxiliar)' },
  { colorHex: '#92400e', colorName: 'Marrom (+24V)' },
  { colorHex: '#a855f7', colorName: 'Roxo (Controle)' },
  { colorHex: '#f8fafc', colorName: 'Branco (Sinal)' },
  { colorHex: '#64748b', colorName: 'Cinza (Comum)' },
];

export const MIN_STRIP_LENGTH = 0;
export const MAX_STRIP_LENGTH = 30;
export const DEFAULT_STRIP_LENGTH = 8;

export const WIRE_PRESETS: WirePreset[] = [
  {
    id: '24awg-red',
    awg: '24 AWG',
    colorHex: '#ef4444',
    colorName: 'Vermelho (VCC)',
    label: '24 AWG',
    thickness: 2.5,
    leftStripLength: DEFAULT_STRIP_LENGTH,
    rightStripLength: DEFAULT_STRIP_LENGTH,
    leftTinned: false,
    rightTinned: false,
    leftHeatShrink: false,
    rightHeatShrink: false,
    leftTerminal: {
      enabled: true,
      type: 'tubular',
      label: 'Terminal Tubular',
      colorHex: '#ef4444',
      colorName: 'Vermelho',
    },
    rightTerminal: {
      enabled: true,
      type: 'tubular',
      label: 'Terminal Tubular',
      colorHex: '#ef4444',
      colorName: 'Vermelho',
    },
    leftIdentifier: {
      enabled: false,
      text: 'CABO-ESQ',
    },
    rightIdentifier: {
      enabled: false,
      text: 'CABO-DIR',
    },
  },
];

const initialNodes: ConnectorNodeType[] = [];

const initialEdges: WireEdgeType[] = [];

export type PendingDeleteTarget =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string };

interface DiagramState {
  nodes: DiagramNodeType[];
  edges: WireEdgeType[];
  catalog: ConnectorCatalogItem[];
  isComponentDesignerOpen: boolean;
  editingCatalogItemId: string | null;
  customTerminals: CustomTerminalDefinition[];
  isTerminalDesignerOpen: boolean;
  editingCustomTerminalId: string | null;
  terminalDesignerTargetSide: 'leftTerminal' | 'rightTerminal' | null;
  activeWirePreset: WirePreset;
  viewMode: ViewMode;
  pendingDeleteTarget: PendingDeleteTarget | null;
  editingEdgeId: string | null;
  isAddingCableMode: boolean;
  copiedWire: CopiedWireSnapshot | null;
  isPastingCableMode: boolean;
  isExportingDiagram: boolean;
  onNodesChange: OnNodesChange<DiagramNodeType>;
  onEdgesChange: OnEdgesChange<WireEdgeType>;
  onConnect: OnConnect;
  addConnectorNode: (catalogId: string, position: { x: number; y: number }) => void;
  addFreeCable: (start: CableEndpointSpec, end: CableEndpointSpec) => void;
  moveWireAnchorNode: (
    nodeId: string,
    centerPosition: { x: number; y: number }
  ) => void;
  requestDeleteNode: (nodeId: string) => void;
  requestDeleteEdge: (edgeId: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => void;
  startEditingEdge: (edgeId: string) => void;
  stopEditingEdge: () => void;
  toggleAddingCableMode: () => void;
  setAddingCableMode: (enabled: boolean) => void;
  copyWire: (snapshot: CopiedWireSnapshot) => void;
  startPastingCableMode: () => void;
  cancelPastingCableMode: () => void;
  clearCopiedWire: () => void;
  pasteCopiedWireAt: (centerPosition: { x: number; y: number }) => void;
  updateEdgeWireParams: (edgeId: string, preset: WirePreset) => void;
  openComponentDesigner: (catalogItemId?: string | null) => void;
  closeComponentDesigner: () => void;
  addCatalogItem: (item: Omit<ConnectorCatalogItem, 'id' | 'isCustom'>) => void;
  updateCatalogItem: (
    id: string,
    updates: Omit<ConnectorCatalogItem, 'id' | 'isCustom'>
  ) => void;
  removeCatalogItem: (id: string) => void;
  openTerminalDesigner: (
    terminalId?: string | null,
    targetSide?: 'leftTerminal' | 'rightTerminal' | null
  ) => void;
  closeTerminalDesigner: () => void;
  addCustomTerminal: (
    terminal: Omit<CustomTerminalDefinition, 'id' | 'createdAt'>
  ) => CustomTerminalDefinition;
  updateCustomTerminal: (
    id: string,
    updates: Omit<CustomTerminalDefinition, 'id' | 'createdAt'>
  ) => void;
  removeCustomTerminal: (id: string) => void;
  rotateConnectorNode: (nodeId: string) => void;
  toggleHideNodePins: (nodeId: string) => void;
  resizeConnectorNode: (nodeId: string, size: number) => void;
  updateEdgeAlignment: (
    edgeId: string,
    alignment: {
      alignmentMode?: WireAlignmentMode;
      controlX?: number;
      controlY?: number;
    }
  ) => void;
  updateEdgeTerminal: (
    edgeId: string,
    side: 'leftTerminal' | 'rightTerminal',
    updates: Partial<WireTerminalConfig>
  ) => void;
  updateEdgeIdentifier: (
    edgeId: string,
    side: 'leftIdentifier' | 'rightIdentifier',
    updates: Partial<WireIdentifierConfig>
  ) => void;
  selectEdge: (edgeId: string) => void;
  setActiveWirePreset: (preset: WirePreset) => void;
  setViewMode: (mode: ViewMode) => void;
  setIsExportingDiagram: (isExporting: boolean) => void;
  clearDiagram: () => void;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  catalog: loadInitialCatalog(),
  isComponentDesignerOpen: false,
  editingCatalogItemId: null,
  customTerminals: loadCustomTerminals(),
  isTerminalDesignerOpen: false,
  editingCustomTerminalId: null,
  terminalDesignerTargetSide: null,
  activeWirePreset: WIRE_PRESETS[0],
  viewMode: 'realistic',
  pendingDeleteTarget: null,
  editingEdgeId: null,
  isAddingCableMode: false,
  copiedWire: null,
  isPastingCableMode: false,
  isExportingDiagram: false,

  onNodesChange: (changes) => {
    const nextNodes = applyNodeChanges(changes, get().nodes);
    set({
      nodes: pruneUnusedWireAnchors(nextNodes, get().edges),
    });
  },

  onEdgesChange: (changes) => {
    const nextEdges = applyEdgeChanges(changes, get().edges);
    const currentEditingId = get().editingEdgeId;
    const stillEditingSelected =
      currentEditingId !== null &&
      nextEdges.some((edge) => edge.id === currentEditingId && edge.selected);
    set({
      nodes: pruneUnusedWireAnchors(get().nodes, nextEdges),
      edges: nextEdges,
      editingEdgeId: stillEditingSelected ? currentEditingId : null,
    });
  },

  onConnect: (connection: Connection) => {
    if (!get().isAddingCableMode) return;
    const preset = get().activeWirePreset;
    const newEdge: WireEdgeType = {
      ...connection,
      id: `wire-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'wire',
      zIndex: 2000,
      data: {
        awg: preset.awg,
        colorHex: preset.colorHex,
        label: preset.label,
        thickness: preset.thickness,
        leftStripLength: preset.leftStripLength,
        rightStripLength: preset.rightStripLength,
        leftTinned: preset.leftTinned,
        rightTinned: preset.rightTinned,
        leftHeatShrink: preset.leftHeatShrink,
        rightHeatShrink: preset.rightHeatShrink,
        leftTerminal: { ...preset.leftTerminal },
        rightTerminal: { ...preset.rightTerminal },
        leftIdentifier: { ...preset.leftIdentifier },
        rightIdentifier: { ...preset.rightIdentifier },
      },
    };
    set({
      edges: addEdge(newEdge, get().edges),
    });
  },

  addConnectorNode: (catalogId, position) => {
    const template = get().catalog.find(
      (item) => item.id === catalogId || item.type === catalogId
    );
    if (!template) return;

    const existingCount =
      get().nodes.filter(
        (n): n is ConnectorNodeType =>
          n.type === 'connector' && n.data.partNumber === template.partNumber
      ).length + 1;

    const newNode: ConnectorNodeType = {
      id: `node-${template.partNumber}-${Date.now()}`,
      type: 'connector',
      position,
      data: {
        catalogId: template.id,
        partNumber: template.partNumber,
        label: `${template.label} #${existingCount}`,
        pinCount: template.pinCount,
        type: template.type,
        pinSide: template.defaultPinSide,
        defaultPinSide: template.defaultPinSide,
        imageUrl: template.imageUrl,
        drawing: template.drawing,
        pinPositions: template.pinPositions,
      },
    };
    set({
      nodes: [...get().nodes, newNode],
    });
  },

  addFreeCable: (start, end) => {
    if (!get().isAddingCableMode) return;
    const preset = get().activeWirePreset;
    const stamp = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newAnchors: WireAnchorNodeType[] = [];

    let sourceNodeId: string;
    let sourceHandleId: string;
    if (start.kind === 'free') {
      sourceNodeId = `wire-anchor-src-${stamp}`;
      sourceHandleId = 'anchor';
      newAnchors.push({
        id: sourceNodeId,
        type: 'wireAnchor',
        position: {
          x: Math.round((start.position.x - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
          y: Math.round((start.position.y - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
        },
        data: { isFreeAnchor: true },
        selectable: false,
        draggable: false,
        focusable: false,
      });
    } else {
      sourceNodeId = start.nodeId;
      sourceHandleId = start.handleId;
    }

    let targetNodeId: string;
    let targetHandleId: string;
    if (end.kind === 'free') {
      targetNodeId = `wire-anchor-tgt-${stamp}`;
      targetHandleId = 'anchor';
      newAnchors.push({
        id: targetNodeId,
        type: 'wireAnchor',
        position: {
          x: Math.round((end.position.x - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
          y: Math.round((end.position.y - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
        },
        data: { isFreeAnchor: true },
        selectable: false,
        draggable: false,
        focusable: false,
      });
    } else {
      targetNodeId = end.nodeId;
      targetHandleId = end.handleId;
    }

    const startPos = start.position;
    const endPos = end.position;
    const dx = startPos && endPos ? endPos.x - startPos.x : 100;
    const dy = startPos && endPos ? endPos.y - startPos.y : 0;

    const freeStartAngle =
      start.kind === 'free' ? getCardinalAngle(dx, dy) : undefined;
    const freeEndAngle =
      end.kind === 'free' ? getCardinalAngle(-dx, -dy) : undefined;

    const newEdge: WireEdgeType = {
      id: `wire-${stamp}`,
      source: sourceNodeId,
      sourceHandle: sourceHandleId,
      target: targetNodeId,
      targetHandle: targetHandleId,
      type: 'wire',
      zIndex: 2000,
      data: {
        awg: preset.awg,
        colorHex: preset.colorHex,
        label: preset.label,
        thickness: preset.thickness,
        leftStripLength: preset.leftStripLength,
        rightStripLength: preset.rightStripLength,
        leftTinned: preset.leftTinned,
        rightTinned: preset.rightTinned,
        leftHeatShrink: preset.leftHeatShrink,
        rightHeatShrink: preset.rightHeatShrink,
        leftTerminal: {
          ...preset.leftTerminal,
          ...(freeStartAngle !== undefined ? { angle: freeStartAngle } : {}),
        },
        rightTerminal: {
          ...preset.rightTerminal,
          ...(freeEndAngle !== undefined ? { angle: freeEndAngle } : {}),
        },
        leftIdentifier: { ...preset.leftIdentifier },
        rightIdentifier: { ...preset.rightIdentifier },
      },
    };

    set({
      nodes: [...get().nodes, ...newAnchors],
      edges: addEdge(newEdge, get().edges),
    });
  },

  moveWireAnchorNode: (nodeId, centerPosition) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id !== nodeId || node.type !== 'wireAnchor') return node;
        return {
          ...node,
          position: {
            x:
              Math.round((centerPosition.x - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
            y:
              Math.round((centerPosition.y - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
          },
        };
      }),
    });
  },

  requestDeleteNode: (nodeId) => {
    set({ pendingDeleteTarget: { type: 'node', id: nodeId } });
  },

  requestDeleteEdge: (edgeId) => {
    set({ pendingDeleteTarget: { type: 'edge', id: edgeId } });
  },

  cancelDelete: () => {
    set({ pendingDeleteTarget: null });
  },

  confirmDelete: () => {
    const target = get().pendingDeleteTarget;
    if (!target) return;

    if (target.type === 'node') {
      const nextEdges = get().edges.filter(
        (edge) => edge.source !== target.id && edge.target !== target.id
      );
      const nextNodes = pruneUnusedWireAnchors(
        get().nodes.filter((node) => node.id !== target.id),
        nextEdges
      );
      const currentEditingId = get().editingEdgeId;
      const editingStillExists =
        currentEditingId !== null &&
        nextEdges.some((edge) => edge.id === currentEditingId);
      set({
        nodes: nextNodes,
        edges: nextEdges,
        pendingDeleteTarget: null,
        editingEdgeId: editingStillExists ? currentEditingId : null,
      });
      return;
    }

    const nextEdges = get().edges.filter((edge) => edge.id !== target.id);
    set({
      nodes: pruneUnusedWireAnchors(get().nodes, nextEdges),
      edges: nextEdges,
      pendingDeleteTarget: null,
      editingEdgeId:
        get().editingEdgeId === target.id ? null : get().editingEdgeId,
    });
  },

  startEditingEdge: (edgeId) => {
    set({
      editingEdgeId: edgeId,
      isAddingCableMode: false,
      edges: get().edges.map((edge) => ({
        ...edge,
        selected: edge.id === edgeId,
      })),
      nodes: get().nodes.map((node) => ({
        ...node,
        selected: false,
      })),
    });
  },

  stopEditingEdge: () => {
    set({ editingEdgeId: null });
  },

  toggleAddingCableMode: () => {
    const next = !get().isAddingCableMode;
    set({
      isAddingCableMode: next,
      isPastingCableMode: next ? false : get().isPastingCableMode,
      editingEdgeId: next ? null : get().editingEdgeId,
    });
  },

  setAddingCableMode: (enabled) => {
    set({
      isAddingCableMode: enabled,
      isPastingCableMode: enabled ? false : get().isPastingCableMode,
      editingEdgeId: enabled ? null : get().editingEdgeId,
    });
  },

  copyWire: (snapshot) => {
    set({
      copiedWire: {
        ...snapshot,
        data: {
          ...snapshot.data,
          leftTerminal: snapshot.data.leftTerminal
            ? { ...snapshot.data.leftTerminal }
            : undefined,
          rightTerminal: snapshot.data.rightTerminal
            ? { ...snapshot.data.rightTerminal }
            : undefined,
          leftIdentifier: snapshot.data.leftIdentifier
            ? { ...snapshot.data.leftIdentifier }
            : undefined,
          rightIdentifier: snapshot.data.rightIdentifier
            ? { ...snapshot.data.rightIdentifier }
            : undefined,
        },
      },
    });
  },

  startPastingCableMode: () => {
    if (!get().copiedWire) return;
    set({
      isPastingCableMode: true,
      isAddingCableMode: false,
      editingEdgeId: null,
    });
  },

  cancelPastingCableMode: () => {
    set({ isPastingCableMode: false });
  },

  clearCopiedWire: () => {
    set({ copiedWire: null, isPastingCableMode: false });
  },

  pasteCopiedWireAt: (centerPosition) => {
    const copied = get().copiedWire;
    if (!copied) return;

    const stamp = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sourceNodeId = `wire-anchor-src-${stamp}`;
    const targetNodeId = `wire-anchor-tgt-${stamp}`;

    const startCenterX = centerPosition.x - copied.halfDx;
    const startCenterY = centerPosition.y - copied.halfDy;
    const endCenterX = centerPosition.x + copied.halfDx;
    const endCenterY = centerPosition.y + copied.halfDy;

    const sourceAnchor: WireAnchorNodeType = {
      id: sourceNodeId,
      type: 'wireAnchor',
      position: {
        x: Math.round((startCenterX - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
        y: Math.round((startCenterY - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
      },
      data: { isFreeAnchor: true },
      selectable: false,
      draggable: false,
      focusable: false,
    };

    const targetAnchor: WireAnchorNodeType = {
      id: targetNodeId,
      type: 'wireAnchor',
      position: {
        x: Math.round((endCenterX - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
        y: Math.round((endCenterY - WIRE_ANCHOR_HALF_SIZE) * 10) / 10,
      },
      data: { isFreeAnchor: true },
      selectable: false,
      draggable: false,
      focusable: false,
    };

    const baseData = copied.data;
    const nextLeftTerminal: WireTerminalConfig = {
      enabled: baseData.leftTerminal?.enabled ?? true,
      type: baseData.leftTerminal?.type ?? 'tubular',
      customTerminalId: baseData.leftTerminal?.customTerminalId,
      label: baseData.leftTerminal?.label ?? 'Terminal Tubular',
      colorHex: baseData.leftTerminal?.colorHex ?? baseData.colorHex,
      colorName: baseData.leftTerminal?.colorName ?? '',
      offsetX: 0,
      offsetY: 0,
      angle: copied.sourceAngle,
    };

    const nextRightTerminal: WireTerminalConfig = {
      enabled: baseData.rightTerminal?.enabled ?? true,
      type: baseData.rightTerminal?.type ?? 'tubular',
      customTerminalId: baseData.rightTerminal?.customTerminalId,
      label: baseData.rightTerminal?.label ?? 'Terminal Tubular',
      colorHex: baseData.rightTerminal?.colorHex ?? baseData.colorHex,
      colorName: baseData.rightTerminal?.colorName ?? '',
      offsetX: 0,
      offsetY: 0,
      angle: copied.targetAngle,
    };

    const newEdgeId = `wire-${stamp}`;
    const newEdge: WireEdgeType = {
      id: newEdgeId,
      source: sourceNodeId,
      sourceHandle: 'anchor',
      target: targetNodeId,
      targetHandle: 'anchor',
      type: 'wire',
      zIndex: 2000,
      selected: true,
      data: {
        ...baseData,
        leftTerminal: nextLeftTerminal,
        rightTerminal: nextRightTerminal,
        leftIdentifier: baseData.leftIdentifier
          ? { ...baseData.leftIdentifier }
          : undefined,
        rightIdentifier: baseData.rightIdentifier
          ? { ...baseData.rightIdentifier }
          : undefined,
        controlX:
          copied.controlOffsetX !== undefined
            ? Math.round(centerPosition.x + copied.controlOffsetX)
            : undefined,
        controlY:
          copied.controlOffsetY !== undefined
            ? Math.round(centerPosition.y + copied.controlOffsetY)
            : undefined,
      },
    };

    const deselectedNodes = get().nodes.map((n) => ({ ...n, selected: false }));
    const deselectedEdges = get().edges.map((e) => ({ ...e, selected: false }));

    set({
      nodes: [...deselectedNodes, sourceAnchor, targetAnchor],
      edges: addEdge(newEdge, deselectedEdges),
      isPastingCableMode: false,
      editingEdgeId: null,
    });
  },

  updateEdgeWireParams: (edgeId, preset) => {
    set({
      edges: get().edges.map((edge) => {
        if (edge.id !== edgeId) return edge;
        const currentData = edge.data;
        return {
          ...edge,
          data: {
            ...currentData,
            awg: preset.awg,
            colorHex: preset.colorHex,
            label: preset.label,
            thickness: preset.thickness,
            leftStripLength: preset.leftStripLength,
            rightStripLength: preset.rightStripLength,
            leftTinned: preset.leftTinned,
            rightTinned: preset.rightTinned,
            leftHeatShrink: preset.leftHeatShrink,
            rightHeatShrink: preset.rightHeatShrink,
            leftTerminal: {
              ...currentData?.leftTerminal,
              enabled: preset.leftTerminal.enabled,
              type: preset.leftTerminal.type,
              customTerminalId: preset.leftTerminal.customTerminalId,
              label: preset.leftTerminal.label,
              colorHex: preset.leftTerminal.colorHex,
              colorName: preset.leftTerminal.colorName,
            },
            rightTerminal: {
              ...currentData?.rightTerminal,
              enabled: preset.rightTerminal.enabled,
              type: preset.rightTerminal.type,
              customTerminalId: preset.rightTerminal.customTerminalId,
              label: preset.rightTerminal.label,
              colorHex: preset.rightTerminal.colorHex,
              colorName: preset.rightTerminal.colorName,
            },
            leftIdentifier: {
              ...currentData?.leftIdentifier,
              enabled: preset.leftIdentifier.enabled,
              text: preset.leftIdentifier.text,
            },
            rightIdentifier: {
              ...currentData?.rightIdentifier,
              enabled: preset.rightIdentifier.enabled,
              text: preset.rightIdentifier.text,
            },
          },
        };
      }),
    });
  },

  openComponentDesigner: (catalogItemId = null) => {
    set({
      isComponentDesignerOpen: true,
      editingCatalogItemId: catalogItemId,
    });
  },

  closeComponentDesigner: () => {
    set({
      isComponentDesignerOpen: false,
      editingCatalogItemId: null,
    });
  },

  addCatalogItem: (item) => {
    const newItem: ConnectorCatalogItem = {
      ...item,
      id: `cat-custom-${Date.now()}`,
      isCustom: true,
    };
    const updatedCatalog = [...get().catalog, newItem];
    saveCustomCatalog(updatedCatalog);
    set({ catalog: updatedCatalog });
  },

  updateCatalogItem: (id, updates) => {
    const previousItem = get().catalog.find((item) => item.id === id);
    const updatedCatalog = get().catalog.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    saveCustomCatalog(updatedCatalog);

    // Atualiza também instâncias já presentes no diagrama que usam este componente
    const nextNodes = get().nodes.map((node) => {
      if (node.type !== 'connector') return node;
      const matches =
        node.data.catalogId === id ||
        (previousItem && node.data.partNumber === previousItem.partNumber);
      if (!matches) return node;
      const suffixMatch = node.data.label.match(/\s+#\d+$/);
      const suffix = suffixMatch ? suffixMatch[0] : '';
      return {
        ...node,
        data: {
          ...node.data,
          catalogId: id,
          label: `${updates.label}${suffix}`,
          partNumber: updates.partNumber,
          pinCount: updates.pinCount,
          type: updates.type,
          defaultPinSide: updates.defaultPinSide,
          imageUrl: updates.imageUrl,
          drawing: updates.drawing,
          pinPositions: updates.pinPositions,
        },
      };
    });

    set({ catalog: updatedCatalog, nodes: nextNodes });
  },

  removeCatalogItem: (id) => {
    const updatedCatalog = get().catalog.filter((item) => item.id !== id);
    saveCustomCatalog(updatedCatalog);
    set({ catalog: updatedCatalog });
  },

  openTerminalDesigner: (terminalId = null, targetSide = null) => {
    set({
      isTerminalDesignerOpen: true,
      editingCustomTerminalId: terminalId,
      terminalDesignerTargetSide: targetSide,
    });
  },

  closeTerminalDesigner: () => {
    set({
      isTerminalDesignerOpen: false,
      editingCustomTerminalId: null,
      terminalDesignerTargetSide: null,
    });
  },

  addCustomTerminal: (terminal) => {
    const newTerminal: CustomTerminalDefinition = {
      ...terminal,
      id: `custom-term-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
    };
    const nextTerminals = [...get().customTerminals, newTerminal];
    saveCustomTerminals(nextTerminals);
    set({ customTerminals: nextTerminals });
    return newTerminal;
  },

  updateCustomTerminal: (id, updates) => {
    const nextTerminals = get().customTerminals.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    saveCustomTerminals(nextTerminals);

    const currentPreset = get().activeWirePreset;
    const nextPreset: WirePreset = {
      ...currentPreset,
      leftTerminal:
        currentPreset.leftTerminal.customTerminalId === id
          ? { ...currentPreset.leftTerminal, label: updates.name }
          : currentPreset.leftTerminal,
      rightTerminal:
        currentPreset.rightTerminal.customTerminalId === id
          ? { ...currentPreset.rightTerminal, label: updates.name }
          : currentPreset.rightTerminal,
    };

    const nextEdges = get().edges.map((edge) => {
      if (!edge.data) return edge;
      const matchLeft = edge.data.leftTerminal?.customTerminalId === id;
      const matchRight = edge.data.rightTerminal?.customTerminalId === id;
      if (!matchLeft && !matchRight) return edge;
      return {
        ...edge,
        data: {
          ...edge.data,
          leftTerminal:
            matchLeft && edge.data.leftTerminal
              ? { ...edge.data.leftTerminal, label: updates.name }
              : edge.data.leftTerminal,
          rightTerminal:
            matchRight && edge.data.rightTerminal
              ? { ...edge.data.rightTerminal, label: updates.name }
              : edge.data.rightTerminal,
        },
      };
    });

    set({
      customTerminals: nextTerminals,
      activeWirePreset: nextPreset,
      edges: nextEdges,
    });
  },

  removeCustomTerminal: (id) => {
    const nextTerminals = get().customTerminals.filter((item) => item.id !== id);
    saveCustomTerminals(nextTerminals);

    const fallbackTerminal = (term: WireTerminalConfig): WireTerminalConfig =>
      term.customTerminalId === id
        ? {
            ...term,
            type: 'tubular',
            customTerminalId: undefined,
            label: 'Terminal Tubular',
          }
        : term;

    const currentPreset = get().activeWirePreset;
    const nextPreset: WirePreset = {
      ...currentPreset,
      leftTerminal: fallbackTerminal(currentPreset.leftTerminal),
      rightTerminal: fallbackTerminal(currentPreset.rightTerminal),
    };

    const nextEdges = get().edges.map((edge) => {
      if (!edge.data) return edge;
      const matchLeft = edge.data.leftTerminal?.customTerminalId === id;
      const matchRight = edge.data.rightTerminal?.customTerminalId === id;
      if (!matchLeft && !matchRight) return edge;
      return {
        ...edge,
        data: {
          ...edge.data,
          leftTerminal: edge.data.leftTerminal
            ? fallbackTerminal(edge.data.leftTerminal)
            : undefined,
          rightTerminal: edge.data.rightTerminal
            ? fallbackTerminal(edge.data.rightTerminal)
            : undefined,
        },
      };
    });

    set({
      customTerminals: nextTerminals,
      activeWirePreset: nextPreset,
      edges: nextEdges,
    });
  },

  rotateConnectorNode: (nodeId) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id !== nodeId || node.type !== 'connector') return node;
        const currentSide: PinSide = node.data.pinSide ?? 'right';
        const nextIndex = (PIN_SIDE_ORDER.indexOf(currentSide) + 1) % PIN_SIDE_ORDER.length;
        return {
          ...node,
          data: {
            ...node.data,
            pinSide: PIN_SIDE_ORDER[nextIndex],
          },
        };
      }),
    });
  },

  toggleHideNodePins: (nodeId) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id !== nodeId || node.type !== 'connector') return node;
        return {
          ...node,
          data: {
            ...node.data,
            hidePinNumbers: !node.data.hidePinNumbers,
          },
        };
      }),
    });
  },

  resizeConnectorNode: (nodeId, size) => {
    const clampedSize = Math.max(80, Math.min(720, Math.round(size)));
    set({
      nodes: get().nodes.map((node) => {
        if (node.id !== nodeId || node.type !== 'connector') return node;
        return {
          ...node,
          data: {
            ...node.data,
            imageSize: clampedSize,
          },
        };
      }),
    });
  },

  updateEdgeAlignment: (edgeId, alignment) => {
    set({
      edges: get().edges.map((edge) => {
        if (edge.id !== edgeId || !edge.data) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            alignmentMode:
              'alignmentMode' in alignment
                ? alignment.alignmentMode
                : edge.data.alignmentMode,
            controlX:
              'controlX' in alignment ? alignment.controlX : edge.data.controlX,
            controlY:
              'controlY' in alignment ? alignment.controlY : edge.data.controlY,
          },
        };
      }),
    });
  },

  updateEdgeTerminal: (edgeId, side, updates) => {
    set({
      edges: get().edges.map((edge) => {
        if (edge.id !== edgeId || !edge.data) return edge;
        const currentTerminal: WireTerminalConfig = edge.data[side] ?? {
          enabled: true,
          type: 'tubular',
          label: 'Terminal Tubular',
          colorHex: edge.data.colorHex,
          colorName: '',
        };
        return {
          ...edge,
          data: {
            ...edge.data,
            [side]: {
              ...currentTerminal,
              ...updates,
            },
          },
        };
      }),
    });
  },

  updateEdgeIdentifier: (edgeId, side, updates) => {
    set({
      edges: get().edges.map((edge) => {
        if (edge.id !== edgeId || !edge.data) return edge;
        const currentIdentifier: WireIdentifierConfig = edge.data[side] ?? {
          enabled: true,
          text: side === 'leftIdentifier' ? 'CABO-ESQ' : 'CABO-DIR',
        };
        return {
          ...edge,
          data: {
            ...edge.data,
            [side]: {
              ...currentIdentifier,
              ...updates,
            },
          },
        };
      }),
    });
  },

  selectEdge: (edgeId) => {
    const currentEditingId = get().editingEdgeId;
    set({
      edges: get().edges.map((edge) => ({
        ...edge,
        selected: edge.id === edgeId,
      })),
      nodes: get().nodes.map((node) => ({
        ...node,
        selected: false,
      })),
      editingEdgeId: currentEditingId === edgeId ? currentEditingId : null,
    });
  },

  setActiveWirePreset: (preset) => {
    set({ activeWirePreset: preset });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  setIsExportingDiagram: (isExporting) => {
    set({ isExportingDiagram: isExporting });
  },

  clearDiagram: () => {
    set({
      nodes: [],
      edges: [],
      pendingDeleteTarget: null,
      editingEdgeId: null,
      isAddingCableMode: false,
      isPastingCableMode: false,
    });
  },
}));
