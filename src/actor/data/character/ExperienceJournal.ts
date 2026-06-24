/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Experience Journal
 */

import GenesysActor from '@/actor/GenesysActor';
import CharacterDataModel from '@/actor/data/CharacterDataModel';
import SkillDataModel from '@/item/data/SkillDataModel';
import GenesysItem from '@/item/GenesysItem';
import TalentDataModel from '@/item/data/TalentDataModel';
import CareerDataModel from '@/item/data/CareerDataModel';
import SpecializationDataModel from '@/item/data/SpecializationDataModel';
import { Characteristic } from '@/data/Characteristics';
import { CombatPool } from '@/data/Actors';

/**
 * Different sources of Experience Journal entries.
 */
export enum EntryType {
	/**
	 * Starting XP awarded by the character's archetype.
	 */
	Starting = 'Starting',

	/**
	 * XP Awarded by the GM.
	 */
	Award = 'Award',

	/**
	 * XP spent to increase a characteristic during character creation.
	 */
	Characteristic = 'Characteristic',

	/**
	 * XP spent to increase a skill rank.
	 */
	Skill = 'Skill',

	/**
	 * XP spent to purchase a new talent.
	 */
	NewTalent = 'NewTalent',

	/**
	 * XP spent to increase an existing talent's rank.
	 */
	TalentRank = 'TalentRank',

	/**
	 * XP spent to purchase an additional specialization.
	 */
	Specialization = 'Specialization',
}

/**
 * An individual entry representing an increase or decrease in experience points.
 */
export type Entry<DataType = any> = {
	/**
	 * How much experience was spent (negative value) or received (positive value).
	 */
	amount: number;

	/**
	 * Source of the XP award or spend.
	 */
	type: EntryType;

	/**
	 * Generic data container depending on the type of entry.
	 */
	data?: DataType;
};

/**
 * A list of journal entries.
 */
export type ExperienceJournal = {
	entries: Entry[];
};

type CharacteristicEntryData = {
	characteristic: Characteristic;
	rank: number;
};

type SkillEntryData = {
	name: string;
	id: string;
	rank: number;
};

type NewTalentEntryData = {
	name: string;
	id: string;
	tier: number;
	rank: number;
};

type TalentRankEntryData = {
	name: string;
	id: string;
	tier: number;
	rank: number;
};

type SpecializationEntryData = {
	name: string;
	id: string;
	cost: number;
	source?: string;
};

function normalizeSkillName(name: string) {
	return name.trim().toLocaleLowerCase();
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

async function syncCareerSkillFlags(actor: GenesysActor<CharacterDataModel>, excludedItemId?: string) {
	const careerSkillNames = new Set<string>();

	for (const item of actor.items) {
		if (item.id === excludedItemId) {
			continue;
		}

		if (item.type === 'career') {
			const career = item as GenesysItem<CareerDataModel>;
			for (const skillName of career.systemData.careerSkills.map(careerSkillName)) {
				careerSkillNames.add(normalizeSkillName(skillName));
			}
		} else if (item.type === 'specialization') {
			const specialization = item as GenesysItem<SpecializationDataModel>;
			for (const skillName of specialization.systemData.careerSkills ?? []) {
				careerSkillNames.add(normalizeSkillName(skillName));
			}
		}
	}

	const skills = actor.items.filter((item) => item.type === 'skill') as GenesysItem<SkillDataModel>[];
	await Promise.all(
		skills.map((skill) =>
			skill.update({
				'system.career': careerSkillNames.has(normalizeSkillName(skill.name)),
			}),
		),
	);
}

export async function removeJournalEntry(actor: GenesysActor<CharacterDataModel>, index: number) {
	if (index >= actor.systemData.experienceJournal.entries.length) {
		return;
	}

	const updatedEntries = actor.systemData.experienceJournal.entries.slice();
	const removedEntry = updatedEntries.splice(index, 1)[0];

	const additionalChangeKeys: Record<string, any> = {};

	switch (removedEntry.type) {
		case EntryType.Characteristic: {
			const data = <CharacteristicEntryData>removedEntry.data;

			// If there are any entries for the same characteristic with a higher rank, don't allow this to be deleted.
			if (
				actor.systemData.experienceJournal.entries.find(
					(e, i) => i !== index && e.type === EntryType.Characteristic && (<CharacteristicEntryData>e.data).characteristic === data.characteristic && (<CharacteristicEntryData>e.data).rank > data.rank,
				)
			) {
				ui.notifications.info(game.i18n.format('Genesys.Notifications.CannotDeleteCharacteristic', removedEntry.data));
				return;
			}

			// Reduce Wound Threshold or Strain Threshold.
			switch (data.characteristic) {
				case Characteristic.Brawn:
					additionalChangeKeys['system.wounds.max'] = (actor.systemData._source.wounds as CombatPool).max - 1;
					break;

				case Characteristic.Willpower:
					additionalChangeKeys['system.strain.max'] = (actor.systemData._source.strain as CombatPool).max - 1;
					break;
			}

			additionalChangeKeys[`system.characteristics.${data.characteristic}`] = data.rank - 1;
			break;
		}

		case EntryType.Skill: {
			const data = <SkillEntryData>removedEntry.data;

			// If the skill doesn't actually exist on the character, there's nothing further to check.
			const skill = <GenesysItem<SkillDataModel> | undefined>actor.items.find((i) => i.type === 'skill' && i.id === data.id);
			if (!skill) {
				break;
			}

			// If there are any entries for the same skill with a higher rank, don't allow this to be deleted.
			if (actor.systemData.experienceJournal.entries.find((e, i) => i !== index && e.type === EntryType.Skill && (<SkillEntryData>e.data).id === data.id && (<SkillEntryData>e.data).rank > data.rank)) {
				ui.notifications.info(game.i18n.format('Genesys.Notifications.CannotDeleteSkill', removedEntry.data));
				return;
			}

			// Update the skill's rank to reflect the reduction.
			await skill.update({
				'system.rank': Math.max(0, skill.systemData.rank - 1),
			});

			break;
		}

		case EntryType.NewTalent: {
			const data = <NewTalentEntryData>removedEntry.data;

			const talent = <GenesysItem<TalentDataModel> | undefined>actor.items.find((i) => i.type === 'talent' && i.id === data.id);
			if (!talent) {
				break;
			}

			if (data.rank !== talent.systemData.rank) {
				ui.notifications.info(game.i18n.format('Genesys.Notifications.CannotDeleteExistingTalent', data));
				return;
			}

			await talent.delete();

			break;
		}

		case EntryType.TalentRank: {
			const data = <TalentRankEntryData>removedEntry.data;

			const talent = <GenesysItem<TalentDataModel> | undefined>actor.items.find((i) => i.type === 'talent' && i.id === data.id);
			if (!talent) {
				break;
			}

			if (data.rank !== talent.systemData.rank) {
				ui.notifications.info(game.i18n.format('Genesys.Notifications.CannotDeleteExistingTalent', data));
				return;
			}

			await talent.update({
				'system.rank': talent.systemData.rank - 1,
			});

			break;
		}

		case EntryType.Specialization: {
			const data = <SpecializationEntryData>removedEntry.data;
			const specialization = actor.items.find((i) => i.type === 'specialization' && i.id === data.id) as GenesysItem<SpecializationDataModel> | undefined;

			if (specialization) {
				await specialization.delete();
				await syncCareerSkillFlags(actor, specialization.id);
			}

			break;
		}

		default:
			break;
	}

	await actor.update({
		'system.experienceJournal.entries': updatedEntries,
		...additionalChangeKeys,
	});
}
