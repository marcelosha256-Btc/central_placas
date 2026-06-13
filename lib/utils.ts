import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normaliza texto livre para MAIÚSCULAS ao gravar (o CSS só mostra; o dado real
// precisa ser transformado aqui). Preserva null/undefined para não atropelar
// updates parciais. NÃO usar em email/senha/documento.
export function upper<T>(v: T): T {
  return (typeof v === 'string' ? v.toUpperCase() : v) as T;
}

export function formatCurrency(value: number | null | undefined): string {
  const v = value ?? 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function maskCPF(v: string): string {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
  if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
}

export function maskCNPJ(v: string): string {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
  if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
  if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
}

export function maskPhone(v: string): string {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return '(' + d;
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
}

export function maskCpf(v: string): string {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
  if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
}

export function isValidCpf(v: string): boolean {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]);
}

export function maskCEP(v: string): string {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return d.slice(0, 5) + '-' + d.slice(5);
}

export function maskPlate(v: string): string {
  const raw = (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Formato Mercosul: ABC1D23 (L=letra, N=número)
  // Posição: 0=L 1=L 2=L 3=N 4=L 5=N 6=N
  const pattern = ['L','L','L','N','L','N','N'];
  let result = '';
  for (let i = 0; i < raw.length && result.length < 7; i++) {
    const ch = raw[i];
    const pos = result.length;
    const expected = pattern[pos];
    if (expected === 'L' && /[A-Z]/.test(ch)) {
      result += ch;
    } else if (expected === 'N' && /[0-9]/.test(ch)) {
      result += ch;
    }
    // caractere inválido para a posição é ignorado
  }
  return result;
}

export function validateCPF(cpf: string): boolean {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10]);
}

export function validateCNPJ(cnpj: string): boolean {
  const d = (cnpj ?? '').replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i]) * weights1[i];
  let rest = sum % 11;
  if (rest < 2 ? 0 !== parseInt(d[12]) : 11 - rest !== parseInt(d[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(d[i]) * weights2[i];
  rest = sum % 11;
  return rest < 2 ? 0 === parseInt(d[13]) : 11 - rest === parseInt(d[13]);
}

export function validatePlate(plate: string): boolean {
  const p = (plate ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  // Mercosul: ABC1D23 (3 letras, 1 número, 1 letra, 2 números)
  return /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(p);
}

export function onlyDigits(v: string): string {
  return (v ?? '').replace(/\D/g, '');
}

export const STATUS_LABELS: Record<string, string> = {
  ABERTO: 'Aberto',
  PAGO: 'Pago',
};

export const STATUS_COLORS: Record<string, string> = {
  ABERTO: 'bg-yellow-100 text-yellow-800',
  PAGO: 'bg-green-100 text-green-800',
};

export const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'Pix',
  DINHEIRO: 'Dinheiro',
  CARTAO_DEBITO: 'Cartão Débito',
  CARTAO_CREDITO: 'Cartão Crédito',
  A_PRAZO: 'A Prazo',
};
