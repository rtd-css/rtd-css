import { OptionsParser } from '../../../../core-lib/options-parser';
import { ArrayUtils } from '../../../../core-lib/array-utils';
import { Dictionary } from '../../../../core-lib/dictionary';
import { DictionaryCreator } from '../../../../core-lib/dictionary-creator';
import { FloatNumberParser } from '../../../../core-lib/float-number-parser';
import { InputConfigModule } from '../../config';
import { DeviceType } from '../../device-type';
import { DeviceExpandingScriptConfigModule } from './device-expanding-script-config-module';

export module DeviceExpandingInputConfigModule {
	export interface Config {
		units: string;
		breakpoints: string[];
		unknownDevice: UnknownDevice;
		mobileDevice: Device;
		tabletDevice: Device;
		desktopDevice: Device;
	}

	export interface UnknownDevice {
		type: DeviceType;
		name: string;
		cssClass: string;
	}

	export interface Device {
		type: DeviceType;
		name: string;
		cssClass: string;
		breakpoints: string[];
	}

	export module ConfigParser {
		const schemaFactory = new OptionsParser.DataSchema.SchemaFactory();

		const deviceSubOptionSchemas = [
			schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
			schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
			schemaFactory.createStringArraySubOption('rtd-device-breakpoints', 'breakpoints', true),
		];

		const schema = new OptionsParser.DataSchema([
			schemaFactory.createStringOption('rtd-units', 'units', true),
			schemaFactory.createStringArrayOption('rtd-breakpoints', 'breakpoints', true),
			schemaFactory.createObjectOption('rtd-unknown-device', 'unknownDevice', true, [
				schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
				schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
			]),
			schemaFactory.createObjectOption('rtd-mobile-device', 'mobileDevice', false, deviceSubOptionSchemas),
			schemaFactory.createObjectOption('rtd-tablet-device', 'tabletDevice', false, deviceSubOptionSchemas),
			schemaFactory.createObjectOption('rtd-desktop-device', 'desktopDevice', false, deviceSubOptionSchemas),
		]);

		export function parse(string: string): DeviceExpandingInputConfigModule.Config {
			const config = OptionsParser.parse<DeviceExpandingInputConfigModule.Config>(string, schema);

			config.unknownDevice && (config.unknownDevice.type = DeviceType.Unknown);
			config.mobileDevice && (config.mobileDevice.type = DeviceType.Mobile);
			config.tabletDevice && (config.tabletDevice.type = DeviceType.Tablet);
			config.desktopDevice && (config.desktopDevice.type = DeviceType.Desktop);

			return config;
		}
	}

	// TODO: Remake static methods to instance methods. There are so many static
	// methods in this class because this class was transformed from module.
	export class ConfigExporter {
		private static readonly allOrderedDeviceTypes: DeviceType[] = [
			DeviceType.Mobile,
			DeviceType.Tablet,
			DeviceType.Desktop,
		];

		private _config: DeviceExpandingInputConfigModule.Config;
		private _deviceList: DeviceExpandingInputConfigModule.Device[];
		private _deviceByName: Dictionary<DeviceExpandingInputConfigModule.Device>;
		private _initialBreakpoints: DeviceExpandingScriptConfigModule.Breakpoint[];
		private _initialBreakpointByName: Dictionary<DeviceExpandingScriptConfigModule.Breakpoint>;

		constructor(config: DeviceExpandingInputConfigModule.Config) {
			this._config = config;

			this._deviceList = ConfigExporter.createDeviceListFromConfig(config);
			this._deviceByName = ConfigExporter.createDeviceByName(this._deviceList);
			this._initialBreakpoints = ConfigExporter.parseInitialBreakpoints(config.breakpoints, this._deviceByName);
			this._initialBreakpointByName = ConfigExporter.createBreakpointByName(this._initialBreakpoints);
		}

		exportToBaseConfig(): InputConfigModule.Config {
			const baseConfig: InputConfigModule.Config = {
				units: this._config.units,
				unknownDevice: <InputConfigModule.UnknownDevice>{
					name: this._config.unknownDevice.name,
					cssClass: this._config.unknownDevice.cssClass,
				},
				deviceList: this._deviceList.map(device => {
					const outDevice = <InputConfigModule.Device>{
						name: device.name,
						cssClass: device.cssClass,
						maxWidth: this._initialBreakpointByName.get(device.name).maxWidth,
						mergeDownTo: null,
						mergeUpTo: null,
					};

					return outDevice;
				}),
			};

			return baseConfig;
		}

		exportToScriptConfig(): DeviceExpandingScriptConfigModule.Config {
			const scriptConfig: DeviceExpandingScriptConfigModule.Config = {
				breakpointsForDeviceByDevice: <DeviceExpandingScriptConfigModule.BreakpointsForDeviceByDevice>(
					DictionaryCreator.createObjectFromArray(
						this._deviceList,
						device => device.type,
						device => {
							const breakpoints = ConfigExporter.parseBreakpoints(
								device.breakpoints,
								this._deviceByName,
								this._initialBreakpointByName,
							);

							return new DeviceExpandingScriptConfigModule.BreakpointsForDevice(
								ConfigExporter.inputDeviceToScriptDevice(device),
								breakpoints,
							);
						},
					)
				),
			};

			scriptConfig.breakpointsForDeviceByDevice[
				DeviceType.Unknown
			] = new DeviceExpandingScriptConfigModule.BreakpointsForDevice(
				this._config.unknownDevice,
				this._initialBreakpoints,
			);

			return scriptConfig;
		}

		private static createDeviceListFromConfig(
			config: DeviceExpandingInputConfigModule.Config,
		): DeviceExpandingInputConfigModule.Device[] {
			const allNullableDevices: DeviceExpandingInputConfigModule.Device[] = [
				config.mobileDevice,
				config.tabletDevice,
				config.desktopDevice,
			];

			const devices = allNullableDevices.filter(device => !!device);
			return devices;
		}

		private static createDeviceByName(
			deviceList: DeviceExpandingInputConfigModule.Device[],
		): Dictionary<DeviceExpandingInputConfigModule.Device> {
			return DictionaryCreator.createDictionaryFromArray(deviceList, device => device.name, device => device);
		}

		private static createBreakpointByName(
			breakpoints: DeviceExpandingScriptConfigModule.Breakpoint[],
		): Dictionary<DeviceExpandingScriptConfigModule.Breakpoint> {
			return DictionaryCreator.createDictionaryFromArray(
				breakpoints,
				breakpoint => breakpoint.device.name,
				breakpoint => breakpoint,
			);
		}

		private static parseBreakpointsRaw(
			tokens: string[],
			deviceByName: Dictionary<DeviceExpandingInputConfigModule.Device>,
		): DeviceExpandingScriptConfigModule.Breakpoint[] {
			if (tokens.length % 2 === 0) {
				throw new Error('Breakpoints must end with device name but not with max width');
			}

			const breakpoints: DeviceExpandingScriptConfigModule.Breakpoint[] = [];

			for (let i = 0; i < tokens.length; i += 2) {
				// Device

				const deviceName = tokens[i];
				if (!deviceByName.has(deviceName)) {
					throw new Error(`Device with name "${deviceName}" not found in breakpoints`);
				}
				const device = deviceByName.get(deviceName);

				// Max width

				let maxWidth: number;
				if (i + 1 < tokens.length) {
					const maxWidthStr = tokens[i + 1];
					if (maxWidthStr === null) {
						maxWidth = null;
					} else if (typeof maxWidthStr === 'string') {
						maxWidth = FloatNumberParser.tryParse(maxWidthStr);
						if (typeof maxWidth !== 'number') {
							throw new Error('Max width in breakpoints must be a number');
						}
					} else {
						throw new Error('Max width in breakpoints has invalid type');
					}
				} else {
					maxWidth = Infinity;
				}

				// Breakpoint

				const curBreakpoint = new DeviceExpandingScriptConfigModule.Breakpoint(
					ConfigExporter.inputDeviceToScriptDevice(device),
					maxWidth,
				);

				breakpoints.push(curBreakpoint);
			}

			return breakpoints;
		}

		private static validateBreakpoints_allMaxWidthsAreNumbers(
			breakpoints: DeviceExpandingScriptConfigModule.Breakpoint[],
		): boolean {
			for (const curBreakpoint of breakpoints) {
				if (typeof curBreakpoint.maxWidth !== 'number') {
					return false;
				}
			}

			return true;
		}

		private static validateBreakpoints_validOrdering(
			breakpoints: DeviceExpandingScriptConfigModule.Breakpoint[],
			all: boolean = false,
		): boolean {
			// Device ordering

			const deviceTypes = breakpoints.map(curBreakpoint => curBreakpoint.device.type);
			const deviceOrderingValid = all
				? ArrayUtils.isEqual(deviceTypes, ConfigExporter.allOrderedDeviceTypes)
				: ArrayUtils.isEqual(
						deviceTypes,
						ConfigExporter.allOrderedDeviceTypes.filter(type => deviceTypes.includes(type)),
				  );

			if (!deviceOrderingValid) {
				return false;
			}

			// Max width ordering

			let maxWidthOrderingValid: boolean = true;

			for (let i = 1; i < breakpoints.length; i++) {
				const curMaxWidth = breakpoints[i].maxWidth;
				const prevMaxWidth = breakpoints[i - 1].maxWidth;
				if (!(prevMaxWidth < curMaxWidth)) {
					maxWidthOrderingValid = false;
					break;
				}
			}

			if (maxWidthOrderingValid && breakpoints[breakpoints.length - 1].maxWidth !== Infinity) {
				maxWidthOrderingValid = false;
			}

			if (!maxWidthOrderingValid) {
				return false;
			}

			// Valid

			return true;
		}

		private static parseInitialBreakpoints(
			tokens: string[],
			deviceByName: Dictionary<DeviceExpandingInputConfigModule.Device>,
		): DeviceExpandingScriptConfigModule.Breakpoint[] {
			const breakpoints = ConfigExporter.parseBreakpointsRaw(tokens, deviceByName);

			if (!ConfigExporter.validateBreakpoints_allMaxWidthsAreNumbers(breakpoints)) {
				throw new Error('All max widths in initial breakpoints must be a numbers');
			}

			if (!ConfigExporter.validateBreakpoints_validOrdering(breakpoints, true)) {
				throw new Error('Invalid ordering in initial breakpoints');
			}

			return breakpoints;
		}

		private static parseBreakpoints(
			tokens: string[],
			deviceByName: Dictionary<DeviceExpandingInputConfigModule.Device>,
			initialBreakpointByName: Dictionary<DeviceExpandingScriptConfigModule.Breakpoint>,
		): DeviceExpandingScriptConfigModule.Breakpoint[] {
			// Parse breakpoints

			const breakpoints = ConfigExporter.parseBreakpointsRaw(tokens, deviceByName);

			// Replace null max widths to initial values

			for (const curBreakpoint of breakpoints) {
				if (typeof curBreakpoint.maxWidth === 'number') {
					continue;
				}

				const name = curBreakpoint.device.name;
				if (!initialBreakpointByName.has(name)) {
					throw new Error(`Initial breakpoint with name "${name}" not found`);
				}
				const initialBreakpoint = initialBreakpointByName.get(name);
				curBreakpoint.maxWidth = initialBreakpoint.maxWidth;
			}

			// Validate

			if (!ConfigExporter.validateBreakpoints_allMaxWidthsAreNumbers(breakpoints)) {
				throw new Error('All max widths in breakpoints must be a numbers');
			}

			if (!ConfigExporter.validateBreakpoints_validOrdering(breakpoints, false)) {
				throw new Error('Invalid ordering in breakpoints');
			}

			// Return

			return breakpoints;
		}

		private static inputDeviceToScriptDevice(
			inputDevice: DeviceExpandingInputConfigModule.Device | DeviceExpandingInputConfigModule.UnknownDevice,
		): DeviceExpandingScriptConfigModule.Device {
			const scriptDevice = new DeviceExpandingScriptConfigModule.Device(
				inputDevice.type,
				inputDevice.name,
				inputDevice.cssClass,
			);

			return scriptDevice;
		}
	}
}
