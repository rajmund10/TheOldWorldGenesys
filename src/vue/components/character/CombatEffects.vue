<script lang="ts" setup>
import { computed, inject, toRaw } from 'vue';
import { ActorSheetContext, RootContext } from '@/vue/SheetContext';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import Localized from '@/vue/components/Localized.vue';
import {
	COMBAT_STATUS_DEFINITIONS,
	hasCombatStatus,
	setCombatStatus,
} from '@/combat/CombatStatuses';

const context = inject<ActorSheetContext<CharacterDataModel>>(RootContext)!;

const actor = computed(() => {
	context.renderKey;
	return toRaw(context.data.actor);
});

const statuses = computed(() => {
	context.renderKey;
	return COMBAT_STATUS_DEFINITIONS.filter((definition) => definition.showOnSheet).map((definition) => ({
			...definition,
			active: hasCombatStatus(actor.value, definition.id),
		}));
});

async function toggleStatus(statusId: (typeof COMBAT_STATUS_DEFINITIONS)[number]['id'], event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	input.disabled = true;
	try {
		await setCombatStatus(actor.value, statusId, input.checked);
	} finally {
		input.disabled = !context.data.editable;
	}
}

function localize(key: string) {
	return game.i18n.localize(key);
}
</script>

<template>
	<div class="block combat-effects">
		<div class="header"><Localized label="Genesys.CombatStatuses.Title" /></div>
		<div class="status-list">
			<label
				v-for="status in statuses"
				:key="status.id"
				class="status-row"
				:class="{ active: status.active }"
				:data-tooltip="status.description"
				data-tooltip-direction="UP"
			>
				<span class="status-toggle">
					<input
						type="checkbox"
						:checked="status.active"
						:disabled="!context.data.editable"
						@change="toggleStatus(status.id, $event)"
					/>
				</span>
				<img :src="status.icon" :alt="localize(status.label)" />
				<span class="status-name">{{ localize(status.label) }}</span>
			</label>
		</div>
	</div>
</template>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

.combat-effects {
	background: transparentize(colors.$light-blue, 0.8);
	padding: 0.5em;
	border-radius: 0.5em;

	& > .header {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.25em;
		padding-bottom: 0.25rem;
		border-bottom: 1px dashed colors.$blue;
	}

	.status-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0 0.75rem;
	}

	.status-row {
		display: grid;
		grid-template-columns: 1.25rem 1.75rem minmax(0, 1fr);
		align-items: center;
		gap: 0.4rem;
		min-height: 2.25rem;
		border-bottom: 1px solid transparentize(colors.$blue, 0.65);
		cursor: pointer;

		&.active {
			font-weight: bold;
		}

		img {
			width: 1.5rem;
			height: 1.5rem;
			border: 0;
			object-fit: cover;
		}
	}

	.status-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;

		input {
			margin: 0;
		}
	}

	.status-name {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.status-row:has(input:disabled) {
		cursor: default;
	}
}
</style>
