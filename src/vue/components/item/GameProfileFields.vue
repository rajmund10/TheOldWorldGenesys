<script lang="ts" setup>
import { computed } from 'vue';
import GenesysItem from '@/item/GenesysItem';
import BaseItemDataModel from '@/item/data/BaseItemDataModel';
import { GAME_PROFILE_DEFINITIONS, type GenesysGameProfile } from '@/system/GameProfile';

const props = defineProps<{
	item: GenesysItem<BaseItemDataModel>;
	modelValue?: string[];
	editable?: boolean;
}>();

const selectedProfiles = computed(() => new Set(props.modelValue ?? []));

function t(key: string) {
	return game.i18n.localize(key);
}

async function setProfile(profile: GenesysGameProfile, enabled: boolean) {
	const nextProfiles = new Set(props.modelValue ?? []);

	if (enabled) {
		nextProfiles.add(profile);
	} else {
		nextProfiles.delete(profile);
	}

	await props.item.update({
		'system.gameProfiles': GAME_PROFILE_DEFINITIONS.map(({ id }) => id).filter((id) => nextProfiles.has(id)),
	});
}
</script>

<template>
	<div class="row game-profile-fields">
		<label>{{ t('Genesys.Item.GameProfiles') }}</label>
		<div class="profile-options">
			<label v-for="profile in GAME_PROFILE_DEFINITIONS" :key="profile.id" class="profile-option">
				<input
					type="checkbox"
					:checked="selectedProfiles.has(profile.id)"
					:disabled="!editable"
					@change="setProfile(profile.id, ($event.target as HTMLInputElement).checked)"
				/>
				<span>{{ t(profile.labelKey) }}</span>
			</label>
			<p>{{ t('Genesys.Item.GameProfilesHint') }}</p>
		</div>
	</div>
</template>

<style lang="scss" scoped>
.game-profile-fields {
	display: grid;
	grid-template-columns: minmax(120px, 0.35fr) 1fr;
	gap: 8px;
	align-items: start;
}

.profile-options {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 14px;

	p {
		flex-basis: 100%;
		margin: 2px 0 0;
		font-size: 0.86em;
		opacity: 0.75;
	}
}

.profile-option {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	white-space: nowrap;

	input {
		margin: 0;
	}
}
</style>
