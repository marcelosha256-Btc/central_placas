// ============================================
// calcBalance — Função compartilhada
// Calcula saldo, entradas e saídas de um caixa
// ============================================

export function calcBalance(register: any) {
  let balance = register?.initialBalance ?? 0;
  let totalEntradas = 0;
  let totalSaidas = 0;
  for (const m of register?.movements ?? []) {
    if (m?.cancelled) continue;
    if (m?.type === 'ENTRADA' || m?.type === 'SUPRIMENTO') {
      balance += m?.amount ?? 0;
      totalEntradas += m?.amount ?? 0;
    } else if (m?.type === 'ESTORNO') {
      // Estorno pode ser entrada ou saída dependendo do sinal
      balance += m?.amount ?? 0;
      if ((m?.amount ?? 0) > 0) totalEntradas += m?.amount ?? 0;
      else totalSaidas += Math.abs(m?.amount ?? 0);
    } else {
      balance -= m?.amount ?? 0;
      totalSaidas += m?.amount ?? 0;
    }
  }
  return { balance, totalEntradas, totalSaidas };
}
