import type { GenesysGameProfile } from '@/system/GameProfile';

export const CHARACTER_CREATION_COMPENDIUM = 'genesys.itemy';

export type CharacterCreationOption = {
	id: string;
	name: string;
	img: string;
	description: string;
	key: string;
	careerSkills: string[];
	availableSpecializationKeys: string[];
	allowedArchetypeKeys: string[];
};

export type CharacterCreationCatalog = {
	packId: string;
	archetypes: CharacterCreationOption[];
	careers: CharacterCreationOption[];
	specializations: CharacterCreationOption[];
};

export function specializationMatchesCareer(specializationKey: string, availableKeys: string[]) {
	const normalizedSpecializationKey = specializationKey.trim().toLocaleLowerCase();
	return availableKeys.some((key) => {
		const normalizedCareerKey = key.trim().toLocaleLowerCase();
		return normalizedCareerKey === normalizedSpecializationKey
			|| normalizedCareerKey.startsWith(`${normalizedSpecializationKey}-`)
			|| normalizedSpecializationKey.startsWith(`${normalizedCareerKey}-`);
	});
}

function skillName(skill: unknown) {
	if (typeof skill === 'string') return skill;
	if (skill && typeof skill === 'object' && 'name' in skill) {
		return String((skill as { name?: unknown }).name ?? '');
	}
	return '';
}

function toOption(document: any): CharacterCreationOption {
	const system = document.systemData ?? document.system ?? {};
	return {
		id: document.id,
		name: document.name ?? '',
		img: document.img ?? 'icons/svg/book.svg',
		description: system.description ?? '',
		key: system.key ?? '',
		careerSkills: (system.careerSkills ?? []).map(skillName).filter(Boolean),
		availableSpecializationKeys: (system.availableSpecializationKeys ?? []).filter(Boolean),
		allowedArchetypeKeys: (system.allowedArchetypeKeys ?? []).filter(Boolean),
	};
}

export function specializationMatchesArchetype(specialization: CharacterCreationOption, archetype: CharacterCreationOption) {
	return !specialization.allowedArchetypeKeys.length || specialization.allowedArchetypeKeys.includes(archetype.key);
}

export async function loadCharacterCreationCatalog(profile: GenesysGameProfile): Promise<CharacterCreationCatalog> {
	const pack = game.packs.get(CHARACTER_CREATION_COMPENDIUM);
	if (!pack) {
		throw new Error(`Missing character creation compendium: ${CHARACTER_CREATION_COMPENDIUM}`);
	}

	const documents = await pack.getDocuments() as any[];
	const availableDocuments = documents.filter((document) => {
		const gameProfiles = document.systemData?.gameProfiles ?? document.system?.gameProfiles ?? [];
		return Array.isArray(gameProfiles) && gameProfiles.includes(profile);
	});
	const optionsFor = (type: string) => availableDocuments
		.filter((document) => document.type === type)
		.map(toOption)
		.sort((left, right) => left.name.localeCompare(right.name));

	return {
		packId: CHARACTER_CREATION_COMPENDIUM,
		archetypes: optionsFor('archetype'),
		careers: optionsFor('career'),
		specializations: optionsFor('specialization'),
	};
}
