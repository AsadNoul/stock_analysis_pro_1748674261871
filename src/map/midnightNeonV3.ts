// Mapbox GL style — Midnight Neon V3 (docs/ARCHITECTURE.md §5).
// Single source of truth lives in /shared so the server can serve/validate the
// same style JSON if it ever needs to (e.g. static style hosting).
import style from '../../shared/mapStyle.midnightNeonV3.json';

export const midnightNeonV3 = style as any;
export default midnightNeonV3;
