/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file Genesys Items Root.
 */

import GenesysItem from '@/item/GenesysItem';
import { register as registerSheets } from '@/item/sheets';

import AbilityDataModel from '@/item/data/AbilityDataModel';
import ArchetypeDataModel from '@/item/data/ArchetypeDataModel';
import ArmorDataModel from '@/item/data/ArmorDataModel';
import CareerDataModel from '@/item/data/CareerDataModel';
import ContainerDataModel from '@/item/data/ContainerDataModel';
import EquipmentDataModel from '@/item/data/EquipmentDataModel';
import InjuryDataModel from '@/item/data/InjuryDataModel';
import SkillDataModel from '@/item/data/SkillDataModel';
import TalentDataModel from '@/item/data/TalentDataModel';
import SpecializationDataModel from '@/item/data/SpecializationDataModel';
import ProfessionDataModel from '@/item/data/ProfessionDataModel';
import ItemQualityDataModel from '@/item/data/ItemQualityDataModel';
import MagicAccessoryDataModel from '@/item/data/MagicAccessoryDataModel';
import WeaponDataModel from '@/item/data/WeaponDataModel';
import VehicleWeaponDataModel from '@/item/data/VehicleWeaponDataModel';

export function register() {
	CONFIG.Item.documentClass = GenesysItem;

	registerDataModels();
	registerSheets();
}

export const CharacterCreationItemTypes = ['ability', 'archetype', 'career', 'skill', 'talent', 'specialization', 'profession'];

export const EquipmentItemTypes = ['armor', 'consumable', 'container', 'gear', 'magicAccessory', 'quality', 'weapon', 'vehicleWeapon'];

function registerDataModels() {
	CONFIG.Item.dataModels.ability = AbilityDataModel;
	CONFIG.Item.dataModels.archetype = ArchetypeDataModel;
	CONFIG.Item.dataModels.armor = ArmorDataModel;
	CONFIG.Item.dataModels.career = CareerDataModel;
	CONFIG.Item.dataModels.consumable = EquipmentDataModel;
	CONFIG.Item.dataModels.container = ContainerDataModel;
	CONFIG.Item.dataModels.injury = InjuryDataModel;
	CONFIG.Item.dataModels.gear = EquipmentDataModel;
	CONFIG.Item.dataModels.magicAccessory = MagicAccessoryDataModel;
	CONFIG.Item.dataModels.skill = SkillDataModel;
	CONFIG.Item.dataModels.talent = TalentDataModel;
	CONFIG.Item.dataModels.specialization = SpecializationDataModel;
	CONFIG.Item.dataModels.profession = ProfessionDataModel;
	CONFIG.Item.dataModels.quality = ItemQualityDataModel;
	CONFIG.Item.dataModels.weapon = WeaponDataModel;
	CONFIG.Item.dataModels.vehicleWeapon = VehicleWeaponDataModel;
}
