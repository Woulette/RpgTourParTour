// UI de fin de combat : grande popup centrée avec le récap
// + affichage du butin (loot).

import { items } from "../inventory/itemsConfig.js";

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
  let lootContainer = document.getElementById("combat-result-loot");
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

  // Création dynamique du bloc "Butin" si besoin
  if (!lootContainer) {
    const body = overlay.querySelector(".combat-result-body");
    if (body) {
      const section = document.createElement("div");
      section.className = "combat-result-section";

      const h3 = document.createElement("h3");
      h3.textContent = "Butin";

      lootContainer = document.createElement("div");
      lootContainer.id = "combat-result-loot";
      lootContainer.className = "combat-result-loot-list";

      section.appendChild(h3);
      section.appendChild(lootContainer);
      body.appendChild(section);
    }
  }

  const hide = () => {
    overlay.classList.add("combat-result-hidden");
  };

  const renderLoot = (lootArray) => {
    if (!lootContainer) return;

    lootContainer.innerHTML = "";

    const loot = Array.isArray(lootArray) ? lootArray : [];
    if (loot.length === 0) {
      const empty = document.createElement("div");
      empty.className = "combat-result-loot-empty";
      empty.textContent = "Aucun objet";
      lootContainer.appendChild(empty);
      return;
    }

    loot.forEach((entry) => {
      if (!entry) return;
      const def = items[entry.itemId];

      const wrapper = document.createElement("div");
      wrapper.className = "combat-result-loot-item";

      const icon = document.createElement("div");
      icon.className = "combat-result-loot-icon";
      if (def && def.icon) {
        icon.style.backgroundImage = `url(${def.icon})`;
      } else {
        icon.textContent = "?";
      }

      const label = document.createElement("span");
      label.className = "combat-result-loot-label";
      label.textContent = def?.label || entry.itemId || "?";

      const qty = document.createElement("span");
      qty.className = "combat-result-loot-qty";
      qty.textContent = `x${entry.qty ?? 0}`;

      wrapper.appendChild(icon);
      wrapper.appendChild(label);
      wrapper.appendChild(qty);

      lootContainer.appendChild(wrapper);
    });
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

    // Loot
    renderLoot(result.loot);

    // Texte du bouton en fonction de l'issue
    buttonEl.textContent = issue === "defaite" ? "Respawn" : "Continuer";

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
      // Téléportation éventuelle du joueur à un point sûr :
      // pour l'instant, on le laisse où il est.
    }

    hide();
  });

  // On expose la fonction sur la scène pour que core/combat.js puisse l'utiliser.
  // (On ne veut pas que core/combat.js importe ce module directement.)
  scene.showCombatResult = showCombatResult;
}
