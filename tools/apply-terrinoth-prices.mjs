import fs from 'node:fs';

const PACK_SOURCE = 'packs-src/itemy/pack.json';
const TERRINOTH_SOURCE = 'Realms of Terrinoth';

const TERRINOTH_PRICES = new Map([
	['Topór (T)', 150],
	['Kastety', 40],
	['Sztylet (T)', 60],
	['Cep (T)', 150],
	['Topór dwuręczny (T)', 300],
	['Miecz dwuręczny (T)', 300],
	['Halabarda (T)', 250],
	['Buzdygan', 75],
	['Nadziak (T)', 160],
	['Pika (T)', 100],
	['Tarcza (T)', 80],
	['Duża tarcza (T)', 160],
	['Pawęż (T)', 280],
	['Włócznia (T)', 110],
	['Włócznia, lekka (T)', 90],
	['Kostur (T)', 40],
	['Miecz (T)', 200],
	['Młot bojowy (T)', 600],
	['Łuk (T)', 275],
	['Kusza (T)', 600],
	['Kusza ręczna (T)', 750],
	['Kusza ciężka (T)', 1000],
	['Kusza powtarzalna (T)', 800],
	['Łuk długi', 450],
	['Proca (T)', 20],
	['Topór do rzucania (T)', 50],
	['Brygantyna (T)', 400],
	['Kolczuga (T)', 550],
	['Ciężka szata (T)', 45],
	['Zbroja skórzana (T)', 50],
	['Przeszywanica (T)', 35],
	['Zbroja płytowa (T)', 1000],
	['Zbroja łuskowa (T)', 410],
]);

function visitRecords(records, callback) {
	for (const record of records) {
		callback(record.value, record.key);
		visitNested(record.value, callback, record.key);
	}
}

function visitNested(value, callback, parentKey) {
	if (!value || typeof value !== 'object') {
		return;
	}

	if (Array.isArray(value)) {
		for (const child of value) {
			visitNested(child, callback, parentKey);
		}
		return;
	}

	for (const child of Object.values(value)) {
		if (child && typeof child === 'object') {
			callback(child, parentKey);
			visitNested(child, callback, parentKey);
		}
	}
}

const data = JSON.parse(fs.readFileSync(PACK_SOURCE, 'utf8'));
const updated = [];

visitRecords(data.records, (value, key) => {
	if (!value?.name || !value?.system || !TERRINOTH_PRICES.has(value.name)) {
		return;
	}

	const price = TERRINOTH_PRICES.get(value.name);
	if (value.system.price === price) {
		return;
	}

	value.system.price = price;
	value.flags ??= {};
	value.flags.genesys ??= {};
	value.flags.genesys.sourcePrices ??= {};
	value.flags.genesys.sourcePrices.genesys = {
		source: TERRINOTH_SOURCE,
		price,
	};
	updated.push({ key, name: value.name, price });
});

fs.writeFileSync(PACK_SOURCE, `${JSON.stringify(data, null, '\t')}\n`, 'utf8');
console.log(`[apply-terrinoth-prices] Updated ${updated.length} prices.`);
for (const item of updated) {
	console.log(`- ${item.name}: ${item.price}`);
}
