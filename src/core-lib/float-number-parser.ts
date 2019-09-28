export module FloatNumberParser {
	const floatNumberRegEx = /^[+-]?\d+(\.\d+)?$/;

	export function parse(string: string): number {
		if (typeof string !== 'string') {
			throw new Error('{string} must be a string');
		}

		if (!string.match(floatNumberRegEx)) {
			throw new Error('Can not parse float number from string');
		}

		const floatNumber = Number(string);
		return floatNumber;
	}

	export function tryParse(string: string): number {
		let floatNumber: number;

		try {
			floatNumber = parse(string);
		} catch (e) {
			floatNumber = null;
		}

		return floatNumber;
	}
}
