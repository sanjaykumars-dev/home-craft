# HomeCraft — house designer for home owners and engineers

A browser app for designing a house in a 2D floor plan with a live 3D view. It exports a PDF drawing set you can hand to your engineer or mason.

## Run it

```bash
node server.js
```

Then open http://localhost:5173 for the home page, or http://localhost:5173/app.html for the app itself. You don't need to install anything. The 3D engine (Three.js) and the PDF library (jsPDF) load from public CDNs, so you need an internet connection. The 2D planner works offline.

## Host it for free (GitHub Pages)

It's a static site, so no build step is needed. Push the folder to a public GitHub repository, then open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save. The site appears at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Designs

**Designs** opens five ready-made houses, and every one is fully editable:

- **Kerala traditional:** mukhappu tiled roof, sit-out with charupadi, padippura gate, pooja room, well and coconut palms.
- **Kerala contemporary:** two storeys.
- **Modern villa**
- **Colonial two-storey**
- **Family bungalow**

## What you can place

- **Rooms (furnished):** living, dining, kitchen, toilet/bath, attached toilet, pooja room, bedroom, master bedroom, study, work area and store. Each one creates walls, a door, a named floor and its fittings. Drag the room to any size, or click once to get the standard size.
- **Walls & structure:** exterior and interior walls at any angle (hold Shift to turn off angle snapping), and **curved walls**. To draw a curved wall, click the start, click the end, then move the pointer to bend it and click to place. Any existing wall can also be bent by dragging its orange ◆ handle or setting its curve. Curved walls carry doors and windows, follow the plinth, block the Spectate character, and appear on the setting-out sheet with their arc centre and radius. Also: floors, roofs (Kerala, gable, hip, flat), columns and dimension lines.
- **Floors:** rectangle, skewed, trapezoid, L, U, hexagon, octagon, circle, ramps, and a **custom shape where every side can be edited**.
- **Doors & windows:** single, double, sliding, garage, archway, casement, sliding, picture, arched, ventilator, and windows with a sunshade (chajja).
- **Stairs:** straight, L-shaped, winder, dog-legged (U) and spiral. When you drag the stair area, the steps re-flow to fit, and a riser/tread check is shown.
- **Porticos:** Kerala sit-out, Kerala front gable, classical, colonial two-storey, arched arcade, craftsman porch, modern canopy, and portico with a balcony on top.
- **Gates & boundary:** padippura, wrought iron, arched iron, sliding, wooden, modern slat and pedestrian gates, plus plaster, laterite, brick or railing walls.
- **Facade:** balconies, pergola, stone, laterite and wood cladding, louvers, elevation frames and chimney.
- **Garden:** coconut, mango, gulmohar, banana, bamboo, cypress and other trees, plus hedges, flower beds, pots, tulsi thara, sit-outs, bench, swing, fountain and rocks.
- **Bath, interior & services:** WC (western and Indian), basin, shower, bathtub, washer, pooja unit, wardrobe, TV unit, desk, bookshelf, fridge, island, water tank, solar panels, septic tank, open well and AC unit.

## Controls

- **Indoor / Outdoor / All workspace:** Indoor hides the roof and locks the garden. Outdoor locks the interior.
- **Dimensions:**
  - Double-click any dimension in the plan to type an exact value.
  - The ⚙ settings control what is shown, how walls are measured (centre-line, outside or clear), precision and snap step.
  - Units can be m, cm, mm or ft-in.
- **Locks:** 🔒 next to any dimension stops it from changing. You can also lock, hide or reorder whole elements (front, back, forward, backward).
- **Elements tab:** a tree of every element by storey and group, with select, hide and lock.
- **Plinth:** raises the house above ground. The site stays at ground level, and the portico gets steps.
- **Engineer mode:** shows door/window tags (D1, W2…), opening dimension chains and engineering checks.
- **Elevations:** orthographic front, rear, left and right views with level markers (GL, plinth/FFL, top of wall, ridge).
- **▶ Spectate:** you control a site-engineer character.
  - The character is a skinned figure animated with real motion capture (idle, walk and run, cross-faded by speed). To use your own realistic human instead, put a rigged model at `assets/character.glb`; see [assets/README.md](assets/README.md).
  - Controls: W/S walk forward or back, A/D turn, Q/E side-step, Shift run, Space jump, drag to turn and look up or down, V for first person. The camera always looks the way the character faces. **Auto tour** lets a guide in a hard hat lead instead.
  - Physics: the body is a 0.5 m × 1.75 m capsule with gravity of 9.81 m/s². It steps up edges of up to 0.35 m, so it climbs stairs and kerbs. Walls, windows, furniture and railings block it, and the camera never passes through walls. **Physics** in the Spectate panel lists all the values.
  - Doors start closed. A hinged door swings open when you push it, slows down with hinge friction, stops at 100°, and a door closer shuts it a few seconds after you leave. Sliding doors open as you approach.

## PDF drawing set (Export PDF)

The export is an A3 set with a title block on every sheet. It contains:

- Cover sheet with key data and a drawing index
- Site plan
- Floor plans at a standard scale (1:100 etc.)
- Centre-line setting-out plan with a wall coordinate table for the mason
- Elevations
- 3D views
- Door & window schedule, room schedule and area statement
- Approximate quantities (BOQ)
- Construction specifications

The structural guidance in it is typical practice only. A licensed structural engineer must verify it before construction.

## Code layout

| File | Purpose |
| --- | --- |
| `index.html` | Home page (landing page with screenshots in `assets/shots/`) |
| `app.html` | The designer app |
| `js/state.js` | Document store, undo/redo, autosave, units, plinth, dimension settings, locks |
| `js/catalog.js` | Item types, properties, 2D symbols, floor shapes, stair layouts, room presets |
| `js/plan2d.js` | Canvas plan editor: snapping, handles, dimensions, inline editing, print rendering |
| `js/builders3d.js` | 3D models for every element (incl. Kerala roof, porticos, gates, fittings) |
| `js/textures.js` | Procedural textures (laterite, clay tile, brick, wood, grass…) |
| `js/view3d.js` | Three.js scene, orbit/walk, elevations, off-screen rendering |
| `js/tour.js` | Spectate tour with the guide character |
| `js/pdf.js` | PDF drawing set generator |
| `js/designs.js`, `js/templates.js` | Ready-made house designs |
| `js/main.js` | UI: palette, properties, Elements tree, storeys, settings, shortcuts |
