import DicePrompt, { RollType } from '@/app/DicePrompt';
import GenesysActor from '@/actor/GenesysActor';
import type { MagicActionDefinition, ResolvedMagicProfile } from '@/magic/MagicProfiles';
import {
	MAX_MAGIC_DIFFICULTY,
	buildMagicActionChatLabel,
	buildMagicDifficultyString,
	getMagicActionEffectDefinitions,
	getMagicActionRuleDefinition,
	summarizeMagicActionSelection,
	type MagicActionEffectDefinition,
	type MagicActionRuleDefinition,
	type MagicActionSelection,
	type MagicActionSelectionSummary,
} from '@/magic/MagicActionRules';
import type { AttackRollWeapon } from '@/dice/GenesysRoller';
import type { ContainedItemQuality } from '@/item/data/BaseWeaponDataModel';
import { EquipmentState } from '@/item/data/EquipmentDataModel';
import MagicAccessoryDataModel from '@/item/data/MagicAccessoryDataModel';
import SkillDataModel from '@/item/data/SkillDataModel';
import GenesysItem from '@/item/GenesysItem';
import { getMagicSkillNameAliases } from '@/magic/MagicProfiles';
import { ContextBase } from '@/vue/SheetContext';
import VueSheet from '@/vue/VueSheet';
import VueMagicActionPrompt from '@/vue/apps/MagicActionPrompt.vue';

export interface MagicActionPromptContext extends ContextBase {
	action: MagicActionDefinition;
	actionRules: MagicActionRuleDefinition;
	effectDefinitions: MagicActionEffectDefinition[];
	profile: ResolvedMagicProfile;
	skillName: string;
	maxDifficulty: number;
	confirmSelection: (selection: MagicActionSelection) => Promise<void>;
	closePrompt: () => Promise<void>;
}

function localize(key: string, fallback: string, data?: Record<string, string | number>) {
	if (game?.i18n) {
		const localized = data ? game.i18n.format(key, data) : game.i18n.localize(key);
		if (localized !== key) {
			return localized;
		}
	}

	return fallback;
}

const MAGIC_ATTACK_RANGE_STEPS: AttackRollWeapon['systemData']['range'][] = ['short', 'medium', 'long', 'extreme'];

function normalizeName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function getQualityTemplate(name: string) {
	return game.items.find((item) => item.type === 'quality' && normalizeName(item.name) === normalizeName(name));
}

function buildQuality(name: string, isRated: boolean, rating: number): ContainedItemQuality {
	const qualityTemplate = getQualityTemplate(name);
	return {
		name,
		description: qualityTemplate?.systemData.description ?? '',
		isRated,
		rating,
	};
}

function mergeQualities(qualities: ContainedItemQuality[]) {
	const merged = new Map<string, ContainedItemQuality>();

	for (const quality of qualities) {
		const key = normalizeName(quality.name);
		const existing = merged.get(key);
		if (!existing) {
			merged.set(key, quality);
			continue;
		}

		if (existing.isRated && quality.isRated) {
			existing.rating += quality.rating;
		}
	}

	return Array.from(merged.values());
}

export default class MagicActionPrompt extends VueSheet(Application) {
	override get vueComponent() {
		return VueMagicActionPrompt;
	}

	static override get defaultOptions() {
		return {
			...super.defaultOptions,
			classes: ['app-magic-action-prompt'],
			width: 600,
			height: 'auto',
			title: localize('Genesys.MagicActionPrompt.Title', 'Build Spell', { action: 'Spell' }),
		};
	}

	static async promptForAction(actor: GenesysActor, skillName: string, action: MagicActionDefinition, profile: ResolvedMagicProfile) {
		const app = new MagicActionPrompt(actor, skillName, action, profile);
		await app.render(true);
	}

	readonly #actor: GenesysActor;
	readonly #skillName: string;
	readonly #action: MagicActionDefinition;
	readonly #profile: ResolvedMagicProfile;
	readonly #actionRules: MagicActionRuleDefinition;
	readonly #effectDefinitions: MagicActionEffectDefinition[];

	constructor(actor: GenesysActor, skillName: string, action: MagicActionDefinition, profile: ResolvedMagicProfile) {
		super();

		this.#actor = actor;
		this.#skillName = skillName;
		this.#action = action;
		this.#profile = profile;
		this.#actionRules = getMagicActionRuleDefinition(action.id);
		this.#effectDefinitions = getMagicActionEffectDefinitions(action.id, {
			tradition: profile.tradition,
			schoolId: profile.schoolId,
		});
		this.options.title = localize('Genesys.MagicActionPrompt.Title', `Build ${action.label}`, { action: action.label });
	}

	#buildAttackProfile(summary: MagicActionSelectionSummary): AttackRollWeapon | null {
		const actorItems = Array.from(this.#actor.items) as GenesysItem[];
		const skill = actorItems.find((item) => item.type === 'skill' && item.name === this.#skillName) as GenesysItem<SkillDataModel> | undefined;
		if (!skill) {
			return null;
		}

		const skillRank = skill.systemData.rank;
		const damageCharacteristic = skill.systemData.characteristic;
		const characteristicValue = (this.#actor.systemData as any).characteristics[damageCharacteristic] as number;
		const activeKnowledgeSkill = actorItems.find(
			(item) => item.id === (this.#actor.systemData as any).activeMagicKnowledgeSkillId && item.type === 'skill',
		) as GenesysItem<SkillDataModel> | undefined;
		const knowledgeRank = activeKnowledgeSkill?.systemData.rank ?? 0;
		const acceptedMagicSkillNames = new Set(getMagicSkillNameAliases(this.#profile.primarySkillName ?? this.#skillName).map((name) => normalizeName(name)));
		const activeAccessory = actorItems.find(
			(item) =>
				item.id === (this.#actor.systemData as any).activeMagicAccessoryId &&
				item.type === 'magicAccessory' &&
				(item.systemData as MagicAccessoryDataModel).state === EquipmentState.Equipped &&
				(item.systemData as MagicAccessoryDataModel).hasAttackDamageBonus &&
				acceptedMagicSkillNames.has(normalizeName((item.systemData as MagicAccessoryDataModel).magicSkill)),
		) as GenesysItem<MagicAccessoryDataModel> | undefined;
		const accessoryDamageBonus = activeAccessory?.systemData.attackDamageBonus ?? 0;

		const damageCharacteristicMultiplier = Math.max(
			1,
			...summary.selectedEffects.map((effectDefinition) => effectDefinition.attackProfile?.damageCharacteristicMultiplier ?? 1),
		);
		const criticalValues = summary.selectedEffects.map((effectDefinition) => effectDefinition.attackProfile?.critical).filter((critical): critical is number => critical !== undefined);
		const rangeIncrease = summary.selectedEffects.find((effectDefinition) => effectDefinition.id === 'range')?.count ?? 0;
		const attackQualities = mergeQualities(
			summary.selectedEffects.flatMap((effectDefinition) =>
				(effectDefinition.attackProfile?.qualities ?? []).map((quality) => {
					const rating = quality.rating === 'skillRank' ? skillRank : quality.rating === 'knowledgeRank' ? knowledgeRank : (quality.rating ?? 0);
					return buildQuality(quality.name, quality.isRated ?? quality.rating !== undefined, rating);
				}),
			),
		);

		return {
			name: buildMagicActionChatLabel(this.#action.label, summary),
			systemData: {
				baseDamage: accessoryDamageBonus + characteristicValue * (damageCharacteristicMultiplier - 1),
				damageCharacteristic,
				critical: criticalValues.length > 0 ? Math.min(...criticalValues) : 0,
				range: MAGIC_ATTACK_RANGE_STEPS[Math.min(rangeIncrease, MAGIC_ATTACK_RANGE_STEPS.length - 1)],
				qualities: attackQualities,
			},
		};
	}

	override async getVueContext(): Promise<MagicActionPromptContext> {
		return {
			action: this.#action,
			actionRules: this.#actionRules,
			effectDefinitions: this.#effectDefinitions,
			profile: this.#profile,
			skillName: this.#skillName,
			maxDifficulty: MAX_MAGIC_DIFFICULTY,
			confirmSelection: async (selection) => {
				const summary = summarizeMagicActionSelection(this.#actionRules, this.#effectDefinitions, selection);
				if (summary.exceedsDifficultyCap || summary.incompatiblePairs.length > 0) {
					return;
				}

				const descriptionOverride = `<strong>${this.#skillName} (${this.#action.label})</strong>`;
				const attackProfile = this.#action.id === 'attack' ? this.#buildAttackProfile(summary) : null;

				await this.close();
				await DicePrompt.promptForRoll(this.#actor, this.#skillName, {
					difficulty: buildMagicDifficultyString(summary.totalDifficulty),
					initialManualChanges: [],
					rollType: attackProfile ? RollType.Attack : undefined,
					requireSingleTarget: !!attackProfile,
					rollData: {
						descriptionOverride,
						chaosManifestation: {
							enabled: this.#profile.tradition === 'arcana' && this.#profile.allowMiscast && !['dispel', 'senseMagic'].includes(this.#action.id),
							actionId: this.#action.id,
						},
						...(attackProfile ? { weapon: attackProfile } : {}),
					},
				});
			},
			closePrompt: async () => {
				await this.close();
			},
		};
	}
}
