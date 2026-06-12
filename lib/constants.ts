// ============================================
// CONSTANTES CENTRALIZADAS — CENTRAL.PLACAS
// ============================================

/** Opções de pagamento padrão (todas as formas) */
export const PAYMENT_OPTIONS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_DEBITO', label: 'Cartão Débito' },
  { value: 'CARTAO_CREDITO', label: 'Cartão Crédito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'A_PRAZO', label: 'A Prazo' },
] as const;

/** Opções de pagamento para recebimento (exclui A Prazo) */
export const PAYMENT_OPTIONS_RECEBIMENTO = PAYMENT_OPTIONS.filter(o => o.value !== 'A_PRAZO');

/** Interface de formulário de pagamento */
export interface PayForm {
  method: string;
  value: string;
}

/** Labels de status do caixa */
export const CASH_STATUS_LABELS: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_CONFERENCIA: 'Em Conferência',
  FECHADO: 'Fechado',
};

/** Labels de tipos de movimentação do caixa */
export const MOVE_TYPE_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  SANGRIA: 'Sangria',
  SUPRIMENTO: 'Suprimento',
  ESTORNO: 'Estorno',
};
