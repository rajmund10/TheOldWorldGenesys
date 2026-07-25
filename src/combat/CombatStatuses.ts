import GenesysActor from '@/actor/GenesysActor';
import GenesysEffect from '@/effects/GenesysEffect';
import type { ContainedItemQuality } from '@/item/data/BaseWeaponDataModel';

const FLAG_SCOPE = 'genesys';
const ATTACK_FLAG_KEY = 'attackResolution';

export type CombatStatusId = 'genesys.disoriented' | 'genesys.immobilized' | 'genesys.staggered' | 'genesys.prone' | 'genesys.burning';

type CombatStatusDefinition = {
	id: CombatStatusId;
	label: string;
	description: string;
	icon: string;
	temporary: boolean;
	showOnSheet: boolean;
	changes?: Array<{
		key: string;
		mode: number;
		value: string;
		priority: number;
	}>;
};

type CombatStatusOptions = {
	rounds?: number;
	source?: string;
	detail?: string;
	damage?: number;
};

type QualitySelection = {
	quality: ContainedItemQuality;
	uses: number;
};

type AttackFlag = {
	targetUuid: string;
	totalDamage: number;
	results: {
		netSuccess: number;
	};
};

export const COMBAT_STATUS_DEFINITIONS: CombatStatusDefinition[] = [
	{
		id: 'genesys.disoriented',
		label: 'Genesys.CombatStatuses.Disoriented',
		description: 'Genesys.CombatStatuses.DisorientedDescription',
		icon: 'icons/svg/daze.svg',
		temporary: true,
		showOnSheet: true,
		changes: [
			{
				key: 'genesys.pool.check.self.',
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				value: 'S',
				priority: 20,
			},
		],
	},
	{
		id: 'genesys.immobilized',
		label: 'Genesys.CombatStatuses.Immobilized',
		description: 'Genesys.CombatStatuses.ImmobilizedDescription',
		icon: 'icons/svg/anchor.svg',
		temporary: true,
		showOnSheet: true,
	},
	{
		id: 'genesys.staggered',
		label: 'Genesys.CombatStatuses.Staggered',
		description: 'Genesys.CombatStatuses.StaggeredDescription',
		icon: 'icons/svg/daze.svg',
		temporary: true,
		showOnSheet: true,
	},
	{
		id: 'genesys.prone',
		label: 'Genesys.CombatStatuses.Prone',
		description: 'Genesys.CombatStatuses.ProneDescription',
		icon: 'icons/svg/falling.svg',
		temporary: false,
		showOnSheet: false,
	},
	{
		id: 'genesys.burning',
		label: 'Genesys.CombatStatuses.Burning',
		description: 'Genesys.CombatStatuses.BurningDescription',
		icon: 'icons/svg/fire.svg',
		temporary: true,
		showOnSheet: false,
	},
];

function localize(key: string) {
	return game.i18n.localize(key);
}

function normalizeName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function getStatusDefinition(id: CombatStatusId) {
	return COMBAT_STATUS_DEFINITIONS.find((definition) => definition.id === id);
}

function getEffectDuration(rounds: number | undefined) {
	if (!rounds) {
		return undefined;
	}

	if (game.release.generation >= 14) {
		return {
			value: rounds,
			units: 'rounds',
			expiry: null,
		};
	}

	return {
		rounds,
		startRound: game.combat?.round,
		startTurn: game.combat?.turn,
	};
}

function getEffectStart() {
	if (game.release.generation < 14) {
		return undefined;
	}

	const combatant = game.combat?.combatant;
	return {
		combat: game.combat?.id ?? null,
		combatant: combatant?.id ?? null,
		initiative: combatant?.initiative ?? null,
		round: game.combat?.round ?? null,
		turn: game.combat?.turn ?? null,
		time: game.time.worldTime,
	};
}

function hasStatus(effect: GenesysEffect, id: CombatStatusId) {
	const statuses = (effect as unknown as { statuses?: Set<string> | string[] }).statuses;
	return statuses ? Array.from(statuses).includes(id) : false;
}

export function hasCombatStatus(actor: GenesysActor, id: CombatStatusId) {
	return Array.from(actor.effects as foundry.abstract.EmbeddedCollection<GenesysEffect>).some(
		(effect) => hasStatus(effect, id) && !effect.isSuppressed,
	);
}

export async function setCombatStatus(actor: GenesysActor, id: CombatStatusId, active: boolean) {
	const effects = Array.from(actor.effects as foundry.abstract.EmbeddedCollection<GenesysEffect>).filter((effect) => hasStatus(effect, id));

	if (active) {
		const existing = effects[0];
		if (existing) {
			if (existing.isSuppressed) {
				await existing.update({ disabled: false });
			}
			return existing;
		}
		return applyCombatStatus(actor, id);
	}

	const effectIds = effects.map((effect) => effect.id).filter((effectId): effectId is string => Boolean(effectId));
	if (effectIds.length) {
		await actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
	}
}

export function isTrackedCombatEffect(effect: GenesysEffect) {
	return COMBAT_STATUS_DEFINITIONS.some((definition) => hasStatus(effect, definition.id));
}

export function getCombatStatusSource(effect: GenesysEffect) {
	const statusData = effect.getFlag(FLAG_SCOPE, 'combatStatus') as { source?: string } | undefined;
	return statusData?.source ?? effect.originItem?.name ?? effect.sourceName;
}

export function getCombatStatusDetail(effect: GenesysEffect) {
	const statusData = effect.getFlag(FLAG_SCOPE, 'combatStatus') as { detail?: string; damage?: number } | undefined;
	const abilityData = effect.getFlag(FLAG_SCOPE, 'abilityEffect') as { detail?: string } | undefined;
	if (statusData?.detail) {
		return statusData.detail;
	}
	if (statusData?.damage) {
		return game.i18n.format('Genesys.CombatStatuses.BurningDamage', { damage: statusData.damage });
	}
	if (abilityData?.detail) {
		return abilityData.detail;
	}
	return '';
}

export async function applyCombatStatus(actor: GenesysActor, id: CombatStatusId, options: CombatStatusOptions = {}) {
	const definition = getStatusDefinition(id);
	if (!definition) {
		return;
	}

	const rounds = definition.temporary ? Math.max(1, Number(options.rounds ?? 1)) : undefined;
	const duration = getEffectDuration(rounds);
	const statusData = {
		id,
		source: options.source ?? localize('Genesys.CombatStatuses.ManualSource'),
		detail: options.detail ?? '',
		damage: options.damage ?? 0,
	};
	const existing = Array.from(actor.effects as foundry.abstract.EmbeddedCollection<GenesysEffect>).find((effect) => hasStatus(effect, id));
	const effectData: Record<string, unknown> = {
		name: localize(definition.label),
		disabled: false,
		changes: definition.changes ?? [],
		statuses: [definition.id],
		flags: {
			[FLAG_SCOPE]: {
				combatStatus: statusData,
			},
		},
	};
	if (game.release.generation >= 14) {
		effectData.img = definition.icon;
	} else {
		effectData.icon = definition.icon;
	}

	if (duration) {
		effectData.duration = duration;
	}
	const start = getEffectStart();
	if (start) {
		effectData.start = start;
	}

	if (existing) {
		const { flags: _flags, ...updateData } = effectData;
		await existing.update({
			...updateData,
			[`flags.${FLAG_SCOPE}.combatStatus`]: statusData,
		});
		return existing;
	}

	const [effect] = await actor.createEmbeddedDocuments('ActiveEffect', [
		{
			...effectData,
			transfer: false,
			showIcon: 1,
		},
	]);
	return effect as GenesysEffect;
}

async function applyStun(actor: GenesysActor, amount: number) {
	if (amount <= 0) {
		return;
	}

	if (typeof (actor.system as any).strain?.value === 'number') {
		await actor.update({ 'system.strain.value': Number((actor.system as any).strain.value) + amount });
		return;
	}

	await actor.update({ 'system.wounds.value': Number((actor.system as any).wounds?.value ?? 0) + amount });
}

export async function applyQualityCombatEffects(message: ChatMessage, selections: QualitySelection[]) {
	if (!selections.length) {
		return;
	}

	const attackFlag = message.getFlag(FLAG_SCOPE, ATTACK_FLAG_KEY) as AttackFlag | undefined;
	const target = attackFlag ? ((await fromUuid(attackFlag.targetUuid)) as GenesysActor | null) : null;
	if (!attackFlag || !target) {
		return;
	}

	for (const selection of selections) {
		const quality = selection.quality;
		const rating = quality.isRated ? Math.max(1, Number(quality.rating ?? 1)) : 1;
		const source = quality.name;

		switch (normalizeName(quality.name)) {
			case 'dezorientacja':
			case 'disorient':
				await applyCombatStatus(target, 'genesys.disoriented', { rounds: rating, source });
				break;
			case 'usidlenie':
			case 'ensnare':
				await applyCombatStatus(target, 'genesys.immobilized', { rounds: rating, source });
				break;
			case 'wstrząs':
			case 'concussive':
				await applyCombatStatus(target, 'genesys.staggered', { rounds: rating, source });
				break;
			case 'powalenie':
			case 'knockdown':
				await applyCombatStatus(target, 'genesys.prone', { source });
				break;
			case 'zapalanie':
			case 'burn':
				await applyCombatStatus(target, 'genesys.burning', {
					rounds: rating,
					source,
					damage: Math.max(0, attackFlag.totalDamage - Math.max(0, attackFlag.results.netSuccess)),
				});
				break;
			case 'ogłuszenie':
			case 'stun':
				await applyStun(target, rating * Math.max(1, selection.uses));
				break;
		}
	}
}

export function registerCombatStatuses() {
	const statusEffects = CONFIG.statusEffects as unknown as StatusEffect[] | Record<string, Record<string, unknown>>;

	if (Array.isArray(statusEffects)) {
		for (const definition of COMBAT_STATUS_DEFINITIONS) {
			if (!statusEffects.some((status) => status.id === definition.id)) {
				statusEffects.push({
					id: definition.id,
					label: definition.label,
					icon: definition.icon as ImageFilePath,
					changes: definition.changes ?? [],
				} as unknown as StatusEffect);
			}
		}
		return;
	}

	for (const definition of COMBAT_STATUS_DEFINITIONS) {
		statusEffects[definition.id] = {
			id: definition.id,
			name: definition.label,
			label: definition.label,
			img: definition.icon,
			icon: definition.icon,
			changes: definition.changes ?? [],
		};
	}
}
