export const MAGIC_TRADITIONS = ['arcana', 'divine', 'primal'] as const;
export type MagicTradition = (typeof MAGIC_TRADITIONS)[number];

export const MAGIC_ACTION_IDS = ['attack', 'augment', 'barrier', 'conjure', 'curse', 'dispel', 'heal', 'utility', 'mask', 'predict', 'senseMagic', 'transform'] as const;
export type MagicActionId = (typeof MAGIC_ACTION_IDS)[number];

export const MAGIC_SCHOOL_IDS = [
	'heavens',
	'fire',
	'metal',
	'beasts',
	'life',
	'light',
	'death',
	'shadow',
	'chaos',
	'sigmar',
	'shallya',
	'morr',
	'myrmidia',
	'manann',
	'ranald',
	'taal',
	'rhya',
	'ulric',
	'verena',
] as const;
export type MagicSchoolId = (typeof MAGIC_SCHOOL_IDS)[number];

export type MagicPathType = 'lore' | 'deity' | 'tradition';

export type MagicAccessData = {
	enabled: boolean;
	tradition: MagicTradition | '';
	school: MagicSchoolId | '';
	lore: string;
	deity: string;
	allowOvercast: boolean;
	allowMiscast: boolean;
};

export const EMPTY_MAGIC_ACCESS: MagicAccessData = {
	enabled: false,
	tradition: '',
	school: '',
	lore: '',
	deity: '',
	allowOvercast: false,
	allowMiscast: false,
};
