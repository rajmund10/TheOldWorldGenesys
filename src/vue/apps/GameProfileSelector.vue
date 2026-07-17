<script lang="ts" setup>
import { computed, inject, ref } from 'vue';
import { GameProfileSelectorContext } from '@/app/GameProfileSelector';
import type { GenesysGameProfile } from '@/system/GameProfile';
import { RootContext } from '@/vue/SheetContext';
import Localized from '@/vue/components/Localized.vue';
import oldWorldImage from '@/style/241947133_103421695426686_1631613795640219109_n.jpg';
import warcraftImage from '@/style/warcraft-iii.avif';

const context = inject<GameProfileSelectorContext>(RootContext)!;

const profiles = computed(() => context.profiles);
const selectedProfile = ref<GenesysGameProfile>(profiles.value.some((profile) => profile.id === context.activeProfile) ? context.activeProfile : 'genesys');
const isConfirming = ref(false);

const profileImages: Partial<Record<GenesysGameProfile, string>> = {
	'old-world': oldWorldImage,
	warcraft: warcraftImage,
};

function isActive(profileId: string) {
	return context.activeProfile === profileId;
}

function isSelected(profileId: string) {
	return selectedProfile.value === profileId;
}

function selectProfile(profileId: GenesysGameProfile) {
	selectedProfile.value = profileId;
}

function profileImage(profileId: GenesysGameProfile) {
	return profileImages[profileId];
}

async function confirmSelection() {
	if (isConfirming.value) {
		return;
	}

	isConfirming.value = true;
	await context.selectProfile(selectedProfile.value);
}
</script>

<template>
	<div class="genesys game-profile-selector">
		<header>
			<h2><Localized label="Genesys.Settings.GameProfileChoose" /></h2>
			<p><Localized label="Genesys.Settings.GameProfileHint" /></p>
		</header>

		<section class="profile-grid">
			<button
				v-for="profile in profiles"
				:key="profile.id"
				type="button"
				class="profile-card"
				:class="[profile.cssClass, { active: isActive(profile.id), selected: isSelected(profile.id), illustrated: !!profileImage(profile.id) }]"
				:style="profileImage(profile.id) ? { '--profile-image': `url(${profileImage(profile.id)})` } : undefined"
				@click="selectProfile(profile.id)"
			>
				<span class="profile-content">
					<span class="profile-icon"><i :class="profile.icon"></i></span>
					<span class="profile-title"><Localized :label="profile.labelKey" /></span>
					<span class="profile-description"><Localized :label="profile.descriptionKey" /></span>
					<span v-if="isActive(profile.id)" class="profile-status"><Localized label="Genesys.Settings.GameProfileCurrent" /></span>
				</span>
				<span v-if="isSelected(profile.id)" class="selection-check"><i class="fas fa-check"></i></span>
			</button>
		</section>

		<footer>
			<button type="button" class="confirm-profile" :disabled="isConfirming" @click="confirmSelection">
				<i class="fas fa-check"></i>
				<Localized label="Genesys.Settings.GameProfileConfirm" />
			</button>
		</footer>
	</div>
</template>

<style lang="scss">
@use '@scss/mixins/backgrounds.scss';
@use '@scss/vars/colors.scss';

.app-game-profile-selector {
	min-width: 560px;

	.window-content {
		@include backgrounds.crossboxes();
		padding: 12px;
	}
}

.game-profile-selector {
	display: flex;
	flex-direction: column;
	gap: 14px;
	font-family: 'Roboto Serif', serif;

	header {
		h2 {
			margin: 0;
			font-family: 'Bebas Neue', sans-serif;
			font-size: 1.8em;
			color: colors.$dark-blue;
		}

		p {
			margin: 4px 0 0;
			color: #4b5661;
			line-height: 1.35;
		}
	}

	.profile-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.profile-card {
		position: relative;
		overflow: hidden;
		display: flex;
		min-height: 170px;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		padding: 14px;
		border: 1px solid rgba(36, 72, 104, 0.35);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.78);
		color: #222;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;

		&::before {
			position: absolute;
			inset: 0;
			background-image: var(--profile-image);
			background-position: center;
			background-size: cover;
			content: '';
			opacity: 0;
			transition: opacity 0.16s ease, transform 0.16s ease;
		}

		&::after {
			position: absolute;
			inset: 0;
			background: linear-gradient(180deg, rgba(12, 18, 24, 0.12), rgba(12, 18, 24, 0.72));
			content: '';
			opacity: 0;
			transition: opacity 0.16s ease;
		}

		&:hover,
		&:focus-visible {
			border-color: colors.$blue;
			box-shadow: 0 2px 10px rgba(29, 61, 92, 0.2);
			transform: translateY(-1px);
		}

		&.active {
			border-color: colors.$gold;
			box-shadow: inset 0 0 0 2px rgba(186, 135, 40, 0.45);
		}

		&.selected {
			border-color: colors.$gold;
			box-shadow: 0 2px 12px rgba(123, 91, 28, 0.28), inset 0 0 0 2px rgba(186, 135, 40, 0.62);
		}

		&.illustrated {
			.profile-content,
			.selection-check {
				position: relative;
				z-index: 1;
			}

			&::before {
				opacity: 0.82;
			}

			&::after {
				opacity: 1;
			}

			.profile-icon {
				background: rgba(10, 18, 28, 0.82);
			}

			.profile-title,
			.profile-description {
				color: white;
				text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65);
			}

			.profile-status {
				color: #ffd782;
			}
		}

		&.profile-old-world {
			background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(236, 229, 214, 0.86));
		}

		&.profile-warcraft {
			background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(225, 237, 226, 0.88));
		}
	}

	.profile-content {
		display: flex;
		min-height: 100%;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}

	.profile-icon {
		display: grid;
		width: 42px;
		height: 42px;
		place-items: center;
		border-radius: 50%;
		background: colors.$dark-blue;
		color: white;
		font-size: 1.25em;
	}

	.profile-title {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.35em;
		color: colors.$dark-blue;
		line-height: 1;
	}

	.profile-description {
		color: #39444f;
		font-size: 0.92em;
		line-height: 1.35;
	}

	.profile-status {
		margin-top: auto;
		color: colors.$gold;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.05em;
	}

	.selection-check {
		position: absolute;
		top: 10px;
		right: 10px;
		display: grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border-radius: 50%;
		background: colors.$gold;
		color: #1d2430;
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.35);
	}

	footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 8px;
		border-top: 1px solid rgba(36, 72, 104, 0.2);
	}

	.confirm-profile {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border: 0;
		border-radius: 4px;
		background: colors.$dark-blue;
		color: white;
		font-family: 'Roboto Serif', serif;
		cursor: pointer;

		&:hover:not(:disabled),
		&:focus-visible:not(:disabled) {
			background: colors.$blue;
		}

		&:disabled {
			cursor: wait;
			opacity: 0.65;
		}
	}
}
@media (max-width: 620px) {
	.app-game-profile-selector {
		min-width: 320px;
	}

	.game-profile-selector .profile-grid {
		grid-template-columns: 1fr;
	}
}
</style>
