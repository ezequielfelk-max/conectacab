import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WireAnchorNodeType } from '../types/diagram';
import { useDiagramStore } from '../store/useDiagramStore';

export const WIRE_ANCHOR_HALF_SIZE = 6;

// Nó âncora invisível usado para pontas livres de cabos posicionadas fora de componentes
export const WireAnchorNode: React.FC<NodeProps<WireAnchorNodeType>> = () => {
  const isAddingCableMode = useDiagramStore((state) => state.isAddingCableMode);

  return (
    <div className="relative w-3 h-3 pointer-events-none select-none">
      <Handle
        type="source"
        position={Position.Right}
        id="anchor"
        isConnectable={isAddingCableMode}
        style={{
          left: '50%',
          top: '50%',
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
        }}
        className="!w-3 !h-3 !bg-transparent !border-0 !opacity-0 pointer-events-none"
      />
    </div>
  );
};
