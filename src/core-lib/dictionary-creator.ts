import { Dictionary } from './dictionary';
import { ObjectDictionary } from './dictionary-types';
import { NotImplementedError } from './not-implemented-error';

export module DictionaryCreator {
	enum Target {
		Dictionary = 'Dictionary',
		Object = 'Object',
		Map = 'Map',
	}

	type TargetDictionary<TDictionaryValue> =
		| Dictionary<TDictionaryValue>
		| ObjectDictionary<TDictionaryValue>
		| Map<string, TDictionaryValue>;

	function createFromArrayEx<TDictionaryValue, TArrayItem>(
		target: Target,
		array: TArrayItem[],
		keySelector: (item: TArrayItem) => string,
		valueSelector: (item: TArrayItem) => TDictionaryValue,
	): TargetDictionary<TDictionaryValue> {
		let dictionary: Dictionary<TDictionaryValue> = null;
		let object: ObjectDictionary<TDictionaryValue> = null;
		let map: Map<string, TDictionaryValue> = null;

		if (target === Target.Dictionary) {
			dictionary = new Dictionary<TDictionaryValue>();
		} else if (target === Target.Object) {
			object = {};
		} else if (target === Target.Map) {
			map = new Map<string, TDictionaryValue>();
		} else {
			throw new NotImplementedError();
		}

		for (const item of array) {
			const key = keySelector(item);
			const value = valueSelector(item);

			if (target === Target.Dictionary) {
				dictionary.add(key, value);
			} else if (target === Target.Object) {
				object[key] = value;
			} else if (target === Target.Map) {
				map.set(key, value);
			} else {
				throw new NotImplementedError();
			}
		}

		if (target === Target.Dictionary) {
			return dictionary;
		}
		if (target === Target.Object) {
			return object;
		}
		if (target === Target.Map) {
			return map;
		}
		throw new NotImplementedError();
	}

	export function createDictionaryFromArray<TDictionaryValue, TArrayItem>(
		array: TArrayItem[],
		keySelector: (item: TArrayItem) => string,
		valueSelector: (item: TArrayItem) => TDictionaryValue,
	): Dictionary<TDictionaryValue> {
		return <Dictionary<TDictionaryValue>>createFromArrayEx(Target.Dictionary, array, keySelector, valueSelector);
	}

	export function createObjectFromArray<TDictionaryValue, TArrayItem>(
		array: TArrayItem[],
		keySelector: (item: TArrayItem) => string,
		valueSelector: (item: TArrayItem) => TDictionaryValue,
	): ObjectDictionary<TDictionaryValue> {
		return <ObjectDictionary<TDictionaryValue>>createFromArrayEx(Target.Object, array, keySelector, valueSelector);
	}

	export function createMapFromArray<TDictionaryValue, TArrayItem>(
		array: TArrayItem[],
		keySelector: (item: TArrayItem) => string,
		valueSelector: (item: TArrayItem) => TDictionaryValue,
	): Map<string, TDictionaryValue> {
		return <Map<string, TDictionaryValue>>createFromArrayEx(Target.Map, array, keySelector, valueSelector);
	}
}
