<script lang="ts" setup>
import { computed, inject } from 'vue';
import { AdvancePurchasePromptContext } from '@/app/AdvancePurchasePrompt';
import { RootContext } from '@/vue/SheetContext';
import Localized from '@/vue/components/Localized.vue';

const context = inject<AdvancePurchasePromptContext>(RootContext)!;

function format(key: string, data: Record<string, string | number>): string {
	return game?.i18n?.format(key, data) ?? key;
}

const isRefund = computed(() => context.mode === 'refund');
const canConfirm = computed(() => context.canConfirm);
const question = computed(() => {
	const key = isRefund.value ? 'Genesys.AdvancePurchasePrompt.RefundQuestion' : 'Genesys.AdvancePurchasePrompt.PurchaseQuestion';
	return format(key, {
		type: context.advanceTypeLabel,
		name: context.advanceName,
		cost: context.cost,
	});
});
const action = computed(() => {
	const key = isRefund.value ? 'Genesys.AdvancePurchasePrompt.RefundAction' : 'Genesys.AdvancePurchasePrompt.PurchaseAction';
	return format(key, { cost: context.cost });
});

function confirm() {
	context.resolvePromise(true);
}

function cancel() {
	context.resolvePromise(false);
}
</script>

<template>
	<div class="genesys advance-purchase-prompt">
		<div class="prompt-content">
			<div class="advance-icon">
				<i v-if="isRefund" class="fas fa-undo"></i>
				<i v-else class="fas fa-shopping-cart"></i>
			</div>

			<div class="prompt-text">
				<h3>
					<Localized :label="isRefund ? 'Genesys.AdvancePurchasePrompt.RefundHeading' : 'Genesys.AdvancePurchasePrompt.PurchaseHeading'" />
				</h3>
				<p v-if="context.errorMessage" class="error">{{ context.errorMessage }}</p>
				<p v-else v-html="question"></p>
				<p v-if="context.source" class="source">
					<Localized label="Genesys.AdvancePurchasePrompt.Source" />: <strong>{{ context.source }}</strong>
				</p>
				<p class="available">
					<Localized label="Genesys.AdvancePurchasePrompt.AvailableXP" />: <strong>{{ context.availableXP }}</strong>
				</p>
				<p v-if="context.warning" class="warning">{{ context.warning }}</p>
			</div>
		</div>

		<footer>
			<button @click="cancel" class="cancel-btn">
				<i class="fas fa-times"></i> <Localized label="Genesys.AdvancePurchasePrompt.Cancel" />
			</button>
			<button @click="confirm" class="confirm-btn" :disabled="!canConfirm" :class="{ refund: isRefund, purchase: !isRefund }">
				<template v-if="isRefund">
					<i class="fas fa-undo"></i> {{ action }}
				</template>
				<template v-else>
					<i class="fas fa-check"></i> {{ action }}
				</template>
			</button>
		</footer>
	</div>
</template>

<style lang="scss">
@use '@scss/mixins/backgrounds.scss';
@use '@scss/vars/colors.scss';

.app-advance-purchase-prompt {
	min-width: 360px;
	min-height: 190px;

	.window-content {
		@include backgrounds.crossboxes();
	}
}

.advance-purchase-prompt {
	display: flex;
	flex-direction: column;
	gap: 1em;
	font-family: 'Roboto Serif', serif;
	padding: 0.5em;

	.prompt-content {
		display: flex;
		gap: 1em;
		align-items: center;
	}

	.advance-icon {
		font-size: 2.5em;
		color: colors.$gold;
		opacity: 0.8;
	}

	.prompt-text {
		flex: 1;

		h3 {
			margin: 0 0 0.5em 0;
			font-family: 'Bebas Neue', sans-serif;
			font-size: 1.3em;
			color: colors.$dark-blue;
		}

		p {
			margin: 0.25em 0 0;
			font-size: 0.95em;
			color: #333;
			line-height: 1.4;

			strong {
				color: colors.$dark-blue;
			}

			&.source,
			&.available {
				font-size: 0.86em;
				color: #5f7182;
			}

			&.warning {
				color: #9a6a00;
				background: rgba(245, 124, 0, 0.11);
				padding: 0.5em;
				border-radius: 4px;
				border-left: 3px solid #f57c00;
			}

			&.error {
				color: #d32f2f;
				background: rgba(211, 47, 47, 0.1);
				padding: 0.5em;
				border-radius: 4px;
				border-left: 3px solid #d32f2f;
			}
		}
	}

	footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5em;
		margin-top: 0.5em;
		padding-top: 0.5em;
		border-top: 1px solid #ddd;

		button {
			padding: 0.4em 1em;
			font-family: 'Roboto Serif', serif;
			border-radius: 3px;
			cursor: pointer;
			transition: all 0.2s;

			&.cancel-btn {
				background: transparent;
				border: 1px solid #999;
				color: #666;

				&:hover {
					background: #f5f5f5;
				}
			}

			&.confirm-btn {
				border: none;
				color: white;

				&.purchase {
					background: colors.$blue;

					&:hover:not(:disabled) {
						background: colors.$dark-blue;
					}
				}

				&.refund {
					background: #f57c00;

					&:hover:not(:disabled) {
						background: #e65100;
					}
				}

				&:disabled {
					background: #ccc;
					cursor: not-allowed;
				}
			}
		}
	}
}
</style>
