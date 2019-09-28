export enum PassedQuery_Passed {
	NotPassed = 'NotPassed',
	Passed = 'Passed',
}

export enum PassedQuery_QueryType {
	Empty = 'Empty',
	NotEmpty = 'NotEmpty',
}

export abstract class BasePassedQuery<TQuery> {
	passed: PassedQuery_Passed;
	queryType: PassedQuery_QueryType;
	query: TQuery;
}

export class PassedQueryFactory<TQuery, TPassedQuery extends BasePassedQuery<TQuery>> {
	constructor(
		private passedQueryConstructor: new () => TPassedQuery,
	) {}

	createNotPassed(): TPassedQuery {
		const result = new this.passedQueryConstructor();
		result.passed = PassedQuery_Passed.NotPassed;
		result.queryType = null;
		result.query = null;
		return result;
	}

	createPassedEmpty(): TPassedQuery {
		const result = new this.passedQueryConstructor();
		result.passed = PassedQuery_Passed.Passed;
		result.queryType = PassedQuery_QueryType.Empty;
		result.query = null;
		return result;
	}

	createPassedNotEmpty(query: TQuery): TPassedQuery {
		const result = new this.passedQueryConstructor();
		result.passed = PassedQuery_Passed.Passed;
		result.queryType = PassedQuery_QueryType.NotEmpty;
		result.query = query;
		return result;
	}
}
