import { deepClone } from '../../core-lib/deep-clone';
import {
	MediaQuery,
	MqRangeFeatureSummaryForUnits,
	MqRangeFeatureSummaryForUnitsType,
} from '../../core-lib/media-query';
import { Range } from '../../core-lib/range';
import { ConfigModule } from './config';
import { MediaQueryPasser, PassedMediaQuery } from './media-query-passer';
import { InputProjection } from './input-projection';

export class OutputProjection {
	mediaQueryWithoutWidths: MediaQuery;
	deviceOutputList: OutputProjection.DeviceOutput[];
}

export module OutputProjection {

	export class DeviceOutput {
		device: ConfigModule.Device;
		passedMediaQuery: PassedMediaQuery;
	}

}

export class OutputProjectionBuilder {
	private readonly _config: ConfigModule.Config;
	private readonly _inputProjection: InputProjection;
	private _outputProjection: OutputProjection;

	constructor(config: ConfigModule.Config, inputProjection: InputProjection) {
		if (!config) {
			throw new Error('{config} required');
		}

		if (!inputProjection) {
			throw new Error('{input} required');
		}

		this._config = config;
		this._inputProjection = inputProjection;
		this.computeOutput();
	}

	createOutputProjection(): OutputProjection {
		return deepClone(this._outputProjection);
	}

	private computeOutput(): void {
		this._outputProjection = new OutputProjection();
		this._outputProjection.mediaQueryWithoutWidths = deepClone(this._inputProjection.mediaQueryWithoutWidths);
		this._outputProjection.deviceOutputList = this.computeDeviceOutputList();
	}

	private computeDeviceOutputList(): OutputProjection.DeviceOutput[] {
		const deviceOutputList = this._config.deviceList.map(
			(device) => {
				const deviceOutput = this.computeDeviceOutput(device);
				return deviceOutput;
			},
		);

		return deviceOutputList;
	}

	private computeDeviceOutput(device: ConfigModule.Device): OutputProjection.DeviceOutput {
		const deviceOutput = new OutputProjection.DeviceOutput();
		deviceOutput.device = device;

		const mediaQueryPasser = new MediaQueryPasser();
		const mediaQueryAst = this._outputProjection.mediaQueryWithoutWidths.mediaQueryAst;
		const widths = this._inputProjection.widths.map(width => this.applyWidthToDevice(device, width));
		deviceOutput.passedMediaQuery = mediaQueryPasser.passMediaQuery(mediaQueryAst, widths);

		return deviceOutput;
	}

	private applyWidthToDevice(
		device: ConfigModule.Device,
		width: MqRangeFeatureSummaryForUnits,
	): MqRangeFeatureSummaryForUnits {
		let outputWidth: MqRangeFeatureSummaryForUnits;

		if (
			width.type === MqRangeFeatureSummaryForUnitsType.NoRange
			|| width.type === MqRangeFeatureSummaryForUnitsType.EmptyRange
		) {
			outputWidth = width;
		} else if (width.type === MqRangeFeatureSummaryForUnitsType.HasRange) {
			let outputWidthRange = Range.intersect(
				width.rangeInUnits.range,
				device.widthRange,
			);

			if (!outputWidthRange) {
				outputWidth = MqRangeFeatureSummaryForUnits.createEmptyRange('width');
			} else {
				outputWidthRange = new Range(
					(outputWidthRange.from !== device.widthRange.from)
						? outputWidthRange.from
						: -Infinity,
					(outputWidthRange.to !== device.widthRange.to)
						? outputWidthRange.to
						: Infinity,
				);

				outputWidth = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits('width', outputWidthRange, this._config.units);
			}
		}

		return outputWidth;
	}
}
