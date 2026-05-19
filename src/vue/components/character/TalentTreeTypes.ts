/**
 * Talent tree data structure for warcraft-genesys specialization system
 */

export interface TalentTreeNode {
	name: string;
	img: string;
	id: string; // Original talent item ID
	description: string;
	ranked?: 'yes' | 'no';
	activation?: {
		type: 'passive' | 'active';
		detail: string;
	};
	purchased: boolean;
	realItemId?: string; // ID of created talent item on character (when purchased)
}

export interface TalentTreeData {
	nodes: Record<string, TalentTreeNode>; // key: "row-col" (0-0 to 4-3)
	connections: Record<string, boolean>; // key: "h-row-col" or "v-row-col"
	backgroundImage: string;
	bgPosX: string;
	bgPosY: string;
}

export const EMPTY_TREE_DATA: TalentTreeData = {
	nodes: {},
	connections: {},
	backgroundImage: '',
	bgPosX: '0px',
	bgPosY: '0px',
};

/**
 * Calculate talent cost based on row (0-indexed)
 * Cost formula: (row + 1) * 5 XP
 */
export function calculateTalentCost(row: number): number {
	return (row + 1) * 5;
}

/**
 * Generate connection keys
 */
export function horizontalConnectionKey(row: number, col: number): string {
	return `h-${row}-${col}`;
}

export function verticalConnectionKey(row: number, col: number): string {
	return `v-${row}-${col}`;
}

/**
 * Check if a node is accessible based on connections
 * Simplified version - in real implementation would check connection graph
 */
export function isNodeAccessible(
	row: number,
	col: number,
	connections: Record<string, boolean>,
	purchasedNodes: Set<string>
): boolean {
	// First row is always accessible
	if (row === 0) return true;
	
	// Check vertical connection from above
	const vKey = verticalConnectionKey(row - 1, col);
	if (connections[vKey]) return true;
	
	// Check if any adjacent purchased node connects
	// This is simplified - real implementation would do proper graph traversal
	return false;
}
