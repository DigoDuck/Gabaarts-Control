import { useState } from "react"
import { Navigate } from "react-router-dom"

import { Flame, Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/store/auth"

export function Login() {
  const { token, login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (token) return <Navigate to="/products" replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await login(username, password)
    } catch {
      setError("Usuário ou senha inválidos.")
      setPending(false)
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      {/* única superfície com o padrão de chamas (DESIGN.md, regra dura 6) */}
      <Flame
        className="pointer-events-none absolute -right-16 -bottom-24 size-128 text-brand-violet opacity-4" />

      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="brand-gradient h-1" />
          <div className="space-y-6 p-8">
            <div className="space-y-1">
              <Logo />
              <p className="text-sm text-muted-foreground">Gestão comercial da Gabaarts</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-danger-ink">
                  {error}
                </p>
              )}

              {/* ação primária: área de toque ≥ 44px (princípio 6) */}
              <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
                {pending ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
