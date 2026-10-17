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

**Designs** opens six ready-made designs, and every one is fully editable:

- **Green Meadows township:** a tree-lined avenue of eight unique, fully furnished houses (Kerala traditional, modern villa, colonial, Kerala contemporary, craftsman bungalow with a curved bay, courtyard house, spiral-stair duplex and a compact family home), a park with gazebo and fountain, a community pool and visitor parking. Between them they use every item in the catalogue, and no furniture stands in front of any door.
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
- **Ramps & sit-out steps:** wheelchair ramp (1:12, handrails), car ramp (1:8), garden ramp; straight sit-out steps, steps with laterite side walls, wide granite steps, semicircular and three-sided steps. Their rise starts at your plinth height and they size themselves (15 cm risers, 30 cm treads); the character can walk up all of them.
- **Furniture (place and resize anywhere):** single, double, queen and king beds, baby cot, bedside table, 2-door, 3-door and sliding wardrobes, dressing table, study desk, bookshelf; 3- and 2-seat and L-shaped sofas, armchair, coffee table, TV unit, rug, floor lamp, shoe rack, pooja unit; 4-, 6- and 8-seat dining, single- and double-door fridges, kitchen counter and island.
- **Bath, interior & services:** WC (western and Indian), basin, shower, bathtub, washer, pooja unit, wardrobe, TV unit, desk, bookshelf, fridge, island, water tank, solar panels, septic tank, open well and AC unit.

## Controls

- **Indoor / Outdoor / All workspace:** Indoor hides the roof and locks the garden. Outdoor locks the interior.
- **Dimensions:**
  - Double-click any dimension in the plan to type an exact value.
  - The ⚙ settings control what is shown, how walls are measured (centre-line, outside or clear), precision and snap step.
  - Units can be m, cm, mm or ft-in.
- **Plot:** set the plot when you start a new project, or later in **Plot & orientation** (fit it to your boundary walls or around everything). Every side has its own length, bearing (0° north, 90° east) and setback, every corner its inside angle, and you can add corners for irregular plots or drag them in the plan. Lock a side's length or bearing, or the whole plot. The panel shows plot area in m², sq ft and cents, ground coverage, FAR, and walls that cross the setback or the boundary; the plot appears in 2D, in 3D (property line and corner pegs) and on the PDF site plan.
- **Survey plots:** for a four-sided plot, **📐 Rebuild from measurements** takes the four side lengths from your survey sketch, the side that is straight and which way it runs (east–west or north–south), and one more measurement (a corner angle or a diagonal), and rebuilds the exact shape. The buildable area inside the setbacks is a straight rectangle by default, squared to a side you choose (or set it to follow the plot sides).
- **North and view direction:** set where north points; it turns the compass, the PDF north arrows and the sun path in 3D. The 2D plan is always a top view but can be turned: ⟲ / ⟳ in 90° steps, or Plan / North / South / East / West up (click the compass to toggle north-up).
- **Guide lines:** the Guide tool (G) lays a construction line through two points; it locks in place as soon as it is placed. Walls, rooms and dimensions snap to guides and to where guides cross each other or a wall. **Guide grid** lays out a lettered and numbered setting-out grid at the spacings you type. A selected guide can be turned into a wall or copied parallel at an exact distance, and the Guides button shows or hides them.
- **Drawing and measuring aids:** while drawing walls or measuring, every wall shows its face lines and dash-dot centre line, the pointer snaps along them (with a ⟂ perpendicular snap for clear room widths), and pink tracking lines show when a point lines up with another corner. Measure shows length, ΔX, ΔY and angle.
- **Locks:** 🔒 next to any dimension stops it from changing. You can also lock, hide or reorder whole elements (front, back, forward, backward).
- **Elements tab:** a tree of every element by storey and group, with select, hide and lock.
- **Plinth:** raises the house above ground. The site stays at ground level, and the portico gets steps.
- **Engineer mode:** shows door/window tags (D1, W2…), opening dimension chains and engineering checks.
- **Elevations:** orthographic front, rear, left and right views with level markers (GL, plinth/FFL, top of wall, ridge).
- **📷 Camera (C):** frames a shot in the 3D view (aspect, size up to 4K, lens, thirds grid, optional caption, JPG or PNG). Enter takes a snap into a gallery you can preview and download; **Save view** stores camera positions in the project. **⛶ Full screen** fills the screen with the 3D view.
- **▶ Spectate:** you control a site-engineer character.
  - The character is a skinned figure animated with real motion capture (idle, walk and run, cross-faded by speed). To use your own realistic human instead, put a rigged model at `assets/character.glb`; see [assets/README.md](assets/README.md).
  - Controls: W/S walk forward or back, A/D turn, Q/E side-step, Shift run, Space jump, drag to turn and look up or down, V for first person. The camera always looks the way the character faces. **Auto tour** lets a guide in a hard hat lead instead.
  - Physics: the body is a 0.5 m × 1.75 m capsule with gravity of 9.81 m/s². It steps up edges of up to 0.35 m, so it climbs stairs and kerbs. Walls, windows, furniture and railings block it, and the camera never passes through walls. **Physics** in the Spectate panel lists all the values.
  - Doors start closed. A hinged door swings open when you push it, slows down with hinge friction, stops at 100°, and a door closer shuts it a few seconds after you leave. Gates work the same way: swing gates are pushed open leaf by leaf, and sliding gates roll open as you approach.
  - Solids are strict: walls, furniture, cars, stones, bushes, hedges and railings all block you, tested at knee, hip, chest and head height from the centre and both sides of the body. Every first-floor stair opening has a guard rail, with a gap only where you step off the stairs.
  - Large scenes stay smooth: static parts are merged into a few hundred meshes, models are cached between edits, and collisions only test what is near the character.

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
| `js/camera.js` | 3D camera panel: framing, snaps gallery, saved views |
| `js/town.js` | Green Meadows township generator (house planner and door-aware furniture fitter) |
| `js/tour.js` | Spectate tour with the guide character |
| `js/pdf.js` | PDF drawing set generator |
| `js/designs.js`, `js/templates.js` | Ready-made house designs |
| `js/main.js` | UI: palette, properties, Elements tree, storeys, settings, shortcuts |
