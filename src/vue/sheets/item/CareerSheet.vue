<script lang="ts" setup>
import BasicItemSheet from '@/vue/sheets/item/BasicItemSheet.vue';
import Localized from '@/vue/components/Localized.vue';
import { computed, inject, ref, watchEffect } from 'vue';
import { ItemSheetContext, RootContext } from '@/vue/SheetContext';
import CareerDataModel from '@/item/data/CareerDataModel';
import Editor from '@/vue/components/Editor.vue';

const context = inject<ItemSheetContext<CareerDataModel>>(RootContext)!;
const system = computed(() => context.data.item.systemData);

const source = ref('');
const specializationKeyPlaceholder = game.i18n.localize('Genesys.Career.SpecializationKeyPlaceholder');

watchEffect(async () => {
	source.value = await TextEditor.enrichHTML(system.value.source, { async: true });
});

const careerSkillsHeaderWords = game.i18n.localize('Genesys.Career.Skills').split(' ');

function skillName(skill: unknown) {
	if (typeof skill === 'string') {
		return skill;
	}

	if (skill && typeof skill === 'object' && 'name' in skill) {
		return String((skill as { name?: unknown }).name ?? '');
	}

	return '';
}

async function syncOwnedActorCareerSkills(skillNames: string[]) {
	const actor = (context.data.item as any).actor;
	if (!actor) {
		return;
	}

	await (actor.sheet as any)?.syncCareerSkillFlags?.(skillNames);
	actor.sheet?.render(false);
}

async function removeSkill(index: number) {
	const updatedSkills = [...system.value.careerSkills];
	const removedSkillName = skillName(updatedSkills[index]);
	updatedSkills.splice(index, 1);

	await context.data.item.update({
		'system.careerSkills': updatedSkills,
	});
	await syncOwnedActorCareerSkills([removedSkillName]);
}

async function removeGrantedItem(index: number) {
	const updatedItems = [...(system.value.grantedItems ?? [])];
	updatedItems.splice(index, 1);

	await context.data.item.update({
		'system.grantedItems': updatedItems,
	});
}

async function addSpecializationKey() {
	const updatedKeys = [...(system.value.availableSpecializationKeys ?? []), ''];
	await context.data.item.update({
		'system.availableSpecializationKeys': updatedKeys,
	});
}

async function updateSpecializationKey(index: number, value: string) {
	const updatedKeys = [...(system.value.availableSpecializationKeys ?? [])];
	updatedKeys[index] = value;
	await context.data.item.update({
		'system.availableSpecializationKeys': updatedKeys,
	});
}

async function removeSpecializationKey(index: number) {
	const updatedKeys = [...(system.value.availableSpecializationKeys ?? [])];
	updatedKeys.splice(index, 1);
	await context.data.item.update({
		'system.availableSpecializationKeys': updatedKeys,
	});
}
</script>

<template>
	<BasicItemSheet show-effects-tab>
		<template v-slot:description>
			<section class="overview">
				<section class="description">
					<Editor name="system.description" :content="system.description" button />
					<div class="source" v-html="source" />
				</section>

				<section class="stats">
					<div class="header">
						<div v-for="word in careerSkillsHeaderWords" :key="word">{{ word }}</div>
					</div>

					<ul>
						<li v-for="skill in system.careerSkills" :key="skill.name">
							<div class="career-skill">
								<img :src="skill.img" :alt="skill.name" />
								<strong>{{ skill.name }}</strong>
								<em>{{ skill.system.source }}</em>
							</div>
						</li>
					</ul>
				</section>
			</section>
		</template>

		<template v-slot:data>
			<section class="data-grid">
				<div class="row">
					<label><Localized label="Genesys.Labels.Source" /></label>
					<input type="text" name="system.source" :value="system.source" />
				</div>

				<div class="row">
					<label><Localized label="Genesys.Career.Key" /></label>
					<div class="stacked-field">
						<input type="text" name="system.key" :value="system.key" placeholder="career-key" />
						<p class="field-hint"><Localized label="Genesys.Career.KeyHint" /></p>
					</div>
				</div>

				<div class="row">
					<label><Localized label="Genesys.Career.Skills" /></label>
					<div v-for="(skill, index) in system.careerSkills" :key="skill.name" class="career-skill">
						<img :src="skill.img" :alt="skill.name" />
						<span class="name">{{ skill.name }}</span>
						<div v-if="context.data.editable">
							<a @click="removeSkill(index)"><i class="fas fa-trash"></i></a>
						</div>
					</div>
				</div>

				<div class="row">
					<label>Przyznawane przedmioty</label>
					<div class="granted-items-panel">
						<p class="field-hint">Przeciągnij broń, pancerz, ekwipunek, akcesorium magiczne, przedmiot zużywalny albo pojemnik na tę kartę, aby przyznać go razem z karierą.</p>

						<div v-if="system.grantedItems?.length" class="granted-item-list">
							<div v-for="(item, index) in system.grantedItems" :key="`${item.type}-${item.name}-${index}`" class="granted-item">
								<img :src="item.img" :alt="item.name" />
								<span class="name">{{ item.name }}</span>
								<em>{{ item.type }}</em>
								<button v-if="context.data.editable" type="button" class="btn-remove" @click="removeGrantedItem(index)">
									<i class="fas fa-trash"></i>
								</button>
							</div>
						</div>

						<div v-else class="empty-specializations">
							Ta kariera nie przyznaje jeszcze żadnych przedmiotów.
						</div>
					</div>
				</div>

				<div class="row specialization-keys-row">
					<label><Localized label="Genesys.Career.AvailableSpecializations" /></label>
					<div class="specialization-keys-panel">
						<p class="field-hint"><Localized label="Genesys.Career.AvailableSpecializationsHint" /></p>

						<div v-if="system.availableSpecializationKeys?.length" class="specialization-key-list">
							<div v-for="(key, index) in system.availableSpecializationKeys" :key="`${key}-${index}`" class="specialization-key-entry">
								<input
									type="text"
									:value="key"
									:placeholder="specializationKeyPlaceholder"
									@change="updateSpecializationKey(index, ($event.target as HTMLInputElement).value)"
								/>
								<button type="button" class="btn-remove" @click="removeSpecializationKey(index)">
									<i class="fas fa-trash"></i>
								</button>
							</div>
						</div>

						<div v-else class="empty-specializations">
							<Localized label="Genesys.Career.EmptySpecializations" />
						</div>

						<button type="button" class="btn-add" @click="addSpecializationKey">
							<Localized label="Genesys.Career.AddSpecializationKey" />
						</button>
					</div>
				</div>
			</section>
		</template>
	</BasicItemSheet>
</template>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

section.overview {
	display: flex;
	flex-direction: column;
	flex-wrap: nowrap;
	font-family: 'Roboto Slab', serif;

	.description {
		min-height: 120px;
	}

	.header {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.25em;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.75em;
		color: colors.$blue;

		& > div:first-letter {
			font-size: 1.25em;
		}
	}

	li {
		display: flex;
		align-items: center;
		position: relative;
		gap: 0.25em;
		padding-right: 0.5em;

		&:nth-of-type(2n) {
			background: transparentize(colors.$blue, 0.8);
		}

		&::before {
			display: block;
			content: '';
			position: absolute;
			$size: 4px;
			top: calc(1em - $size);
			left: -1em;
			height: $size;
			width: $size;
			background: colors.$gold;
		}
	}

	.career-skill {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		column-gap: 0.25em;
		align-items: center;
		width: 100%;

		img {
			border: none;
			height: 1.5em;
			grid-column: 1 / span 1;
		}

		strong {
			grid-column: 2 / span 1;
		}

		em {
			grid-column: 4 / span 1;
			font-size: 0.8em;
			font-family: 'Roboto', sans-serif;
		}
	}
}

.data-grid .career-skill {
	display: grid;
	grid-template-columns: auto auto 1fr auto;
	align-items: center;
	gap: 0.25em;
	padding: 0.25em;

	&:nth-of-type(2n) {
		background: transparentize(colors.$blue, 0.8);
	}

	img {
		grid-column: 1 / span 1;
		border: none;
		height: 1.5em;
	}

	& > .name {
		grid-column: 2 / span 1;
		font-family: 'Roboto Serif', serif;
	}

	& > div {
		grid-column: 4 / span 1;
	}
}

.stacked-field,
.specialization-keys-panel,
.granted-items-panel {
	display: flex;
	flex-direction: column;
	gap: 0.45em;
	width: 100%;
}

.field-hint {
	margin: 0;
	font-size: 0.82rem;
	font-family: 'Roboto', sans-serif;
	color: #5f7182;
}

.specialization-key-list {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.granted-item-list {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.granted-item {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) max-content max-content;
	align-items: center;
	gap: 0.45em;
	padding: 0.35em 0.45em;
	border-radius: 0.55em;
	background: transparentize(colors.$blue, 0.9);

	img {
		width: 1.6em;
		height: 1.6em;
		border: none;
		object-fit: cover;
	}

	.name {
		min-width: 0;
		font-family: 'Roboto Serif', serif;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	em {
		font-size: 0.75em;
		color: #5f7182;
	}
}

.specialization-key-entry {
	display: grid;
	grid-template-columns: minmax(0, 1fr) max-content;
	gap: 0.5em;
	align-items: center;

	input {
		width: 100%;
		min-width: 0;
	}
}

.btn-add,
.btn-remove {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: auto !important;
	height: auto;
	min-height: 0;
	border: none !important;
	border-radius: 0.55em;
	cursor: pointer;
	font-family: 'Bebas Neue', sans-serif;
	letter-spacing: 0.04em;
	line-height: 1;
}

.btn-add {
	align-self: flex-start;
	padding: 0.35em 0.8em;
	background: transparentize(colors.$blue, 0.8) !important;
	color: colors.$dark-blue !important;
}

.btn-remove {
	padding: 0.35em 0.55em;
	background: transparentize(colors.$red, 0.15) !important;
	color: white !important;
}

.empty-specializations {
	padding: 0.65em 0.8em;
	border: 1px dashed transparentize(colors.$blue, 0.55);
	border-radius: 0.7em;
	background: transparentize(colors.$blue, 0.92);
	font-family: 'Roboto Slab', serif;
	font-size: 0.9rem;
	color: colors.$dark-blue;
}
</style>
