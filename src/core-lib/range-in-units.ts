import { Range } from './range';

export class RangeInUnits {
	readonly range: Range;
	readonly units: string;

	constructor(range: Range, units: string) {
		this.range = range;
		this.units = units;
	}
}
