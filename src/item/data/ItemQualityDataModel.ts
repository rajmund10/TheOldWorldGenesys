/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Item Qualities
 */
import BaseItemDataModel from '@/item/data/BaseItemDataModel';

export default abstract class ItemQualityDataModel extends BaseItemDataModel {
	/**
	 * Whether the quality is passively applied or requires spending advantage.
	 */
	abstract activation: 'active' | 'passive';

	/**
	 * Whether the ability has levels (e.g. "Vicious 3") or not.
	 */
	abstract isRated: boolean;

	/**
	 * Symbol cost required to activate the quality.
	 */
	abstract activationCost: {
		advantages: number;
		triumphs: number;
	};

	/**
	 * How often the quality can be activated from one result.
	 */
	abstract activationLimit: 'once' | 'unlimited' | 'rating';

	static override defineSchema() {
		const fields = foundry.data.fields;

		return {
			...super.defineSchema(),
			activation: new fields.StringField({
				initial: 'passive',
				choices: ['active', 'passive'],
			}),
			isRated: new fields.BooleanField({ initial: true }),
			activationCost: new fields.SchemaField({
				advantages: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
				triumphs: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
			}),
			activationLimit: new fields.StringField({
				initial: 'once',
				choices: ['once', 'unlimited', 'rating'],
			}),
		};
	}
}
