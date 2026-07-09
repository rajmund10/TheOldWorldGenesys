/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file System Entry Point
 */

import { register as registerConfig, ready as readyConfigs } from '@/config';
import { register as registerCombat } from '@/combat';
import { register as registerSidebars } from '@/sidebar';
import { register as registerDice } from '@/dice';
import { registerLegacyDiceImageCompatibility } from '@/dice/legacyDiceImages';
import { register as registerEnrichers } from '@/enrichers';
import { register as registerFonts } from '@/fonts';
import { register as registerHandlebarsHelpers } from '@/handlebars';
import { register as registerSettings } from '@/settings';
import { KEY_DEFAULT_DIFFICULTY } from '@/settings/campaign';

import { register as registerStoryPointTracker } from '@/app/StoryPointTracker';
import { register as registerActors, AdversaryTypes } from '@/actor';
import { register as registerToken } from '@/token';
import { register as registerEffects } from '@/effects';
import { register as registerItems, CharacterCreationItemTypes, EquipmentItemTypes } from '@/item';
import { register as registerVehicles } from '@/actor/data/VehicleDataModel';
import DicePrompt, { registerWorker } from '@/app/DicePrompt';

import GenesysActor from '@/actor/GenesysActor';
import GenesysCompendium from '@/sidebar/GenesysCompendium';
import { registerChaosManifestations } from '@/magic/ChaosManifestations';
import { registerAttackResolution } from '@/combat/AttackResolution';
import { registerSymbolSpending } from '@/dice/SymbolSpending';

import './scss/index.scss';

Hooks.once('init', async () => {
	// System Documents
	registerActors();
	registerToken();
	registerEffects();
	registerItems();

	// Misc. modules with one-time registrations
	registerCombat();
	registerSidebars();
	registerEnrichers();
	registerFonts();
	registerDice();
	registerLegacyDiceImageCompatibility();
	registerHandlebarsHelpers();
	registerSettings();
	registerConfig();
	registerChaosManifestations();
	registerAttackResolution();
	registerSymbolSpending();
});

Hooks.once('ready', async () => {
	readyConfigs();

	registerStoryPointTracker();
	registerVehicles();
	registerWorker();
});

function constructOptGroup(select: HTMLSelectElement, groupLabel: string, optValues?: string[]): HTMLOptGroupElement {
	const options = select.querySelectorAll<HTMLOptionElement>(':scope > option');
	const optgroup = document.createElement('optgroup');

	optgroup.label = groupLabel;
	optgroup.append(...Array.from(options).filter((option) => !optValues || optValues.includes(option.value)));

	return optgroup;
}

// Add options groups to the dialog that appears when creating an actor or item.
Hooks.on('renderDialog', (_dialog: Dialog, html: JQuery<HTMLElement>, _data: object) => {
	const container = html[0];

	// Cheks if it's the item creation dialog and categorize the options from the dropdown
	if (container.classList.contains('dialog-item-create')) {
		const select = container.querySelector<HTMLSelectElement>('select[name=type]');

		if (select) {
			select.append(
				constructOptGroup(select, game.i18n.localize('Genesys.DialogGroups.Item.CharacterCreation'), CharacterCreationItemTypes),
				constructOptGroup(select, game.i18n.localize('Genesys.DialogGroups.Item.Equipment'), EquipmentItemTypes),
				constructOptGroup(select, game.i18n.localize('Genesys.DialogGroups.Item.Other')),
			);
			select.querySelector('option')!.selected = true;
		}

		// Cheks if it's the actor creation dialog and categorize the options from the dropdown
	} else if (container.classList.contains('dialog-actor-create')) {
		const select = container.querySelector<HTMLSelectElement>('select[name=type]');

		if (select) {
			select.append(constructOptGroup(select, game.i18n.localize('Genesys.DialogGroups.Actor.Adversary'), AdversaryTypes), constructOptGroup(select, game.i18n.localize('Genesys.DialogGroups.Actor.Other')));
			select.querySelector('option')!.selected = true;
		}
	}
});

// Makes the dice icon at the bottom of the chat to function as a shortcut to call the dice prompt.
Hooks.on('renderChatLog', (_sidebar: SidebarTab, html: JQuery<HTMLElement>, _data: object) => {
	if (game.version.startsWith('13')) {
		return;
	}

	const diceIcon = html.find('#chat-controls > .chat-control-icon');
	diceIcon.on('click', async (_event) => {
		const controlledTokens = canvas.tokens.controlled;

		let targetActor;
		if (controlledTokens.length > 1) {
			ui.notifications.error(game.i18n.localize('Genesys.Notifications.SelectNoneOrOneTokenForAction'));
			return;
		} else if (controlledTokens.length === 1) {
			if (controlledTokens[0].actor?.type === 'vehicle') {
				ui.notifications.error(game.i18n.localize('Genesys.Notifications.InvalidTokenTypeForAction'));
				return;
			} else {
				targetActor = (controlledTokens[0].actor ?? undefined) as GenesysActor | undefined;
			}
		}

		await DicePrompt.promptForRoll(targetActor, '');
	});
});

// Allow to open the DicePrompt on chat command /gendr (for GENesys Dice Roller), thus allowing to open it from a macro
Hooks.on('chatMessage', (chatLog: ChatLog, message: string, _chatData: any) => {
	const commandR = /^\/gendr(?:oll)?/i;
	if (message.match(commandR)) {
		DicePrompt.promptForRoll(undefined, '');
		return false;
	}
	return true;
});

// Create wiki links in the description section of certain settings. We use a hook here since there is no way to
// directly add links as any HTML is escaped.
const wikiLinkPattern = /\[\[([^|\]]+)(\|([^\]]+))?\]\]/g;
Hooks.on('renderSettingsConfig', (_app: SettingsConfig, html: JQuery<HTMLElement>, _data: object) => {
	const theHtml = game.version.startsWith('13') ? (html as unknown as HTMLElement) : html[0];

	let note = theHtml.querySelector(`[data-setting-id='genesys.${KEY_DEFAULT_DIFFICULTY}'] > .notes`);
	if (!note) {
		// FVTT v13 has a different way for structuring their settings.
		note = theHtml.querySelector(`.form-fields:has(input[name='genesys.${KEY_DEFAULT_DIFFICULTY}']) + p.hint`);
	}

	if (note) {
		note.innerHTML = note.innerHTML.replaceAll(wikiLinkPattern, (_m, g1, _g2, g3) => {
			return `<a href="https://github.com/Mezryss/FVTT-Genesys/wiki/${g1}" target="_blank">${g3 ? g3 : g1}</a>`;
		});
	}
});

// Currently there is no way to specify the class for rendering a compendium collection application since it is
// hardcoded. However, we can cheat the system into using our own implementation by manually instanciating it and
// patching the compendium. Also, because we want to apply this even to newly created compendia we run this on every
// compendium directory bar rendering (it's triggered right after a new compendium is created). We went with this way
// of cheating the system in order to maintain compatibility with FVTTv10+ and to capture newly created compendia.
// For context, we want to perform this patch to allow sheets with drop areas to properly highlight when something is
// being dragged from a compendium.
const COMPENDIUM_PATCHING = {
	PATCHED: new Set<string>(),
	TYPES: ['Actor', 'Item'],
};
Hooks.on('renderCompendiumDirectory', (_sidebar: SidebarTab, _html: JQuery<HTMLElement>, _data: object) => {
	for (const pack of game.packs.values()) {
		if (!COMPENDIUM_PATCHING.PATCHED.has(pack.metadata.id)) {
			COMPENDIUM_PATCHING.PATCHED.add(pack.metadata.id);
			if (COMPENDIUM_PATCHING.TYPES.includes(pack.metadata.type)) {
				pack.apps.shift();
				pack.apps.push(new GenesysCompendium({ collection: pack }));
			}
		}
	}
});
