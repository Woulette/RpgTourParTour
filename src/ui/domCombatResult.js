// UI de fin de combat : grande popup centrée avec le récap.

export function initDomCombatResult(scene, player) {
  const overlay = document.getElementById("combat-result-overlay");
  const titleEl = document.getElementById("combat-result-title");
  const playerLevelEl = document.getElementById("combat-result-player-level");
  const xpGainEl = document.getElementById("combat-result-xp-gain");
  const xpTotalEl = document.getElementById("combat-result-xp-total");
  const xpNextEl = document.getElementById("combat-result-xp-next");
  const monsterNameEl = document.getElementById("combat-result-monster-name");
  const monsterHpEl = document.getElementById("combat-result-monster-hp");
  const durationEl = document.getElementById("combat-result-duration");
  const goldEl = document.getElementById("combat-result-gold");
  const buttonEl = document.getElementById("combat-result-continue-button");

  if (
    !overlay ||
    !titleEl ||
    !playerLevelEl ||
    !xpGainEl ||
    !xpTotalEl ||
    !xpNextEl ||
    !monsterNameEl ||
    !monsterHpEl ||
    !durationEl ||
    !goldEl ||
    !buttonEl
  ) {
    return;
  }

  const hide = () => {
    overlay.classList.add("combat-result-hidden");
  };

  // Gestionnaire appelé par le système de combat à la fin du fight.
  const showCombatResult = (result) => {
    const issue = result.issue || "inconnu";

    // Titre
    titleEl.textContent =
      issue === "victoire"
        ? "Victoire"
        : issue === "defaite"
        ? "Défaite"
        : "Fin du combat";
    titleEl.classList.remove("victoire", "defaite");
    if (issue === "victoire") titleEl.classList.add("victoire");
    if (issue === "defaite") titleEl.classList.add("defaite");

    // Joueur
    playerLevelEl.textContent = result.playerLevel ?? 1;
    xpGainEl.textContent = result.xpGagne ?? 0;
    xpTotalEl.textContent = result.playerXpTotal ?? 0;
    xpNextEl.textContent = result.playerXpNext ?? 0;

    // Monstre
    monsterNameEl.textContent = result.monsterId || "-";
    monsterHpEl.textContent = result.monsterHpEnd ?? 0;

    // Combat
    const seconds = Math.max(0, Math.round((result.durationMs || 0) / 1000));
    durationEl.textContent = `${seconds}s`;
    goldEl.textContent = result.goldGagne ?? 0;

    // Texte du bouton en fonction de l'issue
    buttonEl.textContent =
      issue === "defaite" ? "Respawn" : "Continuer";

    overlay.dataset.issue = issue;
    overlay.classList.remove("combat-result-hidden");
  };

  buttonEl.addEventListener("click", () => {
    const issue = overlay.dataset.issue || "inconnu";

    // Gestion d'un respawn très simple en cas de défaite
    if (issue === "defaite" && player && player.stats) {
      const hpMax = player.stats.hpMax ?? player.stats.hp ?? 0;
      player.stats.hp = hpMax;
      if (typeof player.updateHudHp === "function") {
        player.updateHudHp(hpMax, hpMax);
      }
      // Téléportation éventuelle du joueur à un point sûr
      // (pour l'instant, on le laisse où il est).
    }

    hide();
  });

  // On expose la fonction sur la scène pour que core/combat.js puisse l'utiliser.
  // (On ne veut pas que core/combat.js importe ce module directement.)
  scene.showCombatResult = showCombatResult;
}

