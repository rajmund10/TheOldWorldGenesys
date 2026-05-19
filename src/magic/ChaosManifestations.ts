import GenesysActor from '@/actor/GenesysActor';
import type { GenesysRollResults } from '@/dice/GenesysRoller';
import StoryPointTracker from '@/app/StoryPointTracker';
import type GenesysCombat from '@/combat/GenesysCombat';

const FLAG_SCOPE = 'genesys';
const CHAT_FLAG_KEY = 'chaosManifestation';
const COMBAT_FLAG_KEY = 'chaosManifestationModifier';
const TABLE_NAME = 'Efekty Manifestacji Chaosu';

export type ChaosManifestationRollMetadata = {
	enabled: boolean;
	actionId?: string | null;
};

export type ChaosManifestationChatData = {
	actorUuid: string;
	threats: number;
	despairs: number;
	actionId?: string | null;
	resolved?: boolean;
};

export type ChaosManifestationChoice = {
	id: 'minor-threat' | 'moderate-threat' | 'major-threat' | 'major-despair' | 'catastrophic-despair';
	labelKey: string;
	fallbackLabel: string;
	usedSymbols: string;
	currentModifier: number;
	nextModifier: number;
};

type ManifestationResultData = {
	label: string;
	usedSymbols: string;
	baseResult: number;
	categoryModifier: number;
	encounterModifier: number;
	talentModifier: number;
	finalResult: number;
	effect: string;
};

const CHOICES: Record<ChaosManifestationChoice['id'], ChaosManifestationChoice> = {
	'minor-threat': {
		id: 'minor-threat',
		labelKey: 'Genesys.ChaosManifestation.Minor',
		fallbackLabel: 'Minor Manifestation',
		usedSymbols: 'h',
		currentModifier: 0,
		nextModifier: 10,
	},
	'moderate-threat': {
		id: 'moderate-threat',
		labelKey: 'Genesys.ChaosManifestation.Moderate',
		fallbackLabel: 'Moderate Manifestation',
		usedSymbols: 'hh',
		currentModifier: 20,
		nextModifier: 10,
	},
	'major-threat': {
		id: 'major-threat',
		labelKey: 'Genesys.ChaosManifestation.Major',
		fallbackLabel: 'Major Manifestation',
		usedSymbols: 'hhh',
		currentModifier: 40,
		nextModifier: 20,
	},
	'major-despair': {
		id: 'major-despair',
		labelKey: 'Genesys.ChaosManifestation.Major',
		fallbackLabel: 'Major Manifestation',
		usedSymbols: 'd',
		currentModifier: 40,
		nextModifier: 20,
	},
	'catastrophic-despair': {
		id: 'catastrophic-despair',
		labelKey: 'Genesys.ChaosManifestation.Catastrophic',
		fallbackLabel: 'Catastrophic Manifestation',
		usedSymbols: 'dd',
		currentModifier: 100,
		nextModifier: 20,
	},
};

function localize(key: string, fallback: string, data?: Record<string, string | number>) {
	if (game?.i18n) {
		const localized = data ? game.i18n.format(key, data) : game.i18n.localize(key);
		if (localized !== key) {
			return localized;
		}
	}

	return fallback;
}

function normalizeName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function symbolsToEnricher(symbols: string) {
	return symbols
		.split('')
		.map((symbol) => `@sym[${symbol}]`)
		.join(' ');
}

function formatModifier(value: number) {
	return value >= 0 ? `+${value}` : String(value);
}

function symbolsToInlineHtml(symbols: string) {
	return `<span class="font-genesys-symbols nolig chaos-manifestation-choice-symbols">${symbols}</span>`;
}

function modifierToInlineHtml(value: number) {
	return `<span class="chaos-manifestation-choice-modifier">${formatModifier(value)}</span>`;
}

export function getChaosManifestationChoices({ threats, despairs }: Pick<ChaosManifestationChatData, 'threats' | 'despairs'>) {
	const choices: ChaosManifestationChoice[] = [];

	if (threats >= 1) choices.push(CHOICES['minor-threat']);
	if (threats >= 2) choices.push(CHOICES['moderate-threat']);
	if (threats >= 3) choices.push(CHOICES['major-threat']);
	if (despairs >= 1) choices.push(CHOICES['major-despair']);
	if (despairs >= 2) choices.push(CHOICES['catastrophic-despair']);

	return choices;
}

function hasExcellentCollegeWizard(actor: GenesysActor) {
	return Array.from(actor.items).some((item) => item.type === 'talent' && normalizeName(item.name) === normalizeName('Czarodziej Kolegium [Dos.]'));
}

function canSpendStoryPointForActor(actor: GenesysActor) {
	const storyPoints = StoryPointTracker.instance?.storyPoints;
	if (!storyPoints) {
		return false;
	}

	return actor.type === 'character' ? storyPoints.player > 0 : storyPoints.gm > 0;
}

async function spendStoryPointForActor(actor: GenesysActor) {
	await StoryPointTracker.spendStoryPoint(actor.type === 'character' ? 'playerPool' : 'gmPool');
}

function getActiveCombat() {
	const combat = game.combat as GenesysCombat | null;
	return combat?.started ? combat : null;
}

function getEncounterModifier(combat: GenesysCombat | null) {
	return Number(combat?.getFlag(FLAG_SCOPE, COMBAT_FLAG_KEY) ?? 0);
}

async function increaseEncounterModifier(combat: GenesysCombat | null, amount: number) {
	if (!combat) {
		return;
	}

	await combat.setFlag(FLAG_SCOPE, COMBAT_FLAG_KEY, getEncounterModifier(combat) + amount);
}

function getTable() {
	return game.tables.find((table) => normalizeName(table.name) === normalizeName(TABLE_NAME));
}

function getTableResultText(table: RollTable, result: number) {
	const lookupResult = Math.min(result, 999);
	const tableResult = table.results.find((entry) => {
		const range = (entry as unknown as { range?: [number, number] }).range;
		return !!range && range[0] <= lookupResult && range[1] >= lookupResult;
	});

	return (tableResult as unknown as { text?: string } | undefined)?.text ?? localize('Genesys.ChaosManifestation.MissingResult', 'No matching result found.');
}

function getChatData(metadata: ChaosManifestationRollMetadata | undefined, actor: GenesysActor | undefined, results: GenesysRollResults) {
	if (!metadata?.enabled || !actor) {
		return undefined;
	}

	const data: ChaosManifestationChatData = {
		actorUuid: actor.uuid,
		threats: Math.max(0, results.netThreat),
		despairs: results.totalDespair,
		actionId: metadata.actionId,
	};

	return getChaosManifestationChoices(data).length > 0 ? data : undefined;
}

export function buildChaosManifestationRollData(metadata: ChaosManifestationRollMetadata | undefined, actor: GenesysActor | undefined, results: GenesysRollResults) {
	const flagData = getChatData(metadata, actor, results);
	return flagData
		? {
				template: true,
				flagData,
			}
		: undefined;
}

async function createManifestationMessage(actor: GenesysActor, data: ManifestationResultData) {
	const html = await renderTemplate('systems/genesys/templates/chat/chaos-manifestation.hbs', data);
	const content = await TextEditor.enrichHTML(html, { async: true });

	await ChatMessage.create({
		user: game.user.id,
		speaker: { actor: actor.id },
		content,
	});
}

export async function resolveManifestation(actor: GenesysActor, sourceMessage: ChatMessage, choice: ChaosManifestationChoice, useStoryPoint: boolean) {
	const table = getTable();
	if (!table) {
		ui.notifications.warn(localize('Genesys.ChaosManifestation.MissingTable', 'Chaos Manifestation table was not found.'));
		return;
	}

	if (useStoryPoint) {
		if (!hasExcellentCollegeWizard(actor) || !canSpendStoryPointForActor(actor)) {
			ui.notifications.warn(localize('Genesys.Notifications.NotEnoughStoryPoints', "You can't spend Story Points you don't have!"));
			return false;
		}

		await spendStoryPointForActor(actor);
	}

	let baseResult = 1;
	if (!useStoryPoint) {
		const roll = new Roll('1d100');
		await roll.evaluate();
		baseResult = Number(roll.total ?? 0);
	}

	const combat = getActiveCombat();
	const encounterModifier = getEncounterModifier(combat);
	const talentModifier = Number((actor.systemData as { chaosManifestationModifier?: number }).chaosManifestationModifier ?? 0);
	const finalResult = Math.max(1, baseResult + choice.currentModifier + encounterModifier + talentModifier);

	await increaseEncounterModifier(combat, choice.nextModifier);
	await createManifestationMessage(actor, {
		label: localize(choice.labelKey, choice.fallbackLabel),
		usedSymbols: symbolsToEnricher(choice.usedSymbols),
		baseResult,
		categoryModifier: choice.currentModifier,
		encounterModifier,
		talentModifier,
		finalResult,
		effect: getTableResultText(table, finalResult),
	});
	await sourceMessage.setFlag(FLAG_SCOPE, `${CHAT_FLAG_KEY}.resolved`, true);
	return true;
}

async function promptForManifestation(actor: GenesysActor, sourceMessage: ChatMessage, data: ChaosManifestationChatData) {
	const choices = getChaosManifestationChoices(data);
	if (!choices.length) {
		return;
	}

	const hasExcellentTalent = hasExcellentCollegeWizard(actor);
	const canUseStoryPoint = hasExcellentTalent && canSpendStoryPointForActor(actor);
	const content = `
		<p>${localize('Genesys.ChaosManifestation.PromptHint', 'Choose one Manifestation caused by this roll.')}</p>
		${
			hasExcellentTalent
				? `<label class="chaos-manifestation-story-point">
					<input type="checkbox" name="useStoryPoint" ${canUseStoryPoint ? '' : 'disabled'}>
					${localize('Genesys.ChaosManifestation.UseStoryPoint', 'Use Story Point')}
				</label>`
				: ''
		}
	`;

	await new Promise<void>((resolve) => {
		new Dialog({
			title: localize('Genesys.ChaosManifestation.Title', 'Chaos Manifestation'),
			content,
			buttons: Object.fromEntries(
				choices.map((choice) => [
					choice.id,
					{
						label: `
							<span class="chaos-manifestation-choice-label">${localize(choice.labelKey, choice.fallbackLabel)}</span>
							<span class="chaos-manifestation-choice-meta">
								${symbolsToInlineHtml(choice.usedSymbols)}
								${modifierToInlineHtml(choice.currentModifier)}
							</span>
						`,
						callback: async (html) => {
							const useStoryPoint = Boolean((html[0].querySelector('[name="useStoryPoint"]') as HTMLInputElement | null)?.checked);
							await resolveManifestation(actor, sourceMessage, choice, useStoryPoint);
							resolve();
						},
					},
				]),
			),
			close: () => resolve(),
		}, { classes: ['chaos-manifestation-dialog'] }).render(true);
	});
}

async function handleClick(message: ChatMessage) {
	if (!game.user.isGM) {
		ui.notifications.warn(localize('Genesys.ChaosManifestation.GmOnly', 'Only the GM can resolve Chaos Manifestations.'));
		return;
	}

	const data = message.getFlag(FLAG_SCOPE, CHAT_FLAG_KEY) as ChaosManifestationChatData | undefined;
	if (!data) {
		return;
	}
	if (data.resolved) {
		ui.notifications.warn(localize('Genesys.ChaosManifestation.AlreadyResolved', 'This roll has already caused a Manifestation.'));
		return;
	}

	const actor = (await fromUuid(data.actorUuid)) as GenesysActor | null;
	if (!actor) {
		ui.notifications.warn(localize('Genesys.ChaosManifestation.MissingActor', 'The caster could not be found.'));
		return;
	}

	await promptForManifestation(actor, message, data);
}

export function registerChaosManifestations() {
	// Foundry emits this hook at the start of each encounter, but the bundled typings do not expose it yet.
	(Hooks as any).on('combatStart', async (combat: GenesysCombat) => {
		await combat.setFlag(FLAG_SCOPE, COMBAT_FLAG_KEY, 0);
	});

	Hooks.on('renderChatMessage', (message: ChatMessage, html: JQuery<HTMLElement>) => {
		const data = message.getFlag(FLAG_SCOPE, CHAT_FLAG_KEY) as ChaosManifestationChatData | undefined;
		if (data?.resolved) {
			html.find('[data-action="chaos-manifestation"]')
				.prop('disabled', true)
				.text(localize('Genesys.ChaosManifestation.Resolved', 'Manifestation resolved'));
			return;
		}

		html.find('[data-action="chaos-manifestation"]').on('click', async (event) => {
			event.preventDefault();
			await handleClick(message);
		});
	});
}
