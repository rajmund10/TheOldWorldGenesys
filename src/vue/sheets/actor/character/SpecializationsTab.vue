<script lang="ts" setup>
import { computed, inject, ref, toRaw, watch } from 'vue';
import { ActorSheetContext, RootContext } from '@/vue/SheetContext';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import Localized from '@/vue/components/Localized.vue';
import SpecializationDataModel, { type SpecializationProfessionStep } from '@/item/data/SpecializationDataModel';
import GenesysItem from '@/item/GenesysItem';
import TalentTree from '@/vue/components/character/TalentTree.vue';
import { arrayFromItems } from '@/utils/collection';
import type { TalentTreeData, TalentTreeNode } from '@/vue/components/character/TalentTreeTypes';
import TalentPurchasePrompt from '@/app/TalentPurchasePrompt';
import type CharacterSheet from '@/actor/sheets/CharacterSheet';

const context = inject<ActorSheetContext<CharacterDataModel, CharacterSheet>>(RootContext)!;

type ProfessionStageState = 'current' | 'completed' | 'upcoming';

const ACTIVE_SPECIALIZATION_FLAG = 'activeSpecializationId';
const PROFESSION_BY_SPECIALIZATION_FLAG = 'professionStepBySpecialization';

function t(key: string, fallback: string, formatArgs?: Record<string, string | number>): string {
	if (game?.i18n) {
		const localized = formatArgs ? game.i18n.format(key, formatArgs) : game.i18n.localize(key);
		if (localized !== key) {
			return localized;
		}
	}

	return fallback;
}

const reactiveActor = computed(() => context.data.actor);
const actor = computed(() => {
	context.renderKey;
	return toRaw(reactiveActor.value);
});

const system = computed(() => {
	context.renderKey;
	return reactiveActor.value.systemData;
});
const talentUnavailableMessage = t('Genesys.Specializations.TalentUnavailable', 'This talent is not available yet. You must first purchase a connected talent.');
const notEnoughXpMessage = t('Genesys.Notifications.NotEnoughXP', 'Not enough XP.');
const availableXpLabel = t('Genesys.TalentTree.AvailableXP', 'Available XP:');
const activeSpecializationLabel = t('Genesys.Specializations.ActiveSpecialization', 'Aktywna specjalizacja');

function createEmptyTreeData(): TalentTreeData {
	return {
		nodes: {},
		connections: {},
		backgroundImage: '',
		bgPosX: '0px',
		bgPosY: '0px',
	};
}

function normalizeTreeData(data: unknown): TalentTreeData {
	if (!data || typeof data !== 'object') {
		return createEmptyTreeData();
	}

	const partialData = data as Partial<TalentTreeData>;
	return {
		nodes: partialData.nodes ?? {},
		connections: partialData.connections ?? {},
		backgroundImage: partialData.backgroundImage ?? '',
		bgPosX: partialData.bgPosX ?? '0px',
		bgPosY: partialData.bgPosY ?? '0px',
	};
}

function professionKey(step: SpecializationProfessionStep, index: number) {
	return step.id || step.name || `profession-${index}`;
}

function professionId(step: SpecializationProfessionStep, index: number) {
	return step.id || professionKey(step, index);
}

function getSpecializationProfessionPath(specialization: GenesysItem<SpecializationDataModel>) {
	const systemDataPath = specialization.systemData?.professionPath;
	if (Array.isArray(systemDataPath)) {
		return systemDataPath;
	}

	const rawPath = (specialization.system as Partial<SpecializationDataModel> | undefined)?.professionPath;
	return Array.isArray(rawPath) ? rawPath : [];
}

function getProfessionDisplayNumber(index: number) {
	const previousBaseSteps = professionPath.value.slice(0, index).filter((step) => !step.isAlternative).length;
	if (professionPath.value[index]?.isAlternative) {
		return previousBaseSteps + 1;
	}

	return previousBaseSteps + 1;
}

const availableXP = computed(() => actor.value.systemData.availableXP ?? 0);

const isGM = computed(() => game.user?.isGM || false);
const specializations = computed(() => {
	context.renderKey;
	const actorItems = arrayFromItems<GenesysItem<SpecializationDataModel>>(actor.value.items);
	return actorItems.filter((item) => item.type === 'specialization');
});
const activeSpecializationId = ref((actor.value.getFlag('genesys', ACTIVE_SPECIALIZATION_FLAG) as string | undefined) ?? '');
const mainSpecialization = computed(() => specializations.value.find((specialization) => specialization.id === activeSpecializationId.value) ?? specializations.value[0] ?? null);
const professionPath = computed(() => (mainSpecialization.value ? getSpecializationProfessionPath(mainSpecialization.value) : []));
const selectedProfessionId = ref('');
const currentProfessionIndex = computed(() => professionPath.value.findIndex((step, index) => isCurrentProfession(step, index)));
const treeData = ref<TalentTreeData>(createEmptyTreeData());

function getProfessionStepMap() {
	const rawMap = actor.value.getFlag('genesys', PROFESSION_BY_SPECIALIZATION_FLAG);
	return rawMap && typeof rawMap === 'object' ? { ...(rawMap as Record<string, string>) } : {};
}

function getSelectedProfessionIdForSpecialization(specialization: GenesysItem<SpecializationDataModel>) {
	const professionStepMap = getProfessionStepMap();
	return professionStepMap[specialization.id] || (specialization.id === specializations.value[0]?.id ? system.value.mainProfessionId : '');
}

async function loadTreeData(): Promise<TalentTreeData> {
	const specialization = mainSpecialization.value;
	if (!specialization) {
		return createEmptyTreeData();
	}

	const specializationTreeData = await specialization.getFlag('genesys', 'treeData');
	if (specializationTreeData) {
		return hydrateTreeMetadata(normalizeTreeData(specializationTreeData), specialization);
	}

	const actorTreeData = await actor.value.getFlag('genesys', 'treeData');
	return hydrateTreeMetadata(normalizeTreeData(actorTreeData), actor.value);
}

watch(
	mainSpecialization,
	async () => {
		treeData.value = await loadTreeData();
	},
	{ immediate: true },
);

watch(
	[mainSpecialization, () => system.value.mainProfessionId, activeSpecializationId],
	([specialization]) => {
		selectedProfessionId.value = specialization ? getSelectedProfessionIdForSpecialization(specialization) : '';
	},
	{ immediate: true },
);

function isNodeAccessible(row: number, col: number): boolean {
	if (row === 0) {
		return true;
	}

	const vKey = `v-${row - 1}-${col}`;
	if (treeData.value.connections[vKey]) {
		const nodeAbove = treeData.value.nodes[`${row - 1}-${col}`];
		if (nodeAbove?.purchased) {
			return true;
		}
	}

	const hKeyLeft = `h-${row}-${col - 1}`;
	if (treeData.value.connections[hKeyLeft]) {
		const nodeLeft = treeData.value.nodes[`${row}-${col - 1}`];
		if (nodeLeft?.purchased) {
			return true;
		}
	}

	const hKeyRight = `h-${row}-${col}`;
	if (treeData.value.connections[hKeyRight]) {
		const nodeRight = treeData.value.nodes[`${row}-${col + 1}`];
		if (nodeRight?.purchased) {
			return true;
		}
	}

	return false;
}

async function saveTreeData() {
	const owner = mainSpecialization.value ?? actor.value;
	await owner.setFlag('genesys', 'treeData', treeData.value);
}

async function setNodePurchasedState(key: string, node: TalentTreeNode, purchased: boolean, realItemId?: string) {
	treeData.value = {
		...treeData.value,
		nodes: {
			...treeData.value.nodes,
			[key]: {
				...node,
				purchased,
				realItemId: purchased ? (realItemId ?? node.realItemId) : undefined,
			},
		},
	};

	await saveTreeData();
}

async function handleNodeClick(key: string, node: TalentTreeNode | null, cost: number) {
	if (!node) return;

	const [row, col] = key.split('-').map(Number);

	if (node.purchased) {
		const { canRefund, errorMessage } = TalentPurchasePrompt.canRefundTalent(row, col, treeData.value.connections, treeData.value.nodes);
		const confirmed = await TalentPurchasePrompt.promptForRefund(node.name, cost, canRefund, errorMessage);

		if (confirmed && canRefund) {
			const result = await TalentPurchasePrompt.refundTalent(toRaw(actor.value), {
				talentId: node.id,
				talentName: node.name,
				realItemId: node.realItemId,
				cost,
			});

			if (result.success) {
				await setNodePurchasedState(key, node, false);
				await context.sheet.render(false);
			}
		}
		return;
	}

	if (!isNodeAccessible(row, col)) {
		ui.notifications.error(talentUnavailableMessage);
		return;
	}

	if (availableXP.value < cost) {
		ui.notifications.error(notEnoughXpMessage);
		return;
	}

	const confirmed = await TalentPurchasePrompt.promptForPurchase(node.name, cost);
	if (!confirmed) {
		return;
	}

	const result = await TalentPurchasePrompt.purchaseTalent(
		toRaw(actor.value),
		{
			talentId: node.id,
			talentName: node.name,
			cost,
			treeManaged: true,
		},
	);

	if (result.success) {
		await setNodePurchasedState(key, node, true, result.itemId);
		await context.sheet.render(false);
	}
}

async function findSourceTalentItem(talentId: string) {
	for (const pack of game.packs) {
		if (pack.metadata.type !== 'Item') {
			continue;
		}

		const item = (await pack.getDocument(talentId)) as any;
		if (item?.type === 'talent') {
			return item;
		}
	}

	const worldItem = game.items.get(talentId);
	return worldItem?.type === 'talent' ? worldItem : null;
}

async function hydrateTreeMetadata(tree: TalentTreeData, owner: GenesysItem<SpecializationDataModel> | typeof actor.value): Promise<TalentTreeData> {
	let changed = false;
	const nodes = { ...tree.nodes };

	await Promise.all(
		Object.entries(tree.nodes).map(async ([key, node]) => {
			if (node.purchased && node.realItemId) {
				const ownedTalent = actor.value.items.get(node.realItemId);
				if (ownedTalent?.type === 'talent' && !ownedTalent.getFlag('genesys', 'treeManaged')) {
					await ownedTalent.setFlag('genesys', 'treeManaged', true);
				}
			}

			if (node.ranked && node.activation) {
				return;
			}

			const talent = await findSourceTalentItem(node.id);
			if (!talent) {
				return;
			}

			nodes[key] = {
				...node,
				ranked: node.ranked ?? talent.systemData?.ranked ?? talent.system?.ranked ?? 'no',
				activation: node.activation ?? {
					type: talent.systemData?.activation?.type ?? talent.system?.activation?.type ?? 'passive',
					detail: talent.systemData?.activation?.detail ?? talent.system?.activation?.detail ?? '',
				},
			};
			changed = true;
		}),
	);

	if (!changed) {
		return tree;
	}

	const hydratedTree = {
		...tree,
		nodes,
	};
	await owner.setFlag('genesys', 'treeData', hydratedTree);
	return hydratedTree;
}

async function handleNodeContextMenu(_key: string, node: TalentTreeNode | null) {
	if (!node) {
		return;
	}

	if (node.realItemId) {
		const ownedTalent = actor.value.items.get(node.realItemId);
		if (ownedTalent?.type === 'talent') {
			ownedTalent.sheet?.render(true);
			return;
		}
	}

	const sourceTalent = await findSourceTalentItem(node.id);
	if (sourceTalent) {
		sourceTalent.sheet?.render(true);
		return;
	}

	ui.notifications.warn(t('Genesys.Notifications.TalentNotFound', 'Talent not found.'));
}

async function handleTreeDataUpdate(newData: TalentTreeData) {
	treeData.value = newData;
	await saveTreeData();
}

function isCurrentProfession(step: SpecializationProfessionStep, index: number) {
	return selectedProfessionId.value === professionId(step, index);
}

function getProfessionStageState(index: number): ProfessionStageState {
	if (currentProfessionIndex.value === -1) {
		return 'upcoming';
	}

	if (index < currentProfessionIndex.value) {
		return 'completed';
	}

	if (index === currentProfessionIndex.value) {
		return 'current';
	}

	return 'upcoming';
}

function isProfessionInherited(index: number, targetIndex: number) {
	if (!professionPath.value[targetIndex] || index >= targetIndex) {
		return false;
	}

	const step = professionPath.value[index];
	return !step.isAlternative;
}

function getInheritedProfessionEffects(index: number) {
	return professionPath.value
		.map((step, stepIndex) => ({ step, stepIndex }))
		.filter(({ step, stepIndex }) => isProfessionInherited(stepIndex, index) && !!step.effects?.trim())
		.map(({ step, stepIndex }) => ({
			key: professionKey(step, stepIndex),
			name: step.name || t('Genesys.Specializations.ProfessionUnnamed', 'Unnamed Profession'),
			effects: step.effects,
		}));
}

async function setActiveSpecialization(specializationId: string) {
	if (activeSpecializationId.value === specializationId) {
		return;
	}

	activeSpecializationId.value = specializationId;
	await actor.value.setFlag('genesys', ACTIVE_SPECIALIZATION_FLAG, specializationId);
}

async function setCurrentProfession(step: SpecializationProfessionStep, index: number) {
	const currentProfessionId = professionId(step, index);
	if (selectedProfessionId.value === currentProfessionId) {
		return;
	}

	const previousProfessionId = selectedProfessionId.value;
	selectedProfessionId.value = currentProfessionId;

	try {
		if (mainSpecialization.value) {
			await actor.value.setFlag('genesys', PROFESSION_BY_SPECIALIZATION_FLAG, {
				...getProfessionStepMap(),
				[mainSpecialization.value.id]: currentProfessionId,
			});
		}

		await actor.value.update({
			'system.mainProfessionId': currentProfessionId,
		});
	} catch (error) {
		selectedProfessionId.value = previousProfessionId;
		throw error;
	}
}
</script>

<template>
	<div class="specializations-tab" :class="{ 'has-specialization': mainSpecialization }">
		<template v-if="mainSpecialization">
			<section v-if="specializations.length > 1" class="specialization-management">
				<div class="active-specialization-picker">
					<span>{{ activeSpecializationLabel }}</span>
					<button
						v-for="specialization in specializations"
						:key="specialization.id"
						type="button"
						:class="{ active: specialization.id === mainSpecialization.id }"
						@click="setActiveSpecialization(specialization.id)"
					>
						{{ specialization.name }}
					</button>
				</div>
			</section>

			<div class="talent-tree-fullscreen">
				<div class="tree-header">
					<div class="xp-display">
						{{ availableXpLabel }} <span class="xp-val" :style="{ color: availableXP >= 0 ? '#2e7d32' : '#d32f2f' }">{{ availableXP }}</span>
					</div>
				</div>

				<TalentTree
					:tree-data="treeData"
					:mode="isGM ? 'gm' : 'view'"
					:available-xp="availableXP"
					:show-header="false"
					@update:tree-data="handleTreeDataUpdate"
					@node-click="handleNodeClick"
					@node-context-menu="handleNodeContextMenu"
				/>
			</div>

			<section class="profession-path-panel">
				<div class="panel-header">
					<div>
						<h3>{{ t('Genesys.Specializations.CareerPathTitle', 'Profession Path') }}</h3>
						<p>{{ t('Genesys.Specializations.CareerPathHint', 'Select the current step in the character profession path.') }}</p>
					</div>
				</div>

				<div v-if="professionPath.length" class="profession-path-list">
					<article
						v-for="(step, index) in professionPath"
						:key="professionKey(step, index)"
						:class="[
							'profession-card',
							{
								active: isCurrentProfession(step, index),
								alternative: step.isAlternative,
								completed: getProfessionStageState(index) === 'completed',
								upcoming: getProfessionStageState(index) === 'upcoming',
							},
						]"
						@click="setCurrentProfession(step, index)"
					>
						<div class="profession-card-top">
							<div class="profession-heading">
								<div :class="['profession-marker', `is-${getProfessionStageState(index)}`]">
									<span>{{ getProfessionDisplayNumber(index) }}</span>
								</div>

								<div class="profession-summary">
									<div class="profession-summary-top">
										<strong>{{ step.name || t('Genesys.Specializations.ProfessionUnnamed', 'Unnamed Profession') }}</strong>
									</div>
								</div>
							</div>

							<div v-if="!isCurrentProfession(step, index)" class="profession-actions">
								<button type="button" class="profession-select" @click.stop="setCurrentProfession(step, index)">
									{{ t('Genesys.Specializations.ProfessionSetCurrent', 'Set Current') }}
								</button>
							</div>
						</div>

						<div v-if="step.prerequisites || step.effects" class="profession-details-grid">
							<div v-if="step.prerequisites" class="profession-detail prerequisites-detail">
								<span class="detail-label">{{ t('Genesys.Specializations.ProfessionPrerequisites', 'Prerequisites') }}</span>
								<p>{{ step.prerequisites }}</p>
							</div>

							<div v-if="step.effects" class="profession-detail effects-detail">
								<span class="detail-label">{{ t('Genesys.Specializations.ProfessionEffects', 'Effects') }}</span>
								<p>{{ step.effects }}</p>
							</div>
						</div>

						<div v-if="isCurrentProfession(step, index) && getInheritedProfessionEffects(index).length" class="profession-detail inherited-effects">
							<span class="detail-label">{{ t('Genesys.Specializations.ProfessionInheritedEffects', 'Includes Lower-Tier Effects') }}</span>
							<div class="inherited-effects-list">
								<div v-for="effectStep in getInheritedProfessionEffects(index)" :key="effectStep.key" class="inherited-effect-entry">
									<strong>{{ effectStep.name }}</strong>
									<p>{{ effectStep.effects }}</p>
								</div>
							</div>
						</div>

					</article>
				</div>

				<div v-else class="profession-empty-state">
					{{ t('Genesys.Specializations.CareerPathEmpty', 'This specialization has no profession progression defined yet.') }}
				</div>
			</section>
		</template>

		<div v-else class="no-specializations">
			<i class="fas fa-scroll"></i>
			<p><Localized label="Genesys.Specializations.EmptyTitle" /></p>
			<p class="hint"><Localized label="Genesys.Specializations.EmptyHint" /></p>
		</div>
	</div>
</template>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

.specializations-tab {
	padding: 0.5em;
	height: 100%;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 0.75em;
	overflow: hidden;

	&.has-specialization {
		padding: 0.5em;
	}

	.talent-tree-fullscreen {
		flex: 1 1 auto;
		min-height: 14rem;
		overflow: hidden;
		background: transparentize(colors.$light-blue, 0.8);
		border-radius: 1em;
		padding: 0.5em;

		:deep(.talent-tree-container) {
			height: 100%;
			min-height: 0;
		}
	}

	.tree-header {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.75rem;
		background: colors.$blue;
		border-radius: 0.75rem;
		color: white;

		.xp-display {
			font-family: 'Bebas Neue', sans-serif;
			letter-spacing: 0.03em;
		}

		.xp-display {
			font-size: 1.1em;
			white-space: nowrap;

			.xp-val {
				font-weight: 900;
			}
		}

	}

	.no-specializations {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35em;
		padding: 2em;
		text-align: center;
		color: colors.$dark-blue;
		background: transparentize(colors.$light-blue, 0.8);
		border: 1px dashed colors.$gold;
		border-radius: 1em;

		i {
			font-size: 3em;
			margin-bottom: 0.2em;
			color: colors.$gold;
			opacity: 0.9;
		}

		p {
			margin: 0.15em 0;
			font-family: 'Roboto Slab', serif;
			font-size: 1.05em;

			&.hint {
				font-size: 0.9em;
				opacity: 0.75;
			}
		}
	}
}

.profession-path-panel {
	background: transparentize(colors.$light-blue, 0.8);
	border: 1px solid transparentize(colors.$gold, 0.25);
	border-radius: 1em;
	padding: 0.7em;
	display: flex;
	flex-direction: column;
	gap: 0.55em;
	flex: 0 0 auto;
	min-height: 11rem;
	max-height: min(30vh, 280px);
	overflow: hidden;
}

.panel-header {
	flex: 0 0 auto;

	h3 {
		margin: 0;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.5rem;
		letter-spacing: 0.04em;
		color: colors.$dark-blue;
	}

	p {
		margin: 0.15em 0 0;
		font-family: 'Roboto Slab', serif;
		font-size: 0.85rem;
		color: #5f7182;
	}
}

.profession-path-list {
	display: grid;
	gap: 0.45em;
	min-height: 0;
	overflow: auto;
	padding-right: 0.25em;
}

.profession-card {
	display: flex;
	flex-direction: column;
	gap: 0.45em;
	padding: 0.58em 0.7em;
	border-radius: 0.9em;
	border: 1px solid rgba(39, 67, 90, 0.14);
	background: rgba(255, 255, 255, 0.58);
	cursor: pointer;
	transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background-color 0.18s ease;

	&:hover {
		border-color: rgba(39, 67, 90, 0.35);
		box-shadow: 0 6px 18px rgba(39, 67, 90, 0.08);
		transform: translateY(-1px);
	}

	&.active {
		border-color: rgba(199, 156, 75, 0.85);
		box-shadow: 0 8px 18px rgba(199, 156, 75, 0.14);
		background: rgba(255, 252, 244, 0.82);
	}

	&.completed {
		background: rgba(243, 248, 252, 0.9);
	}
}

.profession-card-top {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.75em;
}

.profession-heading {
	display: flex;
	align-items: center;
	gap: 0.7em;
	min-width: 0;
}

.profession-marker {
	width: 1.65rem;
	height: 1.65rem;
	border-radius: 999px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 auto;
	font-family: 'Bebas Neue', sans-serif;
	font-size: 1rem;
	letter-spacing: 0.04em;
	border: 1px solid rgba(39, 67, 90, 0.18);
	background: rgba(255, 255, 255, 0.8);
	color: colors.$dark-blue;

	&.is-current {
		border-color: rgba(199, 156, 75, 0.85);
		background: rgba(255, 244, 214, 0.95);
		color: #8a5d17;
	}

	&.is-completed {
		border-color: rgba(39, 67, 90, 0.24);
		background: rgba(220, 232, 241, 0.92);
	}

	&.is-upcoming {
		opacity: 0.82;
	}
}

.profession-summary {
	display: flex;
	flex-direction: column;
	gap: 0.18em;
	min-width: 0;
	flex: 1 1 auto;

	strong {
		font-family: 'Roboto Slab', serif;
		font-size: 0.98rem;
		color: colors.$dark-blue;
	}
}

.profession-summary-top {
	display: flex;
	align-items: center;
	gap: 0.5em;
	flex-wrap: wrap;
}

.detail-label {
	display: inline-flex;
	align-items: center;
	width: fit-content;
	font-family: 'Bebas Neue', sans-serif;
	letter-spacing: 0.05em;
}

.profession-select {
	border: none;
	border-radius: 999px;
	padding: 0.34rem 0.8rem;
	font-family: 'Bebas Neue', sans-serif;
	font-size: 0.8rem;
	letter-spacing: 0.05em;
	background: rgba(39, 67, 90, 0.12);
	color: colors.$dark-blue;
	cursor: pointer;
	white-space: nowrap;
}

.profession-details-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	align-items: start;
	justify-items: stretch;
	gap: 0.65em 1.25em;
	width: 100%;
	text-align: left;
}

.profession-detail {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: flex-start;
	gap: 0.18em;
	text-align: left;
	min-width: 0;
	width: 100%;
	max-width: 100%;
	margin: 0;
	align-self: start;
	justify-self: stretch;

	p {
		display: block;
		width: 100%;
		max-width: none;
		margin: 0;
		font-family: 'Roboto Slab', serif;
		font-size: 0.86rem;
		color: #41586d;
		line-height: 1.28;
		white-space: normal;
		text-align: left;
	}
}

.prerequisites-detail {
	order: 1;
}

.effects-detail {
	order: 2;
}

@container sheet (width < 37.5rem) {
	.profession-details-grid {
		grid-template-columns: 1fr;
	}
}

.inherited-effects {
	padding-top: 0.1em;
}

.inherited-effects-list {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.inherited-effect-entry {
	padding: 0.45em 0.55em;
	border-radius: 0.7em;
	background: rgba(39, 67, 90, 0.06);

	strong {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.8rem;
		letter-spacing: 0.05em;
		color: colors.$dark-blue;
	}

	p {
		margin-top: 0.2em;
	}
}

.specialization-management {
	display: flex;
	flex: 0 0 auto;
}

.active-specialization-picker {
	background: transparentize(colors.$light-blue, 0.8);
	border: 1px solid transparentize(colors.$blue, 0.45);
	border-radius: 0.85em;
	padding: 0.55em 0.65em;
}

.active-specialization-picker {
	display: flex;
	align-items: center;
	gap: 0.45em;
	flex-wrap: wrap;

	span {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1rem;
		color: colors.$dark-blue;
		margin-right: 0.2em;
	}

	button {
		border: 1px solid rgba(39, 67, 90, 0.2);
		border-radius: 0.55em;
		background: rgba(255, 255, 255, 0.65);
		color: colors.$dark-blue;
		padding: 0.25em 0.6em;
		font-family: 'Roboto Slab', serif;
		font-size: 0.82rem;
		cursor: pointer;

		&.active {
			border-color: rgba(199, 156, 75, 0.85);
			background: rgba(255, 244, 214, 0.95);
		}
	}
}

.detail-label {
	font-size: 0.82rem;
	color: #6d6e71;
}

.profession-empty-state {
	padding: 0.9em 1em;
	border: 1px dashed rgba(39, 67, 90, 0.18);
	border-radius: 0.8em;
	font-family: 'Roboto Slab', serif;
	color: #5f7182;
	background: rgba(255, 255, 255, 0.45);
}

@container sheet (max-width: 860px) {
	.profession-summary-top {
		align-items: center;
	}
}
</style>









