<script lang="ts" setup>
import { computed, inject } from 'vue';

import { ItemSheetContext, RootContext } from '@/vue/SheetContext';
import BasicItemSheet from '@/vue/sheets/item/BasicItemSheet.vue';
import Localized from '@/vue/components/Localized.vue';
import ItemQualityDataModel from '@/item/data/ItemQualityDataModel';

const context = inject<ItemSheetContext<ItemQualityDataModel>>(RootContext)!;

const system = computed(() => context.data.item.systemData);
</script>

<template>
	<BasicItemSheet show-effects-tab>
		<template v-slot:data>
			<section class="data-grid">
				<div class="row">
					<label><Localized label="Genesys.Labels.Activation" /></label>
					<select name="system.activation" :value="system.activation">
						<option value="passive"><Localized label="Genesys.Labels.Passive" /></option>
						<option value="active"><Localized label="Genesys.Labels.Active" /></option>
					</select>
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.IsRated" /></label>
					<input type="checkbox" name="system.isRated" :checked="system.isRated" />
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.ActivationAdvantages" /></label>
					<input type="number" name="system.activationCost.advantages" :value="system.activationCost.advantages" min="0" />
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.ActivationTriumphs" /></label>
					<input type="number" name="system.activationCost.triumphs" :value="system.activationCost.triumphs" min="0" />
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.ActivationLimit" /></label>
					<select name="system.activationLimit" :value="system.activationLimit">
						<option value="once"><Localized label="Genesys.Labels.Once" /></option>
						<option value="unlimited"><Localized label="Genesys.Labels.Unlimited" /></option>
						<option value="rating"><Localized label="Genesys.Labels.UpToRating" /></option>
					</select>
				</div>

				<div class="row">
					<label><Localized label="Genesys.Labels.Source" /></label>
					<input type="text" name="system.source" :value="system.source" />
				</div>
			</section>
		</template>
	</BasicItemSheet>
</template>
