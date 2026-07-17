/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Warhammer Character Sheet (with Corruption)
 */

import VueWarhammerCharacterSheet from '@/vue/sheets/actor/WarhammerCharacterSheet.vue';
import CharacterSheet from '@/actor/sheets/CharacterSheet';
import { OLD_WORLD_SKILL_NAMES } from '@/actor/skills/DefaultSkills';

/**
 * Actor sheet used for Player Characters in Warhammer setting (includes Corruption).
 *
 * Keep the Warhammer-specific Vue layout, but reuse the character sheet drop and
 * career/specialization logic so both sheets behave the same mechanically.
 */
export default class WarhammerSheet extends CharacterSheet {
	override get vueComponent() {
		return VueWarhammerCharacterSheet;
	}

	override get defaultSkillNames() {
		return OLD_WORLD_SKILL_NAMES;
	}

	override get defaultSkillProfileId() {
		return 'old-world';
	}

	override get currencyLabel() {
		return 'Korony';
	}

	override get currencyMode() {
		return 'warhammer' as const;
	}

	static override get defaultOptions() {
		return {
			...super.defaultOptions,
			classes: ['genesys', 'sheet', 'actor', 'character', 'warhammer', 'profile-old-world'],
		};
	}
}
