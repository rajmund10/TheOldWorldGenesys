import EquipmentDataModel from '@/item/data/EquipmentDataModel';

export default abstract class MagicAccessoryDataModel extends EquipmentDataModel {
	/**
	 * Magic skill this accessory is intended to support.
	 */
	abstract magicSkill: string;

	/**
	 * Base damage bonus applied to magic Attack spells when automation is enabled.
	 */
	abstract attackDamageBonus: number;

	/**
	 * Whether the item has an Attack spell damage bonus in its table profile.
	 */
	abstract hasAttackDamageBonus: boolean;

	/**
	 * Stable category for future magic automation.
	 */
	abstract accessoryType: string;

	static override defineSchema() {
		const fields = foundry.data.fields;

		return {
			...super.defineSchema(),
			magicSkill: new fields.StringField(),
			attackDamageBonus: new fields.NumberField({ initial: 0, integer: true }),
			hasAttackDamageBonus: new fields.BooleanField({ initial: false }),
			accessoryType: new fields.StringField(),
		};
	}
}
