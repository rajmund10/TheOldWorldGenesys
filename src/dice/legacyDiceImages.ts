const DICE_IMAGE_FILES = new Set([
	'advantage.png',
	'black.png',
	'blackf.png',
	'blackh.png',
	'blue.png',
	'bluea.png',
	'blueaa.png',
	'blues.png',
	'bluesa.png',
	'despair.png',
	'failure.png',
	'green.png',
	'greena.png',
	'greenaa.png',
	'greens.png',
	'greensa.png',
	'greenss.png',
	'purple.png',
	'purplef.png',
	'purpleff.png',
	'purplefh.png',
	'purpleh.png',
	'purplehh.png',
	'red.gif',
	'redd.png',
	'redf.png',
	'redff.png',
	'redfh.png',
	'redh.png',
	'redhh.png',
	'success.png',
	'threat.png',
	'triumph.png',
	'yellow.png',
	'yellowa.png',
	'yellowaa.png',
	'yellows.png',
	'yellowsa.png',
	'yellowss.png',
	'yellowt.png',
]);

const LEGACY_DICE_IMAGE_ALIASES: Record<string, string> = {
	a: 'green.png',
	'a.png': 'green.png',
	c: 'red.gif',
	'c.png': 'red.gif',
	i: 'purple.png',
	'i.png': 'purple.png',
	p: 'yellow.png',
	'p.png': 'yellow.png',
	'purplehf.png': 'purplefh.png',
	'redhf.png': 'redfh.png',
};

function getBaseName(src: string) {
	const withoutQuery = src.split(/[?#]/, 1)[0];
	return withoutQuery.split(/[\\/]/).pop()?.toLowerCase() ?? '';
}

export function normalizeDiceImageSource(src: string) {
	const baseName = getBaseName(src);
	const fileName = LEGACY_DICE_IMAGE_ALIASES[baseName] ?? (DICE_IMAGE_FILES.has(baseName) ? baseName : null);

	return fileName ? `systems/${game.system.id}/dice/${fileName}` : null;
}

export function registerLegacyDiceImageCompatibility() {
	Hooks.on('renderChatMessage', (_message: ChatMessage, html: JQuery<HTMLElement>) => {
		html.find('img').each((_index, image) => {
			const src = image.getAttribute('src');
			if (!src) {
				return;
			}

			const normalizedSrc = normalizeDiceImageSource(src);
			if (normalizedSrc && src !== normalizedSrc) {
				image.setAttribute('src', normalizedSrc);
			}
		});
	});
}
