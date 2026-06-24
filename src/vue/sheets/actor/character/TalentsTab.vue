<script lang="ts" setup>
import { computed, inject, ref, toRaw } from 'vue';
import { ActorSheetContext, RootContext } from '@/vue/SheetContext';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import Localized from '@/vue/components/Localized.vue';
import Enriched from '@/vue/components/Enriched.vue';
import TalentDataModel from '@/item/data/TalentDataModel';
import SpecializationDataModel, { type SpecializationProfessionStep } from '@/item/data/SpecializationDataModel';
import GenesysItem from '@/item/GenesysItem';
import Talent from '@/vue/components/character/Talent.vue';
import AbilityDataModel from '@/item/data/AbilityDataModel';
import { EntryType } from '@/actor/data/character/ExperienceJournal';
import ArchetypeDataModel from '@/item/data/ArchetypeDataModel';
import TalentPurchasePrompt from '@/app/TalentPurchasePrompt';
import { getProfessionTalentOffersForStep, type ProfessionTalentOffer } from '@/specialization/ProfessionTalentOffers';
import { arrayFromItems } from '@/utils/collection';

const context = inject<ActorSheetContext<CharacterDataModel>>(RootContext)!;
const props = withDefaults(defineProps<{ showProfessionTalents?: boolean }>(), {
	showProfessionTalents: false,
});
const expandedProfessionTalents = ref<Record<string, boolean>>({});
const PROFESSION_BY_SPECIALIZATION_FLAG = 'professionStepBySpecialization';

const system = computed(() => {
	context.renderKey;
	return context.data.actor.systemData;
});
const actor = computed(() => {
	context.renderKey;
	return toRaw(context.data.actor);
});

function t(key: string, fallback: string, formatArgs?: Record<string, string | number>): string {
	if (game?.i18n) {
		const localized = formatArgs ? game.i18n.format(key, formatArgs) : game.i18n.localize(key);
		if (localized !== key) {
			return localized;
		}
	}

	return fallback;
}

function normalizeName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function getTalentActivation(talent: GenesysItem<TalentDataModel>) {
	const activation = talent.systemData?.activation ?? (talent.system as Partial<TalentDataModel> | undefined)?.activation;
	return {
		type: activation?.type ?? 'passive',
		detail: activation?.detail ?? '',
	};
}

function getTalentEffectiveTier(talent: GenesysItem<TalentDataModel>) {
	return talent.systemData?.effectiveTier ?? talent.systemData?.tier ?? (talent.system as Partial<TalentDataModel> | undefined)?.tier ?? 1;
}

const activeAbilities = computed(
	() =>
		toRaw(context.data.actor)
			.items.filter((i) => i.type === 'ability' && (i.system as AbilityDataModel).activation.type === 'active')
			.sort((a, b) => {
				return a.name.localeCompare(b.name);
			}) as GenesysItem<AbilityDataModel>[],
);
const activeAbilityTypes = computed(() => Array.from(new Set(activeAbilities.value.map((t) => t.systemData.activation.detail.toLowerCase()))).filter((t) => t !== ''));
const passiveAbilities = computed(
	() =>
		toRaw(context.data.actor)
			.items.filter((i) => i.type === 'ability' && (i.system as AbilityDataModel).activation.type === 'passive')
			.sort((a, b) => {
				return a.name.localeCompare(b.name);
			}) as GenesysItem<AbilityDataModel>[],
);
const archetypeAbilities = computed(() => (toRaw(context.data.actor).items.find((i) => i.type === 'archetype') as GenesysItem<ArchetypeDataModel>)?.systemData.grantedItems.filter((g) => g.type === 'ability').map((r) => r.name) ?? []);

const allTalents = computed(() => {
	context.renderKey;
	return arrayFromItems<GenesysItem<TalentDataModel>>(actor.value.items).filter((item) => item.type === 'talent');
});
const activeTalents = computed(() => {
	return allTalents.value
		.filter((i) => getTalentActivation(i).type === 'active')
		.sort((a, b) => {
			const tierA = getTalentEffectiveTier(a);
			const tierB = getTalentEffectiveTier(b);
			if (tierA !== tierB) return tierA - tierB;
			return a.name.localeCompare(b.name);
		});
});
const activeTalentTypes = computed(() => Array.from(new Set(activeTalents.value.filter((t) => getTalentActivation(t).detail.trim() !== '').map((t) => getTalentActivation(t).detail.toLowerCase()))));
const passiveTalents = computed(() => {
	return allTalents.value
		.filter((i) => getTalentActivation(i).type === 'passive')
		.sort((a, b) => {
			const tierA = getTalentEffectiveTier(a);
			const tierB = getTalentEffectiveTier(b);
			if (tierA !== tierB) return tierA - tierB;
			return a.name.localeCompare(b.name);
		});
});
const talentTotals = computed(() => toRaw(context.data.actor).systemData.talentPyramidTotals);
const specializations = computed(() => {
	const actorItems = arrayFromItems<GenesysItem<SpecializationDataModel>>(actor.value.items);
	return actorItems.filter((item) => item.type === 'specialization');
});
const availableProfessionTalentOffers = computed(() => {
	if (!props.showProfessionTalents) {
		return [];
	}

	const offers = specializations.value.flatMap((specialization) => {
		const professionPath = getSpecializationProfessionPath(specialization);
		const specializationKey = getSpecializationKey(specialization);
		const selectedProfessionId = getSelectedProfessionIdForSpecialization(specialization);
		const currentIndex = professionPath.findIndex((step, index) => professionId(step, index) === selectedProfessionId);
		const lastAvailableIndex = currentIndex === -1 ? -1 : currentIndex;

		return professionPath.flatMap((step, index) =>
			getProfessionTalentOffersForStep(step, specializationKey, professionId(step, index), specialization.name)
				.map((offer) => buildProfessionTalentOfferView(offer, specialization, step, index, index <= lastAvailableIndex)),
		);
	}).filter((offer) => offer.state !== 'owned');

	return offers;
});

function isTreeManagedTalent(talent: GenesysItem<TalentDataModel>) {
	return Boolean(talent.getFlag('genesys', 'treeManaged'));
}

function professionId(step: SpecializationProfessionStep, index: number) {
	return step.id || step.name || `profession-${index}`;
}

function getSpecializationKey(specialization: GenesysItem<SpecializationDataModel>) {
	return specialization.systemData?.key || (specialization.system as Partial<SpecializationDataModel> | undefined)?.key || '';
}

function getProfessionStepMap() {
	const rawMap = actor.value.getFlag('genesys', PROFESSION_BY_SPECIALIZATION_FLAG);
	return rawMap && typeof rawMap === 'object' ? { ...(rawMap as Record<string, string>) } : {};
}

function getSelectedProfessionIdForSpecialization(specialization: GenesysItem<SpecializationDataModel>) {
	const professionStepMap = getProfessionStepMap();
	return professionStepMap[specialization.id] || (specialization.id === specializations.value[0]?.id ? system.value.mainProfessionId : '');
}

function getSpecializationProfessionPath(specialization: GenesysItem<SpecializationDataModel>) {
	const systemDataPath = specialization.systemData?.professionPath;
	if (Array.isArray(systemDataPath)) {
		return systemDataPath;
	}

	const rawPath = (specialization.system as Partial<SpecializationDataModel> | undefined)?.professionPath;
	return Array.isArray(rawPath) ? rawPath : [];
}

function findSourceTalentByName(talentName: string) {
	return game.items.find((item) => item.type === 'talent' && normalizeName(item.name) === normalizeName(talentName)) as GenesysItem<TalentDataModel> | undefined;
}

function findOwnedTalentByName(talentName: string) {
	return allTalents.value.find((talent) => normalizeName(talent.name) === normalizeName(talentName));
}

function buildProfessionTalentOfferView(
	offer: ProfessionTalentOffer,
	specialization: GenesysItem<SpecializationDataModel>,
	step: SpecializationProfessionStep,
	stepIndex: number,
	unlocked: boolean,
) {
	const sourceTalent = findSourceTalentByName(offer.talentName);
	const ownedTalent = findOwnedTalentByName(offer.talentName);
	const ownedNonRanked = Boolean(ownedTalent && ownedTalent.systemData.ranked === 'no');
	const state = !unlocked
		? 'locked'
		: ownedNonRanked
			? 'owned'
			: system.value.availableXP < offer.cost
				? 'unaffordable'
				: 'available';

	return {
		...offer,
		id: `${offer.professionId}-${offer.talentName}`,
		specializationName: specialization.name,
		professionName: step.name,
		professionTier: step.tier,
		stepIndex,
		state,
		sourceTalent,
		ownedTalent,
	};
}

function professionTalentOfferStatus(offer: ReturnType<typeof buildProfessionTalentOfferView>) {
	if (offer.state === 'locked') return t('Genesys.Specializations.ProfessionTalentUpcoming', 'Locked by later profession step');
	if (offer.state === 'owned') return t('Genesys.Specializations.ProfessionTalentOwned', 'Owned');
	if (offer.state === 'unaffordable') return t('Genesys.Notifications.NotEnoughXP', 'Not enough XP.');
	if (!offer.sourceTalent) return t('Genesys.Notifications.TalentNotFound', 'Talent not found.');
	return t('Genesys.Specializations.ProfessionTalentAvailable', 'Available to buy');
}

function toggleProfessionTalent(offer: ReturnType<typeof buildProfessionTalentOfferView>) {
	expandedProfessionTalents.value = {
		...expandedProfessionTalents.value,
		[offer.id]: !expandedProfessionTalents.value[offer.id],
	};
}

function isProfessionTalentExpanded(offer: ReturnType<typeof buildProfessionTalentOfferView>) {
	return Boolean(expandedProfessionTalents.value[offer.id]);
}

function getProfessionTalentDescription(offer: ReturnType<typeof buildProfessionTalentOfferView>) {
	return offer.sourceTalent?.systemData.description ?? '';
}

function getProfessionTalentSource(offer: ReturnType<typeof buildProfessionTalentOfferView>) {
	return offer.sourceTalent?.systemData.source || `${offer.specializationName} - ${offer.professionName}`;
}

function canPurchaseProfessionTalent(offer: ReturnType<typeof buildProfessionTalentOfferView>) {
	return offer.state === 'available' && !!offer.sourceTalent;
}

async function purchaseProfessionTalent(offer: ReturnType<typeof buildProfessionTalentOfferView>) {
	if (!canPurchaseProfessionTalent(offer) || !offer.sourceTalent) {
		if (!offer.sourceTalent) {
			ui.notifications.warn(t('Genesys.Notifications.TalentNotFound', 'Talent not found.'));
		}
		return;
	}

	const confirmed = await TalentPurchasePrompt.promptForPurchase(offer.sourceTalent.name, offer.cost);
	if (!confirmed) {
		return;
	}

	const result = await TalentPurchasePrompt.purchaseTalent(actor.value, {
		talentId: offer.sourceTalent.id,
		talentName: offer.sourceTalent.name,
		cost: offer.cost,
	});

	if (result.success) {
		await context.sheet.render(false);
	}
}

function canUpgradeTalent(talent: GenesysItem<TalentDataModel>) {
	return !isTreeManagedTalent(talent) && system.value.availableXP >= talent.systemData.advanceCost;
}

async function upgradeTalent(talent: GenesysItem<TalentDataModel>) {
	if (isTreeManagedTalent(talent)) {
		ui.notifications.info(game.i18n.localize('Genesys.Notifications.TalentManagedByTree'));
		return false;
	}

	if (talent.systemData.ranked === 'no') {
		ui.notifications.info(game.i18n.format('Genesys.Notifications.TalentNotRanked', { talentName: talent.name }));
		return false;
	}

	const newEffectiveTier = talent.systemData.effectiveNextTier;
	const cost = talent.systemData.advanceCost;

	await toRaw(talent).update({
		'system.rank': talent.systemData.rank + 1,
	});

	await toRaw(context.data.actor).update({
		'system.experienceJournal.entries': [
			...system.value.experienceJournal.entries,
			{
				amount: -cost,
				type: EntryType.TalentRank,
				data: {
					name: talent.name,
					id: talent.id,
					tier: newEffectiveTier,
					rank: talent.systemData.rank,
				},
			},
		],
	});
}

async function openItem(item: GenesysItem) {
	await toRaw(item).sheet?.render(true);
}

async function deleteTalent(talent: GenesysItem<TalentDataModel>) {
	if (isTreeManagedTalent(talent)) {
		const confirmed = await Dialog.confirm({
			title: t('Genesys.Dialogs.ConfirmDeleteTreeTalent.Title', 'Usunąć talent ze specjalizacji?'),
			content: `<p>${t(
				'Genesys.Dialogs.ConfirmDeleteTreeTalent.Content',
				'Ten talent jest zarządzany przez drzewko specjalizacji. Bezpośrednie usunięcie może zostawić talent oznaczony jako kupiony w specjalizacji albo rozjechać historię PD. Jeśli możesz, bezpieczniej użyć zwrotu talentu w zakładce specjalizacji. Czy mimo to usunąć talent z postaci?',
			)}</p>`,
			yes: () => true,
			no: () => false,
			defaultYes: false,
		});

		if (!confirmed) {
			return;
		}
	}

	await toRaw(talent).delete();
}
</script>

<template>
	<section class="tab-talents">
		<div class="pyramid">
			<div><Localized label="Genesys.Labels.TierCount" :format-args="{ tier: 1 }" />: {{ talentTotals[1] }}/∞</div>
			<div><Localized label="Genesys.Labels.TierCount" :format-args="{ tier: 2 }" />: {{ talentTotals[2] }}/{{ Math.max(0, talentTotals[1] - 1) }}</div>
			<div><Localized label="Genesys.Labels.TierCount" :format-args="{ tier: 3 }" />: {{ talentTotals[3] }}/{{ Math.max(0, talentTotals[2] - 1) }}</div>
			<div><Localized label="Genesys.Labels.TierCount" :format-args="{ tier: 4 }" />: {{ talentTotals[4] }}/{{ Math.max(0, talentTotals[3] - 1) }}</div>
			<div><Localized label="Genesys.Labels.TierCount" :format-args="{ tier: 5 }" />: {{ talentTotals[5] }}/{{ Math.max(0, talentTotals[4] - 1) }}</div>
		</div>

		<div class="block">
			<div class="header"><Localized label="Genesys.Labels.SpecialAbilities" /></div>
			<div class="talents-container">
				<!-- Active Abilities -->
				<div v-if="activeAbilities.length > 0" class="category-header"><Localized label="Genesys.Labels.Active" /></div>
				<Talent
					v-for="ability in activeAbilities.filter((t) => t.systemData.activation.detail === '')"
					:key="ability.id"
					:name="ability.name"
					:img="ability.img"
					:description="ability.systemData.description"
					:source="ability.systemData.source"
					:activation="ability.systemData.activation"
					@open="openItem(ability)"
					:can-delete="!archetypeAbilities.includes(ability.name)"
					@delete="ability.delete()"
				/>

				<!-- Active Abilities w/Description -->
				<template v-for="activeType in activeAbilityTypes" :key="activeType">
					<div class="sub-category-header">{{ activeType }}</div>
					<Talent
						v-for="ability in activeAbilities.filter((t) => t.systemData.activation.detail.toLowerCase() === activeType)"
						:key="ability.id"
						:name="ability.name"
						:img="ability.img"
						:description="ability.systemData.description"
						:source="ability.systemData.source"
						:activation="ability.systemData.activation"
						@open="openItem(ability)"
						:can-delete="!archetypeAbilities.includes(ability.name)"
						@delete="ability.delete()"
					/>
				</template>

				<!-- Passive Abilities -->
				<div v-if="passiveAbilities.length > 0" class="category-header"><Localized label="Genesys.Labels.Passive" /></div>
				<Talent
					v-for="ability in passiveAbilities"
					:key="ability.id"
					:name="ability.name"
					:img="ability.img"
					:description="ability.systemData.description"
					:source="ability.systemData.source"
					:activation="ability.systemData.activation"
					@open="openItem(ability)"
					:can-delete="!archetypeAbilities.includes(ability.name)"
					@delete="ability.delete()"
				/>
			</div>

			<div class="header"><Localized label="Genesys.Labels.Talents" /></div>
			<div class="talents-container">
				<!-- Active Talents -->
				<div v-if="activeTalents.length > 0" class="category-header"><Localized label="Genesys.Labels.Active" /></div>
				<Talent
					v-for="talent in activeTalents.filter((t) => getTalentActivation(t).detail === '')"
					:key="talent.id"
					:name="talent.name"
					:img="talent.img"
					:description="talent.systemData.description"
					:source="talent.systemData.source"
					:activation="getTalentActivation(talent)"
					:effective-tier="getTalentEffectiveTier(talent)"
					:ranked="talent.systemData.ranked === 'yes'"
					:rank="talent.systemData.rank"
					:can-upgrade="canUpgradeTalent(talent)"
					can-delete
					@upgrade="upgradeTalent(talent)"
					@open="openItem(talent)"
					@delete="deleteTalent(talent)"
				/>

				<!-- Active Talents w/Description -->
				<template v-for="activeType in activeTalentTypes" :key="activeType">
					<div class="sub-category-header">{{ activeType }}</div>
					<Talent
						v-for="talent in activeTalents.filter((t) => getTalentActivation(t).detail.toLowerCase() === activeType)"
						:key="talent.id"
						:name="talent.name"
						:img="talent.img"
						:description="talent.systemData.description"
						:source="talent.systemData.source"
						:activation="getTalentActivation(talent)"
						:effective-tier="getTalentEffectiveTier(talent)"
						:ranked="talent.systemData.ranked === 'yes'"
						:rank="talent.systemData.rank"
						:can-upgrade="canUpgradeTalent(talent)"
						can-delete
						@upgrade="upgradeTalent(talent)"
						@open="openItem(talent)"
						@delete="deleteTalent(talent)"
					/>
				</template>

				<!-- Passive Talents -->
				<div v-if="passiveTalents.length > 0" class="category-header"><Localized label="Genesys.Labels.Passive" /></div>
				<Talent
					v-for="talent in passiveTalents"
					:key="talent.id"
					:name="talent.name"
					:img="talent.img"
					:description="talent.systemData.description"
					:source="talent.systemData.source"
					:activation="getTalentActivation(talent)"
					:effective-tier="getTalentEffectiveTier(talent)"
					:ranked="talent.systemData.ranked === 'yes'"
					:rank="talent.systemData.rank"
					:can-upgrade="canUpgradeTalent(talent)"
					can-delete
					@upgrade="upgradeTalent(talent)"
					@open="openItem(talent)"
					@delete="deleteTalent(talent)"
				/>

				<div v-if="availableProfessionTalentOffers.length > 0" class="category-header">
					{{ t('Genesys.Specializations.ProfessionTalentOffers', 'Profession Talents') }}
				</div>
				<div
					v-for="offer in availableProfessionTalentOffers"
					:key="offer.id"
					:class="['profession-talent-preview', `is-${offer.state}`, { 'is-expanded': isProfessionTalentExpanded(offer) }]"
					@click="toggleProfessionTalent(offer)"
				>
					<img :src="offer.sourceTalent?.img ?? 'icons/svg/aura.svg'" :alt="offer.talentName" />
					<span class="profession-talent-main">
						<a class="profession-talent-name">{{ offer.sourceTalent?.name ?? offer.talentName }}</a>
						<span class="profession-talent-source">{{ offer.specializationName }} - {{ offer.professionName }}</span>
					</span>
					<span class="profession-talent-cost">{{ offer.cost }} PD</span>
					<span class="profession-talent-status">{{ professionTalentOfferStatus(offer) }}</span>
					<div :class="`profession-talent-desc-container ${isProfessionTalentExpanded(offer) ? 'active' : ''}`" @click.stop>
						<div v-if="offer.sourceTalent?.systemData.effectiveTier ?? offer.sourceTalent?.systemData.tier" class="tier-container">
							<span class="tier"><Localized label="Genesys.Labels.Tier" />: {{ offer.sourceTalent?.systemData.effectiveTier ?? offer.sourceTalent?.systemData.tier }}</span>
						</div>

						<Enriched v-if="getProfessionTalentDescription(offer)" class="desc" :value="getProfessionTalentDescription(offer)" />

						<div class="profession-talent-purchase-row">
							<button type="button" :disabled="!canPurchaseProfessionTalent(offer)" @click.stop="purchaseProfessionTalent(offer)">
								{{ t('Genesys.TalentPurchasePrompt.PurchaseTitle', 'Purchase') }} - {{ offer.cost }} PD
							</button>
							<span v-if="!canPurchaseProfessionTalent(offer)" class="profession-talent-purchase-status">{{ professionTalentOfferStatus(offer) }}</span>
						</div>

						<div v-if="getProfessionTalentSource(offer)" class="source">{{ getProfessionTalentSource(offer) }}</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

.tab-talents {
	display: flex;
	flex-direction: column;
	flex-wrap: nowrap;
	padding: 0.5em;

	.block {
		display: flex;
		flex-direction: column;
		flex-wrap: nowrap;
		background: transparentize(colors.$light-blue, 0.8);
		border-bottom-left-radius: 1em;
		border-bottom-right-radius: 1em;
		padding: 0.5em 0.5em 1em 0.5em;
		gap: 0.25em;

		.header {
			font-family: 'Bebas Neue', sans-serif;
			font-size: 1.25em;
			margin-top: 0.5em;
			margin-bottom: -0.4em;

			&:first-of-type {
				margin-top: 0;
			}
		}
	}

	.talents-container {
		border: 1px solid colors.$blue;
		border-top: none;

		.category-header,
		.sub-category-header {
			font-family: 'Bebas Neue', sans-serif;
			color: white;
			padding-left: 0.25em;
			padding-top: 1px;
		}

		.category-header {
			background: colors.$blue;
			font-size: 1.1em;
		}

		.sub-category-header {
			border-top: 1px solid colors.$blue;
			background: transparentize(colors.$blue, 0.5);
			font-size: 1em;
		}

		&:empty {
			border: 1px dashed black;
			opacity: 0.25;
			height: 1em;
		}

		.profession-talent-preview {
			display: grid;
			grid-template-columns: 2em auto 1fr auto auto;
			grid-template-rows: repeat(2, auto);
			align-items: center;
			column-gap: 0.5em;
			row-gap: 0.1em;
			width: 100%;
			border: 0;
			border-top: 1px dashed rgba(0, 0, 0, 0.45);
			background: transparent;
			padding: 0.25em;
			color: colors.$dark-blue;
			text-align: left;

			&:hover {
				background: transparentize(colors.$gold, 0.82);
			}

			&.is-locked,
			&.is-owned,
			&.is-unaffordable {
				opacity: 0.55;
				filter: grayscale(0.7);
			}

			img {
				aspect-ratio: 1;
				object-fit: contain;
				width: 2em;
			}
		}

		.profession-talent-main {
			display: flex;
			align-items: baseline;
			gap: 0.35em;
			min-width: 0;
		}

		.profession-talent-name {
			font-family: 'Roboto Slab', serif;
			font-size: 1.1em;
			cursor: pointer;
		}

		.profession-talent-source,
		.profession-talent-status {
			font-family: 'Roboto', sans-serif;
			font-size: 0.78em;
			color: #5f7182;
		}

		.profession-talent-cost {
			font-family: 'Bebas Neue', sans-serif;
			font-size: 1em;
			white-space: nowrap;
			color: colors.$blue;
		}

		.profession-talent-status {
			white-space: nowrap;
		}

		.profession-talent-desc-container {
			grid-column: 1 / -1;
			grid-row: 2 / span 1;
			transition: max-height 0.5s ease-out;
			max-height: 0;
			transform-origin: 50% 0;
			overflow: hidden;
			padding-left: 0.5em;

			&.active {
				max-height: 500px;
				transition: max-height 1s ease-in;
			}

			.tier-container {
				margin-top: 0.5em;
				margin-bottom: 0.5em;
			}

			.tier {
				border: 1px dotted colors.$gold;
				background: transparentize(colors.$gold, 0.5);
				border-radius: 0.5em;
				font-family: 'Bebas Neue', sans-serif;
				padding: 2px;
			}

			.source {
				text-align: right;
				font-family: 'Roboto', sans-serif;
				font-style: italic;
				font-size: 0.8em;
			}
		}

		.profession-talent-purchase-row {
			display: flex;
			align-items: center;
			gap: 0.5em;
			margin: 0.5em 0;

			button {
				font-family: 'Bebas Neue', sans-serif;
				padding: 0.25em 0.8em;
			}
		}

		.profession-talent-purchase-status {
			font-family: 'Roboto', sans-serif;
			font-size: 0.85em;
			color: #5f7182;
		}
	}

	.pyramid {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.5em;
		align-items: center;
		justify-content: right;
		border-top-left-radius: 1em;
		border-top-right-radius: 1em;
		background: transparentize(colors.$light-blue, 0.8);
		font-family: 'Bebas Neue', sans-serif;
		padding-right: 1em;
		padding-top: 0.25em;
	}
}
</style>
