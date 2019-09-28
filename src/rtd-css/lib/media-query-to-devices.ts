import { Selector, parse, stringify } from 'css-what';
import { IndexedList, UniqueIndexedListIndex } from '../../core-lib/indexed-list';
import { ConfigModule } from './config';
import { InputProjectionBuilder } from './input-projection';
import { OutputProjectionBuilder } from './output-projection';
import { DeviceMediaQuery } from './device-media-query';

export module MediaQueryToDevices {

	export function mediaQueryToDeviceMediaQueries(
		config: ConfigModule.Config,
		mediaQuery: string,
	): DeviceMediaQueryIndexedList {
		if (!config) {
			throw new Error('{config} required');
		}

		if (!mediaQuery) {
			throw new Error('{mediaQuery} required');
		}

		const inputProjection = new InputProjectionBuilder(config, mediaQuery).createInputProjection();
		const outputProjection = new OutputProjectionBuilder(config, inputProjection).createOutputProjection();

		const result = new DeviceMediaQueryIndexedList();
		result.add(...outputProjection.deviceOutputList);

		return result;
	}

	export function addDeviceFilteringToSelector(selector: string, deviceCssClass: string): string {
		const parsedSelector = parse(selector);

		for (const subSelector of parsedSelector) {
			const firstToken = subSelector[0];
			const deviceClassToken = <Selector>{
				type: 'attribute',
				name: 'class',
				action: 'element',
				value: deviceCssClass,
				ignoreCase: false,
			};

			if (firstToken.type === 'tag' && firstToken.name && firstToken.name.toLowerCase() === 'html') {
				subSelector.splice(1, 0, deviceClassToken);
			} else {
				const htmlTagToken = <Selector>{
					type: 'tag',
					name: 'html',
				};

				const descendantCombinatorToken = <Selector>{
					type: 'descendant',
				};

				subSelector.splice(0, 0, htmlTagToken, deviceClassToken, descendantCombinatorToken);
			}
		}

		return stringify(parsedSelector);
	}

	export class DeviceMediaQueryIndexedList extends IndexedList<DeviceMediaQuery> {
		readonly byDeviceNameOne = new UniqueIndexedListIndex<DeviceMediaQuery>(this, item => item.device.name);
	}

}
