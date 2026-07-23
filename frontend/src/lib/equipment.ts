import { apiFetch } from "@/lib/api"

// category e maintenance_status são TEXTO LIVRE no model (CharField blank=True),
// NÃO enum — não há choices para listar (backend models.py, Equipment). Por isso
// o form usa input de texto, não select. maintenance_status default = "Em dia".
export type EquipmentPayload = {
  name: string
  category: string
  purchase_date: string | null // "AAAA-MM-DD"
  value: string | null // valor pago (R$), decimal-como-string; nullable no model
  useful_life_months: number | null
  maintenance_status: string
}

export type Equipment = EquipmentPayload & { id: number }

export const listEquipment = () => apiFetch<Equipment[]>("/api/equipment/")

export const getEquipment = (id: number) =>
  apiFetch<Equipment>(`/api/equipment/${id}/`)

export const createEquipment = (payload: EquipmentPayload) =>
  apiFetch<Equipment>("/api/equipment/", {
    method: "POST",
    body: JSON.stringify(payload),
  })

export const updateEquipment = (id: number, payload: EquipmentPayload) =>
  apiFetch<Equipment>(`/api/equipment/${id}/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
