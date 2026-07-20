import { create } from "zustand"
import { persist } from "zustand/middleware"

type Theme = "dark" | "light"

type ThemeState = {
  theme: Theme
  toggle: () => void
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      toggle: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    }),
    { name: "gabaarts-theme" },
  ),
)

// a classe vive no <html>; sem provider, o store é a única fonte
function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

apply(useTheme.getState().theme)
useTheme.subscribe((state) => apply(state.theme))
