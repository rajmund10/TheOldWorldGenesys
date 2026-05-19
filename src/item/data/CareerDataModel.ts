/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Careers
 */
import GenesysItem from '@/item/GenesysItem';
import BaseItemDataModel from '@/item/data/BaseItemDataModel';
import SkillDataModel from '@/item/data/SkillDataModel';

export default abstract class CareerDataModel extends BaseItemDataModel {
	/**
	 * Stable technical key used to match this career with eligible specializations.
	 */
	abstract key: string;

	/**
	 * Career skills offered by the Career.
	 */
	abstract careerSkills: GenesysItem<SkillDataModel>[];

	/**
	 * Stable specialization keys that should be offered when this career is selected.
	 */
	abstract availableSpecializationKeys: string[];

	/**
	 * Inventory items granted when this Career is added to a character.
	 */
	abstract grantedItems: GenesysItem<BaseItemDataModel>[];

	/**
	 * (Owned Only) The list of skills the player selected as their Career Skills to take ranks in.
	 */
	abstract selectedSkillIDs: string[];

	static override defineSchema() {
		const fields = foundry.data.fields;

		return {
			...super.defineSchema(),
			key: new fields.StringField({ initial: '', blank: true }),
			careerSkills: new fields.ArrayField(new fields.ObjectField()),
			availableSpecializationKeys: new fields.ArrayField(new fields.StringField({ blank: true })),
			grantedItems: new fields.ArrayField(new fields.ObjectField()),
			selectedSkillIDs: new fields.ArrayField(new fields.StringField()),
		};
	}
}
