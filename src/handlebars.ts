/**
 * FVTT-Genesys
 * Unofficial implementation of the Genesys RPG for Foundry
 *
 * @author Mezryss
 * @file
 */

export function register() {
	/** String Utilities */
	Handlebars.registerHelper('capitalize', (value: string) => value.capitalize());
	Handlebars.registerHelper('toLowerCase', (value: string) => value.toLowerCase());
	Handlebars.registerHelper('toUpperCase', (value: string) => value.toUpperCase());
	if (game.version.startsWith('12')) {
		Handlebars.registerHelper('concat', (...values: any[]) => values.filter((v) => v && typeof v === 'string').join(''));
	}
	Handlebars.registerHelper('split', (value: string) => value.split(' '));
	Handlebars.registerHelper('isSubstringOf', (substring: string, fullString: string) => fullString.includes(substring));

	/** Math Utilities */
	Handlebars.registerHelper('add', (lhs: number, rhs: number) => lhs + rhs);
	Handlebars.registerHelper('sub', (lhs: number, rhs: number) => lhs - rhs);
	Handlebars.registerHelper('mul', (lhs: number, rhs: number) => lhs * rhs);
	Handlebars.registerHelper('div', (lhs: number, rhs: number) => lhs / rhs);
	Handlebars.registerHelper('min', (lhs: number, rhs: number) => Math.min(lhs, rhs));
	Handlebars.registerHelper('max', (lhs: number, rhs: number) => Math.max(lhs, rhs));
	Handlebars.registerHelper('abs', (val: number) => Math.abs(val));
	Handlebars.registerHelper('floor', (val: number) => Math.floor(val));
	Handlebars.registerHelper('toFixed', (val: number, fractionDigits: number) => val.toFixed(fractionDigits));

	/** Logic Utilities */
	Handlebars.registerHelper('and', (lhs: boolean, rhs: boolean) => lhs && rhs);
	Handlebars.registerHelper('or', (lhs: boolean, rhs: boolean) => lhs || rhs);
	Handlebars.registerHelper('not', (val: boolean) => !val);

	/** Iteration utilities */
	Handlebars.registerHelper('repeat', (times: number, options: { fn: (time: number) => string | number }) => {
		const results = [];

		for (let i = 0; i < times; i++) {
			results.push(options.fn(i));
		}

		return results.join('');
	});

	/** Dice face image helper */
	Handlebars.registerHelper('dieFaceImage', (faceSymbol: string, dieType: string) => {
		const dieAliases: Record<string, string> = {
			b: 'b',
			db: 'b',
			boost: 'b',
			a: 'a',
			da: 'a',
			ability: 'a',
			p: 'p',
			dp: 'p',
			proficiency: 'p',
			s: 's',
			ds: 's',
			setback: 's',
			i: 'i',
			di: 'i',
			difficulty: 'i',
			c: 'c',
			dc: 'c',
			challenge: 'c',
		};
		const faceImages: Record<string, Record<string, string>> = {
			b: {
				' ': 'blue.png',
				s: 'blues.png',
				a: 'bluea.png',
				sa: 'bluesa.png',
				aa: 'blueaa.png',
			},
			a: {
				' ': 'green.png',
				s: 'greens.png',
				ss: 'greenss.png',
				a: 'greena.png',
				sa: 'greensa.png',
				aa: 'greenaa.png',
			},
			p: {
				' ': 'yellow.png',
				s: 'yellows.png',
				ss: 'yellowss.png',
				a: 'yellowa.png',
				sa: 'yellowsa.png',
				aa: 'yellowaa.png',
				t: 'yellowt.png',
			},
			s: {
				' ': 'black.png',
				f: 'blackf.png',
				h: 'blackh.png',
			},
			i: {
				' ': 'purple.png',
				f: 'purplef.png',
				ff: 'purpleff.png',
				h: 'purpleh.png',
				hh: 'purplehh.png',
				fh: 'purplefh.png',
			},
			c: {
				' ': 'red.gif',
				f: 'redf.png',
				ff: 'redff.png',
				h: 'redh.png',
				hh: 'redhh.png',
				fh: 'redfh.png',
				d: 'redd.png',
			},
		};

		const normalizedDie = dieAliases[String(dieType ?? '').toLowerCase()];
		const normalizedFace = String(faceSymbol || ' ')
			.toLowerCase()
			.replace('as', 'sa')
			.replace('hf', 'fh');
		const fileName = normalizedDie ? faceImages[normalizedDie]?.[normalizedFace] : undefined;

		// Unknown data should degrade to a valid neutral face instead of requesting dead assets like `a.png` or `.png`.
		return `systems/genesys/dice/${fileName ?? 'green.png'}`;
	});

	/** Extract skill info from description HTML (removes "Rolling" prefix and star icon) */
	Handlebars.registerHelper('extractSkillInfo', (description: string) => {
		if (!description) return '';
		
		// Try to extract content from <strong> tags
		const strongMatch = description.match(/<strong>(.*?)<\/strong>/);
		if (strongMatch) {
			// Remove star icon <i class="fas fa-star ..."></i>
			let content = strongMatch[1];
			content = content.replace(/<i class="fas fa-star[^>]*><\/i>/g, '');
			content = content.replace(/<i class="[^"]*fa-star[^"]*"[^>]*><\/i>/g, '');
			return content;
		}
		
		// Fallback: remove "Rolling" prefix if present
		return description.replace(/^Rolling\s*/i, '');
	});
}
