<script lang="ts" setup>
import { computed } from 'vue';
import MoneyFields from '@/vue/components/MoneyFields.vue';
import { isWarhammerProfile } from '@/system/GameProfile';

type WarhammerPrice = {
	gold?: number;
	silver?: number;
	pennies?: number;
	restricted?: boolean;
};

const props = defineProps<{
	price?: number;
	priceWarhammer?: WarhammerPrice;
}>();

const useWarhammerPrice = computed(() => isWarhammerProfile());
</script>

<template>
	<MoneyFields v-if="useWarhammerPrice" name-prefix="system.priceWarhammer" :value="priceWarhammer" include-restricted />
	<input v-else type="number" name="system.price" :value="price ?? 0" min="0" step="1" />
</template>
