import { CssTree } from '../../css-driver';
import { ConfigModule, ConfigBuilderModule } from './config';
import { DeviceExpandingInputConfigModule, DeviceExpandingScriptConfigModule } from './device-expanding-config';
import { CssConfigStringLoader } from './low-level-compiling-logic';

export class ConcreteConfigLoader {
	loadCssConfig(root: CssTree.Root): ConfigModule.Config {
		const configExporter = this.createConfigExporter(root);
		const inputConfig = configExporter.exportToBaseConfig();
		const config = new ConfigBuilderModule.ConfigBuilder()
			.setUnits(inputConfig.units)
			.setUnknownDevice(
				new ConfigModule.UnknownDevice(inputConfig.unknownDevice.name, inputConfig.unknownDevice.cssClass),
			)
			.setDeviceList(inputConfig.deviceList)
			.createConfig();

		return config;
	}

	loadJsConfig(root: CssTree.Root): DeviceExpandingScriptConfigModule.Config {
		const configExporter = this.createConfigExporter(root);
		const config = configExporter.exportToScriptConfig();

		return config;
	}

	private createConfigExporter(root: CssTree.Root): DeviceExpandingInputConfigModule.ConfigExporter {
		const configStringLoader = new CssConfigStringLoader();
		const configString = configStringLoader.loadConfigString(root);
		const expandingInputConfig = DeviceExpandingInputConfigModule.ConfigParser.parse(configString);
		const expandingInputConfigExporter = new DeviceExpandingInputConfigModule.ConfigExporter(expandingInputConfig);

		return expandingInputConfigExporter;
	}
}
