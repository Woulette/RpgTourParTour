export const maps = {
  maptest: {
    key: "maptest", // key used by Phaser for this map
    jsonPath: "assets/maps/maptest.json",
    tilesets: [
      {
        name: "herbe_iso",     // tileset name as defined in Tiled
        imageKey: "herbe_iso", // key to reference in Phaser
        imagePath: "assets/tileset/herbe_iso.png",
      },
    ],
    cameraOffsets: { x: 0, y:43 }, // reuse current camera tweak
  },
};

export const defaultMapKey = "maptest";
