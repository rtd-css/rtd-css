import { RawOptionsDataToDataTransformer } from './logic/raw-options-data-to-data-transformer';
import { StringToTokensDataTransformer } from './logic/string-to-tokens-data-transformer';
import { TokensDataToRawOptionsDataTransformer } from './logic/tokens-data-to-raw-options-data-transformer';
import { DataSchema as DataSchema_ } from './data/data-schema';

export module OptionsParser {
	export function parse<TResult>(string: string, schema: DataSchema_): TResult {
		const tokensData = new StringToTokensDataTransformer().transform(string);
		const rawOptionsData = new TokensDataToRawOptionsDataTransformer().transform(tokensData);
		const data = new RawOptionsDataToDataTransformer().transform(rawOptionsData, schema);

		return data;
	}

	export class DataSchema extends DataSchema_ {}
}
