import crypto from 'node:crypto';
import fs from 'node:fs';

const PACK_PATH = 'packs-src/itemy/pack.json';
const EFFECT_RECORD_PREFIX = '!items.effects!';

const definitions = {
	'Niewielki': {
		name: 'Niewielki',
		changes: [{ key: 'system.silhouette', mode: 5, value: '0', priority: 20 }],
	},
	'Ogromny': {
		name: 'Ogromny',
		changes: [
			{ key: 'system.silhouette', mode: 5, value: '2', priority: 20 },
			{ key: 'system.encumbrance.threshold', mode: 2, value: '2', priority: 20 },
		],
	},
	'Pasibrzuch': {
		name: 'Pasibrzuch',
		changes: [{ key: 'genesys.combat.attack.meleeDamage', mode: 2, value: '1', priority: 20 }],
		detail: '+1 do obrażeń ataków w zwarciu, dopóki postać jest odpowiednio odżywiona.',
	},
	'Przerażający': {
		name: 'Przerażający',
		changes: [
			{ key: 'genesys.pool.skill.self.Przymuszanie', mode: 2, value: 'B', priority: 20 },
			{ key: 'genesys.pool.skill.self.Przywództwo', mode: 2, value: 'B', priority: 20 },
			{ key: 'genesys.pool.skill.self.Urok Osobisty', mode: 2, value: 'S', priority: 20 },
		],
		detail: 'Nie stosuj podczas interakcji z imperialnymi ogrami.',
	},
	'Błogosławieństwo Ishy': {
		name: 'Błogosławieństwo Ishy (las)',
		disabled: true,
		changes: [
			{ key: 'genesys.pool.char.self.brawn', mode: 2, value: 'B', priority: 20 },
			{ key: 'genesys.pool.char.self.agility', mode: 2, value: 'B', priority: 20 },
			{ key: 'genesys.pool.char.self.willpower', mode: 2, value: 'B', priority: 20 },
		],
		detail: 'Włącz efekt, gdy postać przebywa w lesie.',
	},
	'Strażnik Pól': {
		name: 'Strażnik Pól',
		changes: [{ key: 'genesys.pool.check.self.', mode: 2, value: '^', priority: 20 }],
		poolCondition: { type: 'larger-target' },
		detail: 'Automatycznie wzmacnia atak wręcz przeciw celowi o większej sylwetce.',
	},
	'Odporność na Magię': {
		name: 'Odporność na Magię',
		changes: [{ key: 'genesys.pool.check.target.', mode: 2, value: '*', priority: 20 }],
		poolCondition: { type: 'magic-check' },
		detail: 'Automatycznie wzmacnia trudność testu magii wymierzonego w krasnoluda.',
	},
};

function stableId(seed) {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const hash = crypto.createHash('sha256').update(seed).digest();
	let id = '';
	for (let index = 0; id.length < 16; index += 1) {
		id += alphabet[hash[index] % alphabet.length];
	}
	return id;
}

function createEffect(abilityName, definition) {
	const id = stableId(`racial-ability-effect:${abilityName}`);
	return {
		name: definition.name,
		img: 'icons/svg/aura.svg',
		transfer: true,
		disabled: definition.disabled ?? false,
		changes: definition.changes,
		flags: {
			genesys: {
				racialAbility: true,
				abilityEffect: {
					ability: abilityName,
					detail: definition.detail ?? '',
				},
				...(definition.poolCondition ? { poolCondition: definition.poolCondition } : {}),
			},
		},
		_id: id,
		type: 'base',
		system: {},
		duration: {
			startTime: null,
			combat: null,
		},
		description: '',
		origin: null,
		tint: '#ffffff',
		statuses: [],
		sort: 0,
		_stats: {
			compendiumSource: null,
			duplicateSource: null,
			exportSource: null,
			coreVersion: '14.365',
			systemId: 'genesys',
			systemVersion: '1.1.4',
			lastModifiedBy: null,
		},
	};
}

const source = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
const abilities = new Map(
	source.records
		.filter((record) => record.value?.type === 'ability')
		.map((record) => [record.value.name, record]),
);

const managedParentIds = new Set();
for (const [abilityName, definition] of Object.entries(definitions)) {
	const abilityRecord = abilities.get(abilityName);
	if (!abilityRecord) {
		throw new Error(`Nie znaleziono zdolności: ${abilityName}`);
	}

	const abilityId = abilityRecord.value._id;
	const effect = createEffect(abilityName, definition);
	managedParentIds.add(abilityId);
	abilityRecord.value.effects = [];
	source.records.push({
		key: `${EFFECT_RECORD_PREFIX}${abilityId}.${effect._id}`,
		value: effect,
	});
}

source.records = source.records.filter((record, index, records) => {
	if (!record.key.startsWith(EFFECT_RECORD_PREFIX)) {
		return true;
	}

	const parentId = record.key.slice(EFFECT_RECORD_PREFIX.length).split('.')[0];
	if (!managedParentIds.has(parentId)) {
		return true;
	}

	return records.findLastIndex((candidate) => candidate.key === record.key) === index;
});

for (const record of source.records) {
	if (record.value?.type !== 'archetype') {
		continue;
	}

	for (const grantedItem of record.value.system?.grantedItems ?? []) {
		const definition = definitions[grantedItem?.name];
		if (grantedItem?.type === 'ability' && definition) {
			grantedItem.effects = [createEffect(grantedItem.name, definition)];
		}
	}
}

fs.writeFileSync(PACK_PATH, `${JSON.stringify(source, null, '\t')}\n`, 'utf8');
console.log(`Skonfigurowano ${Object.keys(definitions).length} zdolności rasowych.`);
