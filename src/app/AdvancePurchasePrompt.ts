/**
 * FVTT-Genesys
 * Generic prompt for purchasing or refunding actor advances.
 */

import VueAdvancePurchasePrompt from '@/vue/apps/AdvancePurchasePrompt.vue';
import { ContextBase } from '@/vue/SheetContext';
import VueSheet from '@/vue/VueSheet';

type PromptMode = 'purchase' | 'refund';

export interface AdvancePurchasePromptContext extends ContextBase {
	resolvePromise: (value: boolean) => void;
	mode: PromptMode;
	advanceTypeLabel: string;
	advanceName: string;
	cost: number;
	availableXP: number;
	source: string;
	canConfirm: boolean;
	errorMessage: string;
	warning: string;
}

export type AdvancePurchasePromptData = {
	mode?: PromptMode;
	advanceTypeLabel: string;
	advanceName: string;
	cost: number;
	availableXP?: number;
	source?: string;
	canConfirm?: boolean;
	errorMessage?: string;
	warning?: string;
	title?: string;
};

function localize(key: string) {
	return game?.i18n?.localize(key) ?? key;
}

export default class AdvancePurchasePrompt extends VueSheet(Application) {
	override get vueComponent() {
		return VueAdvancePurchasePrompt;
	}

	static override get defaultOptions() {
		return {
			...super.defaultOptions,
			classes: ['app-advance-purchase-prompt'],
			width: 420,
			title: localize('Genesys.AdvancePurchasePrompt.PurchaseTitle'),
		};
	}

	static async promptForPurchase(data: Omit<AdvancePurchasePromptData, 'mode'>): Promise<boolean> {
		const sheet = new AdvancePurchasePrompt({
			...data,
			mode: 'purchase',
			title: data.title ?? localize('Genesys.AdvancePurchasePrompt.PurchaseTitle'),
		});
		await sheet.render(true);

		return new Promise((resolve) => {
			sheet.#resolvePromise = resolve;
		});
	}

	static async promptForRefund(data: Omit<AdvancePurchasePromptData, 'mode'>): Promise<boolean> {
		const sheet = new AdvancePurchasePrompt({
			...data,
			mode: 'refund',
			title: data.title ?? localize('Genesys.AdvancePurchasePrompt.RefundTitle'),
		});
		await sheet.render(true);

		return new Promise((resolve) => {
			sheet.#resolvePromise = resolve;
		});
	}

	#resolvePromise?: (value: boolean) => void;
	readonly #data: Required<Omit<AdvancePurchasePromptData, 'title'>>;

	constructor(data: AdvancePurchasePromptData) {
		super();

		this.#data = {
			mode: data.mode ?? 'purchase',
			advanceTypeLabel: data.advanceTypeLabel,
			advanceName: data.advanceName,
			cost: data.cost,
			availableXP: data.availableXP ?? 0,
			source: data.source ?? '',
			canConfirm: data.canConfirm ?? true,
			errorMessage: data.errorMessage ?? '',
			warning: data.warning ?? '',
		};

		if (data.title) {
			this.options.title = data.title;
		}
	}

	override async getVueContext(): Promise<AdvancePurchasePromptContext> {
		return {
			...this.#data,
			resolvePromise: async (confirmed) => {
				this.#resolvePromise?.(confirmed);
				this.#resolvePromise = undefined;
				await this.close();
			},
		};
	}

	override async close(options = {}) {
		this.#resolvePromise?.(false);
		await super.close(options);
	}
}
