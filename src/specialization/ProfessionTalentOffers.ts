export type ProfessionTalentOffer = {
	specializationKey: string;
	professionId: string;
	specializationName?: string;
	professionName?: string;
	talentName: string;
	cost: number;
};

type ProfessionStepLike = {
	name?: string;
	effects?: string;
};

export const OLD_WORLD_PROFESSION_TALENT_OFFERS: ProfessionTalentOffer[] = [
	{ specializationKey: 'kat', professionId: 'kat-oprawca', specializationName: 'Kat', professionName: 'Oprawca*', talentName: 'Druzgocąca Riposta', cost: 25 },
	{ specializationKey: 'kat', professionId: 'kat-mistrz-malodobry', specializationName: 'Kat', professionName: 'Mistrz Małodobry*', talentName: 'Mistrz', cost: 25 },
	{ specializationKey: 'kupiec', professionId: 'kupiec-handlarz', specializationName: 'Kupiec', professionName: 'Handlarz', talentName: 'Zielarstwo', cost: 15 },
	{ specializationKey: 'rzemieslnik', professionId: 'rzemieslnik-czeladnik', specializationName: 'Rzemieślnik', professionName: 'Czeladnik', talentName: 'Szkolenie Bojowe', cost: 5 },
	{ specializationKey: 'rzemieslnik', professionId: 'rzemieslnik-mistrz', specializationName: 'Rzemieślnik', professionName: 'Mistrz', talentName: 'Wąska Specjalizacja', cost: 10 },
	{ specializationKey: 'rzemieslnik', professionId: 'rzemieslnik-mistrz', specializationName: 'Rzemieślnik', professionName: 'Mistrz', talentName: 'Wiedza Praktyczna', cost: 15 },
	{ specializationKey: 'rzemieslnik', professionId: 'rzemieslnik-mistrz-gildii', specializationName: 'Rzemieślnik', professionName: 'Mistrz Gildii', talentName: 'Szef', cost: 10 },
	{ specializationKey: 'agitator', professionId: 'agitator-pamflecista', specializationName: 'Agitator', professionName: 'Pamflecista', talentName: 'Koneksje', cost: 15 },
	{ specializationKey: 'agitator', professionId: 'agitator-demagog', specializationName: 'Agitator', professionName: 'Demagog', talentName: 'Orator', cost: 10 },
	{ specializationKey: 'agitator', professionId: 'agitator-demagog', specializationName: 'Agitator', professionName: 'Demagog', talentName: 'Druzgocąca Riposta', cost: 25 },
	{ specializationKey: 'kaplan-shallyi', professionId: 'kaplan-shallyi-arcykaplan', specializationName: 'Kapłan Shallyi', professionName: 'Arcykapłan', talentName: 'Porozmawiajmy', cost: 10 },
	{ specializationKey: 'kaplan-wojownik-sigmara', professionId: 'kaplan-wojownik-sigmara-kapelan', specializationName: 'Kapłan-Wojownik Sigmara', professionName: 'Kapelan', talentName: 'Inspirujący Zew', cost: 5 },
	{ specializationKey: 'medyk', professionId: 'medyk-aptekarz', specializationName: 'Medyk', professionName: 'Aptekarz', talentName: 'Silne Mikstury', cost: 5 },
	{ specializationKey: 'medyk', professionId: 'medyk-doktor', specializationName: 'Medyk', professionName: 'Doktor', talentName: 'Chirurgia Polowa', cost: 15 },
];

function normalize(value: string) {
	return value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.trim()
		.toLocaleLowerCase()
		.replace(/\s+/g, ' ');
}

export function getProfessionTalentOffers(specializationKey: string, professionId: string, specializationName = '', professionName = '') {
	const normalizedSpecializationKey = normalize(specializationKey);
	const normalizedProfessionId = normalize(professionId);
	const normalizedSpecializationName = normalize(specializationName);
	const normalizedProfessionName = normalize(professionName);

	return OLD_WORLD_PROFESSION_TALENT_OFFERS.filter((offer) => {
		const matchesKey = normalizedSpecializationKey && normalize(offer.specializationKey) === normalizedSpecializationKey;
		const matchesSpecializationName = normalizedSpecializationName && normalize(offer.specializationName ?? '') === normalizedSpecializationName;
		const matchesProfessionId = normalizedProfessionId && normalize(offer.professionId) === normalizedProfessionId;
		const matchesProfessionName = normalizedProfessionName && normalize(offer.professionName ?? '') === normalizedProfessionName;
		return (matchesKey || matchesSpecializationName) && (matchesProfessionId || matchesProfessionName);
	});
}

export function parseProfessionTalentOffers(step: ProfessionStepLike, specializationKey: string, professionId: string): ProfessionTalentOffer[] {
	const effects = step.effects ?? '';
	const offers: ProfessionTalentOffer[] = [];
	const pattern = /Możesz wydać\s+(\d+)\s*PD\s+na zakup(?: jednego poziomu)? talentu\s+(.+?)(?=\.| i \d+\s*PD|$)/giu;

	for (const match of effects.matchAll(pattern)) {
		const cost = Number(match[1]);
		const talentName = match[2]?.trim();
		if (!cost || !talentName) {
			continue;
		}

		offers.push({
			specializationKey,
			professionId,
			talentName: talentName === 'Trening Bojowy' ? 'Szkolenie Bojowe' : talentName,
			cost,
		});
	}

	return offers;
}

export function getProfessionTalentOffersForStep(step: ProfessionStepLike, specializationKey: string, professionId: string, specializationName = '') {
	const configuredOffers = getProfessionTalentOffers(specializationKey, professionId, specializationName, step.name ?? '');
	const parsedOffers = parseProfessionTalentOffers(step, specializationKey, professionId);
	const seen = new Set<string>();

	return [...configuredOffers, ...parsedOffers].filter((offer) => {
		const key = `${offer.professionId}-${offer.talentName}-${offer.cost}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}
