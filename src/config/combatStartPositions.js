// Combat start anchors for each map (no accents on purpose).
// Idea:
// - COMBAT_PATTERNS defines the SHAPE (player/enemy offsets).
// - COMBAT_START_POSITIONS defines, per map, where to place this shape.
//
// Structure:
// export const COMBAT_START_POSITIONS = {
//   someMapKey: {
//     close_melee: [
//       {
//         // Center of player group (origin for playerOffsets)
//         playerOrigin: { x: 10, y: 20 },
//         // Center of enemy group (origin for enemyOffsets)
//         enemyOrigin: { x: 10, y: 24 },
//       },
//     ],
//   },
// };
//
// If no entry is defined for a map, the system falls back
// to "around clicked monster" like before.

export const COMBAT_START_POSITIONS = {
  // Example anchors for the second map (key "maptest2").
  // You can tweak these coordinates to match the zones you want.
  maptest2: {
    close_melee: [
      {
        // Middle lane, players below, enemies above
        playerOrigin: { x: 16, y: 20 },
        enemyOrigin: { x: 16, y: 16 },
      },
      {
        // More to the right
        playerOrigin: { x: 15, y: 10 },
        enemyOrigin: { x: 15, y: 6 },
      },
      {
        // Upper part of the map
        playerOrigin: { x: 10, y: 17 },
        enemyOrigin: { x: 10, y: 15 },
      },
    ],
  },
};

