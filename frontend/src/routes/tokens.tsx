/**
 * Amostra dos tokens (aceite B2). Fora da navegação: é ferramenta de conferência
 * visual dos dois temas, não tela de produto. Os valores vêm do CSS computado,
 * então esta página não consegue mentir sobre a paleta real.
 */
import { useTheme } from "@/store/theme"
import { Button } from "@/components/ui/button"

const GROUPS = [
  { title: "Superfícies", vars: ["--bg", "--surface", "--surface-2", "--border"] },
  { title: "Texto", vars: ["--text", "--muted"] },
  { title: "Estados (preenchimento)", vars: ["--success", "--danger", "--warning", "--info"] },
  { title: "Texto colorido (AA)", vars: ["--danger-ink", "--accent-ink"] },
  {
    title: "Marca (só chrome)",
    vars: [
      "--brand-orange",
      "--brand-pink",
      "--brand-violet",
      "--brand-blue",
      "--brand-cyan",
    ],
  },
]

function Swatch({ name }: { name: string }) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return (
    <div className="flex items-center gap-3">
      <span
        className="size-10 shrink-0 rounded-md border border-border"
        style={{ background: value }}
      />
      <div className="min-w-0 text-sm">
        <p className="truncate">{name}</p>
        <p className="tabular-nums text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}

export function Tokens() {
  const { theme, toggle } = useTheme()

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-8 py-10">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight">Tokens</h1>
        <Button variant="outline" onClick={toggle}>
          Tema: {theme === "dark" ? "escuro" : "claro"}
        </Button>
      </header>

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {group.vars.map((name) => (
              <Swatch key={name} name={name} />
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Gradiente (só moldura)
        </h2>
        <div className="brand-gradient h-2 rounded-full" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Tipografia
        </h2>
        <p className="font-display text-3xl tracking-tight">Montserrat Bold · título</p>
        <p className="text-base">Inter · texto de interface</p>
        <p className="tabular-nums">Inter tabular-nums · R$ 1.234,56 · R$ 89,10</p>
      </section>
    </main>
  )
}
