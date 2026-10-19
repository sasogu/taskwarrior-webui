<template>
	<v-app>
		<h2 class="headline">
			{{ error.statusCode }}
		</h2>
		<div>
			{{ error.message }}
		</div>
		<NuxtLink to="/">
			{{ $t('Home page') }}
		</NuxtLink>
	</v-app>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';
import { NuxtError } from '@nuxt/types';
import { localeState } from '../utils/i18n';

export default defineComponent({
	head() {
		return { htmlAttrs: { lang: localeState.language } };
	},

	props: {
		error: {
			type: Object as () => NuxtError,
			required: true
		}
	},

	setup(props) {
		return {
			error: props.error
		};
	}
});
</script>
