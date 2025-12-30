# IA Monsters

Goal: scalable AI for hundreds of monsters and spells, with consistent behavior,
low CPU cost, and easy tuning from data.

## Core idea: Action Scoring
Each monster computes a list of possible actions, scores them, and picks the best.
Actions include movement, spell casts, buffs, or positioning.

### Action Types
- Move: approach, kite, flank, retreat.
- Cast: single target, AOE, support, control.
- Wait: do nothing if no safe/good action exists.

### Scoring (per action)
Each action returns a numeric score. Highest score wins.
Use weights from the monster role profile.

Example score inputs:
- Target distance (preferred range, minimum range).
- Expected damage or control value.
- Ally needs (buff missing, low HP).
- Self survival (current HP, danger tiles).
- Cooldown availability.
- Turn economy (movement + cast priority).

## Roles and Profiles
Each monster has one profile with multiple weighted roles.
This avoids one AI per monster and keeps behavior flexible.

Example profile:
roles:
  burst:   0.7
  support: 0.3

Role weights influence action scoring:
- burst: prefer high damage, low delay, focus on weakest target.
- support: prefer buffs/heals, prioritize allies below HP thresholds.
- control: prefer slows, stuns, area denial.
- tank: prefer proximity, taunt, soak.
- ranged: prefer distance, safe tiles.

## Phases (Optional)
Change weights by HP thresholds for variety.

Example:
- HP > 70%: burst 0.7, support 0.3
- HP 30-70%: burst 0.5, support 0.5
- HP < 30%: support 0.7, burst 0.3

## Decision Flow (Turn-Based)
1. Build action list (spells + movement).
2. Filter by availability (cooldown, range, line of sight).
3. Score each action using the role profile + context.
4. Pick best action (or top-N random for variety).
5. Execute (move then cast if needed).

## Variability Without Chaos
- Use a small random factor in scores (ex: +/- 5%).
- Allow top 2-3 actions to be picked with weighted randomness.
- Keep minimum rules strict (no invalid cast).

## Data-Driven Tuning
Store per spell metadata:
- type: damage | buff | heal | control
- range_min, range_max
- area: size, shape
- priority tags: "finisher", "self-buff", "anti-shield"

Store per monster metadata:
- role weights
- phase thresholds
- risk tolerance (0-1)
- target preference (lowest HP, closest, highest threat)

## Example: Cedre Monster
Role weights:
- burst: 0.7
- support: 0.3

Behavior:
- Burst by default.
- Cast buff if ally missing buff or ally HP < 60%.
- If no ally needs support, prefer damage.

## Next Steps (Optional)
- Build a generic "evaluateAction(action, context, profile)".
- Add unit tests for scoring rules.
- Expose tuning in JSON for quick iteration.
