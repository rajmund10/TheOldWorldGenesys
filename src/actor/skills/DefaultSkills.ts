import type GenesysActor from '@/actor/GenesysActor';
import type CharacterDataModel from '@/actor/data/CharacterDataModel';
import type GenesysItem from '@/item/GenesysItem';
import type SkillDataModel from '@/item/data/SkillDataModel';

export const GENESYS_CORE_SKILL_NAMES = [
	'Alchemia',
	'Moc Tajemna',
	'Astrokartografia',
	'Atletyka',
	'Bijatyka',
	'Urok Osobisty',
	'Przymuszanie',
	'Komputery',
	'Opanowanie',
	'Koordynacja',
	'Oszustwo',
	'Dyscyplina',
	'Moc Boska',
	'Prowadzenie',
	'Artyleria',
	'Wiedza',
	'Przywództwo',
	'Mechanika',
	'Medycyna',
	'Broń Biała',
	'Broń Biała (Ciężka)',
	'Broń Biała (Lekka)',
	'Negocjacje',
	'Obsługa sprzętu',
	'Percepcja',
	'Pilotowanie',
	'Moc Pierwotna',
	'Broń Dystansowa',
	'Broń Dystansowa (Ciężka)',
	'Broń Dystansowa (Lekka)',
	'Odporność',
	'Jeździectwo',
	'Machlojki',
	'Ukrywanie się',
	'Znajomość Półświatka',
	'Sztuka Przetrwania',
	'Czujność',
];

export const OLD_WORLD_SKILL_NAMES = [
	'Alchemia',
	'Artyleria',
	'Atletyka',
	'Bijatyka',
	'Broń Biała (Ciężka)',
	'Broń Biała (Lekka)',
	'Broń Dystansowa',
	'Broń Palna',
	'Czujność',
	'Dyscyplina',
	'Inżynieria',
	'Jeździectwo',
	'Koordynacja',
	'Machlojki',
	'Medycyna',
	'Moc Boska',
	'Moc Tajemna',
	'Negocjacje',
	'Odporność',
	'Opanowanie',
	'Oszustwo',
	'Percepcja',
	'Przywództwo',
	'Przymuszanie',
	'Rzemiosło',
	'Sztuka Przetrwania',
	'Ukrywanie się',
	'Urok Osobisty',
	'Wiedza (Akademicka)',
	'Wiedza (Chaos)',
	'Znajomość Półświatka',
	'Żeglarstwo',
];

const BUILT_IN_SKILL_PACKS = ['genesys.core-skills-polish'];

function normalizeSkillName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function cleanSkillData(skill: GenesysItem<SkillDataModel>) {
	const data = skill.toObject();
	delete (data as any)._id;
	delete (data as any)._stats;
	delete (data as any).ownership;
	delete (data as any).flags;
	delete (data as any).folder;
	delete (data as any).sort;
	return data;
}

async function getSkillDocuments(skillNames: string[]) {
	const requestedNames = Array.from(new Set(skillNames.map(normalizeSkillName)));
	const requestedNameSet = new Set(requestedNames);
	const skillMap = new Map<string, GenesysItem<SkillDataModel>>();
	const configuredPackName = CONFIG.genesys?.settings?.skillsCompendium || 'genesys.core-skills-polish';
	const packNames = Array.from(new Set([configuredPackName, ...BUILT_IN_SKILL_PACKS].filter(Boolean)));

	for (const packName of packNames) {
		const pack = game.packs.get(packName);
		if (!pack) {
			continue;
		}

		const documents = (await pack.getDocuments()).filter((item) => (item as GenesysItem).type === 'skill') as GenesysItem<SkillDataModel>[];
		for (const skill of documents) {
			const normalizedName = normalizeSkillName(skill.name);
			if (!requestedNameSet.has(normalizedName) || skillMap.has(normalizedName)) {
				continue;
			}

			skillMap.set(normalizedName, skill);
		}
	}

	return requestedNames.map((name) => skillMap.get(name)).filter((skill): skill is GenesysItem<SkillDataModel> => !!skill);
}

export async function prepareDefaultSkillData(skillNames: string[], existingSkillNames: Iterable<string> = []) {
	const existingNameSet = new Set(Array.from(existingSkillNames).map(normalizeSkillName));
	const missingNames = skillNames.filter((skillName) => !existingNameSet.has(normalizeSkillName(skillName)));
	if (!missingNames.length) {
		return [];
	}

	const skillDocuments = await getSkillDocuments(missingNames);
	return skillDocuments.map(cleanSkillData);
}

export async function addDefaultSkillsToActor(actor: GenesysActor<CharacterDataModel>, skillNames: string[], notify = true) {
	const existingSkillNames = actor.items.filter((item) => item.type === 'skill').map((skill) => skill.name);
	const skillData = await prepareDefaultSkillData(skillNames, existingSkillNames);

	if (!skillData.length) {
		return 0;
	}

	await actor.createEmbeddedDocuments('Item', skillData);
	if (notify) {
		ui.notifications.info(`Dodano ${skillData.length} umiejętności do ${actor.name}.`);
	}

	return skillData.length;
}

export async function replaceDefaultSkillsForActor(actor: GenesysActor<CharacterDataModel>, skillNames: string[], notify = true) {
	const skillIds = actor.items.filter((item) => item.type === 'skill').map((skill) => skill.id);
	if (skillIds.length) {
		await actor.deleteEmbeddedDocuments('Item', skillIds);
	}

	const skillData = await prepareDefaultSkillData(skillNames);
	if (skillData.length) {
		await actor.createEmbeddedDocuments('Item', skillData);
	}

	if (notify) {
		ui.notifications.info(`Zmieniono zestaw umiejętności postaci ${actor.name}. Dodano ${skillData.length}.`);
	}

	return skillData.length;
}
