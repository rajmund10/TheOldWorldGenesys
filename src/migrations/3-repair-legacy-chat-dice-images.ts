import { MigrationStatus } from '@/migrations/MigrationHelper';
import { normalizeDiceImageSource } from '@/dice/legacyDiceImages';

/**
 * Older roll cards stored bare or legacy die image paths. Repair them once so loading chat history does not request dead assets.
 */
export async function migrate_RepairLegacyChatDiceImages() {
	for (const message of game.messages) {
		const wrapper = document.createElement('div');
		wrapper.innerHTML = message.content;
		let changed = false;

		for (const image of Array.from(wrapper.querySelectorAll('img'))) {
			const src = image.getAttribute('src');
			if (!src) {
				continue;
			}

			const normalizedSrc = normalizeDiceImageSource(src);
			if (normalizedSrc && src !== normalizedSrc) {
				image.setAttribute('src', normalizedSrc);
				changed = true;
			}
		}

		if (changed) {
			await message.update({ content: wrapper.innerHTML });
		}
	}

	return MigrationStatus.SUCCESS;
}
