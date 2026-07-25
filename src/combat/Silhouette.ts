import GenesysActor from '@/actor/GenesysActor';

export type SilhouetteDifficultyAdjustment = -1 | 0 | 1;

export function getActorSilhouette(actor?: GenesysActor | null) {
	const silhouette = Number((actor?.system as { silhouette?: number } | undefined)?.silhouette ?? 1);
	return Number.isFinite(silhouette) ? Math.max(0, silhouette) : 1;
}

/**
 * Positive values add Difficulty dice. Negative values remove them.
 */
export function getSilhouetteDifficultyAdjustment(
	attackerSilhouette: number,
	targetSilhouette: number,
): SilhouetteDifficultyAdjustment {
	const difference = targetSilhouette - attackerSilhouette;
	if (difference >= 2) {
		return -1;
	}
	if (difference <= -2) {
		return 1;
	}
	return 0;
}

export function getSilhouetteDifficultyModification(attacker?: GenesysActor | null, target?: GenesysActor | null) {
	const attackerSilhouette = getActorSilhouette(attacker);
	const targetSilhouette = getActorSilhouette(target);
	const adjustment = getSilhouetteDifficultyAdjustment(attackerSilhouette, targetSilhouette);

	return {
		attackerSilhouette,
		targetSilhouette,
		adjustment,
		modifications: adjustment < 0 ? ['-D'] : adjustment > 0 ? ['D'] : [],
	};
}
