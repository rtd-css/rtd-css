import postcss from 'postcss';
import { CssCompiler, CssCompilerOptions } from '../rtd-css';
import { PostcssCssDriver } from './lib/postcss-css-driver';

const postcssRtdCssPlugin = postcss.plugin<CssCompilerOptions>(
	'postcss-rtd-css',
	(opts: CssCompilerOptions): postcss.Transformer => {
		return (root: postcss.Root, result: postcss.Result): Promise<any> | any => {
			const compiler = new CssCompiler();
			result.root = compiler.compile<postcss.Root>(result.root, opts, new PostcssCssDriver()).cssRoot;
		};
	},
);

export default postcssRtdCssPlugin;
