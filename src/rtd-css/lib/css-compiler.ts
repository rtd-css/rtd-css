import { CssDriver, CssResult } from '../../css-driver';
import { Options } from './options';
import { LowLevelCompiler } from './low-level-compiler';
import { ConfigModule } from './config';

export class CssCompiler {
	compile<TCssRoot>(inputCss: string | TCssRoot, options: Options, cssDriver: CssDriver): CssResult<TCssRoot> {
		const inCssRoot = this.inputCssToCssRoot<TCssRoot>(inputCss, cssDriver);
		const inCompilerCssRoot = cssDriver.sourceRootToRoot(inCssRoot);

		const lowLevelCompiler = new LowLevelCompiler();

		const config = lowLevelCompiler.loadConfig(inCompilerCssRoot);
		lowLevelCompiler.setConfig(config);

		lowLevelCompiler.setOptions(options);
		lowLevelCompiler.setCssDriver(cssDriver);

		const outCompilerCssRoot = lowLevelCompiler.compile(inCompilerCssRoot);
		let outCssRoot = cssDriver.rootToSourceRoot(outCompilerCssRoot);
		outCssRoot = cssDriver.prettify(outCssRoot);
		const outCssResult = cssDriver.createResult(outCssRoot);
		return outCssResult;
	}

	loadConfig<TCssRoot>(inputCss: string | TCssRoot, cssDriver: CssDriver): ConfigModule.Config {
		const inCssRoot = this.inputCssToCssRoot<TCssRoot>(inputCss, cssDriver);
		const lowLevelCompiler = new LowLevelCompiler();
		const config = lowLevelCompiler.loadConfig(cssDriver.sourceRootToRoot(inCssRoot));
		return config;
	}

	private inputCssToCssRoot<TCssRoot>(inputCss: string | TCssRoot, cssDriver: CssDriver): TCssRoot {
		let cssRoot: TCssRoot;

		if (typeof inputCss === 'string') {
			cssRoot = cssDriver.parseCssToSourceRoot(inputCss);
		} else {
			cssRoot = inputCss;
		}

		return cssRoot;
	}
}
