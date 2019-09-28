import { IndexedList } from './indexed-list';
import { IndexedListIndex } from './indexed-list-index';

export class NonUniqueIndexedListIndex<TItem> extends IndexedListIndex<TItem> {
	constructor(
		indexedList: IndexedList<TItem>,
		keyFunc: (item: TItem) => string,
	) {
		super(
			indexedList,
			keyFunc,
			true,
		);
	}

	getAll(queryKey: string): ReadonlyArray<TItem> {
		return this._getAll(queryKey);
	}

	removeAll(queryKey: string): void {
		this._removeAll(queryKey);
	}
}
