import { apiFetch } from "@/lib/api"

export const CATEGORY_LABELS = {
  gifts: "Presentes",
  stationery: "Papelaria",
  memories: "Memórias",
  school: "Escolar",
  other: "Outros",
} as const

export type Category = keyof typeof CATEGORY_LABELS

export type ComboItem = {
  id?: number
  component: number
  component_name?: string
  qty: number
}

export type CostPreview = {
  cogs: { material: string; labor: string; packaging: string; total: string }
  suggested_price: string
}

/** Campos de escrita: exatamente o que a API aceita no POST/PATCH. */
export type ProductPayload = {
  name: string
  category: Category
  is_active: boolean
  is_combo: boolean
  material_cost: string
  packaging_cost: string
  waste_pct: string
  production_time_min: number
  batch_size: number
  maker: number | null
  target_margin_pct: string
  base_price: string | null
  combo_items: ComboItem[]
}

export type Product = ProductPayload & { id: number } & CostPreview

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
)

export const listProducts = () => apiFetch<Product[]>("/api/products/")

export const getProduct = (id: number) => apiFetch<Product>(`/api/products/${id}/`)

export const createProduct = (payload: ProductPayload) =>
  apiFetch<Product>("/api/products/", {
    method: "POST",
    body: JSON.stringify(payload),
  })

export const updateProduct = (id: number, payload: ProductPayload) =>
  apiFetch<Product>(`/api/products/${id}/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })

/** COGS e preço sugerido do rascunho, calculados pelo backend (fórmula tem um dono só). */
export const previewProduct = (payload: Partial<ProductPayload>) =>
  apiFetch<CostPreview>("/api/products/preview/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
