import { IOption } from './i-option';
import { IndexedList, NonUniqueIndexedListIndex } from '../../indexed-list';

export abstract class BaseOptionIndexedList<TOption extends IOption> extends IndexedList<TOption> {
	readonly byNameMany = new NonUniqueIndexedListIndex<TOption>(this, option => option.name);
}
