import React, { useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Loader2, Eye, Layers, Trash2 } from 'lucide-react';
import { useDiagramStore } from '../store/useDiagramStore';

export const ExportButton: React.FC = () => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const viewMode = useDiagramStore((state) => state.viewMode);
  const setViewMode = useDiagramStore((state) => state.setViewMode);
  const setIsExportingDiagram = useDiagramStore(
    (state) => state.setIsExportingDiagram
  );
  const clearDiagram = useDiagramStore((state) => state.clearDiagram);

  const handleExportPng = async (forceRealistic: boolean) => {
    const viewportElement = document.querySelector<HTMLElement>(
      '.react-flow__viewport'
    );

    if (!viewportElement) {
      return;
    }

    const previousMode = viewMode;

    try {
      setIsExporting(true);
      setIsExportingDiagram(true);

      if (forceRealistic && previousMode !== 'realistic') {
        setViewMode('realistic');
      }

      // Aguarda a re-renderização do DOM ocultando descrições, seleções e botões flutuantes
      await new Promise((resolve) => setTimeout(resolve, 180));

      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2.5,
      });

      const link = document.createElement('a');
      const suffix = forceRealistic ? 'cabo-real' : previousMode;
      link.download = `instrucao-montagem-${suffix}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Erro ao exportar instrução de montagem:', error);
    } finally {
      setIsExportingDiagram(false);
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Alternador de Visualização: Esquema Lógico vs Cabo Real */}
      <div className="flex items-center rounded-lg bg-slate-900/95 p-1 border border-slate-700 shadow-lg">
        <button
          type="button"
          onClick={() => setViewMode('schematic')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            viewMode === 'schematic'
              ? 'bg-slate-700 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Modo Esquema</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('realistic')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            viewMode === 'realistic'
              ? 'bg-amber-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Modo Cabo Real</span>
        </button>
      </div>

      {/* Botão de Exportação com renderização física realista garantida */}
      <button
        type="button"
        onClick={() => handleExportPng(true)}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-semibold text-xs uppercase tracking-wider shadow-lg border border-sky-400/40 transition-all cursor-pointer"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>Exportar Imagem</span>
      </button>

      {/* Botão para Limpar todo o Diagrama */}
      <button
        type="button"
        onClick={clearDiagram}
        title="Limpar todos os componentes e cabos do diagrama"
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-100 font-semibold text-xs uppercase tracking-wider shadow-lg border border-rose-700/70 transition-all cursor-pointer"
      >
        <Trash2 className="w-4 h-4 text-rose-300" />
        <span>Limpar Diagrama</span>
      </button>
    </div>
  );
};
