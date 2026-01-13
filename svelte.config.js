import adapter from '@sveltejs/adapter-auto';
import autoprefixer from 'autoprefixer';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: preprocess({
		postcss: {
			plugins: [autoprefixer]
		},
		scss: {
			prependData: `@import './src/lib/styles/mixins.scss';`
		}
	}),
	kit: {
		adapter: adapter()
	}
};

export default config;
