import { deepClone } from '../../../deep-clone';
import { NotImplementedError } from '../../../not-implemented-error';
import { RawOptionsData } from '../data/raw-options-data';
import { DataSchema } from '../data/data-schema';

export class RawOptionsDataToDataTransformer {
	transform(rawOptionsData: RawOptionsData, schema: DataSchema): any {
		const result = {};
		const clonedRawOptionsData = deepClone(rawOptionsData);
		this.transformOptionList(
			result,
			clonedRawOptionsData.rawOptions,
			schema.optionSchemas,
			(rawOption, optionSchema) => {
				return this.transformOptionItem(rawOption, optionSchema);
			},
		);
		return result;
	}

	private transformOptionList<
		TRawOption extends RawOptionsData.BaseRawOption,
		TOptionSchema extends DataSchema.BaseOptionSchema
	>(
		toObject: any,
		rawOptions: RawOptionsData.BaseRawOptionIndexedList<TRawOption>,
		optionSchemas: DataSchema.BaseOptionSchemaIndexedList<TOptionSchema>,
		transformRawOptionFunc: (rawOption: TRawOption, optionSchema: TOptionSchema) => any,
	): void {
		optionSchemas.each(curOptionSchema => {
			this.transformOption(toObject, rawOptions, curOptionSchema, transformRawOptionFunc);
			rawOptions.byNameMany.removeAll(curOptionSchema.name);
		});

		if (rawOptions.any()) {
			throw new Error(`Unexpected option with name "${rawOptions.first().name}"`);
		}
	}

	private setOptionToObject(toObject: any, optionValue: any, optionSchema: DataSchema.BaseOptionSchema): void {
		const propertyName = optionSchema.bindingToData.optionToProperty;
		toObject[propertyName] = optionSchema.transformFunc ? optionSchema.transformFunc(optionValue) : optionValue;
	}

	private transformOption<
		TRawOption extends RawOptionsData.BaseRawOption,
		TOptionSchema extends DataSchema.BaseOptionSchema
	>(
		toObject: any,
		rawOptions: RawOptionsData.BaseRawOptionIndexedList<TRawOption>,
		optionSchema: TOptionSchema,
		transformRawOptionFunc: (rawOption: TRawOption, optionSchema: TOptionSchema) => any,
	): void {
		const rawOptionsWithSuchName = rawOptions.byNameMany.getAll(optionSchema.name);

		if (!(rawOptionsWithSuchName && rawOptionsWithSuchName.length)) {
			if (optionSchema.required) {
				throw new Error(`Required option with name "${optionSchema.name}" not found`);
			}
		}

		switch (optionSchema.type) {
			case DataSchema.OptionType.Single:
				if (rawOptionsWithSuchName.length !== 1) {
					throw new Error(`Single option with name "${optionSchema.name}" occurred more that once`);
				}
				this.setOptionToObject(
					toObject,
					transformRawOptionFunc(rawOptionsWithSuchName[0], optionSchema),
					optionSchema,
				);
				break;
			case DataSchema.OptionType.Multiple:
				this.setOptionToObject(
					toObject,
					rawOptionsWithSuchName.map(curRawOption => transformRawOptionFunc(curRawOption, optionSchema)),
					optionSchema,
				);
				break;
			default:
				throw new NotImplementedError();
		}
	}

	private transformOptionItem(rawOption: RawOptionsData.RawOption, optionSchema: DataSchema.OptionSchema): any {
		let result: any;

		if (!optionSchema.subOptionSchemas.any()) {
			if (rawOption.rawSubOptions.any()) {
				throw new Error(`Unexpected sub option with name "${rawOption.rawSubOptions.first().name}"`);
			} else {
				const value = this.transformValue(rawOption, optionSchema);
				result = this.applyValueBindingToDataIfExists(value, optionSchema);
			}
		} else {
			result = {};
			this.transformOptionList(
				result,
				rawOption.rawSubOptions,
				optionSchema.subOptionSchemas,
				(rawSubOption, subOptionSchema) => {
					return this.transformSubOptionItem(rawSubOption, subOptionSchema);
				},
			);
		}

		return result;
	}

	private transformSubOptionItem(
		rawSubOption: RawOptionsData.RawSubOption,
		subOptionSchema: DataSchema.SubOptionSchema,
	): any {
		const value = this.transformValue(rawSubOption, subOptionSchema);
		const result = this.applyValueBindingToDataIfExists(value, subOptionSchema);
		return result;
	}

	private applyValueBindingToDataIfExists(value: any, optionSchema: DataSchema.BaseOptionSchema): any {
		const valueBindingToData = optionSchema.valueSchema.bindingToData;
		const result: any = valueBindingToData ? { [valueBindingToData.valueToProperty]: value } : value;
		return result;
	}

	private transformValue(rawOption: RawOptionsData.BaseRawOption, optionSchema: DataSchema.BaseOptionSchema): any {
		let result: any;

		switch (optionSchema.valueSchema.format) {
			case DataSchema.ValueFormat.NoValue:
				if (rawOption.rawValues.length > 0) {
					throw new Error(`Option with name "${optionSchema.name}" can not has values`);
				}
				result = true;
				break;
			case DataSchema.ValueFormat.SingleValue:
				if (rawOption.rawValues.length !== 1) {
					throw new Error(`Option with name "${optionSchema.name}" must has one value`);
				}
				result = this.transformValueItem(rawOption.rawValues[0], optionSchema);
				break;
			case DataSchema.ValueFormat.MultipleValue:
				result = this.transformValueItemList(rawOption.rawValues, optionSchema);
				break;
			default:
				throw new NotImplementedError();
		}

		return result;
	}

	private transformValueItem(rawValue: RawOptionsData.RawValue, optionSchema: DataSchema.BaseOptionSchema): any {
		let result: any;

		switch (rawValue.type) {
			case RawOptionsData.ValueType.Null:
				result = null;
				break;

			case RawOptionsData.ValueType.String:
				if (optionSchema.valueSchema.type !== DataSchema.ValueType.String) {
					throw new Error(`Option with name "${optionSchema.name}" must has only string values`);
				}
				result = rawValue.value;
				break;

			case RawOptionsData.ValueType.Float:
				if (optionSchema.valueSchema.type !== DataSchema.ValueType.Float) {
					throw new Error(`Option with name "${optionSchema.name}" must has only float number values`);
				}
				result = rawValue.value;
				break;

			default:
				throw new NotImplementedError();
		}

		return result;
	}

	private transformValueItemList(
		rawValueList: RawOptionsData.RawValue[],
		optionSchema: DataSchema.BaseOptionSchema,
	): any {
		return rawValueList.map(rawValue => this.transformValueItem(rawValue, optionSchema));
	}
}
