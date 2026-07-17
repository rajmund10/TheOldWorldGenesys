export type GenesysGameProfile = 'genesys' | 'old-world' | 'aurora' | 'warcraft';
export type CurrencyMode = 'legacy' | 'warhammer';

export const DEFAULT_GAME_PROFILE: GenesysGameProfile = 'genesys';

export type GameProfileDefinition = {
	id: GenesysGameProfile;
	labelKey: string;
	descriptionKey: string;
	icon: string;
	cssClass: string;
};

export const GAME_PROFILE_DEFINITIONS: GameProfileDefinition[] = [
	{
		id: 'genesys',
		labelKey: 'Genesys.Settings.GameProfileGenesys',
		descriptionKey: 'Genesys.Settings.GameProfileGenesysHint',
		icon: 'fas fa-dice-d20',
		cssClass: 'profile-genesys',
	},
	{
		id: 'old-world',
		labelKey: 'Genesys.Settings.GameProfileOldWorld',
		descriptionKey: 'Genesys.Settings.GameProfileOldWorldHint',
		icon: 'fas fa-crown',
		cssClass: 'profile-old-world',
	},
	{
		id: 'aurora',
		labelKey: 'Genesys.Settings.GameProfileAurora',
		descriptionKey: 'Genesys.Settings.GameProfileAuroraHint',
		icon: 'fas fa-sun',
		cssClass: 'profile-aurora',
	},
	{
		id: 'warcraft',
		labelKey: 'Genesys.Settings.GameProfileWarcraft',
		descriptionKey: 'Genesys.Settings.GameProfileWarcraftHint',
		icon: 'fas fa-hammer',
		cssClass: 'profile-warcraft',
	},
];

export function normalizeGameProfile(value: unknown): GenesysGameProfile {
	if (value === 'warhammer') {
		return 'old-world';
	}

	if (value === 'old-world' || value === 'aurora' || value === 'warcraft') {
		return value;
	}

	return DEFAULT_GAME_PROFILE;
}

export function getGameProfile(): GenesysGameProfile {
	return normalizeGameProfile(CONFIG.genesys?.settings?.gameProfile);
}

export function isWarhammerProfile(profile: GenesysGameProfile = getGameProfile()) {
	return profile === 'old-world';
}

export function getCurrencyModeForProfile(profile: GenesysGameProfile = getGameProfile()): CurrencyMode {
	return isWarhammerProfile(profile) ? 'warhammer' : 'legacy';
}

export function getCurrencyLabelForProfile(profile: GenesysGameProfile = getGameProfile()) {
	if (isWarhammerProfile(profile)) {
		return 'Korony';
	}

	if (profile === 'aurora') {
		return 'Waluta';
	}

	if (profile === 'warcraft') {
		return 'Złoto';
	}

	return CONFIG.genesys?.settings?.currencyName || 'Pieniądze';
}
