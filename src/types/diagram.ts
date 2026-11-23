import type { Node, Edge } from '@xyflow/react';

export type ConnectorType = 'terminal' | 'db9' | 'sensor' | 'custom';
export type ViewMode = 'schematic' | 'realistic';
export type PinSide = 'right' | 'bottom' | 'left' | 'top';

export interface PinCoordinate {
  x: number; // 0 a 100 (%)
  y: number; // 0 a 100 (%)
}

export type ComponentFillPreset =
  | 'grad-inox-h'
  | 'grad-stone-v'
  | 'grad-metal-v'
  | 'grad-metal-h'
  | 'grad-dark-v'
  | 'grad-copper-v'
  | 'grad-amber-v'
  | 'grad-blue-v';

export type ComponentShape =
  | {
      id: string;
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
      fill: string; // hex, 'none' ou 'preset:<ComponentFillPreset>'
      stroke: string; // hex ou 'none'
      strokeWidth: number;
      opacity?: number;
      shadow?: boolean;
    }
  | {
      id: string;
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
      opacity?: number;
      shadow?: boolean;
    }
  | {
      id: string;
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth: number;
      opacity?: number;
    }
  | {
      id: string;
      kind: 'path';
      points: { x: number; y: number }[];
      stroke: string;
      strokeWidth: number;
      opacity?: number;
    }
  | {
      id: string;
      kind: 'screw';
      cx: number;
      cy: number;
      radius: number;
      angle: number;
    }
  | {
      id: string;
      kind: 'led';
      cx: number;
      cy: number;
      radius: number;
      color: string;
    }
  | {
      id: string;
      kind: 'threads';
      x: number;
      y: number;
      width: number;
      height: number;
      count: number;
      orientation: 'vertical' | 'horizontal';
      opacity?: number;
    }
  | {
      id: string;
      kind: 'badge';
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
      text: string;
      bgColor: string;
      textColor: string;
      borderColor: string;
      fontSize: number;
    };

export interface CustomComponentDrawing {
  canvasWidth: number;
  canvasHeight: number;
  shapes: ComponentShape[];
}

// Estrutura de dados internos dos componentes industriais
export interface ConnectorData extends Record<string, unknown> {
  catalogId?: string;
  partNumber: string;
  label: string;
  pinCount: number;
  type: ConnectorType;
  pinSide?: PinSide;
  defaultPinSide?: PinSide;
  imageUrl?: string;
  drawing?: CustomComponentDrawing;
  pinPositions?: PinCoordinate[];
  hidePinNumbers?: boolean;
  imageSize?: number;
}

export const TERMINAL_DYNAMIC_COLOR = '__TERMINAL_COLOR__';

export type CustomTerminalShape =
  | {
      id: string;
      kind: 'path';
      points: { x: number; y: number }[];
      stroke: string;
      strokeWidth: number;
    }
  | {
      id: string;
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth: number;
    }
  | {
      id: string;
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
      rx?: number;
    }
  | {
      id: string;
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    };

export interface CustomTerminalDefinition {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  attachX: number;
  attachY: number;
  tipX: number;
  scale: number;
  shapes: CustomTerminalShape[];
  createdAt: number;
}

export type WireTerminalType = 'tubular' | 'custom';

export interface WireTerminalConfig {
  enabled: boolean;
  type: WireTerminalType;
  customTerminalId?: string;
  label: string;
  colorHex: string;
  colorName: string;
  offsetX?: number;
  offsetY?: number;
  angle?: number;
}

export interface WireIdentifierConfig {
  enabled: boolean;
  text: string;
  offset?: number; // Posição relativa (0 a 1) ao longo do cabo
}

export type WireAlignmentMode =
  | 'auto'
  | 'vertical'
  | 'horizontal'
  | 'corner-hv'
  | 'corner-vh'
  | 'straight'
  | 'bezier';

// Estrutura de dados dos cabos
export interface WireData extends Record<string, unknown> {
  awg: string;
  colorHex: string;
  label: string;
  thickness: number;
  leftStripLength?: number;
  rightStripLength?: number;
  leftTinned?: boolean;
  rightTinned?: boolean;
  leftHeatShrink?: boolean;
  rightHeatShrink?: boolean;
  leftTerminal?: WireTerminalConfig;
  rightTerminal?: WireTerminalConfig;
  leftIdentifier?: WireIdentifierConfig;
  rightIdentifier?: WireIdentifierConfig;
  alignmentMode?: WireAlignmentMode;
  controlX?: number;
  controlY?: number;
}

export interface CopiedWireSnapshot {
  data: WireData;
  halfDx: number;
  halfDy: number;
  sourceAngle: number;
  targetAngle: number;
  controlOffsetX?: number;
  controlOffsetY?: number;
}

export interface WireAnchorData extends Record<string, unknown> {
  isFreeAnchor: true;
}

export type ConnectorNodeType = Node<ConnectorData, 'connector'>;
export type WireAnchorNodeType = Node<WireAnchorData, 'wireAnchor'>;
export type DiagramNodeType = ConnectorNodeType | WireAnchorNodeType;
export type WireEdgeType = Edge<WireData, 'wire'>;

export type CableEndpointSpec =
  | {
      kind: 'pin';
      nodeId: string;
      handleId: string;
      position?: { x: number; y: number };
    }
  | {
      kind: 'free';
      position: { x: number; y: number };
    };

export interface ConnectorCatalogItem {
  id: string;
  type: ConnectorType;
  label: string;
  partNumber: string;
  pinCount: number;
  description: string;
  defaultPinSide: PinSide;
  imageUrl?: string;
  drawing?: CustomComponentDrawing;
  pinPositions?: PinCoordinate[];
  isCustom?: boolean;
}

export interface WirePreset {
  id: string;
  awg: string;
  colorHex: string;
  colorName: string;
  label: string;
  thickness: number;
  leftStripLength: number;
  rightStripLength: number;
  leftTinned: boolean;
  rightTinned: boolean;
  leftHeatShrink: boolean;
  rightHeatShrink: boolean;
  leftTerminal: WireTerminalConfig;
  rightTerminal: WireTerminalConfig;
  leftIdentifier: WireIdentifierConfig;
  rightIdentifier: WireIdentifierConfig;
}
