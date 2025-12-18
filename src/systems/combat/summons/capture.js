import { addChatMessage } from "../../../chat/chat.js";
import { isMonsterCapturable } from "../../../config/captureRules.js";

function removeCaptureEffectFromEntity(entity) {
  if (!entity || !Array.isArray(entity.statusEffects)) return;
  entity.statusEffects = entity.statusEffects.filter(
    (e) => e && e.id !== "capture_essence"
  );
}

function upsertCaptureEffectOnEntity(entity, turnsLeft, caster) {
  if (!entity) return;
  entity.statusEffects = Array.isArray(entity.statusEffects) ? entity.statusEffects : [];

  const next = {
    id: "capture_essence",
    type: "capture",
    label: "Capture",
    turnsLeft: Math.max(0, turnsLeft | 0),
    sourceName: caster?.displayName || caster?.label || caster?.monsterId || "Joueur",
  };

  const idx = entity.statusEffects.findIndex((e) => e && e.id === next.id);
  if (idx >= 0) entity.statusEffects[idx] = next;
  else entity.statusEffects.push(next);
}

function getPlayerLevel(player) {
  return player?.levelState?.niveau ?? 1;
}

function getMonsterLevel(monster) {
  return monster?.level ?? 1;
}

export function canApplyCapture(scene, caster, targetMonster) {
  const state = scene?.combatState;
  if (!state || !state.enCours) return { ok: false, reason: "no_combat" };
  if (!caster || caster !== state.joueur) return { ok: false, reason: "not_player" };
  if (!targetMonster || !targetMonster.monsterId) return { ok: false, reason: "no_target" };

  const monsterId = targetMonster.monsterId;
  if (!isMonsterCapturable(monsterId)) return { ok: false, reason: "uncapturable" };

  const playerLevel = getPlayerLevel(caster);
  const monsterLevel = getMonsterLevel(targetMonster);
  if (playerLevel < monsterLevel) return { ok: false, reason: "level_too_low" };

  return { ok: true };
}

export function startCaptureAttempt(scene, caster, targetMonster, { playerTurns = 2 } = {}) {
  const state = scene?.combatState;
  if (!state || !state.enCours || !caster || !targetMonster) return false;

  // Nettoie une ancienne capture si elle existait (évite un effet "fantôme" sur l'ancienne cible).
  if (
    caster.captureState &&
    caster.captureState.targetEntity &&
    caster.captureState.targetEntity !== targetMonster
  ) {
    removeCaptureEffectFromEntity(caster.captureState.targetEntity);
  }

  const turns = Math.max(1, playerTurns | 0);

  caster.captureState = {
    targetEntity: targetMonster,
    targetMonsterId: targetMonster.monsterId,
    turnsLeft: turns,
    startedAt: Date.now(),
  };

  upsertCaptureEffectOnEntity(targetMonster, turns, caster);

  if (state.joueur) {
    const name =
      targetMonster.displayName || targetMonster.label || targetMonster.monsterId || "Monstre";
    addChatMessage(
      {
        kind: "combat",
        channel: "global",
        author: "Combat",
        text: `Capture lancée sur ${name} (${turns} tours).`,
      },
      { player: state.joueur }
    );
  }

  return true;
}

export function tickCaptureAttemptAtStartOfPlayerTurn(scene, player) {
  const state = scene?.combatState;
  if (!state || !state.enCours || !player) return;

  const cap = player.captureState;
  if (!cap || (cap.turnsLeft ?? 0) <= 0) {
    player.captureState = null;
    return;
  }

  cap.turnsLeft = (cap.turnsLeft ?? 0) - 1;

  if (cap.targetEntity) {
    if (cap.turnsLeft > 0) {
      upsertCaptureEffectOnEntity(cap.targetEntity, cap.turnsLeft, player);
    } else {
      removeCaptureEffectFromEntity(cap.targetEntity);
    }
  }
  if (cap.turnsLeft <= 0) {
    // Expirée : aucune capture.
    player.captureState = null;
    addChatMessage(
      {
        kind: "combat",
        channel: "global",
        author: "Combat",
        text: "Capture échouée (temps écoulé).",
      },
      { player }
    );
  }
}

export function tryResolveCaptureOnMonsterDeath(scene, deadMonster) {
  const state = scene?.combatState;
  const player = state?.joueur;
  if (!state || !state.enCours || !player || !deadMonster) return false;

  const cap = player.captureState;
  if (!cap) return false;

  const sameRef = cap.targetEntity === deadMonster;
  const sameId =
    cap.targetMonsterId && cap.targetMonsterId === deadMonster.monsterId;

  // On valide si la cible est bien celle marquée ET si la fenêtre n'est pas expirée.
  // Note : la fenêtre est décrémentée au début des tours joueur, donc tant que cap existe, c'est valide.
  if (!sameRef && !sameId) return false;

  const capturedId = deadMonster.monsterId;
  if (!capturedId) return false;

  player.capturedMonsterId = capturedId;
  player.capturedMonsterLevel = getMonsterLevel(deadMonster);
  player.captureState = null;
  if (cap.targetEntity) {
    removeCaptureEffectFromEntity(cap.targetEntity);
  }

  const name =
    deadMonster.displayName || deadMonster.label || deadMonster.monsterId || "Monstre";
  addChatMessage(
    {
      kind: "combat",
      channel: "global",
      author: "Combat",
      text: `Capture réussie : ${name} enregistré.`,
    },
    { player }
  );

  return true;
}
