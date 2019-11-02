import { IndexedList, UniqueIndexedListIndex } from '../../../../core-lib/indexed-list';
import { ConfigModule } from '../../config';
import { InputProjectionBuilder } from './input-projection';
import { OutputProjectionBuilder } from './output-projection';
import { DeviceMediaQuery } from './device-media-query';

export class MediaQueryToDevicesCompiler {
	mediaQueryToDeviceMediaQueries(
		config: ConfigModule.Config,
		mediaQuery: string,
	): MediaQueryToDevicesCompiler.DeviceMediaQueryIndexedList {
		if (!config) {
			throw new Error('{config} required');
		}

		if (!mediaQuery) {
			throw new Error('{mediaQuery} required');
		}

		const inputProjection = new InputProjectionBuilder(config, mediaQuery).createInputProjection();
		const outputProjection = new OutputProjectionBuilder(config, inputProjection).createOutputProjection();

		const result = new MediaQueryToDevicesCompiler.DeviceMediaQueryIndexedList();
		result.add(...outputProjection.deviceOutputList);

		return result;
	}
}

export module MediaQueryToDevicesCompiler {
	export class DeviceMediaQueryIndexedList extends IndexedList<DeviceMediaQuery> {
		readonly byDeviceNameOne = new UniqueIndexedListIndex<DeviceMediaQuery>(this, item => item.device.name);
	}
}
