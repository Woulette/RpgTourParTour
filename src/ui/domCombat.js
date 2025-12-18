// Gestion de l'UI de combat (HTML) :
// - bouton "PRÊT" pendant la phase de préparation
// - bouton "FIN DU TOUR" et indicateur de tour pendant le combat.

import { startCombatFromPrep, passerTour } from "../core/combat.js";
import { runMonsterTurn } from "../monsters/ai.js";
import { runSummonTurn } from "../systems/combat/summons/turn.js";
import { getAliveSummon } from "../systems/combat/summons/summon.js";
import { monsters as monsterDefs } from "../content/monsters/index.js";
import { getActiveSpell } from "../systems/combat/spells/activeSpell.js";
import { tryCastActiveSpellAtTile } from "../systems/combat/spells/cast.js";
import { updateSpellRangePreview, clearSpellRangePreview } from "../systems/combat/spells/preview.js";

export function initDomCombat(scene) {
  const endTurnBtn = document.getElementById("combat-end-turn-button");
  const readyBtn = document.getElementById("combat-ready-button");
  const turnLabel = document.getElementById("combat-turn-label");
  const turnOrderListEl = document.getElementById("combat-turn-order-list");
  const roundValueEl = document.getElementById("combat-round-value");
  const targetPanelNameEl = document.getElementById("combat-target-name");
  const targetPanelHpTextEl = document.getElementById("combat-target-hp-text");
  const targetPanelHpFillEl = document.getElementById("combat-target-hp-fill");
  const targetPanelPaEl = document.getElementById("combat-target-pa");
  const targetPanelPmEl = document.getElementById("combat-target-pm");
  const targetPanelEl = document.getElementById("combat-target-panel");

  if (!endTurnBtn || !turnLabel) {
    return;
  }

  const getActorName = (actor) => {
    if (!actor) return "-";
    if (actor.kind === "joueur") return "Joueur";
    if (actor.kind === "invocation") {
      const id = actor.entity?.monsterId || "";
      return id ? `Invoc. ${id}` : "Invocation";
    }
    return actor.entity?.monsterId || "Monstre";
  };

  const getActorBadge = (actor) => {
    const name = getActorName(actor);
    if (!name || name === "-") return "?";
    return name.slice(0, 2).toUpperCase();
  };

  const getActorHp = (actor) => {
    const stats = actor?.entity?.stats || {};
    const hp =
      typeof stats.hp === "number" ? stats.hp : (stats.hpMax ?? 0);
    const hpMax =
      typeof stats.hpMax === "number"
        ? stats.hpMax
        : typeof stats.hp === "number"
          ? stats.hp
          : 0;
    return { hp, hpMax };
  };

  const ensureAvatarSrc = (actor, imgEl) => {
    // Chemins explicites (plus fiable que d'extraire depuis Phaser).
    if (actor?.kind === "joueur") {
      const classId = actor?.entity?.classId || "archer";
      const pathByClass = {
        archer: "assets/rotations/south-east.png",
        tank: "assets/animations/animation tank/rotations/south-east.png",
        mage: "assets/animations/animations-Animiste/rotations/south-east.png",
      };
      const raw = pathByClass[classId] || pathByClass.archer;
      imgEl.src = encodeURI(raw);
      return true;
    }
    if (actor?.kind === "monstre" || actor?.kind === "invocation") {
      const monsterId = actor?.entity?.monsterId;
      const def = monsterId ? monsterDefs[monsterId] : null;
      const src = def?.combatAvatarPath || def?.spritePath;
      if (src) {
        imgEl.src = encodeURI(src);
        return true;
      }
    }

    const key = actor?.entity?.texture?.key;
    if (!key || !imgEl || !scene?.textures) return false;

    const cache =
      scene.__combatAvatarCache || (scene.__combatAvatarCache = new Map());
    const cached = cache.get(key);
    if (typeof cached === "string" && cached.length > 0) {
      imgEl.src = cached;
      return true;
    }

    // Tentative 1 : URL directe (si la texture provient d'un fichier image).
    try {
      const tex = scene.textures.get(key);
      const sourceImage =
        (tex && typeof tex.getSourceImage === "function"
          ? tex.getSourceImage()
          : tex && Array.isArray(tex.source) && tex.source[0]
            ? tex.source[0].image
            : null);

      const directSrc =
        sourceImage && typeof sourceImage.src === "string"
          ? sourceImage.src
          : sourceImage && typeof sourceImage.currentSrc === "string"
            ? sourceImage.currentSrc
            : null;

      if (directSrc && directSrc.length > 0) {
        cache.set(key, directSrc);
        imgEl.src = directSrc;
        return true;
      }
    } catch {
      // ignore
    }

    // Tentative 2 : Base64 via Phaser (robuste même si la source n'a pas d'URL exploitable).
    if (typeof scene.textures.getBase64 === "function") {
      try {
        const base64 = scene.textures.getBase64(key);
        if (typeof base64 === "string" && base64.startsWith("data:image")) {
          cache.set(key, base64);
          imgEl.src = base64;
          return true;
        }
      } catch {
        // ignore
      }
    }

    return false;
  };

  const isActorAlive = (actor) => {
    const ent = actor?.entity;
    const stats = ent?.stats;
    if (!stats) return false;
    const hp = typeof stats.hp === "number" ? stats.hp : stats.hpMax ?? 0;
    return hp > 0;
  };

  const getEntityTile = (entity) => {
    if (!entity) return null;
    const tx =
      typeof entity.currentTileX === "number"
        ? entity.currentTileX
        : typeof entity.tileX === "number"
          ? entity.tileX
          : null;
    const ty =
      typeof entity.currentTileY === "number"
        ? entity.currentTileY
        : typeof entity.tileY === "number"
          ? entity.tileY
          : null;

    if (typeof tx === "number" && typeof ty === "number") {
      return { x: tx, y: ty };
    }

    const mapForCast = scene.combatMap || scene.map;
    const layerForCast = scene.combatGroundLayer || scene.groundLayer;
    if (
      mapForCast &&
      layerForCast &&
      typeof mapForCast.worldToTileXY === "function"
    ) {
      try {
        const t = mapForCast.worldToTileXY(
          entity.x,
          entity.y,
          true,
          undefined,
          undefined,
          layerForCast
        );
        if (t && typeof t.x === "number" && typeof t.y === "number") {
          return { x: t.x, y: t.y };
        }
      } catch {
        // ignore
      }
    }

    return null;
  };

  const renderTurnOrder = () => {
    if (!turnOrderListEl) return;
    turnOrderListEl.innerHTML = "";

    const state = scene.combatState;
    if (!state || !state.enCours) return;

    let actors = state.actors;
    let activeIndex =
      typeof state.actorIndex === "number" ? state.actorIndex : 0;

    if (!actors || !actors.length) {
      actors = [
        { kind: "joueur", entity: state.joueur },
        { kind: "monstre", entity: state.monstre },
      ].filter((a) => !!a.entity);
      activeIndex = state.tour === "joueur" ? 0 : 1;
    }

    const aliveSummon = state?.joueur ? getAliveSummon(scene, state.joueur) : null;
    let renderActors = actors;
    let renderActiveIndex = activeIndex;

    const alreadyListed =
      !!aliveSummon &&
      Array.isArray(actors) &&
      actors.some((a) => a && a.entity === aliveSummon);

    if (aliveSummon && !alreadyListed) {
      const summonActor = { kind: "invocation", entity: aliveSummon };
      const playerIdx = actors.findIndex((a) => a && a.kind === "joueur");
      const insertAt = playerIdx >= 0 ? playerIdx + 1 : 0;
      renderActors = [
        ...actors.slice(0, insertAt),
        summonActor,
        ...actors.slice(insertAt),
      ];

      if (insertAt <= renderActiveIndex) renderActiveIndex += 1;
      if (state?.summonActing) renderActiveIndex = insertAt;
    }

    renderActors.forEach((actor, idx) => {
      const el = document.createElement("div");
      el.setAttribute("role", "listitem");
      el.className = "combat-turn-actor";

      if (idx === renderActiveIndex) el.className += " is-active";
      if (!isActorAlive(actor)) el.className += " is-dead";
      if (actor.kind === "joueur") el.className += " is-player";
      else if (actor.kind === "invocation") el.className += " is-summon";
      else el.className += " is-monster";

      el.title = getActorName(actor);

      // Hover sur l'ordre des tours => affiche la fiche cible comme en survol monde.
      el.addEventListener("mouseenter", () => {
        scene.__combatHudHoverLock = true;
        scene.__combatHudHoverEntity = actor.entity || null;
        if ((actor.kind === "monstre" || actor.kind === "invocation") && actor.entity) {
          const tx =
            typeof actor.entity.currentTileX === "number"
              ? actor.entity.currentTileX
              : typeof actor.entity.tileX === "number"
                ? actor.entity.tileX
                : null;
          const ty =
            typeof actor.entity.currentTileY === "number"
              ? actor.entity.currentTileY
              : typeof actor.entity.tileY === "number"
                ? actor.entity.tileY
                : null;
          if (typeof tx === "number" && typeof ty === "number") {
            scene.__combatHudHoverSpellTile = { x: tx, y: ty };

            const state = scene.combatState;
            const activeSpell = state?.joueur ? getActiveSpell(state.joueur) : null;
            if (
              state &&
              state.enCours &&
              activeSpell &&
              scene.combatMap &&
              scene.combatGroundLayer
            ) {
              updateSpellRangePreview(
                scene,
                scene.combatMap,
                scene.combatGroundLayer,
                state.joueur,
                activeSpell,
                tx,
                ty
              );
            }
          }
        }
        if (typeof scene.showCombatTargetPanel === "function") {
          scene.showCombatTargetPanel(actor.entity);
        }
        if (actor.kind === "monstre" || actor.kind === "invocation") {
          if (typeof scene.showDamagePreview === "function") {
            scene.showDamagePreview(actor.entity);
          }
          if (typeof scene.showMonsterTooltip === "function") {
            scene.showMonsterTooltip(actor.entity);
          }
        }
      });
      el.addEventListener("mouseleave", () => {
        scene.__combatHudHoverEntity = null;
        scene.__combatHudHoverLock = false;
        scene.__combatHudHoverSpellTile = null;
        clearSpellRangePreview(scene);
        if (typeof scene.hideCombatTargetPanel === "function") {
          scene.hideCombatTargetPanel();
        }
        if (typeof scene.hideMonsterTooltip === "function") {
          scene.hideMonsterTooltip();
        }
        if (typeof scene.clearDamagePreview === "function") {
          scene.clearDamagePreview();
        }
      });

      // Clic : ouvre une fiche d'infos (effets, PV, etc.)
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();

        const state = scene.combatState;
        const activeSpell = state?.joueur ? getActiveSpell(state.joueur) : null;
        const canTryCast =
          state &&
          state.enCours &&
          state.tour === "joueur" &&
          state.joueur &&
          activeSpell &&
          actor?.entity &&
          actor.kind === "monstre" &&
          isActorAlive(actor) &&
          !ev.shiftKey &&
          !ev.ctrlKey &&
          !ev.altKey;

        if (canTryCast) {
          const tile = getEntityTile(actor.entity);
          if (tile) {
            const mapForCast = scene.combatMap || scene.map;
            const layerForCast = scene.combatGroundLayer || scene.groundLayer;
            const cast = tryCastActiveSpellAtTile(
              scene,
              state.joueur,
              tile.x,
              tile.y,
              mapForCast,
              layerForCast
            );
            if (cast) return;
          }
        }

        if (typeof scene.showCombatInspector === "function") {
          scene.showCombatInspector(actor.entity);
        }
      });

      const { hp, hpMax } = getActorHp(actor);
      const pct =
        hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;

      const hpBar = document.createElement("div");
      hpBar.className = "combat-turn-hp";
      const hpFill = document.createElement("div");
      hpFill.className = "combat-turn-hp-fill";
      hpFill.style.width = `${Math.round(pct * 100)}%`;
      hpBar.appendChild(hpFill);

      const avatar = document.createElement("div");
      avatar.className = "combat-turn-avatar";

      const img = document.createElement("img");
      img.className = "combat-turn-avatar-img";
      img.alt = "";
      const attached = ensureAvatarSrc(actor, img);
      if (attached) {
        avatar.appendChild(img);
      } else {
        const fallback = document.createElement("div");
        fallback.className = "combat-turn-avatar-fallback";
        fallback.textContent = getActorBadge(actor);
        avatar.appendChild(fallback);
      }

      el.appendChild(hpBar);
      el.appendChild(avatar);
      turnOrderListEl.appendChild(el);
    });
  };

  const updateIndicators = () => {
    const state = scene.combatState;
    if (!state || !state.enCours) {
      if (turnLabel) turnLabel.textContent = "-";
      if (roundValueEl) roundValueEl.textContent = "1";
      if (turnOrderListEl) turnOrderListEl.innerHTML = "";
      return;
    }

    const round = typeof state.round === "number" ? state.round : 1;
    if (roundValueEl) roundValueEl.textContent = String(round);

    if (state.summonActing) {
      turnLabel.textContent = "Invocation";
      return;
    }

    const actors = state.actors;
    if (actors && actors.length) {
      const idx = typeof state.actorIndex === "number" ? state.actorIndex : 0;
      turnLabel.textContent = getActorName(actors[idx]);
    } else {
      turnLabel.textContent = state.tour === "joueur" ? "Joueur" : "Monstre";
    }
  };

  const updateTargetPanel = () => {
    const state = scene.combatState;
    if (!state || !state.enCours) {
      document.body.classList.remove("combat-target-panel-visible");
      scene.combatHoveredEntity = null;
      return;
    }

    const target = scene.combatHoveredEntity;
    if (!target) {
      document.body.classList.remove("combat-target-panel-visible");
      return;
    }

    const isPlayerTarget =
      target === state.joueur ||
      target?.isSummon === true ||
      (target && !target.monsterId && target.texture?.key === "player");

    const name =
      target.displayName ||
      target.label ||
      target.monsterId ||
      (isPlayerTarget ? "Joueur" : "Cible");
    const isMonsterTarget = !!(target && target.monsterId);
    const targetLevel = isMonsterTarget
      ? (target.level ?? target.stats?.niveau ?? 1)
      : null;
    const stats = target.stats || {};
    const hp = typeof stats.hp === "number" ? stats.hp : stats.hpMax ?? 0;
    const hpMax = typeof stats.hpMax === "number" ? stats.hpMax : hp;
    const pa = stats.pa ?? 0;
    const pm = stats.pm ?? 0;

    if (targetPanelNameEl) {
      targetPanelNameEl.textContent =
        isMonsterTarget && typeof targetLevel === "number"
          ? `${name} - Niv. ${targetLevel}`
          : name;
    }
    if (targetPanelHpTextEl)
      targetPanelHpTextEl.textContent = `PV : ${hp}/${hpMax}`;
    if (targetPanelPaEl) targetPanelPaEl.textContent = String(pa);
    if (targetPanelPmEl) targetPanelPmEl.textContent = String(pm);

    const pct = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
    if (targetPanelHpFillEl) {
      targetPanelHpFillEl.style.width = `${Math.round(pct * 100)}%`;
    }

    if (targetPanelEl) {
      targetPanelEl.classList.toggle("combat-target-ally", isPlayerTarget);
      targetPanelEl.classList.toggle("combat-target-enemy", !isPlayerTarget);
    }

    document.body.classList.add("combat-target-panel-visible");
  };

  scene.showCombatTargetPanel = (entity) => {
    const state = scene.combatState;
    if (!state || !state.enCours) return;
    scene.combatHoveredEntity = entity || null;
    updateTargetPanel();
  };

  scene.hideCombatTargetPanel = () => {
    scene.combatHoveredEntity = null;
    document.body.classList.remove("combat-target-panel-visible");
  };

  scene.updateCombatTargetPanel = updateTargetPanel;

  scene.updateCombatUi = () => {
    updateIndicators();
    renderTurnOrder();
    updateTargetPanel();
    if (typeof scene.updateCombatInspector === "function") {
      scene.updateCombatInspector();
    }
  };

  // Bouton "FIN DU TOUR" (combat en cours)
  endTurnBtn.addEventListener("click", (event) => {
    event.stopPropagation();

    if (!scene.combatState || !scene.combatState.enCours) {
      return;
    }

    // Sécurité : on ne finit le tour que si c'est bien au joueur
    if (scene.combatState.tour !== "joueur") {
      return;
    }

    // Passe au prochain acteur dans l'ordre d'initiative
    const newTurn = passerTour(scene);
    if (!newTurn) return;

    // Si c'est un monstre qui joue ensuite, on lance son tour.
    if (newTurn === "monstre") {
      runSummonTurn(scene, () => runMonsterTurn(scene));
    }
  });

  // Bouton "PRÊT" (phase de préparation)
  if (readyBtn) {
    readyBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (!scene.prepState || !scene.prepState.actif) {
        return;
      }

      startCombatFromPrep(scene);

      const state = scene.combatState;
      if (!state || !state.enCours) return;
      if (typeof scene.updateCombatUi === "function") {
        scene.updateCombatUi();
      }

      // Si le monstre commence (initiative plus élevée), on lance tout de suite son tour.
      if (state.tour === "monstre") {
        runMonsterTurn(scene);
      }
    });
  }

  // Initialise l'affichage (utile en cas de retour depuis un combat sans reload).
  if (typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }
}
