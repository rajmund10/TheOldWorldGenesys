<script lang="ts" setup>
import BasicItemSheet from '@/vue/sheets/item/BasicItemSheet.vue';
import Localized from '@/vue/components/Localized.vue';
import { computed, inject } from 'vue';
import { ItemSheetContext, RootContext } from '@/vue/SheetContext';
import ProfessionDataModel from '@/item/data/ProfessionDataModel';
import Editor from '@/vue/components/Editor.vue';

const context = inject<ItemSheetContext<ProfessionDataModel>>(RootContext)!;
const system = computed(() => context.data.item.systemData);

async function addCareerSkill() {
	const updatedSkills = [...system.value.careerSkills, ''];
	await context.data.item.update({
		'system.careerSkills': updatedSkills,
	});
}

async function updateCareerSkill(index: number, value: string) {
	const updatedSkills = [...system.value.careerSkills];
	updatedSkills[index] = value;
	await context.data.item.update({
		'system.careerSkills': updatedSkills,
	});
}

async function removeCareerSkill(index: number) {
	const updatedSkills = [...system.value.careerSkills];
	updatedSkills.splice(index, 1);
	await context.data.item.update({
		'system.careerSkills': updatedSkills,
	});
}
</script>

<template>
	<BasicItemSheet show-effects-tab>
		<template v-slot:description>
			<section class="overview">
				<section class="description">
					<Editor name="system.description" :content="system.description" button />
				</section>

				<section class="stats">
					<div class="header">
						<h3>Career Skills</h3>
						<button class="btn-add" @click="addCareerSkill">Add Skill</button>
					</div>

					<ul v-if="system.careerSkills.length > 0">
						<li v-for="(skill, index) in system.careerSkills" :key="index">
							<div class="skill-entry">
								<input
									type="text"
									:value="skill"
									@input="updateCareerSkill(index, ($event.target as HTMLInputElement).value)"
									placeholder="Skill name (e.g., Athletics)"
								/>
								<button class="btn-remove" @click="removeCareerSkill(index)">×</button>
							</div>
						</li>
					</ul>
					<p v-else class="empty">No career skills defined.</p>
				</section>

			</section>
		</template>
	</BasicItemSheet>
</template>

<style lang="scss" scoped>
.overview {
	display: flex;
	flex-direction: column;
	gap: 1.5em;

	.description {
		flex: 1;
	}

	.stats {
		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 0.5em;

			h3 {
				margin: 0;
				font-size: 1.1em;
			}

			.btn-add {
				padding: 0.25em 0.75em;
				background: #4caf50;
				color: white;
				border: none;
				border-radius: 3px;
				cursor: pointer;
				font-size: 0.8em;

				&:hover {
					background: #45a049;
				}
			}
		}

		.description {
			font-size: 0.9em;
			color: #666;
			margin-bottom: 0.5em;
		}

		ul {
			list-style: none;
			padding: 0;
			margin: 0;

			li {
				margin-bottom: 0.5em;
			}
		}

		.skill-entry, .spec-entry {
			display: flex;
			gap: 0.5em;
			align-items: center;

			input {
				flex: 1;
				padding: 0.5em;
				border: 1px solid #ccc;
				border-radius: 3px;
				font-size: 0.9em;
			}

			.btn-remove {
				padding: 0.25em 0.5em;
				background: #f44336;
				color: white;
				border: none;
				border-radius: 3px;
				cursor: pointer;
				font-size: 0.8em;

				&:hover {
					background: #d32f2f;
				}
			}
		}

		.empty {
			color: #777;
			font-style: italic;
			text-align: center;
			padding: 1em;
			background: #f9f9f9;
			border-radius: 4px;
		}
	}
}
</style>