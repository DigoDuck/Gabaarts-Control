import { apiFetch } from "@/lib/api"

// commission_pct é fração de 4 casas (0.1200 = 12%); a conversão para/de
// percentual mora no formulário (channel-form.tsx), como em product-form.
export type ChannelFeeTier = {
  id?: number
  min_price: string
  commission_pct: string
  fixed_fee: string
}

/** Campos de escrita: exatamente o que a API aceita no POST/PUT. */
export type ChannelPayload = {
  name: string
  slug: string
  default_freight: string | null
  // escrita por substituição: o PUT manda a lista final completa
  fee_tiers: ChannelFeeTier[]
}

export type Channel = ChannelPayload & { id: number }

export const listChannels = () => apiFetch<Channel[]>("/api/channels/")

export const getChannel = (id: number) => apiFetch<Channel>(`/api/channels/${id}/`)

export const createChannel = (payload: ChannelPayload) =>
  apiFetch<Channel>("/api/channels/", {
    method: "POST",
    body: JSON.stringify(payload),
  })

export const updateChannel = (id: number, payload: ChannelPayload) =>
  apiFetch<Channel>(`/api/channels/${id}/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
