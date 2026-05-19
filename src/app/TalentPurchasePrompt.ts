/**
 * FVTT-Genesys
 * Prompt for purchasing or refunding talents from specialization tree
 */

import VueTalentPurchasePrompt from '@/vue/apps/TalentPurchasePrompt.vue';
import { ContextBase } from '@/vue/SheetContext';
import VueSheet from '@/vue/VueSheet';
import GenesysActor from '@/actor/GenesysActor';
import TalentDataModel from '@/item/data/TalentDataModel';
import GenesysItem from '@/item/GenesysItem';
import { EntryType } from '@/actor/data/character/ExperienceJournal';

export interface TalentPurchasePromptContext extends ContextBase {
	resolvePromise: (value: boolean) => void;
	isRefund: boolean;
	talentName: string;
	cost: number;
	canRefund: boolean;
	errorMessage: string;
}

export type TalentPurchaseData = {
	talentId: string;
	talentName: string;
	realItemId?: string;
	cost: number;
	treeManaged?: boolean;
};

type TalentPurchaseResult = {
	success: boolean;
	itemId?: string;
};

type ActorExperienceEntry = Record<string, unknown>;
type RefundCheckNode = {
	name?: string;
	purchased?: boolean;
};

function localize(key: string): string {
	return game?.i18n?.localize(key) ?? key;
}

function format(key: string, data: Record<string, string | number | boolean | null>): string {
	return game?.i18n?.format(key, data) ?? key;
}

function nodeKey(row: number, col: number) {
	return `${row}-${col}`;
}

function normalizeName(name: string) {
	return name.trim().toLocaleLowerCase();
}

export default class TalentPurchasePrompt extends VueSheet(Application) {
	override get vueComponent() {
		return VueTalentPurchasePrompt;
	}

	static override get defaultOptions() {
		return {
			...super.defaultOptions,
			classes: ['app-talent-purchase-prompt'],
			width: 400,
			title: localize('Genesys.TalentPurchasePrompt.PurchaseTitle'),
		};
	}

	static #getExperienceEntries(actor: GenesysActor): ActorExperienceEntry[] {
		const systemData = actor.system as { experienceJournal?: { entries?: ActorExperienceEntry[] } };
		return systemData.experienceJournal?.entries ?? [];
	}

	static #getAvailableXP(actor: GenesysActor): number {
		const systemData = actor.system as { availableXP?: number };
		return systemData.availableXP ?? 0;
	}

	static async #findTalentItem(talentId: string): Promise<GenesysItem<TalentDataModel> | null> {
		for (const pack of game.packs) {
			if (pack.metadata.type !== 'Item') continue;

			const item = await pack.getDocument(talentId);
			if (item && (item as GenesysItem).type === 'talent') {
				return item as GenesysItem<TalentDataModel>;
			}
		}

		const worldItem = game.items.get(talentId);
		if (worldItem?.type === 'talent') {
			return worldItem as GenesysItem<TalentDataModel>;
		}

		return null;
	}

	static #prepareEmbeddedItemData(talentItem: GenesysItem<TalentDataModel>) {
		const itemData = talentItem.toObject() as unknown as Record<string, unknown>;
		delete itemData._id;
		delete itemData._stats;
		delete itemData.ownership;
		delete itemData.flags;
		delete itemData.folder;
		delete itemData.sort;
		return itemData;
	}

	static #findOwnedTalent(actor: GenesysActor, talentData: TalentPurchaseData) {
		if (talentData.realItemId) {
			const itemById = actor.items.get(talentData.realItemId);
			if (itemById?.type === 'talent') {
				return itemById as GenesysItem<TalentDataModel>;
			}
		}

		return actor.items.find(
			(item) => item.type === 'talent' && normalizeName(item.name) === normalizeName(talentData.talentName),
		) as GenesysItem<TalentDataModel> | undefined;
	}

	static async promptForPurchase(talentName: string, cost: number): Promise<boolean> {
		const sheet = new TalentPurchasePrompt(talentName, cost, false, true, '');
		sheet.options.title = localize('Genesys.TalentPurchasePrompt.PurchaseTitle');
		await sheet.render(true);

		return new Promise((resolve) => {
			sheet.#resolvePromise = resolve;
		});
	}

	static async promptForRefund(talentName: string, cost: number, canRefund: boolean, errorMessage: string): Promise<boolean> {
		const sheet = new TalentPurchasePrompt(talentName, cost, true, canRefund, errorMessage);
		sheet.options.title = localize(canRefund ? 'Genesys.TalentPurchasePrompt.RefundTitle' : 'Genesys.TalentPurchasePrompt.CannotRefundTitle');
		await sheet.render(true);

		return new Promise((resolve) => {
			sheet.#resolvePromise = resolve;
		});
	}

	#resolvePromise?: (value: boolean) => void;
	readonly #talentName: string;
	readonly #cost: number;
	readonly #isRefund: boolean;
	readonly #canRefund: boolean;
	readonly #errorMessage: string;

	constructor(
		talentName: string,
		cost: number,
		isRefund: boolean = false,
		canRefund: boolean = true,
		errorMessage: string = ''
	) {
		super();

		this.#talentName = talentName;
		this.#cost = cost;
		this.#isRefund = isRefund;
		this.#canRefund = canRefund;
		this.#errorMessage = errorMessage;
	}

	override async getVueContext(): Promise<TalentPurchasePromptContext> {
		return {
			resolvePromise: async (confirmed) => {
				this.#resolvePromise?.(confirmed);
				this.#resolvePromise = undefined;

				await this.close();
			},
			isRefund: this.#isRefund,
			talentName: this.#talentName,
			cost: this.#cost,
			canRefund: this.#canRefund,
			errorMessage: this.#errorMessage,
		};
	}

	override async close(options = {}) {
		this.#resolvePromise?.(false);
		await super.close(options);
	}

	/**
	 * Check if a talent can be refunded (has no dependent purchased talents)
	 */
	static canRefundTalent(
		row: number,
		col: number,
		connections: Record<string, boolean>,
		nodes: Record<string, RefundCheckNode>
	): { canRefund: boolean; errorMessage: string } {
		const removedKey = nodeKey(row, col);
		const reachableNodes = this.#getReachablePurchasedNodes(connections, nodes, removedKey);

		const vKeyBelow = `v-${row}-${col}`;
		if (connections[vKeyBelow]) {
			const belowKey = nodeKey(row + 1, col);
			const nodeBelow = nodes[belowKey];
			if (nodeBelow?.purchased && !reachableNodes.has(belowKey)) {
				return {
					canRefund: false,
					errorMessage: format('Genesys.TalentPurchasePrompt.RefundBlockedBelow', { talentName: nodeBelow.name ?? '' }),
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
					errorMessage: format('Genesys.TalentPurchasePrompt.RefundBlockedRight', { talentName: nodeRight.name ?? '' }),
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
					errorMessage: format('Genesys.TalentPurchasePrompt.RefundBlockedLeft', { talentName: nodeLeft.name ?? '' }),
				};
			}
		}

		return { canRefund: true, errorMessage: '' };
	}

	static #getReachablePurchasedNodes(
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

			for (const neighborKey of this.#getConnectedPurchasedNeighbors(currentKey, connections, purchasedKeySet)) {
				if (!reachable.has(neighborKey)) {
					reachable.add(neighborKey);
					queue.push(neighborKey);
				}
			}
		}

		return reachable;
	}

	static #getConnectedPurchasedNeighbors(
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

	/**
	 * Purchase a talent - add to actor and deduct XP
	 */
	static async purchaseTalent(
		actor: GenesysActor,
		talentData: TalentPurchaseData,
	): Promise<TalentPurchaseResult> {
		if (this.#getAvailableXP(actor) < talentData.cost) {
			ui.notifications.error(localize('Genesys.Notifications.NotEnoughXP'));
			return { success: false };
		}

		try {
			const talentItem = await this.#findTalentItem(talentData.talentId);

			if (!talentItem) {
				ui.notifications.error(localize('Genesys.Notifications.TalentNotFound'));
				return { success: false };
			}

			const ownedTalent = this.#findOwnedTalent(actor, talentData);

			if (ownedTalent) {
				if (ownedTalent.systemData.ranked === 'no') {
					ui.notifications.info(format('Genesys.Notifications.TalentNotRanked', { talentName: ownedTalent.name }));
					return { success: false };
				}

				const newRank = ownedTalent.systemData.rank + 1;
				const newEffectiveTier = ownedTalent.systemData.effectiveNextTier;

				await ownedTalent.update({
					'system.rank': newRank,
				});
				if (talentData.treeManaged) {
					await ownedTalent.setFlag('genesys', 'treeManaged', true);
				}

				await actor.update({
					'system.experienceJournal.entries': [
						...this.#getExperienceEntries(actor),
						{
							amount: -talentData.cost,
							type: EntryType.TalentRank,
							data: {
								name: ownedTalent.name,
								id: ownedTalent.id,
								tier: newEffectiveTier,
								rank: newRank,
							},
						},
					],
				});

				ui.notifications.info(format('Genesys.Notifications.PurchasedTalent', { name: ownedTalent.name, cost: talentData.cost }));
				return { success: true, itemId: ownedTalent.id };
			}

			const itemData = this.#prepareEmbeddedItemData(talentItem);
			if (talentData.treeManaged) {
				itemData.flags = {
					genesys: {
						treeManaged: true,
					},
				};
			}
			const [createdItem] = await actor.createEmbeddedDocuments('Item', [itemData]);

			if (!createdItem) {
				ui.notifications.error(localize('Genesys.Notifications.FailedToAddTalentToCharacter'));
				return { success: false };
			}

			await actor.update({
				'system.experienceJournal.entries': [
					...this.#getExperienceEntries(actor),
					{
						amount: -talentData.cost,
						type: EntryType.NewTalent,
						data: {
							name: talentItem.name,
							id: createdItem.id,
							tier: talentItem.systemData.tier,
							rank: 1,
						},
					},
				],
			});

			ui.notifications.info(format('Genesys.Notifications.PurchasedTalent', { name: talentItem.name, cost: talentData.cost }));
			return { success: true, itemId: createdItem.id };
		} catch (error) {
			console.error('Error purchasing talent:', error);
			ui.notifications.error(localize('Genesys.Notifications.FailedToPurchaseTalent'));
			return { success: false };
		}
	}

	/**
	 * Refund a talent - remove from actor and refund XP
	 */
	static async refundTalent(
		actor: GenesysActor,
		talentData: TalentPurchaseData
	): Promise<TalentPurchaseResult> {
		try {
			const talentItem = this.#findOwnedTalent(actor, talentData);

			if (!talentItem) {
				ui.notifications.error(localize('Genesys.Notifications.TalentNotFound'));
				return { success: false };
			}

			if (talentItem.systemData.ranked === 'yes' && talentItem.systemData.rank > 1) {
				await talentItem.update({
					'system.rank': talentItem.systemData.rank - 1,
				});
			} else {
				await talentItem.delete();
			}

			await actor.update({
				'system.experienceJournal.entries': [
					...this.#getExperienceEntries(actor),
					{
						amount: talentData.cost,
						type: EntryType.Award,
						data: {
							reason: `Refunded talent ${talentData.talentName}`,
						},
					},
				],
			});

			ui.notifications.info(format('Genesys.Notifications.RefundedTalent', { name: talentData.talentName, cost: talentData.cost }));
			return { success: true, itemId: talentItem.id };
		} catch (error) {
			console.error('Error refunding talent:', error);
			ui.notifications.error(localize('Genesys.Notifications.FailedToRefundTalent'));
			return { success: false };
		}
	}
}
