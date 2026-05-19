<script lang="ts" setup>
import { computed } from 'vue';

type MoneyValue = {
	gold?: number;
	silver?: number;
	pennies?: number;
	restricted?: boolean;
};

const props = defineProps<{
	namePrefix: string;
	value?: MoneyValue;
	includeRestricted?: boolean;
	compact?: boolean;
}>();

const money = computed(() => ({
	gold: props.value?.gold ?? 0,
	silver: props.value?.silver ?? 0,
	pennies: props.value?.pennies ?? 0,
	restricted: props.value?.restricted ?? false,
}));
</script>

<template>
	<div :class="`money-fields ${compact ? 'compact' : ''}`">
		<label class="money-field">
			<span>ZK</span>
			<input type="number" :name="`${namePrefix}.gold`" :value="money.gold" min="0" step="1" />
		</label>

		<label class="money-field">
			<span>Srebrniki</span>
			<input type="number" :name="`${namePrefix}.silver`" :value="money.silver" min="0" step="1" />
		</label>

		<label class="money-field">
			<span>Pensy</span>
			<input type="number" :name="`${namePrefix}.pennies`" :value="money.pennies" min="0" step="1" />
		</label>

		<label v-if="includeRestricted" class="restricted-field" title="Ograniczona dostępność">
			<input type="checkbox" :name="`${namePrefix}.restricted`" :checked="money.restricted" />
			<span>O</span>
		</label>
	</div>
</template>

<style lang="scss" scoped>
.money-fields {
	display: grid;
	grid-template-columns: repeat(3, minmax(4.5rem, 1fr)) auto;
	gap: 0.35rem;
	align-items: center;
	width: 100%;

	&.compact {
		grid-template-columns: repeat(3, minmax(4.25rem, auto)) auto;
		width: auto;
	}
}

.money-field,
.restricted-field {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	min-width: 0;

	span {
		flex: 0 0 auto;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.85em;
		line-height: 1;
		text-transform: uppercase;
	}
}

.money-field input {
	min-width: 0;
	width: 100%;
	text-align: right;
}

.compact .money-field input {
	width: 3.25rem;
}

.restricted-field {
	justify-content: flex-end;
}
</style>
