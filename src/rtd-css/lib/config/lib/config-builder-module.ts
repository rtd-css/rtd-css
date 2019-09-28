import { deepClone } from '../../../../core-lib/deep-clone';
import { Range } from '../../../../core-lib/range';
import { InputConfigModule } from './input-config-module';
import { ConfigModule } from './config-module';

export module ConfigBuilderModule {
	export class ConfigBuilder {
		private readonly _outputConfig: ConfigBuilder.Data.OutputConfig;

		constructor() {
			this._outputConfig = new ConfigBuilder.Data.OutputConfig();
		}

		setUnits(units: string): ConfigBuilder {
			this._outputConfig.units = units;
			return this;
		}

		setUnknownDevice(unknownDevice: ConfigModule.UnknownDevice): ConfigBuilder {
			this._outputConfig.unknownDevice = unknownDevice;
			return this;
		}

		setDeviceList(deviceList: InputConfigModule.Device[]): ConfigBuilder {
			this._outputConfig.deviceList =
				new DeviceListBuilder()
					.setDeviceList(deviceList)
					.createDeviceList();
			return this;
		}

		createConfig(): ConfigModule.Config {
			const config = new ConfigModule.Config(
				this._outputConfig.units,
				this._outputConfig.unknownDevice,
				this._outputConfig.deviceList,
			);
			return deepClone(config);
		}
	}

	export module ConfigBuilder.Data {
		export class OutputConfig {
			units: string;
			unknownDevice: ConfigModule.UnknownDevice;
			deviceList: ConfigModule.DeviceList;
		}
	}

	export class DeviceListBuilder {
		private readonly _intermediateData: DeviceListBuilder.Data.IntermediateData;
		private _outputDeviceList: DeviceListBuilder.Data.OutputDeviceList;

		constructor() {
			this._intermediateData = new DeviceListBuilder.Data.IntermediateData();
		}

		setDeviceList(deviceList: InputConfigModule.Device[]): DeviceListBuilder {
			if (!deviceList) {
				throw new Error('{deviceList} required');
			}
			for (const device of deviceList) {
				if (!device) {
					throw new Error('All items in {deviceList} must be not null');
				}
			}

			this.initSortedDeviceList(deviceList);
			this.initDeviceByName(deviceList);
			this.initDeviceByMaxWidth(deviceList);
			this.initDeviceRangeByName();
			this.initDeviceMergedRangeByName();

			this._outputDeviceList = this._intermediateData.sortedDeviceList.map(
				(device) => {
					return new ConfigModule.Device(
						device.name,
						device.cssClass,
						device.maxWidth,
						device.mergeDownTo,
						device.mergeUpTo,
						this._intermediateData.deviceMergedRangeByName[device.name],
					);
				},
			);

			return this;
		}

		createDeviceList(): ConfigModule.DeviceList {
			const deviceList = new ConfigModule.DeviceList();
			deviceList.add(...this._outputDeviceList);
			return deepClone(deviceList);
		}

		private initSortedDeviceList(
			deviceList: InputConfigModule.Device[],
		): void {
			this._intermediateData.sortedDeviceList = deviceList.sort((a, b) => {
				let result: number;
				if (a.maxWidth < b.maxWidth) {
					result = -1;
				} else if (a.maxWidth === b.maxWidth) {
					result = 0;
				} else {
					result = 1;
				}
				return result;
			});
		}

		private initDeviceByName(
			deviceList: InputConfigModule.Device[],
		): void {
			this._intermediateData.deviceByName = new Types.DeviceByName();
			for (const device of deviceList) {
				if (this._intermediateData.deviceByName[device.name]) {
					throw new Error('Non unique device names in {deviceList}');
				}
				this._intermediateData.deviceByName[device.name] = device;
			}
		}

		private initDeviceByMaxWidth(
			deviceList: InputConfigModule.Device[],
		): void {
			this._intermediateData.deviceByMaxWidth = new Types.DeviceByMaxWidth();
			for (const device of deviceList) {
				if (typeof device.maxWidth !== 'number') {
					throw new Error('Device max width must be a number');
				}
				const deviceMaxWidthStr = device.maxWidth.toString();
				if (this._intermediateData.deviceByMaxWidth[deviceMaxWidthStr]) {
					throw new Error('Non unique device max widths in {deviceList}');
				}
				this._intermediateData.deviceByMaxWidth[deviceMaxWidthStr] = device;
			}
			if (!this._intermediateData.deviceByMaxWidth[Infinity.toString()]) {
				throw new Error('{deviceList} must has device with unsetted (infinity) max width');
			}
		}

		private initDeviceRangeByName(): void {
			this._intermediateData.deviceRangeByName = new Types.DeviceRangeByName();
			let curMinWidth = -Infinity;
			for (const device of this._intermediateData.sortedDeviceList) {
				this._intermediateData.deviceRangeByName[device.name] =
					new Range(curMinWidth, device.maxWidth);
				curMinWidth = device.maxWidth + 1;
			}
		}

		private initDeviceMergedRangeByName(): void {
			this._intermediateData.deviceMergedRangeByName =
				deepClone(this._intermediateData.deviceRangeByName);
			for (const device of this._intermediateData.sortedDeviceList) {
				if (device.mergeDownTo) {
					this.mergeDeviceUpOrDownToDevice(device, false, device.mergeDownTo);
				}
				if (device.mergeUpTo) {
					this.mergeDeviceUpOrDownToDevice(device, true, device.mergeUpTo);
				}
			}
		}

		private mergeDeviceUpOrDownToDevice(
			device: InputConfigModule.Device,
			mergeUpOrDown: boolean,
			mergeToDeviceName: string,
		): void {
			const mergeToDevice = this._intermediateData.deviceByName[mergeToDeviceName];
			if (!mergeToDevice) {
				throw new Error(
					mergeUpOrDown
						? `Device "${mergeToDeviceName}" for merging "up to" not found`
						: `Device "${mergeToDeviceName}" for merging "down to" not found`,
				);
			}
			if (mergeUpOrDown) {
				if (mergeToDevice.maxWidth < device.maxWidth) {
					throw new Error(
						[
							`Device "${mergeToDeviceName}" for merging "up to" has max width`,
							`that less than target device "${device.name}" max width`,
						].join(' '),
					);
				}
				this._intermediateData.deviceMergedRangeByName[device.name] = new Range(
					this._intermediateData.deviceMergedRangeByName[device.name].from,
					this._intermediateData.deviceRangeByName[mergeToDeviceName].to,
				);
			} else {
				if (mergeToDevice.maxWidth > device.maxWidth) {
					throw new Error(
						[
							`Device "${mergeToDeviceName}" for merging "down to" has max width`,
							`that greater than target device "${device.name}" max width`,
						].join(' '),
					);
				}
				this._intermediateData.deviceMergedRangeByName[device.name] = new Range(
					this._intermediateData.deviceRangeByName[mergeToDeviceName].from,
					this._intermediateData.deviceMergedRangeByName[device.name].to,
				);
			}
		}
	}

	export module DeviceListBuilder.Data {
		export class OutputDeviceList extends Array<ConfigModule.Device> {}

		export class IntermediateData {
			sortedDeviceList: InputConfigModule.Device[];
			deviceByName: Types.DeviceByName;
			deviceByMaxWidth: Types.DeviceByMaxWidth;
			deviceRangeByName: Types.DeviceRangeByName;
			deviceMergedRangeByName: Types.DeviceRangeByName;
		}
	}

	export module Types {
		export class DeviceByName {
			[deviceName: string]: InputConfigModule.Device;
		}

		export class DeviceByMaxWidth {
			[deviceMaxWidth: string]: InputConfigModule.Device;
		}

		export class DeviceRangeByName {
			[deviceName: string]: Range;
		}
	}
}
