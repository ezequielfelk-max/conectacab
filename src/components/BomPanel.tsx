import React, { useMemo, useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Package, Cable } from 'lucide-react';
import { useDiagramStore } from '../store/useDiagramStore';
import type { ConnectorNodeType } from '../types/diagram';

interface GroupedConnectorBOM {
  partNumber: string;
  label: string;
  type: string;
  pinCount: number;
  quantity: number;
}

interface GroupedWireBOM {
  key: string;
  awg: string;
  colorHex: string;
  thickness: number;
  quantity: number;
}

export const BomPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);

  // Filtra apenas conectores reais (ignora nós âncora livres de cabos)
  const connectorNodes = useMemo(
    () =>
      nodes.filter(
        (node): node is ConnectorNodeType => node.type === 'connector'
      ),
    [nodes]
  );

  // Varre os arrays connectorNodes e edges da store do Zustand e agrupa/totaliza
  const { connectorBom, wireBom } = useMemo(() => {
    const connectorMap = new Map<string, GroupedConnectorBOM>();

    for (const node of connectorNodes) {
      const { partNumber, label, type, pinCount } = node.data;
      const existing = connectorMap.get(partNumber);
      if (existing) {
        existing.quantity += 1;
      } else {
        // Remove sufixo de numeração de instância no rótulo genérico do BOM
        const baseLabel = label.replace(/\s+#\d+$/, '');
        connectorMap.set(partNumber, {
          partNumber,
          label: baseLabel,
          type,
          pinCount,
          quantity: 1,
        });
      }
    }

    const wireMap = new Map<string, GroupedWireBOM>();

    for (const edge of edges) {
      if (!edge.data) continue;
      const { awg, colorHex, thickness } = edge.data;
      const key = `${awg}__${colorHex.toLowerCase()}`;
      const existing = wireMap.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        wireMap.set(key, {
          key,
          awg,
          colorHex,
          thickness,
          quantity: 1,
        });
      }
    }

    return {
      connectorBom: Array.from(connectorMap.values()),
      wireBom: Array.from(wireMap.values()),
    };
  }, [connectorNodes, edges]);

  return (
    <div className="print-hide absolute bottom-4 right-4 z-20 w-[560px] max-w-[calc(100vw-20rem)] rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl overflow-hidden">
      {/* Cabeçalho do Painel Flutuante */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/90 hover:bg-slate-800 border-b border-slate-700 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Lista de Materiais (BOM)
          </span>
          <span className="ml-2 px-2 py-0.5 text-[11px] font-mono rounded-full bg-slate-700 text-slate-200">
            {connectorNodes.length} comp. / {edges.length} cabos
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 max-h-64 overflow-y-auto space-y-4 text-xs">
          {/* Tabela de Componentes agrupados por partNumber */}
          <div>
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5">
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>Conectores e Componentes (Agrupados por Part Number)</span>
            </div>
            {connectorBom.length === 0 ? (
              <p className="text-slate-500 italic py-1">
                Nenhum conector inserido no diagrama.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-700/80">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/90 text-slate-300 border-b border-slate-700 text-[11px] uppercase">
                      <th className="py-1.5 px-3 font-semibold">Part Number</th>
                      <th className="py-1.5 px-3 font-semibold">Descrição</th>
                      <th className="py-1.5 px-3 font-semibold">Tipo</th>
                      <th className="py-1.5 px-3 font-semibold text-right">Qtd.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {connectorBom.map((item) => (
                      <tr key={item.partNumber} className="hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 text-sky-400 font-semibold">
                          {item.partNumber}
                        </td>
                        <td className="py-1.5 px-3 font-sans text-slate-200">
                          {item.label} ({item.pinCount}P)
                        </td>
                        <td className="py-1.5 px-3 uppercase text-slate-400">
                          {item.type}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-emerald-400">
                          {item.quantity} un.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabela de Cabos agrupados por AWG e colorHex */}
          <div>
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5">
              <Cable className="w-3.5 h-3.5 text-sky-400" />
              <span>Fios e Cabos Industriais (Agrupados por Bitola AWG e Cor)</span>
            </div>
            {wireBom.length === 0 ? (
              <p className="text-slate-500 italic py-1">
                Nenhuma conexão de cabo realizada.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-700/80">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/90 text-slate-300 border-b border-slate-700 text-[11px] uppercase">
                      <th className="py-1.5 px-3 font-semibold">Bitola (AWG)</th>
                      <th className="py-1.5 px-3 font-semibold">Cor (Hex)</th>
                      <th className="py-1.5 px-3 font-semibold">Espessura</th>
                      <th className="py-1.5 px-3 font-semibold text-right">Total Trechos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {wireBom.map((wire) => (
                      <tr key={wire.key} className="hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 text-amber-300 font-semibold">
                          {wire.awg}
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/30 inline-block"
                              style={{ backgroundColor: wire.colorHex }}
                            />
                            <span className="uppercase text-slate-300">
                              {wire.colorHex}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-slate-400">
                          {wire.thickness}px
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-emerald-400">
                          {wire.quantity} un.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
