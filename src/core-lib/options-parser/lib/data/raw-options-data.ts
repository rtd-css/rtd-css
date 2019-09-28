import { BaseOptionIndexedList } from '../base-option-indexed-list';

export class RawOptionsData {
	rawOptions: RawOptionsData.RawOptionIndexedList;

	constructor() {
		this.rawOptions = new RawOptionsData.RawOptionIndexedList();
	}
}

export module RawOptionsData {

	export enum ValueType {
		Null = 'Null',
		String = 'String',
		Float = 'Float',
	}

	export class RawValue {
		type: ValueType;
		value: any;

		constructor(
			type: ValueType,
			value: any,
		) {
			this.type = type;
			this.value = value;
		}
	}

	export class BaseRawOption {
		name: string;
		rawValues: RawValue[];

		constructor(name: string) {
			this.name = name;
			this.rawValues = [];
		}
	}

	export class RawOption extends BaseRawOption {
		rawSubOptions: RawSubOptionIndexedList;

		constructor(name: string) {
			super(name);
			this.rawSubOptions = new RawSubOptionIndexedList();
		}
	}

	export class RawSubOption extends BaseRawOption {}

	export class BaseRawOptionIndexedList<TRawOption extends BaseRawOption>
		extends BaseOptionIndexedList<TRawOption> {}

	export class RawOptionIndexedList extends BaseRawOptionIndexedList<RawOption> {}

	export class RawSubOptionIndexedList extends BaseRawOptionIndexedList<RawSubOption> {}

}
