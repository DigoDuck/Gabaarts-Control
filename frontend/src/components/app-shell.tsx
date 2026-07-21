import {
  Calculator,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  ShoppingCart,
  Store,
  Sun,
  Users,
  Wrench,
} from "lucide-react"
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom"

import { Flame } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { useTheme } from "@/store/theme"

// produtos existe na 2b; o resto entra na 2c
export const NAV = [
  { to: "/products", label: "Produtos", icon: Package },
  { to: "/sales", label: "Vendas", icon: ShoppingCart },
  { to: "/channels", label: "Canais", icon: Store },
  { to: "/makers", label: "Artesãs", icon: Users },
  { to: "/equipment", label: "Equipamentos", icon: Wrench },
  { to: "/pricing", label: "Simulador", icon: Calculator },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
]

function Sidebar() {
  return (
    // abaixo de md a sidebar vira uma tira de ícones: sem drawer, sem JS
    <aside className="flex w-16 shrink-0 flex-col border-r border-border bg-surface md:w-60">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Flame className="size-6 shrink-0" gradient />
        <span className="hidden font-display text-base tracking-tight md:inline">
          GabaArts
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-surface-2 font-medium text-accent-ink"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-text",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("size-4 shrink-0", isActive && "text-accent-ink")} />
                <span className="hidden md:inline">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function Header() {
  const { pathname } = useLocation()
  const { theme, toggle } = useTheme()
  const logout = useAuth((s) => s.logout)
  const title = NAV.find((item) => item.to === pathname)?.label ?? ""

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-8">
      <h1 className="font-display text-lg tracking-tight">{title}</h1>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair">
          <LogOut />
        </Button>
      </div>
    </header>
  )
}

export function AppShell() {
  const token = useAuth((s) => s.token)
  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
