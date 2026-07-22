import GenesysItem from '@/item/GenesysItem';
import SkillDataModel from '@/item/data/SkillDataModel';

function localize(key: string, fallback: string) {
	const value = game.i18n.localize(key);
	return value === key ? fallback : value;
}

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);
}

async function enrichDescription(description: string) {
	if (!description.trim()) {
		return '';
	}

	const textEditor = (foundry as any).applications?.ux?.TextEditor ?? TextEditor;
	return textEditor.enrichHTML(description, { async: true });
}

export async function showSkillDescription(skill: GenesysItem<SkillDataModel>) {
	const storedDescription = await enrichDescription(skill.systemData.description ?? '');
	const description = storedDescription || `<p>${localize('Genesys.SkillGuidance.Missing', 'No description is available for this skill.')}</p>`;
	const useWhen = skill.systemData.useWhen?.trim() || '';
	const doNotUseWhen = skill.systemData.doNotUseWhen?.trim() || '';
	const guidanceSections = useWhen || doNotUseWhen
		? `<section>
			<h3><i class="fas fa-circle-check"></i> ${localize('Genesys.SkillGuidance.UseWhen', 'Use when')}</h3>
			<p>${escapeHtml(useWhen || localize('Genesys.SkillGuidance.MissingSection', 'No guidance provided.'))}</p>
		</section>
		<section>
			<h3><i class="fas fa-circle-xmark"></i> ${localize('Genesys.SkillGuidance.DoNotUseWhen', 'Do not use when')}</h3>
			<p>${escapeHtml(doNotUseWhen || localize('Genesys.SkillGuidance.MissingSection', 'No guidance provided.'))}</p>
		</section>`
		: '';

	new Dialog(
		{
			title: `${localize('Genesys.SkillGuidance.Title', 'Skill usage')}: ${skill.name}`,
			content: `<article class="skill-guidance-content">
				<header>
					<img src="${escapeHtml(skill.img)}" alt="">
					<div><h2>${escapeHtml(skill.name)}</h2><span>${localize('Genesys.SkillGuidance.Characteristic', 'Characteristic')}: ${localize(`Genesys.Characteristics.${skill.systemData.characteristic.capitalize()}`, skill.systemData.characteristic)}</span></div>
				</header>
				<section class="skill-guidance-summary">${description}</section>
				${guidanceSections}
			</article>`,
			buttons: {
				close: {
					label: localize('Genesys.SkillGuidance.Close', 'Close'),
					icon: '<i class="fas fa-check"></i>',
				},
			},
		},
		{ classes: ['skill-guidance-dialog'], width: 560 },
	).render(true);
}
