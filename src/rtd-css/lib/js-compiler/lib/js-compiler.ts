import { DeviceExpandingScriptConfigModule } from '../../device-expanding-config';
import { LowLevelJsCompiler } from './low-level-js-compiler';

export class JsCompiler {
	compile(
		jsConfig: DeviceExpandingScriptConfigModule.Config,
		device: DeviceExpandingScriptConfigModule.Device | null,
	): string {
		const lowLevelJsCompiler = new LowLevelJsCompiler();
		const js = lowLevelJsCompiler.compile(jsConfig, device);

		return js;
	}
}
