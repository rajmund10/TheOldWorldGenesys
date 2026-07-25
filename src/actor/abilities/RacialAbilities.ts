import GenesysActor from '@/actor/GenesysActor';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import GenesysItem from '@/item/GenesysItem';
import AbilityDataModel from '@/item/data/AbilityDataModel';
import GenesysDie from '@/dice/types/GenesysDie';
import { GenesysDice } from '@/dice';

const FLAG_SCOPE = 'genesys';
const USE_FLAG = 'racialAbilityUse';

const ACTIVE_ABILITY_NAMES = new Set(['dostrojony do ulgu', 'piętno chaosu']);
const ENCOUNTER_ABILITY_NAMES = new Set(['dostrojony do ulgu']);

function normalizeName(value: string) {
	return value.trim().toLocaleLowerCase();
}

function localize(key: string, fallback: string) {
	const translated = game.i18n.localize(key);
	return translated === key ? fallback : translated;
}

function actorForAbility(ability: GenesysItem<AbilityDataModel>) {
	return ability.parent instanceof GenesysActor ? ability.parent as GenesysActor<CharacterDataModel> : undefined;
}

export function isAutomatedRacialAbility(ability: GenesysItem<AbilityDataModel>) {
	return ACTIVE_ABILITY_NAMES.has(normalizeName(ability.name));
}

export function isRacialAbilityUsed(ability: GenesysItem<AbilityDataModel>) {
	return Boolean(ability.getFlag(FLAG_SCOPE, USE_FLAG));
}

export function isSkillAllowedForArchetype(archetypeKey: string, skillName: string) {
	const archetype = normalizeName(archetypeKey);
	const skill = normalizeName(skillName);

	if (archetype === 'krasnolud' && (skill === 'moc boska' || skill === 'moc tajemna')) {
		return false;
	}

	if (archetype === 'niziolek' && skill === 'moc tajemna') {
		return false;
	}

	return true;
}

export function isCareerAllowedForArchetype(archetypeKey: string, careerKey: string) {
	return normalizeName(archetypeKey) !== 'imperialny-ogr'
		|| !['szlachcic', 'uczony'].includes(normalizeName(careerKey));
}

export function getEffectiveSocialStatus(actor: GenesysActor<CharacterDataModel>, socialStatus: string) {
	const hasNobleAura = actor.items.some(
		(item) => item.type === 'ability' && normalizeName(item.name) === 'aura szlachetności',
	);
	if (!hasNobleAura || !socialStatus.trim()) {
		return socialStatus;
	}

	const upgradedStatuses: Record<string, string> = {
		wyrzutek: 'Klasa Średnia',
		biedota: 'Klasa Średnia',
		'klasa średnia': 'Elita',
		elita: 'Elita',
	};
	return upgradedStatuses[normalizeName(socialStatus)] ?? socialStatus;
}

async function markAbilityUsed(ability: GenesysItem<AbilityDataModel>) {
	await ability.setFlag(FLAG_SCOPE, USE_FLAG, {
		scope: ENCOUNTER_ABILITY_NAMES.has(normalizeName(ability.name)) ? 'encounter' : 'session',
		usedAt: game.time.worldTime,
	});
}

async function activateAttunedToUlgu(ability: GenesysItem<AbilityDataModel>, actor: GenesysActor<CharacterDataModel>) {
	const pendingEffect = Array.from(actor.effects).find((effect) => effect.getFlag(FLAG_SCOPE, 'racialAbilityOneShot') === ability.id);
	if (pendingEffect) {
		ui.notifications.warn(localize('Genesys.RacialAbilities.AlreadyPrepared', 'Ta zdolność oczekuje już na właściwy test.'));
		return false;
	}

	await actor.createEmbeddedDocuments('ActiveEffect', [{
		name: ability.name,
		img: ability.img,
		origin: ability.uuid,
		disabled: false,
		changes: [
			{ key: 'genesys.pool.skill.self.Oszustwo', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '^', priority: 20 },
			{ key: 'genesys.pool.skill.self.Ukrywanie się', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '^', priority: 20 },
		],
		flags: {
			genesys: {
				racialAbilityOneShot: ability.id,
				abilityEffect: {
					ability: ability.name,
					detail: localize('Genesys.RacialAbilities.AttunedPending', 'Zostanie zużyte przez następny test Oszustwa lub Ukrywania się.'),
				},
			},
		},
	}]);

	return true;
}

type RerollChoice = {
	dieIndex: number;
	resultIndex: number;
	denomination: string;
	oldLabel: string;
};

function latestActorRoll(actor: GenesysActor<CharacterDataModel>) {
	return Array.from(game.messages)
		.reverse()
		.find((message) => message.speaker.actor === actor.id && message.rolls.length > 0);
}

function getRerollChoices(message: ChatMessage): RerollChoice[] {
	const roll = message.rolls[0];
	if (!roll) {
		return [];
	}

	return roll.dice.flatMap((die, dieIndex) => {
		const genesysDie = die as GenesysDie;
		return die.results.flatMap((result, resultIndex) => {
			const oldLabel = genesysDie.getResultLabel(result);
			return oldLabel.includes('d')
				? []
				: [{ dieIndex, resultIndex, denomination: genesysDie.denomination, oldLabel }];
		});
	});
}

async function chooseDieToReroll(choices: RerollChoice[]) {
	return new Promise<RerollChoice | undefined>((resolve) => {
		const options = choices.map((choice, index) => {
			const dieEntry = Object.entries(GenesysDice).find(([, die]) => die.DENOMINATION === choice.denomination);
			const dieName = dieEntry ? game.i18n.localize(`Genesys.DiceColors.${dieEntry[0]}`) : choice.denomination;
			const result = choice.oldLabel.trim() || localize('Genesys.RacialAbilities.BlankFace', 'pusta ścianka');
			return `<option value="${index}">${dieName}: ${result}</option>`;
		}).join('');

		new Dialog({
			title: localize('Genesys.RacialAbilities.ChaosMarkTitle', 'Piętno Chaosu'),
			content: `<div class="form-group"><label>${localize('Genesys.RacialAbilities.SelectDie', 'Wybierz kość do przerzutu')}</label><select name="die">${options}</select></div>`,
			buttons: {
				reroll: {
					icon: '<i class="fas fa-dice"></i>',
					label: localize('Genesys.RacialAbilities.Reroll', 'Przerzuć'),
					callback: (html) => {
						const root = html instanceof HTMLElement ? html : html[0];
						const index = Number(root.querySelector<HTMLSelectElement>('select[name="die"]')?.value ?? -1);
						resolve(choices[index]);
					},
				},
				cancel: {
					label: game.i18n.localize('Cancel'),
					callback: () => resolve(undefined),
				},
			},
			default: 'reroll',
			close: () => resolve(undefined),
		}).render(true);
	});
}

async function activateChaosMark(ability: GenesysItem<AbilityDataModel>, actor: GenesysActor<CharacterDataModel>) {
	const message = latestActorRoll(actor);
	const choices = message ? getRerollChoices(message) : [];
	if (!message || !choices.length) {
		ui.notifications.warn(localize('Genesys.RacialAbilities.NoEligibleRoll', 'Nie znaleziono rzutu z kością, którą można przerzucić.'));
		return false;
	}

	const choice = await chooseDieToReroll(choices);
	if (!choice) {
		return false;
	}

	const reroll = new Roll(`1d${choice.denomination}`, { symbols: {} });
	await reroll.evaluate();
	const newDie = reroll.dice[0] as GenesysDie;
	const newLabel = newDie.getResultLabel(newDie.results[0]);
	const oldResult = choice.oldLabel.trim() || localize('Genesys.RacialAbilities.BlankFace', 'pusta ścianka');
	const newResult = newLabel.trim() || localize('Genesys.RacialAbilities.BlankFace', 'pusta ścianka');

	await ChatMessage.create({
		user: game.user.id,
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<div class="genesys chat-card"><h3>${ability.name}</h3><p>${localize('Genesys.RacialAbilities.ReplaceResult', 'Zastąp wynik wybranej kości:')} <span class="font-genesys-symbols">${oldResult}</span> → <span class="font-genesys-symbols">${newResult}</span></p></div>`,
		rolls: [reroll],
	});

	return true;
}

export async function useRacialAbility(ability: GenesysItem<AbilityDataModel>) {
	const actor = actorForAbility(ability);
	if (!actor || !isAutomatedRacialAbility(ability)) {
		return;
	}

	if (isRacialAbilityUsed(ability)) {
		ui.notifications.warn(localize('Genesys.RacialAbilities.AlreadyUsed', 'Ta zdolność została już wykorzystana.'));
		return;
	}

	let used = false;
	switch (normalizeName(ability.name)) {
		case 'dostrojony do ulgu':
			used = await activateAttunedToUlgu(ability, actor);
			break;
		case 'piętno chaosu':
			used = await activateChaosMark(ability, actor);
			break;
	}

	if (used) {
		await markAbilityUsed(ability);
	}
}

export async function resetRacialAbilityUse(ability: GenesysItem<AbilityDataModel>) {
	const actor = actorForAbility(ability);
	if (actor) {
		const pendingEffects = Array.from(actor.effects)
			.filter((effect) => effect.getFlag(FLAG_SCOPE, 'racialAbilityOneShot') === ability.id)
			.map((effect) => effect.id);
		if (pendingEffects.length) {
			await actor.deleteEmbeddedDocuments('ActiveEffect', pendingEffects);
		}
	}
	await ability.unsetFlag(FLAG_SCOPE, USE_FLAG);
}

export function registerRacialAbilities() {
	(Hooks as any).on('combatStart', async (combat: Combat) => {
		if (!game.user.isGM) {
			return;
		}

		const actors = new Set(
			Array.from(combat.combatants)
				.map((combatant) => combatant.actor)
				.filter((actor): actor is GenesysActor<CharacterDataModel> => actor?.type === 'character'),
		);

		for (const actor of actors) {
			const abilities = actor.items.filter(
				(item) => item.type === 'ability' && ENCOUNTER_ABILITY_NAMES.has(normalizeName(item.name)),
			) as GenesysItem<AbilityDataModel>[];
			for (const ability of abilities) {
				await resetRacialAbilityUse(ability);
			}
		}
	});
}
