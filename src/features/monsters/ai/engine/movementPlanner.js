import {
  chooseStepTowardsTarget,
  findPathToReachAdjacentToTarget,
} from "../aiUtils.js";
import { getEntityTile } from "./targetSelector.js";

function buildStepPath(scene, map, monster, fromTile, targetTile, steps, fleeing) {
  const path = [];
  let cx = fromTile.x;
  let cy = fromTile.y;
  for (let i = 0; i < steps; i += 1) {
    const next = chooseStepTowardsTarget(
      scene,
      map,
      monster,
      cx,
      cy,
      targetTile.x,
      targetTile.y,
      fleeing
    );
    if (!next) break;
    path.push(next);
    cx = next.x;
    cy = next.y;
  }
  return path;
}

export function planMovement(scene, state, monster, target, profile, map) {
  if (!scene || !state || !monster || !target || !map) return [];
  const maxSteps = Math.max(0, state.pmRestants ?? 0);
  if (maxSteps <= 0) return [];

  const monsterTile = getEntityTile(monster);
  const targetTile = getEntityTile(target);
  if (!monsterTile || !targetTile) return [];

  const role = profile?.role || "melee";
  const dist =
    Math.abs(targetTile.x - monsterTile.x) + Math.abs(targetTile.y - monsterTile.y);

  if (role === "melee") {
    const path =
      findPathToReachAdjacentToTarget(
        scene,
        map,
        monsterTile.x,
        monsterTile.y,
        targetTile.x,
        targetTile.y,
        60,
        monster
      ) || [];
    return path.slice(0, maxSteps);
  }

  const desiredMin = Math.max(1, profile?.desiredMinRange ?? 3);
  const desiredMax = Math.max(desiredMin, profile?.desiredMaxRange ?? 6);

  if (dist < desiredMin) {
    return buildStepPath(scene, map, monster, monsterTile, targetTile, maxSteps, true);
  }

  if (dist > desiredMax) {
    return buildStepPath(scene, map, monster, monsterTile, targetTile, maxSteps, false);
  }

  return [];
}
