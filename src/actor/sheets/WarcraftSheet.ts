/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @file Warcraft Character Sheet
 */

import CharacterSheet from '@/actor/sheets/CharacterSheet';
import { WARCRAFT_SKILL_NAMES } from '@/actor/skills/DefaultSkills';
import VueWarcraftCharacterSheet from '@/vue/sheets/actor/WarcraftCharacterSheet.vue';

/**
 * Warcraft character sheet using the setting's own skill and currency profile.
 */
export default class WarcraftSheet extends CharacterSheet {
	override get vueComponent() {
		return VueWarcraftCharacterSheet;
	}

	override get defaultSkillNames() {
		return WARCRAFT_SKILL_NAMES;
	}

	override get defaultSkillProfileId() {
		return 'warcraft';
	}

	override get currencyLabel() {
		return 'Złoto';
	}

	override get currencyMode() {
		return 'legacy' as const;
	}

	static override get defaultOptions() {
		return {
			...super.defaultOptions,
			classes: ['genesys', 'sheet', 'actor', 'character', 'profile-warcraft'],
		};
	}
}
