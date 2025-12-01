// Fiches de monstres (données uniquement)
// Tous les monstres utilisent le même modèle de stats que le joueur.

export const monsters = {
  corbeau: {
    id: "corbeau",
    label: "Corbeau",
    textureKey: "corbeau",                 // clé de texture Phaser
    spritePath: "assets/monsters/corbeau.png", // chemin de l'image

    // Overrides de stats par rapport au modèle de base (src/core/stats.js)
    // Ici on laisse volontairement quelque chose de simple.
    statsOverrides: {
      hpMax: 25,
      hp: 25,
      initiative: 5,
      agilite: 5,
    },

    // Liste des sorts que ce monstre peut utiliser en combat
    spells: ["coup_de_bec"],

    // Butin basique de test
    loot: [
      {
        itemId: "plume_corbeau",
        min: 1,
        max: 2,
        dropRate: 1.0, // 100 % de chance pour les tests
      },
      {
        itemId: "patte_corbeau",
        min: 1,
        max: 1,
        dropRate: 1.0,
      },
      // Pièces d'équipement du Corbeau (rares)
      {
        itemId: "coiffe_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.12,
      },
      {
        itemId: "cape_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.12,
      },
      {
        itemId: "amulette_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.10,
      },
      {
        itemId: "ceinture_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.10,
      },
      {
        itemId: "bottes_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.10,
      },
      {
        itemId: "anneau_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.08,
      },
    ],

    xpReward: 20,
    goldRewardMin: 8,
    goldRewardMax: 21,
  },

  aluineeks: {
    id: "aluineeks",
    label: "Aluineeks",
    textureKey: "aluineeks",
    spritePath: "assets/monsters/aluineeks.png",

    // Monstre terre, plus costaud que le corbeau
    statsOverrides: {
      hpMax: 50,
      hp: 50,
      pa: 8,       // 8 PA => 2 fois un sort à 4 PA
      pm: 4,       // 4 PM
      force: 20,   // statistique Terre
      initiative: 4,
    },

    // Il n'a qu'un sort : Fissure
    spells: ["fissure"],

    // Loot à définir plus tard
    loot: [],

    xpReward: 80,
  },
};
