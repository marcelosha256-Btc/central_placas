import { redirect } from 'next/navigation';

export default function DespesasRedirect() {
  redirect('/financeiro/contas-pagar');
}
