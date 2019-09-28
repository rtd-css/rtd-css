import { IndexedListIndex } from './indexed-list-index';

export interface IndexedListForFriends<TItem> {
	_addIndex(index: IndexedListIndex<TItem>): void;
}
