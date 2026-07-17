/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Aurora Character Sheet
 */

import CharacterSheet from '@/actor/sheets/CharacterSheet';

/**
 * Aurora currently mirrors the base Genesys character sheet.
 *
 * It keeps a separate sheet registration and skill profile so Aurora-specific
 * currency and skills can be wired in without changing the original sheet.
 */
export default class AuroraSheet extends CharacterSheet {
	override get defaultSkillProfileId() {
		return 'aurora';
	}

	override get currencyLabel() {
		return 'Waluta';
	}

	override get currencyMode() {
		return 'legacy' as const;
	}
}
