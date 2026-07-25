/**
 * FVTT-Genesys
 * Shared XP advancement purchase helpers.
 */

import AdvancePurchasePrompt from '@/app/AdvancePurchasePrompt';
import GenesysActor from '@/actor/GenesysActor';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import { Characteristic } from '@/data/Characteristics';
import { CombatPool } from '@/data/Actors';
import { EntryType, removeJournalEntry, type Entry } from '@/actor/data/character/ExperienceJournal';
import GenesysItem from '@/item/GenesysItem';
import SkillDataModel from '@/item/data/SkillDataModel';
import TalentDataModel from '@/item/data/TalentDataModel';
import SpecializationDataModel from '@/item/data/SpecializationDataModel';
import { isSkillAllowedForArchetype } from '@/actor/abilities/RacialAbilities';

export type AdvancementRequest =
	| {
			type: 'characteristic';
			characteristic: Characteristic;
		}
	| {
			type: 'skill-rank';
			skill: GenesysItem<SkillDataModel>;
		}
	| {
			type: 'talent';
			talentId?: string;
			talentName: string;
			sourceTalent?: GenesysItem<TalentDataModel>;
			realItemId?: string;
			cost?: number;
			source?: string;
			treeManaged?: boolean;
		}
	| {
			type: 'talent-rank';
			talent: GenesysItem<TalentDataModel>;
			cost?: number;
			source?: string;
		}
	| {
			type: 'specialization';
			specialization: GenesysItem<SpecializationDataModel>;
			cost?: number;
			source?: string;
			execute: () => Promise<GenesysItem<SpecializationDataModel> | null>;
		};

export type AdvancementResult = {
	success: boolean;
	itemId?: string;
};

export type AdvancementPreview = {
	valid: boolean;
	requestType: AdvancementRequest['type'];
	advanceTypeLabel: string;
	name: string;
	cost: number;
	availableXP: number;
	source: string;
	errorMessage: string;
	warning: string;
};

type RefundCheckNode = {
	name?: string;
	purchased?: boolean;
};

function localize(key: string, fallback = key) {
	const localized = game?.i18n?.localize(key);
	return localized && localized !== key ? localized : fallback;
}

function format(key: string, data: Record<string, string | number | boolean | null>, fallback = key) {
	const localized = game?.i18n?.format(key, data);
	return localized && localized !== key ? localized : fallback;
}

function normalizeName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function characteristicLabel(characteristic: Characteristic) {
	const key = characteristic.charAt(0).toUpperCase() + characteristic.slice(1);
	return localize(`Genesys.Characteristics.${key}`, characteristic);
}

function getAdvanceTypeLabel(type: AdvancementRequest['type']) {
	switch (type) {
		case 'characteristic':
			return localize('Genesys.AdvancePurchasePrompt.Types.Characteristic', 'Cecha');
		case 'skill-rank':
			return localize('Genesys.AdvancePurchasePrompt.Types.SkillRank', 'Umiejętność');
		case 'talent':
			return localize('Genesys.AdvancePurchasePrompt.Types.Talent', 'Talent');
		case 'talent-rank':
			return localize('Genesys.AdvancePurchasePrompt.Types.TalentRank', 'Ranga talentu');
		case 'specialization':
			return localize('Genesys.AdvancePurchasePrompt.Types.Specialization', 'Specjalizacja');
		default:
			return '';
	}
}

function getExperienceEntries(actor: GenesysActor<CharacterDataModel>) {
	return actor.systemData.experienceJournal.entries;
}

async function appendJournalEntry(actor: GenesysActor<CharacterDataModel>, entry: Entry) {
	await actor.update({
		'system.experienceJournal.entries': [
			...getExperienceEntries(actor),
			entry,
		],
	});
}

async function findTalentItem(request: Extract<AdvancementRequest, { type: 'talent' }>): Promise<GenesysItem<TalentDataModel> | null> {
	if (request.sourceTalent) {
		return request.sourceTalent;
	}

	if (!request.talentId) {
		return null;
	}

	for (const pack of game.packs) {
		if (pack.metadata.type !== 'Item') {
			continue;
		}

		const item = await pack.getDocument(request.talentId);
		if (item && (item as GenesysItem).type === 'talent') {
			return item as GenesysItem<TalentDataModel>;
		}
	}

	const worldItem = game.items.get(request.talentId);
	return worldItem?.type === 'talent' ? worldItem as GenesysItem<TalentDataModel> : null;
}

function prepareEmbeddedItemData(talentItem: GenesysItem<TalentDataModel>, treeManaged = false) {
	const itemData = talentItem.toObject() as unknown as Record<string, any>;
	delete itemData._id;
	delete itemData._stats;
	delete itemData.ownership;
	delete itemData.flags;
	delete itemData.folder;
	delete itemData.sort;

	if (treeManaged) {
		itemData.flags = {
			genesys: {
				treeManaged: true,
			},
		};
	}

	return itemData;
}

function findOwnedTalent(actor: GenesysActor<CharacterDataModel>, request: Pick<Extract<AdvancementRequest, { type: 'talent' }>, 'realItemId' | 'talentName'>) {
	if (request.realItemId) {
		const itemById = actor.items.get(request.realItemId);
		if (itemById?.type === 'talent') {
			return itemById as GenesysItem<TalentDataModel>;
		}
	}

	return actor.items.find(
		(item) => item.type === 'talent' && normalizeName(item.name) === normalizeName(request.talentName),
	) as GenesysItem<TalentDataModel> | undefined;
}

function previewCostError(actor: GenesysActor<CharacterDataModel>, cost: number) {
	return actor.systemData.availableXP < cost ? localize('Genesys.Notifications.NotEnoughXP', 'Brak wystarczającej liczby PD!') : '';
}

export async function previewAdvance(actor: GenesysActor<CharacterDataModel>, request: AdvancementRequest): Promise<AdvancementPreview> {
	const availableXP = actor.systemData.availableXP;

	switch (request.type) {
		case 'characteristic': {
			if (!actor.systemData.canPurchaseCharacteristicAdvance[request.characteristic]) {
				return {
					valid: false,
					requestType: request.type,
					advanceTypeLabel: getAdvanceTypeLabel(request.type),
					name: characteristicLabel(request.characteristic),
					cost: 0,
					availableXP,
					source: '',
					errorMessage: localize('Genesys.AdvancePurchasePrompt.Errors.CannotPurchaseCharacteristic', 'Nie można kupić tej cechy.'),
					warning: '',
				};
			}

			const newValue = actor.systemData.characteristics[request.characteristic] + 1;
			const cost = newValue * 10;
			return {
				valid: !previewCostError(actor, cost),
				requestType: request.type,
				advanceTypeLabel: getAdvanceTypeLabel(request.type),
				name: characteristicLabel(request.characteristic),
				cost,
				availableXP,
				source: '',
				errorMessage: previewCostError(actor, cost),
				warning: '',
			};
		}

		case 'skill-rank': {
			const newRank = request.skill.systemData.rank + 1;
			const cost = 5 * newRank + (request.skill.systemData.career ? 0 : 5);
			const archetype = actor.items.find((item) => item.type === 'archetype');
			const archetypeKey = String((archetype?.system as { key?: string } | undefined)?.key ?? '');
			const racialRestriction = !isSkillAllowedForArchetype(archetypeKey, request.skill.name)
				? format(
						'Genesys.AdvancePurchasePrompt.Errors.RacialSkillRestriction',
						{ skill: request.skill.name, archetype: archetype?.name ?? '' },
						'Rasa postaci nie może rozwijać tej umiejętności.',
					)
				: '';
			const errorMessage = racialRestriction || (request.skill.systemData.rank >= 5
				? localize('Genesys.AdvancePurchasePrompt.Errors.SkillMaxRank', 'Ta umiejętność ma już maksymalną rangę.')
				: previewCostError(actor, cost));

			return {
				valid: !errorMessage,
				requestType: request.type,
				advanceTypeLabel: getAdvanceTypeLabel(request.type),
				name: request.skill.name,
				cost,
				availableXP,
				source: request.skill.systemData.career ? localize('Genesys.AdvancePurchasePrompt.Sources.CareerSkill', 'Umiejętność kariery') : '',
				errorMessage,
				warning: '',
			};
		}

		case 'talent': {
			const ownedTalent = findOwnedTalent(actor, request);
			if (ownedTalent) {
				if (ownedTalent.systemData.ranked === 'no') {
					return {
						valid: false,
						requestType: request.type,
						advanceTypeLabel: getAdvanceTypeLabel('talent-rank'),
						name: ownedTalent.name,
						cost: request.cost ?? 0,
						availableXP,
						source: request.source ?? '',
						errorMessage: format('Genesys.Notifications.TalentNotRanked', { talentName: ownedTalent.name }, 'Ten talent nie jest rangowany.'),
						warning: '',
					};
				}

				const cost = request.cost ?? ownedTalent.systemData.advanceCost;
				return {
					valid: !previewCostError(actor, cost),
					requestType: request.type,
					advanceTypeLabel: getAdvanceTypeLabel('talent-rank'),
					name: ownedTalent.name,
					cost,
					availableXP,
					source: request.source ?? '',
					errorMessage: previewCostError(actor, cost),
					warning: '',
				};
			}

			const talentItem = await findTalentItem(request);
			if (!talentItem) {
				return {
					valid: false,
					requestType: request.type,
					advanceTypeLabel: getAdvanceTypeLabel(request.type),
					name: request.talentName,
					cost: request.cost ?? 0,
					availableXP,
					source: request.source ?? '',
					errorMessage: localize('Genesys.Notifications.TalentNotFound', 'Nie znaleziono talentu!'),
					warning: '',
				};
			}

			const cost = request.cost ?? talentItem.systemData.tier * 5;
			return {
				valid: !previewCostError(actor, cost),
				requestType: request.type,
				advanceTypeLabel: getAdvanceTypeLabel(request.type),
				name: talentItem.name,
				cost,
				availableXP,
				source: request.source ?? talentItem.systemData.source ?? '',
				errorMessage: previewCostError(actor, cost),
				warning: '',
			};
		}

		case 'talent-rank': {
			if (request.talent.getFlag('genesys', 'treeManaged')) {
				return {
					valid: false,
					requestType: request.type,
					advanceTypeLabel: getAdvanceTypeLabel(request.type),
					name: request.talent.name,
					cost: request.cost ?? request.talent.systemData.advanceCost,
					availableXP,
					source: request.source ?? '',
					errorMessage: localize('Genesys.Notifications.TalentManagedByTree', 'Ten talent jest zarządzany przez drzewko specjalizacji.'),
					warning: '',
				};
			}

			if (request.talent.systemData.ranked === 'no') {
				return {
					valid: false,
					requestType: request.type,
					advanceTypeLabel: getAdvanceTypeLabel(request.type),
					name: request.talent.name,
					cost: request.cost ?? request.talent.systemData.advanceCost,
					availableXP,
					source: request.source ?? '',
					errorMessage: format('Genesys.Notifications.TalentNotRanked', { talentName: request.talent.name }, 'Ten talent nie jest rangowany.'),
					warning: '',
				};
			}

			const cost = request.cost ?? request.talent.systemData.advanceCost;
			return {
				valid: !previewCostError(actor, cost),
				requestType: request.type,
				advanceTypeLabel: getAdvanceTypeLabel(request.type),
				name: request.talent.name,
				cost,
				availableXP,
				source: request.source ?? '',
				errorMessage: previewCostError(actor, cost),
				warning: '',
			};
		}

		case 'specialization': {
			const existingSpecializations = actor.items.filter((item) => item.type === 'specialization') as GenesysItem<SpecializationDataModel>[];
			const duplicate = existingSpecializations.some((specialization) => normalizeName(specialization.name) === normalizeName(request.specialization.name));
			const fallbackCost = request.specialization.systemData.cost > 0 ? request.specialization.systemData.cost : (existingSpecializations.length + 1) * 10;
			const cost = request.cost ?? fallbackCost;
			const duplicateError = duplicate ? format('Genesys.AdvancePurchasePrompt.Errors.DuplicateSpecialization', { name: request.specialization.name }, 'Postać ma już tę specjalizację.') : '';
			const errorMessage = duplicateError || previewCostError(actor, cost);

			return {
				valid: !errorMessage,
				requestType: request.type,
				advanceTypeLabel: getAdvanceTypeLabel(request.type),
				name: request.specialization.name,
				cost,
				availableXP,
				source: request.source ?? '',
				errorMessage,
				warning: '',
			};
		}
	}
}

export async function purchaseAdvance(actor: GenesysActor<CharacterDataModel>, request: AdvancementRequest): Promise<AdvancementResult> {
	const preview = await previewAdvance(actor, request);

	if (!preview.valid) {
		ui.notifications.error(preview.errorMessage || localize('Genesys.Notifications.GenericError', 'Nie udało się wykonać zadanej akcji.'));
		return { success: false };
	}

	const confirmed = await AdvancePurchasePrompt.promptForPurchase({
		advanceTypeLabel: preview.advanceTypeLabel,
		advanceName: preview.name,
		cost: preview.cost,
		availableXP: preview.availableXP,
		source: preview.source,
		canConfirm: preview.valid,
		errorMessage: preview.errorMessage,
		warning: preview.warning,
	});
	if (!confirmed) {
		return { success: false };
	}

	try {
		switch (request.type) {
			case 'characteristic': {
				const currentValue = actor.systemData.characteristics[request.characteristic];
				const newValue = currentValue + 1;
				const woundThreshold = (actor.systemData._source.wounds as CombatPool).max + (request.characteristic === Characteristic.Brawn ? 1 : 0);
				const strainThreshold = (actor.systemData._source.strain as CombatPool).max + (request.characteristic === Characteristic.Willpower ? 1 : 0);

				await actor.update({
					[`system.characteristics.${request.characteristic}`]: newValue,
					'system.wounds.max': woundThreshold,
					'system.strain.max': strainThreshold,
					'system.experienceJournal.entries': [
						...getExperienceEntries(actor),
						{
							amount: -preview.cost,
							type: EntryType.Characteristic,
							data: {
								characteristic: request.characteristic,
								rank: newValue,
							},
						},
					],
				});

				return { success: true };
			}

			case 'skill-rank': {
				const newRank = request.skill.systemData.rank + 1;
				await request.skill.update({
					'system.rank': newRank,
				});

				await appendJournalEntry(actor, {
					amount: -preview.cost,
					type: EntryType.Skill,
					data: {
						name: request.skill.name,
						id: request.skill.id,
						rank: newRank,
					},
				});

				return { success: true, itemId: request.skill.id };
			}

			case 'talent': {
				const ownedTalent = findOwnedTalent(actor, request);
				if (ownedTalent) {
					const newRank = ownedTalent.systemData.rank + 1;
					const newEffectiveTier = ownedTalent.systemData.effectiveNextTier;

					await ownedTalent.update({
						'system.rank': newRank,
					});
					if (request.treeManaged) {
						await ownedTalent.setFlag('genesys', 'treeManaged', true);
					}

					await appendJournalEntry(actor, {
						amount: -preview.cost,
						type: EntryType.TalentRank,
						data: {
							name: ownedTalent.name,
							id: ownedTalent.id,
							tier: newEffectiveTier,
							rank: newRank,
						},
					});

					ui.notifications.info(format('Genesys.Notifications.PurchasedTalent', { name: ownedTalent.name, cost: preview.cost }, `Kupiono talent "${ownedTalent.name}".`));
					return { success: true, itemId: ownedTalent.id };
				}

				const talentItem = await findTalentItem(request);
				if (!talentItem) {
					ui.notifications.error(localize('Genesys.Notifications.TalentNotFound', 'Nie znaleziono talentu!'));
					return { success: false };
				}

				const [createdItem] = await actor.createEmbeddedDocuments('Item', [
					prepareEmbeddedItemData(talentItem, request.treeManaged),
				]) as GenesysItem<TalentDataModel>[];

				if (!createdItem) {
					ui.notifications.error(localize('Genesys.Notifications.FailedToAddTalentToCharacter', 'Nie udało się dodać talentu do postaci!'));
					return { success: false };
				}

				await appendJournalEntry(actor, {
					amount: -preview.cost,
					type: EntryType.NewTalent,
					data: {
						name: createdItem.name,
						id: createdItem.id,
						tier: createdItem.systemData.tier,
						rank: 1,
					},
				});

				ui.notifications.info(format('Genesys.Notifications.PurchasedTalent', { name: createdItem.name, cost: preview.cost }, `Kupiono talent "${createdItem.name}".`));
				return { success: true, itemId: createdItem.id };
			}

			case 'talent-rank': {
				const newRank = request.talent.systemData.rank + 1;
				const newEffectiveTier = request.talent.systemData.effectiveNextTier;

				await request.talent.update({
					'system.rank': newRank,
				});

				await appendJournalEntry(actor, {
					amount: -preview.cost,
					type: EntryType.TalentRank,
					data: {
						name: request.talent.name,
						id: request.talent.id,
						tier: newEffectiveTier,
						rank: newRank,
					},
				});

				return { success: true, itemId: request.talent.id };
			}

			case 'specialization': {
				const purchasedSpecialization = await request.execute();
				if (!purchasedSpecialization) {
					return { success: false };
				}

				await appendJournalEntry(actor, {
					amount: -preview.cost,
					type: EntryType.Specialization,
					data: {
						name: purchasedSpecialization.name,
						id: purchasedSpecialization.id,
						cost: preview.cost,
						source: preview.source,
					},
				});

				return { success: true, itemId: purchasedSpecialization.id };
			}
		}
	} catch (error) {
		console.error('Error purchasing advance:', error);
		ui.notifications.error(localize('Genesys.AdvancePurchasePrompt.Errors.FailedPurchase', 'Nie udało się kupić awansu.'));
		return { success: false };
	}
}

export async function refundAdvanceFromJournal(actor: GenesysActor<CharacterDataModel>, journalIndex: number): Promise<AdvancementResult> {
	const beforeEntries = getExperienceEntries(actor).length;
	await removeJournalEntry(actor, journalIndex);
	const afterEntries = getExperienceEntries(actor).length;
	return { success: afterEntries < beforeEntries };
}

function nodeKey(row: number, col: number) {
	return `${row}-${col}`;
}

function getConnectedPurchasedNeighbors(
	key: string,
	connections: Record<string, boolean>,
	purchasedKeys: Set<string>,
): string[] {
	const [row, col] = key.split('-').map(Number);
	const neighbors: string[] = [];

	const aboveKey = nodeKey(row - 1, col);
	if (row > 0 && connections[`v-${row - 1}-${col}`] && purchasedKeys.has(aboveKey)) {
		neighbors.push(aboveKey);
	}

	const belowKey = nodeKey(row + 1, col);
	if (connections[`v-${row}-${col}`] && purchasedKeys.has(belowKey)) {
		neighbors.push(belowKey);
	}

	const leftKey = nodeKey(row, col - 1);
	if (col > 0 && connections[`h-${row}-${col - 1}`] && purchasedKeys.has(leftKey)) {
		neighbors.push(leftKey);
	}

	const rightKey = nodeKey(row, col + 1);
	if (connections[`h-${row}-${col}`] && purchasedKeys.has(rightKey)) {
		neighbors.push(rightKey);
	}

	return neighbors;
}

function getReachablePurchasedNodes(
	connections: Record<string, boolean>,
	nodes: Record<string, RefundCheckNode>,
	removedKey: string,
): Set<string> {
	const purchasedKeys = Object.entries(nodes)
		.filter(([key, node]) => key !== removedKey && node?.purchased)
		.map(([key]) => key);
	const purchasedKeySet = new Set(purchasedKeys);
	const roots = purchasedKeys.filter((key) => Number(key.split('-')[0]) === 0);
	const reachable = new Set<string>(roots);
	const queue = [...roots];

	while (queue.length > 0) {
		const currentKey = queue.shift();
		if (!currentKey) {
			continue;
		}

		for (const neighborKey of getConnectedPurchasedNeighbors(currentKey, connections, purchasedKeySet)) {
			if (!reachable.has(neighborKey)) {
				reachable.add(neighborKey);
				queue.push(neighborKey);
			}
		}
	}

	return reachable;
}

export function canRefundTalentTreeNode(
	row: number,
	col: number,
	connections: Record<string, boolean>,
	nodes: Record<string, RefundCheckNode>,
): { canRefund: boolean; errorMessage: string } {
	const removedKey = nodeKey(row, col);
	const reachableNodes = getReachablePurchasedNodes(connections, nodes, removedKey);

	const vKeyBelow = `v-${row}-${col}`;
	if (connections[vKeyBelow]) {
		const belowKey = nodeKey(row + 1, col);
		const nodeBelow = nodes[belowKey];
		if (nodeBelow?.purchased && !reachableNodes.has(belowKey)) {
			return {
				canRefund: false,
				errorMessage: format('Genesys.TalentPurchasePrompt.RefundBlockedBelow', { talentName: nodeBelow.name ?? '' }, 'Nie można zwrócić talentu, ponieważ zależy od niego inny zakupiony talent.'),
			};
		}
	}

	const hKeyRight = `h-${row}-${col}`;
	if (connections[hKeyRight]) {
		const rightKey = nodeKey(row, col + 1);
		const nodeRight = nodes[rightKey];
		if (nodeRight?.purchased && !reachableNodes.has(rightKey)) {
			return {
				canRefund: false,
				errorMessage: format('Genesys.TalentPurchasePrompt.RefundBlockedRight', { talentName: nodeRight.name ?? '' }, 'Nie można zwrócić talentu, ponieważ zależy od niego inny zakupiony talent.'),
			};
		}
	}

	const hKeyLeft = `h-${row}-${col - 1}`;
	if (col > 0 && connections[hKeyLeft]) {
		const leftKey = nodeKey(row, col - 1);
		const nodeLeft = nodes[leftKey];
		if (nodeLeft?.purchased && !reachableNodes.has(leftKey)) {
			return {
				canRefund: false,
				errorMessage: format('Genesys.TalentPurchasePrompt.RefundBlockedLeft', { talentName: nodeLeft.name ?? '' }, 'Nie można zwrócić talentu, ponieważ zależy od niego inny zakupiony talent.'),
			};
		}
	}

	return { canRefund: true, errorMessage: '' };
}

function findLatestTalentAdvanceJournalIndex(
	actor: GenesysActor<CharacterDataModel>,
	options: { talentName: string; realItemId?: string },
) {
	const entries = getExperienceEntries(actor);
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (entry.type !== EntryType.NewTalent && entry.type !== EntryType.TalentRank) {
			continue;
		}

		const data = entry.data as { id?: string; name?: string } | undefined;
		if (!data) {
			continue;
		}

		if (options.realItemId && data.id === options.realItemId) {
			return index;
		}

		if (normalizeName(data.name ?? '') === normalizeName(options.talentName)) {
			return index;
		}
	}

	return -1;
}

export async function refundTalentAdvance(
	actor: GenesysActor<CharacterDataModel>,
	options: { talentName: string; realItemId?: string; cost: number; canRefund: boolean; errorMessage: string },
): Promise<AdvancementResult> {
	const confirmed = await AdvancePurchasePrompt.promptForRefund({
		advanceTypeLabel: getAdvanceTypeLabel('talent'),
		advanceName: options.talentName,
		cost: options.cost,
		availableXP: actor.systemData.availableXP,
		canConfirm: options.canRefund,
		errorMessage: options.errorMessage,
		warning: localize('Genesys.AdvancePurchasePrompt.RefundWarning', 'Cofnięcie usunie wpis z dziennika PD i odwróci zakup.'),
	});

	if (!confirmed || !options.canRefund) {
		return { success: false };
	}

	const journalIndex = findLatestTalentAdvanceJournalIndex(actor, options);
	if (journalIndex === -1) {
		ui.notifications.error(localize('Genesys.AdvancePurchasePrompt.Errors.NoMatchingJournalEntry', 'Nie znaleziono pasującego wpisu dziennika PD.'));
		return { success: false };
	}

	return refundAdvanceFromJournal(actor, journalIndex);
}
