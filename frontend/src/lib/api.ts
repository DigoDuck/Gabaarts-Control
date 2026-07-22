import { useAuth } from "@/store/auth"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

/** Corpo de erro do DRF: {campo: ["mensagem"]}, com listas aninhadas em campo nested. */
export type FieldErrors = Record<string, unknown>

export class ApiError extends Error {
  status: number
  fields: FieldErrors

  constructor(status: number, message: string, fields: FieldErrors = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

/** Primeira mensagem de um campo: o DRF manda lista, mas às vezes string. */
export function fieldError(fields: FieldErrors, name: string): string | undefined {
  const value = fields[name]
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined
  return typeof value === "string" ? value : undefined
}

/**
 * Único caminho até a API autenticada: injeta o token e trata 401.
 * Dinheiro chega como string ("15.16") e continua string até a formatação.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token, logout } = useAuth.getState()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...init.headers,
    },
  })

  // token revogado ou expirado: desloga e a rota protegida manda para o login
  if (res.status === 401) {
    logout()
    throw new ApiError(401, "Sessão expirada.")
  }
  if (!res.ok) {
    // o corpo do 400 é o que o formulário mostra campo a campo; resposta sem
    // JSON (502 do proxy, HTML de erro) não pode derrubar o parse
    const fields = await res.json().catch(() => ({}))
    throw new ApiError(res.status, `Erro ${res.status} na API.`, fields)
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
