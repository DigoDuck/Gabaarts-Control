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
  unit_price: string
  unit_freight: string | null
  // congelados pelo backend na criação; nunca enviados no payload
  unit_cogs?: string
  unit_fee?: string
  unit_profit?: string
}

export type SalePayload = {
  date: string
  channel: number
  customer_name: string
  status: SaleStatus
  items: SaleItem[]
}

export type Sale = SalePayload & {
  id: number
  channel_name: string
  total: string
  profit: string
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
