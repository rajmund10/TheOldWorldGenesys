<script lang="ts" setup>
import { inject, computed } from 'vue';
import { TalentPurchasePromptContext } from '@/app/TalentPurchasePrompt';
import { RootContext } from '@/vue/SheetContext';
import Localized from '@/vue/components/Localized.vue';

const context = inject<TalentPurchasePromptContext>(RootContext)!;

function format(key: string, data: Record<string, string | number>): string {
	return game?.i18n?.format(key, data) ?? key;
}

const isRefund = computed(() => context.isRefund);
const talentName = computed(() => context.talentName);
const cost = computed(() => context.cost);
const canRefund = computed(() => context.canRefund);
const errorMessage = computed(() => context.errorMessage);
const purchaseQuestion = computed(() => format('Genesys.TalentPurchasePrompt.PurchaseQuestion', { talentName: talentName.value, cost: cost.value }));
const refundQuestion = computed(() => format('Genesys.TalentPurchasePrompt.RefundQuestion', { talentName: talentName.value, cost: cost.value }));
const purchaseAction = computed(() => format('Genesys.TalentPurchasePrompt.PurchaseAction', { cost: cost.value }));
const refundAction = computed(() => format('Genesys.TalentPurchasePrompt.RefundAction', { cost: cost.value }));

function confirm() {
	context.resolvePromise(true);
}

function cancel() {
	context.resolvePromise(false);
}
</script>

<template>
	<div class="genesys talent-purchase-prompt">
		<div class="prompt-content">
			<div class="talent-icon">
				<i v-if="isRefund" class="fas fa-undo"></i>
				<i v-else class="fas fa-shopping-cart"></i>
			</div>
			
			<div class="prompt-text">
				<template v-if="isRefund">
					<h3><Localized label="Genesys.TalentPurchasePrompt.RefundHeading" /></h3>
					<p v-if="!canRefund" class="error">{{ errorMessage }}</p>
					<p v-else v-html="refundQuestion"></p>
				</template>
				<template v-else>
					<h3><Localized label="Genesys.TalentPurchasePrompt.PurchaseHeading" /></h3>
					<p v-html="purchaseQuestion"></p>
				</template>
			</div>
		</div>

		<footer>
			<button @click="cancel" class="cancel-btn">
				<i class="fas fa-times"></i> <Localized label="Genesys.TalentPurchasePrompt.Cancel" />
			</button>
			<button @click="confirm" class="confirm-btn" :disabled="isRefund && !canRefund" :class="{ 'refund': isRefund, 'purchase': !isRefund }">
				<template v-if="isRefund">
					<i class="fas fa-undo"></i> {{ refundAction }}
				</template>
				<template v-else>
					<i class="fas fa-check"></i> {{ purchaseAction }}
				</template>
			</button>
		</footer>
	</div>
</template>

<style lang="scss">
@use '@scss/mixins/backgrounds.scss';
@use '@scss/vars/colors.scss';
@use '@scss/vars/sheet.scss';

.app-talent-purchase-prompt {
	min-width: 350px;
	min-height: 180px;

	.window-content {
		@include backgrounds.crossboxes();
	}
}

.talent-purchase-prompt {
	display: flex;
	flex-direction: column;
	gap: 1em;
	font-family: 'Roboto Serif', serif;
	padding: 0.5em;

	.prompt-content {
		display: flex;
		gap: 1em;
		align-items: center;

		.talent-icon {
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
				margin: 0;
				font-size: 0.95em;
				color: #333;
				line-height: 1.4;

				strong {
					color: colors.$dark-blue;
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

					&:hover {
						background: colors.$dark-blue;
					}
				}

				&.refund {
					background: #f57c00;

					&:hover:not(:disabled) {
						background: #e65100;
					}

					&:disabled {
						background: #ccc;
						cursor: not-allowed;
					}
				}
			}
		}
	}
}
</style>
