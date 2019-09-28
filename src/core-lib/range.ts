export class Range {
	readonly from: number;
	readonly to: number;

	constructor(from: number, to: number) {
		let normalizedFrom = from;
		if (normalizedFrom === null) {
			normalizedFrom = -Infinity;
		}

		let normalizedTo = to;
		if (normalizedTo === null) {
			normalizedTo = Infinity;
		}

		if (normalizedFrom > normalizedTo) {
			throw new Error('{from} must be less than or equal to {to}');
		}

		this.from = normalizedFrom;
		this.to = normalizedTo;
	}

	static intersect(...rangeList: Range[]): Range {
		if (rangeList.length < 2) {
			throw new Error('Number of input ranges must be greater than or equal to 2');
		}

		for (const range in rangeList) {
			if (!range) {
				throw new Error('All ranges must be not null');
			}
		}

		let result = rangeList[0];
		for (let i = 1; i < rangeList.length;) {
			result = Range.intersectTwoRanges(result, rangeList[i]);
			if (!result) {
				break;
			}
			i = i + 1;
		}

		return result;
	}

	static intersectTwoRanges(range1: Range, range2: Range): Range {
		if (!range1 || !range2) {
			throw new Error('{range1} and {range2} required');
		}

		let result: Range;

		if (range2.from > range1.to || range1.from > range2.to) {
			result = null;
		} else {
			result = new Range(
				Math.max(range1.from, range2.from),
				Math.min(range1.to, range2.to),
			);
		}

		return result;
	}
}
