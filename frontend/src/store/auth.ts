import { create } from "zustand"
import { persist } from "zustand/middleware"

// a API só é chamada sem token aqui; todo o resto passa por lib/api
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

type AuthState = {
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      login: async (username, password) => {
        const res = await fetch(`${API_URL}/api/auth/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        })
        if (!res.ok) throw new Error("Usuário ou senha inválidos.")
        const data: { token: string } = await res.json()
        set({ token: data.token })
      },
      logout: () => set({ token: null }),
    }),
    { name: "gabaarts-auth" },
  ),
)
