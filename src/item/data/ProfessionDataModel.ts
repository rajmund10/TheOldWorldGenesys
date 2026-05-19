/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Professions
 */
import BaseItemDataModel from '@/item/data/BaseItemDataModel';

export default abstract class ProfessionDataModel extends BaseItemDataModel {
	/**
	 * Career skills provided by this profession.
	 */
	abstract careerSkills: string[];

	static override defineSchema() {
		const fields = foundry.data.fields;

		return {
			...super.defineSchema(),
			careerSkills: new fields.ArrayField(new fields.StringField()),
		};
	}
}