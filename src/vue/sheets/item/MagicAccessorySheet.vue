<script lang="ts" setup>
import { computed, inject } from 'vue';

import { ItemSheetContext, RootContext } from '@/vue/SheetContext';
import BasicItemSheet from '@/vue/sheets/item/BasicItemSheet.vue';
import Localized from '@/vue/components/Localized.vue';
import MoneyFields from '@/vue/components/MoneyFields.vue';
import MagicAccessoryDataModel from '@/item/data/MagicAccessoryDataModel';

const context = inject<ItemSheetContext<MagicAccessoryDataModel>>(RootContext)!;

const system = computed(() => context.data.item.systemData);
</script>

<template>
	<BasicItemSheet show-effects-tab>
		<template v-slot:data>
			<section class="data-grid">
				<div class="row">
					<label>Umiejętność magiczna</label>
					<input type="text" name="system.magicSkill" :value="system.magicSkill" />
				</div>

				<div class="row">
					<label>Typ akcesorium</label>
					<input type="text" name="system.accessoryType" :value="system.accessoryType" />
				</div>

				<div class="row">
					<label>Bonus obrażeń Ataku</label>
					<input type="number" name="system.attackDamageBonus" :value="system.attackDamageBonus" />
				</div>

				<div class="row">
					<label>Dodaje obrażenia Ataku</label>
					<input type="checkbox" name="system.hasAttackDamageBonus" :checked="system.hasAttackDamageBonus" />
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.Encumbrance" /></label>
					<input type="number" name="system.encumbrance" :value="system.encumbrance" />
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.Price" /></label>
					<MoneyFields name-prefix="system.priceDetails" :value="system.priceDetails" include-restricted />
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.Rarity" /></label>
					<input type="number" name="system.rarity" :value="system.rarity" />
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.Source" /></label>
					<input type="text" name="system.source" :value="system.source" />
				</div>
			</section>
		</template>
	</BasicItemSheet>
</template>
