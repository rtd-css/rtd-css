import postcss from 'postcss';
import { CssCompiler, Options } from '../rtd-css';
import { PostcssCssDriver } from './lib/postcss-css-driver';

const postcssRtdCssPlugin = postcss.plugin<Options>(
	'postcss-rtd-css',
	(opts: Options): postcss.Transformer => {
		return (root: postcss.Root, result: postcss.Result): Promise<any> | any => {
			const compiler = new CssCompiler();
			result.root = compiler.compile<postcss.Root>(result.root, opts, new PostcssCssDriver());
		};
	},
);

export default postcssRtdCssPlugin;
