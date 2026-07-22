/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Player Character Sheet
 */

import VueCharacterSheet from '@/vue/sheets/actor/CharacterSheet.vue';
import GenesysItem from '@/item/GenesysItem';
import BaseItemDataModel from '@/item/data/BaseItemDataModel';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import ArchetypeDataModel from '@/item/data/ArchetypeDataModel';
import CareerDataModel from '@/item/data/CareerDataModel';
import SpecializationDataModel from '@/item/data/SpecializationDataModel';
import SkillDataModel from '@/item/data/SkillDataModel';
import { EntryType } from '@/actor/data/character/ExperienceJournal';
import CareerSkillPrompt from '@/app/CareerSkillPrompt';
import TalentDataModel from '@/item/data/TalentDataModel';
import VueSheet from '@/vue/VueSheet';
import GenesysActorSheet from '@/actor/GenesysActorSheet';
import { ActorSheetContext } from '@/vue/SheetContext';
import { DragTransferData } from '@/data/DragTransferData';
import { transferInventoryBetweenActors } from '@/operations/TransferBetweenActors';
import { EquipmentState } from '@/item/data/EquipmentDataModel';
import { addDefaultSkillsToActor, backfillSkillGuidanceForActor, deduplicateActorSkills, GENESYS_CORE_SKILL_NAMES, replaceDefaultSkillsForActor } from '@/actor/skills/DefaultSkills';
import { purchaseAdvance } from '@/actor/advancement/AdvancementPurchase';
import { getCurrencyLabelForProfile, getCurrencyModeForProfile, getGameProfile } from '@/system/GameProfile';
import { loadCharacterCreationCatalog, CHARACTER_CREATION_COMPENDIUM, specializationMatchesArchetype, specializationMatchesCareer } from '@/actor/creation/CharacterCreationCatalog';

function normalizeSkillName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function normalizeTalentName(name: string) {
	return name.trim().toLocaleLowerCase();
}

function normalizeSpecializationName(name: string) {
	return name
		.trim()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase();
}

function uniqueNames(names: string[]) {
	return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
}

function careerSkillName(skill: unknown): string {
	if (typeof skill === 'string') {
		return skill;
	}

	if (skill && typeof skill === 'object' && 'name' in skill) {
		return String((skill as { name?: unknown }).name ?? '');
	}

	return '';
}

const GRANTED_INVENTORY_TYPES = ['weapon', 'armor', 'gear', 'consumable', 'container', 'magicAccessory'];
const TALENT_GRANTED_CAREER_SKILLS = new Map<string, string[]>([[normalizeTalentName('Świątynnik'), ['Moc Boska']]]);
const TALENT_GRANTED_CAREER_SKILL_NAMES = [...TALENT_GRANTED_CAREER_SKILLS.values()].flat();

/**
 * Actor sheet used for Player Characters
 */
export default class CharacterSheet extends VueSheet(GenesysActorSheet<CharacterDataModel>) {
	#renderKey = 0;
	#skillInitialization?: Promise<void>;

	override get vueComponent() {
		return VueCharacterSheet;
	}

	get defaultSkillNames() {
		return GENESYS_CORE_SKILL_NAMES;
	}

	get defaultSkillProfileId() {
		return 'genesys-core';
	}

	get currencyLabel() {
		return getCurrencyLabelForProfile();
	}

	get currencyMode() {
		return getCurrencyModeForProfile();
	}

	override async getVueContext(): Promise<ActorSheetContext<CharacterDataModel>> {
		const setupMode = this.actor.getFlag('genesys', 'characterSetupMode');
		const needsCharacterSetup = !setupMode && this.actor.items.size === 0 && this.actor.systemData.experienceJournal.entries.length === 0;

		if (!needsCharacterSetup && setupMode !== 'blank') {
			await this.ensureSkills();
		}
		await this.syncCareerSkillFlags();
		this.#renderKey += 1;

		let characterCreationCatalog = null;
		if (needsCharacterSetup) {
			try {
				characterCreationCatalog = await loadCharacterCreationCatalog(getGameProfile());
			} catch (error) {
				console.error('[Genesys] Failed to load character creation catalog.', error);
			}
		}
		
		return {
			sheet: this,
			renderKey: this.#renderKey,
			currencyLabel: this.currencyLabel,
			currencyMode: this.currencyMode,
			needsCharacterSetup,
			characterCreationCatalog,
			useBlankCharacterSheet: () => this.useBlankCharacterSheet(),
			completeCharacterCreation: (selection) => this.completeCharacterCreation(selection),
			data: await this.getData(),
		};
	}
	
	/**
	 * Ensure the character has this sheet's default skills from the shared compendium.
	 */
	async ensureSkills(force = false) {
		if (!force && this.actor.getFlag('genesys', 'characterSetupMode') === 'blank') return;
		if (this.#skillInitialization) return this.#skillInitialization;

		this.#skillInitialization = this.#initializeSkills().finally(() => {
			this.#skillInitialization = undefined;
		});
		return this.#skillInitialization;
	}

	async #initializeSkills() {
		try {
			await deduplicateActorSkills(this.actor);
			const currentProfileId = this.actor.getFlag('genesys', 'skillProfileId');
			if (currentProfileId !== this.defaultSkillProfileId) {
				await replaceDefaultSkillsForActor(this.actor, this.defaultSkillNames);
				await this.actor.setFlag('genesys', 'skillProfileId', this.defaultSkillProfileId);
				await backfillSkillGuidanceForActor(this.actor);
				return;
			}

			await addDefaultSkillsToActor(this.actor, this.defaultSkillNames, false);
			await backfillSkillGuidanceForActor(this.actor);
		} catch (error) {
			console.error('[Genesys] Failed to initialize character skills.', error);
		}
	}

	async useBlankCharacterSheet() {
		await this.actor.setFlag('genesys', 'characterSetupMode', 'blank');
		await this.render(false);
	}

	async completeCharacterCreation(selection: { archetypeId: string; careerId: string; specializationId: string; careerSkillNames: string[] }) {
		const pack = game.packs.get(CHARACTER_CREATION_COMPENDIUM);
		if (!pack) {
			ui.notifications.error(game.i18n.localize('Genesys.CharacterCreation.LoadError'));
			return false;
		}

		const [archetype, career, specialization] = await Promise.all([
			pack.getDocument(selection.archetypeId),
			pack.getDocument(selection.careerId),
			pack.getDocument(selection.specializationId),
		]) as GenesysItem<BaseItemDataModel>[];

		if (archetype?.type !== 'archetype' || career?.type !== 'career' || specialization?.type !== 'specialization') {
			ui.notifications.error(game.i18n.localize('Genesys.CharacterCreation.ValidationError'));
			return false;
		}

		const careerData = (career as GenesysItem<CareerDataModel>).systemData;
		const specializationData = (specialization as GenesysItem<SpecializationDataModel>).systemData;
		const specializationKey = specializationData.key;
		if (careerData.availableSpecializationKeys.length && !specializationMatchesCareer(specializationKey, careerData.availableSpecializationKeys)) {
			ui.notifications.error(game.i18n.localize('Genesys.CharacterCreation.ValidationError'));
			return false;
		}
		const archetypeOption = {
			id: archetype.id,
			name: archetype.name,
			img: archetype.img,
			description: archetype.systemData.description,
			key: (archetype as GenesysItem<ArchetypeDataModel>).systemData.key,
			careerSkills: [],
			availableSpecializationKeys: [],
			allowedArchetypeKeys: [],
		};
		const specializationOption = {
			id: specialization.id,
			name: specialization.name,
			img: specialization.img,
			description: specializationData.description,
			key: specializationData.key,
			careerSkills: specializationData.careerSkills,
			availableSpecializationKeys: [],
			allowedArchetypeKeys: specializationData.allowedArchetypeKeys,
		};
		if (!specializationMatchesArchetype(specializationOption, archetypeOption)) {
			ui.notifications.error(game.i18n.localize('Genesys.CharacterCreation.ValidationError'));
			return false;
		}

		const eligibleSkillNames = uniqueNames([
			...careerData.careerSkills.map(careerSkillName),
			...(specializationData.careerSkills ?? []),
		]);
		const eligibleSkillNameSet = new Set(eligibleSkillNames.map(normalizeSkillName));
		const selectedSkillNameSet = new Set(selection.careerSkillNames.map(normalizeSkillName));
		const requiredSkillRanks = Math.min(CONFIG.genesys.settings.freeCareerSkillRanks, eligibleSkillNames.length);
		if (selectedSkillNameSet.size !== requiredSkillRanks || [...selectedSkillNameSet].some((name) => !eligibleSkillNameSet.has(name))) {
			ui.notifications.error(game.i18n.localize('Genesys.CharacterCreation.ValidationError'));
			return false;
		}

		try {
			await this.actor.setFlag('genesys', 'characterSetupMode', 'wizard');
			await this.ensureSkills(true);
			await this.applyArchetype(archetype as GenesysItem<ArchetypeDataModel>);
			await this._onDropItemCreate(archetype.toObject());
			await this.applyCareer(career as GenesysItem<CareerDataModel>, selection.careerSkillNames, specializationData.careerSkills);
			const createdSpecialization = await this.applySpecialization(specialization as GenesysItem<SpecializationDataModel>, {
				replaceExisting: false,
				grantInventory: true,
			});
			await this.actor.setFlag('genesys', 'activeSpecializationId', createdSpecialization.id);
			await this.#selectFirstProfessionStep(createdSpecialization);
			await this.render(false);
			return true;
		} catch (error) {
			console.error('[Genesys] Character creation failed.', error);
			ui.notifications.error(game.i18n.localize('Genesys.CharacterCreation.LoadError'));
			return false;
		}
	}

	#getCareerSkillSourceNames() {
		const names: string[] = [];

		for (const item of this.actor.items) {
			if (item.type === 'career') {
				const career = item as GenesysItem<CareerDataModel>;
				names.push(...career.systemData.careerSkills.map(careerSkillName));
			} else if (item.type === 'specialization') {
				const specialization = item as GenesysItem<SpecializationDataModel>;
				names.push(...(specialization.systemData.careerSkills ?? []));
			} else if (item.type === 'talent') {
				names.push(...(TALENT_GRANTED_CAREER_SKILLS.get(normalizeTalentName(item.name)) ?? []));
			}
		}

		return new Set(uniqueNames(names).map(normalizeSkillName));
	}

	async syncCareerSkillFlags(affectedSkillNames: string[] = []) {
		const careerSkillNames = this.#getCareerSkillSourceNames();
		const affectedNames = new Set([...affectedSkillNames, ...TALENT_GRANTED_CAREER_SKILL_NAMES].map(normalizeSkillName));
		const skills = this.actor.items.filter((i) => i.type === 'skill') as GenesysItem<SkillDataModel>[];

		await Promise.all(
			skills.map(async (skill) => {
				const shouldBeCareer = careerSkillNames.has(normalizeSkillName(skill.name));
				const canClearCareer = affectedNames.has(normalizeSkillName(skill.name));
				if (!shouldBeCareer && !canClearCareer) {
					return;
				}

				if (skill.systemData.career === shouldBeCareer) {
					return;
				}

				await skill.update({
					'system.career': shouldBeCareer,
				});
			}),
		);
	}

	async #ensureCareerSkillsAvailableAndMarked(skillNames: string[]) {
		const names = uniqueNames(skillNames);
		await addDefaultSkillsToActor(this.actor, names, false);

		const normalizedNames = new Set(names.map(normalizeSkillName));
		const matchingSkills = this.actor.items.filter(
			(item) => item.type === 'skill' && normalizedNames.has(normalizeSkillName(item.name)),
		) as GenesysItem<SkillDataModel>[];

		await Promise.all(
			matchingSkills
				.filter((skill) => !skill.systemData.career)
				.map((skill) => skill.update({ 'system.career': true })),
		);

		const foundNames = new Set(matchingSkills.map((skill) => normalizeSkillName(skill.name)));
		return names.filter((name) => !foundNames.has(normalizeSkillName(name)));
	}

	#prepareGrantedInventoryItem(item: GenesysItem<BaseItemDataModel>, source: GenesysItem<BaseItemDataModel>) {
		const data = foundry.utils.deepClone(item) as any;
		delete data._id;
		delete data._stats;
		delete data.ownership;
		delete data.folder;
		delete data.sort;

		data.flags ??= {};
		data.flags.genesys ??= {};
		data.flags.genesys.grantedBy = {
			itemId: source.id,
			itemType: source.type,
			itemName: source.name,
		};

		return data;
	}

	async #createGrantedInventoryItems(source: GenesysItem<CareerDataModel | SpecializationDataModel>) {
		const grantedItems = (source.systemData.grantedItems ?? [])
			.filter((item) => item && GRANTED_INVENTORY_TYPES.includes(item.type))
			.map((item) => this.#prepareGrantedInventoryItem(item as GenesysItem<BaseItemDataModel>, source as GenesysItem<BaseItemDataModel>));

		if (!grantedItems.length) {
			return;
		}

		const createdItems = await this.actor.createEmbeddedDocuments('Item', grantedItems) as GenesysItem<BaseItemDataModel>[];
		await this.actor.systemData.handleEffectsStatus(createdItems, { equipmentState: EquipmentState.Carried });
	}

	async #deleteGrantedInventoryItems(source: GenesysItem<BaseItemDataModel>) {
		const grantedItems = this.actor.items.filter((item) => {
			const grantedBy = item.getFlag('genesys', 'grantedBy') as { itemId?: string } | undefined;
			return grantedBy?.itemId === source.id;
		});

		if (!grantedItems.length) {
			return;
		}

		await this.actor.deleteEmbeddedDocuments('Item', grantedItems.map((item) => item.id));
	}

	static override get defaultOptions() {
		return {
			...super.defaultOptions,
			classes: ['genesys', 'sheet', 'actor', 'character', 'profile-genesys'],
			tabs: [
				{
					navSelector: '.sheet-tabs',
					contentSelector: '.sheet-body',
					initial: 'skills',
				},
			],
		};
	}

	protected override async _onDropItem(event: DragEvent, data: DropCanvasData<'Item', GenesysItem<BaseItemDataModel>>): Promise<GenesysItem<BaseItemDataModel>[] | boolean> {
		// Regardless of what was dropped this is the last spot to process it.
		event.stopPropagation();

		// Check that the we have the UUID of the item that was dropped.
		const dragData = data as DragTransferData;
		if (!dragData.uuid) {
			return false;
		}

		// Make sure that the item in question exists and this actor doesn't own it.
		const droppedItem = await fromUuid<GenesysItem<BaseItemDataModel>>(dragData.uuid);
		if (!droppedItem || droppedItem.actor?.uuid === this.actor.uuid) {
			return false;
		}

		// We must be able to edit the actor to proceed.
		if (!this.isEditable) {
			return false;
		}

		let clonedDroppedItem: GenesysItem<BaseItemDataModel>[] | undefined | boolean;
		if (CharacterDataModel.isRelevantTypeForContext('APTITUDE', droppedItem.type)) {
			if (droppedItem.type === 'archetype') {
				// If it's an archetype, delete the old one and apply the new one.

				if (!this.canRemoveArchetype()) {
					return false;
				}

				const existingArchetype = this.actor.items.find((i) => i.type === 'archetype');
				if (existingArchetype) {
					await this.removeArchetype(existingArchetype as GenesysItem<ArchetypeDataModel>);
				}

				await this.applyArchetype(droppedItem as GenesysItem<ArchetypeDataModel>);

				// Let `super` handle the rest and save a reference to it.
				clonedDroppedItem = await super._onDropItem(event, data);
			} else if (droppedItem.type === 'career') {
				// If it's a career, delete the old one and apply the new one.

				if (this.actor.systemData.experienceJournal.entries.some((entry) => entry.type === EntryType.Skill)) {
					return false;
				}

				const existingCareer = this.actor.items.find((i) => i.type === 'career');
				if (existingCareer) {
					await this.removeCareer(existingCareer as GenesysItem<CareerDataModel>);
				}

				const career = await this.applyCareer(droppedItem as GenesysItem<CareerDataModel>);

				clonedDroppedItem = [career];
			} else if (droppedItem.type === 'specialization') {
				const specialization = droppedItem as GenesysItem<SpecializationDataModel>;
				const hasSpecialization = this.actor.items.some((item) => item.type === 'specialization');
				const appliedSpecialization = hasSpecialization
					? await this.purchaseAdditionalSpecialization(specialization)
					: await this.applySpecialization(specialization, {
							replaceExisting: false,
							grantInventory: true,
						});

				clonedDroppedItem = appliedSpecialization ? [appliedSpecialization] : false;
			} else {
				// Let `super` handle the drop and save a reference to it.
				clonedDroppedItem = await super._onDropItem(event, data);
			}
		} else if (CharacterDataModel.isRelevantTypeForContext('SKILL', droppedItem.type)) {
			// Prevent adding the same skill multiple times.
			if (droppedItem.type === 'skill' && this.actor.items.find((item) => item.type === 'skill' && item.name === droppedItem.name)) {
				return false;
			}

			// Let `super` handle the drop and save a reference to it.
			clonedDroppedItem = await super._onDropItem(event, data);
		} else if (CharacterDataModel.isRelevantTypeForContext('COMBAT', droppedItem.type)) {
			// Let `super` handle the drop and save a reference to it.
			clonedDroppedItem = await super._onDropItem(event, data);
		} else if (CharacterDataModel.isRelevantTypeForContext('TALENT', droppedItem.type)) {
			if (droppedItem.type === 'ability') {
				// Let `super` handle the drop and save a reference to it.
				clonedDroppedItem = await super._onDropItem(event, data);
			} else if (droppedItem.type === 'talent') {
				const droppedTalent = droppedItem as GenesysItem<TalentDataModel>;
				const result = await purchaseAdvance(this.actor, {
					type: 'talent',
					talentId: droppedTalent.id,
					talentName: droppedTalent.name,
					sourceTalent: droppedTalent,
				});
				const targetTalent = result.itemId ? this.actor.items.get(result.itemId) as GenesysItem<TalentDataModel> | undefined : undefined;
				clonedDroppedItem = result.success && targetTalent ? [targetTalent] : false;
			} else {
				// Let `super` handle the drop and save a reference to it.
				clonedDroppedItem = await super._onDropItem(event, data);
			}
		} else if (CharacterDataModel.isRelevantTypeForContext('INVENTORY', droppedItem.type)) {
			if (droppedItem.actor) {
				// If the item was dropped from another actor then we try transfering it and save a reference to it.
				clonedDroppedItem = await transferInventoryBetweenActors(dragData, this.actor, (type) => CharacterDataModel.isRelevantTypeForContext('INVENTORY', type));
			} else {
				// If the item comes from a folder or compendium then let `super` handle the drop and save a reference to it.
				clonedDroppedItem = await super._onDropItem(event, data);
			}

			// If we sucessfully cloned the dropped inventory item then update the state for any associated effect.
			if (Array.isArray(clonedDroppedItem)) {
				await this.actor.systemData.handleEffectsStatus(clonedDroppedItem, { equipmentState: EquipmentState.Carried });
			}
		} else {
			// If the dropped item is not of a type that we have a default behavior then end early.
			return false;
		}

		return clonedDroppedItem ?? false;
	}

	#getProfessionStepMap() {
		const rawMap = this.actor.getFlag('genesys', 'professionStepBySpecialization');
		return rawMap && typeof rawMap === 'object' ? (rawMap as Record<string, string>) : {};
	}

	async #selectFirstProfessionStep(specialization: GenesysItem<SpecializationDataModel>) {
		const firstStep = specialization.systemData.professionPath?.[0];
		if (!firstStep) return;

		const professionId = firstStep.id || firstStep.name || 'profession-0';
		await this.actor.setFlag('genesys', 'professionStepBySpecialization', {
			...this.#getProfessionStepMap(),
			[specialization.id]: professionId,
		});
		await this.actor.update({
			'system.mainProfessionId': professionId,
		});
	}

	#getUnlockedProfessionSteps(specialization: GenesysItem<SpecializationDataModel>) {
		const path = specialization.systemData.professionPath ?? [];
		const selectedProfessionId = this.#getProfessionStepMap()[specialization.id] || this.actor.systemData.mainProfessionId;
		const currentIndex = path.findIndex((step, index) => (step.id || step.name || `profession-${index}`) === selectedProfessionId);
		return currentIndex === -1 ? [] : path.slice(0, currentIndex + 1);
	}

	#getSpecializationDiscount(targetName: string) {
		let bestDiscount: { cost: number; source: string } | null = null;
		const discountPattern = /(\d+)\s*P[DX]\b[\s\S]{0,100}?zakup(?:u|ić)?\s+specjalizacji\s+([^.;,\n]+)/gi;
		const normalizedTarget = normalizeSpecializationName(targetName);
		const targetStem = normalizedTarget.slice(0, Math.min(8, normalizedTarget.length));

		for (const specialization of this.actor.items.filter((item) => item.type === 'specialization') as GenesysItem<SpecializationDataModel>[]) {
			for (const step of this.#getUnlockedProfessionSteps(specialization)) {
				let match: RegExpExecArray | null;
				while ((match = discountPattern.exec(step.effects ?? ''))) {
					const cost = Number(match[1]);
					const offerName = normalizeSpecializationName(match[2] ?? '');
					const matchesTarget = offerName.includes(normalizedTarget) || normalizedTarget.includes(offerName) || (targetStem.length >= 5 && offerName.includes(targetStem));

					if (Number.isFinite(cost) && matchesTarget && (!bestDiscount || cost < bestDiscount.cost)) {
						bestDiscount = {
							cost,
							source: step.name || specialization.name,
						};
					}
				}
			}
		}

		return bestDiscount;
	}

	async purchaseAdditionalSpecialization(droppedSpecialization: GenesysItem<SpecializationDataModel>) {
		const existingSpecializations = this.actor.items.filter((item) => item.type === 'specialization') as GenesysItem<SpecializationDataModel>[];
		if (existingSpecializations.some((specialization) => normalizeSpecializationName(specialization.name) === normalizeSpecializationName(droppedSpecialization.name))) {
			ui.notifications.info(`Postać ma już specjalizację "${droppedSpecialization.name}".`);
			return null;
		}

		const defaultCost = droppedSpecialization.systemData.cost > 0 ? droppedSpecialization.systemData.cost : (existingSpecializations.length + 1) * 10;
		const discount = this.#getSpecializationDiscount(droppedSpecialization.name);
		const cost = discount && discount.cost < defaultCost ? discount.cost : defaultCost;
		const source = discount && discount.cost < defaultCost ? discount.source : '';

		const result = await purchaseAdvance(this.actor, {
			type: 'specialization',
			specialization: droppedSpecialization,
			cost,
			source,
			execute: () => this.applySpecialization(droppedSpecialization, {
				replaceExisting: false,
				grantInventory: false,
			}),
		});

		const purchasedSpecialization = result.itemId ? this.actor.items.get(result.itemId) as GenesysItem<SpecializationDataModel> | undefined : undefined;
		if (!result.success || !purchasedSpecialization) {
			return null;
		}

		await this.actor.setFlag('genesys', 'activeSpecializationId', purchasedSpecialization.id);
		await this.render();

		return purchasedSpecialization;
	}

	async applySpecialization(
		droppedSpecialization: GenesysItem<SpecializationDataModel>,
		options: { replaceExisting?: boolean; grantInventory?: boolean } = {},
	) {
		const replaceExisting = options.replaceExisting ?? true;
		const grantInventory = options.grantInventory ?? true;
		const oldCareerSkills: string[] = [];

		const existingSpecializations = this.actor.items.filter((i) => i.type === 'specialization') as GenesysItem<SpecializationDataModel>[];
		const duplicateSpecialization = existingSpecializations.find((specialization) => normalizeTalentName(specialization.name) === normalizeTalentName(droppedSpecialization.name));
		if (!replaceExisting && duplicateSpecialization) {
			ui.notifications.info(`Postać ma już specjalizację "${droppedSpecialization.name}".`);
			return duplicateSpecialization;
		}

		if (replaceExisting) {
			for (const existingSpecialization of existingSpecializations) {
				oldCareerSkills.push(...uniqueNames(existingSpecialization.systemData.careerSkills ?? []));
				await this.#deleteGrantedInventoryItems(existingSpecialization as GenesysItem<BaseItemDataModel>);
				await existingSpecialization.delete();
			}
		}

		const [newSpecialization] = (await this._onDropItemCreate(droppedSpecialization.toObject())) as GenesysItem<SpecializationDataModel>[];
		const newCareerSkills = uniqueNames(newSpecialization.systemData.careerSkills ?? droppedSpecialization.systemData.careerSkills ?? []);
		const missingSkills = await this.#ensureCareerSkillsAvailableAndMarked(newCareerSkills);

		if (grantInventory) {
			await this.#createGrantedInventoryItems(newSpecialization);
		}

		await this.syncCareerSkillFlags([...oldCareerSkills, ...newCareerSkills]);

		if (missingSkills.length) {
			ui.notifications.warn(`Nie znaleziono umiejętności specjalizacji w kompendium: ${missingSkills.join(', ')}.`);
		}

		await this.render();
		return newSpecialization;
	}

	async #updateForArchetype(workingData: CharacterDataModel) {
		await this.actor.update({
			'system.characteristics.brawn': workingData.characteristics.brawn,
			'system.characteristics.agility': workingData.characteristics.agility,
			'system.characteristics.intellect': workingData.characteristics.intellect,
			'system.characteristics.cunning': workingData.characteristics.cunning,
			'system.characteristics.willpower': workingData.characteristics.willpower,
			'system.characteristics.presence': workingData.characteristics.presence,

			'system.wounds.max': workingData.wounds.max,
			'system.strain.max': workingData.strain.max,
			'system.corruption.max': workingData.corruption.max,

			'system.experienceJournal.entries': workingData.experienceJournal.entries,
		});
	}

	canRemoveArchetype() {
		return this.actor.systemData.experienceJournal.entries.length <= 1;
	}

	/**
	 *
	 * @param archetype
	 */
	async applyArchetype(archetype: GenesysItem<ArchetypeDataModel>) {
		const workingData = <CharacterDataModel>deepClone(this.actor.systemData);
		const archetypeData = archetype.systemData;

		// Archetypes/species define the character's starting characteristics.
		workingData.characteristics.brawn = archetypeData.characteristics.brawn;
		workingData.characteristics.agility = archetypeData.characteristics.agility;
		workingData.characteristics.intellect = archetypeData.characteristics.intellect;
		workingData.characteristics.cunning = archetypeData.characteristics.cunning;
		workingData.characteristics.willpower = archetypeData.characteristics.willpower;
		workingData.characteristics.presence = archetypeData.characteristics.presence;

		// Wound & Strain Thresholds
		workingData.wounds.max += archetypeData.woundThreshold + archetypeData.characteristics.brawn;
		workingData.strain.max += archetypeData.strainThreshold + archetypeData.characteristics.willpower;
		workingData.corruption.max += archetypeData.corruptionThreshold + archetypeData.characteristics.presence;

		// Granted Items
		const items = archetypeData.grantedItems;

		// Non-skills get added as embedded items.
		const nonSkills = items.filter((i) => i && i.type !== 'skill');
		await this.actor.createEmbeddedDocuments('Item', nonSkills);

		// Prepend starting XP to character's Experience Journal.
		workingData.experienceJournal.entries = [
			{
				amount: archetypeData.startingXP,
				type: EntryType.Starting,
			},
			...workingData.experienceJournal.entries,
		];

		await this.#updateForArchetype(workingData);
	}

	/**
	 *
	 * @param archetype
	 */
	async removeArchetype(archetype: GenesysItem<ArchetypeDataModel>) {
		const workingData = <CharacterDataModel>deepClone(this.actor.systemData);
		const archetypeData = archetype.systemData;

		// Return to the system's pre-archetype baseline.
		workingData.characteristics.brawn = 1;
		workingData.characteristics.agility = 1;
		workingData.characteristics.intellect = 1;
		workingData.characteristics.cunning = 1;
		workingData.characteristics.willpower = 1;
		workingData.characteristics.presence = 1;

		// Wound & Strain Thresholds
		workingData.wounds.max -= archetypeData.woundThreshold + archetypeData.characteristics.brawn;
		workingData.strain.max -= archetypeData.strainThreshold + archetypeData.characteristics.willpower;
		workingData.corruption.max -= archetypeData.corruptionThreshold + archetypeData.characteristics.presence;

		// Remove starting XP from Experience Journal.
		workingData.experienceJournal.entries = workingData.experienceJournal.entries.slice(1);

		// Remove granted items.
		const items = archetypeData.grantedItems;

		// Non-skills are embedded items & need to be deleted.
		const nonSkills = items.filter((i) => i && i.type !== 'skill').map((a) => a.name);
		await Promise.all(
			this.actor.items
				.filter((i) => i.type !== 'skill')
				.map(async (i) => {
					if (nonSkills.includes(i.name)) {
						await i.delete();
					}
				}),
		);

		// Update data.
		await this.#updateForArchetype(workingData);

		// Delete the archetype.
		await archetype.delete();
	}

	/**
	 *
	 * @param droppedCareer
	 */
	async applyCareer(droppedCareer: GenesysItem<CareerDataModel>, selectedSkillNames?: string[], additionalSkillNames: string[] = []) {
		const [career] = await this._onDropItemCreate(droppedCareer.toObject());
		const careerSkillNames = uniqueNames(droppedCareer.systemData.careerSkills.map(careerSkillName));
		const eligibleSkillNames = uniqueNames([...careerSkillNames, ...additionalSkillNames]);
		const missingCareerSkills = await this.#ensureCareerSkillsAvailableAndMarked(eligibleSkillNames);
		if (missingCareerSkills.length) {
			ui.notifications.warn(`Nie znaleziono umiejętności kariery w kompendium: ${missingCareerSkills.join(', ')}.`);
		}

		const eligibleSkillNameSet = new Set(eligibleSkillNames.map(normalizeSkillName));
		const commonSkills = <GenesysItem<SkillDataModel>[]>this.actor.items.filter((i) => i.type === 'skill' && eligibleSkillNameSet.has(normalizeSkillName(i.name)));
		const selectedSkillNameSet = selectedSkillNames ? new Set(selectedSkillNames.map(normalizeSkillName)) : null;
		const selectedSkills = selectedSkillNameSet
			? commonSkills.filter((skill) => selectedSkillNameSet.has(normalizeSkillName(skill.name))).map((skill) => skill.id)
			: commonSkills.length ? await CareerSkillPrompt.promptForSkills(commonSkills) : [];

		await career.update({
			'system.selectedSkillIDs': selectedSkills,
		});

		await Promise.all(
			commonSkills.map(
				async (skill) =>
					await skill.update({
						'system.career': true,
						'system.rank': skill.systemData.rank + (selectedSkills.includes(skill.id) ? 1 : 0),
					}),
			),
		);

		await this.syncCareerSkillFlags(careerSkillNames);
		await this.#createGrantedInventoryItems(career as GenesysItem<CareerDataModel>);

		return career;
	}

	/**
	 *
	 * @param career
	 */
	async removeCareer(career: GenesysItem<CareerDataModel>) {
		const careerData = career.systemData;
		const careerSkillNames = careerData.careerSkills.map(careerSkillName);

		const skills = <GenesysItem<SkillDataModel>[]>this.actor.items.filter((i) => i.type === 'skill');

		await Promise.all(
			skills.map(async (skill) => {
				if (careerData.selectedSkillIDs.includes(skill.id)) {
					await skill.update({
						'system.rank': Math.max(0, skill.systemData.rank - 1),
					});
				}
			}),
		);

		await this.#deleteGrantedInventoryItems(career as GenesysItem<BaseItemDataModel>);
		await career.delete();
		await this.syncCareerSkillFlags(careerSkillNames);
	}
}
