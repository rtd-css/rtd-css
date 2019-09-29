import { CssDriver } from '../../css-driver';
import { Options } from './options';
import { LowLevelCompiler } from './low-level-compiler';
import { ConfigModule } from './config';

export class CssCompiler {
	compile<TSourceRoot>(sourceCssRoot: TSourceRoot, options: Options, cssDriver: CssDriver): TSourceRoot {
		const inCompilerCssRoot = cssDriver.sourceRootToRoot(sourceCssRoot);

		const lowLevelCompiler = new LowLevelCompiler();

		const config = lowLevelCompiler.loadConfig(inCompilerCssRoot);
		lowLevelCompiler.setConfig(config);

		lowLevelCompiler.setOptions(options);
		lowLevelCompiler.setCssDriver(cssDriver);

		const outCompilerCssRoot = lowLevelCompiler.compile(inCompilerCssRoot);
		let resultSourceCssRoot = cssDriver.rootToSourceRoot(outCompilerCssRoot);
		resultSourceCssRoot = cssDriver.prettify(resultSourceCssRoot);
		return resultSourceCssRoot;
	}

	loadConfig<TSourceRoot>(sourceCssRoot: TSourceRoot, cssDriver: CssDriver): ConfigModule.Config {
		const lowLevelCompiler = new LowLevelCompiler();
		const config = lowLevelCompiler.loadConfig(
			cssDriver.sourceRootToRoot(sourceCssRoot),
		);
		return config;
	}
}
