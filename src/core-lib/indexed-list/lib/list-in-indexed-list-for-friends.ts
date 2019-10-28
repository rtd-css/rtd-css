export interface ListInIndexedListForFriends<TItem> {
	_add(...items: TItem[]): void;
	_remove(...items: TItem[]): void;
}
