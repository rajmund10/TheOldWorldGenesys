<script lang="ts" setup>
import { computed, ref, watch, nextTick } from 'vue';
import type { TalentTreeData, TalentTreeNode } from './TalentTreeTypes';

interface Props {
	treeData: TalentTreeData;
	mode: 'edit' | 'view' | 'gm';
	isLocked?: boolean;
	availableXP?: number;
	specializationName?: string;
	showHeader?: boolean;
}

function localize(key: string): string {
	return game?.i18n?.localize(key) ?? key;
}

const props = withDefaults(defineProps<Props>(), {
	isLocked: false,
	availableXP: 0,
	specializationName: '',
	showHeader: true,
});

const emit = defineEmits<{
	'update:treeData': [data: TalentTreeData];
	nodeClick: [key: string, node: TalentTreeNode | null, cost: number];
	connectionClick: [key: string];
	backgroundChange: [image: string];
	backgroundPositionChange: [x: string, y: string];
	talentDrop: [key: string, event: DragEvent];
	nodeContextMenu: [key: string, node: TalentTreeNode | null];
}>();

const availableXpLabel = localize('Genesys.TalentTree.AvailableXP');
const backgroundLabel = localize('Genesys.TalentTree.Background');
const backgroundPlaceholder = localize('Genesys.TalentTree.BackgroundPlaceholder');
const pickImageLabel = localize('Genesys.TalentTree.PickImage');
const lockBackgroundLabel = localize('Genesys.TalentTree.LockBackground');
const unlockBackgroundLabel = localize('Genesys.TalentTree.UnlockBackground');
const backgroundLockedHint = localize('Genesys.TalentTree.BackgroundLockedHint');
const backgroundDragHint = localize('Genesys.TalentTree.BackgroundDragHint');

const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const backgroundPosition = ref({ x: 0, y: 0 });
const bgLocked = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const savedScroll = ref({ top: 0, left: 0 });

function parsePosition(pos: string): number {
	if (!pos) return 0;
	const match = pos.match(/(-?\d+)px/);
	return match ? parseInt(match[1]) : 0;
}

function formatPosition(pos: number): string {
	return `${pos}px`;
}

backgroundPosition.value = {
	x: parsePosition(props.treeData.bgPosX),
	y: parsePosition(props.treeData.bgPosY),
};

watch(
	() => props.treeData,
	(newData) => {
		backgroundPosition.value = {
			x: parsePosition(newData.bgPosX),
			y: parsePosition(newData.bgPosY),
		};
	},
	{ deep: true },
);

const isEditMode = computed(() => props.mode === 'edit');
const isViewMode = computed(() => props.mode === 'view');
const isGmMode = computed(() => props.mode === 'gm');
const canEditStructure = computed(() => isEditMode.value || (isGmMode.value && !props.isLocked));
const displayedSpecializationName = computed(() => props.specializationName?.trim() || '');
const currentAvailableXP = computed(() => Number(props.availableXP ?? 0));

const ROWS = 5;
const COLS = 4;
const GRID_COLS = 7;
const GRID_ROWS = 9;

function calculateCost(row: number): number {
	return (row + 1) * 5;
}

function getNode(row: number, col: number): TalentTreeNode | null {
	return props.treeData.nodes[`${row}-${col}`] || null;
}

function isNodeAccessible(row: number, col: number): boolean {
	if (row === 0) return true;

	const vKey = `v-${row - 1}-${col}`;
	if (props.treeData.connections[vKey]) {
		const nodeAbove = getNode(row - 1, col);
		if (nodeAbove?.purchased) return true;
	}

	const hKeyLeft = `h-${row}-${col - 1}`;
	if (props.treeData.connections[hKeyLeft]) {
		const nodeLeft = getNode(row, col - 1);
		if (nodeLeft?.purchased) return true;
	}

	const hKeyRight = `h-${row}-${col}`;
	if (props.treeData.connections[hKeyRight]) {
		const nodeRight = getNode(row, col + 1);
		if (nodeRight?.purchased) return true;
	}

	return false;
}

function getNodeStateClass(row: number, col: number): string {
	const node = getNode(row, col);
	if (!node) return 'empty';

	if (node.purchased) return 'purchased';
	if (isViewMode.value && !isNodeAccessible(row, col)) return 'dimmed';
	return 'available';
}

function saveScrollPosition() {
	if (!wrapperRef.value) return;

	savedScroll.value = {
		top: wrapperRef.value.scrollTop,
		left: wrapperRef.value.scrollLeft,
	};
}

function restoreScrollPosition() {
	if (!wrapperRef.value) return;

	wrapperRef.value.scrollTop = savedScroll.value.top;
	wrapperRef.value.scrollLeft = savedScroll.value.left;
}

function handleNodeClick(row: number, col: number) {
	const key = `${row}-${col}`;
	const node = getNode(row, col);
	const cost = calculateCost(row);

	if (isEditMode.value) {
		return;
	}

	saveScrollPosition();
	emit('nodeClick', key, node, cost);

	nextTick(() => {
		restoreScrollPosition();
	});
}

function handleNodeContextMenu(row: number, col: number) {
	const key = `${row}-${col}`;
	const node = getNode(row, col);

	if (isEditMode.value) {
		emit('nodeContextMenu', key, node);
		return;
	}

	if (node) {
		emit('nodeContextMenu', key, node);
	}
}

function handleConnectionClick(type: 'h' | 'v', row: number, col: number) {
	if (!canEditStructure.value) return;

	const key = `${type}-${row}-${col}`;

	if (isEditMode.value) {
		const updatedConnections = { ...props.treeData.connections };
		if (updatedConnections[key]) {
			delete updatedConnections[key];
		} else {
			updatedConnections[key] = true;
		}
		emit('update:treeData', { ...props.treeData, connections: updatedConnections });
	} else {
		emit('connectionClick', key);
	}
}

function startDrag(event: MouseEvent) {
	if (!canEditStructure.value || !props.treeData.backgroundImage || bgLocked.value) return;

	isDragging.value = true;
	dragStart.value = { x: event.clientX, y: event.clientY };
}

function doDrag(event: MouseEvent) {
	if (!isDragging.value) return;

	const dx = event.clientX - dragStart.value.x;
	const dy = event.clientY - dragStart.value.y;

	const newX = backgroundPosition.value.x + dx;
	const newY = backgroundPosition.value.y + dy;

	const limitedX = Math.min(0, Math.max(-500, newX));
	const limitedY = Math.min(0, Math.max(-500, newY));

	backgroundPosition.value = { x: limitedX, y: limitedY };
	dragStart.value = { x: event.clientX, y: event.clientY };

	emit('backgroundPositionChange', formatPosition(limitedX), formatPosition(limitedY));
}

function endDrag() {
	if (!isDragging.value) return;
	isDragging.value = false;
}

function handleBackgroundImageChange(event: Event) {
	const input = event.target as HTMLInputElement;
	if (input.value) {
		emit('backgroundChange', input.value);
	}
}

async function openFilePicker() {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/*';
	input.onchange = (e) => {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) {
			const url = URL.createObjectURL(file);
			emit('backgroundChange', url);
		}
	};
	input.click();
}

function handleDragOver(event: DragEvent) {
	event.preventDefault();
	if (isEditMode.value) {
		(event.currentTarget as HTMLElement).classList.add('drag-over');
	}
}

function handleDragEnter(event: DragEvent) {
	event.preventDefault();
	if (isEditMode.value) {
		(event.currentTarget as HTMLElement).classList.add('drag-over');
	}
}

function handleDragLeave(event: DragEvent) {
	(event.currentTarget as HTMLElement).classList.remove('drag-over');
}

function handleDrop(row: number, col: number, event: DragEvent) {
	event.preventDefault();
	(event.currentTarget as HTMLElement).classList.remove('drag-over');

	if (!isEditMode.value) return;

	const key = `${row}-${col}`;
	emit('talentDrop', key, event);
}

function getTalentMetaLabel(node: TalentTreeNode): string {
	const labels: string[] = [];
	if (node.ranked === 'yes') {
		labels.push(localize('Genesys.TalentTree.Ranked'));
	}

	labels.push(node.activation?.type === 'active' ? localize('Genesys.Labels.Active') : localize('Genesys.Labels.Passive'));
	return labels.join(' / ');
}
</script>

<template>
	<div class="talent-tree-container" :class="{ 'edit-mode': isEditMode, 'view-mode': isViewMode }">
		<div v-if="props.showHeader && (isViewMode || isGmMode)" class="tree-header">
			<div class="spec-name-display" :class="{ 'is-empty': !displayedSpecializationName }">
				{{ displayedSpecializationName }}
			</div>
			<div class="xp-display">
				{{ availableXpLabel }} <span class="xp-val" :style="{ color: currentAvailableXP >= 0 ? '#2e7d32' : '#d32f2f' }">{{ currentAvailableXP }}</span>
			</div>
		</div>

		<div v-if="isEditMode" class="background-controls">
			<div class="bg-input-group">
				<label>{{ backgroundLabel }}:</label>
				<input type="text" :value="treeData.backgroundImage" @input="handleBackgroundImageChange" :placeholder="backgroundPlaceholder" />
				<button class="file-picker-btn" @click="openFilePicker" :title="pickImageLabel">
					<i class="fas fa-image"></i>
				</button>
				<button class="lock-btn" :class="{ locked: bgLocked }" @click="bgLocked = !bgLocked" :title="bgLocked ? unlockBackgroundLabel : lockBackgroundLabel">
					<i :class="bgLocked ? 'fas fa-lock' : 'fas fa-unlock'"></i>
				</button>
			</div>
			<div class="bg-hint" v-if="treeData.backgroundImage">
				<i class="fas fa-info-circle"></i>
				<span v-if="bgLocked">{{ backgroundLockedHint }}</span>
				<span v-else>{{ backgroundDragHint }}</span>
			</div>
		</div>

		<div ref="wrapperRef" class="tree-container-wrapper">
			<div
				class="tree-grid"
				:class="{ 'editable-bg': canEditStructure && treeData.backgroundImage && !bgLocked }"
				:style="{
					backgroundImage: treeData.backgroundImage ? `url('${treeData.backgroundImage}')` : 'none',
					backgroundPosition: `${backgroundPosition.x}px ${backgroundPosition.y}px`,
					backgroundSize: 'cover',
					cursor: isDragging ? 'grabbing' : canEditStructure && treeData.backgroundImage && !bgLocked ? 'grab' : 'default',
				}"
				@mousedown="startDrag"
				@mousemove="doDrag"
				@mouseup="endDrag"
				@mouseleave="endDrag"
			>
				<template v-for="gridRow in GRID_ROWS" :key="gridRow">
					<template v-for="gridCol in GRID_COLS" :key="gridCol">
						<template v-if="gridRow % 2 === 1 && gridCol % 2 === 1">
							<div
								class="tree-node"
								:class="getNodeStateClass(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2))"
								:data-key="`${Math.floor((gridRow - 1) / 2)}-${Math.floor((gridCol - 1) / 2)}`"
								@click.prevent="handleNodeClick(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2))"
								@contextmenu.prevent="handleNodeContextMenu(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2))"
								@dragover.prevent="handleDragOver"
								@dragenter.prevent="handleDragEnter"
								@dragleave="handleDragLeave"
								@drop="handleDrop(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2), $event)"
								:style="{ gridColumn: gridCol, gridRow: gridRow }"
							>
								<template v-if="getNode(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2))">
									<div class="node-inner-content">
										<img
											:src="getNode(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2))!.img"
											:alt="getNode(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2))!.name"
										/>
										<div class="node-name">{{ getNode(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2))!.name }}</div>
										<div class="node-rank">{{ getTalentMetaLabel(getNode(Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 1) / 2))!) }}</div>
										<div class="node-cost">{{ calculateCost(Math.floor((gridRow - 1) / 2)) }} XP</div>
									</div>
								</template>
								<template v-else>
									<div class="empty-slot-content">
										<div class="empty-icon">+</div>
										<div class="empty-cost">{{ calculateCost(Math.floor((gridRow - 1) / 2)) }} XP</div>
									</div>
								</template>
							</div>
						</template>
						<template v-else-if="gridRow % 2 === 1 && gridCol % 2 === 0">
							<div
								class="connector h"
								:class="{ active: treeData.connections[`h-${Math.floor((gridRow - 1) / 2)}-${Math.floor((gridCol - 2) / 2)}`], editable: canEditStructure }"
								:data-conn="`h-${Math.floor((gridRow - 1) / 2)}-${Math.floor((gridCol - 2) / 2)}`"
								@click="handleConnectionClick('h', Math.floor((gridRow - 1) / 2), Math.floor((gridCol - 2) / 2))"
								:style="{ gridColumn: gridCol, gridRow: gridRow }"
							></div>
						</template>
						<template v-else-if="gridRow % 2 === 0 && gridCol % 2 === 1">
							<div
								class="connector v"
								:class="{ active: treeData.connections[`v-${Math.floor((gridRow - 2) / 2)}-${Math.floor((gridCol - 1) / 2)}`], editable: canEditStructure }"
								:data-conn="`v-${Math.floor((gridRow - 2) / 2)}-${Math.floor((gridCol - 1) / 2)}`"
								@click="handleConnectionClick('v', Math.floor((gridRow - 2) / 2), Math.floor((gridCol - 1) / 2))"
								:style="{ gridColumn: gridCol, gridRow: gridRow }"
							></div>
						</template>
						<template v-else>
							<div class="grid-spacer" :style="{ gridColumn: gridCol, gridRow: gridRow }"></div>
						</template>
					</template>
				</template>
			</div>
		</div>

	</div>
</template>

<style lang="scss" scoped>
@use '@scss/vars/colors.scss';

.talent-tree-container {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	background: transparentize(colors.$light-blue, 0.82);
	border: 1px solid transparentize(colors.$blue, 0.35);
	border-radius: 1em;
	padding: 0.75rem;

	&.edit-mode {
		border-style: dashed;
	}

}

.tree-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.75rem;
	padding: 0.5rem 0.75rem;
	margin-bottom: 0.75rem;
	background: colors.$blue;
	border-radius: 0.75rem;
	color: white;

	.xp-display,
	.spec-name-display {
		font-family: 'Bebas Neue', sans-serif;
		letter-spacing: 0.03em;
	}

	.xp-display {
		font-size: 1.1em;
		white-space: nowrap;

		.xp-val {
			font-weight: 900;
		}
	}

	.spec-name-display {
		flex: 1;
		text-align: left;
		font-size: 1.3em;

		&.is-empty {
			visibility: hidden;
		}
	}
}

.background-controls {
	padding: 0.75rem;
	margin-bottom: 0.75rem;
	background: transparentize(white, 0.45);
	border: 1px solid transparentize(colors.$blue, 0.7);
	border-radius: 0.75rem;

	.bg-input-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;

		label {
			font-family: 'Bebas Neue', sans-serif;
			font-size: 1em;
			color: colors.$dark-blue;
			letter-spacing: 0.03em;
		}

		input {
			flex: 1;
			padding: 0.35rem 0.6rem;
			background: white;
			color: black;
			border: 1px solid transparentize(colors.$blue, 0.55);
			border-radius: 0.35rem;
			font-size: 0.9em;
		}

		.file-picker-btn,
		.lock-btn {
			padding: 0.25rem 0.75rem;
			background: colors.$dark-blue;
			color: colors.$gold;
			border: 1px solid colors.$blue;
			border-radius: 999px;
			cursor: pointer;

			&:hover {
				background: colors.$blue;
			}

			&.locked {
				background: colors.$gold;
				color: colors.$dark-blue;
				border-color: colors.$gold;
			}
		}
	}

	.bg-hint {
		margin-top: 0.4rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.82em;
		color: transparentize(colors.$dark-blue, 0.18);
	}
}

.tree-container-wrapper {
	position: relative;
	overflow: auto;
	flex: 1 1 auto;
	min-height: 0;
	display: flex;
	justify-content: center;
	align-items: flex-start;
	margin: 0.5rem 0 0.75rem;
	padding: 0.75rem;
	background: transparentize(white, 0.3);
	border: 1px solid transparentize(colors.$blue, 0.55);
	border-radius: 0.75rem;
}

.tree-grid {
	position: relative;
	display: grid;
	grid-template-columns: 140px 30px 140px 30px 140px 30px 140px;
	grid-template-rows: 125px 25px 125px 25px 125px 25px 125px 25px 125px;
	justify-content: center;
	gap: 0;
	padding: 20px;
	border-radius: 0.75rem;
	overflow: visible;
	min-height: 400px;
	min-width: 600px;
	background-color: transparent !important;
	border: none !important;
	box-shadow: none !important;

	&.editable-bg:hover {
		cursor: grab;
	}
}

.tree-node {
	width: 120px;
	height: 110px;
	margin: auto;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	padding: 4px;
	z-index: 10;
	background: white;
	border: 2px solid colors.$blue;
	border-radius: 0.75rem;
	box-shadow: 0 6px 14px transparentize(colors.$dark-blue, 0.78);
	transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;

	.node-inner-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}

	img {
		width: 38px;
		height: 38px;
		margin-bottom: 4px;
		border: 1px solid transparentize(colors.$blue, 0.45);
		border-radius: 0.35rem;
		background: white;
	}

	.node-name {
		font-family: 'Roboto Slab', serif;
		font-size: 0.65em;
		font-weight: bold;
		color: colors.$dark-blue;
		text-transform: uppercase;
		text-align: center;
		line-height: 1.1;
		margin-bottom: 2px;
	}

	.node-rank {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.7em;
		letter-spacing: 0.03em;
		color: transparentize(colors.$dark-blue, 0.22);
		margin-bottom: 2px;
	}

	.node-cost {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.8em;
		letter-spacing: 0.03em;
		color: colors.$gold;
	}

	&.available:hover {
		border-color: colors.$gold;
		box-shadow: 0 0 0 2px transparentize(colors.$gold, 0.65), 0 8px 18px transparentize(colors.$dark-blue, 0.72);
		transform: translateY(-2px);
		cursor: pointer;
	}

	&.purchased {
		background: transparentize(colors.$gold, 0.72);
		border-color: colors.$gold;

		.node-name,
		.node-rank,
		.node-cost {
			color: colors.$dark-blue;
		}

		img {
			border-color: colors.$gold;
		}
	}

	&.dimmed {
		opacity: 0.55;
		filter: grayscale(100%);
		border-color: transparentize(colors.$dark-blue, 0.35);
		box-shadow: none;
	}

	&.empty {
		background: transparentize(white, 0.45);
		border: 1px dashed transparentize(colors.$blue, 0.4);
		box-shadow: none;

		.empty-icon {
			font-size: 20px;
			color: transparentize(colors.$blue, 0.45);
		}

		.empty-cost {
			font-family: 'Bebas Neue', sans-serif;
			font-size: 0.8em;
			color: transparentize(colors.$dark-blue, 0.3);
		}
	}
}

.connector {
	background: transparentize(colors.$blue, 0.45);
	opacity: 0.55;
	transition: background-color 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
	z-index: 1;

	&.h {
		height: 4px;
		align-self: center;
		width: 100%;
		border-radius: 999px;
	}

	&.v {
		width: 4px;
		justify-self: center;
		height: 100%;
		border-radius: 999px;
	}

	&.editable:hover {
		opacity: 0.85;
	}

	&.active {
		background: colors.$gold;
		opacity: 1;
		box-shadow: 0 0 8px transparentize(colors.$gold, 0.2);
		z-index: 5;
	}
}

</style>

