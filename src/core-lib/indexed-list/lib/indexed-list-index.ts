import { IndexedListFriend } from './indexed-list-friend';
import { IndexedList } from './indexed-list';

export abstract class IndexedListIndex<TItem> extends IndexedListFriend<TItem> {
	private _dictByKey: { [key: string]: TItem[] };

	private _keyFunc: (item: TItem) => string;
	private _allowDuplicates: boolean;

	protected constructor(
		indexedList: IndexedList<TItem>,
		keyFunc: (item: TItem) => string,
		allowDuplicates: boolean = false,
	) {
		super(indexedList);

		this._dictByKey = {};

		this._keyFunc = keyFunc;
		this._allowDuplicates = allowDuplicates;

		this._indexedListForFriends._addIndex(this);
	}

	each(callback: (item: TItem) => void): void {
		for (const key in this._dictByKey) {
			const itemsWithSuchKey = this._dictByKey[key];
			for (const item of itemsWithSuchKey) {
				callback(item);
			}
		}
	}

	map<TResultItem>(callback: (item: TItem) => TResultItem): TResultItem[] {
		const result: TResultItem[] = [];
		this.each(item => result.push(callback(item)));
		return result;
	}

	any(): boolean {
		// tslint:disable-next-line:no-unused-variable
		for (const key in this._dictByKey) {
			return true;
		}
		return false;
	}

	first(): TItem {
		for (const key in this._dictByKey) {
			return this._dictByKey[key][0];
		}
		throw new Error('Can not get first item because there are no items');
	}

	protected _getAll(queryKey: string): ReadonlyArray<TItem> {
		if (!this._dictByKey.hasOwnProperty(queryKey)) {
			throw new Error('Items with such key not found');
		}
		return this._dictByKey[queryKey];
	}

	protected _removeAll(queryKey: string): void {
		if (!queryKey) {
			throw new Error('{key} required');
		}

		const itemsWithSuchKey = this._dictByKey[queryKey];
		if (!itemsWithSuchKey) {
			throw new Error('Items with such key not found');
		}

		this._indexedList.remove(...itemsWithSuchKey);
	}

	// Friends method
	// tslint:disable-next-line:no-unused-variable
	private _add(...items: TItem[]): void {
		for (const curItem of items) {
			if (!curItem) {
				throw new Error('{item} required');
			}

			const key = this._keyFunc(curItem);
			if (!key) {
				throw new Error('{key} required');
			}

			let itemsWithSuchKey: TItem[] = this._dictByKey[key];
			if (!itemsWithSuchKey) {
				itemsWithSuchKey = [];
				this._dictByKey[key] = itemsWithSuchKey;
			}

			if (!this._allowDuplicates && itemsWithSuchKey.length) {
				throw new Error('Duplicates not allowed');
			}

			itemsWithSuchKey.push(curItem);
		}
	}

	// Friends method
	// tslint:disable-next-line:no-unused-variable
	private _remove(...items: TItem[]): void {
		for (const curItem of items) {
			if (!curItem) {
				throw new Error('{item} required');
			}

			const key = this._keyFunc(curItem);
			if (!key) {
				throw new Error('{key} required');
			}

			const itemsWithSuchKey: TItem[] = this._dictByKey[key];
			let curItemIndex: number;
			if (
				!itemsWithSuchKey ||
				(curItemIndex = itemsWithSuchKey.findIndex(_item => this._keyFunc(_item) === key)) < 0
			) {
				throw new Error('Can not remove item with such key because such item not found');
			}

			itemsWithSuchKey.splice(curItemIndex, 1);
			if (!itemsWithSuchKey.length) {
				delete this._dictByKey[key];
			}
		}
	}
}
