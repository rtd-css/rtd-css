import { IndexedListIndex } from './indexed-list-index';
import { IndexedListIndexForFriends } from './indexed-list-index-for-friends';

export class IndexedList<TItem> {
	private _indices: IndexedListIndex<TItem>[];
	private _indicesForFriends: IndexedListIndexForFriends<TItem>[];

	constructor() {
		this._indices = [];
		this._indicesForFriends = [];
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
	}

	remove(...items: TItem[]): void {
		for (const index of this._indicesForFriends) {
			index._remove(...items);
		}
	}

	// Friends method
	private _addIndex(index: IndexedListIndex<TItem>): void {
		this._indices.push(index);
		this._indicesForFriends.push((index as any) as IndexedListIndexForFriends<TItem>);
	}
}
