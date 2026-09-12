import type { Map as LeafletMap } from "leaflet";

/** Free raster tiles — no API key (CARTO dark_all now watermarks “API key required”). */
export const BASE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

export const BASE_TILE_ATTR = "Tiles &copy; Esri";

export async function addBaseTiles(map: LeafletMap) {
  const L = (await import("leaflet")).default;
  return L.tileLayer(BASE_TILE_URL, {
    attribution: BASE_TILE_ATTR,
    maxZoom: 16,
  }).addTo(map);
}
