// Gestion de la régénération de vie hors combat pour le joueur.

export function startOutOfCombatRegen(scene, player) {
  if (!scene || !scene.time || !player || !player.stats) return;

  const hpMax = player.stats.hpMax ?? player.stats.hp ?? 0;
  const hp = player.stats.hp ?? hpMax;

  // Rien à faire si déjà full vie
  if (hp >= hpMax) {
    return;
  }

  // Si une régénération était déjà en cours, on la remplace
  if (scene.playerRegenEvent) {
    scene.playerRegenEvent.remove(false);
    scene.playerRegenEvent = null;
  }

  scene.playerRegenEvent = scene.time.addEvent({
    delay: 1000, // 1 seconde
    loop: true,
    callback: () => {
      // Si un nouveau combat commence, on arrête la régén
      if (scene.combatState && scene.combatState.enCours) {
        if (scene.playerRegenEvent) {
          scene.playerRegenEvent.remove(false);
          scene.playerRegenEvent = null;
        }
        return;
      }

      const stats = player.stats || {};
      const max = stats.hpMax ?? stats.hp ?? 0;
      const current = stats.hp ?? max;

      if (current >= max) {
        if (scene.playerRegenEvent) {
          scene.playerRegenEvent.remove(false);
          scene.playerRegenEvent = null;
        }
        return;
      }

      const newHp = Math.min(max, current + 2);
      stats.hp = newHp;

      if (typeof player.updateHudHp === "function") {
        player.updateHudHp(newHp, max);
      }
    },
  });
}

