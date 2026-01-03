# Decor Y-Sort Notes (Hand-off)

## Goal
Make tall decor (houses/trees/etc.) render correctly in isometric view:
- Player should go in front of the base, behind the top.
- Avoid splitting into trunk/foliage tile layers.

## Current System
- Decor objects placed in Tiled **Object Layer**: `decor` (or `trees`).
- Spawning handled in `src/features/maps/world/decor.js` via `spawnObjectLayerTrees`.
- Depth logic uses `sprite.setDepth(...)`.

## The Problem We Had
Large decor was always forced **under the player**, so Y-sort never worked.
Result: player always appeared in front, even when behind.

## Fix Added
We added support for per-object Y-sorting and depth offsets:
- `allowYSort = true` (or `ySort = true`) on a Tiled object enables Y-sort.
- Optional `depthOffset` property adjusts the sort anchor (in pixels).
- Default `depthOffset = -40` for large decor when `allowYSort=true`.

## Where It’s Implemented
- `src/features/maps/world/decor.js`
  - Reads object properties: `allowYSort` / `ySort` / `depthOffset`
  - Applies depth as `sprite.y + depthOffset`

## How To Use In Tiled
1) Put the decor in an **Object Layer** named `decor`.
2) On the object, add:
   - `allowYSort = true`
   - (optional) `depthOffset = -40` (or tweak -60/-80 if needed)
3) Save the map JSON and test.

## Why Some Maps Didn’t Work
If a map doesn’t work, it’s because:
- Decor is in a **Tile Layer** (not object layer),
- or object layer name isn’t `decor` / `trees`,
- or object is missing `allowYSort=true`.

## Test Checklist
- Walk in front of the house base → player is in front.
- Walk behind the house roof → player is hidden correctly.
- If feet/body are clipped wrong → adjust `depthOffset` on that object.

## Next Steps If Needed
- Add `allowYSort=true` to all important decor objects.
- For problematic objects, set a custom `depthOffset`.
