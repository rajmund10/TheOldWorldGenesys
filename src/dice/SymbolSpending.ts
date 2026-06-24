import GenesysActor from '@/actor/GenesysActor';
import { resolveCritical } from '@/combat/AttackResolution';
import type { GenesysRollResults } from '@/dice/GenesysRoller';
import type { ContainedItemQuality } from '@/item/data/BaseWeaponDataModel';
import ItemQualityDataModel from '@/item/data/ItemQualityDataModel';
import {
	type ChaosManifestationChatData,
	type ChaosManifestationChoice,
	getChaosManifestationChoices,
	resolveManifestation,
} from '@/magic/ChaosManifestations';

const FLAG_SCOPE = 'genesys';
const FLAG_KEY = 'symbolSpending';

type SymbolSide = 'positive' | 'negative' | 'magic';
type SpendKind = 'critical' | 'criticalBonus' | 'quality' | 'chaos' | 'manual';
type RollType = 'combat' | 'magic' | 'magicAttack';

type SymbolCost = {
	advantages?: number;
	triumphs?: number;
	threats?: number;
	despairs?: number;
};

type SymbolSpendOption = {
	id: string;
	side: SymbolSide;
	label: string;
	detail?: string;
	source: string;
	cost: SymbolCost;
	alternativeCosts?: SymbolCost[];
	kind?: SpendKind;
	repeatable?: boolean;
	maxUses?: number;
	chaosChoice?: ChaosManifestationChoice;
};

type SymbolSpendSelection = {
	option: SymbolSpendOption;
	uses: number;
};

type SymbolSpendSummaryEntry = {
	label: string;
	source: string;
	uses: number;
	costHtml: string;
};

type ChatContextTarget = JQuery<HTMLElement> | HTMLElement;

type NativeChatContextOption = {
	name: string;
	icon: string;
	condition?: (target: HTMLElement) => boolean;
	callback: (target: HTMLElement) => void;
};

export type SymbolSpendingFlag = {
	actorUuid?: string;
	rollType: RollType;
	results: Pick<GenesysRollResults, 'netSuccess' | 'netAdvantage' | 'netThreat' | 'totalTriumph' | 'totalDespair'>;
	attack?: {
		criticalAllowed?: boolean;
		critical?: number;
		weaponName?: string;
		qualities?: ContainedItemQuality[];
	};
	magic?: {
		actionId?: string | null;
		chaosManifestation?: ChaosManifestationChatData;
	};
	positiveSpent?: boolean;
	negativeSpent?: boolean;
};

function localize(key: string, fallback: string, data?: Record<string, string | number>) {
	if (game?.i18n) {
		const localized = data ? game.i18n.format(key, data) : game.i18n.localize(key);
		if (localized !== key) {
			return localized;
		}
	}

	return fallback;
}

function normalizeName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function isActiveEncounter() {
	return Boolean((game.combat as { started?: boolean } | null)?.started);
}

function getSpendableSymbols(results: SymbolSpendingFlag['results']) {
	return {
		advantages: Math.max(0, results.netAdvantage),
		triumphs: Math.max(0, results.totalTriumph),
		threats: Math.max(0, results.netThreat),
		despairs: Math.max(0, results.totalDespair),
	};
}

function hasSpendableSymbols(results: SymbolSpendingFlag['results']) {
	const pool = getSpendableSymbols(results);
	return pool.advantages > 0 || pool.triumphs > 0 || pool.threats > 0 || pool.despairs > 0;
}

function isMagicRoll(rollType: RollType) {
	return rollType === 'magic' || rollType === 'magicAttack';
}

export function buildSymbolSpendingFlag(
	actor: GenesysActor | undefined,
	results: GenesysRollResults,
	{
		rollType,
		attack,
		magic,
	}: {
		rollType?: RollType;
		attack?: SymbolSpendingFlag['attack'];
		magic?: SymbolSpendingFlag['magic'];
	},
): SymbolSpendingFlag | undefined {
	if (!actor || !rollType || !isActiveEncounter()) {
		return undefined;
	}

	const flag: SymbolSpendingFlag = {
		actorUuid: actor.uuid,
		rollType,
		results: {
			netSuccess: results.netSuccess,
			netAdvantage: results.netAdvantage,
			netThreat: results.netThreat,
			totalTriumph: results.totalTriumph,
			totalDespair: results.totalDespair,
		},
		attack,
		magic,
	};

	return hasSpendableSymbols(flag.results) ? flag : undefined;
}

function getActorPermission(actor: GenesysActor | null) {
	const isNpc = !actor || actor.type !== 'character';
	const isOwner = actor ? actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) : false;

	return {
		canSpendPositive: isNpc ? game.user.isGM : isOwner || game.user.isGM,
		canSpendNegative: game.user.isGM,
	};
}

function findQualityItem(name: string) {
	return game.items.find((item) => item.type === 'quality' && normalizeName(item.name) === normalizeName(name));
}

function getQualitySpendOptions(flag: SymbolSpendingFlag) {
	if (!flag.attack?.criticalAllowed) {
		return [];
	}

	return (flag.attack?.qualities ?? []).flatMap((quality) => {
		const qualityItem = findQualityItem(quality.name);
		const qualityData = qualityItem?.systemData as ItemQualityDataModel | undefined;
		if (qualityData?.activation !== 'active') {
			return [];
		}

		const advantages = Number(qualityData.activationCost?.advantages ?? 0);
		const triumphs = Number(qualityData.activationCost?.triumphs ?? 0);
		if (advantages <= 0 && triumphs <= 0) {
			return [];
		}

		return [
			{
				id: `quality-${normalizeName(quality.name)}`,
				side: 'positive' as const,
				label: quality.isRated ? `${quality.name} ${quality.rating}` : quality.name,
				source: localize('Genesys.SymbolSpending.Sources.ItemQuality', 'Cechy przedmiotu'),
				cost: { advantages, triumphs },
				kind: 'quality' as const,
				repeatable: qualityData.activationLimit !== 'once',
				maxUses: qualityData.activationLimit === 'rating' ? quality.rating : undefined,
			},
		];
	});
}

function option(id: string, side: SymbolSide, label: string, source: string, cost: SymbolCost, extra: Partial<SymbolSpendOption> = {}): SymbolSpendOption {
	return {
		id,
		side,
		label,
		source,
		cost,
		...extra,
	};
}

function addCostAlternatives(
	options: SymbolSpendOption[],
	id: string,
	side: SymbolSide,
	label: string,
	source: string,
	costs: SymbolCost[],
	extra: Partial<SymbolSpendOption> = {},
) {
	const [firstCost, ...alternativeCosts] = costs;
	options.push(option(id, side, label, source, firstCost, { ...extra, alternativeCosts }));
}

function magicOption(
	id: string,
	label: string,
	detail: string,
	source: string,
	costs: SymbolCost[],
	extra: Partial<SymbolSpendOption> = {},
) {
	return {
		id,
		side: 'magic' as const,
		label,
		detail,
		source,
		cost: costs[0],
		alternativeCosts: costs.slice(1),
		...extra,
	};
}

function buildCombatPositiveOptions(flag: SymbolSpendingFlag) {
	const options: SymbolSpendOption[] = [];
	const source = localize('Genesys.SymbolSpending.Sources.CombatPositive', 'Tabela I.6-2');

	options.push(option('recover-strain', 'positive', localize('Genesys.SymbolSpending.Options.RecoverStrain', 'Odzyskaj 1 zmęczenia'), source, { advantages: 1 }, { repeatable: true }));
	options.push(option('boost-next-ally', 'positive', localize('Genesys.SymbolSpending.Options.BoostNextAlly', 'Dodaj kość wsparcia do następnego testu sojusznika'), source, { advantages: 1 }, { repeatable: true }));
	options.push(option('notice-detail', 'positive', localize('Genesys.SymbolSpending.Options.NoticeDetail', 'Zauważ istotny szczegół obecnego konfliktu'), source, { advantages: 1 }));

	const critical = Number(flag.attack?.critical ?? 0);
	if (flag.attack?.criticalAllowed && critical > 0) {
		addCostAlternatives(options, 'critical', 'positive', localize('Genesys.SymbolSpending.Options.CriticalInjury', 'Zadaj Uraz Krytyczny'), source, [{ advantages: critical }, { triumphs: 1 }], { kind: 'critical' });
	}

	options.push(...getQualitySpendOptions(flag));
	addCostAlternatives(options, 'free-maneuver', 'positive', localize('Genesys.SymbolSpending.Options.FreeManeuver', 'Wykonaj natychmiast darmowy manewr'), source, [{ advantages: 2 }, { triumphs: 1 }]);
	addCostAlternatives(options, 'target-setback', 'positive', localize('Genesys.SymbolSpending.Options.TargetSetback', 'Dodaj kość utrudnienia do następnego testu celu'), source, [{ advantages: 2 }, { triumphs: 1 }]);
	addCostAlternatives(options, 'ally-boost', 'positive', localize('Genesys.SymbolSpending.Options.AllyBoost', 'Dodaj kość wsparcia do następnego testu dowolnego sojusznika'), source, [{ advantages: 2 }, { triumphs: 1 }]);
	addCostAlternatives(options, 'negate-defense', 'positive', localize('Genesys.SymbolSpending.Options.NegateDefense', 'Zaneguj obronę celu do końca obecnej rundy'), source, [{ advantages: 3 }, { triumphs: 1 }]);
	addCostAlternatives(options, 'ignore-environment', 'positive', localize('Genesys.SymbolSpending.Options.IgnoreEnvironment', 'Zignoruj kary środowiskowe do końca następnej tury'), source, [{ advantages: 3 }, { triumphs: 1 }]);
	addCostAlternatives(options, 'disable-target', 'positive', localize('Genesys.SymbolSpending.Options.DisableTarget', 'Wyłącz cel lub element jego wyposażenia zamiast zadawania ran'), source, [{ advantages: 3 }, { triumphs: 1 }]);
	addCostAlternatives(options, 'gain-defense', 'positive', localize('Genesys.SymbolSpending.Options.GainDefense', 'Zyskaj +1 obrony wręcz lub dystansowej do końca następnej tury'), source, [{ advantages: 3 }, { triumphs: 1 }]);
	addCostAlternatives(options, 'drop-weapon', 'positive', localize('Genesys.SymbolSpending.Options.DropWeapon', 'Zmuś cel do upuszczenia broni'), source, [{ advantages: 3 }, { triumphs: 1 }]);
	options.push(option('upgrade-target-difficulty', 'positive', localize('Genesys.SymbolSpending.Options.UpgradeTargetDifficulty', 'Ulepsz trudność następnego testu celu'), source, { triumphs: 1 }));
	options.push(option('upgrade-ally-ability', 'positive', localize('Genesys.SymbolSpending.Options.UpgradeAllyAbility', 'Ulepsz następny test dowolnego sojusznika'), source, { triumphs: 1 }));
	options.push(option('vital-action', 'positive', localize('Genesys.SymbolSpending.Options.VitalAction', 'Zrób coś kluczowego dla przebiegu sceny'), source, { triumphs: 1 }));
	options.push(option('destroy-equipment', 'positive', localize('Genesys.SymbolSpending.Options.DestroyEquipment', 'Podczas zadawania obrażeń celowi używany przez niego element wyposażenia zostaje zniszczony'), source, { triumphs: 2 }));
	return options.map((entry) => {
		const isTableAdvantageSpend = entry.side === 'positive' && !entry.kind && (entry.cost.advantages ?? 0) > 0;
		const alreadyHasTriumphAlternative = getOptionCosts(entry).some((cost) => (cost.triumphs ?? 0) > 0);
		return isTableAdvantageSpend && !alreadyHasTriumphAlternative
			? { ...entry, alternativeCosts: [...(entry.alternativeCosts ?? []), { triumphs: 1 }] }
			: entry;
	});
}

function buildCombatNegativeOptions() {
	const options: SymbolSpendOption[] = [];
	const source = localize('Genesys.SymbolSpending.Sources.CombatNegative', 'Tabela I.6-3');

	addCostAlternatives(options, 'suffer-strain', 'negative', localize('Genesys.SymbolSpending.Options.SufferStrain', 'Aktywna postać otrzymuje 1 zmęczenia'), source, [{ threats: 1 }, { despairs: 1 }], { repeatable: true });
	addCostAlternatives(options, 'lose-maneuver-benefit', 'negative', localize('Genesys.SymbolSpending.Options.LoseManeuverBenefit', 'Aktywna postać traci korzyść z wcześniejszego manewru'), source, [{ threats: 1 }, { despairs: 1 }]);
	addCostAlternatives(options, 'enemy-free-maneuver', 'negative', localize('Genesys.SymbolSpending.Options.EnemyFreeManeuver', 'Przeciwnik wykonuje darmowy manewr'), source, [{ threats: 2 }, { despairs: 1 }]);
	addCostAlternatives(options, 'enemy-boost', 'negative', localize('Genesys.SymbolSpending.Options.EnemyBoost', 'Przeciwnik dodaje kość wsparcia do następnego testu'), source, [{ threats: 2 }, { despairs: 1 }]);
	addCostAlternatives(options, 'ally-setback', 'negative', localize('Genesys.SymbolSpending.Options.AllySetback', 'Aktywna postać albo sojusznik dodaje kość utrudnienia do następnej akcji'), source, [{ threats: 2 }, { despairs: 1 }]);
	addCostAlternatives(options, 'fall-prone', 'negative', localize('Genesys.SymbolSpending.Options.FallProne', 'Aktywna postać zostaje przewrócona'), source, [{ threats: 3 }, { despairs: 1 }]);
	addCostAlternatives(options, 'enemy-advantage', 'negative', localize('Genesys.SymbolSpending.Options.EnemyAdvantage', 'Przeciwnik zyskuje istotną przewagę sytuacyjną'), source, [{ threats: 3 }, { despairs: 1 }]);
	options.push(option('out-of-ammo', 'negative', localize('Genesys.SymbolSpending.Options.OutOfAmmo', 'Broń dystansowa traci amunicję'), source, { despairs: 1 }));
	options.push(option('upgrade-current-difficulty', 'negative', localize('Genesys.SymbolSpending.Options.UpgradeCurrentDifficulty', 'Ulepsz trudność następnego testu aktywnej postaci lub sojusznika'), source, { despairs: 1 }));
	options.push(option('damage-tool', 'negative', localize('Genesys.SymbolSpending.Options.DamageTool', 'Używane narzędzie albo broń zostaje uszkodzona'), source, { despairs: 1 }));
	return options;
}

function buildMagicNegativeOptions(flag: SymbolSpendingFlag) {
	const options: SymbolSpendOption[] = [];
	const source = localize('Genesys.SymbolSpending.Sources.MagicNegative', 'Tabela III.2-4');

	options.push(magicOption(
		'magic-threat-1',
		localize('Genesys.SymbolSpending.Options.MagicThreatOneShort', 'Przepływ magicznych mocy nadwyręża postać'),
		localize('Genesys.SymbolSpending.Options.MagicThreatOneDetail', 'Przepływ magicznych mocy nadwyręża postać, która otrzymuje 2 punkty zmęczenia albo 1 ranę (wybór gracza). Aktywna postać i wszyscy jej sojusznicy obecni w spotkaniu dodają kość utrudnienia do każdej próby rzucania czarów do końca jej następnej tury.'),
		source,
		[{ threats: 1 }, { despairs: 1 }],
	));
	options.push(magicOption(
		'magic-threat-2',
		localize('Genesys.SymbolSpending.Options.MagicThreatTwoShort', 'Czar nie przynosi efektu aż do początku następnej rundy'),
		localize('Genesys.SymbolSpending.Options.MagicThreatTwoDetail', 'Czar nie przynosi efektu aż do początku następnej rundy, a w przypadku rozgrywki narracyjnej zaczyna działać po minucie. Jeżeli postać używa magicznego przedmiotu, to otrzymuje on 1 poziom uszkodzeń. Do końca spotkania wrodzy użytkownicy magii dodają kość wsparcia podczas rzucania czarów, których celem jest ta postać.'),
		source,
		[{ threats: 2 }, { despairs: 1 }],
	));
	options.push(magicOption(
		'magic-threat-3',
		localize('Genesys.SymbolSpending.Options.MagicThreatThreeShort', 'Efekt czaru jest nieco mocniejszy od oczekiwanego'),
		localize('Genesys.SymbolSpending.Options.MagicThreatThreeDetail', 'Efekt czaru jest nieco mocniejszy od oczekiwanego. Jedna dodatkowa, wybrana przez MG postać zostaje celem czaru albo w inny sposób trafia pod jego wpływ. Wszyscy inni użytkownicy magii i stworzenia wrażliwe na magiczne moce wyczuwają tę postać, jeśli znajdują się w obrębie dnia drogi od niej.'),
		source,
		[{ threats: 3 }, { despairs: 1 }],
	));
	options.push(magicOption(
		'magic-no-spells',
		localize('Genesys.SymbolSpending.Options.MagicNoSpellsShort', 'Postać przemęcza się albo traci więź z magią'),
		localize('Genesys.SymbolSpending.Options.MagicNoSpellsDetail', 'Postać przemęcza się albo traci więź z magią i nie jest w stanie rzucać czarów do końca spotkania albo sceny.'),
		source,
		[{ despairs: 1 }],
	));
	options.push(magicOption(
		'magic-gm-target',
		localize('Genesys.SymbolSpending.Options.MagicGmTargetShort', 'MG wybiera cel zaklęcia'),
		localize('Genesys.SymbolSpending.Options.MagicGmTargetDetail', 'MG wybiera cel zaklęcia. Jeśli zaklęcie rzuca PN, to nowy cel wybiera gracz kontrolujący postać będącą pierwotnym celem.'),
		source,
		[{ despairs: 1 }],
	));
	options.push(magicOption(
		'magic-critical',
		localize('Genesys.SymbolSpending.Options.MagicCriticalShort', 'Postać całkowicie traci kontrolę nad swoją mocą albo ściąga gniew swojego bóstwa'),
		localize('Genesys.SymbolSpending.Options.MagicCriticalDetail', 'Postać całkowicie traci kontrolę nad swoją mocą albo ściąga gniew swojego bóstwa. Otrzymuje jeden Uraz Krytyczny albo, zależnie od decyzji MG, przyjmuje to w formie jakiegoś straszliwego albo przezabawnego pecha.'),
		source,
		[{ despairs: 2 }],
	));
	options.push(magicOption(
		'magic-item-destroyed',
		localize('Genesys.SymbolSpending.Options.MagicItemDestroyedShort', 'Magiczny przedmiot zostaje zniszczony'),
		localize('Genesys.SymbolSpending.Options.MagicItemDestroyedDetail', 'Jeżeli postać używa właśnie magicznego przedmiotu, ulega on całkowitemu zniszczeniu.'),
		source,
		[{ despairs: 2 }],
	));

	const chaos = flag.magic?.chaosManifestation;
	if (chaos) {
		const chaosSource = localize('Genesys.SymbolSpending.Sources.ChaosManifestation', 'Manifestacja Chaosu');
		for (const choice of getChaosManifestationChoices(chaos)) {
			options.push(
				option(
					`chaos-${choice.id}`,
					'magic',
					localize(choice.labelKey, choice.fallbackLabel),
					chaosSource,
					symbolStringToCost(choice.usedSymbols),
					{ kind: 'chaos', chaosChoice: choice },
				),
			);
		}
	}

	return options;
}

function symbolStringToCost(symbols: string): SymbolCost {
	return {
		advantages: symbols.split('').filter((symbol) => symbol === 'a').length,
		triumphs: symbols.split('').filter((symbol) => symbol === 't').length,
		threats: symbols.split('').filter((symbol) => symbol === 'h').length,
		despairs: symbols.split('').filter((symbol) => symbol === 'd').length,
	};
}

function buildOptions(flag: SymbolSpendingFlag) {
	const options = [...buildCombatPositiveOptions(flag), ...buildCombatNegativeOptions()];
	if (isMagicRoll(flag.rollType)) {
		options.push(...buildMagicNegativeOptions(flag));
	}
	return options;
}

function symbolsToInlineHtml(symbols: string) {
	return `<span class="font-genesys-symbols nolig">${symbols}</span>`;
}

function costToSymbolString(cost: SymbolCost, uses = 1) {
	return `${'a'.repeat((cost.advantages ?? 0) * uses)}${'t'.repeat((cost.triumphs ?? 0) * uses)}${'h'.repeat((cost.threats ?? 0) * uses)}${'d'.repeat((cost.despairs ?? 0) * uses)}`;
}

function costToInlineHtml(cost: SymbolCost, uses = 1) {
	const symbols = costToSymbolString(cost, uses);
	return symbols ? symbolsToInlineHtml(symbols) : '-';
}

function getOptionCosts(option: SymbolSpendOption) {
	return [option.cost, ...(option.alternativeCosts ?? [])];
}

function costEquals(left: SymbolCost, right: SymbolCost) {
	return (left.advantages ?? 0) === (right.advantages ?? 0)
		&& (left.triumphs ?? 0) === (right.triumphs ?? 0)
		&& (left.threats ?? 0) === (right.threats ?? 0)
		&& (left.despairs ?? 0) === (right.despairs ?? 0);
}

function getSelectedOptionCost(option: SymbolSpendOption, selections: SymbolSpendSelection[]) {
	return selections.find((selection) => selection.option.id === option.id)?.option.cost;
}

function getCostSortValue(cost: SymbolCost) {
	const advantages = cost.advantages ?? 0;
	const triumphs = cost.triumphs ?? 0;
	const threats = cost.threats ?? 0;
	const despairs = cost.despairs ?? 0;
	return advantages + threats + (triumphs + despairs) * 3;
}

function getPositiveCostColumn(cost: SymbolCost) {
	const advantages = cost.advantages ?? 0;
	if (advantages <= 0 && (cost.triumphs ?? 0) > 0) {
		return 'triumph';
	}
	if (advantages <= 1) {
		return 'one';
	}
	if (advantages === 2) {
		return 'two';
	}
	return 'three';
}

function getNegativeCostColumn(cost: SymbolCost) {
	const threats = cost.threats ?? 0;
	if (threats <= 0 && (cost.despairs ?? 0) > 0) {
		return 'despair';
	}
	if (threats <= 1) {
		return 'one';
	}
	if (threats === 2) {
		return 'two';
	}
	return 'three';
}

function getPrimaryColumnCost(option: SymbolSpendOption, pool: ReturnType<typeof getSpendableSymbols>, selectedCost?: SymbolCost) {
	if ((option.cost.advantages ?? 0) > 0) {
		return option.cost;
	}

	const costs = getOptionCosts(option).filter((cost) => hasEnoughSymbolsInPool(pool, cost) || (selectedCost && costEquals(selectedCost, cost)));
	const advantageCost = costs
		.filter((cost) => (cost.advantages ?? 0) > 0)
		.sort((left, right) => (left.advantages ?? 0) - (right.advantages ?? 0))[0];
	return advantageCost ?? getPrimaryAvailableCost(option, pool, selectedCost);
}

function getPrimaryNegativeColumnCost(option: SymbolSpendOption, pool: ReturnType<typeof getSpendableSymbols>, selectedCost?: SymbolCost) {
	if ((option.cost.threats ?? 0) > 0) {
		return option.cost;
	}

	const costs = getOptionCosts(option).filter((cost) => hasEnoughSymbolsInPool(pool, cost) || (selectedCost && costEquals(selectedCost, cost)));
	const threatCost = costs
		.filter((cost) => (cost.threats ?? 0) > 0)
		.sort((left, right) => (left.threats ?? 0) - (right.threats ?? 0))[0];
	return threatCost ?? getPrimaryAvailableCost(option, pool, selectedCost);
}

function getPrimaryAvailableCost(option: SymbolSpendOption, pool: ReturnType<typeof getSpendableSymbols>, selectedCost?: SymbolCost) {
	const costs = getOptionCosts(option)
		.filter((cost) => hasEnoughSymbolsInPool(pool, cost) || (selectedCost && costEquals(selectedCost, cost)))
		.sort((left, right) => getCostSortValue(left) - getCostSortValue(right));
	return costs[0] ?? option.cost;
}

function symbolToImageHtml(symbol: string, spent = false) {
	const fileName: Record<string, string> = {
		a: 'advantage',
		t: 'triumph',
		h: 'threat',
		d: 'despair',
	};

	return `<img class="symbol-spending-pool-symbol ${spent ? 'is-spent' : ''}" src="systems/genesys/dice/${fileName[symbol]}.png" alt="${symbol}">`;
}

function dieToImageHtml(die: string) {
	const fileName: Record<string, string> = {
		boost: 'blue',
		setback: 'black',
		difficulty: 'purple',
		ability: 'green',
		proficiency: 'yellow',
		challenge: 'red',
	};

	return `<img class="symbol-spending-inline-die" src="systems/genesys/dice/${fileName[die]}.png" alt="${die}">`;
}

function enrichSpendLabel(label: string) {
	const protectedLabel = label.replace(/\s(do|z|w|i|o|u|na|za|od|po|albo|lub)\s/giu, ' $1&nbsp;');
	const replacements: Array<[RegExp, string]> = [
		[/kość wsparcia/giu, dieToImageHtml('boost')],
		[/kości wsparcia/giu, dieToImageHtml('boost')],
		[/kość utrudnienia/giu, dieToImageHtml('setback')],
		[/kości utrudnienia/giu, dieToImageHtml('setback')],
	];

	return replacements.reduce((updatedLabel, [pattern, replacement]) => updatedLabel.replace(pattern, replacement), protectedLabel);
}

function symbolPoolToInlineHtml(pool: ReturnType<typeof getSpendableSymbols>, remainingPool = pool) {
	const symbols = [
		...Array.from({ length: pool.advantages }, (_, index) => symbolToImageHtml('a', index >= remainingPool.advantages)),
		...Array.from({ length: pool.triumphs }, (_, index) => symbolToImageHtml('t', index >= remainingPool.triumphs)),
		...Array.from({ length: pool.threats }, (_, index) => symbolToImageHtml('h', index >= remainingPool.threats)),
		...Array.from({ length: pool.despairs }, (_, index) => symbolToImageHtml('d', index >= remainingPool.despairs)),
	];
	return symbols.length ? symbols.join('') : `<span class="symbol-spending-no-symbols">-</span>`;
}

function getSelectionCost(selections: SymbolSpendSelection[]) {
	return selections.reduce(
		(total, selection) => ({
			advantages: total.advantages + (selection.option.cost.advantages ?? 0) * selection.uses,
			triumphs: total.triumphs + (selection.option.cost.triumphs ?? 0) * selection.uses,
			threats: total.threats + (selection.option.cost.threats ?? 0) * selection.uses,
			despairs: total.despairs + (selection.option.cost.despairs ?? 0) * selection.uses,
		}),
		{ advantages: 0, triumphs: 0, threats: 0, despairs: 0 },
	);
}

function getRemainingSymbols(flag: SymbolSpendingFlag, selections: SymbolSpendSelection[]) {
	const pool = getSpendableSymbols(flag.results);
	const spent = getSelectionCost(selections);
	return {
		advantages: Math.max(0, pool.advantages - spent.advantages),
		triumphs: Math.max(0, pool.triumphs - spent.triumphs),
		threats: Math.max(0, pool.threats - spent.threats),
		despairs: Math.max(0, pool.despairs - spent.despairs),
	};
}

function hasEnoughSymbolsInPool(pool: ReturnType<typeof getSpendableSymbols>, cost: SymbolCost) {
	return (
		pool.advantages >= (cost.advantages ?? 0)
		&& pool.triumphs >= (cost.triumphs ?? 0)
		&& pool.threats >= (cost.threats ?? 0)
		&& pool.despairs >= (cost.despairs ?? 0)
	);
}

function getSelectionCount(selections: SymbolSpendSelection[], optionId: string) {
	return selections.find((selection) => selection.option.id === optionId)?.uses ?? 0;
}

function getVisibleOptions(options: SymbolSpendOption[], selections: SymbolSpendSelection[]) {
	const hasCritical = selections.some((selection) => selection.option.kind === 'critical');
	const criticalBonus = option(
		'critical-bonus',
		'positive',
		localize('Genesys.SymbolSpending.Options.CriticalBonus', 'Zwiększ wynik Urazu Krytycznego o +10'),
		localize('Genesys.SymbolSpending.Sources.CombatPositive', 'Tabela I.6-2'),
		{ advantages: 1 },
		{ kind: 'criticalBonus', repeatable: true },
	);
	return hasCritical ? [...options, criticalBonus] : options;
}

function canUseSide(side: SymbolSide, permission: ReturnType<typeof getActorPermission>, flag: SymbolSpendingFlag) {
	if (side === 'positive') {
		return permission.canSpendPositive && !flag.positiveSpent;
	}

	return permission.canSpendNegative && !flag.negativeSpent;
}

function canSelectOptionCost(option: SymbolSpendOption, cost: SymbolCost, flag: SymbolSpendingFlag, selections: SymbolSpendSelection[], permission: ReturnType<typeof getActorPermission>) {
	if (getSelectionCount(selections, option.id) > 0) {
		return true;
	}

	const count = getSelectionCount(selections, option.id);
	const maxReached = option.maxUses !== undefined && count >= option.maxUses;
	const repeatBlocked = !option.repeatable && count > 0;
	return canUseSide(option.side, permission, flag) && !maxReached && !repeatBlocked && hasEnoughSymbolsInPool(getRemainingSymbols(flag, selections), cost);
}

function renderOption(option: SymbolSpendOption, flag: SymbolSpendingFlag, selections: SymbolSpendSelection[], permission: ReturnType<typeof getActorPermission>) {
	const originalPool = getSpendableSymbols(flag.results);
	const selectedCost = getSelectedOptionCost(option, selections);
	const costs = getOptionCosts(option).filter((cost) => hasEnoughSymbolsInPool(originalPool, cost) || (selectedCost && costEquals(selectedCost, cost)));
	const costButtons = costs
		.map((cost) => {
			const costIndex = getOptionCosts(option).findIndex((candidate) => costEquals(candidate, cost));
			const selected = selectedCost ? costEquals(selectedCost, cost) : false;
			const disabled = !canSelectOptionCost(option, cost, flag, selections, permission);
			return `
				<button type="button" class="symbol-spending-cost-button ${selected ? 'is-selected' : ''}" data-option-id="${option.id}" data-cost-index="${costIndex}" ${disabled ? 'disabled' : ''}>
					${costToInlineHtml(cost)}
				</button>
			`;
		})
		.join('');
	const labelHtml = option.detail
		? `
			<details class="symbol-spending-option-details">
				<summary class="symbol-spending-option-label">${enrichSpendLabel(option.label)}</summary>
				<p>${enrichSpendLabel(option.detail)}</p>
			</details>
		`
		: `<span class="symbol-spending-option-label">${enrichSpendLabel(option.label)}</span>`;

	return `
		<div class="symbol-spending-option ${selectedCost ? 'is-selected' : ''}">
			<span class="symbol-spending-option-cost">${costButtons}</span>
			<span class="symbol-spending-option-main">
				${labelHtml}
			</span>
		</div>
	`;
}

function renderSection(
	title: string,
	side: SymbolSide,
	options: SymbolSpendOption[],
	flag: SymbolSpendingFlag,
	selections: SymbolSpendSelection[],
	permission: ReturnType<typeof getActorPermission>,
) {
	const disabledMessage = !canUseSide(side, permission, flag)
		? `<p class="symbol-spending-locked">${side === 'positive' && flag.positiveSpent || side !== 'positive' && flag.negativeSpent
			? localize('Genesys.SymbolSpending.AlreadySpent', 'Ta strona symboli została już rozliczona.')
			: localize('Genesys.SymbolSpending.NoPermission', 'Nie możesz wydawać tej strony symboli.')}</p>`
		: '';
	const originalPool = getSpendableSymbols(flag.results);
	const relevantOptions = options.filter((entry) => getSelectionCount(selections, entry.id) > 0 || getOptionCosts(entry).some((cost) => hasEnoughSymbolsInPool(originalPool, cost)));
	const rows = relevantOptions.length
		? relevantOptions.map((entry) => renderOption(entry, flag, selections, permission)).join('')
		: `<p class="symbol-spending-empty">${localize('Genesys.SymbolSpending.NoOptions', 'Brak dostępnych opcji dla wyrzuconych symboli.')}</p>`;

	return `
		<section class="symbol-spending-section ${canUseSide(side, permission, flag) ? '' : 'is-locked'}">
			<h4>${title}</h4>
			${disabledMessage}
			<div class="symbol-spending-options">${rows}</div>
		</section>
	`;
}

function isWeaponSpendOption(option: SymbolSpendOption) {
	return option.kind === 'critical' || option.kind === 'criticalBonus' || option.kind === 'quality';
}

function renderOptionRows(
	options: SymbolSpendOption[],
	flag: SymbolSpendingFlag,
	selections: SymbolSpendSelection[],
	permission: ReturnType<typeof getActorPermission>,
) {
	const originalPool = getSpendableSymbols(flag.results);
	const relevantOptions = options.filter((entry) => getSelectionCount(selections, entry.id) > 0 || getOptionCosts(entry).some((cost) => hasEnoughSymbolsInPool(originalPool, cost)));
	if (!relevantOptions.length) {
		return `<p class="symbol-spending-empty">${localize('Genesys.SymbolSpending.NoOptions', 'Brak dostępnych opcji dla wyrzuconych symboli.')}</p>`;
	}

	return relevantOptions
		.sort((left, right) => getCostSortValue(getPrimaryAvailableCost(left, originalPool, getSelectedOptionCost(left, selections))) - getCostSortValue(getPrimaryAvailableCost(right, originalPool, getSelectedOptionCost(right, selections))))
		.map((entry) => renderOption(entry, flag, selections, permission))
		.join('');
}

function hasRenderableOptions(options: SymbolSpendOption[], flag: SymbolSpendingFlag, selections: SymbolSpendSelection[]) {
	const originalPool = getSpendableSymbols(flag.results);
	return options.some((entry) => getSelectionCount(selections, entry.id) > 0 || getOptionCosts(entry).some((cost) => hasEnoughSymbolsInPool(originalPool, cost)));
}

function renderPositiveSection(
	title: string,
	options: SymbolSpendOption[],
	flag: SymbolSpendingFlag,
	selections: SymbolSpendSelection[],
	permission: ReturnType<typeof getActorPermission>,
) {
	const side: SymbolSide = 'positive';
	const disabledMessage = !canUseSide(side, permission, flag)
		? `<p class="symbol-spending-locked">${flag.positiveSpent
			? localize('Genesys.SymbolSpending.AlreadySpent', 'Ta strona symboli została już rozliczona.')
			: localize('Genesys.SymbolSpending.NoPermission', 'Nie możesz wydawać tej strony symboli.')}</p>`
		: '';
	const tableOptions = options.filter((entry) => !isWeaponSpendOption(entry));
	const weaponOptions = options.filter(isWeaponSpendOption);
	const originalPool = getSpendableSymbols(flag.results);
	const tableColumns = [
		{
			id: 'one',
			title: localize('Genesys.SymbolSpending.CostOne', '1 Przewaga'),
			options: tableOptions.filter((entry) => getPositiveCostColumn(getPrimaryColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === 'one'),
		},
		{
			id: 'two',
			title: localize('Genesys.SymbolSpending.CostTwo', '2 Przewagi'),
			options: tableOptions.filter((entry) => getPositiveCostColumn(getPrimaryColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === 'two'),
		},
		{
			id: 'three',
			title: localize('Genesys.SymbolSpending.CostThree', '3 Przewagi'),
			options: tableOptions.filter((entry) => getPositiveCostColumn(getPrimaryColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === 'three'),
		},
		{
			id: 'triumph',
			title: localize('Genesys.SymbolSpending.CostTriumph', 'Triumf'),
			options: tableOptions.filter((entry) => getPositiveCostColumn(getPrimaryColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === 'triumph'),
		},
	].filter((column) => (column.id !== 'triumph' || originalPool.triumphs > 0) && hasRenderableOptions(column.options, flag, selections));
	const shouldShowWeaponColumn = weaponOptions.length > 0 && (originalPool.triumphs > 0 || Boolean(flag.attack?.criticalAllowed));
	const positiveColumns = [
		...tableColumns,
		...(shouldShowWeaponColumn ? [{
			id: 'weapon',
			title: localize('Genesys.SymbolSpending.WeaponColumn', 'Krytyki i cechy broni'),
			options: weaponOptions,
		}] : []),
	].filter((column) => hasRenderableOptions(column.options, flag, selections));

	if (!positiveColumns.length) {
		return '';
	}

	return `
		<section class="symbol-spending-section ${canUseSide(side, permission, flag) ? '' : 'is-locked'}">
			<h4>${title}</h4>
			${disabledMessage}
			<div class="symbol-spending-spend-grid symbol-spending-positive-grid">
				${positiveColumns.map((column) => `
					<div class="symbol-spending-subsection symbol-spending-cost-column symbol-spending-cost-column-${column.id}">
						<h5>${column.title}</h5>
						<div class="symbol-spending-options">${renderOptionRows(column.options, flag, selections, permission)}</div>
					</div>
				`).join('')}
			</div>
		</section>
	`;
}

function renderNegativeSection(
	title: string,
	options: SymbolSpendOption[],
	magicOptions: SymbolSpendOption[],
	flag: SymbolSpendingFlag,
	selections: SymbolSpendSelection[],
	permission: ReturnType<typeof getActorPermission>,
) {
	const side: SymbolSide = 'negative';
	const disabledMessage = !canUseSide(side, permission, flag)
		? `<p class="symbol-spending-locked">${flag.negativeSpent
			? localize('Genesys.SymbolSpending.AlreadySpent', 'Ta strona symboli została już rozliczona.')
			: localize('Genesys.SymbolSpending.NoPermission', 'Nie możesz wydawać tej strony symboli.')}</p>`
		: '';
	const originalPool = getSpendableSymbols(flag.results);
	const negativeColumns = [
		{
			id: 'one',
			title: localize('Genesys.SymbolSpending.CostOneThreat', '1 Zagrożenie'),
			options: options.filter((entry) => getNegativeCostColumn(getPrimaryNegativeColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === 'one'),
		},
		{
			id: 'two',
			title: localize('Genesys.SymbolSpending.CostTwoThreats', '2 Zagrożenia'),
			options: options.filter((entry) => getNegativeCostColumn(getPrimaryNegativeColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === 'two'),
		},
		{
			id: 'three',
			title: localize('Genesys.SymbolSpending.CostThreeThreats', '3 Zagrożenia'),
			options: options.filter((entry) => getNegativeCostColumn(getPrimaryNegativeColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === 'three'),
		},
		{
			id: 'despair',
			title: localize('Genesys.SymbolSpending.CostDespair', 'Rozpacz'),
			options: options.filter((entry) => getNegativeCostColumn(getPrimaryNegativeColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === 'despair'),
		},
	].filter((column) => column.id !== 'despair' || originalPool.despairs > 0);
	const standardMagicOptions = magicOptions.filter((entry) => entry.kind !== 'chaos');
	const chaosOptions = magicOptions.filter((entry) => entry.kind === 'chaos');
	const regularNegativeOptions = [...options, ...standardMagicOptions];
	const allColumns = [
		...negativeColumns.map((column) => ({
			...column,
			options: regularNegativeOptions.filter((entry) => getNegativeCostColumn(getPrimaryNegativeColumnCost(entry, originalPool, getSelectedOptionCost(entry, selections))) === column.id),
		})),
		...(chaosOptions.length ? [{
			id: 'chaos',
			title: localize('Genesys.SymbolSpending.ChaosManifestations', 'Manifestacje'),
			options: chaosOptions,
		}] : []),
	].filter((column) => hasRenderableOptions(column.options, flag, selections));

	if (!allColumns.length) {
		return '';
	}

	return `
		<section class="symbol-spending-section ${canUseSide(side, permission, flag) ? '' : 'is-locked'}">
			<h4>${title}</h4>
			${disabledMessage}
			<div class="symbol-spending-spend-grid symbol-spending-negative-grid">
				${allColumns.map((column) => `
					<div class="symbol-spending-subsection symbol-spending-cost-column symbol-spending-cost-column-${column.id}">
						<h5>${column.title}</h5>
						<div class="symbol-spending-options">${renderOptionRows(column.options, flag, selections, permission)}</div>
					</div>
				`).join('')}
			</div>
		</section>
	`;
}

function getSymbolSpendingDialogWidth(flag: SymbolSpendingFlag) {
	const pool = getSpendableSymbols(flag.results);
	const positiveColumnCount = Math.min(pool.advantages, 3) + (pool.triumphs > 0 ? 1 : 0) + (pool.triumphs > 0 || flag.attack?.criticalAllowed ? 1 : 0);
	const negativeColumnCount = Math.min(pool.threats, 3) + (pool.despairs > 0 ? 1 : 0);
	const visibleSideCount = Number(positiveColumnCount > 0) + Number(negativeColumnCount > 0);
	const totalColumnCount = positiveColumnCount + negativeColumnCount;

	const sideBySideMinimum = visibleSideCount > 1 ? 1546 : 0;
	return Math.min(1546, Math.max(560, sideBySideMinimum, 300 + totalColumnCount * 225 + Math.max(0, visibleSideCount - 1) * 40));
}

function renderDialogContent(flag: SymbolSpendingFlag, options: SymbolSpendOption[], selections: SymbolSpendSelection[], permission: ReturnType<typeof getActorPermission>) {
	const visibleOptions = getVisibleOptions(options, selections);
	const originalPool = getSpendableSymbols(flag.results);
	const remaining = getRemainingSymbols(flag, selections);
	const positive = visibleOptions.filter((entry) => entry.side === 'positive');
	const negative = visibleOptions.filter((entry) => entry.side === 'negative');
	const magic = visibleOptions.filter((entry) => entry.side === 'magic');
	const hasChaosOption = visibleOptions.some((entry) => entry.kind === 'chaos' && getOptionCosts(entry).some((cost) => canSelectOptionCost(entry, cost, flag, selections, permission)));
	const positiveSection = renderPositiveSection(localize('Genesys.SymbolSpending.Positive', 'Pozytywne symbole'), positive, flag, selections, permission);
	const negativeSection = renderNegativeSection(localize('Genesys.SymbolSpending.Negative', 'Negatywne symbole'), negative, magic, flag, selections, permission);
	const sectionCount = Number(Boolean(positiveSection)) + Number(Boolean(negativeSection));

	return `
		<div class="symbol-spending-dialog-body">
			<div class="symbol-spending-top">
				<div class="symbol-spending-pool">
					<h4>${localize('Genesys.SymbolSpending.PoolSummary', 'Podsumowanie symboli')}</h4>
					<div class="symbol-spending-pool-symbols">
						${symbolPoolToInlineHtml(originalPool, remaining)}
						<div class="symbol-spending-top-actions">
							<button type="button" data-symbol-spending-confirm>${localize('Genesys.SymbolSpending.Confirm', 'Zatwierdź')}</button>
							<button type="button" data-symbol-spending-cancel>${localize('Genesys.SymbolSpending.Cancel', 'Anuluj')}</button>
						</div>
					</div>
				</div>
			</div>
			<div class="symbol-spending-columns ${sectionCount > 1 ? 'has-two-sections' : 'has-one-section'}">
				${positiveSection}
				${negativeSection}
			</div>
			${hasChaosOption ? `<label class="symbol-spending-story-point"><input type="checkbox" name="useStoryPoint"> ${localize('Genesys.ChaosManifestation.UseStoryPoint', 'Użyj Punktu Opowieści')}</label>` : ''}
		</div>
	`;
}

async function getFlagActor(flag: SymbolSpendingFlag) {
	return flag.actorUuid ? ((await fromUuid(flag.actorUuid)) as GenesysActor | null) : null;
}

async function promptForSpending(flag: SymbolSpendingFlag, actor: GenesysActor | null) {
	const options = buildOptions(flag);
	const selections: SymbolSpendSelection[] = [];
	const permission = getActorPermission(actor);

	return new Promise<{ selections: SymbolSpendSelection[]; useStoryPoint: boolean } | null>((resolve) => {
		let appHtml: JQuery<HTMLElement> | null = null;
		let contentHtml: JQuery<HTMLElement> | null = null;
		let dialog: Dialog | null = null;
		let settled = false;

		const resolveOnce = (result: { selections: SymbolSpendSelection[]; useStoryPoint: boolean } | null) => {
			if (settled) return;
			settled = true;
			resolve(result);
			dialog?.close();
		};

		const getUseStoryPoint = (root: ParentNode) => {
			return Boolean((root.querySelector('[name="useStoryPoint"]') as HTMLInputElement | null)?.checked);
		};

		const getContent = (html: JQuery<HTMLElement>) => {
			return html.hasClass('dialog-content') ? html.first() : html.find('.dialog-content').first();
		};

		const removeSelection = (optionId: string | undefined) => {
			const index = selections.findIndex((selection) => selection.option.id === optionId);
			if (index < 0) {
				return;
			}

			const removed = selections.splice(index, 1)[0];
			if (removed.option.kind === 'critical') {
				const bonusIndex = selections.findIndex((selection) => selection.option.kind === 'criticalBonus');
				if (bonusIndex >= 0) {
					selections.splice(bonusIndex, 1);
				}
			}
		};

		const refresh = () => {
			contentHtml?.html(renderDialogContent(flag, options, selections, permission));
		};

		const bindEvents = (html: JQuery<HTMLElement>) => {
			html.off('click.symbolSpending');
			html.on('click.symbolSpending', '[data-option-id]', (event) => {
				event.preventDefault();
				const optionId = (event.currentTarget as HTMLElement).dataset.optionId;
				const costIndex = Number((event.currentTarget as HTMLElement).dataset.costIndex ?? 0);
				const option = getVisibleOptions(options, selections).find((candidate) => candidate.id === optionId);
				if (!option) return;

				const selectedCost = getOptionCosts(option)[costIndex];
				if (!selectedCost || !canSelectOptionCost(option, selectedCost, flag, selections, permission)) {
					return;
				}

				const existingSelection = selections.find((selection) => selection.option.id === option.id);
				if (existingSelection) {
					if (costEquals(existingSelection.option.cost, selectedCost)) {
						removeSelection(option.id);
					} else {
						existingSelection.option = { ...option, cost: selectedCost, alternativeCosts: [] };
					}
					refresh();
					return;
				}

				selections.push({ option: { ...option, cost: selectedCost, alternativeCosts: [] }, uses: 1 });
				refresh();
			});

			html.on('click.symbolSpending', '[data-remove-option-id]', (event) => {
				event.preventDefault();
				const optionId = (event.currentTarget as HTMLElement).dataset.removeOptionId;
				removeSelection(optionId);
				refresh();
			});

			html.on('click.symbolSpending', '[data-symbol-spending-confirm]', (event) => {
				event.preventDefault();
				const root = appHtml?.[0] ?? html[0];
				resolveOnce({ selections: [...selections], useStoryPoint: getUseStoryPoint(root) });
			});

			html.on('click.symbolSpending', '[data-symbol-spending-cancel]', (event) => {
				event.preventDefault();
				resolveOnce(null);
			});
		};

		dialog = new Dialog(
			{
				title: localize('Genesys.SymbolSpending.Title', 'Wydawanie symboli'),
				content: renderDialogContent(flag, options, selections, permission),
				buttons: {},
				render: (html) => {
					appHtml = html instanceof HTMLElement ? $(html) : html;
					contentHtml = getContent(appHtml);
					refresh();
					bindEvents(appHtml);
				},
				close: () => resolveOnce(null),
			},
			{
				classes: ['symbol-spending-dialog'],
				resizable: true,
				width: getSymbolSpendingDialogWidth(flag),
				height: 655,
			},
		);
		dialog.render(true);
	});
}

function buildSummaryEntries(selections: SymbolSpendSelection[]): SymbolSpendSummaryEntry[] {
	return selections.map((selection) => ({
		label: selection.option.label,
		source: selection.option.source,
		uses: selection.uses,
		costHtml: costToInlineHtml(selection.option.cost, selection.uses),
	}));
}

async function createSummaryMessage(actor: GenesysActor | null, flag: SymbolSpendingFlag, selections: SymbolSpendSelection[]) {
	const html = await renderTemplate('systems/genesys/templates/chat/symbol-spending.hbs', {
		entries: buildSummaryEntries(selections),
	});
	await ChatMessage.create({
		user: game.user.id,
		speaker: { actor: actor?.id },
		content: html,
	});
}

async function resetSymbolSpending(message: ChatMessage) {
	const flag = message.getFlag(FLAG_SCOPE, FLAG_KEY) as SymbolSpendingFlag | undefined;
	if (!flag || (!flag.positiveSpent && !flag.negativeSpent)) {
		return;
	}

	const actor = await getFlagActor(flag);
	const permission = getActorPermission(actor);
	if (!permission.canSpendPositive && !permission.canSpendNegative) {
		ui.notifications.warn(localize('Genesys.SymbolSpending.NoPermission', 'Nie możesz wydawać tej strony symboli.'));
		return;
	}

	await message.update({
		[`flags.${FLAG_SCOPE}.${FLAG_KEY}.positiveSpent`]: false,
		[`flags.${FLAG_SCOPE}.${FLAG_KEY}.negativeSpent`]: false,
		[`flags.${FLAG_SCOPE}.chaosManifestation.resolved`]: false,
	});
	ui.notifications.info(localize('Genesys.SymbolSpending.Reset', 'Przywrócono pulę symboli do wydania.'));
}

function selectionHasSide(selections: SymbolSpendSelection[], side: 'positive' | 'negative') {
	return selections.some((selection) => (side === 'positive' ? selection.option.side === 'positive' : selection.option.side !== 'positive'));
}

function isJQueryTarget(target: ChatContextTarget): target is JQuery<HTMLElement> {
	return typeof (target as JQuery<HTMLElement>).jquery === 'string';
}

function getMessageFromContextTarget(target: ChatContextTarget) {
	const li = isJQueryTarget(target) ? target : $(target);
	const element = isJQueryTarget(target) ? target[0] : target;
	const closestMessage = element?.closest?.('.chat-message, [data-message-id]');
	const childMessage = li.find('[data-message-id]').first();
	const messageId = li.data('messageId')
		?? li.data('message-id')
		?? li.attr('data-message-id')
		?? element?.dataset?.messageId
		?? closestMessage?.getAttribute('data-message-id')
		?? childMessage.attr('data-message-id')
		?? element?.closest?.('[data-message-id]')?.getAttribute('data-message-id')
		?? li.closest('[data-message-id]').attr('data-message-id');
	return messageId ? game.messages.get(String(messageId)) ?? null : null;
}

function canResetSymbolSpending(message: ChatMessage | null | undefined) {
	const flag = message?.getFlag(FLAG_SCOPE, FLAG_KEY) as SymbolSpendingFlag | undefined;
	return Boolean(flag && (flag.positiveSpent || flag.negativeSpent));
}

function createResetContextOption(): EntryContextOption {
	return {
		name: localize('Genesys.SymbolSpending.ResetContext', 'Przywróć wydawanie symboli'),
		icon: '<i class="fas fa-undo"></i>',
		condition: (li: JQuery) => {
			try {
				return canResetSymbolSpending(getMessageFromContextTarget(li as JQuery<HTMLElement>));
			} catch (error) {
				console.warn('Genesys | Failed to evaluate symbol spending context option.', error);
				return false;
			}
		},
		callback: (li: JQuery) => {
			void (async () => {
				try {
					const message = getMessageFromContextTarget(li as JQuery<HTMLElement>);
					if (message) {
						await resetSymbolSpending(message);
					}
				} catch (error) {
					console.error('Genesys | Failed to reset symbol spending from context menu.', error);
					ui.notifications.error(localize('Genesys.SymbolSpending.ResetFailed', 'Nie udało się przywrócić wydawania symboli.'));
				}
			})();
		},
	};
}

async function applyAutomatedSpends(message: ChatMessage, actor: GenesysActor | null, selections: SymbolSpendSelection[], useStoryPoint: boolean) {
	const critical = selections.find((selection) => selection.option.kind === 'critical');
	if (critical) {
		const bonus = selections.find((selection) => selection.option.kind === 'criticalBonus')?.uses ?? 0;
		await resolveCritical(message, bonus);
	}

	const chaos = selections.find((selection) => selection.option.kind === 'chaos')?.option.chaosChoice;
	if (chaos && actor) {
		await resolveManifestation(actor, message, chaos, useStoryPoint);
	}
}

async function spendSymbols(message: ChatMessage) {
	if (!isActiveEncounter()) {
		ui.notifications.warn(localize('Genesys.SymbolSpending.NotInEncounter', 'Symbole można wydawać tylko w aktywnym spotkaniu.'));
		return;
	}

	const flag = message.getFlag(FLAG_SCOPE, FLAG_KEY) as SymbolSpendingFlag | undefined;
	if (!flag) {
		return;
	}

	const actor = await getFlagActor(flag);
	const result = await promptForSpending(flag, actor);
	if (!result) {
		return;
	}

	await createSummaryMessage(actor, flag, result.selections);
	await applyAutomatedSpends(message, actor, result.selections, result.useStoryPoint);

	if (selectionHasSide(result.selections, 'positive')) {
		await message.setFlag(FLAG_SCOPE, `${FLAG_KEY}.positiveSpent`, true);
	}
	if (selectionHasSide(result.selections, 'negative')) {
		await message.setFlag(FLAG_SCOPE, `${FLAG_KEY}.negativeSpent`, true);
	}
}

export function registerSymbolSpending() {
	(Hooks.on as (hook: string, callback: (...args: unknown[]) => void) => number)('getChatMessageContextOptions', (_chatLog: unknown, rawOptions: unknown) => {
		const options = rawOptions as NativeChatContextOption[];
		const optionName = localize('Genesys.SymbolSpending.ResetContext', 'Przywróć wydawanie symboli');
		if (options.some((option) => option.name === optionName)) {
			return;
		}

		options.push({
			name: optionName,
			icon: '<i class="fas fa-undo"></i>',
			condition: (target: HTMLElement) => {
				try {
					return canResetSymbolSpending(getMessageFromContextTarget(target));
				} catch (error) {
					console.warn('Genesys | Failed to evaluate symbol spending context option.', error);
					return false;
				}
			},
			callback: (target: HTMLElement) => {
				void (async () => {
					try {
						const message = getMessageFromContextTarget(target);
						if (message) {
							await resetSymbolSpending(message);
						}
					} catch (error) {
						console.error('Genesys | Failed to reset symbol spending from context menu.', error);
						ui.notifications.error(localize('Genesys.SymbolSpending.ResetFailed', 'Nie udało się przywrócić wydawania symboli.'));
					}
				})();
			},
		});
	});

	Hooks.on('renderChatMessage', (message: ChatMessage, html: JQuery<HTMLElement>) => {
		const flag = message.getFlag(FLAG_SCOPE, FLAG_KEY) as SymbolSpendingFlag | undefined;
		if (!flag) {
			return;
		}

		const hasSpentSymbols = Boolean(flag.positiveSpent || flag.negativeSpent);
		if (hasSpentSymbols) {
			html.find('[data-action="spend-symbols"]').remove();
		}

		html.find('[data-action="spend-symbols"]').on('click', async (event) => {
			event.preventDefault();
			await spendSymbols(message);
		});
	});
}
