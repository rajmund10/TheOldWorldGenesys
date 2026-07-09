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
import MinionSheet from '@/actor/sheets/MinionSheet';
import RivalSheet from '@/actor/sheets/RivalSheet';
import NemesisSheet from '@/actor/sheets/NemesisSheet';
import VehicleSheet from '@/actor/sheets/VehicleSheet';

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
		label: 'Karta Warhammer',
	});

	Actors.registerSheet('genesys', AuroraSheet, {
		types: ['character'],
		makeDefault: false,
		label: 'Aurora',
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
}
