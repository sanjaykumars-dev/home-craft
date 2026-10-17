// Catalog of placeable items: palette entries, editable properties and 2D plan symbols.
import { wallLen, wallArc, uid } from './state.js';

// ---------------------------------------------------------------- icons
const ic = (body) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  select: ic('<path d="M13 8l22 13-10 2.5 6 11.5-4.5 2.2-6-11.6-7.5 7z" fill="currentColor" stroke="none"/>'),
  guide: ic('<path d="M4 34L44 14" stroke-dasharray="5 3.5" stroke="#0891b2" stroke-width="2.4"/><circle cx="14" cy="29" r="3.2" fill="#0891b2" stroke="none"/><circle cx="34" cy="19" r="3.2" fill="#0891b2" stroke="none"/>'),
  guideGrid: ic('<path d="M16 6v36M32 6v36M6 16h36M6 32h36" stroke-dasharray="4 3" stroke="#0891b2" stroke-width="2"/><circle cx="16" cy="6" r="3.4" fill="#fff" stroke="#0891b2" stroke-width="1.6"/><circle cx="32" cy="6" r="3.4" fill="#fff" stroke="#0891b2" stroke-width="1.6"/>'),
  measure: ic('<rect x="5" y="17" width="38" height="14" rx="2" transform="rotate(-30 24 24)"/><path d="M15 31.5l-2-3.4M20 28.6l-3-5.2M25 25.7l-2-3.4M30 22.8l-3-5.2M35 19.9l-2-3.4"/>'),
  wallExt: ic('<rect x="5" y="19" width="38" height="10" fill="currentColor" stroke="none"/><path d="M5 15v18M43 15v18" stroke-width="1.6"/>'),
  wallInt: ic('<rect x="5" y="22" width="38" height="4.5" fill="currentColor" stroke="none"/><path d="M5 17v14M43 17v14" stroke-width="1.6"/>'),
  room: ic('<rect x="7" y="7" width="34" height="34" stroke-width="5"/><path d="M14 34h8M34 14v8" stroke-width="1.6"/>'),
  floor: ic('<path d="M6 30l18-10 18 10-18 10z"/><path d="M15 25l18 10M24 20l9 5M15 35l9-5" stroke-width="1.4"/>'),
  roofGable: ic('<path d="M4 26L24 9l20 17"/><path d="M10 21v18h28V21"/><path d="M24 9v4" stroke-width="1.4"/>'),
  roofHip: ic('<path d="M4 30l10-14h20l10 14z"/><path d="M14 16l-4 14M34 16l4 14" stroke-width="1.4"/><path d="M8 30v9h32v-9"/>'),
  roofFlat: ic('<rect x="5" y="14" width="38" height="6" fill="currentColor" stroke="none"/><path d="M9 20v19h30V20"/>'),
  column: ic('<rect x="15" y="6" width="18" height="5" rx="1"/><rect x="15" y="37" width="18" height="5" rx="1"/><path d="M19 11v26M24 11v26M29 11v26"/>'),
  doorSingle: ic('<path d="M8 40h32"/><path d="M12 40V12"/><path d="M12 12A28 28 0 0 1 40 40" stroke-dasharray="3 3"/>'),
  doorDouble: ic('<path d="M4 40h40"/><path d="M8 40V24M40 40V24"/><path d="M8 24a16 16 0 0 1 16 16M40 24a16 16 0 0 0-16 16" stroke-dasharray="3 3"/>'),
  doorSliding: ic('<rect x="6" y="8" width="36" height="32" rx="1"/><path d="M24 8v32"/><path d="M14 24h6l-2-2m2 2l-2 2" stroke-width="1.6"/>'),
  doorGarage: ic('<path d="M4 18L24 7l20 11v23H4z"/><rect x="11" y="20" width="26" height="21"/><path d="M11 25h26M11 30h26M11 35h26" stroke-width="1.4"/>'),
  winCasement: ic('<rect x="8" y="8" width="32" height="32" rx="1"/><path d="M24 8v32M8 22h32"/>'),
  winSliding: ic('<rect x="6" y="12" width="36" height="24" rx="1"/><path d="M22 12v24M26 12v24"/>'),
  winPicture: ic('<rect x="5" y="10" width="38" height="28" rx="1"/><path d="M12 30l8-8 5 5 4-4 7 7" stroke-width="1.6"/>'),
  winVent: ic('<rect x="12" y="14" width="24" height="20" rx="1"/><path d="M15 20h18M15 25h18M15 30h18" stroke-width="1.5"/>'),
  stairs: ic('<path d="M6 42h9v-8h9v-8h9v-8h9V8"/>'),
  spiral: ic('<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="3"/><path d="M24 7v14M38.7 15.5L26.6 22.5M38.7 32.5L26.6 25.5M24 41V27" stroke-width="1.5"/>'),
  portico: ic('<path d="M5 17L24 8l19 9z"/><path d="M8 17h32v4H8z"/><path d="M12 21v16M20 21v16M28 21v16M36 21v16"/><path d="M6 37h36v4H6z"/>'),
  gazebo: ic('<path d="M6 20L24 6l18 14z"/><path d="M24 3v3"/><path d="M10 20v18M24 20v18M38 20v18"/><path d="M6 38h36" /><path d="M10 31h28" stroke-width="1.4"/>'),
  carport: ic('<path d="M4 12h40l-2 4H6z"/><path d="M8 16v24M40 16v24"/><path d="M13 34l2-6h18l2 6v5H13z"/><circle cx="17" cy="39" r="2"/><circle cx="31" cy="39" r="2"/>'),
  driveway: ic('<path d="M16 42L20 6h8l4 36z"/><path d="M24 10v4M24 19v5M24 29v5M24 38v3" stroke-width="1.6"/>'),
  path: ic('<rect x="16" y="5" width="9" height="7" rx="1.5"/><rect x="22" y="15" width="9" height="7" rx="1.5"/><rect x="15" y="25" width="9" height="7" rx="1.5"/><rect x="21" y="35" width="9" height="7" rx="1.5"/>'),
  car: ic('<path d="M5 30v-5l5-1 5-7h15l7 7 6 1v5z"/><circle cx="14" cy="31" r="4" fill="currentColor"/><circle cx="35" cy="31" r="4" fill="currentColor"/><path d="M17 18v6M25 17v7"/>'),
  fence: ic('<path d="M8 12l3-4 3 4v28H8zM21 12l3-4 3 4v28h-6zM34 12l3-4 3 4v28h-6z"/><path d="M4 20h40M4 32h40"/>'),
  pool: ic('<rect x="5" y="9" width="38" height="30" rx="6"/><path d="M11 24c3-3 6-3 9 0s6 3 9 0 6-3 9 0" stroke-width="1.6"/><path d="M11 31c3-3 6-3 9 0s6 3 9 0 6-3 9 0" stroke-width="1.6"/>'),
  tree: ic('<path d="M24 44V30"/><path d="M24 31c-9 0-14-5-14-11 0-5 4-9 8-9 1-4 4-6 6-6s5 2 6 6c4 0 8 4 8 9 0 6-5 11-14 11z"/>'),
  pine: ic('<path d="M24 44v-6"/><path d="M24 4l-11 15h6l-9 11h8L9 38h30l-9-8h8l-9-11h6z"/>'),
  shrub: ic('<path d="M7 36c-3-7 2-13 8-11 0-6 7-9 11-5 4-4 12-1 11 6 6 0 8 6 5 10z"/>'),
  lamp: ic('<path d="M24 44V16"/><path d="M17 44h14"/><path d="M16 10h16l-3 6H19z" fill="currentColor"/><path d="M12 22l-3 2M36 22l3 2M24 4V2" stroke-width="1.5"/>'),
  sofa: ic('<path d="M8 22v-5a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v5"/><path d="M5 24a3 3 0 0 1 6 0v4h26v-4a3 3 0 0 1 6 0v11H5z"/><path d="M9 35v4M39 35v4"/>'),
  bed: ic('<path d="M5 40V12M5 27h38v13"/><path d="M5 22h38v5"/><rect x="9" y="17" width="10" height="5" rx="2"/>'),
  table: ic('<rect x="12" y="14" width="24" height="20" rx="2"/><rect x="15" y="6" width="7" height="5" rx="1"/><rect x="26" y="6" width="7" height="5" rx="1"/><rect x="15" y="37" width="7" height="5" rx="1"/><rect x="26" y="37" width="7" height="5" rx="1"/>'),
  kitchen: ic('<rect x="4" y="18" width="40" height="22" rx="1"/><path d="M4 24h40"/><circle cx="31" cy="21" r="1.2" fill="currentColor"/><circle cx="37" cy="21" r="1.2" fill="currentColor"/><rect x="9" y="19.5" width="10" height="3" rx="1"/><path d="M24 24v16"/>'),
  porticoArch: ic('<path d="M5 10h38v6H5z"/><path d="M7 41V16h4v25M37 41V16h4v25M21 41V16h6v25"/><path d="M11 27a5 5 0 0 1 10 0M27 27a5 5 0 0 1 10 0"/>'),
  canopy: ic('<path d="M3 14h42v4H3z" fill="currentColor"/><path d="M10 18v23M38 18v23" stroke-width="1.6"/><rect x="18" y="23" width="12" height="18" rx="1"/>'),
  porchHip: ic('<path d="M4 20l8-9h24l8 9z"/><path d="M9 20v21M39 20v21"/><path d="M6 33h36" stroke-width="1.4"/><rect x="6" y="33" width="6" height="8" fill="currentColor" stroke="none"/><rect x="36" y="33" width="6" height="8" fill="currentColor" stroke="none"/>'),
  porticoBalcony: ic('<path d="M5 22h38v4H5z" fill="currentColor"/><path d="M7 22V12h34v10M13 22V12M19 22V12M25 22V12M31 22V12M37 22V12" stroke-width="1.4"/><path d="M10 26v15M38 26v15M24 26v15"/>'),
  porticoColonial: ic('<path d="M6 12L24 4l18 8z"/><path d="M6 12h36v3H6z"/><path d="M10 15v26M18 15v26M30 15v26M38 15v26"/><path d="M4 41h40" stroke-width="3"/>'),
  gateIron: ic('<rect x="3" y="12" width="6" height="30"/><rect x="39" y="12" width="6" height="30"/><path d="M9 40h30M9 18h30M14 18v22M19 18v22M24 18v22M29 18v22M34 18v22"/><path d="M14 18v-4M19 18v-4M24 18v-4M29 18v-4M34 18v-4" stroke-width="1.4"/>'),
  gateArch: ic('<rect x="3" y="16" width="6" height="26"/><rect x="39" y="16" width="6" height="26"/><path d="M9 40h30M9 22q15-14 30 0M14 18v22M19 15v25M24 14v26M29 15v25M34 18v22" stroke-width="1.8"/>'),
  gateSlide: ic('<rect x="3" y="12" width="5" height="30"/><path d="M8 16h34M8 22h34M8 28h34M8 34h34M8 40h34" stroke-width="1.8"/><path d="M28 7h14l-3-3m3 3l-3 3" stroke-width="1.6"/>'),
  gateWood: ic('<rect x="3" y="12" width="6" height="30"/><rect x="39" y="12" width="6" height="30"/><path d="M10 16h28v25H10z"/><path d="M15 16v25M20 16v25M24 16v25M28 16v25M33 16v25" stroke-width="1.3"/>'),
  gateModern: ic('<rect x="3" y="10" width="6" height="32"/><rect x="39" y="10" width="6" height="32"/><path d="M10 15h28M10 20h28M10 25h28M10 30h28M10 35h28M10 40h28" stroke-width="2.4"/>'),
  boundary: ic('<rect x="4" y="22" width="40" height="18"/><path d="M4 28h40M14 22v6M24 28v6M34 22v6M4 34h40M19 34v6M29 34v6" stroke-width="1.2"/><rect x="2" y="18" width="44" height="4" fill="currentColor" stroke="none"/>'),
  railWall: ic('<rect x="4" y="32" width="40" height="9"/><path d="M4 12h40M8 12v20M14 12v20M20 12v20M26 12v20M32 12v20M38 12v20" stroke-width="1.6"/>'),
  balcony: ic('<path d="M4 30h40v4H4z" fill="currentColor"/><path d="M6 30V16h36v14M12 16v14M18 16v14M24 16v14M30 16v14M36 16v14" stroke-width="1.5"/><path d="M14 34l4 6M34 34l-4 6"/>'),
  pergola: ic('<path d="M4 14h40M4 20h40"/><path d="M9 10v8M17 10v8M25 10v8M33 10v8M41 10v8" stroke-width="1.6"/><path d="M9 20v22M39 20v22"/>'),
  chimney: ic('<path d="M14 42V12h20v30"/><path d="M11 8h26v4H11z" fill="currentColor"/><path d="M14 20h20M14 28h20M14 36h20M24 12v8M19 20v8M29 20v8M24 28v8" stroke-width="1.2"/>'),
  cladding: ic('<rect x="8" y="6" width="32" height="36"/><path d="M8 14h14v8H8M22 6v8h18M26 14h14v10H26M8 30h18v12M26 24v6h14M18 22v8" stroke-width="1.4"/>'),
  louvers: ic('<rect x="6" y="6" width="36" height="36" rx="1"/><path d="M12 6v36M18 6v36M24 6v36M30 6v36M36 6v36" stroke-width="2.6"/>'),
  frame: ic('<path d="M8 42V6h32v36" stroke-width="5"/><rect x="16" y="14" width="16" height="20" stroke-width="1.6"/>'),
  archway: ic('<path d="M8 42V20a16 16 0 0 1 32 0v22"/><path d="M14 42V21a10 10 0 0 1 20 0v21" stroke-width="1.4"/>'),
  winArched: ic('<path d="M12 42V22a12 12 0 0 1 24 0v20z"/><path d="M24 10v32M12 27h24" stroke-width="1.6"/>'),
  floorL: ic('<path d="M8 8h16v16h16v16H8z"/><path d="M8 16h16M8 24h16M8 32h32" stroke-width="1.2"/>'),
  floorSkew: ic('<path d="M14 10h28l-8 28H6z"/><path d="M12 19h28M9 29h28" stroke-width="1.2"/>'),
  floorHex: ic('<path d="M14 6h20l10 18-10 18H14L4 24z"/><path d="M8 17h32M8 31h32" stroke-width="1.2"/>'),
  wallCurve: ic('<path d="M6 38C10 16 38 16 42 38" stroke-width="7"/><path d="M6 38C10 16 38 16 42 38" stroke="#fff" stroke-width="1.2" opacity=".6"/>'),
  roofKerala: ic('<path d="M3 30l9-12h24l9 12z"/><path d="M18 18l6-9 6 9" fill="currentColor" opacity=".35"/><path d="M18 18l6-9 6 9M8 30v10h32V30"/>'),
  porticoKerala: ic('<path d="M3 20l8-9h26l8 9z"/><path d="M19 11l5-6 5 6" fill="currentColor" opacity=".35"/><path d="M10 20v20M38 20v20" stroke-width="3"/><path d="M5 34h10M33 34h10" stroke-width="2.6"/>'),
  gatePadippura: ic('<path d="M3 20l7-9h28l7 9z"/><path d="M19 11l5-6 5 6" fill="currentColor" opacity=".35"/><rect x="6" y="20" width="6" height="22"/><rect x="36" y="20" width="6" height="22"/><path d="M12 24h24v18H12z" stroke-width="1.4"/><path d="M24 24v18" stroke-width="1.4"/>'),
  coconut: ic('<path d="M26 44c0-12-2-22-4-30"/><path d="M22 14c-6-4-12-3-16 2M22 14c-2-6-7-9-12-9M22 14c3-6 9-8 15-6M22 14c6-2 12 1 15 6M22 14c1 6-1 11-5 14"/><circle cx="21" cy="17" r="2" fill="currentColor"/>'),
  flowerTree: ic('<path d="M24 44V30"/><path d="M24 31c-9 0-14-5-14-11 0-5 4-9 8-9 1-4 4-6 6-6s5 2 6 6c4 0 8 4 8 9 0 6-5 11-14 11z"/><circle cx="17" cy="18" r="2" fill="currentColor"/><circle cx="28" cy="14" r="2" fill="currentColor"/><circle cx="30" cy="23" r="2" fill="currentColor"/><circle cx="21" cy="25" r="2" fill="currentColor"/>'),
  banana: ic('<path d="M24 44V24"/><path d="M24 26C14 26 8 18 8 10c6 2 12 8 16 16zM24 24c10 0 16-8 16-16-6 2-12 8-16 16zM24 22c-3-8-1-14 2-18 3 6 2 12-2 18z"/>'),
  bamboo: ic('<path d="M14 44V6M24 44V4M34 44V8" stroke-width="3"/><path d="M11 14h6M11 26h6M21 12h6M21 24h6M21 36h6M31 18h6M31 30h6" stroke-width="1.4"/>'),
  hedge: ic('<path d="M4 40V22c0-4 4-6 7-4 1-4 6-5 8-2 2-3 7-3 9 0 2-3 7-2 8 2 3-2 8 0 8 4v18z"/>'),
  flowers: ic('<path d="M4 40h40M8 40l2-6h28l2 6"/><circle cx="14" cy="22" r="4"/><circle cx="24" cy="18" r="4"/><circle cx="34" cy="22" r="4"/><path d="M14 26v8M24 22v12M34 26v8" stroke-width="1.4"/>'),
  pot: ic('<path d="M14 30h20l-3 12H17z"/><path d="M24 30V14M24 22c-6-1-9-6-9-10 5 0 9 4 9 10zM24 18c4-2 9-1 11 3-4 2-9 1-11-3z"/>'),
  tulsi: ic('<path d="M12 42h24v-4H12zM15 38V22h18v16M13 22h22l-2-4H15z"/><path d="M24 18V8M24 13c-4-1-6-4-6-7 4 0 6 3 6 7zM24 11c3-2 6-1 7 2-3 1-6 1-7-2z" stroke-width="1.5"/>'),
  sitout: ic('<path d="M6 24v14M18 24v14M6 30h12M6 24c0-4 12-4 12 0"/><path d="M30 24v14M42 24v14M30 30h12M30 24c0-4 12-4 12 0"/><ellipse cx="24" cy="34" rx="5" ry="2"/><path d="M24 36v4"/>'),
  bench: ic('<path d="M6 22h36M6 27h36M6 32h36"/><path d="M9 32v8M39 32v8M9 22v-6M39 22v-6" stroke-width="2.6"/>'),
  swing: ic('<path d="M6 42L12 6h24l6 36"/><path d="M17 6v24M31 6v24"/><path d="M14 30h20v4H14z" fill="currentColor"/>'),
  fountain: ic('<ellipse cx="24" cy="38" rx="18" ry="4"/><path d="M6 38v-4M42 38v-4"/><path d="M24 34V16M16 26h16"/><path d="M24 16c-3-4-8-4-10 0M24 16c3-4 8-4 10 0M24 12c0-3 2-6 0-8" stroke-width="1.5"/>'),
  rocks: ic('<path d="M4 40l5-10 8-3 6 5 3 8zM22 40l6-14 9-2 7 8v8z"/>'),
  wc: ic('<rect x="14" y="5" width="20" height="9" rx="2"/><path d="M15 14h18v6c0 9-4 16-9 16s-9-7-9-16z"/><path d="M19 36l-1 7h12l-1-7"/>'),
  basin: ic('<path d="M6 18h36v4c0 9-8 14-18 14S6 31 6 22z"/><path d="M24 18v-8h6" stroke-width="1.6"/><ellipse cx="24" cy="24" rx="10" ry="4" stroke-width="1.4"/>'),
  shower: ic('<path d="M10 6v8M10 6h14l4 4"/><path d="M24 12h8l-1 3h-6z"/><path d="M26 19l-2 5M29 19v5M32 19l2 5M25 28l-2 5M29 28v6M33 28l2 5" stroke-width="1.4"/><path d="M6 42h36"/>'),
  bathtub: ic('<path d="M4 24h40v6a10 10 0 0 1-10 10H14A10 10 0 0 1 4 30z"/><path d="M10 24V10a4 4 0 0 1 8 0" /><path d="M12 40l-2 4M36 40l2 4"/>'),
  washer: ic('<rect x="8" y="5" width="32" height="38" rx="3"/><circle cx="24" cy="27" r="10"/><circle cx="24" cy="27" r="5" stroke-width="1.4"/><path d="M13 11h6M33 11h1"/>'),
  pooja: ic('<path d="M8 42V22L24 6l16 16v20z"/><path d="M18 42V30a6 6 0 0 1 12 0v12"/><path d="M24 22c-2 2-2 4 0 6 2-2 2-4 0-6z" fill="currentColor"/><path d="M22 4h4" />'),
  rampA: ic('<path d="M4 38h40L4 22z"/><path d="M8 18v-4l32 16v4" stroke-width="2"/><path d="M8 14v12M24 22v9M40 30v6" stroke-width="1.6"/>'),
  stepsS: ic('<path d="M6 40h36M6 40v-6h9v-6h9v-6h9v-6h9v24"/>'),
  stepsR: ic('<path d="M6 34a18 18 0 0 1 36 0M11 34a13 13 0 0 1 26 0M16 34a8 8 0 0 1 16 0M4 34h40"/>'),
  stepsW: ic('<path d="M6 12v28h36V12M11 12v23h26V12M16 12v18h16V12M4 12h40"/>'),
  nightstand: ic('<rect x="12" y="14" width="24" height="24" rx="2"/><path d="M12 26h24M22 20h4M22 32h4"/>'),
  dressing: ic('<rect x="6" y="28" width="36" height="12" rx="1"/><ellipse cx="24" cy="16" rx="9" ry="11"/><path d="M24 34h0"/>'),
  coffeetable: ic('<rect x="6" y="16" width="36" height="16" rx="4"/><path d="M14 32v6M34 32v6"/>'),
  floorlamp: ic('<path d="M16 16h16l-4-10H20z"/><path d="M24 16v24M16 42h16"/>'),
  sofaL: ic('<path d="M6 10h24v16h12v14H6z"/><path d="M6 16h18v24M30 26v14"/>'),
  wardrobe: ic('<rect x="8" y="4" width="32" height="40" rx="1"/><path d="M24 4v40M20 22v4M28 22v4"/>'),
  tvunit: ic('<rect x="8" y="8" width="32" height="20" rx="2"/><path d="M4 38h40v4H4zM18 28l-2 10M30 28l2 10"/>'),
  desk: ic('<path d="M4 18h40M8 18v24M40 18v24M28 18v12h12"/><rect x="12" y="6" width="12" height="9" rx="1"/>'),
  bookshelf: ic('<rect x="8" y="4" width="32" height="40"/><path d="M8 17h32M8 30h32M12 8v9M16 6v11M22 9v8M13 21v9M19 21v9M26 21v9M12 34v10M18 34v10" stroke-width="1.6"/>'),
  fridge: ic('<rect x="12" y="4" width="24" height="40" rx="3"/><path d="M12 18h24M16 10v4M16 22v6"/>'),
  watertank: ic('<ellipse cx="24" cy="10" rx="14" ry="4"/><path d="M10 10v22c0 2 6 4 14 4s14-2 14-4V10"/><path d="M14 36v8M34 36v8M10 20h28" stroke-width="1.4"/>'),
  solar: ic('<path d="M6 34l8-22h28l-8 22z"/><path d="M10 23h28M19 12l-6 22M28 12l-6 22M36 12l-6 22" stroke-width="1.3"/><path d="M14 34v8M34 34v8"/>'),
  septic: ic('<rect x="4" y="16" width="40" height="22" rx="2" stroke-dasharray="4 3"/><path d="M18 16v22M30 16v22" stroke-width="1.4"/><path d="M8 10h8v6M32 10h8v6"/>'),
  well: ic('<ellipse cx="24" cy="32" rx="16" ry="6"/><path d="M8 32v6c0 3 7 6 16 6s16-3 16-6v-6"/><path d="M12 30V8M36 30V8M10 8h28"/><path d="M24 8v12" /><rect x="21" y="20" width="6" height="5"/>'),
  acunit: ic('<rect x="4" y="12" width="40" height="24" rx="2"/><circle cx="28" cy="24" r="8"/><path d="M28 16v16M20 24h16" stroke-width="1.3"/><path d="M8 18h8M8 22h8M8 26h8" stroke-width="1.3"/>'),
  stairsL: ic('<path d="M8 42V8h14v20h18v14z"/><path d="M8 14h14M8 20h14M8 26h14M28 28v14M34 28v14" stroke-width="1.4"/>'),
  stairsU: ic('<path d="M6 42V6h36v36H28V18h-8v24z"/><path d="M6 36h14M6 30h14M6 24h14M28 24h14M28 30h14M28 36h14" stroke-width="1.4"/>'),
  ramp: ic('<path d="M4 38h40L4 22z"/><path d="M14 33l14-3" stroke-width="1.4"/>'),
};

// ---------------------------------------------------------------- finishes
export const FINISH = {
  wall: [['plaster', 'Plaster'], ['brick', 'Brick'], ['laterite', 'Laterite (vettukallu)'], ['stone', 'Stone'], ['siding', 'Wood siding'], ['deck', 'Wood panels'], ['tile', 'Tile cladding'], ['marble', 'Marble'], ['concrete', 'Concrete']],
  floor: [['wood', 'Wood planks'], ['tile', 'Ceramic tile'], ['marble', 'Marble'], ['carpet', 'Carpet'], ['concrete', 'Polished concrete'], ['deck', 'Timber deck'], ['flagstone', 'Stone']],
  clad: [['stone', 'Stone'], ['laterite', 'Laterite'], ['brick', 'Brick'], ['deck', 'Wood'], ['tile', 'Tile'], ['marble', 'Marble'], ['concrete', 'Concrete'], ['plaster', 'Plaster']],
  paving: [['asphalt', 'Asphalt'], ['concrete', 'Concrete'], ['pavers', 'Brick pavers'], ['flagstone', 'Flagstone'], ['gravel', 'Gravel'], ['grass', 'Lawn']],
  roof: [['shingles', 'Asphalt shingles'], ['clay', 'Clay tiles'], ['metal', 'Standing-seam metal'], ['concrete', 'Concrete slab']],
  stair: [['wood', 'Wood'], ['concrete', 'Concrete'], ['marble', 'Marble'], ['stone', 'Stone']],
};
const FLOOR_2D = { wood: '#e6cfa8', tile: '#ece7dd', marble: '#f2f0ec', carpet: '#d9d3cb', concrete: '#d6d3cd', deck: '#cdb08c', flagstone: '#d2c9b8' };
const PAVING_2D = { asphalt: '#6a6d71', concrete: '#cfccc5', pavers: '#c99877', flagstone: '#c2b8a6', gravel: '#d8cfbd', grass: '#9cc77f' };

// ---------------------------------------------------------------- property schema helpers
const len = (key, label, o = {}) => ({ key, label, kind: 'len', min: 0.05, ...o });
const num = (key, label, o = {}) => ({ key, label, kind: 'num', ...o });
const color = (key, label) => ({ key, label, kind: 'color' });
const select = (key, label, options) => ({ key, label, kind: 'select', options });
const bool = (key, label) => ({ key, label, kind: 'bool' });
const text = (key, label) => ({ key, label, kind: 'text' });
const POS = [len('x', 'Position X', { min: -9999 }), len('y', 'Position Y', { min: -9999 }), num('rot', 'Rotation °', { step: 15 })];
const ELEV = len('z', 'Elevation', { min: -50 });
const W = len('w', 'Width'), D = len('d', 'Depth'), H = len('h', 'Height');
// distance from each wall end to the near edge of a door/window (needs the wall, so main.js resolves it)
const EDGE_PROPS = [
  { key: 'edgeL', label: 'Gap to wall start', kind: 'len', min: 0, get: 'openingLeft', set: 'openingLeft' },
  { key: 'edgeR', label: 'Gap to wall end', kind: 'len', min: 0, get: 'openingRight', set: 'openingRight' },
];

// ---------------------------------------------------------------- 2D drawing helpers (local metres)
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function txt(ctx, P, s, x, y, size = 11, col = '#334', weight = 600) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(P, P);
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = col;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, 0, 0);
  ctx.restore();
}
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = (o) => hash(o.id || 'x');
const LINE = '#3b4250';

function rectBase(ctx, o, P, fill, stroke = LINE) {
  ctx.fillStyle = fill; ctx.fillRect(-o.w / 2, -o.d / 2, o.w, o.d);
  ctx.strokeStyle = stroke; ctx.lineWidth = 1.2 * P; ctx.strokeRect(-o.w / 2, -o.d / 2, o.w, o.d);
}
function clipRect(ctx, o) { ctx.beginPath(); ctx.rect(-o.w / 2, -o.d / 2, o.w, o.d); ctx.clip(); }
function hLines(ctx, o, P, step, col, lw = 1) {
  ctx.strokeStyle = col; ctx.lineWidth = lw * P; ctx.beginPath();
  for (let y = -o.d / 2 + step; y < o.d / 2; y += step) { ctx.moveTo(-o.w / 2, y); ctx.lineTo(o.w / 2, y); }
  ctx.stroke();
}
function gridLines(ctx, o, P, step, col) {
  hLines(ctx, o, P, step, col);
  ctx.beginPath();
  for (let x = -o.w / 2 + step; x < o.w / 2; x += step) { ctx.moveTo(x, -o.d / 2); ctx.lineTo(x, o.d / 2); }
  ctx.stroke();
}
export function gazeboVerts(o) {
  const n = o.sides || 8, r = o.w / 2, pts = [];
  for (let i = 0; i < n; i++) { const t = Math.PI / n + (i * 2 * Math.PI) / n; pts.push([r * Math.sin(t), r * Math.cos(t)]); }
  return pts;
}
function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }

// Outline of a floor / paving slab in local metres (x across width, y across depth).
export function floorPoly(o) {
  const hw = o.w / 2, hd = o.d / 2, k = Math.tan(((o.skew ?? 20) * Math.PI) / 180);
  switch (o.shape) {
    case 'custom': if (o.pts?.length >= 3) return o.pts; break;
    case 'parallelogram': {
      const off = Math.max(-(o.w - 0.1), Math.min(o.w - 0.1, k * o.d));
      return off >= 0 ? [[-hw + off, -hd], [hw, -hd], [hw - off, hd], [-hw, hd]] : [[-hw, -hd], [hw + off, -hd], [hw, hd], [-hw - off, hd]];
    }
    case 'trapezoid': {
      const ins = Math.max(0, Math.min(hw - 0.05, Math.abs(k) * o.d));
      return [[-hw + ins, -hd], [hw - ins, -hd], [hw, hd], [-hw, hd]];
    }
    case 'lshape': return [[-hw, -hd], [0, -hd], [0, 0], [hw, 0], [hw, hd], [-hw, hd]];
    case 'ushape': return [[-hw, -hd], [-hw / 3, -hd], [-hw / 3, 0], [hw / 3, 0], [hw / 3, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    case 'hexagon': case 'octagon': case 'circle': {
      const n = { hexagon: 6, octagon: 8, circle: 48 }[o.shape], pts = [];
      for (let i = 0; i < n; i++) { const a = Math.PI / n + (i * 2 * Math.PI) / n; pts.push([hw * Math.cos(a), hd * Math.sin(a)]); }
      return pts;
    }
  }
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
}
// Re-centre a custom polygon on its bounding box, keeping it fixed in the world, and refresh w/d.
export function normalizeCustom(o) {
  const xs = o.pts.map((p) => p[0]), ys = o.pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = ((o.rot || 0) * Math.PI) / 180;
  o.x += cx * Math.cos(r) - cy * Math.sin(r); o.y += cx * Math.sin(r) + cy * Math.cos(r);
  o.pts = o.pts.map(([x, y]) => [+(x - cx).toFixed(4), +(y - cy).toFixed(4)]);
  o.w = Math.max(0.1, Math.max(...xs) - Math.min(...xs)); o.d = Math.max(0.1, Math.max(...ys) - Math.min(...ys));
}
// Set the length of side i (from corner i to corner i+1) by moving corner i+1 along the side.
export function setSideLength(o, i, L) {
  if (o.shape !== 'custom') { o.pts = floorPoly(o).map((p) => [...p]); o.shape = 'custom'; }
  const n = o.pts.length, a = o.pts[i], b = o.pts[(i + 1) % n], cur = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  o.pts[(i + 1) % n] = [a[0] + ((b[0] - a[0]) / cur) * L, a[1] + ((b[1] - a[1]) / cur) * L];
  normalizeCustom(o);
}
export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}
export const pointInPoly = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const TREE_VARIETIES = [['round', 'Broadleaf'], ['mango', 'Mango'], ['gulmohar', 'Gulmohar (flowering)'], ['coconut', 'Coconut palm'], ['palm', 'Ornamental palm'],
  ['banana', 'Banana'], ['bamboo', 'Bamboo cluster'], ['conifer', 'Conifer'], ['cypress', 'Cypress (column)']];
const FLOWER_COLORS = [['mix', 'Mixed colours'], ['#d9354c', 'Red'], ['#f0a020', 'Marigold orange'], ['#f3d23a', 'Yellow'], ['#e86fb0', 'Pink'], ['#8a5cd6', 'Purple'], ['#ffffff', 'White']];

// ---------------------------------------------------------------- stairs
const STAIR_TYPES = [['straight', 'Straight flight'], ['lshape', 'L-shaped (quarter landing)'], ['winder', 'L-shaped with winders'], ['ushape', 'Dog-legged U (half landing)']];
// Step layout inside the w × d footprint (local metres; flight starts at +y / front and climbs).
// Returns step polygons with their top heights, a walking line and handrail polylines [x, y, top].
export function stairLayout(o) {
  const hw = o.w / 2, hd = o.d / 2, type = o.shape || 'straight';
  const n = Math.max(3, o.risers > 1 ? o.risers | 0 : Math.round(o.h / 0.17)), rise = o.h / n;
  const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const steps = [], rails = [];
  const fw = Math.max(0.5, Math.min(o.flightW || 1, type === 'ushape' ? (o.w - 0.05) / 2 : Math.min(o.w, o.d) - 0.3));
  if (type === 'straight') {
    const t = o.d / n;
    for (let i = 0; i < n; i++) steps.push({ pts: R(-hw, hd - (i + 1) * t, hw, hd - i * t), top: (i + 1) * rise });
    for (const s of [-1, 1]) rails.push(steps.map((st, i) => [s * (hw - 0.04), hd - (i + 0.5) * t, st.top]));
    return { steps, path: [[0, hd - t * 0.4], [0, -hd + t * 0.5]], rails, n, rise, tread: t };
  }
  if (type === 'ushape') {
    const ld = Math.min(fw, o.d * 0.4), run = o.d - ld, k = n - 1, n1 = Math.ceil(k / 2), n2 = k - n1, t1 = run / n1, t2 = run / Math.max(1, n2);
    const r1 = [], r2 = [];
    for (let i = 0; i < n1; i++) { steps.push({ pts: R(hw - fw, hd - (i + 1) * t1, hw, hd - i * t1), top: (i + 1) * rise }); r1.push([hw - 0.04, hd - (i + 0.5) * t1, (i + 1) * rise]); }
    steps.push({ pts: R(-hw, -hd, hw, -hd + ld), top: (n1 + 1) * rise, landing: true });
    for (let j = 0; j < n2; j++) { steps.push({ pts: R(-hw, -hd + ld + j * t2, -hw + fw, -hd + ld + (j + 1) * t2), top: (n1 + 2 + j) * rise }); r2.push([-hw + 0.04, -hd + ld + (j + 0.5) * t2, (n1 + 2 + j) * rise]); }
    rails.push([...r1, [hw - 0.04, -hd + 0.04, (n1 + 1) * rise], [-hw + 0.04, -hd + 0.04, (n1 + 1) * rise], ...r2]);
    return { steps, path: [[hw - fw / 2, hd - t1 * 0.4], [hw - fw / 2, -hd + ld / 2], [-hw + fw / 2, -hd + ld / 2], [-hw + fw / 2, hd - 0.2]], rails, n, rise, tread: Math.min(t1, t2) };
  }
  // L-shaped: first flight up the right side, landing (or winders) in the back-right corner, second flight to the left
  const wind = type === 'winder', corner = wind ? 3 : 1, run1 = o.d - fw, run2 = o.w - fw, k = n - corner;
  const n1 = Math.max(1, Math.round((k * run1) / (run1 + run2))), n2 = Math.max(1, k - n1), t1 = run1 / n1, t2 = run2 / n2;
  const r = [];
  for (let i = 0; i < n1; i++) { steps.push({ pts: R(hw - fw, hd - (i + 1) * t1, hw, hd - i * t1), top: (i + 1) * rise }); r.push([hw - 0.04, hd - (i + 0.5) * t1, (i + 1) * rise]); }
  const ix = hw - fw, iy = -hd + fw;
  if (wind) {
    // three winder treads fanning around the inner corner
    const ray = (deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return deg <= 45 ? [hw, iy - fw * Math.tan(a)] : [ix + fw / Math.tan(a), -hd]; };
    const segs = [[0, 30], [30, 60], [60, 90]];
    segs.forEach(([a0, a1], i) => {
      const pts = [[ix, iy], ray(a0)];
      if (a0 < 45 && a1 > 45) pts.push([hw, -hd]);
      pts.push(ray(a1));
      steps.push({ pts, top: (n1 + 1 + i) * rise });
    });
  } else steps.push({ pts: R(ix, -hd, hw, iy), top: (n1 + 1) * rise, landing: true });
  r.push([hw - 0.04, -hd + 0.04, (n1 + corner) * rise]);
  for (let j = 0; j < n2; j++) { steps.push({ pts: R(ix - (j + 1) * t2, -hd, ix - j * t2, iy), top: (n1 + corner + 1 + j) * rise }); r.push([ix - (j + 0.5) * t2, -hd + 0.04, (n1 + corner + 1 + j) * rise]); }
  rails.push(r);
  return { steps, path: [[hw - fw / 2, hd - t1 * 0.4], [hw - fw / 2, -hd + fw / 2], [-hw + 0.2, -hd + fw / 2]], rails, n, rise, tread: Math.min(t1, t2) };
}
// Building-code style comfort check (riser 150–190 mm, tread ≥ 250 mm, 2R + T ≈ 550–700 mm).
export function stairCheck(o) {
  if (o.type !== 'stairs') return { ok: true, text: '' };
  const L = stairLayout(o), R = L.rise * 1000, T = L.tread * 1000, two = 2 * R + T;
  const ok = R >= 150 && R <= 190 && T >= 250 && two >= 550 && two <= 700;
  return { ok, R, T, n: L.n, text: `${L.n} risers × ${R.toFixed(0)} mm, tread ${T.toFixed(0)} mm, 2R+T ${two.toFixed(0)} mm ${ok ? '✓ OK' : '⚠ adjust size'}` };
}

const PORTICO_STYLES = [['kerala', 'Kerala sit-out (tiled mukhappu roof)'], ['kerala-gable', 'Kerala front gable (wooden jaali)'], ['pediment', 'Classical pediment'], ['hip', 'Hip-roof porch'],
  ['flat', 'Flat slab'], ['arched', 'Arched arcade'], ['balcony', 'Balcony on top'], ['modern', 'Modern cantilever canopy']];
const COLUMN_STYLES = [['wood', 'Kerala wooden pillar on granite'], ['classic', 'Classical round'], ['square', 'Square'], ['craftsman', 'Craftsman tapered'], ['steel', 'Slim steel']];
const SHAPES = [['rect', 'Rectangle'], ['custom', 'Custom — edit every side'], ['parallelogram', 'Skewed (parallelogram)'], ['trapezoid', 'Trapezoid'], ['lshape', 'L-shape'], ['ushape', 'U-shape'], ['hexagon', 'Hexagon'], ['octagon', 'Octagon'], ['circle', 'Circle / oval']];
function slabFill(ctx, o, P, fill, pattern) {
  const pts = floorPoly(o);
  ctx.save(); poly(ctx, pts); ctx.clip();
  ctx.fillStyle = fill; ctx.fillRect(-o.w / 2 - 1, -o.d / 2 - 1, o.w + 2, o.d + 2);
  pattern?.();
  ctx.restore();
  if (o.slope) {
    ctx.strokeStyle = 'rgba(194,65,12,.8)'; ctx.lineWidth = 1.4 * P; ctx.beginPath();
    ctx.moveTo(0, o.d / 2 - 0.3); ctx.lineTo(0, -o.d / 2 + 0.3); ctx.moveTo(-0.15, -o.d / 2 + 0.5); ctx.lineTo(0, -o.d / 2 + 0.3); ctx.lineTo(0.15, -o.d / 2 + 0.5); ctx.stroke();
    txt(ctx, P, `RAMP ${o.slope}°`, 0.45, 0, 9, '#c2410c', 700);
  }
}

function drawCar2D(ctx, P, L, Wd, col) {
  rr(ctx, -L / 2, -Wd / 2, L, Wd, 0.35); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 1 * P; ctx.stroke();
  ctx.fillStyle = 'rgba(30,40,55,.75)';
  rr(ctx, L * 0.08, -Wd / 2 + 0.15, L * 0.16, Wd - 0.3, 0.12); ctx.fill();   // windshield
  rr(ctx, -L * 0.3, -Wd / 2 + 0.18, L * 0.12, Wd - 0.36, 0.1); ctx.fill();   // rear glass
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  rr(ctx, -L * 0.18, -Wd / 2 + 0.12, L * 0.26, Wd - 0.24, 0.1); ctx.fill(); // roof
}

// ---------------------------------------------------------------- type definitions
// kind: rect (x,y,w,d,rot) | wall | opening. z2d orders drawing in the plan; hit: area | edge | low.
export const TYPES = {
  wall: {
    label: 'Wall', kind: 'wall',
    props: [
      { key: 'length', label: 'Length (centre-line)', kind: 'len', min: 0.1, get: (o) => wallLen(o), set: 'wallLength' },
      len('bulge', 'Curve (bulge, 0 = straight)', { min: -50 }),
      { key: 'radius', label: 'Curve radius', kind: 'info', get: (o) => { const a = wallArc(o); return a ? `R = ${a.r.toFixed(3)} m · arc ${a.len.toFixed(3)} m · ${Math.abs(a.sweep * 180 / Math.PI).toFixed(1)}° sweep` : 'Straight wall — drag the orange ◆ handle in the plan to bend it'; } },
      select('lenAnchor', 'Length change keeps', [['start', 'Start fixed'], ['end', 'End fixed'], ['center', 'Centre fixed']]),
      { key: 'angle', label: 'Angle °', kind: 'num', step: 1, get: (o) => +((((-Math.atan2(o.y2 - o.y1, o.x2 - o.x1) * 180) / Math.PI) + 360) % 360).toFixed(2), set: 'wallAngle' },
      len('x1', 'Start X', { min: -9999 }), len('y1', 'Start Y', { min: -9999 }), len('x2', 'End X', { min: -9999 }), len('y2', 'End Y', { min: -9999 }),
      len('thickness', 'Thickness', { min: 0.05 }), len('height', 'Height', { min: 0.3 }),
      select('kind', 'Type', [['exterior', 'Exterior'], ['interior', 'Interior']]),
      select('finish', 'Outside finish', FINISH.wall), color('color', 'Outside colour'), color('innerColor', 'Inside paint'),
    ],
  },
  door: {
    label: 'Door', kind: 'opening',
    props: [
      text('tag', 'Tag (e.g. D1)'),
      select('style', 'Style', [['single', 'Single'], ['double', 'Double'], ['sliding', 'Sliding glass'], ['garage', 'Garage'], ['arch', 'Open archway']]),
      len('width', 'Width', { min: 0.4 }), len('height', 'Height', { min: 1 }), len('t', 'Centre from wall start', { min: 0 }), ...EDGE_PROPS,
      num('open', 'Opened °', { min: 0, max: 100, step: 5 }), bool('flip', 'Swing other side'), bool('hinge', 'Hinge on other end'),
      color('color', 'Door colour'), color('frameColor', 'Frame colour'),
    ],
  },
  window: {
    label: 'Window', kind: 'opening',
    props: [
      text('tag', 'Tag (e.g. W1)'),
      select('style', 'Style', [['casement', 'Casement'], ['sliding', 'Sliding'], ['picture', 'Picture'], ['arched', 'Arched'], ['vent', 'Ventilator']]),
      len('width', 'Width', { min: 0.3 }), len('height', 'Height', { min: 0.3 }), len('sill', 'Sill height', { min: 0 }),
      { key: 'head', label: 'Head height', kind: 'len', min: 0.3, get: (o) => (o.sill || 0) + o.height, set: 'head' },
      len('t', 'Centre from wall start', { min: 0 }), ...EDGE_PROPS, bool('shade', 'Sunshade (chajja)'), color('frameColor', 'Frame colour'),
    ],
  },
  floor: {
    label: 'Floor', kind: 'rect', z2d: 1, hit: 'low',
    props: [text('name', 'Room name'), ...POS, ELEV, W, D, select('shape', 'Shape', SHAPES), num('skew', 'Skew angle °', { min: -60, max: 60, step: 5 }),
      num('slope', 'Slope (ramp) °', { min: 0, max: 25, step: 1 }), select('finish', 'Finish', FINISH.floor), color('color', 'Tint')],
    draw2d(ctx, o, P) {
      slabFill(ctx, o, P, FLOOR_2D[o.finish] || '#e6cfa8', () => {
        if (o.finish === 'wood' || o.finish === 'deck') hLines(ctx, o, P, 0.2, 'rgba(120,80,40,.18)');
        else if (o.finish === 'tile') gridLines(ctx, o, P, 0.6, 'rgba(0,0,0,.12)');
        else if (o.finish === 'marble' || o.finish === 'flagstone') gridLines(ctx, o, P, 1, 'rgba(0,0,0,.08)');
      });
      if (o.shape && o.shape !== 'rect') { poly(ctx, floorPoly(o)); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = P; ctx.stroke(); }
    },
  },
  paving: {
    label: 'Paving', kind: 'rect', z2d: 0, hit: 'low',
    props: [...POS, W, D, select('shape', 'Shape', SHAPES), num('skew', 'Skew angle °', { min: -60, max: 60, step: 5 }), num('slope', 'Slope (ramp) °', { min: 0, max: 25, step: 1 }), select('finish', 'Surface', FINISH.paving)],
    draw2d(ctx, o, P) {
      slabFill(ctx, o, P, PAVING_2D[o.finish] || '#ccc', () => {
        if (o.finish === 'pavers') gridLines(ctx, o, P, 0.25, 'rgba(90,50,30,.25)');
        if (o.finish === 'flagstone') gridLines(ctx, o, P, 0.6, 'rgba(80,70,60,.3)');
        if (o.finish === 'concrete') gridLines(ctx, o, P, 1.5, 'rgba(0,0,0,.12)');
        if (o.finish === 'asphalt' && o.d > 2 && o.w > 2 && (!o.shape || o.shape === 'rect')) {
          ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2 * P; ctx.setLineDash([0.8, 0.8]);
          ctx.beginPath(); if (o.d >= o.w) { ctx.moveTo(0, -o.d / 2); ctx.lineTo(0, o.d / 2); } else { ctx.moveTo(-o.w / 2, 0); ctx.lineTo(o.w / 2, 0); } ctx.stroke();
        }
      });
      poly(ctx, floorPoly(o)); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = P; ctx.stroke();
    },
  },
  roof: {
    label: 'Roof', kind: 'rect', z2d: 9, hit: 'edge',
    props: [...POS, ELEV, len('w', 'Width (walls)'), len('d', 'Depth (walls)'),
      select('style', 'Style', [['kerala', 'Kerala (hip + mukhappu gablets)'], ['gable', 'Gable'], ['hip', 'Hip'], ['flat', 'Flat']]),
      num('pitch', 'Pitch °', { min: 5, max: 60, step: 1 }), len('overhang', 'Overhang', { min: 0 }),
      select('finish', 'Covering', FINISH.roof), color('color', 'Roof colour'), color('gableColor', 'Gable colour')],
    draw2d(ctx, o, P) {
      const ov = o.overhang || 0, Wd = o.w + 2 * ov, Dd = o.d + 2 * ov;
      ctx.fillStyle = 'rgba(160,82,45,.07)'; ctx.fillRect(-Wd / 2, -Dd / 2, Wd, Dd);
      ctx.setLineDash([8 * P, 5 * P]); ctx.strokeStyle = 'rgba(150,70,35,.85)'; ctx.lineWidth = 1.6 * P;
      ctx.strokeRect(-Wd / 2, -Dd / 2, Wd, Dd);
      ctx.beginPath();
      if (o.style === 'gable') { ctx.moveTo(-Wd / 2, 0); ctx.lineTo(Wd / 2, 0); }
      else if (o.style === 'hip' || o.style === 'kerala') {
        if (Wd >= Dd) { const rx = (Wd - Dd) / 2; ctx.moveTo(-rx, 0); ctx.lineTo(rx, 0);
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(sx * Wd / 2, sy * Dd / 2); ctx.lineTo(sx * rx, 0); } }
        else { const rz = (Dd - Wd) / 2; ctx.moveTo(0, -rz); ctx.lineTo(0, rz);
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(sx * Wd / 2, sy * Dd / 2); ctx.lineTo(0, sy * rz); } }
      } else ctx.rect(-Wd / 2 + 0.3, -Dd / 2 + 0.3, Wd - 0.6, Dd - 0.6);
      ctx.stroke(); ctx.setLineDash([]);
    },
  },
  column: {
    label: 'Column', kind: 'rect', z2d: 6,
    props: [...POS, len('w', 'Diameter'), H, select('shape', 'Shape', [['round', 'Round'], ['square', 'Square']]), color('color', 'Colour')],
    draw2d(ctx, o, P) {
      ctx.fillStyle = '#d9d4ca'; ctx.strokeStyle = LINE; ctx.lineWidth = 1.2 * P;
      if (o.shape === 'square') { ctx.fillRect(-o.w / 2, -o.d / 2, o.w, o.d); ctx.strokeRect(-o.w / 2, -o.d / 2, o.w, o.d); }
      else { ctx.beginPath(); ctx.arc(0, 0, o.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    },
    uniform: true,
  },
  stairs: {
    label: 'Stairs', kind: 'rect', z2d: 5,
    props: [
      select('shape', 'Stair type', STAIR_TYPES), ...POS, ELEV, len('w', 'Overall width'), len('d', 'Overall length'), len('h', 'Floor-to-floor rise'),
      len('flightW', 'Flight width', { min: 0.6 }), num('risers', 'Risers (0 = auto)', { min: 0, max: 40, step: 1 }),
      select('finish', 'Material', FINISH.stair), select('style', 'Construction', [['open', 'Open / floating treads'], ['solid', 'Solid (RCC / masonry)']]), bool('railing', 'Handrails'),
      { key: 'check', label: 'Riser / tread check', kind: 'info', get: (o) => stairCheck(o).text },
    ],
    draw2d(ctx, o, P) {
      const L = stairLayout(o);
      for (const s of L.steps) {
        poly(ctx, s.pts); ctx.fillStyle = s.landing ? '#e7dfd2' : '#efe9df'; ctx.fill();
        ctx.strokeStyle = 'rgba(59,66,80,.75)'; ctx.lineWidth = P; ctx.stroke();
      }
      ctx.strokeStyle = LINE; ctx.lineWidth = 1.4 * P; ctx.strokeRect(-o.w / 2, -o.d / 2, o.w, o.d);
      // walking line with arrow
      const pth = L.path;
      ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 1.5 * P; ctx.beginPath();
      pth.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      const [ax, ay] = pth[pth.length - 1], [bx, by] = pth[pth.length - 2], an = Math.atan2(ay - by, ax - bx);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(an - 0.45) * 0.25, ay - Math.sin(an - 0.45) * 0.25);
      ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(an + 0.45) * 0.25, ay - Math.sin(an + 0.45) * 0.25); ctx.stroke();
      ctx.beginPath(); ctx.arc(pth[0][0], pth[0][1], 0.06, 0, Math.PI * 2); ctx.fillStyle = '#c2410c'; ctx.fill();
      txt(ctx, P, 'UP', pth[0][0] + 0.28, pth[0][1] - 0.35, 10, '#c2410c', 700);
    },
  },
  spiral: {
    label: 'Spiral stairs', kind: 'rect', z2d: 5, uniform: true,
    props: [...POS, ELEV, len('w', 'Diameter'), len('h', 'Total rise'), color('color', 'Colour')],
    draw2d(ctx, o, P) {
      const r = o.w / 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#efe9df'; ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 1.2 * P; ctx.stroke();
      ctx.lineWidth = P; ctx.strokeStyle = 'rgba(59,66,80,.6)'; ctx.beginPath();
      for (let i = 0; i < 14; i++) { const a = (i * 2 * Math.PI) / 14; ctx.moveTo(Math.cos(a) * 0.08, Math.sin(a) * 0.08); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 0.08, 0, Math.PI * 2); ctx.fillStyle = LINE; ctx.fill();
      ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 1.6 * P; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0.3, Math.PI * 1.6); ctx.stroke();
    },
  },
  portico: {
    label: 'Portico', kind: 'rect', z2d: 6,
    props: [...POS, W, D, len('h', 'Column height'), num('columns', 'Columns', { min: 2, max: 8, step: 1 }),
      select('style', 'Design', PORTICO_STYLES), select('column', 'Columns style', COLUMN_STYLES), bool('steps', 'Front steps'),
      color('color', 'Column colour'), color('roofColor', 'Roof colour')],
    draw2d(ctx, o, P) {
      if (o.steps) { ctx.fillStyle = '#ddd6c9'; ctx.fillRect(-o.w * 0.35, o.d / 2, o.w * 0.7, 0.35); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.strokeRect(-o.w * 0.35, o.d / 2, o.w * 0.7, 0.35); }
      rectBase(ctx, o, P, '#e9e3d8');
      const ov = o.style === 'modern' ? 0.4 : 0.15;
      ctx.setLineDash([6 * P, 4 * P]); ctx.strokeStyle = 'rgba(150,70,35,.7)'; ctx.strokeRect(-o.w / 2 - ov, -o.d / 2 - 0.15, o.w + 2 * ov, o.d + 0.15 + ov);
      if (o.style === 'pediment' || o.style === 'hip') { ctx.beginPath(); ctx.moveTo(0, -o.d / 2 - 0.15); ctx.lineTo(0, o.d / 2 + ov); ctx.stroke(); }
      ctx.setLineDash([]);
      const n = Math.max(2, o.columns | 0), col = o.column || 'classic';
      for (let i = 0; i < n; i++) {
        const x = -o.w / 2 + 0.3 + (i * (o.w - 0.6)) / (n - 1), y = o.d / 2 - 0.3;
        ctx.fillStyle = col === 'steel' ? '#3d4148' : col === 'craftsman' ? '#b0644a' : '#fff'; ctx.strokeStyle = LINE; ctx.lineWidth = 1.2 * P;
        if (col === 'classic') { ctx.beginPath(); ctx.arc(x, y, 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        else { const s = col === 'steel' ? 0.1 : col === 'craftsman' ? 0.5 : 0.3; ctx.fillRect(x - s / 2, y - s / 2, s, s); ctx.strokeRect(x - s / 2, y - s / 2, s, s); }
      }
      if (o.style === 'arched') {
        ctx.strokeStyle = 'rgba(59,66,80,.6)'; ctx.lineWidth = P;
        for (let i = 0; i < n - 1; i++) { const a = -o.w / 2 + 0.3 + (i * (o.w - 0.6)) / (n - 1), b = -o.w / 2 + 0.3 + ((i + 1) * (o.w - 0.6)) / (n - 1); ctx.beginPath(); ctx.moveTo(a, o.d / 2 - 0.15); ctx.lineTo(b, o.d / 2 - 0.15); ctx.stroke(); }
      }
      if (o.style === 'balcony') txt(ctx, P, 'BALCONY OVER', 0, -0.1, 9, '#7c4a1e', 700);
    },
  },
  gazebo: {
    label: 'Gazebo', kind: 'rect', z2d: 6, uniform: true,
    props: [...POS, len('w', 'Diameter'), len('h', 'Post height'), select('sides', 'Sides', [[6, 'Hexagon'], [8, 'Octagon']]),
      color('color', 'Wood colour'), color('roofColor', 'Roof colour')],
    draw2d(ctx, o, P) {
      const v = gazeboVerts(o);
      poly(ctx, v); ctx.fillStyle = '#dcc6a3'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 1.2 * P; ctx.stroke();
      ctx.setLineDash([5 * P, 4 * P]); ctx.strokeStyle = 'rgba(150,70,35,.7)'; ctx.beginPath();
      for (const [x, y] of v) { ctx.moveTo(0, 0); ctx.lineTo(x * 1.15, y * 1.15); }
      ctx.stroke(); poly(ctx, v.map(([x, y]) => [x * 1.15, y * 1.15])); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#6b4f2e';
      for (const [x, y] of v) ctx.fillRect(x * 0.94 - 0.07, y * 0.94 - 0.07, 0.14, 0.14);
      ctx.fillStyle = '#d6c4a5'; ctx.fillRect(-0.6, o.w / 2 * Math.cos(Math.PI / (o.sides || 8)), 1.2, 0.4);
    },
  },
  carport: {
    label: 'Carport', kind: 'rect', z2d: 6,
    props: [...POS, W, D, H, bool('withCar', 'Parked car'), color('carColor', 'Car colour'), color('color', 'Post colour'), color('roofColor', 'Roof colour')],
    draw2d(ctx, o, P) {
      rectBase(ctx, o, P, '#d8d5ce', 'rgba(0,0,0,.35)');
      if (o.withCar) { ctx.save(); ctx.rotate(Math.PI / 2); drawCar2D(ctx, P, Math.min(4.5, o.d - 0.6), Math.min(1.85, o.w - 0.6), o.carColor || '#8a1c1c'); ctx.restore(); }
      ctx.setLineDash([6 * P, 4 * P]); ctx.strokeStyle = 'rgba(70,80,95,.8)'; ctx.lineWidth = 1.2 * P;
      ctx.strokeRect(-o.w / 2 - 0.2, -o.d / 2 - 0.2, o.w + 0.4, o.d + 0.4);
      ctx.beginPath(); ctx.moveTo(-o.w / 2, -o.d / 2); ctx.lineTo(o.w / 2, o.d / 2); ctx.moveTo(o.w / 2, -o.d / 2); ctx.lineTo(-o.w / 2, o.d / 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#3d4148';
      for (const [px, py] of carportPosts(o)) ctx.fillRect(px - 0.06, py - 0.06, 0.12, 0.12);
    },
  },
  car: {
    label: 'Car', kind: 'rect', z2d: 6,
    props: [...POS, len('w', 'Length'), len('d', 'Width'), color('color', 'Paint colour')],
    draw2d(ctx, o, P) { drawCar2D(ctx, P, o.w, o.d, o.color); },
  },
  fence: {
    label: 'Fence', kind: 'rect', z2d: 7,
    props: [...POS, len('w', 'Length'), H, select('style', 'Style', [['picket', 'Picket'], ['panel', 'Solid panel'], ['rail', 'Ranch rail']]), color('color', 'Colour')],
    draw2d(ctx, o, P) {
      ctx.fillStyle = '#8c6b47'; ctx.fillRect(-o.w / 2, -0.03, o.w, 0.06);
      const n = Math.max(1, Math.round(o.w / 2));
      for (let i = 0; i <= n; i++) { const x = -o.w / 2 + (i * o.w) / n; ctx.fillStyle = '#5b4126'; ctx.fillRect(x - 0.06, -0.06, 0.12, 0.12); }
    },
  },
  pool: {
    label: 'Swimming pool', kind: 'rect', z2d: 0.5,
    props: [...POS, W, D, color('color', 'Water tint')],
    draw2d(ctx, o, P) {
      rr(ctx, -o.w / 2, -o.d / 2, o.w, o.d, 0.25); ctx.fillStyle = '#e1dbcf'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke();
      const g = ctx.createLinearGradient(-o.w / 2, -o.d / 2, o.w / 2, o.d / 2);
      g.addColorStop(0, '#5cc4e6'); g.addColorStop(1, '#2b8fbf');
      rr(ctx, -o.w / 2 + 0.3, -o.d / 2 + 0.3, o.w - 0.6, o.d - 0.6, 0.15); ctx.fillStyle = g; ctx.fill();
    },
  },
  tree: {
    label: 'Tree', kind: 'rect', z2d: 8, uniform: true,
    props: [...POS, len('w', 'Canopy size'), H, select('variety', 'Variety', TREE_VARIETIES)],
    draw2d(ctx, o, P) {
      const rnd = seeded(seedOf(o)), r = o.w / 2, n = 18, pts = [];
      if (o.variety === 'coconut' || o.variety === 'palm' || o.variety === 'banana') {
        ctx.strokeStyle = o.variety === 'banana' ? 'rgba(120,170,60,.9)' : 'rgba(70,130,50,.9)'; ctx.lineWidth = (o.variety === 'banana' ? 5 : 3) * P; ctx.beginPath();
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + rnd() * 0.3; ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a + 0.3) * r * 0.6, Math.sin(a + 0.3) * r * 0.6, Math.cos(a) * r, Math.sin(a) * r); }
        ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, Math.PI * 2); ctx.fillStyle = '#6b4f2e'; ctx.fill();
        return;
      }
      if (o.variety === 'bamboo') {
        ctx.fillStyle = 'rgba(120,160,60,.45)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7a8a3a'; for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, q = rnd() * r * 0.45; ctx.beginPath(); ctx.arc(Math.cos(a) * q, Math.sin(a) * q, 0.05, 0, 7); ctx.fill(); }
        return;
      }
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr2 = r * (0.85 + rnd() * 0.15); pts.push([Math.cos(a) * rr2, Math.sin(a) * rr2]); }
      poly(ctx, pts);
      ctx.fillStyle = { conifer: 'rgba(46,105,64,.55)', cypress: 'rgba(40,90,55,.6)', gulmohar: 'rgba(214,68,40,.5)', mango: 'rgba(60,120,55,.6)' }[o.variety] || 'rgba(84,145,70,.5)';
      ctx.fill(); ctx.strokeStyle = 'rgba(40,90,40,.8)'; ctx.lineWidth = P; ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); }
      ctx.strokeStyle = 'rgba(40,90,40,.4)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, Math.max(0.08, r * 0.08), 0, Math.PI * 2); ctx.fillStyle = '#6b4f2e'; ctx.fill();
    },
  },
  shrub: {
    label: 'Shrub', kind: 'rect', z2d: 7, uniform: true,
    props: [...POS, len('w', 'Size'), H, color('color', 'Foliage')],
    draw2d(ctx, o, P) {
      const rnd = seeded(seedOf(o)), r = o.w / 2, pts = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, q = r * (0.75 + rnd() * 0.25); pts.push([Math.cos(a) * q, Math.sin(a) * q]); }
      poly(ctx, pts); ctx.fillStyle = 'rgba(70,130,60,.6)'; ctx.fill(); ctx.strokeStyle = 'rgba(40,90,40,.8)'; ctx.lineWidth = P; ctx.stroke();
    },
  },
  lamp: {
    label: 'Lamp post', kind: 'rect', z2d: 7, uniform: true,
    props: [...POS, H],
    draw2d(ctx, o, P) {
      ctx.beginPath(); ctx.arc(0, 0, 0.35, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,200,80,.25)'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, Math.PI * 2); ctx.fillStyle = '#2f3540'; ctx.fill();
    },
  },
  sofa: {
    label: 'Sofa', kind: 'rect', z2d: 3,
    props: [...POS, W, D, select('shape', 'Shape', [['straight', 'Straight'], ['lshape', 'L-shaped (chaise on the right)']]), color('color', 'Fabric')],
    draw2d(ctx, o, P) {
      const { w, d } = o;
      if (o.shape === 'lshape') {
        // seat run along the back, chaise down the right side
        const s = Math.min(0.95, d * 0.6), c = Math.min(0.95, w * 0.45);
        ctx.beginPath(); ctx.moveTo(-w / 2, -d / 2); ctx.lineTo(w / 2, -d / 2); ctx.lineTo(w / 2, d / 2); ctx.lineTo(w / 2 - c, d / 2); ctx.lineTo(w / 2 - c, -d / 2 + s); ctx.lineTo(-w / 2, -d / 2 + s); ctx.closePath();
        ctx.fillStyle = o.color; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.15)';
        ctx.fillRect(-w / 2, -d / 2, w, 0.2); ctx.fillRect(w / 2 - 0.2, -d / 2, 0.2, d); ctx.fillRect(-w / 2, -d / 2, 0.2, s);
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(w / 2 - c, -d / 2 + s); ctx.lineTo(w / 2 - 0.2, -d / 2 + s); ctx.stroke();
        return;
      }
      rr(ctx, -w / 2, -d / 2, w, d, 0.08); ctx.fillStyle = o.color; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.fillRect(-w / 2, -d / 2, w, 0.2); ctx.fillRect(-w / 2, -d / 2, 0.2, d); ctx.fillRect(w / 2 - 0.2, -d / 2, 0.2, d);
      const n = Math.max(1, Math.round((w - 0.4) / 0.7)); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath();
      for (let i = 1; i < n; i++) { const x = -w / 2 + 0.2 + (i * (w - 0.4)) / n; ctx.moveTo(x, -d / 2 + 0.2); ctx.lineTo(x, d / 2); }
      ctx.stroke();
    },
  },
  bed: {
    label: 'Bed', kind: 'rect', z2d: 3,
    props: [...POS, W, D, color('color', 'Bedspread')],
    draw2d(ctx, o, P) {
      const { w, d } = o;
      rectBase(ctx, o, P, '#f6f4f0');
      ctx.fillStyle = '#8b6a4a'; ctx.fillRect(-w / 2, -d / 2, w, 0.08);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,.25)';
      const pw = w > 1.3 ? (w - 0.3) / 2 : w - 0.2;
      for (let i = 0; i < (w > 1.3 ? 2 : 1); i++) { rr(ctx, -w / 2 + 0.1 + i * (pw + 0.1), -d / 2 + 0.15, pw, 0.4, 0.08); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = o.color; ctx.fillRect(-w / 2, -d / 2 + 0.7, w, d - 0.7);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w / 2, -d / 2 + 0.7, w, 0.18);
    },
  },
  table: {
    label: 'Dining table', kind: 'rect', z2d: 3,
    props: [...POS, W, D, color('color', 'Wood colour')],
    draw2d(ctx, o, P) {
      const { w, d } = o, n = Math.max(1, Math.floor(w / 0.65));
      ctx.fillStyle = '#d8d2c8'; ctx.strokeStyle = LINE; ctx.lineWidth = P;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (i + 0.5) * (w / n) - 0.22;
        for (const y of [-d / 2 - 0.5, d / 2 + 0.05]) { rr(ctx, x, y, 0.44, 0.45, 0.06); ctx.fill(); ctx.stroke(); }
      }
      rr(ctx, -w / 2, -d / 2, w, d, 0.05); ctx.fillStyle = '#b48a5e'; ctx.fill(); ctx.stroke();
    },
  },
  kitchen: {
    label: 'Kitchen counter', kind: 'rect', z2d: 3,
    props: [...POS, W, D, color('color', 'Cabinet colour')],
    draw2d(ctx, o, P) {
      const { w, d } = o;
      rectBase(ctx, o, P, '#e9e6e1');
      ctx.fillStyle = '#c9ced6'; rr(ctx, -w / 2 + w * 0.18, -d / 2 + 0.1, Math.min(0.8, w * 0.25), d - 0.2, 0.06); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke();
      const cx = w / 2 - Math.min(0.9, w * 0.3);
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(cx - 0.3, -d / 2 + 0.06, 0.6, d - 0.12);
      ctx.strokeStyle = '#8a8f98';
      for (const [x, y] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) { ctx.beginPath(); ctx.arc(cx + x, y * (d / 0.6), 0.08, 0, Math.PI * 2); ctx.stroke(); }
    },
  },
  gate: {
    label: 'Gate', kind: 'rect', z2d: 7,
    props: [...POS, len('w', 'Total width (with pillars)'), len('h', 'Gate height'),
      select('style', 'Design', [['iron', 'Wrought iron'], ['arch', 'Arched iron'], ['wood', 'Solid wood'], ['padippura', 'Kerala padippura (tiled gatehouse)'], ['modern', 'Modern slats'], ['sliding', 'Sliding']]),
      num('open', 'Opened (° or % sliding)', { min: 0, max: 100, step: 5 }),
      select('pillar', 'Pillars', [['brick', 'Brick'], ['stone', 'Stone'], ['plaster', 'Plaster'], ['none', 'None (posts)']]), bool('lamps', 'Pillar lamps'), color('color', 'Gate colour')],
    draw2d(ctx, o, P) {
      const p = o.pillar === 'none' ? 0.12 : 0.45, ow = Math.max(0.6, o.w - 2 * p);
      ctx.fillStyle = o.pillar === 'none' ? '#3d4148' : '#a8705a'; ctx.strokeStyle = LINE; ctx.lineWidth = P;
      for (const sx of [-1, 1]) { ctx.fillRect(sx * (o.w / 2 - p / 2) - p / 2, -p / 2, p, p); ctx.strokeRect(sx * (o.w / 2 - p / 2) - p / 2, -p / 2, p, p); }
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2.4 * P;
      if (o.style === 'sliding') {
        const off = ((o.open || 0) / 100) * ow;
        ctx.beginPath(); ctx.moveTo(-ow / 2 + off, -0.12); ctx.lineTo(ow / 2 + off, -0.12); ctx.stroke();
        ctx.setLineDash([5 * P, 4 * P]); ctx.lineWidth = P; ctx.beginPath(); ctx.moveTo(-ow / 2, -0.2); ctx.lineTo(ow * 1.5, -0.2); ctx.stroke(); ctx.setLineDash([]);
        return;
      }
      const a = ((o.open || 0) * Math.PI) / 180, lw = ow / 2;
      for (const [hx, e] of [[-ow / 2, 1], [ow / 2, -1]]) {
        ctx.lineWidth = 2.4 * P; ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx + e * lw * Math.cos(a), -lw * Math.sin(a)); ctx.stroke();
        ctx.save(); ctx.setLineDash([4 * P, 3 * P]); ctx.lineWidth = P; ctx.beginPath();
        if (e > 0) ctx.arc(hx, 0, lw, -Math.PI / 2, 0); else ctx.arc(hx, 0, lw, Math.PI, -Math.PI / 2);
        ctx.stroke(); ctx.restore();
      }
    },
  },
  boundary: {
    label: 'Boundary wall', kind: 'rect', z2d: 7,
    props: [...POS, len('w', 'Length'), len('d', 'Thickness'), H, select('style', 'Design', [['plaster', 'Plaster'], ['laterite', 'Laterite'], ['brick', 'Exposed brick'], ['stone', 'Stone'], ['railing', 'Low wall + railing']]), color('color', 'Colour')],
    draw2d(ctx, o, P) {
      const t = Math.max(o.d, 0.1);
      ctx.fillStyle = '#5b616b'; ctx.fillRect(-o.w / 2, -t / 2, o.w, t);
      if (o.style === 'railing') { ctx.fillStyle = PAPER_HATCH; ctx.fillRect(-o.w / 2, -t / 6, o.w, t / 3); }
      const n = Math.max(1, Math.round(o.w / 3));
      ctx.fillStyle = '#3b4250';
      for (let i = 0; i <= n; i++) { const x = -o.w / 2 + (i * o.w) / n; ctx.fillRect(x - (t + 0.15) / 2, -(t + 0.15) / 2, t + 0.15, t + 0.15); }
    },
  },
  balcony: {
    label: 'Balcony', kind: 'rect', z2d: 8.5, hit: 'edge',
    props: [...POS, ELEV, W, len('d', 'Projection'), select('rail', 'Railing', [['glass', 'Frameless glass'], ['iron', 'Metal bars'], ['solid', 'Solid parapet']]), color('color', 'Rail colour')],
    draw2d(ctx, o, P) {
      ctx.fillStyle = 'rgba(148,163,184,.18)'; ctx.fillRect(-o.w / 2, -o.d / 2, o.w, o.d);
      ctx.setLineDash([6 * P, 4 * P]); ctx.strokeStyle = 'rgba(71,85,105,.8)'; ctx.lineWidth = 1.2 * P; ctx.strokeRect(-o.w / 2, -o.d / 2, o.w, o.d); ctx.setLineDash([]);
      ctx.strokeStyle = o.rail === 'glass' ? '#2563eb' : '#334155'; ctx.lineWidth = 2.2 * P; ctx.beginPath();
      ctx.moveTo(-o.w / 2, -o.d / 2); ctx.lineTo(-o.w / 2, o.d / 2); ctx.lineTo(o.w / 2, o.d / 2); ctx.lineTo(o.w / 2, -o.d / 2); ctx.stroke();
      txt(ctx, P, 'BALCONY', 0, 0, 9, '#475569', 700);
    },
  },
  pergola: {
    label: 'Pergola', kind: 'rect', z2d: 8.4, hit: 'edge',
    props: [...POS, W, D, H, color('color', 'Wood colour')],
    draw2d(ctx, o, P) {
      ctx.strokeStyle = 'rgba(124,74,30,.75)'; ctx.lineWidth = 1.2 * P; ctx.beginPath();
      for (let x = -o.w / 2; x <= o.w / 2 + 0.01; x += 0.45) { ctx.moveTo(x, -o.d / 2 - 0.25); ctx.lineTo(x, o.d / 2 + 0.25); }
      ctx.moveTo(-o.w / 2 - 0.2, -o.d / 2 + 0.1); ctx.lineTo(o.w / 2 + 0.2, -o.d / 2 + 0.1); ctx.moveTo(-o.w / 2 - 0.2, o.d / 2 - 0.1); ctx.lineTo(o.w / 2 + 0.2, o.d / 2 - 0.1);
      ctx.stroke();
      ctx.fillStyle = '#6b4a2e';
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ctx.fillRect(sx * (o.w / 2 - 0.1) - 0.08, sy * (o.d / 2 - 0.1) - 0.08, 0.16, 0.16);
    },
  },
  chimney: {
    label: 'Chimney', kind: 'rect', z2d: 8,
    props: [...POS, ELEV, W, D, H],
    draw2d(ctx, o, P) {
      rectBase(ctx, o, P, '#b0644a');
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = P; ctx.beginPath(); ctx.rect(-o.w / 2 + 0.12, -o.d / 2 + 0.12, o.w - 0.24, o.d - 0.24); ctx.stroke();
    },
  },
  cladding: {
    label: 'Facade cladding', kind: 'rect', z2d: 8,
    props: [...POS, ELEV, len('w', 'Width'), H, len('d', 'Thickness', { min: 0.01 }), select('finish', 'Material', FINISH.clad), color('color', 'Tint')],
    draw2d(ctx, o, P) {
      const t = Math.max(o.d, 0.04);
      ctx.fillStyle = { stone: '#a39b8c', brick: '#a8553b', deck: '#9c7a55', tile: '#cfc8bb', marble: '#ece9e2', concrete: '#b9b6b0', plaster: '#e7e1d6' }[o.finish] || '#aaa';
      ctx.fillRect(-o.w / 2, -t / 2, o.w, t); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.strokeRect(-o.w / 2, -t / 2, o.w, t);
    },
  },
  louvers: {
    label: 'Louvers / fins', kind: 'rect', z2d: 8,
    props: [...POS, ELEV, len('w', 'Width'), H, len('d', 'Fin depth', { min: 0.02 }), len('gap', 'Spacing', { min: 0.05 }), select('dir', 'Direction', [['v', 'Vertical fins'], ['h', 'Horizontal slats']]), color('color', 'Colour')],
    draw2d(ctx, o, P) {
      ctx.fillStyle = o.color || '#8a5a33';
      if (o.dir === 'h') { ctx.fillRect(-o.w / 2, -o.d / 2, o.w, o.d); return; }
      const g = Math.max(0.05, o.gap || 0.15);
      for (let x = -o.w / 2; x <= o.w / 2 + 0.001; x += g) ctx.fillRect(x - 0.02, -o.d / 2, 0.04, o.d);
    },
  },
  frame: {
    label: 'Elevation frame', kind: 'rect', z2d: 8,
    props: [...POS, ELEV, len('w', 'Width'), H, len('d', 'Projection'), len('band', 'Band thickness', { min: 0.05 }), select('finish', 'Material', FINISH.clad), color('color', 'Colour')],
    draw2d(ctx, o, P) {
      const b = o.band || 0.2;
      ctx.fillStyle = o.color || '#3a3f47';
      ctx.fillRect(-o.w / 2, -o.d / 2, b, o.d); ctx.fillRect(o.w / 2 - b, -o.d / 2, b, o.d);
      ctx.setLineDash([4 * P, 3 * P]); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.strokeRect(-o.w / 2, -o.d / 2, o.w, o.d); ctx.setLineDash([]);
    },
  },
  hedge: {
    label: 'Hedge', kind: 'rect', z2d: 7,
    props: [...POS, len('w', 'Length'), len('d', 'Thickness'), H, color('color', 'Foliage')],
    draw2d(ctx, o, P) { rr(ctx, -o.w / 2, -o.d / 2, o.w, o.d, Math.min(0.2, o.d / 2)); ctx.fillStyle = 'rgba(62,110,48,.75)'; ctx.fill(); ctx.strokeStyle = 'rgba(30,70,30,.9)'; ctx.lineWidth = P; ctx.stroke(); },
  },
  flowerbed: {
    label: 'Flower bed', kind: 'rect', z2d: 1.5,
    props: [...POS, W, D, select('shape', 'Shape', [['rect', 'Rectangle'], ['circle', 'Round / oval']]), select('color', 'Flowers', FLOWER_COLORS), select('edge', 'Edging', [['brick', 'Brick'], ['stone', 'Stone'], ['none', 'None']])],
    draw2d(ctx, o, P) {
      const rnd = seeded(seedOf(o)), pts = floorPoly(o);
      poly(ctx, pts); ctx.fillStyle = '#7a5a3c'; ctx.fill(); ctx.strokeStyle = o.edge === 'none' ? 'transparent' : '#9c5b43'; ctx.lineWidth = 3 * P; ctx.stroke();
      ctx.save(); poly(ctx, pts); ctx.clip();
      const cols = ['#d9354c', '#f0a020', '#f3d23a', '#e86fb0', '#8a5cd6', '#ffffff'];
      for (let i = 0; i < o.w * o.d * 14; i++) { ctx.fillStyle = o.color === 'mix' || !o.color ? cols[Math.floor(rnd() * 6)] : o.color; ctx.beginPath(); ctx.arc((rnd() - 0.5) * o.w, (rnd() - 0.5) * o.d, 0.05 + rnd() * 0.04, 0, 7); ctx.fill(); }
      ctx.restore();
    },
  },
  pot: {
    label: 'Potted plant', kind: 'rect', z2d: 7, uniform: true,
    props: [...POS, ELEV, len('w', 'Pot diameter'), len('h', 'Plant height'), select('variety', 'Plant', [['leafy', 'Leafy plant'], ['palm', 'Areca palm'], ['flower', 'Flowering'], ['cactus', 'Cactus']]), color('color', 'Pot colour')],
    draw2d(ctx, o, P) { ctx.beginPath(); ctx.arc(0, 0, o.w / 2, 0, 7); ctx.fillStyle = o.color || '#b5653d'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, o.w * 0.4, 0, 7); ctx.fillStyle = 'rgba(70,130,60,.85)'; ctx.fill(); },
  },
  tulsi: {
    label: 'Tulsi thara', kind: 'rect', z2d: 7,
    props: [...POS, W, H, color('color', 'Colour')],
    draw2d(ctx, o, P) { rectBase(ctx, o, P, '#e9dcc2'); ctx.beginPath(); ctx.arc(0, 0, o.w * 0.25, 0, 7); ctx.fillStyle = '#4f7f3a'; ctx.fill(); },
  },
  bench: {
    label: 'Garden bench', kind: 'rect', z2d: 6,
    props: [...POS, W, D, color('color', 'Wood colour')],
    draw2d(ctx, o, P) { rectBase(ctx, o, P, '#b48a5e'); hLines(ctx, o, P, o.d / 4, 'rgba(0,0,0,.25)'); },
  },
  swing: {
    label: 'Swing (oonjal)', kind: 'rect', z2d: 6,
    props: [...POS, W, D, H, select('style', 'Style', [['frame', 'Free-standing frame'], ['hanging', 'Hanging (from ceiling)']]), color('color', 'Wood colour')],
    draw2d(ctx, o, P) {
      ctx.fillStyle = '#b48a5e'; ctx.fillRect(-o.w * 0.4, -0.25, o.w * 0.8, 0.5); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.strokeRect(-o.w * 0.4, -0.25, o.w * 0.8, 0.5);
      if (o.style !== 'hanging') { ctx.strokeStyle = '#5b4126'; ctx.lineWidth = 3 * P; ctx.beginPath(); ctx.moveTo(-o.w / 2, -o.d / 2); ctx.lineTo(-o.w / 2, o.d / 2); ctx.moveTo(o.w / 2, -o.d / 2); ctx.lineTo(o.w / 2, o.d / 2); ctx.stroke(); }
    },
  },
  sitout: {
    label: 'Sit-out seating', kind: 'rect', z2d: 3,
    props: [...POS, W, D, select('style', 'Set', [['chairs', '2 chairs + coffee table'], ['sofa', 'Outdoor sofa set'], ['charupadi', 'Kerala charupadi bench']]), color('color', 'Cushion colour')],
    draw2d(ctx, o, P) {
      ctx.strokeStyle = LINE; ctx.lineWidth = P;
      if (o.style === 'charupadi') { ctx.fillStyle = '#7a5230'; ctx.fillRect(-o.w / 2, -o.d / 2, o.w, o.d); ctx.strokeRect(-o.w / 2, -o.d / 2, o.w, o.d); return; }
      ctx.fillStyle = o.color || '#c9b28a';
      if (o.style === 'sofa') { rr(ctx, -o.w / 2, -o.d / 2, o.w, 0.75, 0.1); ctx.fill(); ctx.stroke(); }
      else for (const sx of [-1, 1]) { rr(ctx, sx * (o.w / 2 - 0.35) - 0.3, -o.d / 2, 0.6, 0.6, 0.1); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, o.d / 2 - 0.35, 0.3, 0, 7); ctx.fillStyle = '#9c7a55'; ctx.fill(); ctx.stroke();
    },
  },
  fountain: {
    label: 'Fountain', kind: 'rect', z2d: 6, uniform: true,
    props: [...POS, len('w', 'Diameter'), H],
    draw2d(ctx, o, P) { ctx.beginPath(); ctx.arc(0, 0, o.w / 2, 0, 7); ctx.fillStyle = '#d9d3c7'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, o.w / 2 - 0.15, 0, 7); ctx.fillStyle = '#5cc4e6'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, o.w * 0.15, 0, 7); ctx.fillStyle = '#d9d3c7'; ctx.fill(); },
  },
  rocks: {
    label: 'Garden rocks', kind: 'rect', z2d: 6,
    props: [...POS, W, D, H],
    draw2d(ctx, o, P) { const rnd = seeded(seedOf(o)); ctx.fillStyle = '#9a958c'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse((rnd() - 0.5) * o.w * 0.7, (rnd() - 0.5) * o.d * 0.7, o.w * (0.12 + rnd() * 0.12), o.d * (0.12 + rnd() * 0.12), rnd() * 3, 0, 7); ctx.fill(); } },
  },
};
const PAPER_HATCH = '#fbfaf7';

// ---------------------------------------------------------------- fixtures & services (simple architectural symbols)
const fx = (label, extra, draw, z2d = 3) => ({ label, kind: 'rect', z2d, props: [...POS, ELEV, W, D, ...extra], draw2d: draw });
const outline = (ctx, o, P, fill = '#fff') => { rr(ctx, -o.w / 2, -o.d / 2, o.w, o.d, 0.04); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke(); };
Object.assign(TYPES, {
  wc: fx('WC (toilet)', [select('style', 'Type', [['western', 'Western (EWC)'], ['indian', 'Indian (IWC)']])], (ctx, o, P) => {
    ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.fillStyle = '#fff';
    if (o.style === 'indian') { outline(ctx, o, P); ctx.beginPath(); ctx.ellipse(0, 0.05, o.w * 0.25, o.d * 0.3, 0, 0, 7); ctx.stroke(); return; }
    ctx.fillRect(-o.w / 2, -o.d / 2, o.w, o.d * 0.28); ctx.strokeRect(-o.w / 2, -o.d / 2, o.w, o.d * 0.28);
    ctx.beginPath(); ctx.ellipse(0, o.d * 0.12, o.w * 0.4, o.d * 0.36, 0, 0, 7); ctx.fill(); ctx.stroke();
    txt(ctx, P, 'WC', 0, o.d * 0.12, 8, '#475569', 700);
  }),
  basin: fx('Wash basin', [select('style', 'Type', [['wall', 'Wall-hung'], ['counter', 'Vanity counter']])], (ctx, o, P) => {
    outline(ctx, o, P, o.style === 'counter' ? '#e9e6e1' : '#fff');
    ctx.beginPath(); ctx.ellipse(0, 0.03, Math.min(o.w, 0.6) * 0.38, o.d * 0.32, 0, 0, 7); ctx.strokeStyle = LINE; ctx.stroke();
  }),
  shower: fx('Shower area', [bool('glass', 'Glass partition')], (ctx, o, P) => {
    outline(ctx, o, P, '#eef4f7');
    ctx.strokeStyle = 'rgba(59,66,80,.5)'; ctx.beginPath(); ctx.moveTo(-o.w / 2, -o.d / 2); ctx.lineTo(o.w / 2, o.d / 2); ctx.moveTo(o.w / 2, -o.d / 2); ctx.lineTo(-o.w / 2, o.d / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 0.05, 0, 7); ctx.fillStyle = LINE; ctx.fill();
    if (o.glass) { ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2 * P; ctx.beginPath(); ctx.moveTo(-o.w / 2, o.d / 2); ctx.lineTo(o.w / 2, o.d / 2); ctx.stroke(); }
  }),
  bathtub: fx('Bathtub', [], (ctx, o, P) => { outline(ctx, o, P); rr(ctx, -o.w / 2 + 0.08, -o.d / 2 + 0.08, o.w - 0.16, o.d - 0.16, 0.25); ctx.strokeStyle = LINE; ctx.stroke(); }),
  washer: fx('Washing machine', [], (ctx, o, P) => { outline(ctx, o, P); ctx.beginPath(); ctx.arc(0, 0.03, Math.min(o.w, o.d) * 0.32, 0, 7); ctx.stroke(); }),
  wardrobe: fx('Wardrobe', [H, bool('sliding', 'Sliding doors'), color('color', 'Colour')], (ctx, o, P) => {
    outline(ctx, o, P, '#efe7da');
    if (o.sliding) { ctx.strokeStyle = 'rgba(59,66,80,.6)'; ctx.beginPath(); ctx.moveTo(-o.w / 2, o.d / 2 - 0.06); ctx.lineTo(0.05, o.d / 2 - 0.06); ctx.moveTo(-0.05, o.d / 2 - 0.12); ctx.lineTo(o.w / 2, o.d / 2 - 0.12); ctx.stroke(); return; }
    ctx.strokeStyle = 'rgba(59,66,80,.5)'; ctx.beginPath(); ctx.moveTo(-o.w / 2, -o.d / 2); ctx.lineTo(o.w / 2, o.d / 2); ctx.moveTo(-o.w / 2, o.d / 2); ctx.lineTo(o.w / 2, -o.d / 2); ctx.stroke();
  }),
  tvunit: fx('TV unit', [color('color', 'Colour')], (ctx, o, P) => { outline(ctx, o, P, '#d9cbb6'); ctx.fillStyle = '#1f2937'; ctx.fillRect(-o.w * 0.35, -o.d / 2, o.w * 0.7, 0.05); }),
  desk: fx('Study desk', [color('color', 'Colour')], (ctx, o, P) => { outline(ctx, o, P, '#d6b88f'); rr(ctx, -0.22, o.d / 2 + 0.05, 0.44, 0.44, 0.08); ctx.fillStyle = '#cbd5e1'; ctx.fill(); ctx.stroke(); }),
  bookshelf: fx('Bookshelf', [H, color('color', 'Colour')], (ctx, o, P) => { outline(ctx, o, P, '#c9a27c'); hLines(ctx, { w: o.w, d: o.d }, P, o.d / 3, 'rgba(0,0,0,.3)'); }),
  pooja: fx('Pooja unit (mandir)', [H, color('color', 'Wood colour')], (ctx, o, P) => {
    outline(ctx, o, P, '#e8c98e');
    ctx.strokeStyle = '#7c4a1e'; ctx.beginPath(); ctx.moveTo(-o.w * 0.3, o.d / 2); ctx.lineTo(-o.w * 0.3, 0); ctx.quadraticCurveTo(0, -o.d * 0.4, o.w * 0.3, 0); ctx.lineTo(o.w * 0.3, o.d / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, o.d * 0.15, 0.05, 0, 7); ctx.fillStyle = '#f59e0b'; ctx.fill();
  }),
  fridge: fx('Refrigerator', [], (ctx, o, P) => { outline(ctx, o, P, '#f1f5f9'); txt(ctx, P, 'REF', 0, 0, 8, '#475569', 700); }),
  island: fx('Kitchen island', [color('color', 'Cabinet colour')], (ctx, o, P) => { outline(ctx, o, P, '#e9e6e1'); for (const x of [-o.w / 3, 0, o.w / 3]) { ctx.beginPath(); ctx.arc(x, o.d / 2 + 0.22, 0.17, 0, 7); ctx.stroke(); } }),
  armchair: fx('Armchair', [color('color', 'Fabric')], (ctx, o, P) => { rr(ctx, -o.w / 2, -o.d / 2, o.w, o.d, 0.1); ctx.fillStyle = o.color; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke(); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(-o.w / 2, -o.d / 2, o.w, 0.18); }),
  rug: fx('Rug', [color('color', 'Colour')], (ctx, o, P) => { rr(ctx, -o.w / 2, -o.d / 2, o.w, o.d, 0.05); ctx.fillStyle = o.color; ctx.globalAlpha *= 0.7; ctx.fill(); ctx.globalAlpha /= 0.7; ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = P; ctx.stroke(); }, 2),
  nightstand: fx('Bedside table', [color('color', 'Colour')], (ctx, o, P) => { outline(ctx, o, P, '#d9c3a5'); ctx.beginPath(); ctx.arc(0, 0, Math.min(o.w, o.d) * 0.22, 0, 7); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.stroke(); }),
  dressing: fx('Dressing table', [color('color', 'Colour')], (ctx, o, P) => {
    outline(ctx, o, P, '#e2cfb2');
    ctx.fillStyle = '#c9d6df'; ctx.fillRect(-o.w * 0.3, -o.d / 2, o.w * 0.6, 0.04);
    rr(ctx, -0.2, o.d / 2 + 0.06, 0.4, 0.34, 0.12); ctx.fillStyle = '#e5e0d6'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke();
  }),
  cot: fx('Baby cot', [color('color', 'Colour')], (ctx, o, P) => {
    outline(ctx, o, P, o.color);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.beginPath();
    for (let x = -o.w / 2 + 0.08; x < o.w / 2; x += 0.08) { ctx.moveTo(x, -o.d / 2); ctx.lineTo(x, -o.d / 2 + 0.05); ctx.moveTo(x, o.d / 2); ctx.lineTo(x, o.d / 2 - 0.05); }
    ctx.stroke(); rr(ctx, -o.w / 2 + 0.08, -o.d / 2 + 0.1, o.w - 0.16, 0.25, 0.06); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  }),
  coffeetable: fx('Coffee table', [color('color', 'Colour')], (ctx, o, P) => { rr(ctx, -o.w / 2, -o.d / 2, o.w, o.d, 0.08); ctx.fillStyle = '#c7a37c'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke(); rr(ctx, -o.w / 2 + 0.06, -o.d / 2 + 0.06, o.w - 0.12, o.d - 0.12, 0.05); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke(); }),
  shoerack: fx('Shoe rack', [color('color', 'Colour')], (ctx, o, P) => { outline(ctx, o, P, '#d6c0a2'); hLines(ctx, { w: o.w, d: o.d }, P, o.d / 2, 'rgba(0,0,0,.3)'); }),
  floorlamp: fx('Floor lamp', [color('color', 'Shade colour')], (ctx, o, P) => {
    ctx.beginPath(); ctx.arc(0, 0, o.w / 2, 0, 7); ctx.fillStyle = o.color; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 0.04, 0, 7); ctx.fillStyle = '#f59e0b'; ctx.fill();
  }, 6),
  // Ramp: run = rise × ratio; arrow points up the slope (to the back, −y), handrails on both sides.
  ramp: { label: 'Ramp', kind: 'rect', z2d: 1.5,
    props: [...POS, len('w', 'Width'), len('d', 'Length (run)'), len('h', 'Rise', { min: 0.02 }), num('ratio', 'Slope 1 :', { min: 4, max: 20, step: 1 }),
      { key: 'slopeInfo', label: 'Slope', kind: 'info', get: (o) => `1:${(o.d / Math.max(0.01, o.h)).toFixed(1)} · ${((Math.atan(o.h / Math.max(0.01, o.d)) * 180) / Math.PI).toFixed(1)}°${o.d / o.h < 12 && o.rails ? ' ⚠ steeper than 1:12 for wheelchairs' : ''}` },
      bool('rails', 'Handrails'), select('finish', 'Finish', [['concrete', 'Concrete'], ['flagstone', 'Stone'], ['pavers', 'Pavers'], ['tile', 'Anti-skid tile']])],
    draw2d(ctx, o, P) {
      outline(ctx, o, P, '#e7e2d8');
      ctx.strokeStyle = 'rgba(59,66,80,.55)'; ctx.lineWidth = P;
      ctx.beginPath(); ctx.moveTo(0, o.d / 2 - 0.2); ctx.lineTo(0, -o.d / 2 + 0.25); ctx.moveTo(-0.15, -o.d / 2 + 0.45); ctx.lineTo(0, -o.d / 2 + 0.25); ctx.lineTo(0.15, -o.d / 2 + 0.45); ctx.stroke();
      if (o.rails) { ctx.strokeStyle = '#334155'; ctx.lineWidth = 2 * P; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * (o.w / 2 - 0.05), -o.d / 2); ctx.lineTo(s * (o.w / 2 - 0.05), o.d / 2); ctx.stroke(); } }
      txt(ctx, P, `UP 1:${(o.d / Math.max(0.01, o.h)).toFixed(0)}`, 0.0, 0.1, 8, '#334155', 700);
    } },
  // Steps up to a sit-out: straight, semicircular or on three sides; risers about 15 cm, treads 30 cm.
  steps: { label: 'Sit-out steps', kind: 'rect', z2d: 1.6,
    props: [...POS, len('w', 'Width'), len('d', 'Depth'), len('h', 'Total rise', { min: 0.05 }),
      { key: 'stepInfo', label: 'Steps', kind: 'info', get: (o) => { const n = stepCount(o); return `${n} steps · riser ${(o.h / n * 100).toFixed(1)} cm`; } },
      select('style', 'Shape', [['straight', 'Straight'], ['round', 'Semicircular'], ['wrap', 'Three-sided']]), bool('cheeks', 'Side walls'),
      select('finish', 'Finish', [['stone', 'Stone'], ['marble', 'Granite / marble'], ['laterite', 'Laterite'], ['concrete', 'Concrete'], ['tile', 'Tile'], ['brick', 'Brick']])],
    draw2d(ctx, o, P) {
      const n = stepCount(o), { w, d } = o;
      ctx.fillStyle = '#ece6da'; ctx.strokeStyle = LINE; ctx.lineWidth = P;
      ctx.beginPath();
      if (o.style === 'round') { const R = Math.min(w / 2, d); ctx.arc(0, -d / 2, R, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
        for (let k = 1; k < n; k++) { ctx.beginPath(); ctx.arc(0, -d / 2, R - (k * R) / n, 0, Math.PI); ctx.stroke(); } }
      else if (o.style === 'wrap') { ctx.rect(-w / 2, -d / 2, w, d); ctx.fill(); ctx.stroke(); const t = Math.min(d, w / 2) / n;
        for (let k = 1; k < n; k++) { ctx.beginPath(); ctx.moveTo(-w / 2 + k * t, -d / 2); ctx.lineTo(-w / 2 + k * t, d / 2 - k * t); ctx.lineTo(w / 2 - k * t, d / 2 - k * t); ctx.lineTo(w / 2 - k * t, -d / 2); ctx.stroke(); } }
      else { ctx.rect(-w / 2, -d / 2, w, d); ctx.fill(); ctx.stroke(); ctx.beginPath(); for (let k = 1; k < n; k++) { const y = d / 2 - (k * d) / n; ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); } ctx.stroke();
        if (o.cheeks) { ctx.fillStyle = '#c9a68f'; ctx.fillRect(-w / 2 - 0.15, -d / 2, 0.15, d); ctx.fillRect(w / 2, -d / 2, 0.15, d); } }
      ctx.strokeStyle = 'rgba(59,66,80,.6)'; ctx.beginPath(); ctx.moveTo(0, d / 2 - 0.08); ctx.lineTo(0, -d / 2 + 0.12); ctx.moveTo(-0.1, -d / 2 + 0.26); ctx.lineTo(0, -d / 2 + 0.12); ctx.lineTo(0.1, -d / 2 + 0.26); ctx.stroke();
    } },
  watertank: fx('Overhead water tank', [H, num('litres', 'Capacity (litres)', { min: 100, step: 100 })], (ctx, o, P) => {
    ctx.beginPath(); ctx.ellipse(0, 0, o.w / 2, o.d / 2, 0, 0, 7); ctx.fillStyle = '#e2e8f0'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke();
    txt(ctx, P, 'OHT', 0, 0, 8, '#334155', 700);
  }, 9),
  solar: fx('Solar panels', [num('tilt', 'Tilt °', { min: 0, max: 45, step: 1 })], (ctx, o, P) => { outline(ctx, o, P, '#1e3a8a'); gridLines(ctx, o, P, 0.5, 'rgba(255,255,255,.5)'); }, 9),
  septic: fx('Septic tank', [], (ctx, o, P) => { ctx.setLineDash([5 * P, 4 * P]); ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.2 * P; ctx.strokeRect(-o.w / 2, -o.d / 2, o.w, o.d); ctx.setLineDash([]); txt(ctx, P, 'SEPTIC TANK', 0, 0, 8, '#475569', 700); }, 0.4),
  well: fx('Open well (kinar)', [H], (ctx, o, P) => {
    ctx.beginPath(); ctx.arc(0, 0, o.w / 2, 0, 7); ctx.fillStyle = '#c9a68f'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = P; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, o.w / 2 - 0.25, 0, 7); ctx.fillStyle = '#2f5d73'; ctx.fill();
  }, 6),
  acunit: fx('AC outdoor unit', [], (ctx, o, P) => { outline(ctx, o, P, '#f1f5f9'); ctx.beginPath(); ctx.arc(o.w * 0.15, 0, Math.min(o.w, o.d) * 0.35, 0, 7); ctx.stroke(); }, 6),
});
for (const t of ['watertank', 'well', 'floorlamp']) TYPES[t].uniform = true;

// risers close to 15 cm
export const stepCount = (o) => Math.max(1, Math.round((o.h || 0.45) / 0.15));

// Fittings of a room preset placed inside the rectangle x0..x1 × y0..y1 (world metres).
export function presetItems(key, x0, y0, x1, y1, level, inset = 0.15) {
  const preset = ROOM_PRESETS[key], W = x1 - x0, Dd = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return (preset?.items || []).map((it) => {
    const r = it.rot || 0, ew = r % 180 ? it.d : it.w, ed = r % 180 ? it.w : it.d;
    const { ax, ay, ...props } = it;
    return { id: uid(), level, z: 0, ...props, rot: r,
      x: +(cx + ax * Math.max(0, W / 2 - inset - ew / 2)).toFixed(3), y: +(cy + ay * Math.max(0, Dd / 2 - inset - ed / 2)).toFixed(3) };
  });
}

// ---------------------------------------------------------------- room presets
// Fittings are anchored inside the room: ax/ay = -1 (left/top wall), 0 (centre), 1 (right/bottom wall).
export const ROOM_PRESETS = {
  living: { label: 'Living room', w: 5, d: 4.2, finish: 'wood', door: 1.0, items: [
    // sofa and TV face each other across the side walls so the entrance stays clear
    { type: 'sofa', w: 2.4, d: 0.95, ax: -1, ay: 0, rot: 270, color: '#7d8a99' }, { type: 'tvunit', w: 1.8, d: 0.45, ax: 1, ay: 0, rot: 90, color: '#8a6a4a' },
    { type: 'armchair', w: 0.85, d: 0.85, ax: -0.55, ay: -1, color: '#b4a58c' }, { type: 'rug', w: 1.6, d: 2.4, ax: 0, ay: 0, color: '#9c7a55' }] },
  dining: { label: 'Dining room', w: 4, d: 3.6, finish: 'tile', door: 1.0, items: [
    { type: 'table', w: 1.8, d: 0.9, ax: 0, ay: 0, color: '#9c6b3f' }, { type: 'basin', w: 0.6, d: 0.45, ax: 1, ay: -1, style: 'counter' }] },
  kitchen: { label: 'Kitchen', w: 3.6, d: 3, finish: 'tile', door: 0.9, items: [
    { type: 'kitchen', w: 3.0, d: 0.62, ax: 0, ay: -1, color: '#f2f0eb' }, { type: 'fridge', w: 0.75, d: 0.7, ax: 1, ay: 1 }] },
  toilet: { label: 'Toilet / bath', w: 2.4, d: 1.8, finish: 'tile', color: '#e7eef2', door: 0.75, items: [
    { type: 'wc', w: 0.42, d: 0.68, ax: -1, ay: -1, style: 'western' }, { type: 'basin', w: 0.55, d: 0.45, ax: 0, ay: -1, style: 'wall' },
    { type: 'shower', w: 0.9, d: 0.9, ax: 1, ay: -1, glass: true }] },
  attached: { label: 'Attached toilet', w: 2.6, d: 1.6, finish: 'tile', color: '#eef0ec', door: 0.75, items: [
    { type: 'wc', w: 0.42, d: 0.68, ax: -1, ay: -1, style: 'western' }, { type: 'basin', w: 0.9, d: 0.5, ax: 0, ay: -1, style: 'counter' },
    { type: 'shower', w: 0.9, d: 0.9, ax: 1, ay: -1, glass: true }] },
  pooja: { label: 'Pooja room', w: 1.6, d: 1.6, finish: 'marble', door: 0.9, doubleDoor: true, items: [
    { type: 'pooja', w: 1.1, d: 0.5, h: 1.8, ax: 0, ay: -1, color: '#8a5a33' }] },
  bedroom: { label: 'Bedroom', w: 3.6, d: 3.6, finish: 'wood', door: 0.9, items: [
    { type: 'bed', w: 1.6, d: 2.1, ax: 0, ay: -1, color: '#4a6b8a' }, { type: 'wardrobe', w: 1.8, d: 0.6, h: 2.1, ax: 1, ay: -1, rot: 90, color: '#c8b8a2' }] },
  master: { label: 'Master bedroom', w: 4.2, d: 4.2, finish: 'wood', door: 1.0, items: [
    { type: 'bed', w: 1.8, d: 2.1, ax: 0, ay: -1, color: '#6a4a3a' }, { type: 'wardrobe', w: 1.8, d: 0.6, h: 2.1, ax: 1, ay: -1, rot: 90, color: '#c8b8a2' },
    { type: 'armchair', w: 0.8, d: 0.8, ax: -1, ay: 1, color: '#b4a58c' }, { type: 'rug', w: 1.6, d: 1.0, ax: 0, ay: 0.4, color: '#c2a58a' }] },
  study: { label: 'Study', w: 3, d: 3, finish: 'wood', door: 0.9, items: [
    { type: 'desk', w: 1.4, d: 0.7, ax: 0, ay: -1, color: '#b48a5e' }, { type: 'bookshelf', w: 1.6, d: 0.35, h: 2.0, ax: 1, ay: 0, rot: 90, color: '#8a6a4a' }] },
  utility: { label: 'Work area / utility', w: 2.6, d: 2, finish: 'tile', door: 0.9, items: [
    { type: 'washer', w: 0.6, d: 0.6, ax: -1, ay: -1 }, { type: 'basin', w: 0.9, d: 0.55, ax: 1, ay: -1, style: 'counter' }] },
  store: { label: 'Store room', w: 2, d: 1.8, finish: 'concrete', door: 0.8, items: [
    { type: 'bookshelf', w: 1.6, d: 0.45, h: 2.1, ax: 0, ay: -1, color: '#9a958c' }] },
};

export function carportPosts(o) {
  const ix = o.w / 2 - 0.15, iz = o.d / 2 - 0.15, pts = [];
  const nz = o.d > 5.5 ? 2 : 1;
  for (let i = 0; i <= nz; i++) { const z = -iz + (i * 2 * iz) / nz; pts.push([-ix, z], [ix, z]); }
  return pts;
}

// ---------------------------------------------------------------- palette
export const CATALOG = [
  { id: 'structure', label: 'Walls & Structure', items: [
    { key: 'wall-ext', label: 'Exterior wall', icon: 'wallExt', tool: 'wall', wallKind: 'exterior', hint: 'Click to start, click to add corners, double-click to finish' },
    { key: 'wall-curve', label: 'Curved wall', icon: 'wallCurve', tool: 'wall', wallKind: 'exterior', curve: true, hint: 'Click the start, click the end, then move to bend and click to place · Shift = free angle' },
    { key: 'wall-int', label: 'Interior wall', icon: 'wallInt', tool: 'wall', wallKind: 'interior', hint: 'Click to start, click to add corners, double-click to finish' },
    { key: 'room', label: 'Room', icon: 'room', tool: 'room', hint: 'Drag a rectangle to create four walls and a floor' },
    { key: 'floor', label: 'Floor', icon: 'floor', make: () => ({ type: 'floor', w: 4, d: 4, finish: 'wood', color: '#ffffff' }) },
    { key: 'roof-gable', label: 'Gable roof', icon: 'roofGable', make: () => ({ type: 'roof', style: 'gable', w: 10, d: 8, pitch: 30, overhang: 0.5, finish: 'shingles', color: '#6b6f76', gableColor: '#efe8dc', z: 3 }) },
    { key: 'roof-hip', label: 'Hip roof', icon: 'roofHip', make: () => ({ type: 'roof', style: 'hip', w: 10, d: 8, pitch: 25, overhang: 0.6, finish: 'clay', color: '#b9583a', gableColor: '#efe8dc', z: 3 }) },
    { key: 'roof-kerala', label: 'Kerala roof', icon: 'roofKerala', make: () => ({ type: 'roof', style: 'kerala', w: 10, d: 8, pitch: 35, overhang: 0.75, finish: 'clay', color: '#b9583a', gableColor: '#5a3a22', z: 3 }) },
    { key: 'roof-flat', label: 'Flat roof', icon: 'roofFlat', make: () => ({ type: 'roof', style: 'flat', w: 10, d: 8, pitch: 20, overhang: 0.3, finish: 'concrete', color: '#cfcac2', gableColor: '#efe8dc', z: 3 }) },
    { key: 'column', label: 'Column', icon: 'column', make: () => ({ type: 'column', w: 0.35, d: 0.35, h: 3, shape: 'round', color: '#f3efe7' }) },
    { key: 'dimension', label: 'Dimension line', icon: 'measure', tool: 'dimension', hint: 'Click two points to add a permanent dimension line' },
    { key: 'guide', label: 'Guide line', icon: 'guide', tool: 'guide', hint: 'Click two points to lay a guide line · walls snap to guides and their crossings' },
    { key: 'guide-grid', label: 'Guide grid', icon: 'guideGrid', action: 'guideGrid', hint: 'Lay out a grid of guide lines (A, B, C… × 1, 2, 3…) at set spacings' },
  ] },
  { id: 'rooms', label: 'Rooms (furnished)', items: Object.entries({ living: 'sofa', dining: 'table', kitchen: 'kitchen', toilet: 'wc', attached: 'wc', pooja: 'pooja', bedroom: 'bed', master: 'bed', study: 'desk', utility: 'washer', store: 'room' })
    .map(([k, icon]) => ({ key: `room-${k}`, label: ROOM_PRESETS[k].label, icon, tool: 'room', preset: k, hint: `Drag the ${ROOM_PRESETS[k].label.toLowerCase()} in the plan, or click once for the standard ${ROOM_PRESETS[k].w} × ${ROOM_PRESETS[k].d} m size` })) },
  { id: 'bath', label: 'Toilet & Bath Fittings', items: [
    { key: 'wc', label: 'Western WC', icon: 'wc', make: () => ({ type: 'wc', w: 0.42, d: 0.68, style: 'western' }) },
    { key: 'wc-indian', label: 'Indian WC', icon: 'wc', make: () => ({ type: 'wc', w: 0.5, d: 0.8, style: 'indian' }) },
    { key: 'basin', label: 'Wash basin', icon: 'basin', make: () => ({ type: 'basin', w: 0.55, d: 0.45, style: 'wall' }) },
    { key: 'vanity', label: 'Vanity counter', icon: 'basin', make: () => ({ type: 'basin', w: 1.0, d: 0.5, style: 'counter' }) },
    { key: 'shower', label: 'Shower area', icon: 'shower', make: () => ({ type: 'shower', w: 0.9, d: 0.9, glass: true }) },
    { key: 'bathtub', label: 'Bathtub', icon: 'bathtub', make: () => ({ type: 'bathtub', w: 1.7, d: 0.75 }) },
    { key: 'washer', label: 'Washing machine', icon: 'washer', make: () => ({ type: 'washer', w: 0.6, d: 0.6 }) },
  ] },
  // Free-standing furniture: place it anywhere and resize it, independent of the furnished room presets.
  { id: 'bedroom', label: 'Bedroom Furniture', items: [
    { key: 'bed-single', label: 'Single bed', icon: 'bed', make: () => ({ type: 'bed', w: 0.95, d: 1.95, color: '#5b7a99' }) },
    { key: 'bed-double', label: 'Double bed', icon: 'bed', make: () => ({ type: 'bed', w: 1.4, d: 1.95, color: '#4a6b8a' }) },
    { key: 'bed-queen', label: 'Queen bed', icon: 'bed', make: () => ({ type: 'bed', w: 1.6, d: 2.05, color: '#7a5c48' }) },
    { key: 'bed', label: 'King / master bed', icon: 'bed', make: () => ({ type: 'bed', w: 1.85, d: 2.1, color: '#6a4a3a' }) },
    { key: 'cot', label: 'Baby cot', icon: 'bed', make: () => ({ type: 'cot', w: 0.7, d: 1.3, color: '#f3ede3' }) },
    { key: 'nightstand', label: 'Bedside table', icon: 'nightstand', make: () => ({ type: 'nightstand', w: 0.45, d: 0.4, color: '#8a6a4a' }) },
    { key: 'wardrobe-2', label: 'Wardrobe 2-door', icon: 'wardrobe', make: () => ({ type: 'wardrobe', w: 1.2, d: 0.6, h: 2.1, color: '#c8b8a2' }) },
    { key: 'wardrobe', label: 'Wardrobe 3-door', icon: 'wardrobe', make: () => ({ type: 'wardrobe', w: 1.8, d: 0.6, h: 2.1, color: '#c8b8a2' }) },
    { key: 'wardrobe-slide', label: 'Sliding wardrobe', icon: 'wardrobe', make: () => ({ type: 'wardrobe', w: 2.4, d: 0.65, h: 2.4, color: '#e8e2d8', sliding: true }) },
    { key: 'dressing', label: 'Dressing table', icon: 'dressing', make: () => ({ type: 'dressing', w: 1.0, d: 0.45, color: '#b48a5e' }) },
    { key: 'desk', label: 'Study desk', icon: 'desk', make: () => ({ type: 'desk', w: 1.2, d: 0.6, color: '#b48a5e' }) },
    { key: 'bookshelf', label: 'Bookshelf', icon: 'bookshelf', make: () => ({ type: 'bookshelf', w: 1.0, d: 0.35, h: 2.0, color: '#8a6a4a' }) },
  ] },
  { id: 'living', label: 'Living Room Furniture', items: [
    { key: 'sofa', label: 'Sofa 3-seater', icon: 'sofa', make: () => ({ type: 'sofa', w: 2.1, d: 0.9, color: '#7d8a99' }) },
    { key: 'sofa-2', label: 'Sofa 2-seater', icon: 'sofa', make: () => ({ type: 'sofa', w: 1.5, d: 0.9, color: '#8a7d6b' }) },
    { key: 'sofa-l', label: 'L-shaped sofa', icon: 'sofaL', make: () => ({ type: 'sofa', shape: 'lshape', w: 2.6, d: 1.7, color: '#6b7684' }) },
    { key: 'armchair', label: 'Armchair', icon: 'sofa', make: () => ({ type: 'armchair', w: 0.85, d: 0.85, color: '#b4a58c' }) },
    { key: 'coffeetable', label: 'Coffee table', icon: 'coffeetable', make: () => ({ type: 'coffeetable', w: 1.1, d: 0.6, color: '#8a6a4a' }) },
    { key: 'tvunit', label: 'TV unit', icon: 'tvunit', make: () => ({ type: 'tvunit', w: 1.8, d: 0.45, color: '#8a6a4a' }) },
    { key: 'rug', label: 'Rug', icon: 'floor', make: () => ({ type: 'rug', w: 2.4, d: 1.6, color: '#9c7a55' }) },
    { key: 'floorlamp', label: 'Floor lamp', icon: 'floorlamp', make: () => ({ type: 'floorlamp', w: 0.4, d: 0.4, color: '#f1e6cf' }) },
    { key: 'shoerack', label: 'Shoe rack', icon: 'bookshelf', make: () => ({ type: 'shoerack', w: 0.9, d: 0.35, color: '#9a7b5b' }) },
    { key: 'pooja', label: 'Pooja unit', icon: 'pooja', make: () => ({ type: 'pooja', w: 1.1, d: 0.5, h: 1.8, color: '#8a5a33' }) },
  ] },
  { id: 'dining', label: 'Dining & Kitchen', items: [
    { key: 'dining4', label: 'Dining (4 seat)', icon: 'table', make: () => ({ type: 'table', w: 1.2, d: 0.8, color: '#7a5230' }) },
    { key: 'dining6', label: 'Dining (6 seat)', icon: 'table', make: () => ({ type: 'table', w: 1.8, d: 0.9, color: '#9c6b3f' }) },
    { key: 'dining8', label: 'Dining (8 seat)', icon: 'table', make: () => ({ type: 'table', w: 2.4, d: 1.0, color: '#6b4528' }) },
    { key: 'fridge', label: 'Fridge single door', icon: 'fridge', make: () => ({ type: 'fridge', w: 0.65, d: 0.68 }) },
    { key: 'fridge-double', label: 'Fridge double door', icon: 'fridge', make: () => ({ type: 'fridge', w: 0.92, d: 0.75 }) },
    { key: 'kitchen', label: 'Kitchen counter', icon: 'kitchen', make: () => ({ type: 'kitchen', w: 3, d: 0.62, color: '#f2f0eb' }) },
    { key: 'island', label: 'Kitchen island', icon: 'kitchen', make: () => ({ type: 'island', w: 1.8, d: 0.9, color: '#f2f0eb' }) },
  ] },
  { id: 'services', label: 'Services & Utilities', items: [
    { key: 'watertank', label: 'Water tank (OHT)', icon: 'watertank', make: () => ({ type: 'watertank', w: 1.3, d: 1.3, h: 1.3, litres: 1500, z: 6 }) },
    { key: 'solar', label: 'Solar panels', icon: 'solar', make: () => ({ type: 'solar', w: 4, d: 2, tilt: 12, z: 6 }) },
    { key: 'septic', label: 'Septic tank', icon: 'septic', make: () => ({ type: 'septic', w: 2.4, d: 1.2 }) },
    { key: 'well', label: 'Open well', icon: 'well', make: () => ({ type: 'well', w: 2, d: 2, h: 0.9 }) },
    { key: 'acunit', label: 'AC outdoor unit', icon: 'acunit', make: () => ({ type: 'acunit', w: 0.8, d: 0.3 }) },
  ] },
  { id: 'floors', label: 'Floors & Shapes', items: [
    { key: 'floor-custom', label: 'Custom floor (edit every side)', icon: 'floorL', make: () => ({ type: 'floor', shape: 'custom', pts: [[-2.5, -2], [2.5, -2], [3, 2], [-2.5, 2]], w: 5.5, d: 4, finish: 'tile', color: '#ffffff' }) },
    { key: 'floor-skew', label: 'Skewed floor', icon: 'floorSkew', make: () => ({ type: 'floor', shape: 'parallelogram', skew: 20, w: 5, d: 4, finish: 'tile', color: '#ffffff' }) },
    { key: 'floor-trap', label: 'Trapezoid floor', icon: 'floorSkew', make: () => ({ type: 'floor', shape: 'trapezoid', skew: 20, w: 5, d: 4, finish: 'marble', color: '#ffffff' }) },
    { key: 'floor-l', label: 'L-shaped floor', icon: 'floorL', make: () => ({ type: 'floor', shape: 'lshape', w: 6, d: 6, finish: 'wood', color: '#ffffff' }) },
    { key: 'floor-hex', label: 'Hexagon deck', icon: 'floorHex', make: () => ({ type: 'floor', shape: 'hexagon', w: 4, d: 3.5, finish: 'deck', color: '#ffffff', z: 0.15 }) },
    { key: 'floor-round', label: 'Round patio', icon: 'floorHex', make: () => ({ type: 'paving', shape: 'circle', w: 4, d: 4, finish: 'pavers' }) },
    { key: 'ramp', label: 'Ramp', icon: 'ramp', make: () => ({ type: 'paving', w: 1.5, d: 5, slope: 5, finish: 'concrete' }) },
  ] },
  // Ramps and the steps up to a sit-out; their rise starts at the plinth height so they meet the floor
  { id: 'ramps', label: 'Ramps & Sit-out Steps', items: [
    { key: 'ramp-access', label: 'Wheelchair ramp 1:12', icon: 'rampA', make: () => ({ type: 'ramp', w: 1.2, d: 0, h: 0, ratio: 12, rails: true, finish: 'concrete' }) },
    { key: 'ramp-car', label: 'Car ramp 1:8', icon: 'rampA', make: () => ({ type: 'ramp', w: 3.0, d: 0, h: 0, ratio: 8, rails: false, finish: 'concrete' }) },
    { key: 'ramp-garden', label: 'Garden ramp', icon: 'rampA', make: () => ({ type: 'ramp', w: 1.5, d: 0, h: 0, ratio: 10, rails: false, finish: 'flagstone' }) },
    { key: 'steps-sitout', label: 'Sit-out steps', icon: 'stepsS', make: () => ({ type: 'steps', style: 'straight', w: 2.4, d: 0, h: 0, cheeks: false, finish: 'stone' }) },
    { key: 'steps-cheek', label: 'Steps with side walls', icon: 'stepsS', make: () => ({ type: 'steps', style: 'straight', w: 2.0, d: 0, h: 0, cheeks: true, finish: 'laterite' }) },
    { key: 'steps-wide', label: 'Wide granite steps', icon: 'stepsS', make: () => ({ type: 'steps', style: 'straight', w: 4.5, d: 0, h: 0, cheeks: false, finish: 'marble' }) },
    { key: 'steps-round', label: 'Semicircular steps', icon: 'stepsR', make: () => ({ type: 'steps', style: 'round', w: 3.2, d: 1.6, h: 0, cheeks: false, finish: 'stone' }) },
    { key: 'steps-wrap', label: 'Three-sided steps', icon: 'stepsW', make: () => ({ type: 'steps', style: 'wrap', w: 3.6, d: 0, h: 0, cheeks: false, finish: 'stone' }) },
  ] },
  { id: 'doors', label: 'Doors', items: [
    { key: 'door-single', label: 'Single door', icon: 'doorSingle', make: () => ({ type: 'door', style: 'single', width: 0.9, height: 2.1, open: 25, color: '#8a5a33', frameColor: '#f4f1ea' }) },
    { key: 'door-double', label: 'Double door', icon: 'doorDouble', make: () => ({ type: 'door', style: 'double', width: 1.6, height: 2.3, open: 20, color: '#5a3a22', frameColor: '#f4f1ea' }) },
    { key: 'door-sliding', label: 'Sliding glass door', icon: 'doorSliding', make: () => ({ type: 'door', style: 'sliding', width: 2.2, height: 2.2, open: 0, color: '#3a3f47', frameColor: '#3a3f47' }) },
    { key: 'door-garage', label: 'Garage door', icon: 'doorGarage', make: () => ({ type: 'door', style: 'garage', width: 2.6, height: 2.2, open: 0, color: '#e9e6df', frameColor: '#f4f1ea' }) },
    { key: 'door-arch', label: 'Archway', icon: 'archway', make: () => ({ type: 'door', style: 'arch', width: 1.4, height: 2.6, open: 0, color: '#ffffff', frameColor: '#f4f1ea' }) },
  ] },
  { id: 'windows', label: 'Windows', items: [
    { key: 'win-casement', label: 'Casement window', icon: 'winCasement', make: () => ({ type: 'window', style: 'casement', width: 1.2, height: 1.3, sill: 0.9, frameColor: '#f7f5f0' }) },
    { key: 'win-sliding', label: 'Sliding window', icon: 'winSliding', make: () => ({ type: 'window', style: 'sliding', width: 1.6, height: 1.2, sill: 0.9, frameColor: '#3a3f47' }) },
    { key: 'win-picture', label: 'Picture window', icon: 'winPicture', make: () => ({ type: 'window', style: 'picture', width: 2.2, height: 1.8, sill: 0.5, frameColor: '#2f343b' }) },
    { key: 'win-vent', label: 'Ventilator', icon: 'winVent', make: () => ({ type: 'window', style: 'vent', width: 0.6, height: 0.45, sill: 1.8, frameColor: '#f7f5f0' }) },
    { key: 'win-arched', label: 'Arched window', icon: 'winArched', make: () => ({ type: 'window', style: 'arched', width: 1.1, height: 1.8, sill: 0.8, frameColor: '#f7f5f0' }) },
    { key: 'win-shade', label: 'Window + sunshade', icon: 'winSliding', make: () => ({ type: 'window', style: 'sliding', width: 1.6, height: 1.3, sill: 0.9, shade: true, frameColor: '#3a3f47' }) },
  ] },
  { id: 'stairs', label: 'Stairs', items: [
    { key: 'stairs', label: 'Straight stairs', icon: 'stairs', tool: 'stairdraw', stairShape: 'straight', hint: 'Drag the stair area in the plan (or drag this card in)', make: () => ({ type: 'stairs', shape: 'straight', w: 1.0, d: 4.2, h: 3, flightW: 1, finish: 'wood', style: 'open', railing: true }) },
    { key: 'stairs-l', label: 'L-shaped stairs', icon: 'stairsL', tool: 'stairdraw', stairShape: 'lshape', hint: 'Drag the stair area in the plan', make: () => ({ type: 'stairs', shape: 'lshape', w: 3.2, d: 3.4, h: 3, flightW: 1, finish: 'marble', style: 'solid', railing: true }) },
    { key: 'stairs-w', label: 'Winder stairs', icon: 'stairsL', tool: 'stairdraw', stairShape: 'winder', hint: 'Drag the stair area in the plan', make: () => ({ type: 'stairs', shape: 'winder', w: 3.0, d: 3.2, h: 3, flightW: 1, finish: 'wood', style: 'solid', railing: true }) },
    { key: 'stairs-u', label: 'Dog-legged (U)', icon: 'stairsU', tool: 'stairdraw', stairShape: 'ushape', hint: 'Drag the stair area in the plan', make: () => ({ type: 'stairs', shape: 'ushape', w: 2.4, d: 3.6, h: 3, flightW: 1.15, finish: 'stone', style: 'solid', railing: true }) },
    { key: 'spiral', label: 'Spiral stairs', icon: 'spiral', make: () => ({ type: 'spiral', w: 2, d: 2, h: 3, color: '#3a3f47' }) },
  ] },
  { id: 'portico', label: 'Porticos & Porches', items: [
    { key: 'portico-kerala', label: 'Kerala sit-out', icon: 'porticoKerala', make: () => ({ type: 'portico', w: 4.6, d: 2.6, h: 2.7, columns: 4, style: 'kerala', column: 'wood', steps: true, charupadi: true, color: '#5a3a22', roofColor: '#b9583a' }) },
    { key: 'portico-kgable', label: 'Kerala gable porch', icon: 'porticoKerala', make: () => ({ type: 'portico', w: 3.6, d: 2.4, h: 2.8, columns: 2, style: 'kerala-gable', column: 'wood', steps: true, charupadi: true, color: '#5a3a22', roofColor: '#b9583a' }) },
    { key: 'portico', label: 'Classical portico', icon: 'portico', make: () => ({ type: 'portico', w: 4, d: 2.2, h: 3, columns: 4, style: 'pediment', column: 'classic', steps: true, color: '#f6f3ec', roofColor: '#6b6f76' }) },
    { key: 'portico-colonial', label: 'Colonial (2-storey)', icon: 'porticoColonial', make: () => ({ type: 'portico', w: 4.6, d: 2.6, h: 6, columns: 4, style: 'pediment', column: 'classic', steps: true, color: '#ffffff', roofColor: '#4b4f56' }) },
    { key: 'portico-arched', label: 'Arched arcade', icon: 'porticoArch', make: () => ({ type: 'portico', w: 5, d: 2.2, h: 3, columns: 4, style: 'arched', column: 'square', steps: true, color: '#efe6d6', roofColor: '#b9583a' }) },
    { key: 'portico-porch', label: 'Craftsman porch', icon: 'porchHip', make: () => ({ type: 'portico', w: 4.5, d: 2.2, h: 2.8, columns: 2, style: 'hip', column: 'craftsman', steps: true, color: '#f4f1ea', roofColor: '#5a4a42' }) },
    { key: 'portico-modern', label: 'Modern canopy', icon: 'canopy', make: () => ({ type: 'portico', w: 3.2, d: 1.8, h: 2.9, columns: 2, style: 'modern', column: 'steel', steps: false, color: '#2f343b', roofColor: '#e7e3dc' }) },
    { key: 'portico-balcony', label: 'Portico + balcony', icon: 'porticoBalcony', make: () => ({ type: 'portico', w: 4, d: 2.4, h: 3, columns: 3, style: 'balcony', column: 'square', steps: true, color: '#f6f3ec', roofColor: '#6b6f76' }) },
  ] },
  { id: 'gates', label: 'Front Gates & Boundary', items: [
    { key: 'gate-padippura', label: 'Kerala padippura', icon: 'gatePadippura', make: () => ({ type: 'gate', w: 4.2, d: 0.6, h: 2.1, style: 'padippura', open: 30, pillar: 'laterite', lamps: false, color: '#5a3a22' }) },
    { key: 'gate-iron', label: 'Wrought-iron gate', icon: 'gateIron', make: () => ({ type: 'gate', w: 4.4, d: 0.45, h: 1.8, style: 'iron', open: 0, pillar: 'brick', lamps: true, color: '#22252a' }) },
    { key: 'gate-arch', label: 'Arched iron gate', icon: 'gateArch', make: () => ({ type: 'gate', w: 4.4, d: 0.45, h: 1.9, style: 'arch', open: 0, pillar: 'stone', lamps: true, color: '#1f2328' }) },
    { key: 'gate-slide', label: 'Sliding gate', icon: 'gateSlide', make: () => ({ type: 'gate', w: 4.6, d: 0.45, h: 1.8, style: 'sliding', open: 0, pillar: 'plaster', lamps: false, color: '#3a3f47' }) },
    { key: 'gate-wood', label: 'Wooden gate', icon: 'gateWood', make: () => ({ type: 'gate', w: 3.8, d: 0.45, h: 1.8, style: 'wood', open: 0, pillar: 'brick', lamps: false, color: '#7a5230' }) },
    { key: 'gate-modern', label: 'Modern slat gate', icon: 'gateModern', make: () => ({ type: 'gate', w: 4.6, d: 0.45, h: 2.0, style: 'modern', open: 0, pillar: 'plaster', lamps: true, color: '#2f343b' }) },
    { key: 'gate-ped', label: 'Pedestrian gate', icon: 'gateIron', make: () => ({ type: 'gate', w: 2.0, d: 0.45, h: 1.6, style: 'iron', open: 0, pillar: 'brick', lamps: false, color: '#22252a' }) },
    { key: 'boundary', label: 'Boundary wall', icon: 'boundary', make: () => ({ type: 'boundary', w: 8, d: 0.23, h: 1.8, style: 'plaster', color: '#e9e2d4' }) },
    { key: 'boundary-rail', label: 'Wall + railing', icon: 'railWall', make: () => ({ type: 'boundary', w: 8, d: 0.23, h: 1.6, style: 'railing', color: '#e9e2d4' }) },
    { key: 'boundary-brick', label: 'Brick wall', icon: 'boundary', make: () => ({ type: 'boundary', w: 8, d: 0.23, h: 1.8, style: 'brick', color: '#ffffff' }) },
  ] },
  { id: 'facade', label: 'Facade & Elevation', items: [
    { key: 'balcony', label: 'Balcony', icon: 'balcony', make: () => ({ type: 'balcony', w: 3.5, d: 1.4, rail: 'glass', color: '#3a3f47' }) },
    { key: 'balcony-iron', label: 'Iron balcony', icon: 'balcony', make: () => ({ type: 'balcony', w: 3, d: 1.2, rail: 'iron', color: '#22252a' }) },
    { key: 'pergola', label: 'Pergola', icon: 'pergola', make: () => ({ type: 'pergola', w: 4, d: 3, h: 2.6, color: '#8a5a33' }) },
    { key: 'clad-stone', label: 'Stone cladding', icon: 'cladding', make: () => ({ type: 'cladding', w: 2.4, d: 0.05, h: 3, finish: 'stone', color: '#ffffff' }) },
    { key: 'clad-wood', label: 'Wood cladding', icon: 'cladding', make: () => ({ type: 'cladding', w: 2.4, d: 0.04, h: 3, finish: 'deck', color: '#ffffff' }) },
    { key: 'louvers', label: 'Vertical louvers', icon: 'louvers', make: () => ({ type: 'louvers', w: 2.4, d: 0.15, h: 2.8, gap: 0.15, dir: 'v', color: '#8a5a33' }) },
    { key: 'louvers-h', label: 'Horizontal slats', icon: 'louvers', make: () => ({ type: 'louvers', w: 2.4, d: 0.1, h: 2.4, gap: 0.12, dir: 'h', color: '#3a3f47' }) },
    { key: 'frame', label: 'Elevation frame', icon: 'frame', make: () => ({ type: 'frame', w: 3.4, d: 0.5, h: 3, band: 0.2, finish: 'concrete', color: '#3a3f47' }) },
    { key: 'chimney', label: 'Chimney', icon: 'chimney', make: () => ({ type: 'chimney', w: 0.9, d: 0.7, h: 7 }) },
  ] },
  { id: 'outdoor', label: 'Outdoor & Parking', items: [
    { key: 'gazebo', label: 'Gazebo', icon: 'gazebo', make: () => ({ type: 'gazebo', w: 4, d: 4, h: 2.4, sides: 8, color: '#f2ede4', roofColor: '#5d6168' }) },
    { key: 'carport', label: 'Carport / parking', icon: 'carport', make: () => ({ type: 'carport', w: 3.4, d: 6, h: 2.6, withCar: true, carColor: '#8a1c1c', color: '#3d4148', roofColor: '#9aa1a9' }) },
    { key: 'driveway', label: 'Driveway', icon: 'driveway', make: () => ({ type: 'paving', w: 3.4, d: 7, finish: 'asphalt' }) },
    { key: 'path', label: 'Garden path', icon: 'path', make: () => ({ type: 'paving', w: 1.2, d: 4, finish: 'flagstone' }) },
    { key: 'lawn', label: 'Lawn patch', icon: 'floor', make: () => ({ type: 'paving', w: 4, d: 4, finish: 'grass' }) },
    { key: 'car', label: 'Car', icon: 'car', make: () => ({ type: 'car', w: 4.5, d: 1.85, color: '#1d4e89' }) },
    { key: 'fence', label: 'Fence', icon: 'fence', make: () => ({ type: 'fence', w: 6, d: 0.12, h: 1.2, style: 'picket', color: '#f5f2ea' }) },
    { key: 'pool', label: 'Swimming pool', icon: 'pool', make: () => ({ type: 'pool', w: 7, d: 3.5, color: '#3fa7cf' }) },
    { key: 'tree', label: 'Tree', icon: 'tree', make: () => ({ type: 'tree', w: 4.5, d: 4.5, h: 6, variety: 'round' }) },
    { key: 'pine', label: 'Conifer', icon: 'pine', make: () => ({ type: 'tree', w: 3, d: 3, h: 7, variety: 'conifer' }) },
    { key: 'palm', label: 'Palm', icon: 'tree', make: () => ({ type: 'tree', w: 3.5, d: 3.5, h: 6.5, variety: 'palm' }) },
    { key: 'lamp', label: 'Lamp post', icon: 'lamp', make: () => ({ type: 'lamp', w: 0.4, d: 0.4, h: 2.6 }) },
  ] },
  { id: 'garden', label: 'Garden, Trees & Sit-outs', items: [
    { key: 'coconut', label: 'Coconut palm', icon: 'coconut', make: () => ({ type: 'tree', w: 5, d: 5, h: 10, variety: 'coconut' }) },
    { key: 'mango', label: 'Mango tree', icon: 'tree', make: () => ({ type: 'tree', w: 7, d: 7, h: 8, variety: 'mango' }) },
    { key: 'gulmohar', label: 'Gulmohar', icon: 'flowerTree', make: () => ({ type: 'tree', w: 6, d: 6, h: 7, variety: 'gulmohar' }) },
    { key: 'banana', label: 'Banana plant', icon: 'banana', make: () => ({ type: 'tree', w: 2.8, d: 2.8, h: 3.5, variety: 'banana' }) },
    { key: 'bamboo', label: 'Bamboo', icon: 'bamboo', make: () => ({ type: 'tree', w: 2, d: 2, h: 6, variety: 'bamboo' }) },
    { key: 'cypress', label: 'Cypress', icon: 'pine', make: () => ({ type: 'tree', w: 1.4, d: 1.4, h: 6, variety: 'cypress' }) },
    { key: 'shrub', label: 'Shrub', icon: 'shrub', make: () => ({ type: 'shrub', w: 1.1, d: 1.1, h: 0.9, color: '#4f7f3a' }) },
    { key: 'hedge', label: 'Hedge', icon: 'hedge', make: () => ({ type: 'hedge', w: 4, d: 0.6, h: 1.0, color: '#3f6b2e' }) },
    { key: 'flowerbed', label: 'Flower bed', icon: 'flowers', make: () => ({ type: 'flowerbed', w: 3, d: 1, shape: 'rect', color: 'mix', edge: 'brick' }) },
    { key: 'flowerbed-round', label: 'Round flower bed', icon: 'flowers', make: () => ({ type: 'flowerbed', w: 2.2, d: 2.2, shape: 'circle', color: '#d9354c', edge: 'stone' }) },
    { key: 'pot', label: 'Potted plant', icon: 'pot', make: () => ({ type: 'pot', w: 0.5, d: 0.5, h: 1.1, variety: 'leafy', color: '#b5653d' }) },
    { key: 'pot-palm', label: 'Areca palm pot', icon: 'pot', make: () => ({ type: 'pot', w: 0.6, d: 0.6, h: 1.8, variety: 'palm', color: '#e7e1d6' }) },
    { key: 'tulsi', label: 'Tulsi thara', icon: 'tulsi', make: () => ({ type: 'tulsi', w: 0.7, d: 0.7, h: 1.1, color: '#e9dcc2' }) },
    { key: 'sitout', label: 'Sit-out chairs', icon: 'sitout', make: () => ({ type: 'sitout', w: 2.2, d: 1.6, style: 'chairs', color: '#c9b28a' }) },
    { key: 'sitout-sofa', label: 'Outdoor sofa', icon: 'sofa', make: () => ({ type: 'sitout', w: 2.6, d: 1.8, style: 'sofa', color: '#e2d6bf' }) },
    { key: 'charupadi', label: 'Charupadi bench', icon: 'bench', make: () => ({ type: 'sitout', w: 2.4, d: 0.6, style: 'charupadi', color: '#7a5230' }) },
    { key: 'bench', label: 'Garden bench', icon: 'bench', make: () => ({ type: 'bench', w: 1.6, d: 0.6, color: '#8a5a33' }) },
    { key: 'swing', label: 'Swing (oonjal)', icon: 'swing', make: () => ({ type: 'swing', w: 2.2, d: 1.4, h: 2.4, style: 'frame', color: '#7a5230' }) },
    { key: 'fountain', label: 'Fountain', icon: 'fountain', make: () => ({ type: 'fountain', w: 2, d: 2, h: 1.4 }) },
    { key: 'rocks', label: 'Garden rocks', icon: 'rocks', make: () => ({ type: 'rocks', w: 1.6, d: 1.2, h: 0.6 }) },
  ] },
];

// Indoor / outdoor workspaces: which palette groups show, and which objects are editable.
const CAT_SCOPE = { structure: 'both', rooms: 'indoor', floors: 'both', doors: 'both', windows: 'both', stairs: 'indoor', bath: 'indoor', interior: 'indoor', furniture: 'indoor',
  bedroom: 'indoor', living: 'indoor', dining: 'indoor', ramps: 'both',
  portico: 'outdoor', gates: 'outdoor', facade: 'outdoor', outdoor: 'outdoor', garden: 'outdoor', services: 'outdoor' };
for (const c of CATALOG) c.scope = CAT_SCOPE[c.id] || 'both';
const OUTDOOR_TYPES = new Set(['ramp', 'steps', 'paving', 'tree', 'shrub', 'gate', 'boundary', 'fence', 'car', 'carport', 'pool', 'gazebo', 'lamp', 'hedge', 'flowerbed', 'pot', 'tulsi', 'bench',
  'swing', 'fountain', 'rocks', 'portico', 'pergola', 'well', 'septic', 'sitout', 'roof', 'balcony', 'cladding', 'louvers', 'frame', 'chimney', 'solar', 'watertank', 'acunit']);
// 'outdoor', 'indoor' or 'structure' (walls, openings, dimensions — editable in both)
export function objScope(o) {
  if (o.type === 'wall' || o.wallId || o.type === 'dimension' || o.type === 'guide') return 'structure';
  if (o.type === 'floor') return 'structure';
  return OUTDOOR_TYPES.has(o.type) ? 'outdoor' : 'indoor';
}
export const inScope = (o, scope) => !scope || scope === 'all' || objScope(o) === 'structure' && scope === 'indoor' || objScope(o) === scope;

export const CATALOG_INDEX =Object.fromEntries(CATALOG.flatMap((c) => c.items.map((i) => [i.key, i])));

export function iconForObj(o) {
  if (o.type === 'wall') return o.kind === 'interior' ? ICONS.wallInt : ICONS.wallExt;
  const map = { door: { single: 'doorSingle', double: 'doorDouble', sliding: 'doorSliding', garage: 'doorGarage', arch: 'archway' },
    window: { casement: 'winCasement', sliding: 'winSliding', picture: 'winPicture', vent: 'winVent', arched: 'winArched' },
    portico: { pediment: 'portico', hip: 'porchHip', flat: 'portico', arched: 'porticoArch', balcony: 'porticoBalcony', modern: 'canopy' },
    gate: { iron: 'gateIron', arch: 'gateArch', wood: 'gateWood', modern: 'gateModern', sliding: 'gateSlide' } };
  if (map[o.type]) return ICONS[map[o.type][o.style]] || ICONS.portico;
  if (o.type === 'dimension') return ICONS.measure;
  if (o.type === 'guide') return ICONS.guide;
  if (o.type === 'roof') return ICONS[{ gable: 'roofGable', hip: 'roofHip', flat: 'roofFlat' }[o.style]];
  if (o.type === 'floor' && o.shape && o.shape !== 'rect') return ICONS[{ lshape: 'floorL', ushape: 'floorL', parallelogram: 'floorSkew', trapezoid: 'floorSkew' }[o.shape] || 'floorHex'];
  if (o.type === 'paving') return o.slope ? ICONS.ramp : o.finish === 'asphalt' ? ICONS.driveway : ICONS.path;
  if (o.type === 'tree') return o.variety === 'conifer' ? ICONS.pine : ICONS.tree;
  return ICONS[o.type] || ICONS.floor;
}

export function labelForObj(o) {
  if (o.type === 'door' || o.type === 'window') {
    const it = CATALOG.flatMap((c) => c.items).find((i) => i.make && i.make().type === o.type && i.make().style === o.style);
    return it ? it.label : TYPES[o.type].label;
  }
  if (o.type === 'wall') return o.kind === 'interior' ? 'Interior wall' : 'Exterior wall';
  if (o.type === 'guide') return o.label ? `Guide ${o.label}` : 'Guide line';
  if (o.type === 'roof') return { gable: 'Gable roof', hip: 'Hip roof', flat: 'Flat roof' }[o.style];
  if (o.type === 'paving') return o.slope ? 'Ramp' : { asphalt: 'Driveway', grass: 'Lawn patch' }[o.finish] || 'Paving';
  if (o.type === 'floor' && o.name) return `Floor · ${o.name}`;
  if (o.type === 'portico') return PORTICO_STYLES.find(([k]) => k === o.style)?.[1] || 'Portico';
  if (o.type === 'gate') return `${{ iron: 'Wrought-iron', arch: 'Arched iron', wood: 'Wooden', modern: 'Modern slat', sliding: 'Sliding' }[o.style] || ''} gate`;
  return TYPES[o.type]?.label || o.type;
}

// Openings drawn inside a wall, in wall-local metres: x along the wall, y across (+y = left normal).
export function drawOpening2D(ctx, op, w, P, paper) {
  const T = w.thickness, a = op.t - op.width / 2, b = op.t + op.width / 2, W = op.width;
  ctx.fillStyle = paper;
  ctx.fillRect(a, -T / 2 - 0.5 * P, W, T + P);
  ctx.strokeStyle = LINE; ctx.lineWidth = 1.2 * P;
  ctx.beginPath(); ctx.moveTo(a, -T / 2); ctx.lineTo(a, T / 2); ctx.moveTo(b, -T / 2); ctx.lineTo(b, T / 2); ctx.stroke();
  if (op.type === 'window') {
    ctx.lineWidth = P; ctx.strokeStyle = '#2563eb';
    ctx.strokeRect(a, -T / 2, W, T);
    ctx.beginPath();
    if (op.style === 'sliding') { ctx.moveTo(a, -0.025); ctx.lineTo(op.t + 0.05, -0.025); ctx.moveTo(op.t - 0.05, 0.025); ctx.lineTo(b, 0.025); }
    else { ctx.moveTo(a, -0.02); ctx.lineTo(b, -0.02); ctx.moveTo(a, 0.02); ctx.lineTo(b, 0.02); }
    ctx.stroke();
    return;
  }
  const s = op.flip ? -1 : 1;
  ctx.strokeStyle = '#7c4a1e'; ctx.lineWidth = 1.4 * P;
  const leaf = (hx, len, dir) => {
    const y0 = s * T / 2;
    ctx.beginPath(); ctx.moveTo(hx, y0); ctx.lineTo(hx, y0 + s * len); ctx.stroke();
    ctx.save(); ctx.setLineDash([4 * P, 3 * P]); ctx.lineWidth = P;
    const a1 = s > 0 ? Math.PI / 2 : -Math.PI / 2, a2 = dir > 0 ? 0 : Math.PI;
    let dlt = a2 - a1; while (dlt > Math.PI) dlt -= 2 * Math.PI; while (dlt < -Math.PI) dlt += 2 * Math.PI;
    ctx.beginPath(); ctx.arc(hx, y0, len, a1, a1 + dlt, dlt < 0); ctx.stroke(); ctx.restore();
  };
  if (op.style === 'single') { if (op.hinge) leaf(b, W, -1); else leaf(a, W, 1); }
  else if (op.style === 'double') { leaf(a, W / 2, 1); leaf(b, W / 2, -1); }
  else if (op.style === 'sliding') {
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.6 * P; ctx.beginPath();
    ctx.moveTo(a, -0.03); ctx.lineTo(op.t + 0.08, -0.03); ctx.moveTo(op.t - 0.08, 0.03); ctx.lineTo(b, 0.03); ctx.stroke();
  } else if (op.style === 'garage') {
    ctx.setLineDash([5 * P, 4 * P]); ctx.strokeStyle = '#475569'; ctx.lineWidth = P;
    ctx.strokeRect(a, -T / 2 - (s > 0 ? 0 : 0.6), W, T + 0.6); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(b, 0); ctx.stroke();
  } else if (op.style === 'arch') {
    ctx.setLineDash([5 * P, 4 * P]); ctx.strokeStyle = '#475569'; ctx.lineWidth = P;
    ctx.beginPath(); ctx.moveTo(a, -T / 2); ctx.lineTo(b, -T / 2); ctx.moveTo(a, T / 2); ctx.lineTo(b, T / 2); ctx.stroke(); ctx.setLineDash([]);
  }
}

// User-placed dimension annotation (two points + perpendicular offset).
TYPES.dimension = {
  label: 'Dimension line', kind: 'dim',
  props: [
    { key: 'length', label: 'Measured length', kind: 'len', min: 0.01, get: (o) => Math.hypot(o.x2 - o.x1, o.y2 - o.y1), set: 'dimLength' },
    len('offset', 'Offset from points', { min: -50 }), text('label', 'Text override'),
    select('color', 'Colour', [['#334155', 'Charcoal'], ['#1d4ed8', 'Blue'], ['#c2410c', 'Orange'], ['#15803d', 'Green'], ['#b91c1c', 'Red']]),
  ],
};

// Construction guide line: an infinite line through two points, drawn only in the plan editor.
// Walls, rooms and dimensions snap to guides and to the points where guides cross.
TYPES.guide = {
  label: 'Guide line', kind: 'guide',
  props: [
    len('x1', 'Point 1 X', { min: -9999 }), len('y1', 'Point 1 Y', { min: -9999 }), len('x2', 'Point 2 X', { min: -9999 }), len('y2', 'Point 2 Y', { min: -9999 }),
    num('angle', 'Angle °', { get: (o) => ((Math.round((-Math.atan2(o.y2 - o.y1, o.x2 - o.x1) * 180) / Math.PI * 100) / 100) + 360) % 360, set: 'guideAngle', step: 1 }),
    text('label', 'Grid label'),
    select('color', 'Colour', [['#0891b2', 'Cyan'], ['#db2777', 'Magenta'], ['#ea580c', 'Orange'], ['#16a34a', 'Green'], ['#7c3aed', 'Violet']]),
  ],
};

export { rr, txt };
