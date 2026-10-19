import { accessorType } from '~/store';

declare module 'vue/types/vue' {
	interface Vue {
		$t: typeof import('../utils/i18n').t
		$language: import('../utils/i18n').Language
		$accessor: typeof accessorType
	}
}

declare module '@nuxt/types' {
	interface NuxtAppOptions {
		$accessor: typeof accessorType
	}
}
