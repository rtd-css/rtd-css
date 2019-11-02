import { MediaQuery, MqRangeFeatureSummaryForUnits } from '../../../../core-lib/media-query';
import { ConfigModule } from '../../config';

export class InputProjection {
	mediaQueryWithoutWidths: MediaQuery;
	widths: MqRangeFeatureSummaryForUnits[];
}

export class InputProjectionBuilder {
	private readonly _config: ConfigModule.Config;
	private readonly _mediaQueryString: string;

	constructor(config: ConfigModule.Config, mediaQueryString: string) {
		this._config = config;
		this._mediaQueryString = mediaQueryString;
	}

	createInputProjection(): InputProjection {
		const mediaQuery = new MediaQuery(this._mediaQueryString);
		const widths = mediaQuery.getRangeFeatureSummariesAndRemove('width', this._config.units);

		const inputProjection = new InputProjection();
		inputProjection.mediaQueryWithoutWidths = mediaQuery;
		inputProjection.widths = widths;

		return inputProjection;
	}
}
