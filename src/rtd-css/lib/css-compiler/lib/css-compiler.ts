import { CssDriver, CssResult } from '../../../../css-driver';
import { defaultCssDriver } from '../../default-css-driver';
import { ConcreteConfigLoader } from '../../concrete-config-loader';
import { LowLevelCssCompiler } from './low-level-css-compiler';
import { CssCompilerOptions } from './css-compiler-options';

export class CssCompiler {
	compile<TCssRoot>(
		inputCss: string | TCssRoot,
		options: CssCompilerOptions = null,
		cssDriver: CssDriver = defaultCssDriver,
	): CssResult<TCssRoot> {
		const inCssRoot = cssDriver.inputCssToSourceRoot(inputCss);
		const inCompilerCssRoot = cssDriver.sourceRootToRoot(inCssRoot);

		const lowLevelCssCompiler = new LowLevelCssCompiler();

		const configLoader = new ConcreteConfigLoader();
		const config = configLoader.loadCssConfig(inCompilerCssRoot);
		lowLevelCssCompiler.setConfig(config);

		lowLevelCssCompiler.setOptions(options);
		lowLevelCssCompiler.setCssDriver(cssDriver);

		const outCompilerCssRoot = lowLevelCssCompiler.compile(inCompilerCssRoot);
		let outCssRoot = cssDriver.rootToSourceRoot(outCompilerCssRoot);
		outCssRoot = cssDriver.prettify(outCssRoot);
		const outCssResult = cssDriver.createResult(outCssRoot);
		return outCssResult;
	}
}
