import GenesysActor from '@/actor/GenesysActor';
import { resolveCritical } from '@/combat/AttackResolution';
import type { GenesysRollResults } from '@/dice/GenesysRoller';
import type { ContainedItemQuality } from '@/item/data/BaseWeaponDataModel';
import ItemQualityDataModel from '@/item/data/ItemQualityDataModel';
import { getChaosManifestationChoices, resolveManifestation, type ChaosManifestationChatData, type ChaosManifestationChoice } from '@/magic/ChaosManifestations';

const FLAG_SCOPE = 'genesys';
const SYMBOL_SPENDING_FLAG_KEY = 'symbolSpending';
const ATTACK_FLAG_KEY = 'attackResolution';

type SymbolSide = 'positive' | 'negative';
type SymbolSpendingRollType = 'combat' | 'magic' | 'magicAttack';

type SymbolCost = {
	advantages?: number;
	triumphs?: number;
	threats?: number;
	despairs?: number;
};

type SymbolSpendingAttackData = {
	targetUuid?: string;
	weaponName?: string;
	criticalAllowed?: boolean;
	critical?: number;
	qualities?: ContainedItemQuality[];
};

export type SymbolSpendingFlag = {
	actorUuid: string;
	rollType: SymbolSpendingRollType;
	results: Pick<GenesysRollResults, 'netAdvantage' | 'netThreat' | 'totalTriumph' | 'totalDespair'>;
	attack?: SymbolSpendingAttackData;
	magic?: {
		chaosManifestation?: ChaosManifestationChatData;
	};
	positiveSpent?: boolean;
	negativeSpent?: boolean;
};

type SymbolSpendOption = {
	id: string;
	side: SymbolSide;
	section: 'positive' | 'negative' | 'magic';
	label: string;
	cost: SymbolCost;
	repeatable?: boolean;
	maxUses?: number;
	kind?: 'critical' | 'criticalBonus' | 'quality' | 'chaos' | 'manual';
	chaosChoiceId?: ChaosManifestationChoice['id'];
};

type SymbolSpendSelection = {
	option: SymbolSpendOption;
	uses: number;
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
	return Boolean(game.combat?.started);
}

function hasSpendableSymbols(results: Pick<GenesysRollResults, 'netAdvantage' | 'netThreat' | 'totalTriumph' | 'totalDespair'>) {
	return Math.max(0, results.netAdvantage) > 0 || Math.max(0, results.netThreat) > 0 || Math.max(0, results.totalTriumph) > 0 || Math.max(0, results.totalDespair) > 0;
}

export function buildSymbolSpendingFlag({
	actor,
	rollType,
	results,
	attack,
	chaosManifestation,
}: {
	actor?: GenesysActor;
	rollType?: SymbolSpendingRollType;
	results: GenesysRollResults;
	attack?: SymbolSpendingAttackData;
	chaosManifestation?: ChaosManifestationChatData;
}): SymbolSpendingFlag | undefined {
	if (!actor || !rollType || !isActiveEncounter() || !hasSpendableSymbols(results)) {
		return undefined;
	}

	return {
		actorUuid: actor.uuid,
		rollType,
		results: {
			netAdvantage: Math.max(0, results.netAdvantage),
			netThreat: Math.max(0, results.netThreat),
			totalTriumph: Math.max(0, results.totalTriumph),
			totalDespair: Math.max(0, results.totalDespair),
		},
		attack,
		magic: chaosManifestation ? { chaosManifestation } : undefined,
	};
}

function canSpendPositive(actor: GenesysActor) {
	if (actor.type === 'character') {
		return !game.user.isGM && actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
	}

	return game.user.isGM;
}

function canSpendNegative() {
	return game.user.isGM;
}

function findQualityItem(name: string) {
	return game.items.find((item) => item.type === 'quality' && normalizeName(item.name) === normalizeName(name));
}

function getActiveQualitySpendOptions(qualities: ContainedItemQuality[] = []) {
	return qualities.flatMap((quality) => {
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

		const repeatable = qualityData.activationLimit !== 'once';
		const maxUses = qualityData.activationLimit === 'rating' ? quality.rating : undefined;
		return [
			{
				id: `quality-${normalizeName(quality.name)}`,
				side: 'positive' as const,
				section: 'positive' as const,
				label: quality.isRated ? `${quality.name} ${quality.rating}` : quality.name,
				cost: { advantages, triumphs },
				repeatable,
				maxUses,
				kind: 'quality' as const,
			},
		];
	});
}

function addOption(options: SymbolSpendOption[], option: Omit<SymbolSpendOption, 'side' | 'section'> & { side?: SymbolSide; section?: SymbolSpendOption['section'] }) {
	const side = option.side ?? (option.cost.threats || option.cost.despairs ? 'negative' : 'positive');
	options.push({
		...option,
		side,
		section: option.section ?? side,
	});
}

function addAlternativeOptions(options: SymbolSpendOption[], id: string, label: string, costs: SymbolCost[], side: SymbolSide, section: SymbolSpendOption['section'], repeatable = true) {
	costs.forEach((cost, index) => {
		addOption(options, {
			id: `${id}-${index}`,
			label,
			cost,
			side,
			section,
			repeatable,
			kind: 'manual',
		});
	});
}

function buildPositiveCombatOptions(flag: SymbolSpendingFlag) {
	const options: SymbolSpendOption[] = [];
	const attack = flag.attack;

	if (attack?.criticalAllowed && attack.critical && attack.critical > 0 && flag.results.netAdvantage >= attack.critical) {
		addOption(options, {
			id: 'critical-advantages',
			label: localize('Genesys.SymbolSpending.Options.CriticalByAdvantages', 'Critical Injury'),
			cost: { advantages: attack.critical },
			kind: 'critical',
			repeatable: false,
		});
	}
	if (attack?.criticalAllowed && flag.results.totalTriumph > 0) {
		addOption(options, {
			id: 'critical-triumph',
			label: localize('Genesys.SymbolSpending.Options.CriticalByTriumph', 'Critical Injury'),
			cost: { triumphs: 1 },
			kind: 'critical',
			repeatable: false,
		});
	}

	options.push(...getActiveQualitySpendOptions(attack?.qualities));

	addAlternativeOptions(options, 'recover-strain', localize('Genesys.SymbolSpending.Options.RecoverStrain', 'Recover 1 strain'), [{ advantages: 1 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'boost-next-ally', localize('Genesys.SymbolSpending.Options.BoostNextAlly', "Add Boost to the next allied character's check"), [{ advantages: 1 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'notice-detail', localize('Genesys.SymbolSpending.Options.NoticeDetail', 'Notice an important detail in the encounter'), [{ advantages: 1 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'free-maneuver', localize('Genesys.SymbolSpending.Options.FreeManeuver', 'Perform an immediate free maneuver'), [{ advantages: 2 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'setback-target', localize('Genesys.SymbolSpending.Options.SetbackTarget', "Add Setback to the target's next check"), [{ advantages: 2 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'boost-any-ally', localize('Genesys.SymbolSpending.Options.BoostAnyAlly', "Add Boost to any allied character's next check"), [{ advantages: 2 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'negate-defense', localize('Genesys.SymbolSpending.Options.NegateDefense', "Negate the target's defense until end of round"), [{ advantages: 3 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'ignore-environment', localize('Genesys.SymbolSpending.Options.IgnoreEnvironment', 'Ignore penalizing environmental effects'), [{ advantages: 3 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'disable-instead-damage', localize('Genesys.SymbolSpending.Options.DisableInsteadDamage', 'Disable the target or gear instead of dealing wounds or strain'), [{ advantages: 3 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'gain-defense', localize('Genesys.SymbolSpending.Options.GainDefense', 'Gain +1 melee or ranged defense'), [{ advantages: 3 }, { triumphs: 1 }], 'positive', 'positive');
	addAlternativeOptions(options, 'force-drop', localize('Genesys.SymbolSpending.Options.ForceDrop', 'Force the target to drop a weapon'), [{ advantages: 3 }, { triumphs: 1 }], 'positive', 'positive');
	addOption(options, { id: 'upgrade-target-difficulty', label: localize('Genesys.SymbolSpending.Options.UpgradeTargetDifficulty', "Upgrade the target's next check difficulty"), cost: { triumphs: 1 }, repeatable: true, kind: 'manual' });
	addOption(options, { id: 'upgrade-ally-ability', label: localize('Genesys.SymbolSpending.Options.UpgradeAllyAbility', "Upgrade an allied character's next check ability"), cost: { triumphs: 1 }, repeatable: true, kind: 'manual' });
	addOption(options, { id: 'do-vital', label: localize('Genesys.SymbolSpending.Options.DoVital', 'Do something vital in the encounter'), cost: { triumphs: 1 }, repeatable: true, kind: 'manual' });
	addOption(options, { id: 'destroy-equipment', label: localize('Genesys.SymbolSpending.Options.DestroyEquipment', "Destroy a piece of the target's equipment"), cost: { triumphs: 2 }, repeatable: true, kind: 'manual' });

	return options;
}

function buildNegativeCombatOptions() {
	const options: SymbolSpendOption[] = [];
	addAlternativeOptions(options, 'suffer-strain', localize('Genesys.SymbolSpending.Options.SufferStrain', 'Active character suffers 1 strain'), [{ threats: 1 }, { despairs: 1 }], 'negative', 'negative');
	addAlternativeOptions(options, 'lose-maneuver-benefit', localize('Genesys.SymbolSpending.Options.LoseManeuverBenefit', 'Lose the benefit of a prior maneuver'), [{ threats: 1 }, { despairs: 1 }], 'negative', 'negative');
	addAlternativeOptions(options, 'opponent-free-maneuver', localize('Genesys.SymbolSpending.Options.OpponentFreeManeuver', 'An opponent immediately performs a free maneuver'), [{ threats: 2 }, { despairs: 1 }], 'negative', 'negative');
	addAlternativeOptions(options, 'boost-targeted-character', localize('Genesys.SymbolSpending.Options.BoostTargetedCharacter', "Add Boost to the targeted character's next check"), [{ threats: 2 }, { despairs: 1 }], 'negative', 'negative');
	addAlternativeOptions(options, 'setback-active-or-ally', localize('Genesys.SymbolSpending.Options.SetbackActiveOrAlly', 'Active character or ally suffers Setback on next action'), [{ threats: 2 }, { despairs: 1 }], 'negative', 'negative');
	addAlternativeOptions(options, 'fall-prone', localize('Genesys.SymbolSpending.Options.FallProne', 'Active character falls prone'), [{ threats: 3 }, { despairs: 1 }], 'negative', 'negative');
	addAlternativeOptions(options, 'enemy-advantage', localize('Genesys.SymbolSpending.Options.EnemyAdvantage', 'Grant the enemy a significant advantage'), [{ threats: 3 }, { despairs: 1 }], 'negative', 'negative');
	addOption(options, { id: 'out-of-ammo', label: localize('Genesys.SymbolSpending.Options.OutOfAmmo', 'Weapon runs out of ammunition for the encounter'), cost: { despairs: 1 }, side: 'negative', section: 'negative', repeatable: false, kind: 'manual' });
	addOption(options, { id: 'upgrade-ally-difficulty', label: localize('Genesys.SymbolSpending.Options.UpgradeAllyDifficulty', "Upgrade an allied or active character's next check difficulty"), cost: { despairs: 1 }, side: 'negative', section: 'negative', repeatable: true, kind: 'manual' });
	addOption(options, { id: 'damage-weapon-tool', label: localize('Genesys.SymbolSpending.Options.DamageWeaponTool', 'Used tool, Brawl weapon, or Melee weapon becomes damaged'), cost: { despairs: 1 }, side: 'negative', section: 'negative', repeatable: true, kind: 'manual' });
	return options;
}

function buildMagicNegativeOptions(flag: SymbolSpendingFlag) {
	const options: SymbolSpendOption[] = [];
	addAlternativeOptions(options, 'magic-strain-or-wound', localize('Genesys.SymbolSpending.Options.MagicStrainOrWound', 'Caster suffers 2 strain or 1 wound'), [{ threats: 1 }, { despairs: 1 }], 'negative', 'magic');
	addAlternativeOptions(options, 'magic-setback-allies', localize('Genesys.SymbolSpending.Options.MagicSetbackAllies', 'Caster and allies add Setback to spellcasting until next turn'), [{ threats: 1 }, { despairs: 1 }], 'negative', 'magic');
	addAlternativeOptions(options, 'magic-delayed', localize('Genesys.SymbolSpending.Options.MagicDelayed', 'Spell effect is delayed until next round'), [{ threats: 2 }, { despairs: 1 }], 'negative', 'magic');
	addAlternativeOptions(options, 'magic-item-damaged', localize('Genesys.SymbolSpending.Options.MagicItemDamaged', 'Used magic item suffers 1 damage level'), [{ threats: 2 }, { despairs: 1 }], 'negative', 'magic');
	addAlternativeOptions(options, 'magic-enemy-boost', localize('Genesys.SymbolSpending.Options.MagicEnemyBoost', 'Enemy spellcasters add Boost against this character'), [{ threats: 2 }, { despairs: 1 }], 'negative', 'magic');
	addAlternativeOptions(options, 'magic-extra-target', localize('Genesys.SymbolSpending.Options.MagicExtraTarget', 'Spell affects one additional GM-chosen character'), [{ threats: 3 }, { despairs: 1 }], 'negative', 'magic');
	addAlternativeOptions(options, 'magic-detected', localize('Genesys.SymbolSpending.Options.MagicDetected', 'Magic-sensitive beings can sense the caster'), [{ threats: 3 }, { despairs: 1 }], 'negative', 'magic');
	addOption(options, { id: 'magic-no-casting', label: localize('Genesys.SymbolSpending.Options.MagicNoCasting', 'Caster cannot cast until end of encounter or scene'), cost: { despairs: 1 }, side: 'negative', section: 'magic', repeatable: false, kind: 'manual' });
	addOption(options, { id: 'magic-gm-target', label: localize('Genesys.SymbolSpending.Options.MagicGmTarget', 'GM chooses the spell target'), cost: { despairs: 1 }, side: 'negative', section: 'magic', repeatable: false, kind: 'manual' });
	addOption(options, { id: 'magic-critical-consequence', label: localize('Genesys.SymbolSpending.Options.MagicCriticalConsequence', 'Caster suffers a critical magical consequence'), cost: { despairs: 2 }, side: 'negative', section: 'magic', repeatable: false, kind: 'manual' });
	addOption(options, { id: 'magic-item-destroyed', label: localize('Genesys.SymbolSpending.Options.MagicItemDestroyed', 'Used magic item is destroyed'), cost: { despairs: 2 }, side: 'negative', section: 'magic', repeatable: false, kind: 'manual' });

	const chaosData = flag.magic?.chaosManifestation;
	if (chaosData && !chaosData.resolved) {
		for (const choice of getChaosManifestationChoices(chaosData)) {
			addOption(options, {
				id: `chaos-${choice.id}`,
				label: localize(choice.labelKey, choice.fallbackLabel),
				cost: {
					threats: [...choice.usedSymbols].filter((symbol) => symbol === 'h').length,
					despairs: [...choice.usedSymbols].filter((symbol) => symbol === 'd').length,
				},
				side: 'negative',
				section: 'magic',
				repeatable: false,
				kind: 'chaos',
				chaosChoiceId: choice.id,
			});
		}
	}

	return options;
}

function buildOptions(flag: SymbolSpendingFlag) {
	const options: SymbolSpendOption[] = [];
	if (flag.rollType === 'combat' || flag.rollType === 'magicAttack') {
		options.push(...buildPositiveCombatOptions(flag), ...buildNegativeCombatOptions());
	}
	if (flag.rollType === 'magic' || flag.rollType === 'magicAttack') {
		options.push(...buildMagicNegativeOptions(flag));
	}
	return options;
}

function getCostTotal(cost: SymbolCost, uses = 1) {
	return {
		advantages: (cost.advantages ?? 0) * uses,
		triumphs: (cost.triumphs ?? 0) * uses,
		threats: (cost.threats ?? 0) * uses,
		despairs: (cost.despairs ?? 0) * uses,
	};
}

function getSpent(selections: SymbolSpendSelection[]) {
	return selections.reduce(
		(total, selection) => {
			const cost = getCostTotal(selection.option.cost, selection.uses);
			return {
				advantages: total.advantages + cost.advantages,
				triumphs: total.triumphs + cost.triumphs,
				threats: total.threats + cost.threats,
				despairs: total.despairs + cost.despairs,
			};
		},
		{ advantages: 0, triumphs: 0, threats: 0, despairs: 0 },
	);
}

function getRemaining(flag: SymbolSpendingFlag, selections: SymbolSpendSelection[]) {
	const spent = getSpent(selections);
	return {
		advantages: Math.max(0, flag.results.netAdvantage - spent.advantages),
		triumphs: Math.max(0, flag.results.totalTriumph - spent.triumphs),
		threats: Math.max(0, flag.results.netThreat - spent.threats),
		despairs: Math.max(0, flag.results.totalDespair - spent.despairs),
	};
}

function getSelectionCount(selections: SymbolSpendSelection[], optionId: string) {
	return selections.find((selection) => selection.option.id === optionId)?.uses ?? 0;
}

function symbolsToInlineHtml(symbols: string) {
	return `<span class="font-genesys-symbols nolig">${symbols}</span>`;
}

function costToInlineHtml(cost: SymbolCost, uses = 1) {
	const total = getCostTotal(cost, uses);
	return [
		total.advantages ? symbolsToInlineHtml('a'.repeat(total.advantages)) : '',
		total.triumphs ? symbolsToInlineHtml('t'.repeat(total.triumphs)) : '',
		total.threats ? symbolsToInlineHtml('h'.repeat(total.threats)) : '',
		total.despairs ? symbolsToInlineHtml('d'.repeat(total.despairs)) : '',
	].join('');
}

function canAfford(option: SymbolSpendOption, remaining: ReturnType<typeof getRemaining>) {
	return (
		remaining.advantages >= (option.cost.advantages ?? 0) &&
		remaining.triumphs >= (option.cost.triumphs ?? 0) &&
		remaining.threats >= (option.cost.threats ?? 0) &&
		remaining.despairs >= (option.cost.despairs ?? 0)
	);
}

function sectionLabel(section: SymbolSpendOption['section']) {
	if (section === 'positive') return localize('Genesys.SymbolSpending.PositiveSymbols', 'Positive Symbols');
	if (section === 'negative') return localize('Genesys.SymbolSpending.NegativeSymbols', 'Negative Symbols');
	return localize('Genesys.SymbolSpending.MagicSymbols', 'Magic');
}

function renderOption(option: SymbolSpendOption, flag: SymbolSpendingFlag, selections: SymbolSpendSelection[], disabledByAccess: boolean) {
	const remaining = getRemaining(flag, selections);
	const currentCount = getSelectionCount(selections, option.id);
	const maxReached = option.maxUses !== undefined && currentCount >= option.maxUses;
	const repeatBlocked = !option.repeatable && currentCount > 0;
	const criticalSelected = selections.some((selection) => selection.option.kind === 'critical');
	const criticalBlocked = option.kind === 'critical' && criticalSelected && currentCount === 0;
	const disabled = disabledByAccess || maxReached || repeatBlocked || criticalBlocked || !canAfford(option, remaining);

	return `
		<button type="button" class="symbol-spend-option" data-option-id="${option.id}" ${disabled ? 'disabled' : ''}>
			<span class="symbol-spend-option-label">${option.label}</span>
			<span class="symbol-spend-option-cost">${costToInlineHtml(option.cost)}</span>
		</button>
	`;
}

function getVisibleOptions(options: SymbolSpendOption[], selections: SymbolSpendSelection[]) {
	const hasCritical = selections.some((selection) => selection.option.kind === 'critical');
	const regularOptions = options.filter((option) => option.kind !== 'criticalBonus');
	if (!hasCritical) {
		return regularOptions;
	}

	return [
		...regularOptions,
		{
			id: 'critical-bonus',
			side: 'positive',
			section: 'positive',
			label: localize('Genesys.SymbolSpending.Options.CriticalBonus', 'Critical Injury bonus +10'),
			cost: { advantages: 1 },
			repeatable: true,
			kind: 'criticalBonus',
		} satisfies SymbolSpendOption,
	];
}

function renderDialogContent(actor: GenesysActor, flag: SymbolSpendingFlag, baseOptions: SymbolSpendOption[], selections: SymbolSpendSelection[]) {
	const remaining = getRemaining(flag, selections);
	const options = getVisibleOptions(baseOptions, selections);
	const positiveAccess = canSpendPositive(actor) && !flag.positiveSpent;
	const negativeAccess = canSpendNegative() && !flag.negativeSpent;

	const sections: SymbolSpendOption['section'][] = ['positive', 'negative', 'magic'];
	const sectionHtml = sections
		.map((section) => {
			const sectionOptions = options.filter((option) => option.section === section);
			if (!sectionOptions.length) {
				return '';
			}
			const allowed = section === 'positive' ? positiveAccess : negativeAccess;
			return `
				<section class="symbol-spend-section ${allowed ? '' : 'locked'}">
					<h4>${sectionLabel(section)}</h4>
					<div class="symbol-spend-options">
						${sectionOptions.map((option) => renderOption(option, flag, selections, !allowed)).join('')}
					</div>
				</section>
			`;
		})
		.join('');

	const selectedRows = selections.length
		? selections
				.map(
					(selection) => `
						<li>
							<span>${selection.option.label}${selection.uses > 1 ? ` x${selection.uses}` : ''}</span>
							<span>${costToInlineHtml(selection.option.cost, selection.uses)}</span>
							<button type="button" data-remove-option-id="${selection.option.id}">-</button>
						</li>
					`,
				)
				.join('')
		: `<li>${localize('Genesys.SymbolSpending.NoSymbolSpends', 'No symbols spent yet.')}</li>`;

	const hasChaosOptions = options.some((option) => option.kind === 'chaos');
	const storyPointOption = hasChaosOptions
		? `<label class="symbol-spend-story-point"><input type="checkbox" name="useStoryPoint"> ${localize('Genesys.ChaosManifestation.UseStoryPoint', 'Use Story Point')}</label>`
		: '';

	return `
		<div class="symbol-spend-dialog-body">
			<p>${localize('Genesys.SymbolSpending.Hint', 'Choose how to spend symbols from this encounter roll.')}</p>
			<div class="symbol-spend-pool">
				<span>${localize('Genesys.SymbolSpending.Advantages', 'Advantages')}</span><strong>${remaining.advantages}</strong>
				<span>${localize('Genesys.SymbolSpending.Triumphs', 'Triumphs')}</span><strong>${remaining.triumphs}</strong>
				<span>${localize('Genesys.SymbolSpending.Threats', 'Threats')}</span><strong>${remaining.threats}</strong>
				<span>${localize('Genesys.SymbolSpending.Despairs', 'Despairs')}</span><strong>${remaining.despairs}</strong>
			</div>
			${sectionHtml}
			${storyPointOption}
			<div class="symbol-spend-selected">
				<h4>${localize('Genesys.SymbolSpending.SelectedSpends', 'Selected spends')}</h4>
				<ul>${selectedRows}</ul>
			</div>
		</div>
	`;
}

async function promptForSpends(actor: GenesysActor, flag: SymbolSpendingFlag) {
	const baseOptions = buildOptions(flag);
	const selections: SymbolSpendSelection[] = [];

	return new Promise<{ selections: SymbolSpendSelection[]; useStoryPoint: boolean } | null>((resolve) => {
		let dialog: Dialog;
		let useStoryPoint = false;
		const refresh = (html: JQuery<HTMLElement>) => {
			const previousStoryPoint = Boolean(html[0].querySelector<HTMLInputElement>('[name="useStoryPoint"]')?.checked);
			html.find('.dialog-content').html(renderDialogContent(actor, flag, baseOptions, selections));
			const storyPointInput = html[0].querySelector<HTMLInputElement>('[name="useStoryPoint"]');
			if (storyPointInput) {
				storyPointInput.checked = previousStoryPoint || useStoryPoint;
				storyPointInput.addEventListener('change', () => {
					useStoryPoint = storyPointInput.checked;
				});
			}
			html.find('[data-option-id]').on('click', (event) => {
				const optionId = (event.currentTarget as HTMLElement).dataset.optionId;
				const option = getVisibleOptions(baseOptions, selections).find((candidate) => candidate.id === optionId);
				if (!option) {
					return;
				}

				const existing = selections.find((selection) => selection.option.id === option.id);
				if (existing) {
					existing.uses += 1;
				} else {
					selections.push({ option, uses: 1 });
				}
				refresh(html);
			});
			html.find('[data-remove-option-id]').on('click', (event) => {
				const optionId = (event.currentTarget as HTMLElement).dataset.removeOptionId;
				const index = selections.findIndex((selection) => selection.option.id === optionId);
				if (index < 0) {
					return;
				}
				const selection = selections[index];
				if (selection.uses > 1) {
					selection.uses -= 1;
				} else {
					selections.splice(index, 1);
					if (selection.option.kind === 'critical') {
						const bonusIndex = selections.findIndex((candidate) => candidate.option.kind === 'criticalBonus');
						if (bonusIndex >= 0) selections.splice(bonusIndex, 1);
					}
				}
				refresh(html);
			});
		};

		dialog = new Dialog(
			{
				title: localize('Genesys.SymbolSpending.Title', 'Spend Symbols'),
				content: renderDialogContent(actor, flag, baseOptions, selections),
				buttons: {
					confirm: {
						label: localize('Genesys.SymbolSpending.Confirm', 'Confirm'),
						callback: (html) => {
							const input = html[0].querySelector<HTMLInputElement>('[name="useStoryPoint"]');
							resolve({ selections: [...selections], useStoryPoint: Boolean(input?.checked ?? useStoryPoint) });
						},
					},
					cancel: {
						label: localize('Genesys.SymbolSpending.Cancel', 'Cancel'),
						callback: () => resolve(null),
					},
				},
				render: (html) => refresh(html instanceof HTMLElement ? $(html) : html),
				close: () => resolve(null),
			},
			{ classes: ['symbol-spend-dialog'] },
		);
		dialog.render(true);
	});
}

function buildSummaryEntries(selections: SymbolSpendSelection[]) {
	return selections.map((selection) => ({
		label: selection.option.label,
		uses: selection.uses,
		costHtml: costToInlineHtml(selection.option.cost, selection.uses),
		side: selection.option.side,
		section: selection.option.section,
	}));
}

async function createSummaryMessage(actor: GenesysActor, flag: SymbolSpendingFlag, selections: SymbolSpendSelection[]) {
	const remaining = getRemaining(flag, selections);
	const html = await renderTemplate('systems/genesys/templates/chat/symbol-spend.hbs', {
		actorName: actor.name,
		entries: buildSummaryEntries(selections),
		remaining,
	});
	await ChatMessage.create({
		user: game.user.id,
		speaker: { actor: actor.id },
		content: html,
	});
}

async function spendSymbols(message: ChatMessage) {
	const flag = message.getFlag(FLAG_SCOPE, SYMBOL_SPENDING_FLAG_KEY) as SymbolSpendingFlag | undefined;
	if (!flag) {
		return;
	}

	const actor = (await fromUuid(flag.actorUuid)) as GenesysActor | null;
	if (!actor) {
		ui.notifications.warn(localize('Genesys.SymbolSpending.MissingActor', 'The acting character could not be found.'));
		return;
	}

	const result = await promptForSpends(actor, flag);
	if (!result) {
		return;
	}

	const selections = result.selections;
	if (!selections.length) {
		return;
	}

	await createSummaryMessage(actor, flag, selections);

	const criticalSelection = selections.find((selection) => selection.option.kind === 'critical');
	if (criticalSelection) {
		const criticalBonus = selections.find((selection) => selection.option.kind === 'criticalBonus')?.uses ?? 0;
		await resolveCritical(message, criticalBonus);
	}

	const chaosSelection = selections.find((selection) => selection.option.kind === 'chaos' && selection.option.chaosChoiceId);
	if (chaosSelection?.option.chaosChoiceId) {
		const choices = flag.magic?.chaosManifestation ? getChaosManifestationChoices(flag.magic.chaosManifestation) : [];
		const choice = choices.find((candidate) => candidate.id === chaosSelection.option.chaosChoiceId);
		if (choice) {
			await resolveManifestation(actor, message, choice, result.useStoryPoint);
		}
	}

	const spentPositive = selections.some((selection) => selection.option.side === 'positive');
	const spentNegative = selections.some((selection) => selection.option.side === 'negative');
	await message.setFlag(FLAG_SCOPE, SYMBOL_SPENDING_FLAG_KEY, {
		...flag,
		positiveSpent: flag.positiveSpent || spentPositive,
		negativeSpent: flag.negativeSpent || spentNegative,
		magic: flag.magic?.chaosManifestation && chaosSelection ? { chaosManifestation: { ...flag.magic.chaosManifestation, resolved: true } } : flag.magic,
	});
}

function updateButtonState(message: ChatMessage, html: JQuery<HTMLElement>, flag: SymbolSpendingFlag | undefined) {
	if (!flag) {
		return;
	}

	const button = html.find('[data-action="spend-symbols"]');
	if (flag.positiveSpent && flag.negativeSpent) {
		button.prop('disabled', true).text(localize('Genesys.SymbolSpending.Resolved', 'Symbols spent'));
	}
}

export function registerSymbolSpending() {
	Hooks.on('renderChatMessage', (message: ChatMessage, html: JQuery<HTMLElement>) => {
		const flag = message.getFlag(FLAG_SCOPE, SYMBOL_SPENDING_FLAG_KEY) as SymbolSpendingFlag | undefined;
		updateButtonState(message, html, flag);

		html.find('[data-action="spend-symbols"]').on('click', async (event) => {
			event.preventDefault();
			await spendSymbols(message);
		});
	});
}

export function hasSymbolSpendingFlag(message: ChatMessage) {
	return Boolean(message.getFlag(FLAG_SCOPE, SYMBOL_SPENDING_FLAG_KEY));
}

export { SYMBOL_SPENDING_FLAG_KEY, FLAG_SCOPE as SYMBOL_SPENDING_FLAG_SCOPE, ATTACK_FLAG_KEY as SYMBOL_SPENDING_ATTACK_FLAG_KEY };
