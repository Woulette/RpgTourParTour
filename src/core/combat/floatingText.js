export function showFloatingText(scene, x, y, text, options = {}) {
  if (!scene || typeof scene.add?.text !== "function") return null;
  if (typeof x !== "number" || typeof y !== "number") return null;

  const {
    color = "#ffffff",
    stroke = "#000000",
    strokeThickness = 3,
    fontSize = 18,
    duration = 1300,
    rise = 18,
    depth = 10000,
    resolution = 2,
  } = options || {};

  const t = scene.add.text(x, y, String(text ?? ""), {
    fontFamily: "Arial",
    fontSize,
    color,
    stroke,
    strokeThickness,
  });

  if (scene.hudCamera) {
    scene.hudCamera.ignore(t);
  }
  t.setDepth(depth);
  if (typeof t.setResolution === "function" && resolution) {
    t.setResolution(resolution);
  }

  if (scene.tweens?.add) {
    scene.tweens.add({
      targets: t,
      y: t.y - rise,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  } else {
    scene.time?.delayedCall?.(duration, () => t.destroy());
  }

  return t;
}

function getFloatingKey(scene, entity) {
  if (!scene || !entity) return null;
  if (entity.__floatingTextKey) return entity.__floatingTextKey;
  const next = (scene.__floatingTextKeySeq = (scene.__floatingTextKeySeq || 0) + 1);
  entity.__floatingTextKey = `${entity.monsterId || entity.texture?.key || "ent"}_${next}`;
  return entity.__floatingTextKey;
}

export function showFloatingTextOverEntity(scene, entity, text, options = {}) {
  if (!scene || !entity) return null;

  const yOffset =
    typeof options.yOffset === "number"
      ? options.yOffset
      : typeof entity.displayHeight === "number" && entity.displayHeight > 0
      ? Math.max(
          40,
          Math.round(
            entity.displayHeight * (typeof entity.originY === "number" ? entity.originY : 0.5) +
              12
          )
        )
      : typeof scene.combatMap?.tileHeight === "number"
      ? scene.combatMap.tileHeight
      : 56;

  // Empile / décale les textes pour éviter la superposition.
  const key = getFloatingKey(scene, entity);
  const now = Date.now();
  const registry =
    scene.__floatingTextRegistry || (scene.__floatingTextRegistry = new Map());
  const entries = Array.isArray(registry.get(key)) ? registry.get(key) : [];

  const baseDuration =
    typeof options.duration === "number" ? options.duration : 900;
  const delayMs =
    typeof options.delayMs === "number" ? options.delayMs : 0;

  // Quand plusieurs textes se déclenchent en même temps (PA + PM, etc),
  // on les séquence dans le temps mais ils partent tous du même point
  // (même altitude / direction / vitesse) pour rester lisibles.
  const sequenceStepMs =
    typeof options.sequenceStepMs === "number" && options.sequenceStepMs >= 0
      ? options.sequenceStepMs
      : 220;

  const alive = entries.filter((e) => e && typeof e.endAt === "number" && e.endAt > now);
  const stackSlot =
    typeof options.stackSlot === "number" && options.stackSlot >= 0
      ? Math.floor(options.stackSlot)
      : null;

  // Par défaut, on empile simplement dans l'ordre d'apparition.
  // Si `stackSlot` est fourni, on force une "colonne" (utile pour PA/PM) :
  // - slot 0 = plus bas, slot 1 = au-dessus
  // - si plusieurs textes utilisent le même slot, on les décale encore vers le haut
  const sameSlotCount =
    stackSlot === null ? 0 : alive.filter((e) => e?.slot === stackSlot).length;
  const stackIndex = stackSlot === null ? alive.length : stackSlot + sameSlotCount * 2;

  const finalDelayMs = Math.max(0, delayMs) + stackIndex * sequenceStepMs;
  const totalLife = Math.max(0, baseDuration) + finalDelayMs;

  const dx =
    typeof options.xOffset === "number"
      ? options.xOffset
      : 0;
  const dy = 0;

  const spawn = () => {
    const mergedOptions = { ...options };
    if (typeof mergedOptions.depth !== "number") {
      mergedOptions.depth =
        typeof entity.depth === "number" ? entity.depth + 1000 : 10000;
    }
    const t = showFloatingText(
      scene,
      entity.x + dx,
      entity.y - yOffset - dy,
      text,
      mergedOptions
    );
    return t;
  };

  alive.push({ endAt: now + totalLife, slot: stackSlot });
  registry.set(key, alive);

  if (finalDelayMs > 0 && scene.time?.delayedCall) {
    scene.time.delayedCall(finalDelayMs, spawn);
    return null;
  }
  return spawn();
}
