/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file
 */

import GenesysActor from '@/actor/GenesysActor';
import GenesysDie from '@/dice/types/GenesysDie';
import { Characteristic } from '@/data/Characteristics';
import GenesysItem from '@/item/GenesysItem';
import WeaponDataModel from '@/item/data/WeaponDataModel';
import VehicleWeaponDataModel from '@/item/data/VehicleWeaponDataModel';
import { buildChaosManifestationRollData, type ChaosManifestationRollMetadata } from '@/magic/ChaosManifestations';
import { buildAttackResolutionFlag, maybeCreateAttackDefensePrompt } from '@/combat/AttackResolution';
import { buildSymbolSpendingFlag } from '@/dice/SymbolSpending';
import { CombatEffectKeys, getActorCombatEffectValue } from '@/combat/CombatEffects';

export type AttackRollWeapon = {
	name: string;
	systemData: Pick<WeaponDataModel, 'baseDamage' | 'critical' | 'range' | 'qualities' | 'damageCharacteristic'>;
};

export type GenesysRollResults = {
	/**
	 * Total number of successes that were rolled, including the one added by Triumphs. Always >= 0.
	 */
	totalSuccess: number;

	/**
	 * Total number of failures that were rolled, including the one added by Despairs. Always >= 0.
	 */
	totalFailures: number;

	/**
	 * Total number of advantages that were rolled. Always >= 0.
	 */
	totalAdvantage: number;

	/**
	 * Total number of threats that were rolled. Always >= 0.
	 */
	totalThreat: number;

	/**
	 * Total number of triumphs that were rolled. Always >= 0.
	 */
	totalTriumph: number;

	/**
	 * Total number of despairs that were rolled. Always >= 0.
	 */
	totalDespair: number;

	/**
	 * Number of successes left over in the roll after cancelling out with failures. May be negative if there were more failures.
	 */
	netSuccess: number;

	/**
	 * Number of failures left over in the roll after cancelling out with successes. May be negative if there were more successes.
	 */
	netFailure: number;

	/**
	 * Number of advantages left over in the roll after cancelling out with threats. May be negative if there were more threats.
	 */
	netAdvantage: number;

	/**
	 * Number of threats left over in the roll after cancelling out with advantages. May be negative if there were more advantages.
	 */
	netThreat: number;

	/**
	 * A map of die type to all the result faces from the roll.
	 */
	faces: Record<string, string[]>;

	/**
	 * Extra symbols added to the roll.
	 */
	extraSymbols: Record<string, number>;
};

export default class GenesysRoller {
	static async skillRoll({
		actor,
		characteristic,
		usesSuperCharacteristic,
		skillId,
		formula,
		symbols,
		descriptionOverride,
		chaosManifestation,
	}: {
		actor?: GenesysActor;
		characteristic?: Characteristic;
		usesSuperCharacteristic: boolean;
		skillId: string;
		formula: string;
		symbols: Record<string, number>;
		descriptionOverride?: string;
		chaosManifestation?: ChaosManifestationRollMetadata;
	}) {
		const roll = new Roll(formula, { symbols });
		await roll.evaluate();
		const results = this.parseRollResults(roll);

		let description: string | undefined = descriptionOverride;

		if (!description && skillId === '-') {
			if (characteristic) {
				description = game.i18n.format('Genesys.Rolls.Description.Characteristic', {
					characteristic: game.i18n.localize(`Genesys.Characteristics.${characteristic.capitalize()}`),
				});
			} else if (!actor) {
				description = game.i18n.format('Genesys.Rolls.Description.Simple', {
					superChar: usesSuperCharacteristic ? 'super-char' : 'hide-it',
				});
			}
		} else if (!description && actor) {
			if (characteristic) {
				description = game.i18n.format('Genesys.Rolls.Description.Skill', {
					skill: actor.items.get(skillId)?.name ?? 'UNKNOWN',
					characteristic: game.i18n.localize(`Genesys.CharacteristicAbbr.${characteristic.capitalize()}`),
					superChar: usesSuperCharacteristic ? 'super-char' : 'hide-it',
				});
			} else {
				description = game.i18n.format('Genesys.Rolls.Description.SkillWithoutCharacteristic', {
					skill: actor.items.get(skillId)?.name ?? 'UNKNOWN',
				});
			}
		}

		const skill = actor?.items.get(skillId) as GenesysItem | undefined;
		const skillCategory = (skill?.systemData as { category?: string } | undefined)?.category;
		const rollType = chaosManifestation?.enabled || skillCategory === 'magic' ? 'magic' : actor ? 'combat' : undefined;
		const chaosManifestationData = buildChaosManifestationRollData(chaosManifestation, actor, results);
		const symbolSpending = buildSymbolSpendingFlag(actor, results, {
			rollType,
			magic: chaosManifestationData?.flagData
				? {
						actionId: chaosManifestationData.flagData.actionId,
						chaosManifestation: chaosManifestationData.flagData,
					}
				: rollType === 'magic'
					? { actionId: chaosManifestation?.actionId ?? null }
					: undefined,
		});
		const rollData = {
			description: description,
			results,
			chaosManifestation: chaosManifestationData,
			symbolSpending,
		};
		const html = await renderTemplate('systems/genesys/templates/chat/rolls/skill.hbs', rollData);

		const genesysFlags = {
			...(rollData.chaosManifestation ? { chaosManifestation: rollData.chaosManifestation.flagData } : {}),
			...(symbolSpending ? { symbolSpending } : {}),
		};
		const chatData = {
			user: game.user.id,
			speaker: { actor: actor?.id },
			content: html,
			rolls: [roll],
			flags: Object.keys(genesysFlags).length
				? {
						genesys: {
							...genesysFlags,
						},
					}
				: undefined,
		};
		await ChatMessage.create(chatData);
	}

	static async attackRoll({
		actor,
		characteristic,
		usesSuperCharacteristic,
		skillId,
		formula,
		symbols,
		weapon,
		descriptionOverride,
		chaosManifestation,
	}: {
		actor?: GenesysActor;
		characteristic?: Characteristic;
		usesSuperCharacteristic: boolean;
		skillId: string;
		formula: string;
		symbols: Record<string, number>;
		weapon: AttackRollWeapon | GenesysItem<WeaponDataModel | VehicleWeaponDataModel>;
		descriptionOverride?: string;
		chaosManifestation?: ChaosManifestationRollMetadata;
	}) {
		const roll = new Roll(formula, { symbols });
		await roll.evaluate();
		const results = this.parseRollResults(roll);

		let description: string | undefined = descriptionOverride;

		let totalDamage = weapon.systemData.baseDamage;
		let damageFormula = weapon.systemData.baseDamage.toString();

		const withDamageCharacteristic = (weapon.systemData as WeaponDataModel).damageCharacteristic;
		if (actor && withDamageCharacteristic && withDamageCharacteristic !== '-') {
			totalDamage += (actor.system as any).characteristics[withDamageCharacteristic] as number;
			damageFormula = game.i18n.localize(`Genesys.CharacteristicAbbr.${withDamageCharacteristic.capitalize()}`) + ` + ${damageFormula}`;
		}

		if (actor && weapon.systemData.range === 'engaged') {
			const meleeDamageBonus = getActorCombatEffectValue(actor, CombatEffectKeys.AttackMeleeDamage);
			totalDamage += meleeDamageBonus;
			if (meleeDamageBonus) {
				damageFormula += ` + ${meleeDamageBonus}`;
			}
		}

		if (results.netSuccess > 0) {
			totalDamage += results.netSuccess;
		}

		if (!description && skillId === '-') {
			if (characteristic) {
				description = game.i18n.format('Genesys.Rolls.Description.AttackCharacteristic', {
					name: weapon.name,
					characteristic: game.i18n.localize(`Genesys.Characteristics.${characteristic.capitalize()}`),
				});
			}
		} else if (!description && actor) {
			if (characteristic) {
				description = game.i18n.format('Genesys.Rolls.Description.AttackSkill', {
					name: weapon.name,
					skill: actor.items.get(skillId)?.name ?? 'UNKNOWN',
					characteristic: game.i18n.localize(`Genesys.CharacteristicAbbr.${characteristic.capitalize()}`),
					superChar: usesSuperCharacteristic ? 'super-char' : 'hide-it',
				});
			} else {
				description = game.i18n.format('Genesys.Rolls.Description.AttackSkillWithoutCharacteristic', {
					name: weapon.name,
					skill: actor.items.get(skillId)?.name ?? 'UNKNOWN',
				});
			}
		}

		const attackQualities = weapon.systemData.qualities;
		await Promise.all(
			attackQualities.map(async (quality) => {
				quality.description = await TextEditor.enrichHTML(quality.description, { async: true });
			}),
		);

		const chaosManifestationData = buildChaosManifestationRollData(chaosManifestation, actor, results);
		const attackResolution = buildAttackResolutionFlag(actor, weapon, totalDamage, results, chaosManifestationData?.flagData);
		const symbolSpending = buildSymbolSpendingFlag(actor, results, {
			rollType: chaosManifestationData ? 'magicAttack' : 'combat',
			attack: {
				criticalAllowed: Boolean(attackResolution && results.netSuccess > 0),
				critical: weapon.systemData.critical,
				weaponName: weapon.name,
				qualities: weapon.systemData.qualities.map((quality) => ({ ...quality })),
			},
			magic: chaosManifestationData?.flagData
				? {
						actionId: chaosManifestationData.flagData.actionId,
						chaosManifestation: chaosManifestationData.flagData,
					}
				: undefined,
		});
		const rollData = {
			description: description,
			results,
			totalDamage,
			damageFormula,
			critical: weapon.systemData.critical,
			// tbh I can't be assed to implement another Handlebars helper for array length so let's just do undefined. <.<
			qualities: weapon.systemData.qualities.length === 0 ? undefined : attackQualities,
			showDamageOnFailure: CONFIG.genesys.settings.showAttackDetailsOnFailure,
			chaosManifestation: chaosManifestationData,
			attackResolution,
			symbolSpending,
		};
		const html = await renderTemplate('systems/genesys/templates/chat/rolls/attack.hbs', rollData);

		const genesysFlags = {
			...(rollData.chaosManifestation ? { chaosManifestation: rollData.chaosManifestation.flagData } : {}),
			...(rollData.attackResolution ? { attackResolution: rollData.attackResolution } : {}),
			...(symbolSpending ? { symbolSpending } : {}),
		};
		const chatData = {
			user: game.user.id,
			speaker: { actor: actor?.id },
			rollMode: game.settings.get('core', 'rollMode'),
			content: html,
			rolls: [roll],
			flags: Object.keys(genesysFlags).length
				? {
						genesys: {
							...genesysFlags,
						},
					}
				: undefined,
		};
		const message = await ChatMessage.create(chatData);
		if (message) {
			await maybeCreateAttackDefensePrompt(message, rollData.attackResolution);
		}
	}

	static parseRollResults(roll: Roll): GenesysRollResults {
		const faces = roll.dice.reduce((faces: Record<string, string[]>, die) => {
			const genDie = <GenesysDie>die;
			if (faces[genDie.denomination] === undefined) {
				faces[genDie.denomination] = die.results.map((r) => genDie.getResultLabel(r));
			} else {
				faces[genDie.denomination].push(...die.results.map((r) => genDie.getResultLabel(r)));
			}

			return faces;
		}, {});

		// Get symbols from the dice results.
		const results = Object.values(faces)
			.flatMap((v) => v)
			.flatMap((v) => v.split(''))
			.filter((v) => v !== ' ')
			.reduce(
				(results: Record<string, number>, result) => {
					results[result] += 1;

					return results;
				},
				{
					a: 0,
					s: 0,
					t: 0,
					h: 0,
					f: 0,
					d: 0,
				},
			);

		// Add extra symbols specified by the roll.
		const extraSymbols = <Record<string, number>>roll.data.symbols;
		if (extraSymbols) {
			for (const symbol of ['a', 's', 't', 'h', 'f', 'd']) {
				results[symbol] += extraSymbols[symbol] ?? 0;
			}
		}

		// Threat & Triumph add successes & failures.
		results['s'] += results['t'];
		results['f'] += results['d'];

		return {
			totalSuccess: results['s'],
			totalFailures: results['f'],
			totalAdvantage: results['a'],
			totalThreat: results['h'],
			totalTriumph: results['t'],
			totalDespair: results['d'],

			netSuccess: results['s'] - results['f'],
			netFailure: results['f'] - results['s'],
			netAdvantage: results['a'] - results['h'],
			netThreat: results['h'] - results['a'],

			faces,
			extraSymbols,
		};
	}
}
