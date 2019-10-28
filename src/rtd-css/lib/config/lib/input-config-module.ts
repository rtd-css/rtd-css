import { OptionsParser } from '../../../../core-lib/options-parser';

export module InputConfigModule {
	export interface Config {
		units: string;
		unknownDevice: UnknownDevice;
		deviceList: Device[];
	}

	export interface UnknownDevice {
		name: string;
		cssClass: string;
	}

	export interface Device {
		name: string;
		cssClass: string;
		maxWidth: number;
		mergeDownTo: string | null;
		mergeUpTo: string | null;
	}

	export module ConfigParser {
		const schemaFactory = new OptionsParser.DataSchema.SchemaFactory();

		const schema = new OptionsParser.DataSchema([
			schemaFactory.createStringOption('rtd-units', 'units', true),
			schemaFactory.createObjectOption('rtd-unknown-device', 'unknownDevice', true, [
				schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
				schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
			]),
			schemaFactory.createObjectMultipleOption('rtd-device', 'deviceList', true, [
				schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
				schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
				schemaFactory.createFloatSubOption('rtd-device-max-width', 'maxWidth', true, value =>
					value === null ? Infinity : value,
				),
				schemaFactory.createStringSubOption('rtd-device-merge-down-to', 'mergeDownTo', true),
				schemaFactory.createStringSubOption('rtd-device-merge-up-to', 'mergeUpTo', true),
			]),
		]);

		export function parse(string: string): InputConfigModule.Config {
			const config = OptionsParser.parse<InputConfigModule.Config>(string, schema);
			return config;
		}
	}
}
