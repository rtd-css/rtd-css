export class BaseReadonlyArray<TItem> {
	private readonly _items: TItem[];
	get items(): TItem[] {
		return this._items;
	}

	constructor(...items: TItem[] | TItem[][]) {
		this._items = [];
		for (const itemOrItemArray of items) {
			if (Array.isArray(itemOrItemArray)) {
				this._items.push(...(itemOrItemArray as TItem[]));
			} else {
				this._items.push(itemOrItemArray as TItem);
			}
		}
	}
}
