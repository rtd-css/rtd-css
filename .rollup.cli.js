import typescript from 'rollup-plugin-typescript2';
import hashbang from 'rollup-plugin-hashbang';

export default {

	input: 'src/rtd-css-cli/index.ts',

	output: [
		{ file: 'lib/cli.cjs.js', format: 'cjs', sourcemap: true },
		{ file: 'lib/cli.es.mjs', format: 'es', sourcemap: true }
	],

	// Specify here external modules which you don't want to include in your bundle (for instance: 'lodash', 'moment' etc.)
	// https://rollupjs.org/guide/en#external-e-external
	external: [],

	plugins: [
		hashbang(),
		typescript()
	]

}
