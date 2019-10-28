export class Dictionary<TDictionaryValue> {
	private _dict: { [key: string]: TDictionaryValue };

	constructor() {
		this._dict = {};
	}

	has(key: string): boolean {
		const hasItem = this._dict.hasOwnProperty(key);
		return hasItem;
	}

	add(key: string, value: TDictionaryValue): void {
		const hasItem = this._dict.hasOwnProperty(key);
		if (hasItem) {
			throw new Error(`Item with key "${key}" already added to dictionary`);
		}

		this.set(key, value);
	}

	set(key: string, value: TDictionaryValue): void {
		this._dict[key] = value;
	}

	get(key: string): TDictionaryValue {
		const hasItem = this._dict.hasOwnProperty(key);
		if (!hasItem) {
			throw new Error(`Item with key "${key}" not found in dictionary`);
		}

		return this._dict[key];
	}

	getIfExists(key: string): TDictionaryValue {
		const hasItem = this._dict.hasOwnProperty(key);
		return hasItem ? this._dict[key] : null;
	}
}
