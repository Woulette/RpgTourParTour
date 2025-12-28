import { maps } from "../../maps/index.js";
import { preloadMap } from "../../maps/loader.js";
import { preloadMonsters } from "../../monsters/index.js";
import { preloadNpcs } from "../../npc/spawn.js";

const ANIM_DIRS = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
];

function loadRunFrames(scene, prefix, basePath) {
  ANIM_DIRS.forEach((dir) => {
    for (let i = 0; i < 6; i += 1) {
      const index = i.toString().padStart(3, "0");
      scene.load.image(`${prefix}_run_${dir}_${i}`, `${basePath}/${dir}/frame_${index}.png`);
    }
  });
}

export function preloadAssets(scene) {
  if (!scene) return;

  // Precharge les maps actives.
  Object.values(maps).forEach((mapDef) => {
    if (!mapDef || mapDef.enabled === false) return;
    preloadMap(scene, mapDef);
  });

  // Archer (actuel)
  scene.load.image(
    "player",
    "assets/animations/animation archer/rotations/south-east.png"
  );
  loadRunFrames(scene, "player", "assets/animations/animation archer/running-6-frames");

  // Tank (nouveau perso)
  scene.load.image(
    "tank",
    "assets/animations/animation tank/rotations/south-east.png"
  );
  loadRunFrames(scene, "tank", "assets/animations/animation tank/animations/running-6-frames");

  // Animiste (remplace le slot "mage")
  scene.load.image(
    "animiste",
    "assets/animations/animations-Animiste/rotations/south-east.png"
  );
  loadRunFrames(
    scene,
    "animiste",
    "assets/animations/animations-Animiste/animations/running-6-frames"
  );

  // Eryon (4e classe)
  scene.load.image(
    "eryon",
    "assets/animations/animations-Eryon/rotations/south-east.png"
  );
  loadRunFrames(
    scene,
    "eryon",
    "assets/animations/animations-Eryon/animations/running-6-frames"
  );

  scene.load.image("tree_chene", "assets/metier/Bucheron/Ressources/Chene.png");
  scene.load.image(
    "tree_chene_stump",
    "assets/metier/Bucheron/Ressources/SoucheChene.png"
  );
  scene.load.image(
    "ScierieDuBucheron",
    "assets/metier/Bucheron/ScierieDuBucheron.png"
  );
  scene.load.image(
    "EtablieDuBricoleur",
    "assets/metier/Bricoleur/EtablieDuBricoleur.png"
  );
  scene.load.image("Boutique", "assets/tileset/Boutique.png");
  scene.load.image("puits", "assets/tileset/Puits.png");
  scene.load.image(
    "rift_dim_1",
    "assets/Sprite/portaildimentionelle/FailledimentionelleOuvert1.png"
  );
  scene.load.image(
    "rift_dim_2",
    "assets/Sprite/portaildimentionelle/FailledimentionelleOuvert2.png"
  );
  scene.load.image(
    "rift_dim_1_closed",
    "assets/Sprite/portaildimentionelle/FailledimentionelleFermer1.png"
  );
  scene.load.image(
    "rift_dim_2_closed",
    "assets/Sprite/portaildimentionelle/FailledimentionelleFermer2.png"
  );
  scene.load.image(
    "portal_dim_closed",
    "assets/Sprite/PortailDimentionelle/PortailDimentionelleFermer.png"
  );
  scene.load.image(
    "portal_dim_open",
    "assets/Sprite/PortailDimentionelle/PortailDimentionelleOuvert.png"
  );

  // Ressources alchimiste (ortie)
  scene.load.image("herb_ortie", "assets/metier/alchimiste/ressources/Ortie.png");
  scene.load.image(
    "herb_ortie_stump",
    "assets/metier/Alchimiste/Ressources/SoucheOrtie.png"
  );
  scene.load.image("chene", "assets/metier/Bucheron/Ressources/Chene.png");
  scene.load.image("boulleau_single", "assets/tileset/Boulleau.png");

  preloadMonsters(scene);
  preloadNpcs(scene);

  // --- Animations de sorts (atlases) ---
  scene.load.atlas(
    "spell_punch_furtif_atlas",
    "assets/AnimationSort/SpriteSheetPunchFurtif.png",
    "assets/AnimationSort/AnimationPunchFurtif.json"
  );

  // Test Eryon : projectile "Recharge de Flux"
  scene.load.atlas(
    "spell_recharge_flux_atlas",
    "assets/AnimationSort/TestPourVoirFeu.png",
    "assets/AnimationSort/TestPourVoirFeu.json"
  );
}
