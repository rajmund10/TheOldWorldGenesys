<script lang="ts" setup>
/**
 * TODO: Just redo this whole mess. The entire reason I wanted to move away from HBS in the first place is that it was getting kinda nasty.
 */

import { computed, inject, toRaw } from 'vue';

import CharacterDataModel from '@/actor/data/CharacterDataModel';
import { ActorSheetContext, RootContext } from '@/vue/SheetContext';
import Characteristic from '@/vue/components/character/Characteristic.vue';
import SkillDataModel from '@/item/data/SkillDataModel';
import Localized from '@/vue/components/Localized.vue';
import GenesysItem from '@/item/GenesysItem';
import SkillRanks from '@/vue/components/character/SkillRanks.vue';
import XPContainer from '@/vue/components/character/XPContainer.vue';
import DicePrompt from '@/app/DicePrompt';
import ContextMenu from '@/vue/components/ContextMenu.vue';
import MenuItem from '@/vue/components/MenuItem.vue';
import MasonryWall from '@yeger/vue-masonry-wall';
import { Characteristic as CharacteristicType } from '@/data/Characteristics';
import type CharacterSheet from '@/actor/sheets/CharacterSheet';
import { replaceDefaultSkillsForActor } from '@/actor/skills/DefaultSkills';
import { purchaseAdvance } from '@/actor/advancement/AdvancementPurchase';

const context = inject<ActorSheetContext<CharacterDataModel, CharacterSheet>>(RootContext)!;
const system = computed(() => context.data.actor.systemData);

const SKILL_CATEGORY_SORT_ORDER = {
	general: 0,
	magic: 1,
	combat: 2,
	social: 3,
	knowledge: 4,
};

const skills = computed(() => {
	const items = toRaw(context.data.actor).items;
	const skillItems = Array.from(items).filter((i) => i.type === 'skill') as GenesysItem<SkillDataModel>[];
	return skillItems;
});

const skillCategories = computed(() => {
	const categories = Array.from(new Set(skills.value.map((s) => s.systemData.category).sort((left, right) => SKILL_CATEGORY_SORT_ORDER[left] - SKILL_CATEGORY_SORT_ORDER[right])));
	return categories;
});

const hasSkills = computed(() => skills.value.length > 0);

async function addDefaultSkills() {
	const actor = toRaw(context.data.actor);
	
	try {
		const addedCount = await replaceDefaultSkillsForActor(actor, context.sheet.defaultSkillNames);
		await actor.setFlag('genesys', 'skillProfileId', context.sheet.defaultSkillProfileId);
		if (addedCount === 0) {
			ui.notifications.warn('Nie znaleziono umiejętności do zaimportowania dla tej karty.');
		}
	} catch (error) {
		ui.notifications.error('Nie udało się dodać umiejętności.');
	}
}

const canMarkSuper = computed(() => system.value.availableStartingXP > 0);

const markCareerLabel = game.i18n.localize('Genesys.Labels.MarkCareerSkill');
const unmarkCareerLabel = game.i18n.localize('Genesys.Labels.UnmarkCareerSkill');
const freeRankUpLabel = game.i18n.localize('Genesys.Labels.FreeRankUp');
const freeRankDownLabel = game.i18n.localize('Genesys.Labels.FreeRankDown');
const editLabel = game.i18n.localize('Genesys.Labels.Edit');
const deleteLabel = game.i18n.localize('Genesys.Labels.Delete');

async function rollSkill(skill: GenesysItem<SkillDataModel>) {
	await DicePrompt.promptForRoll(toRaw(context.data.actor), skill.name);
}

async function rollUnskilled(characteristic: CharacteristicType) {
	await DicePrompt.promptForRoll(toRaw(context.data.actor), '', { rollUnskilled: characteristic });
}

async function purchaseCharacteristic(characteristic: keyof typeof system.value.characteristics) {
	await purchaseAdvance(toRaw(context.data.actor), {
		type: 'characteristic',
		characteristic: characteristic as CharacteristicType,
	});
}

async function purchaseSkillRank(skill: GenesysItem<SkillDataModel>) {
	await purchaseAdvance(toRaw(context.data.actor), {
		type: 'skill-rank',
		skill: toRaw(skill),
	});
}

async function toggleCareerSkill(skill: GenesysItem<SkillDataModel>) {
	await toRaw(skill).update({
		'system.career': !skill.systemData.career,
	});
}

async function freeSkillRank(skill: GenesysItem<SkillDataModel>, adjustment: number) {
	await toRaw(skill).update({
		'system.rank': Math.max(0, skill.systemData.rank + adjustment),
	});
}

async function toggleSuper(characteristic: CharacteristicType) {
	const superCharacteristics = new Set(system.value.superCharacteristics);
	if (superCharacteristics.has(characteristic)) {
		superCharacteristics.delete(characteristic);
	} else {
		superCharacteristics.add(characteristic);
	}

	await toRaw(context.data.actor).update({
		'system.superCharacteristics': Array.from(superCharacteristics),
	});
}

async function editSkill(skill: GenesysItem<SkillDataModel>) {
	await toRaw(skill).sheet?.render(true);
}
async function deleteSkill(skill: GenesysItem<SkillDataModel>) {
	await toRaw(skill).delete();
}
</script>

<template>
	<section class="tab-skills">
		<div class="characteristics-row">
			<Characteristic
				label="Genesys.Characteristics.Brawn"
				:value="system.characteristics.brawn"
				:can-upgrade="system.canPurchaseCharacteristicAdvance.brawn"
				@upgrade="purchaseCharacteristic('brawn')"
				can-roll-unskilled
				@rollUnskilled="rollUnskilled(CharacteristicType.Brawn)"
				:is-super="system.superCharacteristics.has(CharacteristicType.Brawn)"
				:can-mark-super="canMarkSuper"
				@toggle-super="toggleSuper(CharacteristicType.Brawn)"
			/>

			<Characteristic
				label="Genesys.Characteristics.Agility"
				:value="system.characteristics.agility"
				:can-upgrade="system.canPurchaseCharacteristicAdvance.agility"
				@upgrade="purchaseCharacteristic('agility')"
				can-roll-unskilled
				@rollUnskilled="rollUnskilled(CharacteristicType.Agility)"
				:is-super="system.superCharacteristics.has(CharacteristicType.Agility)"
				:can-mark-super="canMarkSuper"
				@toggle-super="toggleSuper(CharacteristicType.Agility)"
			/>

			<Characteristic
				label="Genesys.Characteristics.Intellect"
				:value="system.characteristics.intellect"
				:can-upgrade="system.canPurchaseCharacteristicAdvance.intellect"
				@upgrade="purchaseCharacteristic('intellect')"
				can-roll-unskilled
				@rollUnskilled="rollUnskilled(CharacteristicType.Intellect)"
				:is-super="system.superCharacteristics.has(CharacteristicType.Intellect)"
				:can-mark-super="canMarkSuper"
				@toggle-super="toggleSuper(CharacteristicType.Intellect)"
			/>

			<Characteristic
				label="Genesys.Characteristics.Cunning"
				:value="system.characteristics.cunning"
				:can-upgrade="system.canPurchaseCharacteristicAdvance.cunning"
				@upgrade="purchaseCharacteristic('cunning')"
				can-roll-unskilled
				@rollUnskilled="rollUnskilled(CharacteristicType.Cunning)"
				:is-super="system.superCharacteristics.has(CharacteristicType.Cunning)"
				:can-mark-super="canMarkSuper"
				@toggle-super="toggleSuper(CharacteristicType.Cunning)"
			/>

			<Characteristic
				label="Genesys.Characteristics.Willpower"
				:value="system.characteristics.willpower"
				:can-upgrade="system.canPurchaseCharacteristicAdvance.willpower"
				@upgrade="purchaseCharacteristic('willpower')"
				can-roll-unskilled
				@rollUnskilled="rollUnskilled(CharacteristicType.Willpower)"
				:is-super="system.superCharacteristics.has(CharacteristicType.Willpower)"
				:can-mark-super="canMarkSuper"
				@toggle-super="toggleSuper(CharacteristicType.Willpower)"
			/>

			<Characteristic
				label="Genesys.Characteristics.Presence"
				:value="system.characteristics.presence"
				:can-upgrade="system.canPurchaseCharacteristicAdvance.presence"
				@upgrade="purchaseCharacteristic('presence')"
				can-roll-unskilled
				@rollUnskilled="rollUnskilled(CharacteristicType.Presence)"
				:is-super="system.superCharacteristics.has(CharacteristicType.Presence)"
				:can-mark-super="canMarkSuper"
				@toggle-super="toggleSuper(CharacteristicType.Presence)"
			/>
		</div>
		
		<!-- Warning when no skills are present -->
		<div v-if="!hasSkills" class="no-skills-warning">
			<i class="fas fa-exclamation-triangle"></i>
			<span>Nie znaleziono umiejętności. Kliknij przycisk poniżej, aby dodać domyślne umiejętności tej karty.</span>
			<button @click="addDefaultSkills" class="add-skills-btn">
				<i class="fas fa-plus"></i> Dodaj domyślne umiejętności
			</button>
		</div>

		<div class="skills-row" v-if="hasSkills">
			<MasonryWall :column-width="300" :items="skillCategories" :gap="8">
				<template #default="{ item: skillCategory, index }">
					<div class="skill-category" :style="`position: relative; z-index: ${skillCategories.length - index}`">
						<div class="header">
							<label><Localized :label="`Genesys.Labels.${skillCategory.capitalize()}Skills`" /></label>
							<div class="blank" />

							<label style="position: relative; left: -3px"><Localized label="Genesys.Labels.Rank" /></label>
							<div class="blank" />
						</div>

						<div class="body">
							<ContextMenu
								v-for="skill in skills.filter((s) => s.systemData.category === skillCategory).sort((l: GenesysItem, r: GenesysItem) => (l.name < r.name ? -1 : l.name > r.name ? 1 : 0))"
								:key="skill.id"
								class="skill row"
							>
								<template v-slot:menu-items>
									<MenuItem @click="toggleCareerSkill(skill)" v-if="context.data.editable">
										<template v-slot:icon><i :class="`${skill.systemData.career ? 'fas' : 'far'} fa-star`"></i></template>
										{{ skill.systemData.career ? unmarkCareerLabel : markCareerLabel }}
									</MenuItem>

									<MenuItem @click="freeSkillRank(skill, 1)" v-if="context.data.editable">
										<template v-slot:icon><i class="fas fa-circle-up"></i></template>
										{{ freeRankUpLabel }}
									</MenuItem>

									<MenuItem @click="freeSkillRank(skill, -1)" v-if="context.data.editable">
										<template v-slot:icon><i class="fas fa-circle-down"></i></template>
										{{ freeRankDownLabel }}
									</MenuItem>

									<MenuItem @click="editSkill(skill)">
										<template v-slot:icon><i class="fas fa-edit"></i></template>
										{{ editLabel }}
									</MenuItem>

									<MenuItem @click="deleteSkill(skill)" v-if="context.data.editable">
										<template v-slot:icon><i class="fas fa-trash"></i></template>
										{{ deleteLabel }}
									</MenuItem>
								</template>

								<img :src="skill.img" :alt="skill.name" />
								<a class="name" @click="rollSkill(skill)">
									<span>{{ skill.name }} (<Localized :label="`Genesys.CharacteristicAbbr.${skill.system.characteristic.capitalize()}`" />)</span>
									<i v-if="skill.system.career" class="fas fa-star"></i>
								</a>

								<span class="rank-display">
									{{ skill.system.rank }}

									<a
										v-if="
											skill.systemData.rank < 5 &&
											((skill.systemData.career && system.availableXP >= 5 * (skill.systemData.rank + 1)) || (!skill.systemData.career && system.availableXP >= 5 * (skill.systemData.rank + 1) + 5))
										"
										@click="purchaseSkillRank(skill)"
									>
										<i class="fas fa-arrow-circle-up" />
									</a>
								</span>

								<SkillRanks :skill-value="skill.systemData.rank" :characteristic-value="system.characteristics[skill.systemData.characteristic]" />
							</ContextMenu>
						</div>
					</div>
				</template>
			</MasonryWall>
		</div>

		<section class="experience">
			<XPContainer label="Genesys.Labels.TotalXP" :value="system.totalXP" />
			<XPContainer label="Genesys.Labels.AvailableXP" :value="system.availableXP" />
		</section>
	</section>
</template>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

.tab-skills {
	display: grid;
	grid-template-rows: /* Characteristics */ auto /* Skills */ auto /* Experience */ auto /* Filler */ 1fr;
	grid-template-columns: 1fr auto 1fr;
	gap: 0.5em;

	.experience {
		grid-column: 1 / span all;
		padding: 0.5em;
		display: grid;
		grid-template-columns: auto 1fr auto;
		width: 100%;
	}

	.skills-row {
		grid-column: 1 / span all;
	}
}

.characteristics-row {
	position: relative;
	display: flex;
	justify-content: center;
	gap: 3em;
	align-items: center;
	padding-bottom: 0.25rem;
	grid-column: 2 / span 1;

	&::after {
		display: block;
		content: '';
		position: absolute;
		top: 0;
		left: -1.5rem;
		width: calc(100% + 3rem);
		height: 100%;
		background: colors.$gold;
		border-radius: 4rem;

		clip-path: polygon(0% 50%, 100% 50%, 100% 100%, 0% 100%);
	}

	.characteristic-field {
		z-index: 2;
	}
}

.skills-row {
	position: relative;
	z-index: 1;
	width: 100%;
	padding-left: 0.5em;
	padding-right: 0.5em;

	.skill-category {
		container: skill-category / inline-size;
		width: 100%;
		break-inside: avoid-column;
		white-space: nowrap;
		background: transparentize(colors.$light-blue, 0.8);
		padding: 8px;
	}

	.header,
	.body .row {
		width: 100%;
		display: grid;
		grid-template-columns: /* image */ 1.5rem /* name */ 1fr /* Rank Input */ auto /* Dice Preview */ 80px;
		align-items: center;
		gap: 0.25rem;
	}

	.header {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1em;
		color: #6d6e71;
	}

	.body {
		border: 1px solid black;

		&:empty {
			border-style: dashed;
			opacity: 0.25;
			height: 1em;
		}
	}

	.row {
		border-bottom: 1px dashed black;

		& > * {
			padding: 0.2em;
		}

		img {
			border: none;
			padding: 0;
			margin-left: 0.1em;
		}

		.name {
			text-overflow: ellipsis;
			overflow: hidden;

			span {
				font-family: 'Roboto Slab', serif;
			}

			i {
				position: relative;
				top: -2px;
				left: 3px;
			}
		}

		&:last-of-type {
			border-bottom: none;
		}

		.rank-display {
			background: transparentize(white, 0.5);
			border: 1px dashed black;
			border-radius: 0.75rem;
			text-align: center;
			margin: 0.1em 0.1em 0.1em 0.2em;
			min-width: 1.5rem;
			height: 1.5rem;
		}
	}
}

.no-skills-warning {
	grid-column: 1 / span all;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1em;
	padding: 2em;
	background: rgba(255, 193, 7, 0.2);
	border: 2px dashed #ffc107;
	border-radius: 8px;
	margin: 1em 0;
	
	i {
		font-size: 2em;
		color: #ffc107;
	}
	
	span {
		font-size: 1.1em;
		color: #856404;
		text-align: center;
	}
	
	.add-skills-btn {
		padding: 0.5em 1.5em;
		background: #2a2016;
		color: #f8b700;
		border: 1px solid #5c452d;
		border-radius: 4px;
		cursor: pointer;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.2em;
		
		&:hover {
			background: #3a3026;
		}
		
		i {
			font-size: 1em;
			color: inherit;
			margin-right: 0.5em;
		}
	}
}
</style>
