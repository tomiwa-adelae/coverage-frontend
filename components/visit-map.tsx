"use client"

import { useEffect, useRef } from "react"
import type { Map as LeafletMap, LayerGroup } from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Prospect } from "@/lib/types"

type Pin = Pick<Prospect, "id" | "name" | "company" | "latitude" | "longitude">

// Lagos, for when nobody has been pinned yet.
const FALLBACK: [number, number] = [6.5244, 3.3792]

/**
 * OpenStreetMap with a dot per pinned prospect. Leaflet touches `window`, so it's
 * loaded on the client only.
 */
export function VisitMap({
  pins,
  selected,
  onPick,
}: {
  pins: Pin[]
  selected: string[]
  onPick: (id: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const layer = useRef<LayerGroup | null>(null)
  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  })

  useEffect(() => {
    let cancelled = false
    import("leaflet").then((L) => {
      if (cancelled || !box.current || map.current) return
      map.current = L.map(box.current, { zoomControl: true }).setView(
        FALLBACK,
        11
      )
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current)
      layer.current = L.layerGroup().addTo(map.current)
      draw(L)
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
    // Created once; pins are redrawn by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw(L: typeof import("leaflet")) {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const css = getComputedStyle(document.documentElement)
    const primary = css.getPropertyValue("--primary").trim() || "#30444f"
    const brand = css.getPropertyValue("--brand").trim() || "#fcb813"
    const points: [number, number][] = []
    for (const p of pins) {
      if (p.latitude === null || p.longitude === null) continue
      const on = selected.includes(p.id)
      points.push([p.latitude, p.longitude])
      L.circleMarker([p.latitude, p.longitude], {
        radius: on ? 10 : 7,
        color: "#ffffff",
        weight: 2,
        fillColor: on ? brand : primary,
        fillOpacity: 1,
      })
        .bindTooltip(p.company ? `${p.name} · ${p.company}` : p.name)
        .on("click", () => pick.current(p.id))
        .addTo(g)
    }
    if (points.length === 1) m.setView(points[0], 15)
    else if (points.length > 1)
      m.fitBounds(points, { padding: [30, 30], maxZoom: 15 })
  }

  useEffect(() => {
    if (!map.current) return
    import("leaflet").then(draw)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, selected])

  return (
    <div
      ref={box}
      className="h-72 w-full overflow-hidden rounded-xl border sm:h-96 [&_.leaflet-control-attribution]:text-[10px]"
      role="region"
      aria-label="Map of pinned prospects"
    />
  )
}
