<script lang="ts" setup>
import { computed, inject, ref } from 'vue';
import { ItemSheetContext, RootContext } from '@/vue/SheetContext';
import BasicItemSheet from '@/vue/sheets/item/BasicItemSheet.vue';
import SpecializationDataModel, { type SpecializationProfessionStep } from '@/item/data/SpecializationDataModel';
import GameProfileFields from '@/vue/components/item/GameProfileFields.vue';
import Editor from '@/vue/components/Editor.vue';
import TalentTree from '@/vue/components/character/TalentTree.vue';
import type { TalentTreeData } from '@/vue/components/character/TalentTreeTypes';
import { getMagicSchoolOptions } from '@/magic/MagicProfiles';

const context = inject<ItemSheetContext<SpecializationDataModel>>(RootContext)!;
const system = computed(() => context.data.item.systemData);

function t(key: string, fallback: string, formatArgs?: Record<string, string | number>) {
	if (game?.i18n) {
		const localized = formatArgs ? game.i18n.format(key, formatArgs) : game.i18n.localize(key);
		if (localized !== key) {
			return localized;
		}
	}

	return fallback;
}

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

function createProfessionStep(): SpecializationProfessionStep {
	return {
		id: foundry.utils.randomID(),
		name: '',
		tier: 1,
		prerequisites: '',
		effects: '',
		isAlternative: false,
	};
}

function professionKey(step: SpecializationProfessionStep, index: number) {
	return step.id || step.name || `profession-${index}`;
}

function normalizeSkillName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function uniqueSkillNames(names: string[]) {
	return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
}

const treeData = ref<TalentTreeData>(createEmptyTreeData());
const schoolOptions = computed(() => getMagicSchoolOptions(system.value.magicAccess.tradition));
const careerSkills = computed(() => system.value.careerSkills ?? []);
const grantedItems = computed(() => system.value.grantedItems ?? []);
const professionPath = computed(() => system.value.professionPath ?? []);

async function loadTreeData() {
	const data = await context.data.item.getFlag('genesys', 'treeData');
	treeData.value = normalizeTreeData(data);
}

async function saveTreeData() {
	await context.data.item.setFlag('genesys', 'treeData', treeData.value);
}

async function updateProfessionPath(professionPath: SpecializationProfessionStep[]) {
	await context.data.item.update({
		'system.professionPath': professionPath,
	});
}

async function updateCareerSkills(careerSkills: string[]) {
	const previousSkills = uniqueSkillNames(system.value.careerSkills ?? []);
	const updatedSkills = careerSkills.map((skill) => skill.trim());

	await context.data.item.update({
		'system.careerSkills': updatedSkills,
	});

	await syncOwnedActorCareerSkills(previousSkills, uniqueSkillNames(updatedSkills));
}

async function updateAllowedArchetypeKeys(value: string) {
	await context.data.item.update({
		'system.allowedArchetypeKeys': value.split(',').map((key) => key.trim()).filter(Boolean),
	});
}

function handleTreeDataUpdate(newData: TalentTreeData) {
	treeData.value = newData;
	void saveTreeData();
}

function handleBackgroundChange(image: string) {
	treeData.value = {
		...treeData.value,
		backgroundImage: image,
		bgPosX: '0px',
		bgPosY: '0px',
	};
	void saveTreeData();
}

function handleBackgroundPositionChange(x: string, y: string) {
	treeData.value = {
		...treeData.value,
		bgPosX: x,
		bgPosY: y,
	};
	void saveTreeData();
}

function handleNodeClick(_key: string, _node: unknown, _cost: number) {
	// Edit mode behavior lives inside TalentTree interactions.
}

function handleConnectionClick(key: string) {
	const updatedConnections = { ...treeData.value.connections };
	if (updatedConnections[key]) {
		delete updatedConnections[key];
	} else {
		updatedConnections[key] = true;
	}

	treeData.value = {
		...treeData.value,
		connections: updatedConnections,
	};
	void saveTreeData();
}

async function handleTalentDrop(key: string, event: DragEvent) {
	event.preventDefault();
	const droppedData = event.dataTransfer?.getData('text/plain');
	if (!droppedData) {
		return;
	}

	try {
		const dragData = JSON.parse(droppedData) as { uuid?: string };
		if (!dragData.uuid) {
			return;
		}

		const item = (await fromUuid(dragData.uuid)) as any;
		if (!item || item.type !== 'talent') {
			return;
		}

		treeData.value = {
			...treeData.value,
			nodes: {
				...treeData.value.nodes,
				[key]: {
					name: item.name,
					img: item.img,
					id: item.id,
					description: item.system?.description || '',
					ranked: item.systemData?.ranked ?? item.system?.ranked ?? 'no',
					activation: {
						type: item.systemData?.activation?.type ?? item.system?.activation?.type ?? 'passive',
						detail: item.systemData?.activation?.detail ?? item.system?.activation?.detail ?? '',
					},
					purchased: false,
				},
			},
		};
		await saveTreeData();
		ui.notifications.info(`Added talent ${item.name} to the tree.`);
	} catch (error) {
		console.error('Error handling talent drop:', error);
		ui.notifications.error('Failed to place talent in specialization tree.');
	}
}

function handleContextMenu(key: string) {
	const updatedNodes = { ...treeData.value.nodes };
	delete updatedNodes[key];

	treeData.value = {
		...treeData.value,
		nodes: updatedNodes,
	};
	void saveTreeData();
}

async function addProfessionStepToPath() {
	await updateProfessionPath([...professionPath.value, createProfessionStep()]);
}

async function removeCareerSkill(index: number) {
	const updatedSkills = [...careerSkills.value];
	updatedSkills.splice(index, 1);
	await updateCareerSkills(updatedSkills);
}

async function removeGrantedItem(index: number) {
	const updatedItems = [...grantedItems.value];
	updatedItems.splice(index, 1);
	await context.data.item.update({
		'system.grantedItems': updatedItems,
	});
}

async function syncOwnedActorCareerSkills(previousSkills: string[], updatedSkills: string[]) {
	const ownedItem = context.data.item as any;
	const actor = ownedItem.actor;
	if (!actor) {
		return;
	}

	const affectedSkillNames = new Set([...previousSkills, ...updatedSkills].map(normalizeSkillName));
	const careerSkillSourceNames = new Set<string>();

	for (const item of actor.items) {
		if (item.type === 'career') {
			for (const skill of item.systemData.careerSkills ?? []) {
				if (skill?.name) {
					careerSkillSourceNames.add(normalizeSkillName(skill.name));
				}
			}
		} else if (item.type === 'specialization') {
			const sourceSkills = item.id === ownedItem.id ? updatedSkills : item.systemData.careerSkills ?? [];
			for (const skillName of sourceSkills) {
				if (skillName) {
					careerSkillSourceNames.add(normalizeSkillName(skillName));
				}
			}
		}
	}

	const actorSkills = Array.from(actor.items).filter((item: any) => item.type === 'skill');
	await Promise.all(
		actorSkills.map(async (skill: any) => {
			const normalizedName = normalizeSkillName(skill.name);
			const shouldBeCareer = careerSkillSourceNames.has(normalizedName);
			const canClearCareer = affectedSkillNames.has(normalizedName);
			if (!shouldBeCareer && !canClearCareer) {
				return;
			}

			if (skill.systemData.career === shouldBeCareer) {
				return;
			}

			await skill.update({
				'system.career': shouldBeCareer,
			});
		}),
	);

	actor.sheet?.render(false);
}

async function updateProfessionStep(index: number, patch: Partial<SpecializationProfessionStep>) {
	const updatedSteps = [...professionPath.value];
	updatedSteps[index] = {
		...updatedSteps[index],
		...patch,
	};
	await updateProfessionPath(updatedSteps);
}

async function removeProfessionStep(index: number) {
	const updatedSteps = [...professionPath.value];
	updatedSteps.splice(index, 1);
	await updateProfessionPath(updatedSteps);
}

void loadTreeData();
</script>

<template>
	<BasicItemSheet show-effects-tab has-decoration>
		<template v-slot:description>
			<section class="specialization-container">
				<div class="specialization-header">
					<h3>{{ context.data.item.name }}</h3>
				</div>

				<div class="status-row">
					<label>{{ t('Genesys.SpecializationSheet.SocialStatus', 'Social Status') }}</label>
					<input type="text" name="system.socialStatus" :value="system.socialStatus" :placeholder="t('Genesys.SpecializationSheet.SocialStatusPlaceholder', 'Example: Silver 2')" />
				</div>

				<div class="form-group">
					<label>{{ t('Genesys.SpecializationSheet.Description', 'Specialization Description') }}</label>
					<div class="spec-description-editor">
						<Editor name="system.description" :content="system.description" button />
					</div>
				</div>

				<div class="tree-wrapper">
					<TalentTree
						:tree-data="treeData"
						mode="edit"
						:specialization-name="context.data.item.name"
						@update:tree-data="handleTreeDataUpdate"
						@node-click="handleNodeClick"
						@connection-click="handleConnectionClick"
						@background-change="handleBackgroundChange"
						@background-position-change="handleBackgroundPositionChange"
						@talent-drop="handleTalentDrop"
						@node-context-menu="handleContextMenu"
					/>
				</div>

				<div class="instructions">
					<p><i class="fas fa-info-circle"></i> {{ t('Genesys.SpecializationSheet.DropTalent', 'Drag talents from a compendium onto the tree slots.') }}</p>
					<p><i class="fas fa-info-circle"></i> {{ t('Genesys.SpecializationSheet.RemoveTalent', 'Right-click a talent to remove it from the tree.') }}</p>
					<p><i class="fas fa-info-circle"></i> {{ t('Genesys.SpecializationSheet.ToggleConnection', 'Click connectors between slots to add or remove links.') }}</p>
					<p><i class="fas fa-info-circle"></i> {{ t('Genesys.SpecializationSheet.ImportTree', 'Drop another specialization on this sheet to import its full talent tree, including connections.') }}</p>
				</div>
			</section>
		</template>

		<template v-slot:data>
			<section class="data-grid specialization-data">
				<div class="section-heading">{{ t('Genesys.SpecializationSheet.SpecializationData', 'Specialization Data') }}</div>

				<GameProfileFields :item="context.data.item" :model-value="system.gameProfiles" :editable="context.data.editable" />

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.Key', 'Technical Key') }}</label>
					<input type="text" name="system.key" :value="system.key" />
				</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.Cost', 'XP Cost') }}</label>
					<input type="number" name="system.cost" :value="system.cost" min="0" />
				</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.Requirements', 'Requirements') }}</label>
					<input type="text" name="system.requirements" :value="system.requirements" />
				</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.AllowedArchetypes', 'Allowed archetype keys') }}</label>
					<div class="stacked-field">
						<input
							type="text"
							:value="system.allowedArchetypeKeys.join(', ')"
							@change="updateAllowedArchetypeKeys(($event.target as HTMLInputElement).value)"
						/>
						<p class="field-hint">{{ t('Genesys.SpecializationSheet.AllowedArchetypesHint', 'Comma-separated stable archetype keys. Empty means unrestricted.') }}</p>
					</div>
				</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.Benefits', 'Benefits') }}</label>
					<input type="text" name="system.benefits" :value="system.benefits" />
				</div>

				<div class="section-heading with-action">
					<span>{{ t('Genesys.SpecializationSheet.CareerSkills', 'Specialization Career Skills') }}</span>
				</div>

				<div class="career-skill-list">
					<p class="drop-hint">{{ t('Genesys.SpecializationSheet.DropCareerSkill', 'Drag skill items onto this sheet to add them as specialization career skills.') }}</p>

					<div v-for="(skill, index) in careerSkills" :key="`career-skill-${index}`" class="career-skill-row">
						<span class="career-skill-name">{{ skill }}</span>
						<button type="button" class="remove-step" @click="removeCareerSkill(index)">
							{{ t('Genesys.SpecializationSheet.RemoveCareerSkill', 'Remove') }}
						</button>
					</div>
				</div>

				<div class="section-heading with-action">
					<span>{{ t('Genesys.SpecializationSheet.GrantedItems', 'Przyznawane przedmioty') }}</span>
				</div>

				<div class="granted-item-list">
					<p class="drop-hint">{{ t('Genesys.SpecializationSheet.DropGrantedItem', 'Przeciągnij broń, pancerz, ekwipunek, akcesorium magiczne, przedmiot zużywalny albo pojemnik na tę kartę, aby przyznać go razem ze specjalizacją.') }}</p>

					<div v-for="(item, index) in grantedItems" :key="`${item.type}-${item.name}-${index}`" class="granted-item-row">
						<img :src="item.img" :alt="item.name" />
						<span class="granted-item-name">{{ item.name }}</span>
						<em>{{ item.type }}</em>
						<button type="button" class="remove-step" @click="removeGrantedItem(index)">
							{{ t('Genesys.SpecializationSheet.RemoveGrantedItem', 'Remove') }}
						</button>
					</div>
				</div>

				<div class="section-heading">{{ t('Genesys.SpecializationSheet.MagicSection', 'Magic Unlock') }}</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.MagicEnabled', 'Unlock Magic Tab') }}</label>
					<input type="checkbox" name="system.magicAccess.enabled" :checked="system.magicAccess.enabled" />
				</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.Tradition', 'Tradition') }}</label>
					<select name="system.magicAccess.tradition" :value="system.magicAccess.tradition">
						<option value="">{{ t('Genesys.SpecializationSheet.None', 'None') }}</option>
						<option value="arcana">{{ t('Genesys.SpecializationSheet.ArcanaTradition', 'Arcana') }}</option>
						<option value="divine">{{ t('Genesys.SpecializationSheet.DivineTradition', 'Divine') }}</option>
					</select>
				</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.School', 'School / Deity') }}</label>
					<select name="system.magicAccess.school" :value="system.magicAccess.school">
						<option value="">{{ t('Genesys.SpecializationSheet.Automatic', 'Choose a profile') }}</option>
						<option v-for="option in schoolOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
					</select>
				</div>

				<div v-if="system.magicAccess.tradition === 'arcana'" class="row">
					<label>{{ t('Genesys.SpecializationSheet.LoreOverride', 'Lore Label Override') }}</label>
					<input type="text" name="system.magicAccess.lore" :value="system.magicAccess.lore" :placeholder="t('Genesys.SpecializationSheet.LorePlaceholder', 'Example: Lore of Death')" />
				</div>

				<div v-if="system.magicAccess.tradition === 'divine'" class="row">
					<label>{{ t('Genesys.SpecializationSheet.DeityOverride', 'Deity Label Override') }}</label>
					<input type="text" name="system.magicAccess.deity" :value="system.magicAccess.deity" :placeholder="t('Genesys.SpecializationSheet.DeityPlaceholder', 'Example: Sigmar')" />
				</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.AllowMiscast', 'Flag Miscast Risk') }}</label>
					<input type="checkbox" name="system.magicAccess.allowMiscast" :checked="system.magicAccess.allowMiscast" />
				</div>

				<div class="row">
					<label>{{ t('Genesys.SpecializationSheet.AllowOvercast', 'Flag Overcast Access') }}</label>
					<input type="checkbox" name="system.magicAccess.allowOvercast" :checked="system.magicAccess.allowOvercast" />
				</div>

				<div class="section-heading with-action">
					<span>{{ t('Genesys.SpecializationSheet.CareerPath', 'Profession Path') }}</span>
					<button type="button" class="section-action" @click="addProfessionStepToPath">
						{{ t('Genesys.SpecializationSheet.AddProfession', 'Add Profession') }}
					</button>
				</div>

				<div class="profession-path">
					<article v-for="(step, index) in professionPath" :key="professionKey(step, index)" class="profession-step">
						<div class="profession-step-header">
							<strong>{{ t('Genesys.SpecializationSheet.ProfessionStep', `Profession ${index + 1}`, { index: index + 1 }) }}</strong>
							<button type="button" class="remove-step" @click="removeProfessionStep(index)">
								{{ t('Genesys.SpecializationSheet.RemoveProfession', 'Remove') }}
							</button>
						</div>

						<div class="profession-step-grid">
							<label>
								<span>{{ t('Genesys.SpecializationSheet.ProfessionName', 'Profession Name') }}</span>
								<input type="text" :value="step.name" @change="updateProfessionStep(index, { name: ($event.target as HTMLInputElement).value })" />
							</label>

							<label>
								<span>{{ t('Genesys.SpecializationSheet.ProfessionTier', 'Tier') }}</span>
								<input type="number" min="1" :value="step.tier" @change="updateProfessionStep(index, { tier: Number(($event.target as HTMLInputElement).value) || 1 })" />
							</label>

							<label class="checkbox-row">
								<span>{{ t('Genesys.SpecializationSheet.ProfessionAlternative', 'Alternative Branch') }}</span>
								<input type="checkbox" :checked="step.isAlternative" @change="updateProfessionStep(index, { isAlternative: ($event.target as HTMLInputElement).checked })" />
							</label>

							<label class="full-width">
								<span>{{ t('Genesys.SpecializationSheet.ProfessionPrerequisites', 'Prerequisites') }}</span>
								<textarea rows="2" :value="step.prerequisites" @change="updateProfessionStep(index, { prerequisites: ($event.target as HTMLTextAreaElement).value })"></textarea>
							</label>

							<label class="full-width">
								<span>{{ t('Genesys.SpecializationSheet.ProfessionEffects', 'Effects') }}</span>
								<textarea rows="3" :value="step.effects" @change="updateProfessionStep(index, { effects: ($event.target as HTMLTextAreaElement).value })"></textarea>
							</label>
						</div>
					</article>

					<div v-if="professionPath.length === 0" class="profession-empty-state">
						{{ t('Genesys.SpecializationSheet.NoProfessions', 'No profession progression defined for this specialization yet.') }}
					</div>
				</div>
			</section>
		</template>
	</BasicItemSheet>
</template>

<style lang="scss" scoped>
.specialization-container {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	gap: 1rem;
	padding: 1rem;
	overflow: hidden;
}

.specialization-header {
	h3 {
		border-bottom: 1px solid #ccc;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		font-family: 'Cinzel', serif;
		color: #2a2016;
	}
}

.form-group {
	label {
		font-weight: bold;
		font-family: 'Cinzel', serif;
		margin-bottom: 0.5rem;
		display: block;
		color: #2a2016;
	}
}

.status-row {
	display: grid;
	grid-template-columns: max-content minmax(0, 1fr);
	align-items: center;
	gap: 0.75rem;
	padding: 0.65rem 0.8rem;
	border: 1px solid rgba(199, 156, 75, 0.45);
	border-radius: 0.75rem;
	background: rgba(243, 248, 252, 0.86);

	label {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1rem;
		letter-spacing: 0.05em;
		color: #27435a;
	}

	input {
		width: 100%;
		min-width: 0;
	}
}

.tree-wrapper {
	flex: 1;
	min-height: 0;
	min-height: 500px;
	border: 1px solid #7a5c3b;
	border-radius: 4px;
	overflow: hidden;
	background: rgba(42, 32, 22, 0.05);
}

.instructions {
	padding: 0.75rem;
	background: rgba(0, 0, 0, 0.05);
	border-radius: 4px;
	font-size: 0.9em;
	color: #666;

	p {
		margin: 0.25rem 0;

		i {
			margin-right: 0.5rem;
			color: #7a5c3b;
		}
	}
}

.specialization-data {
	gap: 0.4rem;
	padding: 0.75rem;
	overflow-x: hidden;

	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.6rem 0.25rem 0.3rem;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.2rem;
		letter-spacing: 0.05em;
		color: #27435a;
		border-bottom: 1px solid rgba(39, 67, 90, 0.2);

		span {
			flex: 1 1 auto;
			min-width: 0;
		}
	}

	.section-action {
		flex: 0 0 auto;
		width: auto !important;
		height: auto;
		min-height: 0;
		padding: 0.35rem 0.7rem;
		border: 1px solid rgba(39, 67, 90, 0.2);
		border-radius: 999px;
		background: rgba(39, 67, 90, 0.08) !important;
		color: #27435a;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.95rem;
		letter-spacing: 0.05em;
		line-height: 1;
	}
}

.profession-path {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	padding-top: 0.25rem;
}

.career-skill-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding-top: 0.25rem;
}

.granted-item-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding-top: 0.25rem;
}

.drop-hint {
	margin: 0;
	padding: 0.65rem 0.8rem;
	border: 1px dashed rgba(39, 67, 90, 0.28);
	border-radius: 0.75rem;
	background: rgba(39, 67, 90, 0.04);
	font-family: 'Roboto Slab', serif;
	font-size: 0.9rem;
	color: #5f7182;
}

.career-skill-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) max-content;
	align-items: center;
	gap: 0.5rem;
	padding: 0.45rem 0.6rem;
	border: 1px solid rgba(39, 67, 90, 0.12);
	border-radius: 0.65rem;
	background: rgba(255, 255, 255, 0.6);

	.career-skill-name {
		min-width: 0;
		font-family: 'Roboto Slab', serif;
		color: #27435a;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.granted-item-row {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) max-content max-content;
	align-items: center;
	gap: 0.5rem;
	padding: 0.45rem 0.6rem;
	border: 1px solid rgba(39, 67, 90, 0.12);
	border-radius: 0.65rem;
	background: rgba(255, 255, 255, 0.6);

	img {
		width: 1.7rem;
		height: 1.7rem;
		border: none;
		object-fit: cover;
	}

	.granted-item-name {
		min-width: 0;
		font-family: 'Roboto Slab', serif;
		color: #27435a;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	em {
		font-size: 0.75rem;
		color: #5f7182;
	}
}

.profession-step {
	padding: 0.85rem;
	border: 1px solid rgba(39, 67, 90, 0.15);
	border-radius: 0.9rem;
	background: rgba(39, 67, 90, 0.04);
}

.profession-step-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.75rem;
	margin-bottom: 0.75rem;

	strong {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.1rem;
		letter-spacing: 0.05em;
		color: #27435a;
	}
}

.remove-step {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 auto;
	width: auto !important;
	height: auto;
	min-height: 0;
	padding: 0.35rem 0.7rem;
	border: 1px solid rgba(120, 55, 45, 0.2);
	border-radius: 999px;
	background: rgba(165, 82, 68, 0.08) !important;
	color: #7a372d;
	font-family: 'Bebas Neue', sans-serif;
	font-size: 0.95rem;
	letter-spacing: 0.05em;
	line-height: 1;
}

.profession-step-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.75rem;

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;

		span {
			font-family: 'Bebas Neue', sans-serif;
			font-size: 0.95rem;
			letter-spacing: 0.05em;
			color: #6d6e71;
		}
	}

	input,
	textarea {
		width: 100%;
	}

	.full-width {
		grid-column: 1 / span 2;
	}

	.checkbox-row {
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		padding-top: 1.4rem;
	}
}

.profession-empty-state {
	padding: 1rem;
	border: 1px dashed rgba(39, 67, 90, 0.25);
	border-radius: 0.8rem;
	text-align: center;
	font-family: 'Roboto Slab', serif;
	color: #5f7182;
	background: rgba(39, 67, 90, 0.03);
}
</style>

