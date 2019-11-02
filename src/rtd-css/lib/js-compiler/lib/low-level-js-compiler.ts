import { StringBuilder } from '../../../../core-lib/string-builder';
import { TextFormatter } from '../../../../core-lib/text-formatter';
import { DeviceExpandingScriptConfigModule } from '../../device-expanding-config';
import { BrowserScriptParts } from '../../browser-script-parts';

export class LowLevelJsCompiler {
	compile(
		jsConfig: DeviceExpandingScriptConfigModule.Config,
		device: DeviceExpandingScriptConfigModule.Device | null,
	): string {
		const jsStringBuilder = new StringBuilder();
		const numberOfTabsForJsVars = 1;

		if (!device) {
			const jsConfigJson = TextFormatter.jsonStringifyPretty(jsConfig, TextFormatter.indentTab())
				.addTabsAtBeginOfAllLines(numberOfTabsForJsVars)
				.getText()
				.trim();

			jsStringBuilder.add(BrowserScriptParts.uaParserScript);
			jsStringBuilder.add('\n\n');
			jsStringBuilder.add(
				BrowserScriptParts.rtdScript
					.replace("'{config}'", jsConfigJson)
					.replace("'{breakpointsForDevice}'", 'null'),
			);
		} else {
			const breakpointsForDevice = jsConfig.breakpointsForDeviceByDevice[device.type];
			const breakpointsForDeviceJson = TextFormatter.jsonStringifyPretty(
				breakpointsForDevice,
				TextFormatter.indentTab(),
			)
				.addTabsAtBeginOfAllLines(numberOfTabsForJsVars)
				.getText()
				.trim();

			jsStringBuilder.add(
				BrowserScriptParts.rtdScript
					.replace("'{config}'", 'null')
					.replace("'{breakpointsForDevice}'", breakpointsForDeviceJson),
			);
		}

		const js = jsStringBuilder.stringify();
		return js;
	}
}
