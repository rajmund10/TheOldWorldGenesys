<script lang="ts" setup>
import { onMounted, onUpdated, ref } from 'vue';

const props = defineProps<{
	value: string;
}>();

const enrichedContent = ref(props.value);

async function enrichContent() {
	// Handle Foundry VTT TextEditor deprecation (v13+)
	const textEditor = (foundry as any).applications?.ux?.TextEditor?.implementation || TextEditor;
	enrichedContent.value = await textEditor.enrichHTML(props.value, { async: true });
}

onMounted(enrichContent);
onUpdated(enrichContent);
</script>

<template>
	<div v-html="enrichedContent"></div>
</template>
