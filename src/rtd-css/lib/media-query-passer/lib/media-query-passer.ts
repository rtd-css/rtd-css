import { CssValue } from '../../../../core-lib/css-value';
import { ValueInUnits } from '../../../../core-lib/value-in-units';
import { deepClone } from '../../../../core-lib/deep-clone';
import {
	MediaQueryAst,
	MediaQueryOrQueryAst,
	MediaQueryFeatureAst,
	MqRangeFeatureSummaryForUnits,
	MqRangeFeatureSummaryForUnitsType,
} from '../../../../core-lib/media-query';
import {
	BasePassedQuery,
	PassedQuery_Passed,
	PassedQuery_QueryType,
	PassedQueryFactory,
} from './passed-query';

export class PassedMediaQuery extends BasePassedQuery<MediaQueryAst> {}

export class PassedMediaQueryOrQuery extends BasePassedQuery<MediaQueryOrQueryAst> {}

export class MediaQueryPasser {
	passMediaQuery(mediaQueryAst: MediaQueryAst, rangeFeatureSummaryList: MqRangeFeatureSummaryForUnits[]): PassedMediaQuery {
		if (rangeFeatureSummaryList.length !== mediaQueryAst.orQueries.length) {
			throw new Error('{rangeFeatureSummaryList} must has same length as {orQueries} length');
		}

		const passedOrQueryList: PassedMediaQueryOrQuery[] = [];
		const orQueriesLength = rangeFeatureSummaryList.length;
		for (let i = 0; i < orQueriesLength; i++) {
			const rangeFeatureSummary = rangeFeatureSummaryList[i];
			const orQuery = mediaQueryAst.orQueries[i];
			const passedOrQuery = this.passOrQuery(orQuery, rangeFeatureSummary);
			passedOrQueryList.push(passedOrQuery);
		}

		const passedMediaQuery = this.passedOrQueryListToPassedMediaQuery(passedOrQueryList);
		return passedMediaQuery;
	}

	private passOrQuery(
		orQuery: MediaQueryOrQueryAst,
		rangeFeatureSummary: MqRangeFeatureSummaryForUnits,
	): PassedMediaQueryOrQuery {
		let passedOrQuery: PassedMediaQueryOrQuery;
		const passedOrQueryFactory = new PassedQueryFactory<MediaQueryOrQueryAst, PassedMediaQueryOrQuery>(PassedMediaQueryOrQuery);

		switch (rangeFeatureSummary.type) {

			case MqRangeFeatureSummaryForUnitsType.EmptyRange:
				passedOrQuery = passedOrQueryFactory.createNotPassed();
				break;

			case MqRangeFeatureSummaryForUnitsType.NoRange:
			case MqRangeFeatureSummaryForUnitsType.HasRange:
				let passedOrQueryValue: MediaQueryOrQueryAst;

				if (rangeFeatureSummary.type === MqRangeFeatureSummaryForUnitsType.NoRange) {
					passedOrQueryValue = orQuery;
				} else if (rangeFeatureSummary.type === MqRangeFeatureSummaryForUnitsType.HasRange) {
					passedOrQueryValue = deepClone(orQuery);

					const range = rangeFeatureSummary.rangeInUnits.range;
					const rangeStartsWithInfinity = (range.from === Number.NEGATIVE_INFINITY);
					const rangeEndsWithInfinity = (range.to === Number.POSITIVE_INFINITY);

					if (!rangeStartsWithInfinity) {
						passedOrQueryValue.addFeatures(
							new MediaQueryFeatureAst(
								'min',
								'width',
								new CssValue(new ValueInUnits(range.from, rangeFeatureSummary.rangeInUnits.units)),
							),
						);
					}

					if (!rangeEndsWithInfinity) {
						passedOrQueryValue.addFeatures(
							new MediaQueryFeatureAst(
								'max',
								'width',
								new CssValue(new ValueInUnits(range.to, rangeFeatureSummary.rangeInUnits.units)),
							),
						);
					}
				}

				passedOrQuery = passedOrQueryValue.isEmpty()
					? passedOrQueryFactory.createPassedEmpty()
					: passedOrQueryFactory.createPassedNotEmpty(passedOrQueryValue);

				break;

		} // switch

		return passedOrQuery;
	}

	private passedOrQueryListToPassedMediaQuery(
		orQueryList: PassedMediaQueryOrQuery[],
	): PassedMediaQuery {
		let passedMediaQuery: PassedMediaQuery;
		const passedMediaQueryFactory = new PassedQueryFactory<MediaQueryAst, PassedMediaQuery>(PassedMediaQuery);

		const passedOrQueryList = orQueryList.filter(
			orQuery => orQuery.passed === PassedQuery_Passed.Passed,
		);

		if (!passedOrQueryList.length) {
			passedMediaQuery = passedMediaQueryFactory.createNotPassed();
		} else {
			const notEmptyOrQueryList = passedOrQueryList.filter(
				orQuery => orQuery.queryType === PassedQuery_QueryType.NotEmpty,
			);

			if (!notEmptyOrQueryList.length) {
				passedMediaQuery = passedMediaQueryFactory.createPassedEmpty();
			} else {
				passedMediaQuery = passedMediaQueryFactory.createPassedNotEmpty(
					new MediaQueryAst(
						notEmptyOrQueryList.map(orQuery => orQuery.query),
					),
				);
			}
		}

		return passedMediaQuery;
	}
}
