/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Specializations for Warhammer system
 */
import BaseItemDataModel from '@/item/data/BaseItemDataModel';
import GenesysItem from '@/item/GenesysItem';
import { MAGIC_SCHOOL_IDS, MAGIC_TRADITIONS, type MagicAccessData } from '@/magic/MagicConstants';

export type SpecializationProfessionStep = {
	id: string;
	name: string;
	tier: number;
	prerequisites: string;
	effects: string;
	isAlternative: boolean;
};

export default abstract class SpecializationDataModel extends BaseItemDataModel {
	abstract key: string;
	abstract cost: number;
	abstract requirements: string;
	abstract benefits: string;
	abstract socialStatus: string;
	abstract careerSkills: string[];
	abstract grantedItems: GenesysItem<BaseItemDataModel>[];
	abstract magicAccess: MagicAccessData;
	abstract professionPath: SpecializationProfessionStep[];

	static override defineSchema() {
		const fields = foundry.data.fields;

		return {
			...super.defineSchema(),
			key: new fields.StringField({ initial: '', blank: true }),
			cost: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
			requirements: new fields.HTMLField(),
			benefits: new fields.HTMLField(),
			socialStatus: new fields.StringField({ initial: '', blank: true }),
			careerSkills: new fields.ArrayField(new fields.StringField({ initial: '', blank: true })),
			grantedItems: new fields.ArrayField(new fields.ObjectField()),
			magicAccess: new fields.SchemaField({
				enabled: new fields.BooleanField({ initial: false }),
				tradition: new fields.StringField({ initial: '', choices: ['', ...MAGIC_TRADITIONS], blank: true }),
				school: new fields.StringField({ initial: '', choices: ['', ...MAGIC_SCHOOL_IDS], blank: true }),
				lore: new fields.StringField({ initial: '', blank: true }),
				deity: new fields.StringField({ initial: '', blank: true }),
				allowOvercast: new fields.BooleanField({ initial: false }),
				allowMiscast: new fields.BooleanField({ initial: false }),
			}),
			professionPath: new fields.ArrayField(
				new fields.SchemaField({
					id: new fields.StringField({ initial: '', blank: true }),
					name: new fields.StringField({ initial: '', blank: true }),
					tier: new fields.NumberField({ integer: true, initial: 1, min: 1 }),
					prerequisites: new fields.StringField({ initial: '', blank: true }),
					effects: new fields.StringField({ initial: '', blank: true }),
					isAlternative: new fields.BooleanField({ initial: false }),
				}),
			),
		};
	}
}
