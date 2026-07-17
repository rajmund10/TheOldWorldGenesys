import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'packs-src');
const PUBLIC_PACKS_DIR = path.join(ROOT, 'public', 'packs');
const SYSTEM_YAML = path.join(ROOT, 'yaml', 'system.yml');
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const VALID_ITEM_TYPES = new Set([
	'ability',
	'archetype',
	'armor',
	'career',
	'consumable',
	'container',
	'gear',
	'injury',
	'magicAccessory',
	'quality',
	'skill',
	'specialization',
	'talent',
	'vehicleWeapon',
	'weapon',
]);
const VALID_PACK_RECORD_PREFIXES = ['!items!', '!folders!', '!items.effects!'];

async function pathExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readSystemVersion() {
	const yaml = await fs.readFile(SYSTEM_YAML, 'utf8');
	return yaml.match(/^version:\s*["']?([^"'\n]+)["']?/m)?.[1] ?? '0.0.0';
}

function stableId(seed) {
	const hash = crypto.createHash('sha256').update(seed).digest();
	let id = '';
	for (let index = 0; id.length < 16; index += 1) {
		id += ID_ALPHABET[hash[index] % ID_ALPHABET.length];
	}
	return id;
}

function normalizeName(name) {
	return String(name ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function cleanPackRecord(packName, sourceFile, record, index, systemVersion) {
	if (record?.key && record?.value) {
		if (!VALID_PACK_RECORD_PREFIXES.some((prefix) => record.key.startsWith(prefix))) {
			throw new Error(`${sourceFile}: unsupported pack record key "${record.key}"`);
		}

		return {
			key: record.key,
			value: record.value,
		};
	}

	const document = record;
	if (!document?.name || !document?.type) {
		throw new Error(`${sourceFile}: each document needs name and type`);
	}

	if (document.type !== 'Item') {
		if (!VALID_ITEM_TYPES.has(document.type)) {
			throw new Error(`${sourceFile}: unsupported Item type "${document.type}" for "${document.name}"`);
		}
	}

	const itemType = document.type === 'Item' ? document.system?.type : document.type;
	const id = document._id ?? stableId(`${packName}:${document.type}:${document.name}`);

	return {
		key: `!items!${id}`,
		value: {
		name: document.name,
		type: document.type,
		img: document.img ?? 'icons/svg/item-bag.svg',
		folder: document.folder ?? null,
		system: document.system ?? {},
		effects: document.effects ?? [],
		flags: {
			...(document.flags ?? {}),
			genesys: {
				...(document.flags?.genesys ?? {}),
				packSource: {
					sourceFile: path.relative(ROOT, sourceFile).replaceAll(path.sep, '/'),
				},
			},
		},
		ownership: document.ownership ?? { default: 0 },
		_stats: {
			compendiumSource: null,
			duplicateSource: null,
			coreVersion: '13.351',
			systemId: 'genesys',
			systemVersion,
			createdTime: 0,
			modifiedTime: 0,
			lastModifiedBy: null,
			...(document._stats ?? {}),
		},
		_id: id,
		sort: document.sort ?? (index + 1) * 10,
		...(itemType ? {} : {}),
		},
	};
}

function validatePackRecords(packName, records) {
	const seenKeys = new Set();

	for (const record of records) {
		if (seenKeys.has(record.key)) {
			throw new Error(`${packName}: duplicate record key "${record.key}"`);
		}
		seenKeys.add(record.key);

		const normalizedName = normalizeName(record.value?.name);
		if (!normalizedName) {
			throw new Error(`${packName}: record "${record.key}" needs a value.name`);
		}
	}
}

async function loadSourcePacks(systemVersion) {
	if (!(await pathExists(SOURCE_DIR))) {
		return [];
	}

	const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true });
	const packs = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		const packDir = path.join(SOURCE_DIR, entry.name);
		const files = (await fs.readdir(packDir, { withFileTypes: true }))
			.filter((file) => file.isFile() && file.name.endsWith('.json'))
			.map((file) => path.join(packDir, file.name))
			.sort();
		const records = [];

		for (const file of files) {
			const data = await readJson(file);
			if (data.pack && data.pack !== entry.name) {
				throw new Error(`${file}: pack "${data.pack}" does not match folder "${entry.name}"`);
			}

			const fileDocuments = Array.isArray(data) ? data : data.records ?? data.documents;
			if (!Array.isArray(fileDocuments)) {
				throw new Error(`${file}: expected an array or a { records: [] } / { documents: [] } object`);
			}

			records.push(...fileDocuments.map((document, index) => cleanPackRecord(entry.name, file, document, records.length + index, systemVersion)));
		}

		validatePackRecords(entry.name, records);
		packs.push({ name: entry.name, records });
	}

	return packs;
}

async function loadClassicLevel() {
	try {
		const module = await import('classic-level');
		return module.ClassicLevel;
	} catch {
		return null;
	}
}

async function writePackWithClassicLevel(ClassicLevel, pack) {
	const targetDir = path.join(PUBLIC_PACKS_DIR, pack.name);
	await fs.rm(targetDir, { recursive: true, force: true });
	await fs.mkdir(targetDir, { recursive: true });

	const db = new ClassicLevel(targetDir, { valueEncoding: 'json' });
	await db.open();
	try {
		await db.batch(pack.records.map((record) => ({
			type: 'put',
			key: record.key,
			value: record.value,
		})));
	} finally {
		await db.close();
	}
}

async function main() {
	const systemVersion = await readSystemVersion();
	const packs = await loadSourcePacks(systemVersion);
	if (!packs.length) {
		console.log('[build-packs] No pack sources found.');
		return;
	}

	const ClassicLevel = await loadClassicLevel();
	if (!ClassicLevel) {
		const summary = packs.map((pack) => `${pack.name}: ${pack.records.length}`).join(', ');
		console.warn(`[build-packs] Validated pack sources (${summary}). Install optional dependency "classic-level" to write LevelDB packs.`);
		return;
	}

	for (const pack of packs) {
		await writePackWithClassicLevel(ClassicLevel, pack);
		console.log(`[build-packs] Wrote ${pack.records.length} records to public/packs/${pack.name}.`);
	}
}

main().catch((error) => {
	console.error('[build-packs] Failed:', error);
	process.exitCode = 1;
});
