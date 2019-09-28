import { CssValue } from './css-value';
import { Range } from './range';
import { RangeInUnits } from './range-in-units';
import { StringBuilder } from './string-builder';
import { MediaQueryParser, LibraryMediaQueryAst } from './media-query-parser';

export class MediaQueryAst {
	private _orQueries: MediaQueryOrQueryAst[];
	get orQueries(): ReadonlyArray<MediaQueryOrQueryAst> {
		return this._orQueries;
	}

	constructor(orQueries: MediaQueryOrQueryAst[] = null) {
		this._orQueries = [];
		if (orQueries) {
			this._orQueries.push(...orQueries);
		}
	}

	addOrQueries(...orQueries: MediaQueryOrQueryAst[]): void {
		this._orQueries.push(...orQueries);
	}

	removeRangeFeaturesInUnits(featureName: string, units: string): void {
		for (const orQuery of this._orQueries) {
			orQuery.removeRangeFeaturesInUnits(featureName, units);
		}
	}
}

export class MediaQueryOrQueryAst {
	inverse: boolean;
	type: string;

	private _features: MediaQueryFeatureAst[];
	get features(): ReadonlyArray<MediaQueryFeatureAst> {
		return this._features;
	}

	constructor(
		inverse: boolean = null,
		type: string = null,
		features: MediaQueryFeatureAst[] = null,
	) {
		this.inverse = inverse;
		this.type = type;
		this._features = [];
		if (features) {
			this._features.push(...features);
		}
	}

	isEmpty(): boolean {
		return !this.type && (this._features.length === 0);
	}

	addFeatures(...features: MediaQueryFeatureAst[]): void {
		this._features.push(...features);
	}

	removeRangeFeaturesInUnits(featureName: string, units: string): void {
		this._features = this._features.filter(feature => !feature.isRangeFeatureInUnits(featureName, units));
	}
}

export class MediaQueryFeatureAst {
	modifier: string;
	name: string;
	value: CssValue;

	constructor(
		modifier: string = null,
		name: string = null,
		value: CssValue = null,
	) {
		this.modifier = modifier;
		this.name = name;
		this.value = value;
	}

	isRangeFeatureInUnits(featureName: string, units: string): boolean {
		return this.name === featureName
			&& (this.modifier === 'min' || this.modifier === 'max')
			&& (this.value.valueInUnits && this.value.valueInUnits.units === units);
	}
}

export enum MqRangeFeatureSummaryForUnitsType {
	NoRange = 'NoRange',
	EmptyRange = 'EmptyRange',
	HasRange = 'HasRange',
}

export class MqRangeFeatureSummaryForUnits {
	featureName: string;
	type: MqRangeFeatureSummaryForUnitsType;
	rangeInUnits: RangeInUnits;

	static createNoRange(featureName: string): MqRangeFeatureSummaryForUnits {
		MqRangeFeatureSummaryForUnits.validateFeatureName(featureName);

		const result = new MqRangeFeatureSummaryForUnits();
		result.featureName = featureName;
		result.type = MqRangeFeatureSummaryForUnitsType.NoRange;

		return result;
	}

	static createEmptyRange(featureName: string): MqRangeFeatureSummaryForUnits {
		MqRangeFeatureSummaryForUnits.validateFeatureName(featureName);

		const result = new MqRangeFeatureSummaryForUnits();
		result.featureName = featureName;
		result.type = MqRangeFeatureSummaryForUnitsType.EmptyRange;

		return result;
	}

	static createHasRange(
		featureName: string,
		rangeInUnits: RangeInUnits,
	): MqRangeFeatureSummaryForUnits {
		MqRangeFeatureSummaryForUnits.validateFeatureName(featureName);

		const result = new MqRangeFeatureSummaryForUnits();
		result.featureName = featureName;
		result.type = MqRangeFeatureSummaryForUnitsType.HasRange;
		result.rangeInUnits = rangeInUnits;

		return result;
	}

	static createHasRangeWithRangeAndUnits(
		featureName: string,
		range: Range,
		units: string,
	): MqRangeFeatureSummaryForUnits {
		return MqRangeFeatureSummaryForUnits.createHasRange(
			featureName,
			new RangeInUnits(
				range,
				units,
			),
		);
	}

	private static validateFeatureName(featureName: string): void {
		if (!featureName) {
			throw new Error('{featureName} required');
		}
	}
}

export class MediaQuery {
	mediaQueryAst: MediaQueryAst;

	constructor(mediaQuery: string | MediaQueryAst) {
		if (typeof mediaQuery === 'string') {
			this.initFromMediaQueryString(mediaQuery);
		} else if (mediaQuery instanceof MediaQueryAst) {
			this.initFromMediaQueryAst(mediaQuery);
		} else {
			throw new Error('{mediaQuery} has invalid type');
		}
	}

	stringify(): string {
		const stringBuilder = new StringBuilder();
		const notEmptyOrQueryList = this.mediaQueryAst.orQueries.filter(orQuery => !orQuery.isEmpty());

		for (const orQuery of notEmptyOrQueryList) {
			stringBuilder.addIfNotEmpty(', ');

			if (orQuery.type) {
				if (orQuery.inverse) {
					stringBuilder.addSpaceIfNotEmpty();
					stringBuilder.add('not');
				}
				stringBuilder.addSpaceIfNotEmpty();
				stringBuilder.add(orQuery.type);
			}

			for (const feature of orQuery.features) {
				stringBuilder.addIfNotEmpty(' and ');
				stringBuilder.add('(');
				if (feature.modifier) {
					stringBuilder.add(`${feature.modifier}-`);
				}
				stringBuilder.add(feature.name);
				if (feature.value.value) {
					stringBuilder.add(': ');
					stringBuilder.add(feature.value.value);
				}
				stringBuilder.add(')');
			}
		}

		const result = stringBuilder.stringify();
		return result;
	}

	getRangeFeatureSummaries(featureName: string, units: string): MqRangeFeatureSummaryForUnits[] {
		const rangeFeatureSummaryList = this.mediaQueryAst.orQueries.map(
			(orQuery) => {
				const ranges = orQuery.features
					.filter(feature => feature.isRangeFeatureInUnits(featureName, units))
					.map(
						(feature) => {
							let range: Range;
							const value = feature.value.valueInUnits.value;
							if (feature.modifier === 'min') {
								range = new Range(value, Infinity);
							} else {
								range = new Range(-Infinity, value);
							}
							return range;
						},
					);

				let rangeFeatureSummary: MqRangeFeatureSummaryForUnits;
				if (ranges.length === 0) {
					rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createNoRange(featureName);
				} else if (ranges.length === 1) {
					rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits(featureName, ranges[0], units);
				} else {
					const totalRange = Range.intersect(...ranges);
					if (totalRange) {
						rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits(featureName, totalRange, units);
					} else {
						rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createEmptyRange(featureName);
					}
				}
				return rangeFeatureSummary;
			},
		);

		return rangeFeatureSummaryList;
	}

	getRangeFeatureSummariesAndRemove(featureName: string, units: string): MqRangeFeatureSummaryForUnits[] {
		const result = this.getRangeFeatureSummaries(featureName, units);
		this.mediaQueryAst.removeRangeFeaturesInUnits(featureName, units);
		return result;
	}

	private initFromMediaQueryString(mediaQueryString: string): void {
		const mediaQueryParser = new MediaQueryParser();
		const libraryMediaQueryAst = mediaQueryParser.parse(mediaQueryString);

		this.mediaQueryAst = this.libAstToAst(libraryMediaQueryAst);
	}

	private initFromMediaQueryAst(mediaQueryAst: MediaQueryAst): void {
		this.mediaQueryAst = mediaQueryAst;
	}

	private libAstToAst(libAst: LibraryMediaQueryAst.MediaQueryAst): MediaQueryAst {
		const ast = new MediaQueryAst();

		ast.addOrQueries(
			...libAst.orQueries.map(
				(orQuery) => {
					const outOrQuery = new MediaQueryOrQueryAst();
					outOrQuery.inverse = orQuery.inverse;
					outOrQuery.type = orQuery.type;
					outOrQuery.addFeatures(
						...orQuery.expressions.map(
							(feature) => {
								const outFeature = new MediaQueryFeatureAst();
								outFeature.modifier = feature.modifier;
								outFeature.name = feature.feature;
								outFeature.value = new CssValue(feature.value);
								return outFeature;
							},
						),
					);
					return outOrQuery;
				},
			),
		);

		return ast;
	}

	private astToLibAst(ast: MediaQueryAst): LibraryMediaQueryAst.MediaQueryAst {
		const libAst = <LibraryMediaQueryAst.MediaQueryAst>{
			orQueries: ast.orQueries.map(
				(orQuery) => {
					const outOrQuery = <LibraryMediaQueryAst.MediaQueryOrQueryAst>{
						inverse: orQuery.inverse,
						type: orQuery.type,
						expressions: orQuery.features.map(
							(feature) => {
								const outFeature = <LibraryMediaQueryAst.MediaQueryFeatureAst>{
									modifier: feature.modifier,
									feature: feature.name,
									value: feature.value.value,
								};

								return outFeature;
							},
						),
					};

					return outOrQuery;
				},
			),
		};

		return libAst;
	}
}
