import { apiFetch } from "@/lib/api"

export const STATUS_LABELS = {
  pending: "Pendente",
  completed: "Concluída",
  canceled: "Cancelada",
} as const

export type SaleStatus = keyof typeof STATUS_LABELS

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export type SaleItem = {
  id?: number
  product: number
  product_name?: string
  qty: number
  // congelado pelo backend na criação; nunca enviado no payload
  unit_cogs?: string
}

export type SaleFinancialDraft = {
  channel: number
  products_total: string
  shipping_amount: string
  fee_override?: string | null
  items: SaleItem[]
}

export type SalePayload = SaleFinancialDraft & {
  date: string
  customer_name: string
  status: SaleStatus
}

export type FeeSource = "suggested" | "manual"

export type SaleResult = {
  total_cogs: string
  applied_channel_fee: string
  fee_source: FeeSource
  profit: string
  margin_pct: string
  amount_paid: string
  warnings: string[]
  // só o preview conhece a sugestão e a meta: a venda salva guarda o valor
  // aplicado, não o que teria sido sugerido na época
  suggested_channel_fee?: string
  target_margin_pct?: string
}

export type Sale = Omit<SalePayload, "fee_override"> & {
  id: number
  channel_name: string
  channel_fee: string
  fee_source: FeeSource
  total_cogs: string
  profit: string
  margin_pct: string
  amount_paid: string
}

export function listSales(params: { from?: string; to?: string } = {}) {
  const query = new URLSearchParams()
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)
  const suffix = query.toString() ? `?${query}` : ""
  return apiFetch<Sale[]>(`/api/sales/${suffix}`)
}

export const getSale = (id: number) => apiFetch<Sale>(`/api/sales/${id}/`)

export const createSale = (payload: SalePayload) =>
  apiFetch<Sale>("/api/sales/", { method: "POST", body: JSON.stringify(payload) })

export const previewSale = (payload: SaleFinancialDraft) =>
  apiFetch<SaleResult>("/api/sales/preview/", {
    method: "POST",
    body: JSON.stringify(payload),
  })

/**
 * PATCH com apenas os campos alterados, nunca PUT com o payload inteiro.
 * Mandar `items` faz o backend apagar e recriar as linhas, e linha nova
 * precisa de snapshot novo — ou seja, reenviar item intocado re-precifica
 * uma venda antiga com os parâmetros de hoje. Quem monta o diff é o
 * formulário (Task 8).
 */
export const updateSale = (id: number, patch: Partial<SalePayload>) =>
  apiFetch<Sale>(`/api/sales/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
