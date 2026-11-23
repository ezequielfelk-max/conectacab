# Documentação Completa do Projeto — Editor de Diagramas de Cabos e Conectores Industriais

Este documento detalha toda a arquitetura, funcionalidades e evoluções implementadas na aplicação web de diagramação vetorial e montagem física de chicotes elétricos industriais (`wire-diagram-editor`).

---

## 1. Visão Geral e Stack Tecnológico

A aplicação opera como um CAD elétrico interativo *drag-and-drop* para criação de instruções de montagem de chão de fábrica, onde conectores industriais são representados como **Nós (`Nodes`)** e os cabos/fios são representados como **Arestas (`Edges`)**, contando com visualização dupla em tempo real (**Modo Esquema** e **Modo Cabo Real**).

### Tecnologias Utilizadas
* **Core:** React 18+, TypeScript (tipagem estrita), Vite 6.
* **Motor Vetorial do Canvas:** `@xyflow/react` (React Flow v12).
* **Gerenciamento de Estado Global:** `zustand` (com persistência em `localStorage` para o catálogo de componentes customizados).
* **Estilização:** Tailwind CSS (100% classes utilitárias, sem arquivos CSS customizados).
* **Exportação de Imagem Técnica:** `html-to-image` (`toPng` em alta definição).
* **Ícones:** `lucide-react`.

---

## 2. Estrutura de Diretórios e Arquivos

Localização do projeto: `C:\Users\Pichau\wire-diagram-editor` (`/mnt/c/Users/Pichau/wire-diagram-editor`)

```text
wire-diagram-editor/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── main.tsx                     # Ponto de entrada React
    ├── index.css                    # Diretivas Tailwind CSS
    ├── vite-env.d.ts                # Tipos de cliente do Vite
    ├── App.tsx                      # Canvas React Flow, Drag-and-Drop e camadas Z-Index
    ├── types/
    │   └── diagram.ts               # Interfaces TypeScript (ConnectorData, WireData, PinCoordinate, etc.)
    ├── store/
    │   └── useDiagramStore.ts       # Store global Zustand (nós, cabos, catálogo, rotação e modos)
    └── components/
        ├── ConnectorNode.tsx        # Nó customizado (Modo Esquema, Modo Cabo Real e PNG Mapeado)
        ├── WireEdge.tsx             # Aresta customizada (Cabo cilíndrico 3D limpo e esquema)
        ├── Sidebar.tsx              # Catálogo lateral, seletor de cabos e Modal de Novo Componente
        ├── BomPanel.tsx             # Lista de Materiais (BOM) agrupada automaticamente
        └── ExportButton.tsx         # Alternador de modo de visão e exportador PNG de alta resolução
```

---

## 3. Modelagem de Dados (TypeScript)

Definida em `src/types/diagram.ts`:

```typescript
export type ConnectorType = 'terminal' | 'db9' | 'sensor';
export type ViewMode = 'schematic' | 'realistic';
export type PinSide = 'right' | 'bottom' | 'left' | 'top';

export interface PinCoordinate {
  x: number; // Coordenada horizontal percentual (0 a 100%) sobre a imagem
  y: number; // Coordenada vertical percentual (0 a 100%) sobre a imagem
}

export interface ConnectorData extends Record<string, unknown> {
  partNumber: string;
  label: string;
  pinCount: number;
  type: ConnectorType;
  pinSide?: PinSide;
  defaultPinSide?: PinSide;
  imageUrl?: string;
  pinPositions?: PinCoordinate[];
}

export interface WireData extends Record<string, unknown> {
  awg: string;
  colorHex: string;
  label: string;
  thickness: number;
}
```

---

## 4. Funcionalidades Implementadas (Passo a Passo)

### 4.1. Motor do Canvas e Estado Global (`App.tsx` e `useDiagramStore.ts`)
* **Canvas em Tela Cheia:** `<ReactFlow>` configurado com `<Controls>` nativos de zoom/pan e `<Background>` com grade pontilhada.
* **Conexão Livre Pino a Pino (`ConnectionMode.Loose`):** Permite iniciar ou terminar um fio em qualquer pino de qualquer componente.
* **Sobreposição de Cabos sobre Conectores (`z-index`):** A camada de cabos (`.react-flow__edges`) opera com `zIndex: 2000` acima da camada de nós (`.react-flow__nodes`, com `z-10`) e `elevateNodesOnSelect={false}`, garantindo que os cabos conectados fiquem sempre visíveis **por cima** da imagem do conector.

### 4.2. Pinos em Lado Único e Rotação Manual de 90° (`ConnectorNode.tsx`)
* **Conjunto Único de Pinos:** Cada conector possui exatamente `pinCount` pinos (`pin-1` a `pin-N`) posicionados em um único lado por vez.
* **Botão "Girar (90°)" em cada Componente:** Permite rotacionar manualmente a orientação do conector em passos de 90° no sentido horário (`DIR → BAIXO → ESQ → TOPO`).
* **Recálculo Automático de Conexões:** Utiliza `useUpdateNodeInternals()` do React Flow para atualizar instantaneamente a ancoragem dos cabos conectados sempre que o conector é girado ou o modo de visualização é alternado.

### 4.3. Duplo Modo de Visualização: Esquema vs. Cabo Real
Na barra superior direita (`ExportButton.tsx`), o usuário pode alternar em tempo real entre:
1. **Modo Esquema (`schematic`):**
   * Renderiza todos os conectores como blocos técnicos padronizados, com cabeçalho, `partNumber` e régua de pinos na borda selecionada.
   * Renderiza os fios como linhas vetoriais contínuas na cor e espessura da bitola.
2. **Modo Cabo Real (`realistic`):**
   * **Cabos Físicos Cilíndricos 3D (`WireEdge.tsx`):** Renderiza os cabos usando 4 camadas SVG sobrepostas (sombra projetada + contorno externo escuro para contraste no fundo branco + isolamento principal na cor `colorHex` + reflexo especular branco central simulando relevo plástico cilíndrico).
   * **Desenho Limpo:** Sem textos de bitola (`24 AWG`) ou anilhas poluindo o cabo, exibindo apenas os componentes e os cabos conectados.
   * **Chassi Realista para Componentes Padrão:** Ilustrações vetoriais dedicadas para **Sensor Indutivo M12** (corpo roscado em inox e LED), **Borneira DIN TS-35** (parafusos de fenda metálicos e plaquetas `X1:n`) e **Conector DB9** (carcaça blindada D-Sub).

### 4.4. Cadastro de Novos Componentes com Upload de PNG e Mapeamento de Pinos (`Sidebar.tsx`)
* **Botão "+ Novo Componente":** Abre um modal para cadastrar conectores personalizados informando Nome, Part Number, Quantidade de Pinos (`1` a `24`), Estilo Base e Lado Inicial dos Fios.
* **Upload de Imagem Real (`PNG`, `JPG`, `SVG`, `WEBP`):** Converte a imagem para Base64 (`Data URL`) e armazena no catálogo persistido em `localStorage`.
* **Mapeador Interativo de Pinos na Imagem:**
  * Logo após selecionar a imagem no modal, é exibida uma área interativa onde o usuário **clica diretamente sobre cada pino na foto do conector** (`P1`, `P2`, `P3`, `P4`...).
  * Cada clique grava a coordenada percentual `(X%, Y%)` exata do pino na imagem e avança automaticamente para o próximo pino.
* **Renderização Direta na Imagem no Modo Cabo Real:**
  * No **Modo Cabo Real**, o componente exibe diretamente a imagem enviada (sem a tabela do modo esquema) e posiciona os terminais conectáveis (`<Handle>`) exatamente nos pontos clicados sobre a imagem.
  * Ao clicar em **"Girar"**, tanto a imagem quanto as coordenadas `(X%, Y%)` dos pinos giram juntas em incrementos de 90° (`rotatePinCoordinate`), mantendo os fios conectados nos pontos exatos da peça rotacionada.

### 4.5. Módulo de Lista de Materiais — BOM (`BomPanel.tsx`)
* Painel flutuante retrátil no canto inferior direito que varre `nodes` e `edges` da store do Zustand em tempo real:
  * **Tabela de Componentes:** Agrupa e soma automaticamente as quantidades pelo `data.partNumber`.
  * **Tabela de Cabos Industriais:** Agrupa e totaliza os trechos de cabo por bitola (`data.awg`) e cor (`data.colorHex`).

### 4.6. Exportação de Instrução de Montagem (`ExportButton.tsx`)
* O botão **"Exportar Instrução de Montagem (Cabo Real)"** garante que a visualização esteja no modo realista, captura exclusivamente a área do diagrama (`.react-flow__viewport`) via `html-to-image` (`toPng`) com fundo branco forçado (`#ffffff`) e alta densidade de pixels (`pixelRatio: 2.5`), baixando automaticamente o arquivo PNG pronto para impressão ou documentação técnica.

---

## 5. Como Executar o Projeto

```bash
cd /mnt/c/Users/Pichau/wire-diagram-editor
npm install
npm run dev
```

Para gerar o bundle de produção validado pelo TypeScript:

```bash
npm run build
```
