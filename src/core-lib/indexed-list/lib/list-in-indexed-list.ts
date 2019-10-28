import { IndexedListFriend } from './indexed-list-friend';
import { IndexedList } from './indexed-list';

export class ListInIndexedList<TItem> extends IndexedListFriend<TItem> {
	private _list: TItem[];

	constructor(indexedList: IndexedList<TItem>) {
		super(indexedList);

		this._list = [];
	}

	each(callback: (item: TItem) => void): void {
		for (const item of this._list) {
			callback(item);
		}
	}

	_add(...items: TItem[]): void {
		for (const curItem of items) {
			if (!curItem) {
				throw new Error('{item} required');
			}

			this._list.push(curItem);
		}
	}

	_remove(...items: TItem[]): void {
		for (const curItem of items) {
			if (!curItem) {
				throw new Error('{item} required');
			}

			const curItemIndex = this._list.indexOf(curItem);
			if (curItemIndex < 0) {
				throw new Error('Can not remove item because such item not found');
			}

			this._list.splice(curItemIndex, 1);
		}
	}
}
