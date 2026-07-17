import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { ClassicLevel } from 'classic-level';

const [, , packName] = process.argv;

if (!packName) {
	console.error('Usage: node tools/export-pack-source.mjs <pack-name>');
	process.exit(1);
}

const root = process.cwd();
const packDir = path.join(root, 'public', 'packs', packName);
const sourceDir = path.join(root, 'packs-src', packName);
const outputFile = path.join(sourceDir, 'pack.json');

function sortRecords(a, b) {
	const prefixA = a.key.startsWith('!folders!') ? 0 : 1;
	const prefixB = b.key.startsWith('!folders!') ? 0 : 1;
	if (prefixA !== prefixB) {
		return prefixA - prefixB;
	}

	const nameA = String(a.value?.name ?? '');
	const nameB = String(b.value?.name ?? '');
	return nameA.localeCompare(nameB, 'pl') || a.key.localeCompare(b.key);
}

const db = new ClassicLevel(packDir, { valueEncoding: 'json' });
await db.open();

try {
	const records = [];
	for await (const [key, value] of db.iterator()) {
		records.push({ key, value });
	}

	records.sort(sortRecords);
	await fs.mkdir(sourceDir, { recursive: true });
	await fs.writeFile(
		outputFile,
		`${JSON.stringify(
			{
				pack: packName,
				format: 'leveldb-records',
				records,
			},
			null,
			'\t',
		)}\n`,
		'utf8',
	);
	console.log(`[export-pack-source] Exported ${records.length} records to ${path.relative(root, outputFile)}.`);
} finally {
	await db.close();
}
