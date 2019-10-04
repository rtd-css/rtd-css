import typescript from 'rollup-plugin-typescript2';

export default {
	input: 'src/postcss-rtd-css/postcss-rtd-css-plugin.ts',

	output: [
		{ file: 'lib/postcss-rtd-css.cjs.js', format: 'cjs', sourcemap: true },
		{ file: 'lib/postcss-rtd-css.es.mjs', format: 'es', sourcemap: true },
	],

	// Specify here external modules which you don't want to include in your bundle (for instance: 'lodash', 'moment' etc.)
	// https://rollupjs.org/guide/en#external-e-external
	external: [],

	plugins: [
		typescript({
			tsconfig: 'tsconfig.json',
		}),
	],
};
