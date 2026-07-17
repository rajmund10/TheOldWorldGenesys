import { applyDefaultCharacterSheetForProfile } from '@/actor/sheets';
import { GAME_PROFILE_DEFINITIONS, getGameProfile, type GenesysGameProfile } from '@/system/GameProfile';
import { ContextBase } from '@/vue/SheetContext';
import VueSheet from '@/vue/VueSheet';
import VueGameProfileSelector from '@/vue/apps/GameProfileSelector.vue';

export interface GameProfileSelectorContext extends ContextBase {
	profiles: typeof GAME_PROFILE_DEFINITIONS;
	activeProfile: GenesysGameProfile;
	selectProfile: (profile: GenesysGameProfile) => Promise<void>;
}

const SETTINGS_NAMESPACE = 'genesys';
const KEY_GAME_PROFILE = 'gameProfile';
const KEY_GAME_PROFILE_CONFIGURED = 'gameProfileConfigured';
const INITIAL_SETUP_PROFILES = GAME_PROFILE_DEFINITIONS.filter((profile) => profile.id !== 'aurora');

export default class GameProfileSelector extends VueSheet(Application) {
	override get vueComponent() {
		return VueGameProfileSelector;
	}

	static override get defaultOptions() {
		return {
			...super.defaultOptions,
			classes: ['app-game-profile-selector'],
			width: 680,
			height: 'auto',
			title: game.i18n.localize('Genesys.Settings.GameProfile'),
		};
	}

	static async promptForInitialSetup() {
		if (!game.user?.isGM || game.settings.get<boolean>(SETTINGS_NAMESPACE, KEY_GAME_PROFILE_CONFIGURED)) {
			return;
		}

		await new GameProfileSelector().render(true);
	}

	override async getVueContext(): Promise<GameProfileSelectorContext> {
		return {
			profiles: INITIAL_SETUP_PROFILES,
			activeProfile: getGameProfile(),
			selectProfile: async (profile) => {
				await game.settings.set(SETTINGS_NAMESPACE, KEY_GAME_PROFILE, profile);
				await game.settings.set(SETTINGS_NAMESPACE, KEY_GAME_PROFILE_CONFIGURED, true);
				applyDefaultCharacterSheetForProfile(profile);
				this.rerenderOpenCharacterSheets();
				await this.close();
			},
		};
	}

	private rerenderOpenCharacterSheets() {
		for (const app of Object.values(ui.windows)) {
			if (!(app instanceof ActorSheet) || app.actor?.type !== 'character') {
				continue;
			}

			app.render(false);
		}
	}
}
