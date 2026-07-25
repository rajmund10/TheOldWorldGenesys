import GenesysActor from '@/actor/GenesysActor';
import GenesysEffect from '@/effects/GenesysEffect';
import type { ContainedItemQuality } from '@/item/data/BaseWeaponDataModel';
import TalentDataModel from '@/item/data/TalentDataModel';
import GenesysItem from '@/item/GenesysItem';

export const CombatEffectKeys = {
	AttackPierce: 'genesys.combat.attack.pierce',
	AttackPenetration: 'genesys.combat.attack.penetration',
	AttackMinimumBrawn: 'genesys.combat.attack.minimumBrawn',
	AttackMinimumAgility: 'genesys.combat.attack.minimumAgility',
	AttackMeleeDamage: 'genesys.combat.attack.meleeDamage',
	AttackStunDamage: 'genesys.combat.attack.stunDamage',
	CriticalVicious: 'genesys.combat.critical.vicious',
	DefenseIgnorePierce: 'genesys.combat.defense.ignorePierce',
	DefenseMelee: 'genesys.combat.defense.melee',
	DefenseRanged: 'genesys.combat.defense.ranged',
	DefenseParryReduction: 'genesys.combat.defense.parryReduction',
	DefenseCanParry: 'genesys.combat.defense.canParry',
	DefenseCanBlockRanged: 'genesys.combat.defense.canBlockRanged',
	DefenseShield: 'genesys.combat.defense.shield',
	CriticalReceivedModifier: 'genesys.combat.critical.receivedModifier',
} as const;

type CombatEffectKey = (typeof CombatEffectKeys)[keyof typeof CombatEffectKeys];
type CombatEffectLike = {
	disabled?: boolean;
	changes: Array<{
		key: string;
		value: unknown;
	}>;
};

const compendiumQualityItems = new Map<string, GenesysItem>();

function normalizeName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function getNumericChangeValue(value: unknown) {
	const numericValue = Number.parseFloat(String(value ?? '0'));
	return Number.isFinite(numericValue) ? numericValue : 0;
}

function getEffectValue(effect: CombatEffectLike, key: CombatEffectKey, multiplier = 1) {
	if (effect.disabled) {
		return 0;
	}

	return effect.changes
		.filter((change) => change.key === key)
		.reduce((total, change) => total + getNumericChangeValue(change.value) * multiplier, 0);
}

function getTalentMultiplier(effect: GenesysEffect) {
	const originItem = effect.originItem;
	if (!(originItem?.systemData instanceof TalentDataModel) || originItem.systemData.scalesWithRank !== 'yes') {
		return 1;
	}

	return originItem.systemData.rank;
}

export async function prepareQualityDefinitions() {
	compendiumQualityItems.clear();

	const pack = game.packs.get('genesys.itemy');
	if (!pack) {
		return;
	}

	const documents = (await pack.getDocuments()) as GenesysItem[];
	for (const item of documents) {
		if (item.type === 'quality') {
			compendiumQualityItems.set(normalizeName(item.name), item);
		}
	}
}

export function findQualityItem(name: string) {
	const normalizedName = normalizeName(name);
	const worldItem = game.items.find((item) => item.type === 'quality' && normalizeName(item.name) === normalizedName);
	return (worldItem as GenesysItem | undefined) ?? compendiumQualityItems.get(normalizedName);
}

function getUniqueQualityChanges(item: GenesysItem, key: string) {
	const seen = new Set<string>();

	return Array.from(item.effects).flatMap((effect) => {
		if ((effect as { disabled?: boolean }).disabled) {
			return [];
		}

		return effect.changes.filter((change) => {
			if (change.key !== key) {
				return false;
			}

			const signature = `${change.key}\u0000${String(change.value ?? '')}`;
			if (seen.has(signature)) {
				return false;
			}
			seen.add(signature);
			return true;
		});
	});
}

export function getQualityPoolModifications(qualities: ContainedItemQuality[]) {
	const poolEffectKey = `${GenesysEffect.DICE_POOL_MOD_KEY_PREFIX}${GenesysEffect.DICE_POOL_MOD_CHECK_TYPE}${GenesysEffect.DICE_POOL_MOD_SELF_SOURCE}.`;

	return qualities.flatMap((quality) => {
		const qualityItem = findQualityItem(quality.name);
		if (!qualityItem) {
			return [];
		}

		const multiplier = quality.isRated ? Number(quality.rating ?? 1) : 1;
		return getUniqueQualityChanges(qualityItem, poolEffectKey)
			.flatMap((change) => String(change.value ?? '').repeat(multiplier).split(''))
			.filter(Boolean);
	});
}

export function getActorCombatEffectValue(actor: GenesysActor, key: CombatEffectKey) {
	return Array.from(actor.effects as foundry.abstract.EmbeddedCollection<GenesysEffect>).reduce(
		(total, effect) => total + getEffectValue(effect, key, getTalentMultiplier(effect)),
		0,
	);
}

export function hasActorCombatEffect(actor: GenesysActor, key: CombatEffectKey) {
	return getActorCombatEffectValue(actor, key) > 0;
}

export function getQualityCombatEffectValue(qualities: ContainedItemQuality[], key: CombatEffectKey) {
	return qualities.reduce((total, quality) => {
		const qualityItem = findQualityItem(quality.name);
		if (!qualityItem) {
			return total;
		}

		const multiplier = quality.isRated ? Number(quality.rating ?? 1) : 1;
		return total + getUniqueQualityChanges(qualityItem, key).reduce((effectTotal, change) => effectTotal + getNumericChangeValue(change.value) * multiplier, 0);
	}, 0);
}

export function getHighestQualityCombatEffectValue(items: GenesysItem[], key: CombatEffectKey) {
	return items.reduce((highest, item) => {
		const qualities = ((item.systemData as { qualities?: ContainedItemQuality[] }).qualities ?? []) as ContainedItemQuality[];
		return Math.max(highest, getQualityCombatEffectValue(qualities, key));
	}, 0);
}

export function getEquippedQualityCombatEffectValue(actor: GenesysActor, key: CombatEffectKey, itemTypes: string[] = ['weapon', 'armor', 'magicAccessory']) {
	return (Array.from(actor.items) as GenesysItem[])
		.filter((item) => itemTypes.includes(item.type) && (item.systemData as { state?: string }).state === 'equipped')
		.reduce((total, item) => {
			const qualities = ((item.systemData as { qualities?: ContainedItemQuality[] }).qualities ?? []) as ContainedItemQuality[];
			return total + getQualityCombatEffectValue(qualities, key);
		}, 0);
}

export function hasQualityCombatEffect(qualities: ContainedItemQuality[], key: CombatEffectKey) {
	return getQualityCombatEffectValue(qualities, key) > 0;
}
