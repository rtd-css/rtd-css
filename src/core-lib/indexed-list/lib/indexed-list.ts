import { IndexedListIndex } from './indexed-list-index';
import { IndexedListIndexForFriends } from './indexed-list-index-for-friends';
import { ListInIndexedList } from './list-in-indexed-list';
import { ListInIndexedListForFriends } from './list-in-indexed-list-for-friends';

export class IndexedList<TItem> {
	private _indices: IndexedListIndex<TItem>[];
	private _indicesForFriends: IndexedListIndexForFriends<TItem>[];

	private _list: ListInIndexedList<TItem>;
	private _listForFriends: ListInIndexedListForFriends<TItem>;
	get list(): ListInIndexedList<TItem> {
		return this._list;
	}

	constructor() {
		this._indices = [];
		this._indicesForFriends = [];

		this._list = new ListInIndexedList<TItem>(this);
		this._listForFriends = (this._list as any) as ListInIndexedListForFriends<TItem>;
	}

	each(callback: (item: TItem) => void): void {
		this._indices[0].each(callback);
	}

	map<TResultItem>(callback: (item: TItem) => TResultItem): TResultItem[] {
		return this._indices[0].map(callback);
	}

	any(): boolean {
		return this._indices[0].any();
	}

	first(): TItem {
		return this._indices[0].first();
	}

	add(...items: TItem[]): void {
		for (const index of this._indicesForFriends) {
			index._add(...items);
		}

		this._listForFriends._add(...items);
	}

	remove(...items: TItem[]): void {
		for (const index of this._indicesForFriends) {
			index._remove(...items);
		}

		this._listForFriends._remove(...items);
	}

	// Friends method
	private _addIndex(index: IndexedListIndex<TItem>): void {
		this._indices.push(index);
		this._indicesForFriends.push((index as any) as IndexedListIndexForFriends<TItem>);
	}
}
