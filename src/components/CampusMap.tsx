"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Marker, Polyline } from "leaflet";
import { ZONES, questPin, zoneById } from "@/lib/data";
import { addBaseTiles } from "@/lib/tiles";
import type { CampusRoute, LatLng, ScoredQuest, ZoneId } from "@/lib/types";

type Props = {
  you: ZoneId;
  youPos: LatLng;
  live?: boolean;
  worldKey?: number;
  quests: ScoredQuest[];
  activeId?: string;
  route?: CampusRoute | null;
  onSelect: (id: string) => void;
};

export function CampusMap({ you, youPos, live = false, worldKey = 0, quests, activeId, route, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const youMarkerRef = useRef<Marker | null>(null);
  const questLayerRef = useRef<LayerGroup | null>(null);
  const routeLayerRef = useRef<LayerGroup | null>(null);
  const routeLineRef = useRef<Polyline | null>(null);
  const onSelectRef = useRef(onSelect);
  const didCenterOnYou = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let cancelled = false;
    didCenterOnYou.current = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !el || mapRef.current) return;

      const start = youPos;
      const map = L.map(el, {
        zoomControl: false,
        minZoom: 3,
        maxZoom: 16,
      }).setView([start.lat, start.lng], 14);

      await addBaseTiles(map);

      for (const z of ZONES) {
        const mine = z.id === you;
        L.marker([z.lat, z.lng], {
          interactive: false,
          icon: L.divIcon({
            className: "zone-label",
            html: `<span class="${mine ? "is-you" : ""}">${z.short}</span>`,
            iconSize: [72, 24],
            iconAnchor: [36, 28],
          }),
        }).addTo(map);
      }

      youMarkerRef.current = L.marker([start.lat, start.lng], {
        zIndexOffset: 800,
        icon: L.divIcon({
          className: "you-marker",
          html: `<span class="you-pulse"></span><span class="you-dot"></span><em>you</em>`,
          iconSize: [28, 40],
          iconAnchor: [14, 20],
        }),
      }).addTo(map);

      questLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      youMarkerRef.current = null;
      questLayerRef.current = null;
      routeLayerRef.current = null;
      routeLineRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [you, worldKey]);

  useEffect(() => {
    if (!youPos) return;
    youMarkerRef.current?.setLatLng([youPos.lat, youPos.lng]);
    const map = mapRef.current;
    if (ready && map && live && !didCenterOnYou.current) {
      didCenterOnYou.current = true;
      map.flyTo([youPos.lat, youPos.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
  }, [youPos, ready, live]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!ready || !map || !layer) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !routeLayerRef.current) return;
      routeLayerRef.current.clearLayers();
      routeLineRef.current = null;

      if (!route || route.path.length < 2) return;

      routeLineRef.current = L.polyline(
        route.path.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: "#d6ff4a",
          weight: 4,
          opacity: 0.85,
          dashArray: "8 10",
          lineCap: "round",
          className: "route-line",
        },
      ).addTo(routeLayerRef.current);

      for (const id of route.zones ?? []) {
        const z = zoneById(id);
        L.circleMarker([z.lat, z.lng], {
          radius: 6,
          color: "#12160f",
          weight: 2,
          fillColor: "#d6ff4a",
          fillOpacity: 1,
          interactive: false,
        }).addTo(routeLayerRef.current!);
      }

      if (route.destination) {
        L.circleMarker([route.destination.lat, route.destination.lng], {
          radius: 8,
          color: "#12160f",
          weight: 2,
          fillColor: "#ffb020",
          fillOpacity: 1,
          interactive: false,
        }).addTo(routeLayerRef.current!);
      }

      map.fitBounds(routeLineRef.current.getBounds().pad(0.35), { animate: true, maxZoom: 15 });
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, route]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = questLayerRef.current;
    if (!ready || !map || !layer) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !questLayerRef.current) return;
      questLayerRef.current.clearLayers();

      for (const q of quests) {
        const p = questPin(q);
        const active = q.id === activeId;
        L.marker([p.lat, p.lng], {
          zIndexOffset: active ? 700 : 400,
          icon: L.divIcon({
            className: `quest-marker ${q.urgency} ${active ? "is-active" : ""}`,
            html: `<span class="ping"></span><span class="dot"></span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        })
          .on("click", () => onSelectRef.current(q.id))
          .addTo(questLayerRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, quests, activeId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !activeId) return;
    const quest = quests.find((q) => q.id === activeId);
    if (!quest) return;
    const p = questPin(quest);
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: 0.45 });
  }, [ready, activeId, quests]);

  return <div ref={wrapRef} className="campus-map h-full w-full" aria-label="Live map" />;
}
