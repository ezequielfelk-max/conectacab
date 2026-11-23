// Verifica se um ponto de tela (clientX, clientY) está dentro da caixa visual de algum componente conector
export const isClientPointInsideAnyConnector = (
  clientX: number,
  clientY: number
): boolean => {
  const connectorNodes = document.querySelectorAll<HTMLElement>(
    '.react-flow__node-connector'
  );

  for (const nodeEl of connectorNodes) {
    const visualEl =
      (nodeEl.firstElementChild as HTMLElement | null) ?? nodeEl;
    const rect = visualEl.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return true;
    }
  }

  return false;
};
