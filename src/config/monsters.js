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
    ],

    xpReward: 20,
  },
};
