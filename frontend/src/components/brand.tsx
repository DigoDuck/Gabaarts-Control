/**
 * Chama reduzida da marca, monocromática (herda `currentColor`).
 * Sidebar, favicon (ver public/favicon.svg) e decoração discreta no login e no
 * empty state. A logo completa (chama + lettering) é a imagem em
 * assets/logo-full.png, usada só na tela de login (DESIGN.md).
 */

type FlameProps = {
  className?: string
}

export function Flame({ className }: FlameProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
