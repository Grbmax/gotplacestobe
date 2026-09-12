"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { CAMPUS_BOUNDS, CAMPUS_CENTER, ZONES, zoneById } from "@/lib/data";
import type { LatLng, ScoredQuest, ZoneId } from "@/lib/types";

type Props = {
  you: ZoneId;
  youPos: LatLng;
  quests: ScoredQuest[];
  activeId?: string;
  onSelect: (id: string) => void;
};

export function CampusMap({ you, youPos, quests, activeId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const youMarkerRef = useRef<Marker | null>(null);
  const questLayerRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !el || mapRef.current) return;

      const bounds = L.latLngBounds(
        [CAMPUS_BOUNDS.southWest.lat, CAMPUS_BOUNDS.southWest.lng],
        [CAMPUS_BOUNDS.northEast.lat, CAMPUS_BOUNDS.northEast.lng],
      );

      const map = L.map(el, {
        zoomControl: false,
        attributionControl: false,
        minZoom: 16,
        maxZoom: 19,
        maxBounds: bounds,
        maxBoundsViscosity: 1,
        bounceAtZoomLimits: true,
        worldCopyJump: false,
        inertia: false,
        zoomSnap: 0.25,
        wheelPxPerZoomLevel: 120,
      }).setView([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], 16.6);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
        minZoom: 16,
        bounds,
        noWrap: true,
        keepBuffer: 4,
        className: "osm-base",
      }).addTo(map);

      map.on("drag", () => {
        map.panInsideBounds(bounds, { animate: false });
      });
      map.on("zoomend", () => {
        map.panInsideBounds(bounds, { animate: false });
      });

      for (const z of ZONES) {
        const mine = z.id === you;
        L.circle([z.lat, z.lng], {
          radius: mine ? 90 : 70,
          color: mine ? "#d6ff4a" : "#7dffc3",
          weight: mine ? 1.4 : 0.8,
          opacity: mine ? 0.7 : 0.28,
          fillColor: mine ? "#d6ff4a" : "#7dffc3",
          fillOpacity: mine ? 0.12 : 0.06,
          interactive: false,
        }).addTo(map);

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

      const start = ZONES.find((z) => z.id === you) ?? ZONES[0];
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
      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      youMarkerRef.current = null;
      questLayerRef.current = null;
      setReady(false);
    };
  }, [you]);

  useEffect(() => {
    const map = mapRef.current;
    const el = wrapRef.current;
    if (!ready || !map || !el) return;
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);
    map.invalidateSize({ animate: false });
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!youPos) return;
    youMarkerRef.current?.setLatLng([youPos.lat, youPos.lng]);
  }, [youPos]);

  useEffect(() => {
    const layer = questLayerRef.current;
    if (!ready || !layer) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !questLayerRef.current) return;
      questLayerRef.current.clearLayers();

      for (const q of quests) {
        const z = zoneById(q.zone);
        const active = q.id === activeId;
        L.marker([z.lat, z.lng], {
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
    const z = zoneById(quest.zone);
    const target = map.getZoom() < 17 ? 17.2 : map.getZoom();
    map.flyTo([z.lat, z.lng], target, { duration: 0.4, easeLinearity: 0.25 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pan only when the active ping changes
  }, [ready, activeId]);

  return <div ref={wrapRef} className="campus-map h-full w-full" aria-label="Live campus map" />;
}
