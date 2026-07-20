import { useAuth } from "@/store/auth"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
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
  if (!res.ok) throw new ApiError(res.status, `Erro ${res.status} na API.`)

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
