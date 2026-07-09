<script lang="ts" setup>
import { computed, inject, onBeforeMount, onMounted, onBeforeUpdate, ref, toRaw, nextTick } from 'vue';
import { ActorSheetContext, RootContext } from '@/vue/SheetContext';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import CharacterMeta from '@/vue/sheets/actor/character/CharacterMeta.vue';
import CombatStat from '@/vue/components/character/CombatStat.vue';
import Localized from '@/vue/components/Localized.vue';
import EffectsView from '@/vue/views/EffectsView.vue';
import { arrayFromItems } from '@/utils/collection';

import JournalTab from '@/vue/sheets/actor/character/JournalTab.vue';
import SkillsTab from '@/vue/sheets/actor/character/SkillsTab.vue';
import TalentsTab from '@/vue/sheets/actor/character/TalentsTab.vue';
import MagicTab from '@/vue/sheets/actor/character/MagicTab.vue';
import InventoryTab from '@/vue/sheets/actor/character/InventoryTab.vue';
import CombatTab from '@/vue/sheets/actor/character/CombatTab.vue';
import SpecializationDataModel from '@/item/data/SpecializationDataModel';
import GenesysItem from '@/item/GenesysItem';
import SkillDataModel from '@/item/data/SkillDataModel';
import { findRankedMagicSkill } from '@/magic/MagicProfiles';

const context = inject<ActorSheetContext<CharacterDataModel>>(RootContext)!;
const actor = computed(() => {
	context.renderKey;
	return toRaw(context.data.actor);
});
const system = computed(() => {
	context.renderKey;
	return actor.value.systemData;
});
const specializations = computed(() => {
	context.renderKey;
	return arrayFromItems<GenesysItem<SpecializationDataModel>>(actor.value.items).filter((item) => item.type === 'specialization');
});
const skills = computed(() => {
	context.renderKey;
	return arrayFromItems<GenesysItem<SkillDataModel>>(actor.value.items).filter((item) => item.type === 'skill');
});
const hasMagicAccess = computed(() => !!findRankedMagicSkill(skills.value));

const effects = ref<any>([]);
const sheetBodyRef = ref<HTMLElement | null>(null);
const savedScrollTop = ref(0);
const isRestoringScroll = ref(false);

async function addEffect(category: string) {
	await toRaw(context.sheet.actor).createEmbeddedDocuments('ActiveEffect', [
		{
			name: context.data.actor.name,
			img: 'icons/svg/aura.svg',
			disabled: category === 'suppressed',
			duration: category === 'temporary' ? { rounds: 1 } : undefined,
		},
	]);
}

function updateEffects() {
	effects.value = [...actor.value.effects];
}

onBeforeMount(updateEffects);
onBeforeUpdate(updateEffects);

onMounted(() => {
	if (sheetBodyRef.value) {
		sheetBodyRef.value.addEventListener('scroll', () => {
			if (!isRestoringScroll.value && sheetBodyRef.value) {
				savedScrollTop.value = sheetBodyRef.value.scrollTop;
			}
		});
	}

	const rawActor = toRaw(actor.value);

	function saveScroll() {
		if (sheetBodyRef.value) {
			savedScrollTop.value = sheetBodyRef.value.scrollTop;
		}
	}

	function restoreScroll() {
		nextTick(() => {
			if (sheetBodyRef.value) {
				isRestoringScroll.value = true;
				sheetBodyRef.value.scrollTop = savedScrollTop.value;
				setTimeout(() => {
					isRestoringScroll.value = false;
				}, 100);
			}
		});
	}

	const originalUpdate = rawActor.update.bind(rawActor);
	rawActor.update = async function (data: any, ctx?: any) {
		saveScroll();
		const result = await originalUpdate(data, ctx);
		restoreScroll();
		return result;
	};

	const originalCreate = rawActor.createEmbeddedDocuments.bind(rawActor);
	rawActor.createEmbeddedDocuments = async function (type: string, data: any[], ctx?: any) {
		saveScroll();
		const result = await originalCreate(type, data, ctx);
		restoreScroll();
		return result;
	};

	const originalDelete = (rawActor as any).deleteEmbeddedDocuments.bind(rawActor);
	(rawActor as any).deleteEmbeddedDocuments = async function (embeddedName: string, ids: string[], ctx?: any) {
		saveScroll();
		const result = await originalDelete(embeddedName, ids, ctx);
		restoreScroll();
		return result;
	};

	const originalUpdateEmb = rawActor.updateEmbeddedDocuments.bind(rawActor);
	rawActor.updateEmbeddedDocuments = async function (type: string, data: any[], ctx?: any) {
		saveScroll();
		const result = await originalUpdateEmb(type, data, ctx);
		restoreScroll();
		return result;
	};
});
</script>

<template>
	<div class="character-sheet">
		<CharacterMeta :show-specialization-fields="false" />

		<section class="combat-stat-row">
			<CombatStat label="Genesys.Labels.SoakValue" :value="system.totalSoak" />

			<CombatStat
				label="Genesys.Labels.Wounds"
				primary-label="Genesys.Labels.Threshold"
				:value="system.wounds.max"
				has-secondary
				secondary-label="Genesys.Labels.Current"
				secondary-name="system.wounds.value"
				:secondary-value="system.wounds.value"
			/>

			<CombatStat
				label="Genesys.Labels.Strain"
				primary-label="Genesys.Labels.Threshold"
				:value="system.strain.max"
				has-secondary
				secondary-label="Genesys.Labels.Current"
				secondary-name="system.strain.value"
				:secondary-value="system.strain.value"
			/>

			<CombatStat
				label="Genesys.Labels.Defense"
				primary-label="Genesys.Labels.DefenseRanged"
				:value="system.totalDefense.ranged"
				has-secondary
				secondary-label="Genesys.Labels.DefenseMelee"
				:secondary-value="system.totalDefense.melee"
				read-only
			/>
		</section>

		<nav class="sheet-tabs" data-group="primary">
			<div class="spacer"></div>

			<a class="item" data-tab="skills"><Localized label="Genesys.Tabs.Skills" /></a>
			<a class="item" data-tab="combat"><Localized label="Genesys.Tabs.Combat" /></a>
			<a class="item" data-tab="talents"><Localized label="Genesys.Tabs.Talents" /></a>
			<a v-if="hasMagicAccess" class="item" data-tab="magic"><Localized label="Genesys.Tabs.Magic" /></a>
			<a class="item" data-tab="inventory"><Localized label="Genesys.Tabs.Inventory" /></a>
			<a class="item" data-tab="effects"><Localized label="Genesys.Tabs.Effects" /></a>
			<a class="item" data-tab="journal"><Localized label="Genesys.Tabs.Journal" /></a>

			<div class="spacer"></div>
		</nav>

		<section ref="sheetBodyRef" class="sheet-body">
			<div class="tab" data-tab="skills"><SkillsTab /></div>

			<div class="tab" data-tab="combat"><CombatTab /></div>

			<div class="tab" data-tab="talents"><TalentsTab /></div>

			<div v-if="hasMagicAccess" class="tab" data-tab="magic"><MagicTab profile-source="skill" /></div>

			<div class="tab" data-tab="inventory"><InventoryTab currency-mode="legacy" :currency-label="context.currencyLabel" /></div>

			<div class="tab" data-tab="effects">
				<EffectsView :effects="[...effects]" @add-effect="addEffect" />
			</div>

			<div class="tab" data-tab="journal">
				<JournalTab />
			</div>
		</section>
	</div>
</template>

<style lang="scss" scoped>
.character-sheet {
	width: 100%;
	height: 100%;

	display: grid;
	grid-template-rows: repeat(3, auto) 1fr;
	gap: 0.5em;
}

.combat-stat-row {
	display: flex;
	gap: 1em;
	align-items: center;
	justify-content: space-around;

	@container sheet (min-width: 700px) {
		display: flex;
		justify-content: center;

		.combat-stat {
			width: 165px;
		}
	}
}
</style>
