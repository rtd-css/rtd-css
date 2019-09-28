import { IndexedList } from './indexed-list';
import { IndexedListIndex } from './indexed-list-index';

export class UniqueIndexedListIndex<TItem> extends IndexedListIndex<TItem> {
	constructor(
		indexedList: IndexedList<TItem>,
		keyFunc: (item: TItem) => string,
	) {
		super(
			indexedList,
			keyFunc,
			false,
		);
	}

	get(queryKey: string): TItem {
		return this._getAll(queryKey)[0];
	}

	remove(queryKey: string): void {
		this._removeAll(queryKey);
	}
}
