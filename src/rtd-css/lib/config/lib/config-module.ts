import { IndexedList, UniqueIndexedListIndex } from '../../../../core-lib/indexed-list';
import { Range } from '../../../../core-lib/range';

export module ConfigModule {
	export class Config {
		readonly units: string;
		readonly unknownDevice: ConfigModule.UnknownDevice;
		readonly deviceList: ConfigModule.DeviceList;

		constructor(
			units: string,
			unknownDevice: ConfigModule.UnknownDevice,
			deviceList: ConfigModule.DeviceList,
		) {
			this.units = units;
			this.unknownDevice = unknownDevice;
			this.deviceList = deviceList;
		}
	}

	export class UnknownDevice {
		readonly name: string;
		readonly cssClass: string;

		constructor(
			name: string,
			cssClass: string,
		) {
			this.name = name;
			this.cssClass = cssClass;
		}
	}

	export class Device {
		readonly name: string;
		readonly cssClass: string;
		readonly maxWidth: number;
		readonly mergeDownTo: string | null;
		readonly mergeUpTo: string | null;
		readonly widthRange: Range;

		constructor(
			name: string,
			cssClass: string,
			maxWidth: number | null,
			mergeDownTo: string | null,
			mergeUpTo: string | null,
			widthRange: Range,
		) {
			if (!widthRange) {
				throw new Error('{widthRange} required');
			}

			this.name = name;
			this.cssClass = cssClass;
			this.maxWidth = maxWidth;
			this.mergeDownTo = mergeDownTo;
			this.mergeUpTo = mergeUpTo;
			this.widthRange = widthRange;
		}
	}

	export class DeviceList extends IndexedList<Device> {
		readonly byNameOne = new UniqueIndexedListIndex(this, item => item.name);
	}
}
