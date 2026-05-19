import { MAGIC_ACTION_IDS, type MagicActionId, type MagicSchoolId, type MagicTradition } from '@/magic/MagicConstants';

export type MagicActionAvailabilityContext = {
	tradition?: MagicTradition | null;
	schoolId?: MagicSchoolId | null;
};

export type MagicActionEffectDefinition = {
	id: string;
	label: string;
	description: string;
	difficulty: number;
	usesKnowledgeRank?: boolean;
	attackProfile?: {
		critical?: number;
		damageCharacteristicMultiplier?: number;
		qualities?: Array<{
			name: string;
			isRated?: boolean;
			rating?: number | 'skillRank' | 'knowledgeRank';
		}>;
	};
	repeatable?: boolean;
	oldWorldOnly?: boolean;
	allowedTraditions?: MagicTradition[];
	allowedSchools?: MagicSchoolId[];
	incompatibleWith?: string[];
};

export type MagicActionRuleDefinition = {
	actionId: MagicActionId;
	baseDifficulty: number;
	promptHint?: string;
	effectDefinitions: MagicActionEffectDefinition[];
};

export type MagicActionSelection = Record<string, number>;

export type SelectedMagicActionEffect = MagicActionEffectDefinition & {
	count: number;
	totalDifficulty: number;
	selectionLabel: string;
};

export type MagicActionSelectionSummary = {
	baseDifficulty: number;
	addedDifficulty: number;
	totalDifficulty: number;
	difficultyString: string;
	selectedEffects: SelectedMagicActionEffect[];
	incompatiblePairs: Array<{ left: SelectedMagicActionEffect; right: SelectedMagicActionEffect }>;
	exceedsDifficultyCap: boolean;
};

export const MAX_MAGIC_DIFFICULTY = 5;

const OLD_WORLD_TABLE_SCHOOL_IDS: MagicSchoolId[] = ['heavens', 'fire', 'metal', 'beasts', 'life', 'light', 'death', 'shadow', 'chaos', 'sigmar', 'shallya'];

// Table 4-1 from Old World pages 117-118. For listed Old World schools, this
// matrix is authoritative and overrides the broader Genesys defaults below.
const OLD_WORLD_EFFECT_SCHOOLS: Partial<Record<MagicActionId, Record<string, MagicSchoolId[]>>> = {
	attack: {
		blast: ['heavens', 'fire', 'metal', 'life', 'light', 'death', 'shadow', 'chaos'],
		closeCombat: ['fire', 'metal', 'beasts', 'life', 'light', 'death', 'chaos', 'sigmar'],
		deadly: ['heavens', 'fire', 'metal', 'beasts', 'death', 'shadow', 'chaos', 'sigmar'],
		fire: ['fire', 'chaos'],
		holyUnholy: ['light', 'death', 'sigmar'],
		ice: ['life', 'death'],
		impact: ['heavens', 'metal', 'beasts', 'chaos', 'sigmar'],
		lightning: ['heavens'],
		manipulative: ['heavens', 'metal', 'life', 'death', 'chaos'],
		nonLethal: ['heavens', 'metal', 'beasts', 'life', 'light', 'death', 'shadow', 'chaos'],
		range: ['heavens', 'fire', 'metal', 'beasts', 'life', 'light', 'death', 'shadow', 'chaos', 'sigmar'],
		destructive: ['fire', 'metal', 'beasts', 'light', 'chaos'],
		empowered: ['heavens', 'fire', 'metal', 'beasts', 'light', 'death', 'chaos', 'sigmar'],
		poisonous: ['beasts', 'death', 'chaos'],
	},
	augment: {
		divineHealth: ['metal', 'life', 'light', 'sigmar', 'shallya'],
		haste: ['heavens', 'fire', 'beasts', 'light', 'chaos', 'sigmar', 'shallya'],
		primalFury: ['beasts', 'chaos'],
		range: ['heavens', 'fire', 'metal', 'life', 'light', 'shadow', 'chaos', 'shallya'],
		swift: ['heavens', 'beasts', 'life', 'light', 'chaos'],
		enchantWeapon: ['fire', 'metal', 'life', 'chaos'],
		blessing: ['light', 'sigmar', 'shallya'],
		additionalTarget: ['heavens', 'fire', 'metal', 'beasts', 'life', 'light', 'chaos', 'sigmar', 'shallya'],
	},
	barrier: {
		additionalTarget: ['heavens', 'fire', 'metal', 'life', 'death', 'chaos', 'shallya'],
		range: ['heavens', 'fire', 'metal', 'life', 'chaos', 'shallya'],
		addDefense: ['heavens', 'fire', 'metal', 'life', 'shadow', 'chaos', 'sigmar'],
		empowered: ['heavens', 'metal', 'life', 'chaos', 'shallya'],
		reflection: ['chaos'],
		deflection: ['fire', 'metal', 'beasts', 'chaos'],
		sanctuary: ['death', 'shallya'],
	},
	conjure: {
		additionalSummon: ['metal', 'beasts', 'chaos'],
		mediumSummon: ['metal', 'beasts', 'chaos'],
		range: ['metal', 'beasts', 'life', 'chaos'],
		summonAlly: ['metal', 'beasts', 'chaos'],
		grandSummon: ['metal', 'beasts', 'chaos'],
	},
	curse: {
		enervate: ['fire', 'metal', 'light', 'death', 'shadow', 'chaos'],
		misfortune: ['heavens', 'chaos'],
		range: ['heavens', 'fire', 'metal', 'light', 'death', 'shadow', 'chaos'],
		additionalTarget: ['heavens', 'fire', 'metal', 'death', 'chaos'],
		despair: ['death', 'chaos'],
		doom: ['heavens', 'chaos'],
		paralyzed: ['metal', 'light', 'death', 'chaos'],
	},
	dispel: {
		range: ['heavens', 'fire', 'metal', 'beasts', 'life', 'light', 'death', 'shadow', 'chaos'],
		additionalTarget: ['heavens', 'fire', 'metal', 'beasts', 'life', 'light', 'death', 'shadow', 'chaos'],
	},
	heal: {
		additionalTarget: ['life', 'light', 'shallya'],
		range: ['life', 'light', 'shallya'],
		restoration: ['life', 'shallya'],
		healCritical: [],
		reviveIncapacitated: [],
		resurrection: [],
	},
	mask: {
		blur: ['shadow', 'chaos'],
		mirrorImage: ['shadow', 'chaos'],
		additionalIllusion: ['shadow', 'chaos'],
		range: ['shadow', 'chaos'],
		size: ['shadow', 'chaos'],
		realism: ['shadow', 'chaos'],
		terror: ['shadow', 'chaos'],
		invisibility: [],
	},
	predict: {
		quicksilverReflexes: ['heavens', 'chaos'],
		scry: ['heavens', 'death', 'chaos'],
		empowered: ['heavens'],
		additionalQuestions: ['heavens', 'death'],
		changeTarget: ['heavens'],
		flashOfPrecognition: ['heavens', 'chaos'],
		cheatDeath: ['heavens'],
	},
	senseMagic: {
		scatter: ['heavens', 'fire', 'metal', 'beasts', 'life', 'light', 'death', 'shadow', 'chaos'],
		attunement: ['heavens', 'fire', 'metal', 'beasts', 'life', 'light', 'death', 'shadow', 'chaos'],
		harmony: ['heavens', 'fire', 'metal', 'beasts', 'life', 'light', 'death', 'shadow'],
	},
	transform: {
		silhouetteIncrease: ['beasts', 'chaos'],
		characteristicRetention: ['beasts', 'chaos'],
		transformGear: ['beasts', 'chaos'],
		direForm: ['beasts', 'chaos'],
		curseOfTheWild: ['beasts'],
	},
};

function effect(definition: MagicActionEffectDefinition): MagicActionEffectDefinition {
	return definition;
}

function normalizeSelectionCount(value: number | undefined) {
	if (!Number.isFinite(value)) {
		return 0;
	}

	const safeValue = value ?? 0;
	return Math.max(0, Math.floor(safeValue));
}

function toSelectionLabel(effectDefinition: MagicActionEffectDefinition, count: number) {
	return count > 1 ? `${effectDefinition.label} x${count}` : effectDefinition.label;
}

function isEffectAvailable(actionId: MagicActionId, effectDefinition: MagicActionEffectDefinition, context?: MagicActionAvailabilityContext) {
	if (!context) {
		return true;
	}

	if (context.schoolId && OLD_WORLD_TABLE_SCHOOL_IDS.includes(context.schoolId)) {
		const allowedSchools = OLD_WORLD_EFFECT_SCHOOLS[actionId]?.[effectDefinition.id];
		if (allowedSchools) {
			return allowedSchools.includes(context.schoolId);
		}
	}

	if (effectDefinition.allowedTraditions?.length && (!context.tradition || !effectDefinition.allowedTraditions.includes(context.tradition))) {
		return false;
	}

	if (effectDefinition.allowedSchools?.length && (!context.schoolId || !effectDefinition.allowedSchools.includes(context.schoolId))) {
		return false;
	}

	return true;
}

const MAGIC_ACTION_RULES: Record<MagicActionId, MagicActionRuleDefinition> = {
	attack: {
		actionId: 'attack',
		baseDifficulty: 1,
		effectDefinitions: [
			effect({
				id: 'blast',
				label: 'Pole rażenia',
				description: 'Atak zyskuje Pole rażenia równe rangom wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 1,
				usesKnowledgeRank: true,
				attackProfile: { qualities: [{ name: 'Pole Rażenia', rating: 'knowledgeRank' }] },
			}),
			effect({ id: 'closeCombat', label: 'Walka w zwarciu', description: 'Czar może wybrać za cel osobę znajdującą się w zwarciu z rzucającym.', difficulty: 1 }),
			effect({
				id: 'deadly',
				label: 'Zabójczość',
				description: 'Atak zyskuje Kryt. 2 oraz Morderczość równą rangom wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 1,
				usesKnowledgeRank: true,
				attackProfile: {
					critical: 2,
					qualities: [{ name: 'Morderczość', rating: 'knowledgeRank' }],
				},
			}),
			effect({
				id: 'fire',
				label: 'Ogień',
				description: 'Atak zyskuje Zapalanie równe rangom wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 1,
				usesKnowledgeRank: true,
				attackProfile: { qualities: [{ name: 'Zapalanie', rating: 'knowledgeRank' }] },
			}),
			effect({
				id: 'holyUnholy',
				label: 'Świętość',
				description: 'Sukcesy przeciw celowi będącemu przeciwieństwem wiary rzucającego zadają +2 obrażenia zamiast +1.',
				difficulty: 1,
				allowedTraditions: ['divine'],
			}),
			effect({
				id: 'ice',
				label: 'Lód',
				description: 'Atak zyskuje Unieruchomienie równe rangom wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 1,
				usesKnowledgeRank: true,
				attackProfile: { qualities: [{ name: 'Usidlenie', rating: 'knowledgeRank' }] },
			}),
			effect({
				id: 'impact',
				label: 'Uderzenie',
				description: 'Atak zyskuje Powalenie oraz Dezorientację równą rangom wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 1,
				usesKnowledgeRank: true,
				attackProfile: {
					qualities: [
						{ name: 'Powalenie', isRated: false },
						{ name: 'Dezorientacja', rating: 'knowledgeRank' },
					],
				},
			}),
			effect({
				id: 'lightning',
				label: 'Błyskawica',
				description: 'Atak zyskuje Ogłuszenie równe rangom wybranej umiejętności Wiedzy rzucającego oraz Serię.',
				difficulty: 1,
				usesKnowledgeRank: true,
				attackProfile: {
					qualities: [
						{ name: 'Ogłuszenie', rating: 'knowledgeRank' },
						{ name: 'Seria', isRated: false },
					],
				},
			}),
			effect({
				id: 'manipulative',
				label: 'Manipulacja',
				description: 'Po trafieniu rzucający może wydać Przewagę, aby przesunąć cel o jeden przedział zasięgu.',
				difficulty: 1,
				allowedTraditions: ['arcana'],
			}),
			effect({
				id: 'nonLethal',
				label: 'Złagodzenie',
				description: 'Atak zyskuje obrażenia od Napięcia.',
				difficulty: 1,
				attackProfile: { qualities: [{ name: 'Obrażenia Ogłuszające', isRated: false }] },
				allowedTraditions: ['primal'],
			}),
			effect({ id: 'range', label: 'Zasięg', description: 'Zwiększ zasięg czaru o jeden przedział.', difficulty: 1, repeatable: true }),
			effect({
				id: 'destructive',
				label: 'Destrukcyjność',
				description: 'Atak zyskuje Niszczenie oraz Przebicie równe rangom wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 2,
				usesKnowledgeRank: true,
				attackProfile: {
					qualities: [
						{ name: 'Niszczenie', isRated: false },
						{ name: 'Przebicie', rating: 'knowledgeRank' },
					],
				},
			}),
			effect({
				id: 'empowered',
				label: 'Wzmocnienie',
				description: 'Czar zadaje obrażenia równe podwojonej powiązanej cesze, a Pole rażenia obejmuje zasięg bliski.',
				difficulty: 2,
				attackProfile: { damageCharacteristicMultiplier: 2 },
			}),
			effect({
				id: 'poisonous',
				label: 'Trucizna',
				description: 'Zranione cele muszą wykonać Trudny test Odporności albo otrzymują rany i zmęczenie równe rangom wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 2,
				usesKnowledgeRank: true,
			}),
		],
	},
	augment: {
		actionId: 'augment',
		baseDifficulty: 2,
		effectDefinitions: [
			effect({
				id: 'divineHealth',
				label: 'Boskie zdrowie',
				description: 'Na czas trwania czaru cel zwiększa próg ran o rangi wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 1,
				usesKnowledgeRank: true,
				allowedTraditions: ['divine'],
			}),
			effect({ id: 'haste', label: 'Przyspieszenie', description: 'Dotknięte cele mogą co turę wykonać drugi manewr bez otrzymywania napięcia.', difficulty: 1 }),
			effect({
				id: 'primalFury',
				label: 'Pierwotna furia',
				description: 'Cel dodaje rangi wybranej umiejętności Wiedzy rzucającego do obrażeń bez broni, a jego Kryt. bez broni wynosi 3.',
				difficulty: 1,
				usesKnowledgeRank: true,
				allowedTraditions: ['primal'],
			}),
			effect({ id: 'range', label: 'Zasięg', description: 'Zwiększ zasięg czaru o jeden przedział.', difficulty: 1, repeatable: true }),
			effect({ id: 'swift', label: 'Szybkość', description: 'Dotknięte cele ignorują trudny teren i nie mogą zostać unieruchomione.', difficulty: 1 }),
			effect({ id: 'additionalTarget', label: 'Dodatkowy cel', description: 'Obejmij działaniem jeden dodatkowy cel w zasięgu.', difficulty: 2, repeatable: true }),
			effect({
				id: 'blessing',
				label: 'Błogosławieństwo',
				description: 'Przeciw celowi będącemu przeciwieństwem bóstwa rzucającego każdy Sukces przy obrażeniach daje +2 zamiast +1.',
				difficulty: 2,
				oldWorldOnly: true,
				allowedTraditions: ['divine'],
			}),
			effect({
				id: 'enchantWeapon',
				label: 'Zaklęta broń',
				description: 'Cel dodaje rangi Wiedzy (Chaos) albo Dyscypliny rzucającego do obrażeń w walce bronią.',
				difficulty: 2,
				oldWorldOnly: true,
				allowedTraditions: ['arcana', 'divine'],
			}),
		],
	},
	barrier: {
		actionId: 'barrier',
		baseDifficulty: 1,
		effectDefinitions: [
			effect({ id: 'additionalTarget', label: 'Dodatkowy cel', description: 'Obejmij działaniem jeden dodatkowy cel w zasięgu.', difficulty: 1, repeatable: true }),
			effect({ id: 'range', label: 'Zasięg', description: 'Zwiększ zasięg czaru o jeden przedział.', difficulty: 1, repeatable: true }),
			effect({ id: 'addDefense', label: 'Dodatkowa obrona', description: 'Dotknięte cele zyskują obronę dystansową i wręcz równą rangom wybranej umiejętności Wiedzy rzucającego.', difficulty: 2, usesKnowledgeRank: true }),
			effect({ id: 'empowered', label: 'Wzmocnienie', description: 'Bariera zmniejsza obrażenia o nieskasowane Sukcesy zamiast o wartość domyślną.', difficulty: 2 }),
			effect({
				id: 'reflection',
				label: 'Odbicie',
				description: 'Ataki magiczne, które przeciw dotkniętemu celowi wygenerują trzy Zagrożenia albo jedną Rozpacz, odbijają się po rozpatrzeniu.',
				difficulty: 2,
				allowedTraditions: ['arcana'],
			}),
			effect({
				id: 'sanctuary',
				label: 'Sanktuarium',
				description: 'Wrogowie będący przeciwieństwem wiary rzucającego automatycznie opuszczają zwarcie i nie mogą wejść w zwarcie z dotkniętymi celami przez czas trwania czaru.',
				difficulty: 2,
				allowedTraditions: ['divine'],
			}),
			effect({
				id: 'deflection',
				label: 'Odwrócenie',
				description: 'Atakujący wręcz, którzy wygenerują trzy Zagrożenia albo jedną Rozpacz, otrzymują rany równe podwojonym rangom odpowiedniej umiejętności magicznej rzucającego.',
				difficulty: 2,
				oldWorldOnly: true,
				allowedTraditions: ['arcana', 'divine'],
			}),
		],
	},
	conjure: {
		actionId: 'conjure',
		baseDifficulty: 1,
		effectDefinitions: [
			effect({ id: 'additionalSummon', label: 'Dodatkowe przywołanie', description: 'Przywołaj jeden dodatkowy przedmiot, broń albo istotę.', difficulty: 1, repeatable: true }),
			effect({ id: 'mediumSummon', label: 'Średnie przywołanie', description: 'Przywołaj bardziej złożone narzędzie, broń dwuręczną albo rywala nie większego niż sylwetka 1.', difficulty: 1 }),
			effect({ id: 'range', label: 'Zasięg', description: 'Zwiększ zasięg pojawienia się o jeden przedział.', difficulty: 1, repeatable: true }),
			effect({ id: 'summonAlly', label: 'Przywołanie sojusznika', description: 'Przywołane istoty są przyjazne i można nimi kierować za pomocą manewru.', difficulty: 1 }),
			effect({ id: 'grandSummon', label: 'Imponujące przywołanie', description: 'Przywołaj rywala o sylwetce do 3.', difficulty: 2 }),
		],
	},
	curse: {
		actionId: 'curse',
		baseDifficulty: 2,
		effectDefinitions: [
			effect({ id: 'enervate', label: 'Osłabienie', description: 'Za każdym razem, gdy cel otrzymuje zmęczenie, otrzymuje 1 dodatkowe zmęczenie.', difficulty: 1 }),
			effect({ id: 'misfortune', label: 'Pech', description: 'Po wykonaniu testu przez cel jedną Przewagę można zmienić w Sukces.', difficulty: 1 }),
			effect({ id: 'range', label: 'Zasięg', description: 'Zwiększ zasięg czaru o jeden przedział.', difficulty: 1, repeatable: true }),
			effect({ id: 'additionalTarget', label: 'Dodatkowy cel', description: 'Obejmij działaniem jeden dodatkowy cel w zasięgu.', difficulty: 2, repeatable: true }),
			effect({
				id: 'despair',
				label: 'Rozpacz',
				description: 'Zmniejsz próg ran i próg zmęczenia celu o rangi wybranej umiejętności Wiedzy rzucającego.',
				difficulty: 2,
				usesKnowledgeRank: true,
				allowedTraditions: ['divine'],
				incompatibleWith: ['additionalTarget'],
			}),
			effect({
				id: 'doom',
				label: 'Fatum',
				description: 'Po wykonaniu testu przez cel zmień jeden wynik kości, który nie pokazuje Triumfu ani Rozpaczy, na inną ściankę.',
				difficulty: 2,
				allowedTraditions: ['arcana'],
			}),
			effect({
				id: 'paralyzed',
				label: 'Paraliż',
				description: 'Cel jest zachwiany przez czas trwania czaru.',
				difficulty: 3,
				incompatibleWith: ['additionalTarget'],
			}),
		],
	},
	dispel: {
		actionId: 'dispel',
		baseDifficulty: 3,
		effectDefinitions: [
			effect({ id: 'range', label: 'Zasięg', description: 'Zwiększ zasięg czaru o jeden przedział.', difficulty: 1, repeatable: true }),
			effect({ id: 'additionalTarget', label: 'Dodatkowy cel', description: 'Obejmij działaniem jeden dodatkowy cel w zasięgu.', difficulty: 2, repeatable: true }),
		],
	},
	heal: {
		actionId: 'heal',
		baseDifficulty: 1,
		effectDefinitions: [
			effect({ id: 'additionalTarget', label: 'Dodatkowy cel', description: 'Obejmij działaniem jeden dodatkowy cel w zasięgu.', difficulty: 1, repeatable: true }),
			effect({ id: 'range', label: 'Zasięg', description: 'Zwiększ zasięg czaru o jeden przedział.', difficulty: 1, repeatable: true }),
			effect({ id: 'restoration', label: 'Przywrócenie', description: 'Natychmiast zakończ jeden trwający efekt stanu działający na cel.', difficulty: 1 }),
			effect({ id: 'healCritical', label: 'Leczenie urazu', description: 'Jeśli czar się powiedzie, wylecz jeden uraz krytyczny celu.', difficulty: 2 }),
			effect({ id: 'reviveIncapacitated', label: 'Ocucenie obezwładnionego', description: 'Czar może wybrać za cel obezwładnione postacie.', difficulty: 2 }),
			effect({ id: 'resurrection', label: 'Wskrzeszenie', description: 'Czar może wybrać za cel kogoś, kto zginął podczas tego starcia.', difficulty: 4 }),
		],
	},
	utility: {
		actionId: 'utility',
		baseDifficulty: 1,
		promptHint: 'Magia użytkowa ma głównie charakter narracyjny, więc skorzystaj z bazowego czaru i ręcznie zmień pulę kości tylko wtedy, gdy stół tego potrzebuje.',
		effectDefinitions: [],
	},
	mask: {
		actionId: 'mask',
		baseDifficulty: 1,
		effectDefinitions: [
			effect({ id: 'blur', label: 'Rozmycie', description: 'Testy bojowe przeciw postaci okrytej iluzją dodają Zagrożenie.', difficulty: 1 }),
			effect({ id: 'mirrorImage', label: 'Powielenie', description: 'Atakujący, którzy wygenerują trzy Zagrożenia albo jedną Rozpacz, mogą zamiast celu trafić iluzję.', difficulty: 1 }),
			effect({ id: 'additionalIllusion', label: 'Dodatkowa iluzja', description: 'Stwórz jedną dodatkową iluzję albo zamaskuj jedną dodatkową postać.', difficulty: 1, repeatable: true }),
			effect({ id: 'range', label: 'Zasięg', description: 'Zwiększ zasięg czaru o jeden przedział.', difficulty: 1, repeatable: true }),
			effect({ id: 'size', label: 'Rozmiar', description: 'Zwiększ sylwetkę iluzji albo zamaskowanego celu o jeden.', difficulty: 1, repeatable: true }),
			effect({ id: 'realism', label: 'Realizm', description: 'Zwiększ trudność testów pozwalających rozpoznać, że iluzja jest fałszywa.', difficulty: 1, repeatable: true }),
			effect({ id: 'terror', label: 'Terror', description: 'Każdy, kto zobaczy iluzję, musi wykonać Trudny test Strachu.', difficulty: 2 }),
			effect({ id: 'invisibility', label: 'Niewidzialność', description: 'Spraw, że cel stanie się niewidzialny, zamiast jedynie zmieniać jego wygląd.', difficulty: 3 }),
		],
	},
	predict: {
		actionId: 'predict',
		baseDifficulty: 2,
		effectDefinitions: [
			effect({ id: 'quicksilverReflexes', label: 'Błyskawiczny refleks', description: 'Zamiast zadawać pytanie albo zmieniać los, dodaj Sukcesy do następnego rzutu na inicjatywę.', difficulty: 0 }),
			effect({ id: 'scry', label: 'Wróżba', description: 'Zlokalizuj znany przedmiot o sylwetce 0 w zasięgu dalekim.', difficulty: 1 }),
			effect({ id: 'empowered', label: 'Wzmocnienie', description: 'Pytaj o wydarzenia do następnego miesiąca albo zmieniaj szerszy zakres ścianek kości podczas ingerencji w los.', difficulty: 1 }),
			effect({ id: 'additionalQuestions', label: 'Dodatkowe pytania', description: 'Zadaj jedno dodatkowe pytanie o przyszłość.', difficulty: 1, repeatable: true }),
			effect({ id: 'changeTarget', label: 'Zmiana celu', description: 'Pytaj albo zmieniaj los w imieniu innej postaci biorącej udział w starciu.', difficulty: 1 }),
			effect({ id: 'flashOfPrecognition', label: 'Przebłysk przyszłości', description: 'Dodaj dodatkowe Sukcesy do jednego testu rzucającego i Porażki do jednego testu wymierzonego w niego.', difficulty: 2 }),
			effect({ id: 'cheatDeath', label: 'Uniknięcie śmierci', description: 'Przewidź śmiertelny moment i później wydaj Punkt Opowieści, aby go przetrwać.', difficulty: 3 }),
		],
	},
	senseMagic: {
		actionId: 'senseMagic',
		baseDifficulty: 1,
		effectDefinitions: [
			effect({ id: 'scatter', label: 'Rozwianie', description: 'Wybierz tradycję magii; czary z tej tradycji kosztują w tym starciu 1 dodatkowe zmęczenie.', difficulty: 1 }),
			effect({ id: 'attunement', label: 'Dostrojenie', description: 'Czarów z wybranej tradycji nie można rozproszyć i ignorują Przeciwzaklęcie.', difficulty: 2 }),
			effect({ id: 'harmony', label: 'Harmonia', description: 'Po rzuceniu czaru wydaj Przewagę, aby dodać Sukces do późniejszych testów magii w tym starciu.', difficulty: 2 }),
		],
	},
	transform: {
		actionId: 'transform',
		baseDifficulty: 2,
		effectDefinitions: [
			effect({ id: 'silhouetteIncrease', label: 'Zwiększony rozmiar', description: 'Przemień się w zwierzę o jedną sylwetkę większe.', difficulty: 1, repeatable: true }),
			effect({ id: 'characteristicRetention', label: 'Zachowanie cech', description: 'Podczas przemiany zachowaj Intelekt i Siłę woli rzucającego.', difficulty: 1 }),
			effect({ id: 'transformGear', label: 'Przemiana sprzętu', description: 'Noszony sprzęt i dzierżone przedmioty znikają w przemienionym ciele i wracają po odwróceniu przemiany.', difficulty: 1 }),
			effect({ id: 'direForm', label: 'Straszliwa forma', description: 'Przyjmij groźną odmianę wybranej bestii, zwiększając obrażenia, wytrzymałość, rany i sylwetkę.', difficulty: 1 }),
			effect({ id: 'curseOfTheWild', label: 'Przekleństwo dziczy', description: 'Przemień cel w zasięgu bliskim zamiast rzucającego.', difficulty: 3 }),
		],
	},
};

export function getMagicActionRuleDefinition(actionId: MagicActionId) {
	return MAGIC_ACTION_RULES[actionId];
}

export function getMagicActionEffectDefinitions(actionId: MagicActionId, context?: MagicActionAvailabilityContext) {
	return getMagicActionRuleDefinition(actionId).effectDefinitions.filter((effectDefinition) => isEffectAvailable(actionId, effectDefinition, context));
}

export function buildMagicDifficultyString(rank: number) {
	return 'D'.repeat(Math.max(0, rank));
}

export function getMagicDifficultyLabelKey(rank: number) {
	switch (rank) {
		case 0:
			return 'Genesys.Difficulty.Simple';
		case 1:
			return 'Genesys.Difficulty.Easy';
		case 2:
			return 'Genesys.Difficulty.Average';
		case 3:
			return 'Genesys.Difficulty.Hard';
		case 4:
			return 'Genesys.Difficulty.Daunting';
		default:
			return 'Genesys.Difficulty.Formidable';
	}
}

export function summarizeMagicActionSelection(actionRules: MagicActionRuleDefinition, effectDefinitions: MagicActionEffectDefinition[], selection: MagicActionSelection): MagicActionSelectionSummary {
	const selectedEffects = effectDefinitions
		.map((effectDefinition) => {
			const count = normalizeSelectionCount(selection[effectDefinition.id]);
			if (count === 0) {
				return null;
			}

			return {
				...effectDefinition,
				count,
				totalDifficulty: effectDefinition.difficulty * count,
				selectionLabel: toSelectionLabel(effectDefinition, count),
			} as SelectedMagicActionEffect;
		})
		.filter((effectDefinition): effectDefinition is SelectedMagicActionEffect => effectDefinition !== null);

	const selectedById = new Map(selectedEffects.map((effectDefinition) => [effectDefinition.id, effectDefinition]));
	const incompatiblePairs: MagicActionSelectionSummary['incompatiblePairs'] = [];
	const seenPairs = new Set<string>();

	for (const effectDefinition of selectedEffects) {
		for (const incompatibleId of effectDefinition.incompatibleWith ?? []) {
			const incompatibleEffect = selectedById.get(incompatibleId);
			if (!incompatibleEffect) {
				continue;
			}

			const pairKey = [effectDefinition.id, incompatibleEffect.id].sort().join(':');
			if (seenPairs.has(pairKey)) {
				continue;
			}

			seenPairs.add(pairKey);
			incompatiblePairs.push({ left: effectDefinition, right: incompatibleEffect });
		}
	}

	const addedDifficulty = selectedEffects.reduce((total, effectDefinition) => total + effectDefinition.totalDifficulty, 0);
	const totalDifficulty = actionRules.baseDifficulty + addedDifficulty;

	return {
		baseDifficulty: actionRules.baseDifficulty,
		addedDifficulty,
		totalDifficulty,
		difficultyString: buildMagicDifficultyString(totalDifficulty),
		selectedEffects,
		incompatiblePairs,
		exceedsDifficultyCap: totalDifficulty > MAX_MAGIC_DIFFICULTY,
	};
}

export function buildMagicActionChatLabel(actionLabel: string, summary: MagicActionSelectionSummary) {
	return summary.selectedEffects.length === 0 ? actionLabel : `${actionLabel}: ${summary.selectedEffects.map((effectDefinition) => effectDefinition.selectionLabel).join(', ')}`;
}

export const MAGIC_ACTION_RULE_LIST = MAGIC_ACTION_IDS.map((actionId) => MAGIC_ACTION_RULES[actionId]);

