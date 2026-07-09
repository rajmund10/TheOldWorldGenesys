<script lang="ts" setup>
import { computed, inject, toRaw } from 'vue';
import DicePrompt from '@/app/DicePrompt';
import MagicActionPrompt from '@/app/MagicActionPrompt';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import GenesysItem from '@/item/GenesysItem';
import { EquipmentState } from '@/item/data/EquipmentDataModel';
import MagicAccessoryDataModel from '@/item/data/MagicAccessoryDataModel';
import SkillDataModel from '@/item/data/SkillDataModel';
import SpecializationDataModel from '@/item/data/SpecializationDataModel';
import { findMagicSpecialization, findRankedMagicSkill, getMagicActionDefinitions, getMagicSkillNameAliases, hasMagicRank, resolveMagicProfileFromSkill, resolveMagicProfileFromSpecialization, type MagicActionDefinition } from '@/magic/MagicProfiles';
import { arrayFromItems } from '@/utils/collection';
import { ActorSheetContext, RootContext } from '@/vue/SheetContext';

const props = withDefaults(
	defineProps<{
		profileSource?: 'specialization' | 'skill';
	}>(),
	{
		profileSource: 'specialization',
	},
);
const context = inject<ActorSheetContext<CharacterDataModel>>(RootContext)!;
const reactiveActor = computed(() => context.data.actor);
const actor = computed(() => toRaw(reactiveActor.value));
const system = computed(() => reactiveActor.value.systemData);

function t(key: string, fallback: string, formatArgs?: Record<string, string | number>) {
	if (game?.i18n) {
		const localized = formatArgs ? game.i18n.format(key, formatArgs) : game.i18n.localize(key);
		if (localized !== key) {
			return localized;
		}
	}

	return fallback;
}

const specializations = computed(() => arrayFromItems<GenesysItem<SpecializationDataModel>>(actor.value.items).filter((item) => item.type === 'specialization'));
const magicSpecialization = computed(() => findMagicSpecialization(specializations.value));
const skills = computed(() => arrayFromItems<GenesysItem<SkillDataModel>>(actor.value.items).filter((item) => item.type === 'skill'));
const rankedMagicSkill = computed(() => findRankedMagicSkill(skills.value));
const profile = computed(() => (props.profileSource === 'skill' ? resolveMagicProfileFromSkill(rankedMagicSkill.value) : resolveMagicProfileFromSpecialization(magicSpecialization.value)));

const primarySkill = computed(() => {
	const skillNames = getMagicSkillNameAliases(profile.value.primarySkillName).map((name) => name.toLowerCase());
	if (!skillNames.length) {
		return null;
	}

	return (arrayFromItems<GenesysItem<SkillDataModel>>(actor.value.items).find((item) => item.type === 'skill' && skillNames.includes(item.name.toLowerCase())) as GenesysItem<SkillDataModel> | undefined) ?? null;
});

const canCast = computed(() =>
	hasMagicRank(
		primarySkill.value
			? [
					{
						name: primarySkill.value.name,
						rank: primarySkill.value.systemData.rank,
						characteristic: primarySkill.value.systemData.characteristic,
						isPrimary: true,
					},
				]
			: [],
		profile.value.primarySkillName,
	),
);

const actionDefinitions = computed(() => getMagicActionDefinitions(profile.value.actionIds));
const showRankWarning = computed(() => profile.value.enabled && !canCast.value);
const canBuildSpellActions = computed(() => canCast.value && !!primarySkill.value);
const equippedMagicAccessories = computed(
	() =>
		(arrayFromItems<GenesysItem>(actor.value.items) as GenesysItem[])
			.filter((item) => item.type === 'magicAccessory' && (item.systemData as MagicAccessoryDataModel).state === EquipmentState.Equipped)
			.sort((left, right) => left.name.localeCompare(right.name)) as GenesysItem<MagicAccessoryDataModel>[],
);
const activeMagicAccessoryId = computed(() => {
	const selectedId = system.value.activeMagicAccessoryId;
	return equippedMagicAccessories.value.some((item) => item.id === selectedId) ? selectedId : '';
});
const knowledgeSkills = computed(
	() =>
		(arrayFromItems<GenesysItem>(actor.value.items) as GenesysItem[])
			.filter((item) => item.type === 'skill' && (item.systemData as SkillDataModel).category === 'knowledge')
			.sort((left, right) => left.name.localeCompare(right.name)) as GenesysItem<SkillDataModel>[],
);
const activeMagicKnowledgeSkillId = computed(() => {
	const selectedId = system.value.activeMagicKnowledgeSkillId;
	return knowledgeSkills.value.some((item) => item.id === selectedId) ? selectedId : '';
});
const primaryRollSkillLabel = computed(() => {
	if (!primarySkill.value) {
		return '';
	}

	return profile.value.windName ? `${primarySkill.value.name} (${profile.value.windName})` : primarySkill.value.name;
});
const primaryRollDice = computed(() => {
	if (!primarySkill.value) {
		return [];
	}

	const skillRank = primarySkill.value.systemData.rank;
	const characteristicRank = system.value.characteristics[primarySkill.value.systemData.characteristic];
	const proficiencyDice = Math.min(skillRank, characteristicRank);
	const abilityDice = Math.abs(skillRank - characteristicRank);

	return [
		...Array.from({ length: proficiencyDice }, (_, index) => ({
			id: `proficiency-${index}`,
			src: 'systems/genesys/dice/yellow.png',
			alt: t('Genesys.DiceColors.Proficiency', 'Kość biegłości'),
		})),
		...Array.from({ length: abilityDice }, (_, index) => ({
			id: `ability-${index}`,
			src: 'systems/genesys/dice/green.png',
			alt: t('Genesys.DiceColors.Ability', 'Kość zdolności'),
		})),
	];
});

async function rollPrimarySkill() {
	if (!primarySkill.value) {
		return;
	}

	await DicePrompt.promptForRoll(toRaw(actor.value), primarySkill.value.name, {
		rollData: {
			chaosManifestation: {
				enabled: profile.value.tradition === 'arcana' && profile.value.allowMiscast,
				actionId: null,
			},
		},
	});
}

async function openActionPrompt(action: MagicActionDefinition) {
	if (!primarySkill.value || !canBuildSpellActions.value) {
		return;
	}

	await MagicActionPrompt.promptForAction(toRaw(actor.value), primarySkill.value.name, action, profile.value);
}

async function selectMagicAccessory(event: Event) {
	const selectedId = (event.currentTarget as HTMLSelectElement).value;
	await actor.value.update({ 'system.activeMagicAccessoryId': selectedId });
}

async function selectMagicKnowledgeSkill(event: Event) {
	const selectedId = (event.currentTarget as HTMLSelectElement).value;
	await actor.value.update({ 'system.activeMagicKnowledgeSkillId': selectedId });
}
</script>

<template>
	<section class="magic-tab">
		<div v-if="!profile.enabled" class="magic-empty-state">
			<i class="fas fa-hat-wizard"></i>
			<h3>{{ t('Genesys.Magic.LockedTitle', 'Magia jest zablokowana.') }}</h3>
			<p>{{ t('Genesys.Magic.LockedHint', 'Przypisz specjalizację magiczną albo podnieś magiczną umiejętność do rangi 1, aby odblokować tę zakładkę.') }}</p>
		</div>

		<template v-else>
			<div v-if="showRankWarning" class="warning-banner">
				<div class="warning-copy">
					<h3>{{ t('Genesys.Magic.MissingRankTitle', 'Magia odblokowana, ale brak użytecznej rangi') }}</h3>
					<p>
						{{
							t(
								'Genesys.Magic.MissingRankHint',
								`Ta zakładka jest odblokowana, ale postać nadal potrzebuje co najmniej 1 rangi w ${profile.primarySkillName}.`,
								{ specialization: profile.specializationName ?? '', skill: profile.primarySkillName ?? '' },
							)
						}}
					</p>
				</div>
			</div>

			<div v-if="canCast && primarySkill" class="action-row">
				<button type="button" class="roll-primary" @click="rollPrimarySkill">
					<span>{{ t('Genesys.Magic.RollPrimary', `Rzuć ${primaryRollSkillLabel}`, { skill: primaryRollSkillLabel }) }}</span>
					<span class="roll-dice" aria-hidden="true">
						<img v-for="die in primaryRollDice" :key="die.id" :src="die.src" :alt="die.alt" class="roll-die" />
					</span>
				</button>
			</div>

			<section class="magic-panel casting-config-panel">
				<div class="casting-config-field">
					<header>
						<h3>{{ t('Genesys.Magic.ActiveAccessory', 'Aktywne akcesorium') }}</h3>
						<p>{{ t('Genesys.Magic.ActiveAccessoryHint', 'Wybierz, które założone akcesorium magiczne przekazuje swoje bonusy do czarowania.') }}</p>
					</header>

					<select class="casting-config-select" :value="activeMagicAccessoryId" @change="selectMagicAccessory">
						<option value="">{{ t('Genesys.Magic.NoAccessory', 'Bez akcesorium') }}</option>
						<option v-for="accessory in equippedMagicAccessories" :key="accessory.id" :value="accessory.id">
							{{ accessory.name }}{{ accessory.systemData.hasAttackDamageBonus ? ` (${t('Genesys.Magic.AttackBonus', `Atak +${accessory.systemData.attackDamageBonus}`, { bonus: accessory.systemData.attackDamageBonus })})` : '' }}
						</option>
					</select>

					<p v-if="equippedMagicAccessories.length === 0" class="casting-config-empty">
						{{ t('Genesys.Magic.NoEquippedAccessories', 'Załóż akcesorium magiczne, aby pojawiło się na tej liście.') }}
					</p>
				</div>

				<div class="casting-config-field">
					<header>
						<h3>{{ t('Genesys.Magic.ActiveKnowledge', 'Aktywna wiedza') }}</h3>
						<p>{{ t('Genesys.Magic.ActiveKnowledgeHint', 'Wybierz, z której umiejętności Wiedzy korzystają efekty skalujące się z jej rangami.') }}</p>
					</header>

					<select class="casting-config-select" :value="activeMagicKnowledgeSkillId" @change="selectMagicKnowledgeSkill">
						<option value="">{{ t('Genesys.Magic.NoKnowledge', 'Nie wybrano wiedzy') }}</option>
						<option v-for="skill in knowledgeSkills" :key="skill.id" :value="skill.id">
							{{ skill.name }} ({{ t('Genesys.Magic.KnowledgeRank', `Ranga ${skill.systemData.rank}`, { rank: skill.systemData.rank }) }})
						</option>
					</select>

					<p v-if="knowledgeSkills.length === 0" class="casting-config-empty">
						{{ t('Genesys.Magic.NoKnowledgeSkills', 'Dodaj umiejętność wiedzy, aby pojawiła się na tej liście.') }}
					</p>
				</div>
			</section>

			<div class="magic-layout">
				<section class="magic-panel">
					<header>
						<h3>{{ t('Genesys.Magic.Actions', 'Dostępne akcje') }}</h3>
						<p>{{ t('Genesys.Magic.ActionsHint', 'Rodziny akcji czarów dostępne dla tego profilu.') }}</p>
					</header>

					<div class="action-grid">
						<button v-for="action in actionDefinitions" :key="action.id" type="button" class="action-card" :disabled="!canBuildSpellActions" @click="openActionPrompt(action)">
							<div class="action-top">
								<h4>{{ action.label }}</h4>
								<span v-if="action.oldWorldOnly" class="action-tag">{{ t('Genesys.Magic.OldWorldTag', 'Stary Świat') }}</span>
							</div>
							<p>{{ action.summary }}</p>
						</button>
					</div>
				</section>
			</div>
		</template>
	</section>
</template>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

.magic-tab {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	height: 100%;
	padding: 0.5rem;
}

.magic-empty-state,
.warning-banner,
.magic-panel {
	background: transparentize(colors.$light-blue, 0.82);
	border: 1px solid transparentize(colors.$gold, 0.3);
	border-radius: 1rem;
}

.casting-config-panel {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.75rem;
}

.casting-config-field {
	display: flex;
	flex-direction: column;
	gap: 0.45rem;
}

.casting-config-select {
	width: 100%;
}

.casting-config-empty {
	margin: 0;
	font-family: 'Roboto Slab', serif;
	color: #40586f;
}

.magic-empty-state {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	gap: 0.5rem;
	padding: 2rem;
	color: colors.$dark-blue;

	i {
		font-size: 3rem;
		color: colors.$gold;
	}

	h3 {
		margin: 0;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.8rem;
		letter-spacing: 0.04em;
	}

	p {
		margin: 0;
		max-width: 34rem;
		font-family: 'Roboto Slab', serif;
	}
}

.warning-banner {
	padding: 0.85rem 1rem;
	background: rgba(166, 93, 72, 0.1);
	border-color: transparentize(#8c4d3a, 0.35);

	h3 {
		margin: 0 0 0.2rem;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.45rem;
		letter-spacing: 0.04em;
		color: colors.$dark-blue;
	}

	p {
		margin: 0;
		font-family: 'Roboto Slab', serif;
		color: #40586f;
	}
}

.action-tag {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0.16rem 0.5rem;
	border-radius: 999px;
	font-size: 0.76rem;
	font-family: 'Bebas Neue', sans-serif;
	letter-spacing: 0.05em;
}

.action-row {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 0.7rem;
}

.roll-primary {
	display: inline-flex;
	align-items: center;
	gap: 0.45rem;
	padding: 0.5rem 0.95rem;
	border: 1px solid colors.$dark-blue;
	border-radius: 999px;
	background: colors.$dark-blue;
	color: white;
	font-family: 'Bebas Neue', sans-serif;
	font-size: 1rem;
	line-height: 1;
	letter-spacing: 0.05em;
}

.roll-dice {
	display: inline-flex;
	align-items: center;
	gap: 0.15rem;
	transform: translateY(-1px);
}

.roll-die {
	display: block;
	width: 1rem;
	height: 1rem;
	border: none;
	background: transparent;
	box-shadow: none;
	object-fit: contain;
}

.magic-layout {
	display: block;
	min-height: 0;
}

.magic-panel {
	display: flex;
	flex-direction: column;
	gap: 0.8rem;
	padding: 0.95rem 1rem;

	header {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	h3 {
		margin: 0;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.35rem;
		letter-spacing: 0.05em;
		color: colors.$dark-blue;
	}

	header p,
	.action-card p {
		margin: 0;
		font-family: 'Roboto Slab', serif;
		color: #40586f;
	}
}

.action-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	align-items: start;
	gap: 0.65rem;
}

.action-card {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: flex-start;
	padding: 0.75rem 0.85rem;
	text-align: left;
	cursor: pointer;
	appearance: none;
	font: inherit;
	border-radius: 0.9rem;
	background: rgba(255, 255, 255, 0.55);
	border: 1px solid rgba(39, 67, 90, 0.12);
	transition:
		border-color 0.15s ease,
		background-color 0.15s ease,
		transform 0.15s ease;

	&:enabled:hover {
		background: rgba(255, 255, 255, 0.72);
		border-color: rgba(39, 67, 90, 0.28);
		transform: translateY(-1px);
	}

	&:disabled {
		cursor: default;
		opacity: 0.65;
	}

	.action-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	h4 {
		margin: 0;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.1rem;
		letter-spacing: 0.04em;
		color: colors.$dark-blue;
	}
}

.action-tag {
	background: rgba(39, 67, 90, 0.12);
	color: colors.$dark-blue;
}

@container sheet (max-width: 900px) {
	.casting-config-panel {
		grid-template-columns: 1fr;
	}
}
</style>
