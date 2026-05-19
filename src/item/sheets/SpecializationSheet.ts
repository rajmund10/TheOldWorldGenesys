/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Specialization ItemSheet
 */

import SpecializationDataModel from '@/item/data/SpecializationDataModel';
import GenesysItemSheet, { DropData } from '@/item/GenesysItemSheet';
import GenesysItem from '@/item/GenesysItem';
import SkillDataModel from '@/item/data/SkillDataModel';
import BaseItemDataModel from '@/item/data/BaseItemDataModel';
import VueSheet from '@/vue/VueSheet';
import VueSpecializationSheet from '@/vue/sheets/item/SpecializationSheet.vue';
import { GenesysItemSheetData, ItemSheetContext } from '@/vue/SheetContext';

const GRANTED_INVENTORY_TYPES = ['weapon', 'armor', 'gear', 'consumable', 'container', 'magicAccessory'] as const;

type TalentTreeData = {
	nodes?: Record<string, unknown>;
	connections?: Record<string, boolean>;
	backgroundImage?: string;
	bgPosX?: string;
	bgPosY?: string;
};

function normalizeTreeData(data: unknown): Required<TalentTreeData> {
	if (!data || typeof data !== 'object') {
		return {
			nodes: {},
			connections: {},
			backgroundImage: '',
			bgPosX: '0px',
			bgPosY: '0px',
		};
	}

	const partialData = data as TalentTreeData;
	return {
		nodes: partialData.nodes ?? {},
		connections: partialData.connections ?? {},
		backgroundImage: partialData.backgroundImage ?? '',
		bgPosX: partialData.bgPosX ?? '0px',
		bgPosY: partialData.bgPosY ?? '0px',
	};
}

export default class SpecializationSheet extends VueSheet(GenesysItemSheet<SpecializationDataModel>) {
	static override get defaultOptions() {
		return {
			...super.defaultOptions,
			classes: ['genesys', 'sheet', 'item', 'specialization'],
			width: 900,
			height: 900,
		};
	}

	override get vueComponent() {
		return VueSpecializationSheet;
	}

	override async getVueContext(): Promise<ItemSheetContext | undefined> {
		return {
			sheet: this,
			data: (await this.getData()) as GenesysItemSheetData<SpecializationDataModel>,
		};
	}

	protected override async _onDropItem(event: DragEvent, data: DropData): Promise<void> {
		if (!this.isEditable || !data.uuid) {
			return;
		}

		const droppedItem = await (<any>GenesysItem.implementation).fromDropData(data) as GenesysItem<SkillDataModel | SpecializationDataModel | BaseItemDataModel> | undefined;
		if (!droppedItem) {
			return;
		}

		if (droppedItem.type === 'skill') {
			event.preventDefault();

			const skillNames = this.item.systemData.careerSkills ?? [];
			if (skillNames.some((skillName) => skillName.toLowerCase() === droppedItem.name.toLowerCase())) {
				return;
			}

			await this.item.update({
				'system.careerSkills': [...skillNames, droppedItem.name],
			});
			await (this.item.actor?.sheet as any)?.syncCareerSkillFlags?.([...skillNames, droppedItem.name]);
			await this.render(false);
			ui.notifications.info(`Added career skill ${droppedItem.name} to the specialization.`);
			return;
		}

		if (GRANTED_INVENTORY_TYPES.includes(droppedItem.type as (typeof GRANTED_INVENTORY_TYPES)[number])) {
			event.preventDefault();

			const grantedItems = this.item.systemData.grantedItems ?? [];
			if (grantedItems.some((item) => item.type === droppedItem.type && item.name.toLowerCase() === droppedItem.name.toLowerCase())) {
				return;
			}

			await this.item.update({
				'system.grantedItems': [...grantedItems, droppedItem.toObject()],
			});
			await this.render(false);
			ui.notifications.info(`Added granted item ${droppedItem.name} to the specialization.`);
			return;
		}

		if (droppedItem.type !== 'specialization' || droppedItem.id === this.item.id) {
			return;
		}

		const importedTreeData = normalizeTreeData(await droppedItem.getFlag('genesys', 'treeData'));
		const hasTreeContent = Object.keys(importedTreeData.nodes).length > 0 || Object.keys(importedTreeData.connections).length > 0 || !!importedTreeData.backgroundImage;

		if (!hasTreeContent) {
			ui.notifications.warn(game.i18n.localize('Genesys.SpecializationSheet.ImportTreeEmpty'));
			return;
		}

		event.preventDefault();

		await this.item.setFlag('genesys', 'treeData', importedTreeData);
		await this.render(false);

		ui.notifications.info(game.i18n.format('Genesys.SpecializationSheet.ImportTreeSuccess', { name: droppedItem.name }));
	}
}
