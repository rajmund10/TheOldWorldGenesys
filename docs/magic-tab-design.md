# Magic Tab Design

## Goal

Add a dedicated `Magic` tab for character sheets that matches the actual structure of spellcasting in Genesys and the more restrictive, dangerous Old World overlay.

The tab should not behave like a classic spellbook from level-based fantasy games. In Genesys, magic is primarily a rules-driven spell construction system:

- the caster chooses a magic skill
- the caster chooses a magic action template
- the caster adds effects that modify the difficulty and outcome
- the final check is rolled as a normal Genesys check

The tab therefore needs to be a `spellcasting workbench`, not just a static list of spells.

## Rules Summary

### Genesys Core

Based on the magic rules section in the Genesys Core Rulebook:

- A character is a spellcaster only if they have at least `1 rank` in a magic skill.
- The core magic skills are `Arcana`, `Divine`, and `Primal`.
- Every spell is built from a `magic action` plus optional `additional effects`.
- The core action families are:
  - `Attack`
  - `Augment`
  - `Barrier`
  - `Conjure`
  - `Curse`
  - `Dispel`
  - `Heal`
  - `Utility`
- Some spells can be sustained with `Concentration`.
- Casting a magic action normally costs `2 strain`.
- Magic implements matter mechanically and can reduce difficulty inflation or add specific effects.
- Counterspelling and concentrating are part of the normal magic loop and should be surfaced in the UX.

### The Old World Overlay

Based on `The Old World: Grim and Perilous`, the overlay changes the feel of magic in several important ways:

- Magic is more restricted by `tradition`, `lore`, or `deity`.
- Wizard characters are tied to a specific `Lore of Magic`.
- Priestly characters gain access to deity-specific `Miracles`.
- The overlay introduces a matrix of `available magic actions and effects` by lore/deity.
- The overlay adds at least two new magic actions:
  - `Sense Magic`
  - `Transform`
- The overlay adds a new maneuver:
  - `Overcast`
- Arcane spellcasting can trigger `Miscast` and `The Curse of Tzeentch`.
- `Dispel` and `Sense Magic` explicitly do not cause Miscasts.
- Old World magic interacts directly with:
  - `corruption`
  - `warpstone`
  - `magic implements`
  - profession/specialization talents such as `Prepared Spell`, `College Wizard`, and lore-specific rules
- Some species impose hard restrictions:
  - dwarfs cannot learn Arcana/Divine
  - halflings cannot learn Arcana
  - gnomes are restricted to the Lore of Shadows if they gain spellcasting

### Important Design Consequence

The Old World overlay should not replace the core builder. It should constrain and enrich it.

The correct model is:

- `Genesys Core = universal spell construction engine`
- `Old World = gating, lore restrictions, miscast/corruption layer, and extra actions/effects`

## UX Design

The `Magic` tab should have four functional zones.

### 1. Caster Profile

Purpose: show whether and how the character can cast magic.

Contents:

- available magic skills and current ranks
- primary casting tradition:
  - `Arcana`
  - `Divine`
  - `Primal`
- Old World overlays:
  - selected `Lore of Magic`
  - selected `Deity/Miracle path`
  - species restrictions
  - whether the character can cast at all
- active magic implement
- current `strain`, `wounds`, and if relevant `corruption`
- derived notes:
  - `Miscast enabled`
  - `Dispel/Sense Magic do not miscast`
  - `Prepared Spell charges/presets available`

If the actor is not a caster, the tab should still render a readable empty state:

- why the actor cannot cast
- what is missing
- for Old World, whether the block comes from species, missing skill ranks, or missing specialization/profession unlock

### 2. Spell Builder

Purpose: create a spell from action + effects and push it into the existing roller pipeline.

Controls:

- `magic skill` selector
- `magic action` selector
- effect chips / toggles grouped by type
- target/range selection
- concentration toggle, if action supports it
- implement selector override, if more than one valid implement is equipped or carried
- Old World toggles:
  - `Overcast`
  - `Use warpstone`
  - `Miracle mode`
  - lore-specific effect availability

Live result panel:

- final difficulty
- final skill and linked characteristic
- automatic strain cost
- attack damage / healing / barrier preview where applicable
- warnings for invalid combinations
- warnings for restricted actions/effects
- Old World risk line:
  - `Miscast possible: yes/no`
  - `Corruption risk: none/low/high`

Primary action:

- `Cast`

The `Cast` button should call into a dedicated spell-building service that converts the builder state into a normal Genesys roll context and reuses the existing dice prompt/roller instead of inventing a second roller.

### 3. Prepared and Saved Spells

Purpose: support the table reality that players repeat common spell constructions even in a freeform system.

This section should not replace the builder. It should store `presets`.

Two kinds of presets:

- `Saved Formula`
  - freeform user-created preset
  - a convenience bookmark
- `Prepared Spell`
  - only available if the actor has the talent / rule support for it
  - mechanically meaningful in Old World

Each preset stores:

- label
- skill
- action
- selected effects
- optional notes
- default implement
- whether it is concentration-based

Actions:

- `Load into builder`
- `Cast now`
- `Edit`
- `Delete`

### 4. Active Magic State

Purpose: display persistent spell effects and encounter-state magic.

Contents:

- active concentration spell
- active barrier/augment/conjure effects created by the character
- current counterspell stance
- Old World ongoing penalties:
  - miscast escalation during encounter
  - temporary corruption flags
  - exposed/haunted/mental block style outcomes if modeled

This should be a lightweight tracker, not a full active effect replacement.

## Rules Engine Design

## Core Spell Definition Model

The system should define magic actions in config, not hardcode them into the Vue component.

Recommended structure:

```ts
type MagicActionId =
	| 'attack'
	| 'augment'
	| 'barrier'
	| 'conjure'
	| 'curse'
	| 'dispel'
	| 'heal'
	| 'utility'
	| 'senseMagic'
	| 'transform';

type MagicTradition = 'arcana' | 'divine' | 'primal';

type MagicActionDefinition = {
	id: MagicActionId;
	label: string;
	allowedSkills: MagicTradition[];
	baseDifficulty: number;
	supportsConcentration: boolean;
	canMiscast?: boolean;
	effects: MagicEffectDefinition[];
};
```

Effects should also be data-driven:

```ts
type MagicEffectDefinition = {
	id: string;
	label: string;
	difficultyMod: number;
	repeatable?: boolean;
	requiresLore?: string[];
	requiresDeity?: string[];
	oldWorldOnly?: boolean;
	coreOnly?: boolean;
};
```

This gives us a reusable engine for both base Genesys and Old World.

## Old World Restriction Layer

Instead of rewriting the action system, add a rules layer that filters what the actor can access.

Recommended flow:

1. Build the full core action/effect list.
2. Apply actor restrictions:
   - magic skills known
   - species restrictions
   - lore/deity restrictions
   - profession/specialization unlocks
3. Apply equipment effects:
   - active implement
   - warpstone
4. Apply encounter-state modifiers:
   - concentration
   - counterspell
   - miscast escalation
   - overcast

## Data Model Proposal

Add a new actor branch:

```ts
system.magic = {
	enabled: boolean,
	primarySkill: 'arcana' | 'divine' | 'primal' | null,
	lore: string | null,
	deity: string | null,
	activeImplementId: string | null,
	preparedSpells: MagicPreset[],
	savedFormulas: MagicPreset[],
	activeSpell: ActiveMagicState | null,
	encounterState: {
		counterspellActive: boolean,
		overcastLevel: 0,
		miscastModifier: 0,
	},
	restrictions: {
		canCast: boolean,
		arcanaAllowed: boolean,
		divineAllowed: boolean,
		primalAllowed: boolean,
	},
};
```

Important note:

- `corruption` itself should remain in the general Warhammer/actor data model, not be duplicated in `system.magic`
- the magic tab should read corruption, not own it

## Suggested Implementation Boundaries

### Phase 1: MVP

Ship a practical player-facing magic tab without full automation of every Old World edge case.

Scope:

- show tab
- detect spellcaster status
- list magic skills and implement
- builder for core actions
- difficulty calculator
- save/load presets
- cast through existing dice prompt
- Old World:
  - lore/deity selector display
  - filter illegal actions/effects
  - miscast warning state
  - corruption warning state

This gets the tab usable fast.

### Phase 2: Old World Deep Automation

Add:

- full lore/deity effect matrix
- prepared spell talent integration
- overcast automation
- miscast resolution helper
- active concentration tracker
- implement-specific automation
- talent-driven modifications from lore trees and professions

### Phase 3: GM/Advanced Tools

Add:

- magic tab support for NPC casters
- custom setting-specific action/effect definitions
- export/import spell formula libraries

## UI Placement in Current System

There is already a commented-out `Magic` tab hook in the actor sheets.

Recommended component path:

- `src/vue/sheets/actor/character/MagicTab.vue`

Recommended supporting modules:

- `src/magic/MagicActionDefinitions.ts`
- `src/magic/MagicEffectDefinitions.ts`
- `src/magic/MagicRulesEngine.ts`
- `src/magic/MagicPreset.ts`
- `src/magic/OldWorldMagicRules.ts`

Recommended sheet integration:

- enable the existing `Magic` nav item in:
  - `CharacterSheet.vue`
  - `WarhammerCharacterSheet.vue`
- render `MagicTab` in the tab body for both sheets
- hide the tab only if the actor type should never use magic

## Design Decisions

### 1. No classic spellbook first

The rules are action/effect driven, so the UX must be builder-first.

### 2. Presets are convenience, not ontology

Saved spells are user shortcuts and talent-backed prepared formulas, not the foundation of the system.

### 3. Old World is a restriction layer

This keeps the system maintainable and avoids building two separate magic systems.

### 4. Reuse the existing roll prompt

We should not create a second dice engine inside the magic tab.

### 5. Corruption belongs in the magic UX, but not only there

Old World magic is dangerous because it is linked to corruption, miscast, and specialization identity. The tab should surface this constantly.

## Final Recommendation

Implement the first version of the tab as:

- a `Magic` tab on character sheets
- a `builder + presets + active state` layout
- powered by a data-driven action/effect rules engine
- with Old World-specific restrictions and warnings layered on top

This fits both books:

- Genesys Core stays flexible and improvisational
- The Old World stays narrower, lore-bound, and dangerous
