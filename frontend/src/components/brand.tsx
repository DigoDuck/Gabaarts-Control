/**
 * Marca. Placeholder até o SVG oficial ser exportado do vetor (plano 2b, passo humano 5).
 * Ícone reduzido: sidebar e favicon. Lockup completo: só a tela de login (DESIGN.md).
 */

type FlameProps = {
  className?: string
  /** gradiente oficial só no lockup; a sidebar usa a chama monocromática */
  gradient?: boolean
}

export function Flame({ className, gradient = false }: FlameProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {gradient && (
        <defs>
          <linearGradient id="flame-gradient" x1="4" y1="22" x2="20" y2="2">
            <stop offset="0%" stopColor="var(--brand-orange)" />
            <stop offset="35%" stopColor="var(--brand-pink)" />
            <stop offset="65%" stopColor="var(--brand-violet)" />
            <stop offset="100%" stopColor="var(--brand-cyan)" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"
        stroke={gradient ? "url(#flame-gradient)" : "currentColor"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <Flame className="size-10" gradient />
      <span className="font-display text-2xl tracking-tight text-text">GabaArts</span>
    </div>
  )
}
