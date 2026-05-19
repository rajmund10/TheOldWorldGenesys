<script lang="ts" setup>
import { computed, inject, ref } from 'vue';
import type { MagicActionPromptContext } from '@/app/MagicActionPrompt';
import { getMagicDifficultyLabelKey, summarizeMagicActionSelection, type MagicActionEffectDefinition } from '@/magic/MagicActionRules';
import { RootContext } from '@/vue/SheetContext';

const context = inject<MagicActionPromptContext>(RootContext)!;
const selection = ref<Record<string, number>>({});
const difficultyDieImage = 'systems/genesys/dice/purple.png';

function t(key: string, fallback: string, formatArgs?: Record<string, string | number>) {
	if (game?.i18n) {
		const localized = formatArgs ? game.i18n.format(key, formatArgs) : game.i18n.localize(key);
		if (localized !== key) {
			return localized;
		}
	}

	return fallback;
}

const effectDefinitions = computed(() => context.effectDefinitions);
const summary = computed(() => summarizeMagicActionSelection(context.actionRules, effectDefinitions.value, selection.value));

function getEffectCount(effectDefinition: MagicActionEffectDefinition) {
	return Math.max(0, Math.floor(selection.value[effectDefinition.id] ?? 0));
}

function getDifficultyLabel(rank: number) {
	return t(getMagicDifficultyLabelKey(rank), rank === 0 ? 'Simple' : 'Formidable');
}

function getDifficultyDice(rank: number, prefix = 'difficulty') {
	return Array.from({ length: Math.max(0, rank) }, (_, index) => ({
		id: `${prefix}-${rank}-${index}`,
		src: difficultyDieImage,
	}));
}

function getEffectTags(effectDefinition: MagicActionEffectDefinition) {
	const tags: string[] = [];

	if (effectDefinition.oldWorldOnly) {
		tags.push(t('Genesys.Magic.OldWorldTag', 'Old World'));
	}

	if (effectDefinition.repeatable) {
		tags.push(t('Genesys.MagicActionPrompt.Repeatable', 'Repeatable'));
	}

	return tags;
}

function conflictsWithSelected(effectDefinition: MagicActionEffectDefinition) {
	return summary.value.selectedEffects.some(
		(selectedEffect) =>
			selectedEffect.id !== effectDefinition.id &&
			((effectDefinition.incompatibleWith ?? []).includes(selectedEffect.id) || (selectedEffect.incompatibleWith ?? []).includes(effectDefinition.id)),
	);
}

function canIncrement(effectDefinition: MagicActionEffectDefinition) {
	const currentCount = getEffectCount(effectDefinition);
	const nextSelection = {
		...selection.value,
		[effectDefinition.id]: currentCount + 1,
	};
	const nextSummary = summarizeMagicActionSelection(context.actionRules, effectDefinitions.value, nextSelection);

	return nextSummary.incompatiblePairs.length === 0 && !nextSummary.exceedsDifficultyCap;
}

function incrementEffect(effectDefinition: MagicActionEffectDefinition) {
	if (!canIncrement(effectDefinition)) {
		return;
	}

	const currentCount = getEffectCount(effectDefinition);
	selection.value = {
		...selection.value,
		[effectDefinition.id]: currentCount + 1,
	};
}

function decrementEffect(effectDefinition: MagicActionEffectDefinition) {
	const currentCount = getEffectCount(effectDefinition);
	if (currentCount === 0) {
		return;
	}

	selection.value = {
		...selection.value,
		[effectDefinition.id]: currentCount - 1,
	};
}

function toggleEffect(effectDefinition: MagicActionEffectDefinition) {
	if (getEffectCount(effectDefinition) > 0) {
		decrementEffect(effectDefinition);
		return;
	}

	incrementEffect(effectDefinition);
}

function isSelectionBlocked(effectDefinition: MagicActionEffectDefinition) {
	return getEffectCount(effectDefinition) === 0 && conflictsWithSelected(effectDefinition);
}

async function confirmSelection() {
	await context.confirmSelection(selection.value);
}

async function cancel() {
	await context.closePrompt();
}
</script>

<template>
	<div class="genesys magic-action-prompt">
		<header class="prompt-header">
			<div>
				<h2>{{ context.action.label }}</h2>
				<p>{{ context.action.summary }}</p>
			</div>

			<div class="header-meta">
				<span class="meta-pill">{{ t('Genesys.MagicActionPrompt.UsesSkill', `Uses ${context.skillName}`, { skill: context.skillName }) }}</span>
				<span v-if="context.profile.pathLabel" class="meta-pill">{{ context.profile.pathLabel }}</span>
			</div>
		</header>

		<section class="difficulty-summary">
			<div class="summary-card">
				<span class="label">{{ t('Genesys.MagicActionPrompt.BaseDifficulty', 'Base Difficulty') }}</span>
				<strong>{{ getDifficultyLabel(summary.baseDifficulty) }}</strong>
				<div class="difficulty-dice" :aria-label="getDifficultyLabel(summary.baseDifficulty)">
					<img v-for="die in getDifficultyDice(summary.baseDifficulty, 'base')" :key="die.id" :src="die.src" alt="Difficulty die" class="difficulty-die" />
					<span v-if="summary.baseDifficulty === 0" class="no-dice">-</span>
				</div>
			</div>

			<div class="summary-card compact-number">
				<span class="label">{{ t('Genesys.MagicActionPrompt.AddedDifficulty', 'Added Difficulty') }}</span>
				<strong>+{{ summary.addedDifficulty }}</strong>
			</div>

			<div class="summary-card emphasis">
				<span class="label">{{ t('Genesys.MagicActionPrompt.TotalDifficulty', 'Total Difficulty') }}</span>
				<strong>{{ getDifficultyLabel(summary.totalDifficulty) }}</strong>
				<div class="difficulty-dice" :aria-label="getDifficultyLabel(summary.totalDifficulty)">
					<img v-for="die in getDifficultyDice(summary.totalDifficulty, 'total')" :key="die.id" :src="die.src" alt="Difficulty die" class="difficulty-die" />
					<span v-if="summary.totalDifficulty === 0" class="no-dice">-</span>
				</div>
			</div>
		</section>

		<section class="selection-summary">
			<div class="section-header">
				<h3>{{ t('Genesys.MagicActionPrompt.SelectedEffects', 'Selected Effects') }}</h3>
				<span>{{ summary.selectedEffects.length }}</span>
			</div>

			<div class="selection-summary-content">
				<p v-if="summary.selectedEffects.length === 0" class="empty-state">
					{{ t('Genesys.MagicActionPrompt.NoSelectedEffects', 'No additional effects selected yet.') }}
				</p>

				<div v-else class="selected-effect-list">
					<span v-for="selectedEffect in summary.selectedEffects" :key="selectedEffect.id" class="selected-effect-pill">
						{{ selectedEffect.selectionLabel }}
					</span>
				</div>
			</div>

			<p v-if="summary.incompatiblePairs.length" class="warning-message">
				{{
					t(
						'Genesys.MagicActionPrompt.IncompatibleSelection',
						`${summary.incompatiblePairs[0].left.label} cannot be combined with ${summary.incompatiblePairs[0].right.label}.`,
						{
							left: summary.incompatiblePairs[0].left.label,
							right: summary.incompatiblePairs[0].right.label,
						},
					)
				}}
			</p>

			<p v-else-if="context.actionRules.promptHint" class="prompt-hint">{{ context.actionRules.promptHint }}</p>
		</section>

		<section class="effects-panel">
			<div class="section-header">
				<h3>{{ t('Genesys.MagicActionPrompt.AdditionalEffects', 'Additional Effects') }}</h3>
				<span>{{ effectDefinitions.length }}</span>
			</div>

			<p v-if="effectDefinitions.length === 0" class="empty-state">
				{{ t('Genesys.MagicActionPrompt.NoAdditionalEffects', 'This action has no structured additional effects in the builder yet.') }}
			</p>

			<div v-else class="effect-grid">
				<article v-for="effectDefinition in effectDefinitions" :key="effectDefinition.id" :class="['effect-card', { selected: getEffectCount(effectDefinition) > 0, blocked: isSelectionBlocked(effectDefinition) }]">
					<div class="effect-header">
						<div class="effect-heading">
							<h4>{{ effectDefinition.label }}</h4>
							<div class="effect-tags">
								<span v-for="tag in getEffectTags(effectDefinition)" :key="tag" class="effect-tag">{{ tag }}</span>
							</div>
						</div>

						<div class="effect-cost" :aria-label="`+${effectDefinition.difficulty} difficulty`">
							<span class="effect-cost-prefix">+</span>
							<template v-if="effectDefinition.difficulty > 0">
								<img v-for="die in getDifficultyDice(effectDefinition.difficulty, effectDefinition.id)" :key="die.id" :src="die.src" alt="Difficulty die" class="effect-cost-die" />
							</template>
							<span v-else class="effect-cost-zero">0</span>
						</div>
					</div>

					<p>{{ effectDefinition.description }}</p>

					<div class="effect-controls">
						<template v-if="effectDefinition.repeatable">
							<button type="button" :class="['count-button', 'decrement', { active: getEffectCount(effectDefinition) > 0 }]" :disabled="getEffectCount(effectDefinition) === 0" @click="decrementEffect(effectDefinition)">-</button>
							<span :class="['count-display', { active: getEffectCount(effectDefinition) > 0 }]">{{ getEffectCount(effectDefinition) }}</span>
							<button type="button" class="count-button increment" :disabled="!canIncrement(effectDefinition)" @click="incrementEffect(effectDefinition)">+</button>
						</template>

						<button v-else type="button" :class="['toggle-button', { 'is-selected': getEffectCount(effectDefinition) > 0 }]" :disabled="isSelectionBlocked(effectDefinition)" @click="toggleEffect(effectDefinition)">
							{{ getEffectCount(effectDefinition) > 0 ? t('Genesys.MagicActionPrompt.RemoveEffect', 'Remove') : t('Genesys.MagicActionPrompt.AddEffect', 'Add Effect') }}
						</button>
					</div>
				</article>
			</div>
		</section>

		<footer class="prompt-footer">
			<button type="button" class="secondary-button" @click="cancel">
				{{ t('Genesys.MagicActionPrompt.Cancel', 'Cancel') }}
			</button>
			<button type="button" class="primary-button" :disabled="summary.incompatiblePairs.length > 0 || summary.exceedsDifficultyCap" @click="confirmSelection">
				{{ t('Genesys.MagicActionPrompt.OpenDicePrompt', 'Continue To Dice Pool') }}
			</button>
		</footer>
	</div>
</template>

<style lang="scss">
@use '@scss/mixins/backgrounds.scss';

.app-magic-action-prompt {
	min-width: 0;

	.window-content {
		@include backgrounds.crossboxes();
		overflow-y: hidden;
	}
}
</style>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

.magic-action-prompt {
	display: flex;
	flex-direction: column;
	gap: 0.55rem;
	padding: 0.1rem;
	color: colors.$dark-blue;
}

.prompt-header,
.difficulty-summary,
.selection-summary,
.effects-panel {
	padding: 0.58rem 0.72rem;
	border-radius: 0.8rem;
	border: 1px solid rgba(39, 67, 90, 0.12);
	background: rgba(255, 255, 255, 0.62);
}

.prompt-header {
	display: flex;
	justify-content: space-between;
	gap: 0.65rem;

	h2 {
		margin: 0 0 0.1rem;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.35rem;
		letter-spacing: 0.05em;
	}

	p {
		margin: 0;
		font-family: 'Roboto Slab', serif;
		font-size: 0.86rem;
		line-height: 1.28;
		color: #40586f;
	}
}

.header-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0.26rem;
	align-content: flex-start;
	justify-content: flex-end;
}

.meta-pill,
.selected-effect-pill,
.effect-tag {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0.12rem 0.42rem;
	border-radius: 999px;
	background: rgba(39, 67, 90, 0.1);
	font-family: 'Bebas Neue', sans-serif;
	font-size: 0.7rem;
	letter-spacing: 0.05em;
}

.difficulty-summary {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 0.38rem;
}

.summary-card {
	display: flex;
	flex-direction: column;
	gap: 0.1rem;
	padding: 0.42rem 0.52rem;
	border-radius: 0.68rem;
	background: rgba(239, 244, 248, 0.9);

	.label {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.76rem;
		letter-spacing: 0.05em;
		color: #6d6e71;
	}

	strong {
		font-family: 'Roboto Slab', serif;
		font-size: 0.88rem;
	}
}

.summary-card.emphasis {
	background: rgba(39, 67, 90, 0.08);
	border: 1px solid rgba(39, 67, 90, 0.18);
}

.summary-card.compact-number {
	justify-content: center;
}

.difficulty-dice {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.15rem;
	min-height: 1.2rem;
	margin-top: 0.08rem;
}

.difficulty-die,
.effect-cost-die {
	display: block;
	object-fit: contain;
	border: none !important;
	box-shadow: none !important;
	background: transparent !important;
	outline: none;
}

.difficulty-die {
	width: 1rem;
	height: 1rem;
}

.no-dice {
	font-family: 'Roboto Slab', serif;
	font-size: 0.82rem;
	color: #5f7182;
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.45rem;
	margin-bottom: 0.38rem;

	h3 {
		margin: 0;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.98rem;
		letter-spacing: 0.05em;
	}

	span {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.84rem;
		color: #5f7182;
	}
}

.selection-summary-content {
	display: flex;
	align-items: center;
	min-height: 1.4rem;
}

.selected-effect-list {
	display: flex;
	flex-wrap: wrap;
	gap: 0.26rem;
}

.prompt-hint,
.empty-state,
.warning-message,
.effect-card p {
	margin: 0;
	font-family: 'Roboto Slab', serif;
	font-size: 0.82rem;
	line-height: 1.26;
	color: #40586f;
}

.warning-message {
	color: #8c4d3a;
}

.effect-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.42rem;
}

.effect-card {
	display: flex;
	flex-direction: column;
	gap: 0.36rem;
	padding: 0.5rem 0.55rem;
	border-radius: 0.72rem;
	border: 1px solid rgba(39, 67, 90, 0.12);
	background: rgba(240, 245, 249, 0.9);
	transition:
		border-color 0.15s ease,
		background-color 0.15s ease,
		box-shadow 0.15s ease;

	&.selected {
		border-color: rgba(39, 67, 90, 0.46);
		background: rgba(224, 234, 242, 0.98);
		box-shadow: inset 0 0 0 1px rgba(39, 67, 90, 0.16);
	}

	&.blocked {
		opacity: 0.6;
	}
}

.effect-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 0.42rem;
}

.effect-heading {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;

	h4 {
		margin: 0;
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.92rem;
		letter-spacing: 0.05em;
	}
}

.effect-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.2rem;
}

.effect-tag {
	background: rgba(109, 110, 113, 0.12);
	color: #5f7182;
}

.effect-cost {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.14rem;
	min-width: 2rem;
	padding: 0.14rem 0.35rem;
	border-radius: 999px;
	background: rgba(39, 67, 90, 0.1);
	color: colors.$dark-blue;
	font-family: 'Bebas Neue', sans-serif;
	font-size: 0.78rem;
	letter-spacing: 0.05em;
	white-space: nowrap;
}

.effect-cost-prefix {
	line-height: 1;
}

.effect-cost-die {
	width: 0.86rem;
	height: 0.86rem;
}

.effect-cost-zero {
	font-family: 'Roboto Slab', serif;
	font-size: 0.76rem;
}

.effect-controls {
	display: flex;
	align-items: center;
	gap: 0.3rem;
	margin-top: auto;
}

.toggle-button,
.count-button,
.secondary-button,
.primary-button {
	border-radius: 999px;
	font-family: 'Bebas Neue', sans-serif;
	letter-spacing: 0.05em;
}

.toggle-button,
.secondary-button {
	padding: 0.2rem 0.62rem;
	border: 1px solid rgba(39, 67, 90, 0.18);
	background: rgba(39, 67, 90, 0.08);
	color: colors.$dark-blue;
}

.toggle-button.is-selected {
	border-color: rgba(140, 77, 58, 0.58);
	background: rgba(140, 77, 58, 0.14);
	color: #7a3f30;
	font-weight: 700;
}

.count-button {
	width: 1.58rem;
	height: 1.58rem;
	border: 1px solid rgba(39, 67, 90, 0.18);
	background: rgba(39, 67, 90, 0.08);
	color: colors.$dark-blue;
	font-size: 0.88rem;
}

.count-button.decrement.active {
	border-color: rgba(140, 77, 58, 0.46);
	background: rgba(140, 77, 58, 0.14);
	color: #7a3f30;
}

.count-display {
	min-width: 1.15rem;
	text-align: center;
	font-family: 'Bebas Neue', sans-serif;
	font-size: 0.88rem;
	color: #5f7182;
}

.count-display.active {
	color: colors.$dark-blue;
	font-size: 0.98rem;
}

.prompt-footer {
	display: flex;
	justify-content: flex-end;
	gap: 0.35rem;
}

.primary-button {
	padding: 0.26rem 0.74rem;
	border: 1px solid colors.$dark-blue;
	background: colors.$dark-blue;
	color: white;

	&:disabled {
		opacity: 0.5;
	}
}

@container sheet (max-width: 760px) {
	.difficulty-summary,
	.effect-grid {
		grid-template-columns: 1fr;
	}

	.prompt-header {
		flex-direction: column;
	}
}
</style>
