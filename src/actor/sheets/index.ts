/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Actor Sheet Registration
 */

import CharacterSheet from '@/actor/sheets/CharacterSheet';
import WarhammerSheet from '@/actor/sheets/WarhammerSheet';
import AuroraSheet from '@/actor/sheets/AuroraSheet';
import WarcraftSheet from '@/actor/sheets/WarcraftSheet';
import MinionSheet from '@/actor/sheets/MinionSheet';
import RivalSheet from '@/actor/sheets/RivalSheet';
import NemesisSheet from '@/actor/sheets/NemesisSheet';
import VehicleSheet from '@/actor/sheets/VehicleSheet';
import { normalizeGameProfile, type GenesysGameProfile } from '@/system/GameProfile';

function getDefaultCharacterSheetClass(profile: GenesysGameProfile) {
	switch (profile) {
		case 'old-world':
			return WarhammerSheet;
		case 'aurora':
			return AuroraSheet;
		case 'warcraft':
			return WarcraftSheet;
		case 'genesys':
		default:
			return CharacterSheet;
	}
}

export function applyDefaultCharacterSheetForProfile(profile: GenesysGameProfile = normalizeGameProfile(CONFIG.genesys?.settings?.gameProfile)) {
	const characterSheets = CONFIG.Actor.sheetClasses.character ?? {};
	const defaultSheetClass = getDefaultCharacterSheetClass(profile);

	for (const sheetConfig of Object.values(characterSheets)) {
		sheetConfig.default = sheetConfig.cls === defaultSheetClass;
	}
}

export function register() {
	Actors.unregisterSheet('core', ActorSheet);

	Actors.registerSheet('genesys', CharacterSheet, {
		types: ['character'],
		makeDefault: true,
		label: 'Karta Genesys',
	});

	Actors.registerSheet('genesys', WarhammerSheet, {
		types: ['character'],
		makeDefault: false,
		label: 'The Old World',
	});

	Actors.registerSheet('genesys', AuroraSheet, {
		types: ['character'],
		makeDefault: false,
		label: 'Aurora',
	});

	Actors.registerSheet('genesys', WarcraftSheet, {
		types: ['character'],
		makeDefault: false,
		label: 'Warcraft',
	});

	Actors.registerSheet('genesys', MinionSheet, {
		types: ['minion'],
		makeDefault: true,
	});

	Actors.registerSheet('genesys', RivalSheet, {
		types: ['rival'],
		makeDefault: true,
	});

	Actors.registerSheet('genesys', NemesisSheet, {
		types: ['nemesis'],
		makeDefault: true,
	});

	Actors.registerSheet('genesys', VehicleSheet, {
		types: ['vehicle'],
		makeDefault: true,
	});

	applyDefaultCharacterSheetForProfile();
	(Hooks as any).on('genesysGameProfileChanged', (profile: GenesysGameProfile) => applyDefaultCharacterSheetForProfile(profile));
	Hooks.once('ready', () => applyDefaultCharacterSheetForProfile());
}
