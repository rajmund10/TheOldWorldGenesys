import GenesysActor from '@/actor/GenesysActor';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import MinionDataModel from '@/actor/data/MinionDataModel';
import type { GenesysRollResults, AttackRollWeapon } from '@/dice/GenesysRoller';
import type { ContainedItemQuality } from '@/item/data/BaseWeaponDataModel';
import EquipmentDataModel, { EquipmentState } from '@/item/data/EquipmentDataModel';
import ItemQualityDataModel from '@/item/data/ItemQualityDataModel';
import GenesysItem from '@/item/GenesysItem';
import { CombatEffectKeys, getActorCombatEffectValue, getHighestQualityCombatEffectValue, getQualityCombatEffectValue, hasActorCombatEffect, hasQualityCombatEffect } from '@/combat/CombatEffects';
import type { ChaosManifestationChatData } from '@/magic/ChaosManifestations';

const FLAG_SCOPE = 'genesys';
const ATTACK_FLAG_KEY = 'attackResolution';
const CRITICAL_TABLE_NAME = 'Efekty Urazów Krytycznych';
const VALID_TARGET_TYPES = ['character', 'minion', 'rival', 'nemesis'];

type AttackMessageFlag = {
	attackerUuid?: string;
	targetUuid: string;
	weaponName: string;
	range: AttackRollWeapon['systemData']['range'];
	totalDamage: number;
	critical: number;
	qualities: ContainedItemQuality[];
	results: Pick<GenesysRollResults, 'netSuccess' | 'netAdvantage' | 'netThreat' | 'totalTriumph' | 'totalDespair'>;
	chaosManifestation?: ChaosManifestationChatData;
	stunDamage: boolean;
	damageResolved?: boolean;
};

type AttackResolutionWeapon = {
	name: string;
	systemData: Pick<AttackRollWeapon['systemData'], 'range' | 'critical' | 'qualities'>;
};

type DefenseMessageFlag = {
	sourceMessageUuid: string;
	resolved?: boolean;
};

type ResolutionMessageFlag = {
	sourceMessageUuid: string;
	targetUuid: string;
	criticalResolved?: boolean;
	symbolsSpent?: boolean;
	criticalAllowed: boolean;
	netAdvantage: number;
	netThreat: number;
	totalTriumph: number;
	totalDespair: number;
	critical: number;
	weaponName: string;
	qualities: ContainedItemQuality[];
};

type DefenseBreakdown = {
	targetName: string;
	weaponName: string;
	totalDamage: number;
	baseSoak: number;
	pierce: number;
	reinforced: boolean;
	effectiveSoak: number;
	canParry: boolean;
	parryRank: number;
	parryQuality: number;
	parryReduction: number;
	woundsWithoutParry: number;
	woundsWithParry: number;
	stunDamage: boolean;
};

type DamageResolutionData = DefenseBreakdown & {
	usedParry: boolean;
	finalWounds: number;
	canSpendSymbols: boolean;
};

type SymbolCost = {
	advantages?: number;
	triumphs?: number;
};

type SymbolSpendOption = {
	id: string;
	label: string;
	cost: SymbolCost;
	repeatable?: boolean;
	maxUses?: number;
	kind?: 'critical' | 'criticalBonus' | 'quality' | 'manual';
	note?: string;
};

type SymbolSpendSelection = {
	option: SymbolSpendOption;
	uses: number;
};

type SymbolSpendSummaryEntry = {
	label: string;
	uses: number;
	advantages: number;
	triumphs: number;
};

type CriticalBreakdown = {
	targetName: string;
	baseRoll: number;
	extraAdvantages: number;
	previousInjuries: number;
	vicious: number;
	durable: number;
	finalResult: number;
	injuryLink?: string;
	injuryName?: string;
	injuryEffect?: string;
	injuryFallbackHtml?: string;
	minionRemoved?: boolean;
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

function stripHtml(value: string) {
	const element = document.createElement('div');
	element.innerHTML = value;
	return (element.textContent ?? element.innerText ?? '').trim();
}

function getTargetActor() {
	if (game.user.targets.size !== 1) {
		return null;
	}

	const [target] = game.user.targets;
	const actor = target.actor as GenesysActor | null;
	return actor && VALID_TARGET_TYPES.includes(actor.type) ? actor : null;
}

function getEquippedItems(actor: GenesysActor) {
	return (Array.from(actor.items) as GenesysItem[]).filter((item) => {
		if (!['weapon', 'armor', 'magicAccessory'].includes(item.type)) {
			return false;
		}

		return (item.systemData as EquipmentDataModel).state === EquipmentState.Equipped;
	});
}

function hasReinforcedArmor(actor: GenesysActor) {
	return getEquippedItems(actor).some(
		(item) => item.type === 'armor' && hasQualityCombatEffect(((item.systemData as { qualities?: ContainedItemQuality[] }).qualities ?? []) as ContainedItemQuality[], CombatEffectKeys.DefenseIgnorePierce),
	);
}

function getSoak(actor: GenesysActor) {
	if (actor.type === 'character') {
		return (actor.systemData as CharacterDataModel).totalSoak;
	}

	return Number((actor.systemData as { soak?: number }).soak ?? 0);
}

function canUseParry(actor: GenesysActor, range: AttackRollWeapon['systemData']['range']) {
	const hasParry = hasActorCombatEffect(actor, CombatEffectKeys.DefenseCanParry);
	if (!hasParry) {
		return false;
	}

	if (range === 'engaged') {
		return true;
	}

	return hasActorCombatEffect(actor, CombatEffectKeys.DefenseCanBlockRanged) && hasActorCombatEffect(actor, CombatEffectKeys.DefenseShield);
}

function getWhisperRecipients(actor: GenesysActor) {
	return game.users
		.filter((user) => user.isGM || actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER))
		.map((user) => user.id);
}

function buildDefenseBreakdown(target: GenesysActor, flag: AttackMessageFlag): DefenseBreakdown {
	const baseSoak = getSoak(target);
	const reinforced = hasReinforcedArmor(target);
	const pierce = reinforced ? 0 : Math.min(baseSoak, getQualityCombatEffectValue(flag.qualities, CombatEffectKeys.AttackPierce));
	const effectiveSoak = Math.max(0, baseSoak - pierce);
	const parryRank = Math.max(0, getActorCombatEffectValue(target, CombatEffectKeys.DefenseParryReduction));
	const parryQuality = getHighestQualityCombatEffectValue(
		getEquippedItems(target).filter((item) => item.type === 'weapon'),
		CombatEffectKeys.DefenseParryReduction,
	);
	const canParry = canUseParry(target, flag.range);
	const parryReduction = canParry ? 2 + parryRank + parryQuality : 0;
	const woundsWithoutParry = Math.max(0, flag.totalDamage - effectiveSoak);
	const woundsWithParry = Math.max(0, flag.totalDamage - parryReduction - effectiveSoak);

	return {
		targetName: target.name,
		weaponName: flag.weaponName,
		totalDamage: flag.totalDamage,
		baseSoak,
		pierce,
		reinforced,
		effectiveSoak,
		canParry,
		parryRank,
		parryQuality,
		parryReduction,
		woundsWithoutParry,
		woundsWithParry,
		stunDamage: flag.stunDamage,
	};
}

async function applyWounds(target: GenesysActor, wounds: number) {
	if (wounds <= 0) {
		return;
	}

	const currentWounds = Number((target.system as any).wounds?.value ?? 0);
	await target.update({ 'system.wounds.value': currentWounds + wounds });
}

async function applyDamage(target: GenesysActor, amount: number, stunDamage: boolean) {
	if (amount <= 0) {
		return;
	}

	const targetHasStrainPool = typeof (target.system as any).strain?.value === 'number';
	if (stunDamage && targetHasStrainPool) {
		const currentStrain = Number((target.system as any).strain?.value ?? 0);
		await target.update({ 'system.strain.value': currentStrain + amount });
		return;
	}

	await applyWounds(target, amount);
}

function getCriticalTable() {
	return game.tables.find((table) => normalizeName(table.name) === normalizeName(CRITICAL_TABLE_NAME));
}

function getCriticalResult(table: RollTable, result: number) {
	const lookupResult = Math.min(result, 999);
	return table.results.find((entry) => {
		const range = (entry as unknown as { range?: [number, number] }).range;
		return !!range && range[0] <= lookupResult && range[1] >= lookupResult;
	});
}

function getLinkedInjury(result: unknown) {
	const tableResult = result as
		| {
				collection?: string;
				documentCollection?: string;
				documentId?: string;
				resultId?: string;
				text?: string;
		  }
		| undefined;
	if (!tableResult) {
		return null;
	}

	const collection = tableResult.documentCollection ?? tableResult.collection;
	const resultId = tableResult.documentId ?? tableResult.resultId;
	if (collection === 'Item' && resultId) {
		const linkedItem = game.items.get(resultId);
		if (linkedItem?.type === 'injury') {
			return linkedItem;
		}
	}

	const text = tableResult.text;
	if (!text) {
		return null;
	}

	const strongMatch = text.match(/<strong>(.*?)<\/strong>/i);
	const plainText = stripHtml(strongMatch?.[1] ?? text);
	const name = plainText.split(/\s*\[/)[0]?.split(':')[0]?.trim();
	if (!name) {
		return null;
	}

	return game.items.find((item) => item.type === 'injury' && normalizeName(item.name) === normalizeName(name)) ?? null;
}

function getCriticalResultFallbackHtml(result: unknown) {
	return (result as unknown as { text?: string } | undefined)?.text;
}

async function createDefensePrompt(sourceMessage: ChatMessage, target: GenesysActor, flag: AttackMessageFlag) {
	const data = buildDefenseBreakdown(target, flag);
	const html = await renderTemplate('systems/genesys/templates/chat/attack-defense.hbs', data);

	await ChatMessage.create({
		user: game.user.id,
		speaker: { actor: target.id },
		content: html,
		whisper: getWhisperRecipients(target),
		flags: {
			[FLAG_SCOPE]: {
				[ATTACK_FLAG_KEY]: {
					sourceMessageUuid: sourceMessage.uuid,
				} satisfies DefenseMessageFlag,
			},
		},
	});
}

async function createDamageResolutionMessage(sourceMessage: ChatMessage, target: GenesysActor, flag: AttackMessageFlag, usedParry: boolean) {
	const breakdown = buildDefenseBreakdown(target, flag);
	const finalWounds = usedParry ? breakdown.woundsWithParry : breakdown.woundsWithoutParry;
	const netAdvantage = Math.max(0, flag.results.netAdvantage);
	const netThreat = Math.max(0, flag.results.netThreat);
	const totalTriumph = Math.max(0, flag.results.totalTriumph);
	const totalDespair = Math.max(0, flag.results.totalDespair);
	const data: DamageResolutionData = {
		...breakdown,
		usedParry,
		finalWounds,
		canSpendSymbols: false,
	};
	const html = await renderTemplate('systems/genesys/templates/chat/attack-resolution.hbs', data);

	await applyDamage(target, finalWounds, flag.stunDamage);
	await ChatMessage.create({
		user: game.user.id,
		speaker: { actor: target.id },
		content: html,
		flags: {
			[FLAG_SCOPE]: {
				[ATTACK_FLAG_KEY]: {
					sourceMessageUuid: sourceMessage.uuid,
					targetUuid: target.uuid,
					criticalAllowed: finalWounds > 0,
					netAdvantage,
					netThreat,
					totalTriumph,
					totalDespair,
					critical: flag.critical,
					weaponName: flag.weaponName,
					qualities: flag.qualities,
				} satisfies ResolutionMessageFlag,
			},
		},
	});
	await sourceMessage.setFlag(FLAG_SCOPE, `${ATTACK_FLAG_KEY}.damageResolved`, true);
}

async function resolveDamage(defenseMessage: ChatMessage, usedParry: boolean) {
	const defenseFlag = defenseMessage.getFlag(FLAG_SCOPE, ATTACK_FLAG_KEY) as DefenseMessageFlag | undefined;
	if (!defenseFlag || defenseFlag.resolved) {
		return;
	}

	const sourceMessage = (await fromUuid(defenseFlag.sourceMessageUuid)) as ChatMessage | null;
	const attackFlag = sourceMessage?.getFlag(FLAG_SCOPE, ATTACK_FLAG_KEY) as AttackMessageFlag | undefined;
	const target = attackFlag ? ((await fromUuid(attackFlag.targetUuid)) as GenesysActor | null) : null;
	if (!sourceMessage || !attackFlag || !target) {
		ui.notifications.warn(localize('Genesys.AttackResolution.MissingData', 'Attack data could not be found.'));
		return;
	}

	await createDamageResolutionMessage(sourceMessage, target, attackFlag, usedParry);
	await defenseMessage.setFlag(FLAG_SCOPE, `${ATTACK_FLAG_KEY}.resolved`, true);
}

async function createCriticalMessage(target: GenesysActor, data: CriticalBreakdown) {
	const html = await renderTemplate('systems/genesys/templates/chat/critical-injury.hbs', data);
	const content = await TextEditor.enrichHTML(html, { async: true });
	await ChatMessage.create({
		user: game.user.id,
		speaker: { actor: target.id },
		content,
	});
}

export async function resolveCritical(message: ChatMessage, extraAdvantages = 0) {
	const flag = message.getFlag(FLAG_SCOPE, ATTACK_FLAG_KEY) as ResolutionMessageFlag | undefined;
	if (!flag || flag.criticalResolved) {
		return;
	}

	const target = (await fromUuid(flag.targetUuid)) as GenesysActor | null;
	if (!target) {
		ui.notifications.warn(localize('Genesys.AttackResolution.MissingTarget', 'Attack target could not be found.'));
		return;
	}

	if (target.type === 'minion') {
		const minionData = target.systemData as MinionDataModel;
		const wounds = minionData.wounds.threshold + 1;
		await applyWounds(target, wounds);
		await createCriticalMessage(target, {
			targetName: target.name,
			baseRoll: 0,
			extraAdvantages,
			previousInjuries: 0,
			vicious: 0,
			durable: 0,
			finalResult: 0,
			minionRemoved: true,
		});
		await message.setFlag(FLAG_SCOPE, `${ATTACK_FLAG_KEY}.criticalResolved`, true);
		return;
	}

	const table = getCriticalTable();
	if (!table) {
		ui.notifications.warn(localize('Genesys.AttackResolution.MissingCriticalTable', 'Critical Injury table was not found.'));
		return;
	}

	const roll = new Roll('1d100');
	await roll.evaluate();
	const baseRoll = Number(roll.total ?? 1);
	const previousInjuries = Array.from(target.items).filter((item) => item.type === 'injury').length;
	const vicious = getQualityCombatEffectValue(flag.qualities, CombatEffectKeys.CriticalVicious);
	const durable = Math.max(0, -getActorCombatEffectValue(target, CombatEffectKeys.CriticalReceivedModifier));
	const finalResult = Math.max(1, baseRoll + extraAdvantages * 10 + previousInjuries * 10 + vicious * 10 - durable * 10);
	const result = getCriticalResult(table, finalResult);
	const injury = getLinkedInjury(result);

	if (injury) {
		const injuryData = injury.toObject() as unknown as Record<string, unknown>;
		delete injuryData._id;
		await target.createEmbeddedDocuments('Item', [injuryData]);
	}

	await createCriticalMessage(target, {
		targetName: target.name,
		baseRoll,
		extraAdvantages,
		previousInjuries,
		vicious,
		durable,
		finalResult,
		injuryLink: injury ? `@UUID[${injury.uuid}]{${injury.name}}` : undefined,
		injuryName: injury?.name,
		injuryEffect: injury?.systemData.description,
		injuryFallbackHtml: injury ? undefined : getCriticalResultFallbackHtml(result),
	});
	await message.setFlag(FLAG_SCOPE, `${ATTACK_FLAG_KEY}.criticalResolved`, true);
}

function findQualityItem(name: string) {
	return game.items.find((item) => item.type === 'quality' && normalizeName(item.name) === normalizeName(name));
}

function getActiveQualitySpendOptions(qualities: ContainedItemQuality[]) {
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
				label: quality.isRated ? `${quality.name} ${quality.rating}` : quality.name,
				cost: { advantages, triumphs },
				repeatable,
				maxUses,
				kind: 'quality' as const,
			},
		];
	});
}

function getSymbolCostTotal(cost: SymbolCost, count = 1) {
	return {
		advantages: (cost.advantages ?? 0) * count,
		triumphs: (cost.triumphs ?? 0) * count,
	};
}

function symbolsToInlineHtml(symbols: string) {
	return `<span class="font-genesys-symbols nolig">${symbols}</span>`;
}

function symbolCostToInlineHtml(cost: SymbolCost, count = 1) {
	const total = getSymbolCostTotal(cost, count);
	return `${symbolsToInlineHtml('a'.repeat(total.advantages))}${symbolsToInlineHtml('t'.repeat(total.triumphs))}`;
}

function getSpentSymbols(selections: SymbolSpendSelection[]) {
	return selections.reduce(
		(total, selection) => {
			const selectionCost = getSymbolCostTotal(selection.option.cost, selection.uses);
			return {
				advantages: total.advantages + selectionCost.advantages,
				triumphs: total.triumphs + selectionCost.triumphs,
			};
		},
		{ advantages: 0, triumphs: 0 },
	);
}

function getRemainingSymbols(flag: ResolutionMessageFlag, selections: SymbolSpendSelection[]) {
	const spent = getSpentSymbols(selections);
	return {
		advantages: Math.max(0, flag.netAdvantage - spent.advantages),
		triumphs: Math.max(0, flag.totalTriumph - spent.triumphs),
	};
}

function getSelectionCount(selections: SymbolSpendSelection[], optionId: string) {
	return selections.find((selection) => selection.option.id === optionId)?.uses ?? 0;
}

function buildSymbolSpendOptions(flag: ResolutionMessageFlag) {
	const options: SymbolSpendOption[] = [];
	if (flag.criticalAllowed && flag.critical > 0 && flag.netAdvantage >= flag.critical) {
		options.push({
			id: 'critical-advantages',
			label: localize('Genesys.AttackResolution.CriticalByAdvantages', 'Critical Injury (Advantages)'),
			cost: { advantages: flag.critical },
			kind: 'critical',
		});
	}
	if (flag.criticalAllowed && flag.totalTriumph > 0) {
		options.push({
			id: 'critical-triumph',
			label: localize('Genesys.AttackResolution.CriticalByTriumph', 'Critical Injury (Triumph)'),
			cost: { triumphs: 1 },
			kind: 'critical',
		});
	}

	options.push(...getActiveQualitySpendOptions(flag.qualities));
	options.push(
		{
			id: 'manual-advantage',
			label: localize('Genesys.AttackResolution.OtherAdvantageSpend', 'Other Advantage spend'),
			cost: { advantages: 1 },
			repeatable: true,
			kind: 'manual',
		},
		{
			id: 'manual-triumph',
			label: localize('Genesys.AttackResolution.OtherTriumphSpend', 'Other Triumph spend'),
			cost: { triumphs: 1 },
			repeatable: true,
			kind: 'manual',
		},
	);

	return options;
}

function getVisibleSymbolSpendOptions(options: SymbolSpendOption[], selections: SymbolSpendSelection[]) {
	const hasCritical = selections.some((selection) => selection.option.kind === 'critical');
	const regularOptions = options.filter((option) => option.kind !== 'criticalBonus');
	if (!hasCritical) {
		return regularOptions;
	}

	return [
		...regularOptions,
		{
			id: 'critical-bonus',
			label: localize('Genesys.AttackResolution.CriticalAdvantageBonus', 'Critical Injury bonus +10'),
			cost: { advantages: 1 },
			repeatable: true,
			kind: 'criticalBonus' as const,
		},
	];
}

function renderSymbolSpendDialogContent(flag: ResolutionMessageFlag, baseOptions: SymbolSpendOption[], selections: SymbolSpendSelection[]) {
	const remaining = getRemainingSymbols(flag, selections);
	const options = getVisibleSymbolSpendOptions(baseOptions, selections);
	const hasCritical = selections.some((selection) => selection.option.kind === 'critical');

	const optionRows = options
		.map((option) => {
			const currentCount = getSelectionCount(selections, option.id);
			const maxReached = option.maxUses !== undefined && currentCount >= option.maxUses;
			const criticalBlocked = option.kind === 'critical' && hasCritical && currentCount === 0;
			const enoughSymbols = remaining.advantages >= (option.cost.advantages ?? 0) && remaining.triumphs >= (option.cost.triumphs ?? 0);
			const repeatBlocked = !option.repeatable && currentCount > 0;
			const disabled = maxReached || criticalBlocked || repeatBlocked || !enoughSymbols;
			return `
				<button type="button" class="symbol-spend-option" data-option-id="${option.id}" ${disabled ? 'disabled' : ''}>
					<span class="symbol-spend-option-label">${option.label}</span>
					<span class="symbol-spend-option-cost">${symbolCostToInlineHtml(option.cost)}</span>
				</button>
			`;
		})
		.join('');

	const selectedRows = selections.length
		? selections
				.map(
					(selection) => `
						<li>
							<span>${selection.option.label}${selection.uses > 1 ? ` x${selection.uses}` : ''}</span>
							<span>${symbolCostToInlineHtml(selection.option.cost, selection.uses)}</span>
							<button type="button" data-remove-option-id="${selection.option.id}">-</button>
						</li>
					`,
				)
				.join('')
		: `<li>${localize('Genesys.AttackResolution.NoSymbolSpends', 'No symbols spent yet.')}</li>`;

	return `
		<div class="symbol-spend-dialog-body">
			<p>${localize('Genesys.AttackResolution.SymbolSpendHint', 'Choose how to spend the symbols from this attack.')}</p>
			<div class="symbol-spend-pool">
				<span>${localize('Genesys.AttackResolution.RemainingAdvantages', 'Advantages')}</span>
				<strong>${remaining.advantages}</strong>
				<span>${localize('Genesys.AttackResolution.RemainingTriumphs', 'Triumphs')}</span>
				<strong>${remaining.triumphs}</strong>
			</div>
			<div class="symbol-spend-options">${optionRows}</div>
			<div class="symbol-spend-selected">
				<h4>${localize('Genesys.AttackResolution.SelectedSpends', 'Selected spends')}</h4>
				<ul>${selectedRows}</ul>
			</div>
		</div>
	`;
}

async function promptForSymbolSpends(flag: ResolutionMessageFlag) {
	const baseOptions = buildSymbolSpendOptions(flag);
	const selections: SymbolSpendSelection[] = [];

	return new Promise<SymbolSpendSelection[] | null>((resolve) => {
		let dialog: Dialog;
		const refresh = (html: JQuery<HTMLElement>) => {
			html.find('.dialog-content').html(renderSymbolSpendDialogContent(flag, baseOptions, selections));
			html.find('[data-option-id]').on('click', (event) => {
				const optionId = (event.currentTarget as HTMLElement).dataset.optionId;
				const option = getVisibleSymbolSpendOptions(baseOptions, selections).find((candidate) => candidate.id === optionId);
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
						if (bonusIndex >= 0) {
							selections.splice(bonusIndex, 1);
						}
					}
				}
				refresh(html);
			});
		};

		dialog = new Dialog(
			{
				title: localize('Genesys.AttackResolution.SymbolSpendTitle', 'Spend Symbols'),
				content: renderSymbolSpendDialogContent(flag, baseOptions, selections),
				buttons: {
					confirm: {
						label: localize('Genesys.AttackResolution.ConfirmSymbolSpends', 'Confirm'),
						callback: () => resolve(selections.length ? selections : []),
					},
					cancel: {
						label: localize('Genesys.AttackResolution.CancelSymbolSpends', 'Cancel'),
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

function buildSymbolSpendSummaryEntries(selections: SymbolSpendSelection[]) {
	return selections.map((selection) => {
		const totalCost = getSymbolCostTotal(selection.option.cost, selection.uses);
		return {
			label: selection.option.label,
			uses: selection.uses,
			advantages: totalCost.advantages,
			triumphs: totalCost.triumphs,
		};
	});
}

async function createSymbolSpendSummaryMessage(target: GenesysActor, flag: ResolutionMessageFlag, selections: SymbolSpendSelection[]) {
	const remaining = getRemainingSymbols(flag, selections);
	const html = await renderTemplate('systems/genesys/templates/chat/attack-symbol-spend.hbs', {
		weaponName: flag.weaponName,
		entries: buildSymbolSpendSummaryEntries(selections),
		remainingAdvantages: remaining.advantages,
		remainingTriumphs: remaining.triumphs,
	});
	await ChatMessage.create({
		user: game.user.id,
		speaker: { actor: target.id },
		content: html,
	});
}

async function spendAttackSymbols(message: ChatMessage) {
	const flag = message.getFlag(FLAG_SCOPE, ATTACK_FLAG_KEY) as ResolutionMessageFlag | undefined;
	if (!flag || flag.symbolsSpent) {
		return;
	}

	const target = (await fromUuid(flag.targetUuid)) as GenesysActor | null;
	if (!target) {
		ui.notifications.warn(localize('Genesys.AttackResolution.MissingTarget', 'Attack target could not be found.'));
		return;
	}

	const selections = await promptForSymbolSpends(flag);
	if (!selections) {
		return;
	}

	await createSymbolSpendSummaryMessage(target, flag, selections);
	const criticalSelection = selections.find((selection) => selection.option.kind === 'critical');
	if (criticalSelection) {
		const criticalBonus = selections.find((selection) => selection.option.kind === 'criticalBonus')?.uses ?? 0;
		await resolveCritical(message, criticalBonus);
	}

	await message.setFlag(FLAG_SCOPE, `${ATTACK_FLAG_KEY}.symbolsSpent`, true);
}

export function buildAttackResolutionFlag(
	actor: GenesysActor | undefined,
	weapon: AttackResolutionWeapon,
	totalDamage: number,
	results: GenesysRollResults,
	chaosManifestation?: ChaosManifestationChatData,
): AttackMessageFlag | undefined {
	const target = getTargetActor();
	if (!target) {
		return undefined;
	}

	return {
		attackerUuid: actor?.uuid,
		targetUuid: target.uuid,
		weaponName: weapon.name,
		range: weapon.systemData.range,
		totalDamage,
		critical: weapon.systemData.critical,
		qualities: weapon.systemData.qualities.map((quality) => ({ ...quality })),
		results: {
			netSuccess: results.netSuccess,
			netAdvantage: results.netAdvantage,
			netThreat: results.netThreat,
			totalTriumph: results.totalTriumph,
			totalDespair: results.totalDespair,
		},
		chaosManifestation,
		stunDamage: hasQualityCombatEffect(weapon.systemData.qualities, CombatEffectKeys.AttackStunDamage),
	};
}

export async function maybeCreateAttackDefensePrompt(sourceMessage: ChatMessage, flag: AttackMessageFlag | undefined) {
	if (!flag || flag.results.netSuccess <= 0) {
		return;
	}

	const target = (await fromUuid(flag.targetUuid)) as GenesysActor | null;
	if (!target) {
		return;
	}

	const defense = buildDefenseBreakdown(target, flag);
	if (defense.canParry) {
		await createDefensePrompt(sourceMessage, target, flag);
		return;
	}

	await createDamageResolutionMessage(sourceMessage, target, flag, false);
}

export function registerAttackResolution() {
	Hooks.on('renderChatMessage', (message: ChatMessage, html: JQuery<HTMLElement>) => {
		const flag = message.getFlag(FLAG_SCOPE, ATTACK_FLAG_KEY) as DefenseMessageFlag | ResolutionMessageFlag | undefined;

		html.find('[data-action="resolve-attack-defense"]').on('click', async (event) => {
			event.preventDefault();
			const usedParry = event.currentTarget instanceof HTMLElement && event.currentTarget.dataset.useParry === 'true';
			await resolveDamage(message, usedParry);
		});

		html.find('[data-action="critical-injury"]').on('click', async (event) => {
			event.preventDefault();
			await resolveCritical(message);
		});

		html.find('[data-action="spend-attack-symbols"]').on('click', async (event) => {
			event.preventDefault();
			await spendAttackSymbols(message);
		});

		if (flag && 'resolved' in flag && flag.resolved) {
			html.find('[data-action="resolve-attack-defense"]').prop('disabled', true);
		}

		if (flag && 'criticalResolved' in flag && flag.criticalResolved) {
			html.find('[data-action="critical-injury"]').prop('disabled', true);
		}

		if (flag && 'symbolsSpent' in flag && flag.symbolsSpent) {
			html.find('[data-action="spend-attack-symbols"]').prop('disabled', true);
		}
	});
}
