import { apiFetch } from "@/lib/api"

/** Artesã: quem produz. hourly_rate é decimal-como-string (R$/hora, "25.00"). */
export type Maker = { id: number; name: string; hourly_rate: string }

export const listMakers = () => apiFetch<Maker[]>("/api/makers/")

/** Campos de escrita da artesã: exatamente o que a API aceita no POST/PUT. */
export type MakerPayload = {
  name: string
  // custo por hora (R$/hora), decimal-como-string, ex "25.00"
  hourly_rate: string
}

export const getMaker = (id: number) => apiFetch<Maker>(`/api/makers/${id}/`)

export const createMaker = (payload: MakerPayload) =>
  apiFetch<Maker>("/api/makers/", {
    method: "POST",
    body: JSON.stringify(payload),
  })

export const updateMaker = (id: number, payload: MakerPayload) =>
  apiFetch<Maker>(`/api/makers/${id}/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
