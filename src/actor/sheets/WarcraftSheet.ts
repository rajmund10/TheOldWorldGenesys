/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @file Warcraft Character Sheet
 */

import CharacterSheet from '@/actor/sheets/CharacterSheet';

/**
 * Placeholder Warcraft character sheet.
 *
 * It currently mirrors the base Genesys sheet, but keeps its own registration
 * and profile id so Warcraft-specific skills and rules can be wired in later.
 */
export default class WarcraftSheet extends CharacterSheet {
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
