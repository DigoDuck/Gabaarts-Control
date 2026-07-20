import { apiFetch } from "@/lib/api"

export type Product = {
  id: number
  name: string
  category: keyof typeof CATEGORY_LABELS
  is_active: boolean
  is_combo: boolean
  target_margin_pct: string
  cogs: { material: string; labor: string; packaging: string; total: string }
  suggested_price: string
}

export const CATEGORY_LABELS = {
  gifts: "Presentes",
  stationery: "Papelaria",
  memories: "Memórias",
  school: "Escolar",
  other: "Outros",
} as const

export const listProducts = () => apiFetch<Product[]>("/api/products/")
