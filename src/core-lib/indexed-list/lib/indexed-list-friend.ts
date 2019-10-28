import { IndexedList } from './indexed-list';
import { IndexedListForFriends } from './indexed-list-for-friends';

export class IndexedListFriend<TItem> {
	protected _indexedList: IndexedList<TItem>;
	protected _indexedListForFriends: IndexedListForFriends<TItem>;

	constructor(indexedList: IndexedList<TItem>) {
		this._indexedList = indexedList;
		this._indexedListForFriends = (indexedList as any) as IndexedListForFriends<TItem>;
	}
}
