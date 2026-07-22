import { apiFetch } from "@/lib/api"

// entidades que só alimentam select nesta fatia; a tela de cada uma chega na 2c-2
export type Maker = { id: number; name: string; hourly_rate: string }
export type Channel = {
  id: number
  name: string
  slug: string
  default_freight: string | null
}

export const listMakers = () => apiFetch<Maker[]>("/api/makers/")
export const listChannels = () => apiFetch<Channel[]>("/api/channels/")
