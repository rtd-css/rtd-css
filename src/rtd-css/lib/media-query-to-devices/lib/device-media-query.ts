import { ConfigModule } from '../../config';
import { PassedMediaQuery } from '../../media-query-passer';

export class DeviceMediaQuery {
	readonly device: ConfigModule.Device;
	readonly passedMediaQuery: PassedMediaQuery;

	constructor(device: ConfigModule.Device, passedMediaQuery: PassedMediaQuery) {
		this.device = device;
		this.passedMediaQuery = passedMediaQuery;
	}
}
