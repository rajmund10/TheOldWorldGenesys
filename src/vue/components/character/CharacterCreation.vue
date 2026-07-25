<script lang="ts" setup>
import { computed, inject, ref } from 'vue';
import { ActorSheetContext, RootContext } from '@/vue/SheetContext';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import { specializationMatchesArchetype, specializationMatchesCareer, type CharacterCreationOption } from '@/actor/creation/CharacterCreationCatalog';
import { isCareerAllowedForArchetype, isSkillAllowedForArchetype } from '@/actor/abilities/RacialAbilities';

const context = inject<ActorSheetContext<CharacterDataModel>>(RootContext)!;
const mode = ref<'welcome' | 'creator'>('welcome');
const selectedArchetypeId = ref('');
const selectedCareerId = ref('');
const selectedSpecializationId = ref('');
const selectedCareerSkills = ref<string[]>([]);
const isCreating = ref(false);

const catalog = computed(() => context.characterCreationCatalog);
const selectedCareer = computed(() => catalog.value?.careers.find((career) => career.id === selectedCareerId.value));
const selectedArchetype = computed(() => catalog.value?.archetypes.find((archetype) => archetype.id === selectedArchetypeId.value));
const selectedSpecialization = computed(() => catalog.value?.specializations.find((specialization) => specialization.id === selectedSpecializationId.value));
const availableCareers = computed(() =>
	(catalog.value?.careers ?? []).filter((career) => isCareerAllowedForArchetype(selectedArchetype.value?.key ?? '', career.key)),
);
const availableCareerSkills = computed(() => {
	const skills = [...(selectedCareer.value?.careerSkills ?? []), ...(selectedSpecialization.value?.careerSkills ?? [])];
	const seen = new Set<string>();
	return skills.filter((skill) => {
		const normalizedName = skill.trim().toLocaleLowerCase();
		if (!normalizedName || seen.has(normalizedName) || !isSkillAllowedForArchetype(selectedArchetype.value?.key ?? '', skill)) return false;
		seen.add(normalizedName);
		return true;
	}).sort((left, right) => left.localeCompare(right, 'pl', { sensitivity: 'base' }));
});
const requiredCareerSkills = computed(() => Math.min(CONFIG.genesys.settings.freeCareerSkillRanks, availableCareerSkills.value.length));
const availableSpecializations = computed(() => {
	const career = selectedCareer.value;
	const archetype = selectedArchetype.value;
	if (!career || !archetype || !catalog.value) return [];
	return catalog.value.specializations.filter((specialization) =>
		(!career.availableSpecializationKeys.length || specializationMatchesCareer(specialization.key, career.availableSpecializationKeys))
		&& specializationMatchesArchetype(specialization, archetype),
	);
});
const hasCompleteCatalog = computed(() => !!catalog.value?.archetypes.length && !!catalog.value?.careers.length && !!catalog.value?.specializations.length);
const canCreate = computed(() =>
	!!selectedArchetypeId.value
	&& !!selectedCareerId.value
	&& availableCareers.value.some((career) => career.id === selectedCareerId.value)
	&& !!selectedSpecializationId.value
	&& selectedCareerSkills.value.length === requiredCareerSkills.value,
);

function t(key: string, data?: Record<string, string | number>) {
	return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

function chooseCareer(career: CharacterCreationOption) {
	selectedCareerId.value = career.id;
	selectedSpecializationId.value = '';
	selectedCareerSkills.value = [];
}

function chooseArchetype(archetype: CharacterCreationOption) {
	selectedArchetypeId.value = archetype.id;
	if (selectedCareer.value && !isCareerAllowedForArchetype(archetype.key, selectedCareer.value.key)) {
		selectedCareerId.value = '';
	}
	selectedSpecializationId.value = '';
	selectedCareerSkills.value = [];
}

function chooseSpecialization(specialization: CharacterCreationOption) {
	selectedSpecializationId.value = specialization.id;
	selectedCareerSkills.value = [];
}

function toggleCareerSkill(skillName: string) {
	const selected = new Set(selectedCareerSkills.value);
	if (selected.has(skillName)) {
		selected.delete(skillName);
	} else if (selected.size < requiredCareerSkills.value) {
		selected.add(skillName);
	}
	selectedCareerSkills.value = [...selected];
}

async function useBlankSheet() {
	await context.useBlankCharacterSheet?.();
}

async function createCharacter() {
	if (!canCreate.value || isCreating.value) return;
	isCreating.value = true;
	const completed = await context.completeCharacterCreation?.({
		archetypeId: selectedArchetypeId.value,
		careerId: selectedCareerId.value,
		specializationId: selectedSpecializationId.value,
		careerSkillNames: selectedCareerSkills.value,
	});
	if (!completed) isCreating.value = false;
}
</script>

<template>
	<section class="character-creation">
		<template v-if="mode === 'welcome'">
			<header>
				<h2>{{ t('Genesys.CharacterCreation.WelcomeTitle') }}</h2>
				<p>{{ t('Genesys.CharacterCreation.WelcomeHint') }}</p>
			</header>

			<div class="start-actions">
				<button type="button" class="start-action primary" @click="mode = 'creator'">
					<i class="fas fa-wand-magic-sparkles"></i>
					<span>{{ t('Genesys.CharacterCreation.UseCreator') }}</span>
				</button>
				<button type="button" class="start-action" @click="useBlankSheet">
					<i class="fas fa-file"></i>
					<span>{{ t('Genesys.CharacterCreation.UseBlankSheet') }}</span>
				</button>
			</div>
		</template>

		<template v-else>
			<header class="creator-header">
				<button type="button" class="icon-button" :title="t('Genesys.CharacterCreation.Back')" @click="mode = 'welcome'">
					<i class="fas fa-arrow-left"></i>
				</button>
				<h2>{{ t('Genesys.CharacterCreation.CreatorTitle') }}</h2>
			</header>

			<p v-if="!hasCompleteCatalog" class="empty-catalog">
				<i class="fas fa-triangle-exclamation"></i>
				{{ catalog ? t('Genesys.CharacterCreation.NoOptions') : t('Genesys.CharacterCreation.LoadError') }}
			</p>

			<div v-else class="creator-content">
				<section class="choice-section">
					<h3>{{ t('Genesys.CharacterCreation.Archetype') }}</h3>
					<div class="choice-grid">
						<button
							v-for="option in catalog!.archetypes"
							:key="option.id"
							type="button"
							:class="['choice-card', { selected: selectedArchetypeId === option.id }]"
							@click="chooseArchetype(option)"
						>
							<img :src="option.img" :alt="option.name" />
							<span>{{ option.name }}</span>
							<i v-if="selectedArchetypeId === option.id" class="fas fa-check"></i>
						</button>
					</div>
				</section>

				<section class="choice-section">
					<h3>{{ t('Genesys.CharacterCreation.Career') }}</h3>
					<div class="choice-grid">
						<button
							v-for="option in availableCareers"
							:key="option.id"
							type="button"
							:class="['choice-card', { selected: selectedCareerId === option.id }]"
							@click="chooseCareer(option)"
						>
							<img :src="option.img" :alt="option.name" />
							<span>{{ option.name }}</span>
							<i v-if="selectedCareerId === option.id" class="fas fa-check"></i>
						</button>
					</div>
				</section>

				<section v-if="selectedCareer" class="choice-section">
					<h3>{{ t('Genesys.CharacterCreation.Specialization') }}</h3>
					<div class="choice-grid">
						<button
							v-for="option in availableSpecializations"
							:key="option.id"
							type="button"
							:class="['choice-card', { selected: selectedSpecializationId === option.id }]"
							@click="chooseSpecialization(option)"
						>
							<img :src="option.img" :alt="option.name" />
							<span>{{ option.name }}</span>
							<i v-if="selectedSpecializationId === option.id" class="fas fa-check"></i>
						</button>
					</div>
				</section>

				<section v-if="selectedCareer" class="choice-section">
					<h3>{{ t('Genesys.CharacterCreation.CareerSkills') }}</h3>
					<p>{{ t('Genesys.CharacterCreation.CareerSkillsHint', { count: requiredCareerSkills }) }}</p>
					<div class="skill-grid">
						<label v-for="skill in availableCareerSkills" :key="skill" :class="{ selected: selectedCareerSkills.includes(skill) }">
							<input
								type="checkbox"
								:checked="selectedCareerSkills.includes(skill)"
								:disabled="!selectedCareerSkills.includes(skill) && selectedCareerSkills.length >= requiredCareerSkills"
								@change="toggleCareerSkill(skill)"
							/>
							<span>{{ skill }}</span>
						</label>
					</div>
				</section>
			</div>

			<footer>
				<button type="button" class="create-button" :disabled="!canCreate || isCreating" @click="createCharacter">
					<i :class="isCreating ? 'fas fa-spinner fa-spin' : 'fas fa-check'"></i>
					{{ isCreating ? t('Genesys.CharacterCreation.Creating') : t('Genesys.CharacterCreation.Create') }}
				</button>
			</footer>
		</template>
	</section>
</template>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

.character-creation {
	display: flex;
	height: 100%;
	min-height: 0;
	flex-direction: column;
	gap: 14px;
	padding: 18px;
	overflow: hidden;
	font-family: 'Roboto Serif', serif;

	header {
		text-align: center;

		h2 {
			margin: 0;
			color: colors.$dark-blue;
			font-family: 'Bebas Neue', sans-serif;
			font-size: 2em;
		}

		p {
			margin: 6px auto 0;
			max-width: 560px;
			color: #4b5661;
		}
	}
}

.start-actions {
	display: grid;
	width: min(620px, 100%);
	margin: auto;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 14px;
}

.start-action {
	display: grid;
	min-height: 150px;
	place-items: center;
	align-content: center;
	gap: 12px;
	border: 1px solid rgba(43, 75, 115, 0.45);
	border-radius: 6px;
	background: rgba(255, 255, 255, 0.72);
	color: colors.$dark-blue;
	cursor: pointer;

	i { font-size: 2em; }
	span { font-weight: 700; }

	&.primary,
	&:hover {
		border-color: colors.$gold;
		box-shadow: inset 0 0 0 2px rgba(239, 175, 97, 0.45);
	}
}

.creator-header {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}

.icon-button {
	position: absolute;
	left: 0;
	width: 34px;
	height: 34px;
	border: 0;
	background: transparent;
	color: colors.$dark-blue;
	cursor: pointer;
}

.creator-content {
	display: flex;
	min-height: 0;
	flex: 1;
	flex-direction: column;
	gap: 16px;
	overflow-y: auto;
	padding-right: 5px;
}

.choice-section {
	h3 {
		margin: 0 0 6px;
		border-bottom: 1px solid rgba(43, 75, 115, 0.3);
		color: colors.$dark-blue;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.35em;
	}

	p { margin: 0 0 8px; color: #4b5661; }
}

.choice-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	grid-auto-rows: 60px;
	gap: 7px;
}

.choice-card {
	position: relative;
	display: grid;
	height: 60px;
	min-height: 60px;
	grid-template-columns: 28px minmax(0, 1fr);
	align-items: center;
	gap: 7px;
	padding: 7px 30px 7px 8px;
	border: 1px solid rgba(43, 75, 115, 0.3);
	border-radius: 4px;
	background: rgba(255, 255, 255, 0.7);
	color: #242b33;
	text-align: left;
	cursor: pointer;

	img { width: 28px; height: 28px; border: 0; object-fit: cover; }
	span {
		display: -webkit-box;
		overflow: hidden;
		font-weight: 700;
		line-height: 1.25;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}
	i {
		position: absolute;
		right: 9px;
		color: colors.$gold;
	}

	&.selected {
		border-color: colors.$gold;
		box-shadow: inset 0 0 0 1px colors.$gold;
	}
}

.skill-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	gap: 5px;

	label {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border: 1px solid rgba(43, 75, 115, 0.25);
		background: rgba(255, 255, 255, 0.55);

		&.selected { border-color: colors.$gold; }
		input { margin: 0; }
	}
}

.empty-catalog {
	margin: auto;
	color: #7b3b27;
	font-weight: 700;
}

footer {
	display: flex;
	justify-content: flex-end;
	padding-top: 10px;
	border-top: 1px solid rgba(43, 75, 115, 0.25);
}

.create-button {
	display: inline-flex;
	min-width: 190px;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 9px 14px;
	border: 0;
	border-radius: 4px;
	background: colors.$gold;
	color: #202833;
	font-weight: 700;
	cursor: pointer;

	&:disabled { cursor: not-allowed; opacity: 0.5; }
}

@media (max-width: 620px) {
	.start-actions { grid-template-columns: 1fr; }
	.start-action { min-height: 100px; }
}
</style>
