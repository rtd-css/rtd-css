import { ObjectDictionary } from './dictionary-types';

export module DictionaryUtils {
	export function getValues<TDictionaryValue>(dictionary: ObjectDictionary<TDictionaryValue>): TDictionaryValue[] {
		const values: TDictionaryValue[] = [];

		for (const key in dictionary) {
			values.push(dictionary[key]);
		}

		return values;
	}
}
