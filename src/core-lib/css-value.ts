import { ValueInUnits } from './value-in-units';

export class CssValue {
	value: string;
	valueInUnits: ValueInUnits;

	constructor(value: string | ValueInUnits) {
		if (typeof value === 'string') {
			const stringValue = <string>value;
			this.value = stringValue;
			this.valueInUnits = CssValue.tryParseValueInUnits(stringValue);
		} else if (value instanceof ValueInUnits) {
			const valueInUnits = <ValueInUnits>value;
			this.value = `${valueInUnits.value}${valueInUnits.units}`;
			this.valueInUnits = valueInUnits;
		} else if (!value) {
			this.value = null;
			this.valueInUnits = null;
		} else {
			throw new Error('{value} has invalid type');
		}
	}

	static parseValueInUnits(value: string): ValueInUnits {
		if (typeof value !== 'string') {
			throw new Error('{value} must be a string');
		}

		let valueInUnits: ValueInUnits;
		const normalizedValue = value.trim();
		let matchResult: RegExpMatchArray;

		if (
			(matchResult = normalizedValue.match(/(\d*\.?\d+)([a-z]+)/))
			&& matchResult[0] === matchResult.input
		) {
			valueInUnits = new ValueInUnits(
				Number(matchResult[1]),
				matchResult[2],
			);
		} else if (
			(matchResult = normalizedValue.match(/^[+-]?\d+(\.\d+)?$/))
		) {
			valueInUnits = new ValueInUnits(
				Number(normalizedValue),
			);
		} else {
			throw new Error('Invalid {value}');
		}

		return valueInUnits;
	}

	static tryParseValueInUnits(value: string): ValueInUnits | null {
		let valueInUnits: ValueInUnits;
		try {
			valueInUnits = CssValue.parseValueInUnits(value);
		} catch (e) {
			valueInUnits = null;
		}
		return valueInUnits;
	}
}
