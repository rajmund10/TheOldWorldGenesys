import { EMPTY_MAGIC_ACCESS, MAGIC_ACTION_IDS, MAGIC_SCHOOL_IDS, MAGIC_TRADITIONS, type MagicAccessData, type MagicActionId, type MagicPathType, type MagicSchoolId, type MagicTradition } from '@/magic/MagicConstants';

type MagicProfileDefinition = {
	id: MagicSchoolId;
	label: string;
	tradition: MagicTradition;
	pathType: MagicPathType;
	description: string;
	actionIds: MagicActionId[];
	signatureEffects: string[];
	rules: string[];
	windName?: string;
	orderName?: string;
	aliases: string[];
	allowMiscast?: boolean;
	allowOvercast?: boolean;
};

export type MagicActionDefinition = {
	id: MagicActionId;
	label: string;
	summary: string;
	oldWorldOnly?: boolean;
};

export type ResolvedMagicProfile = {
	enabled: boolean;
	specializationName: string | null;
	matchedBy: 'explicit' | 'fallback' | 'custom' | 'none';
	tradition: MagicTradition | null;
	traditionLabel: string | null;
	pathType: MagicPathType | null;
	pathLabel: string | null;
	schoolId: MagicSchoolId | null;
	description: string | null;
	primarySkillName: string | null;
	allowMiscast: boolean;
	allowOvercast: boolean;
	actionIds: MagicActionId[];
	signatureEffects: string[];
	rules: string[];
	windName: string | null;
	orderName: string | null;
};

type SpecializationLike = {
	name: string;
	systemData?: {
		magicAccess?: Partial<MagicAccessData>;
	};
};

type SkillLike = {
	id?: string;
	name: string;
	type?: string;
	systemData?: {
		category?: string;
		rank?: number;
		characteristic?: string;
	};
};

export type MagicSkillSummary = {
	id?: string;
	name: string;
	rank: number;
	characteristic: string;
	isPrimary: boolean;
};

const ARCANA_ACTIONS: MagicActionId[] = ['attack', 'augment', 'barrier', 'conjure', 'curse', 'dispel', 'senseMagic'];
const DIVINE_ACTIONS: MagicActionId[] = ['augment', 'barrier', 'curse', 'dispel', 'heal'];
const PRIMAL_ACTIONS: MagicActionId[] = ['attack', 'augment', 'barrier', 'conjure', 'curse', 'dispel', 'heal', 'utility', 'transform'];

const DEFAULT_ACTIONS_BY_TRADITION: Record<MagicTradition, MagicActionId[]> = {
	arcana: ARCANA_ACTIONS,
	divine: DIVINE_ACTIONS,
	primal: PRIMAL_ACTIONS,
};

const TRADITION_LABELS: Record<MagicTradition, string> = {
	arcana: 'Moc Tajemna',
	divine: 'Moc Boska',
	primal: 'Moc Pierwotna',
};

const PRIMARY_SKILL_NAMES: Record<MagicTradition, string> = {
	arcana: 'Moc Tajemna',
	divine: 'Moc Boska',
	primal: 'Moc Pierwotna',
};

const PRIMARY_SKILL_ALIASES: Record<MagicTradition, string[]> = {
	arcana: ['Moc Tajemna', 'Arcana'],
	divine: ['Moc Boska', 'Divine'],
	primal: ['Moc Pierwotna', 'Primal'],
};

const DEFAULT_PATH_TYPES: Record<MagicTradition, MagicPathType> = {
	arcana: 'lore',
	divine: 'deity',
	primal: 'tradition',
};

const GENERIC_RULES_BY_TRADITION: Record<MagicTradition, string[]> = {
	arcana: ['Czarodzieje rzucają zaklęcia przy użyciu Mocy Tajemnej, ryzykują Manifestacje i mogą korzystać z manewru Przeciążenie.', 'Rozproszenie i Wyczucie Magii nigdy nie wywołują Manifestacji w nakładce Starego Świata.'],
	divine: ['Kapłani czynią cuda przy użyciu Mocy Boskiej i pozostają związani z jednym bóstwem albo kultem.', 'Ścieżki kapłańskie domyślnie nie korzystają z pętli Manifestacji i Przeciążenia.'],
	primal: ['Użytkownicy Mocy Pierwotnej korzystają z elastycznych zasad budowania czarów Genesys i opierają się na umiejętności Moc Pierwotna.'],
};

export const MAGIC_ACTIONS: Record<MagicActionId, MagicActionDefinition> = {
	attack: {
		id: 'attack',
		label: 'Atak',
		summary: 'Zadaj obrażenia, wywieraj presję albo przemieszczaj cele bezpośrednią przemocą magiczną.',
	},
	augment: {
		id: 'augment',
		label: 'Ulepszenie',
		summary: 'Wzmacniaj sprzymierzeńców szybkością, siłą, odpornością albo nadnaturalną przewagą.',
	},
	barrier: {
		id: 'barrier',
		label: 'Bariera',
		summary: 'Twórz ochronę, odwracaj ciosy albo zapewniaj azyl przed nadchodzącym zagrożeniem.',
	},
	conjure: {
		id: 'conjure',
		label: 'Przywołanie',
		summary: 'Przywołuj istoty, sojuszników albo tymczasowe manifestacje.',
	},
	curse: {
		id: 'curse',
		label: 'Klątwa',
		summary: 'Osłabiaj, skazuj albo wypaczaj cele wrogą presją magiczną.',
	},
	dispel: {
		id: 'dispel',
		label: 'Rozproszenie',
		summary: 'Przerywaj albo tłum trwające efekty magiczne.',
	},
	heal: {
		id: 'heal',
		label: 'Uzdrawianie',
		summary: 'Przywracaj rany, lecz urazy krytyczne albo odnawiaj witalność.',
	},
	utility: {
		id: 'utility',
		label: 'Magia użytkowa',
		summary: 'Obsługuj elastyczną magię narracyjną, która nie pasuje do pozostałych akcji podstawowych.',
	},
	mask: {
		id: 'mask',
		label: 'Iluzja',
		summary: 'Twórz złudzenia, fałszywy wygląd i zamieszanie na polu walki.',
		oldWorldOnly: true,
	},
	predict: {
		id: 'predict',
		label: 'Prekognicja',
		summary: 'Odczytuj omeny, bliską przyszłość albo ukryte prawdy dzięki magicznemu przeczuciu.',
		oldWorldOnly: true,
	},
	senseMagic: {
		id: 'senseMagic',
		label: 'Wyczucie Magii',
		summary: 'Odczytuj wiatry magii, rozpoznawaj zaklęcia i stabilizuj niestabilne czarowanie.',
		oldWorldOnly: true,
	},
	transform: {
		id: 'transform',
		label: 'Przemiana',
		summary: 'Przyjmuj bestialskie kształty albo narzucaj je innym celom.',
		oldWorldOnly: true,
	},
};

const PROFILE_DEFINITIONS: Record<MagicSchoolId, MagicProfileDefinition> = {
	heavens: {
		id: 'heavens',
		label: 'Tradycja Niebios',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia niebios odczytuje omeny, pogodę i znaki na niebie. Sprzyja przewidywaniu, kontroli i precyzyjnemu kształtowaniu pola walki.',
		actionIds: ['attack', 'augment', 'barrier', 'conjure', 'dispel', 'predict', 'senseMagic'],
		signatureEffects: ['Pole rażenia', 'Szybkość', 'Prekognicja', 'Błyskawica'],
		rules: ['Czarodzieje Niebios są związani z Azyr i normalnie nie sięgają po inne tradycje ani cuda.'],
		windName: 'Azyr',
		orderName: 'Zakon Niebios',
		aliases: ['celestial wizard', 'lore of the heavens', 'lore of heavens', 'azyr', 'celestial'],
		allowMiscast: true,
		allowOvercast: true,
	},
	fire: {
		id: 'fire',
		label: 'Tradycja Ognia',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia ognia jest agresywna, wybuchowa i widowiskowa. Stawia na bezpośrednią ofensywę i presję.',
		actionIds: ['attack', 'augment', 'barrier', 'dispel', 'senseMagic'],
		signatureEffects: ['Ogień', 'Zabójczość', 'Pole rażenia'],
		rules: ['Jaśni czarodzieje kanalizują Aqshy i poza wyjątkowymi przypadkami spaczenia Chaosu pozostają przy własnej tradycji.'],
		windName: 'Aqshy',
		orderName: 'Zakon Ognia',
		aliases: ['bright wizard', 'lore of fire', 'aqshy'],
		allowMiscast: true,
		allowOvercast: true,
	},
	metal: {
		id: 'metal',
		label: 'Tradycja Metalu',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia metalu koncentruje się na metalu, alchemii i przekształcaniu materii z chłodną precyzją.',
		actionIds: ['attack', 'augment', 'barrier', 'conjure', 'curse', 'dispel', 'senseMagic'],
		signatureEffects: ['Zaklęta broń', 'Destrukcyjność', 'Zabójczość'],
		rules: ['Złoci czarodzieje wiążą się z Chamon i dyscypliną Zakonu Zlota.'],
		windName: 'Chamon',
		orderName: 'Zakon Złota',
		aliases: ['gold wizard', 'lore of metal', 'chamon'],
		allowMiscast: true,
		allowOvercast: true,
	},
	beasts: {
		id: 'beasts',
		label: 'Tradycja Bestii',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia bestii sięga po instynkt, zwierzęcą furię i dziką formę istot żywych.',
		actionIds: ['attack', 'augment', 'barrier', 'conjure', 'dispel', 'senseMagic', 'transform'],
		signatureEffects: ['Pierwotna furia', 'Walka w zwarciu', 'Przywołanie sojusznika', 'Straszliwa forma'],
		rules: ['Bursztynowi czarodzieje najlepiej łączą ograniczenia tradycji Starego Świata z akcją Przemiana.'],
		windName: 'Ghur',
		orderName: 'Zakon Bursztynu',
		aliases: ['amber wizard', 'lore of beasts', 'ghur'],
		allowMiscast: true,
		allowOvercast: true,
	},
	life: {
		id: 'life',
		label: 'Tradycja Życia',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia życia leczy, chroni i wzmacnia naturalną witalność, pozostając głęboko związaną z życiem.',
		actionIds: ['attack', 'augment', 'barrier', 'conjure', 'dispel', 'heal', 'senseMagic'],
		signatureEffects: ['Uzdrawianie', 'Przywrócenie', 'Boskie zdrowie', 'Przywołanie'],
		rules: ['Jadeitowi czarodzieje Ghyran są naturalnymi uzdrowicielami, strażnikami i opiekunami.'],
		windName: 'Ghyran',
		orderName: 'Zakon Jadeitu',
		aliases: ['jade wizard', 'lore of life', 'ghyran'],
		allowMiscast: true,
		allowOvercast: true,
	},
	light: {
		id: 'light',
		label: 'Tradycja Światła',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia światła ujawnia, oczyszcza i chroni dzięki jasności, blaskowi oraz zdyscyplinowanej kontroli.',
		actionIds: ['attack', 'augment', 'curse', 'dispel', 'heal', 'senseMagic'],
		signatureEffects: ['Świętość', 'Uzdrawianie', 'Błogosławieństwo', 'Paraliż'],
		rules: ['Biali czarodzieje przywołują Hysh i trzymają się ściśle kontrolowanej tradycji kolegium.'],
		windName: 'Hysh',
		orderName: 'Zakon Światła',
		aliases: ['white wizard', 'lore of light', 'hysh', 'white', 'light wizard'],
		allowMiscast: true,
		allowOvercast: true,
	},
	death: {
		id: 'death',
		label: 'Tradycja Śmierci',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia śmierci rządzi śmiertelnością, końcem i ciężarem czasu. Jest subtelna, budzi lęk i ma ostateczny charakter.',
		actionIds: ['attack', 'barrier', 'curse', 'dispel', 'predict', 'senseMagic'],
		signatureEffects: ['Zabójczość', 'Osłabienie', 'Paraliż', 'Sanktuarium'],
		rules: ['Ametystowi czarodzieje powinni pozostawać wierni Shyish i przeciwstawiać się spaczeniu nekromancji.'],
		windName: 'Shyish',
		orderName: 'Zakon Ametystu',
		aliases: ['amethyst wizard', 'lore of death', 'shyish'],
		allowMiscast: true,
		allowOvercast: true,
	},
	shadow: {
		id: 'shadow',
		label: 'Tradycja Cieni',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia cieni nagina percepcję, tajemnice i ukryty ruch. Rozkwita tam, gdzie jest zwodzenie i niepewność.',
		actionIds: ['attack', 'augment', 'barrier', 'curse', 'dispel', 'mask', 'senseMagic'],
		signatureEffects: ['Iluzja', 'Rozmycie', 'Powielenie', 'Dodatkowa iluzja'],
		rules: ['Szarzy czarodzieje Ulgu specjalizują się w ukrywaniu, złudzeniach i trudnej do uchwycenia kontroli pola walki.'],
		windName: 'Ulgu',
		orderName: 'Zakon Szarości',
		aliases: ['grey wizard', 'gray wizard', 'lore of shadows', 'lore of shadow', 'ulgu'],
		allowMiscast: true,
		allowOvercast: true,
	},
	chaos: {
		id: 'chaos',
		label: 'Tradycja Chaosu',
		tradition: 'arcana',
		pathType: 'lore',
		description: 'Magia Chaosu jest nieskrępowana, spacza i niebezpiecznie szeroka. Może sięgnąć niemal wszędzie, ale za wysoką cenę.',
		actionIds: ['attack', 'augment', 'barrier', 'conjure', 'curse', 'dispel', 'mask', 'predict', 'senseMagic', 'transform'],
		signatureEffects: ['Wszystko, na co pozwala tradycja', 'Presja spaczenia', 'Szeroki zakres efektów dodatkowych'],
		rules: ['Użytkownicy magii Chaosu są najbardziej narażeni na spaczenie i podczas gry powinni być traktowani jako szczególne zagrożenie.'],
		windName: 'Spaczone Wiatry',
		orderName: 'Tradycja Chaosu',
		aliases: ['lore of chaos', 'wizard of chaos', 'chaos sorcerer', 'chaos wizard', 'grey seer'],
		allowMiscast: true,
		allowOvercast: true,
	},
	sigmar: {
		id: 'sigmar',
		label: 'Cuda Sigmara',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Sigmara wzmacniają walkę, gniew i słuszną ochronę przed spaczeniem oraz herezją.',
		actionIds: ['attack', 'augment', 'barrier'],
		signatureEffects: ['Atak', 'Błogosławieństwo', 'Świętość', 'Bariera'],
		rules: ['Kapłani Sigmara czynią tylko jego cuda i nie łączą ich z tradycjami czarodziejskimi.'],
		orderName: 'Kult Sigmara',
		aliases: ['priest of sigmar', 'warrior priest', 'warrior priest of sigmar', 'miracles of sigmar', 'cult of sigmar'],
	},
	shallya: {
		id: 'shallya',
		label: 'Cuda Shallyi',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Shallyi są uzdrawiające, miłosierne i ściśle ochronne, a nie agresywne.',
		actionIds: ['augment', 'barrier', 'heal'],
		signatureEffects: ['Uzdrawianie', 'Przywrócenie', 'Boskie zdrowie', 'Sanktuarium'],
		rules: ['Kapłani Shallyi są przede wszystkim uzdrowicielami i z założenia nie korzystają z brutalnych cudów.'],
		orderName: 'Kult Shallyi',
		aliases: ['priest of shallya', 'miracles of shallya', 'cult of shallya'],
	},
	morr: {
		id: 'morr',
		label: 'Cuda Morra',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Morra dotyczą śmierci, ochrony zmarłych i uroczystej obrony przed niespokojnym grobem.',
		actionIds: DIVINE_ACTIONS,
		signatureEffects: ['Klątwa', 'Ochrona przed nieumarłymi', 'Rytuały śmierci'],
		rules: ['Użytkownicy cudów Morra pozostają związani z nim i jego domeną pogrzebową.'],
		orderName: 'Kult Morra',
		aliases: ['priest of morr', 'miracles of morr', 'cult of morr'],
	},
	myrmidia: {
		id: 'myrmidia',
		label: 'Cuda Myrmidii',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Myrmidii sprzyjają dyscyplinie, kunsztowi wojennemu i taktycznej doskonałości.',
		actionIds: DIVINE_ACTIONS,
		signatureEffects: ['Błogosławieństwo', 'Wgląd bitewny', 'Ochrona'],
		rules: ['Cuda Myrmidii pozostają związane z jedną wojskową ścieżką kultu.'],
		orderName: 'Kult Myrmidii',
		aliases: ['priest of myrmidia', 'miracles of myrmidia', 'cult of myrmidia'],
	},
	manann: {
		id: 'manann',
		label: 'Cuda Mananna',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Mananna podkreślają morskie omeny, surową pogodę oraz łaskę albo gniew wód.',
		actionIds: DIVINE_ACTIONS,
		signatureEffects: ['Błogosławieństwo', 'Presja otoczenia', 'Ochrona'],
		rules: ['Użytkownicy cudów Mananna pozostają w jednej tradycji boga mórz.'],
		orderName: 'Kult Mananna',
		aliases: ['priest of manann', 'miracles of manann', 'cult of manann'],
	},
	ranald: {
		id: 'ranald',
		label: 'Cuda Ranalda',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Ranalda są wymykające się, szczęśliwe i trudne do uchwycenia, łącząc przychylność z podstępem.',
		actionIds: DIVINE_ACTIONS,
		signatureEffects: ['Błogosławieństwo', 'Szczęście', 'Manipulacja'],
		rules: ['Użytkownicy cudów Ranalda pozostają związani z jednym bóstwem i opierają się na Mocy Boskiej.'],
		orderName: 'Kult Ranalda',
		aliases: ['priest of ranald', 'miracles of ranald', 'cult of ranald'],
	},
	taal: {
		id: 'taal',
		label: 'Cuda Taala',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Taala kanalizują dzicz, burze i surową siłę świata natury.',
		actionIds: DIVINE_ACTIONS,
		signatureEffects: ['Błogosławieństwo', 'Natura', 'Hart'],
		rules: ['Użytkownicy cudów Taala pozostają przy jednej boskiej ścieżce.'],
		orderName: 'Kult Taala',
		aliases: ['priest of taal', 'miracles of taal', 'cult of taal'],
	},
	rhya: {
		id: 'rhya',
		label: 'Cuda Rhyi',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Rhyi wspierają płodność, ukojenie i ochronną obfitość.',
		actionIds: DIVINE_ACTIONS,
		signatureEffects: ['Uzdrawianie', 'Błogosławieństwo', 'Ochrona'],
		rules: ['Użytkownicy cudów Rhyi pozostają związani z jedną ścieżką kultu i jej uzdrawiającymi motywami.'],
		orderName: 'Kult Rhyi',
		aliases: ['priest of rhya', 'miracles of rhya', 'cult of rhya'],
	},
	ulric: {
		id: 'ulric',
		label: 'Cuda Ulryka',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Ulryka płoną zaciętością, wytrzymałością i drapieżnym duchem.',
		actionIds: DIVINE_ACTIONS,
		signatureEffects: ['Atak', 'Błogosławieństwo', 'Furia bitewna'],
		rules: ['Użytkownicy cudów Ulryka pozostają związani z jednym bóstwem i etosem zimowego wilka.'],
		orderName: 'Kult Ulryka',
		aliases: ['priest of ulric', 'miracles of ulric', 'cult of ulric'],
	},
	verena: {
		id: 'verena',
		label: 'Cuda Vereny',
		tradition: 'divine',
		pathType: 'deity',
		description: 'Cuda Vereny podkreślają prawdę, mądrość, osąd i spokojną opiekuńczą powagę.',
		actionIds: DIVINE_ACTIONS,
		signatureEffects: ['Prekognicja', 'Błogosławieństwo', 'Osąd'],
		rules: ['Cuda Vereny pozostają związane z jednym kultem i jego intelektualno-sądowniczym charakterem.'],
		orderName: 'Kult Vereny',
		aliases: ['priest of verena', 'miracles of verena', 'cult of verena'],
	},
};

function uniqueStrings(values: string[]) {
	return [...new Set(values.filter((value) => !!value))];
}

function normalizeName(value: string) {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function resolveFallbackDefinition(name: string) {
	const normalizedName = normalizeName(name);
	return Object.values(PROFILE_DEFINITIONS).find((definition) => definition.aliases.some((alias) => normalizedName.includes(alias)));
}

function buildCustomProfile(tradition: MagicTradition, specializationName: string, access: MagicAccessData): ResolvedMagicProfile {
	const pathType = DEFAULT_PATH_TYPES[tradition];
	const pathLabel =
		pathType === 'lore'
			? access.lore.trim() || 'Własna tradycja'
			: pathType === 'deity'
				? access.deity.trim() || 'Własne bóstwo'
				: TRADITION_LABELS[tradition];

	return {
		enabled: true,
		specializationName,
		matchedBy: 'custom',
		tradition,
		traditionLabel: TRADITION_LABELS[tradition],
		pathType,
		pathLabel,
		schoolId: null,
		description: `Magia ${TRADITION_LABELS[tradition]} odblokowana przez konfigurację specjalizacji.`,
		primarySkillName: PRIMARY_SKILL_NAMES[tradition],
		allowMiscast: access.allowMiscast || tradition === 'arcana',
		allowOvercast: access.allowOvercast || tradition === 'arcana',
		actionIds: DEFAULT_ACTIONS_BY_TRADITION[tradition],
		signatureEffects: [],
		rules: GENERIC_RULES_BY_TRADITION[tradition],
		windName: null,
		orderName: null,
	};
}

function buildProfileFromDefinition(definition: MagicProfileDefinition, specializationName: string, matchedBy: ResolvedMagicProfile['matchedBy']): ResolvedMagicProfile {
	return {
		enabled: true,
		specializationName,
		matchedBy,
		tradition: definition.tradition,
		traditionLabel: TRADITION_LABELS[definition.tradition],
		pathType: definition.pathType,
		pathLabel: definition.label,
		schoolId: definition.id,
		description: definition.description,
		primarySkillName: PRIMARY_SKILL_NAMES[definition.tradition],
		allowMiscast: definition.allowMiscast ?? definition.tradition === 'arcana',
		allowOvercast: definition.allowOvercast ?? definition.tradition === 'arcana',
		actionIds: definition.actionIds,
		signatureEffects: definition.signatureEffects,
		rules: uniqueStrings([...GENERIC_RULES_BY_TRADITION[definition.tradition], ...definition.rules]),
		windName: definition.windName ?? null,
		orderName: definition.orderName ?? null,
	};
}

function mergeMagicAccess(access?: Partial<MagicAccessData>): MagicAccessData {
	return {
		...EMPTY_MAGIC_ACCESS,
		...access,
	};
}

export function findMagicSpecialization<T extends SpecializationLike>(specializations: Iterable<T | null | undefined>): T | null {
	for (const specialization of specializations) {
		if (!specialization) {
			continue;
		}

		if (resolveMagicProfileFromSpecialization(specialization).enabled) {
			return specialization;
		}
	}

	return null;
}

export function resolveMagicProfileFromSpecializations<T extends SpecializationLike>(specializations: Iterable<T | null | undefined>): ResolvedMagicProfile {
	return resolveMagicProfileFromSpecialization(findMagicSpecialization(specializations));
}

export function getMagicSchoolOptions(tradition?: MagicTradition | '') {
	const filterTradition = tradition && (MAGIC_TRADITIONS as readonly string[]).includes(tradition) ? tradition : undefined;
	return MAGIC_SCHOOL_IDS.map((schoolId) => PROFILE_DEFINITIONS[schoolId])
		.filter((definition) => !filterTradition || definition.tradition === filterTradition)
		.map((definition) => ({
			value: definition.id,
			label: definition.label,
		}));
}

export function getMagicActionDefinitions(actionIds: MagicActionId[]) {
	return actionIds.map((actionId) => MAGIC_ACTIONS[actionId]).filter((action): action is MagicActionDefinition => action !== undefined);
}

export function resolveMagicProfileFromSpecialization(specialization?: SpecializationLike | null): ResolvedMagicProfile {
	if (!specialization) {
		return {
			enabled: false,
			specializationName: null,
			matchedBy: 'none',
			tradition: null,
			traditionLabel: null,
			pathType: null,
			pathLabel: null,
			schoolId: null,
			description: null,
			primarySkillName: null,
			allowMiscast: false,
			allowOvercast: false,
			actionIds: [],
			signatureEffects: [],
			rules: [],
			windName: null,
			orderName: null,
		};
	}

	const access = mergeMagicAccess(specialization.systemData?.magicAccess);
	if (access.enabled) {
		const definition = access.school ? PROFILE_DEFINITIONS[access.school as MagicSchoolId] : undefined;
		const tradition = access.tradition || definition?.tradition;
		if (tradition) {
			if (definition) {
				const resolved = buildProfileFromDefinition(definition, specialization.name, 'explicit');
				const overridePathLabel = access.lore.trim() || access.deity.trim();
				return {
					...resolved,
					pathLabel: overridePathLabel || resolved.pathLabel,
					allowMiscast: access.allowMiscast || resolved.allowMiscast,
					allowOvercast: access.allowOvercast || resolved.allowOvercast,
				};
			}

			return buildCustomProfile(tradition, specialization.name, access);
		}
	}

	return {
		enabled: false,
		specializationName: specialization.name,
		matchedBy: 'none',
		tradition: null,
		traditionLabel: null,
		pathType: null,
		pathLabel: null,
		schoolId: null,
		description: null,
		primarySkillName: null,
		allowMiscast: false,
		allowOvercast: false,
		actionIds: [],
		signatureEffects: [],
		rules: [],
		windName: null,
		orderName: null,
	};
}

export function collectMagicSkills(items: Iterable<SkillLike>, primarySkillName?: string | null): MagicSkillSummary[] {
	const primarySkillNames = getMagicSkillNameAliases(primarySkillName);
	const normalizedPrimarySkills = new Set(primarySkillNames.map((name) => name.toLowerCase()));
	const knownMagicSkillNames = new Set(Object.values(PRIMARY_SKILL_ALIASES).flat().map((name) => name.toLowerCase()));

	return Array.from(items)
		.filter((item) => item.type === 'skill')
		.filter((item) => item.systemData?.category === 'magic' || knownMagicSkillNames.has(item.name.toLowerCase()))
		.map((item) => ({
			id: item.id,
			name: item.name,
			rank: item.systemData?.rank ?? 0,
			characteristic: item.systemData?.characteristic ?? 'intellect',
			isPrimary: normalizedPrimarySkills.has(item.name.toLowerCase()),
		}))
		.sort((left, right) => {
			if (left.isPrimary !== right.isPrimary) {
				return left.isPrimary ? -1 : 1;
			}

			return left.name.localeCompare(right.name);
		});
}

export function hasMagicRank(skills: MagicSkillSummary[], primarySkillName?: string | null) {
	const primarySkillNames = getMagicSkillNameAliases(primarySkillName);
	if (!primarySkillNames.length) {
		return false;
	}

	const normalizedPrimarySkills = new Set(primarySkillNames.map((name) => name.toLowerCase()));
	return skills.some((skill) => normalizedPrimarySkills.has(skill.name.toLowerCase()) && skill.rank > 0);
}

export function getMagicSkillNameAliases(primarySkillName?: string | null): string[] {
	if (!primarySkillName) {
		return [];
	}

	const normalizedName = primarySkillName.toLowerCase();
	for (const aliases of Object.values(PRIMARY_SKILL_ALIASES)) {
		if (aliases.some((alias) => alias.toLowerCase() === normalizedName)) {
			return aliases;
		}
	}

	return [primarySkillName];
}

export function getMagicSchoolLabel(schoolId: MagicSchoolId) {
	return PROFILE_DEFINITIONS[schoolId]?.label ?? schoolId;
}

export const MAGIC_ACTION_LIST = MAGIC_ACTION_IDS;



