/**
 * Chama reduzida da marca. Dois modos:
 * - default: contorno monocromático (`currentColor`), pra decoração discreta
 *   (login, empty state), onde o traço fino é o certo.
 * - gradient: chama preenchida com o gradiente oficial (topo laranja → base ciano,
 *   como a logo). É o símbolo da marca em tamanho de ícone: sidebar e favicon
 *   (ver public/favicon.svg). A logo completa (chama + lettering) só no login.
 */

const FLAME_D =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"

type FlameProps = {
  className?: string
  gradient?: boolean
}

export function Flame({ className, gradient = false }: FlameProps) {
  if (gradient) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <defs>
          <linearGradient
            id="brand-flame"
            x1="12"
            y1="2.5"
            x2="12"
            y2="21.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="var(--brand-orange)" />
            <stop offset="0.3" stopColor="var(--brand-pink)" />
            <stop offset="0.6" stopColor="var(--brand-violet)" />
            <stop offset="0.8" stopColor="var(--brand-blue)" />
            <stop offset="1" stopColor="var(--brand-cyan)" />
          </linearGradient>
        </defs>
        <path d={FLAME_D} fill="url(#brand-flame)" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d={FLAME_D}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
