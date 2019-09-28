import { BaseOptionIndexedList } from '../base-option-indexed-list';

export class DataSchema {
	optionSchemas: DataSchema.OptionSchemaIndexedList;

	constructor(optionSchemas: DataSchema.OptionSchema[]) {
		this.optionSchemas = new DataSchema.OptionSchemaIndexedList();
		this.optionSchemas.add(...optionSchemas);
	}
}

export module DataSchema {

	export enum ValueFormat {
		NoValue = 'NoValue',
		SingleValue = 'SingleValue',
	}

	export enum ValueType {
		String = 'String',
		Float = 'Float',
	}

	export class ValueBindingToData {
		valueToProperty: string;

		constructor(valueToProperty: string) {
			this.valueToProperty = valueToProperty;
		}
	}

	export class ValueSchema {
		bindingToData: ValueBindingToData;
		format: ValueFormat;
		type: ValueType;

		private constructor(
			bindingToData: ValueBindingToData,
			format: ValueFormat,
			type: ValueType,
		) {
			this.bindingToData = bindingToData;
			this.format = format;
			this.type = type;
		}

		static createNoValue(
			bindingToData: ValueBindingToData,
		): ValueSchema {
			return new ValueSchema(bindingToData, ValueFormat.NoValue, null);
		}

		static createSingleValue(
			bindingToData: ValueBindingToData,
			valueType: ValueType,
		): ValueSchema {
			return new ValueSchema(bindingToData, ValueFormat.SingleValue, valueType);
		}
	}

	export type OptionTransformFunc = (value: any) => any;

	export enum OptionType {
		Single = 'Single',
		Multiple = 'Multiple',
	}

	export class OptionBindingToData {
		optionToProperty: string;

		constructor(
			optionToProperty: string,
		) {
			this.optionToProperty = optionToProperty;
		}
	}

	export class BaseOptionSchema {
		name: string;
		bindingToData: OptionBindingToData;
		type: OptionType;
		valueSchema: ValueSchema;
		required: boolean;
		transformFunc: OptionTransformFunc;

		constructor(
			name: string,
			bindingToData: OptionBindingToData,
			type: OptionType,
			valueSchema: ValueSchema,
			required: boolean,
			transformFunc: OptionTransformFunc = null,
		) {
			this.name = name;
			this.bindingToData = bindingToData;
			this.type = type;
			this.valueSchema = valueSchema;
			this.required = required;
			this.transformFunc = transformFunc;
		}
	}

	export class OptionSchema extends BaseOptionSchema {
		subOptionSchemas: SubOptionSchemaIndexedList;

		constructor(
			name: string,
			bindingToData: OptionBindingToData,
			type: OptionType,
			valueSchema: ValueSchema,
			required: boolean,
			subOptionSchemas: SubOptionSchema[],
			transformFunc: OptionTransformFunc = null,
		) {
			super(
				name,
				bindingToData,
				type,
				valueSchema,
				required,
				transformFunc,
			);

			this.subOptionSchemas = new SubOptionSchemaIndexedList();
			subOptionSchemas && this.subOptionSchemas.add(...subOptionSchemas);
		}
	}

	export class SubOptionSchema extends BaseOptionSchema {}

	export class BaseOptionSchemaIndexedList<TOptionSchema extends BaseOptionSchema>
		extends BaseOptionIndexedList<TOptionSchema> {}

	export class OptionSchemaIndexedList extends BaseOptionSchemaIndexedList<OptionSchema> {}

	export class SubOptionSchemaIndexedList extends BaseOptionSchemaIndexedList<SubOptionSchema> {}

	export class SchemaFactory {
		private createValueOptionEx(
			optionOrSubOption: boolean,
			valueType: ValueType,
			name: string,
			optionToProperty: string,
			required: boolean,
			transformFunc: OptionTransformFunc = null,
		): OptionSchema | SubOptionSchema {
			let optionSchema: OptionSchema | SubOptionSchema;

			if (optionOrSubOption) {
				optionSchema = new OptionSchema(
					name,
					new OptionBindingToData(optionToProperty),
					OptionType.Single,
					ValueSchema.createSingleValue(null, valueType),
					required,
					null,
					transformFunc,
				);
			} else {
				optionSchema = new SubOptionSchema(
					name,
					new OptionBindingToData(optionToProperty),
					OptionType.Single,
					ValueSchema.createSingleValue(null, valueType),
					required,
					transformFunc,
				);
			}

			return optionSchema;
		}

		createStringOption(
			name: string,
			optionToProperty: string,
			required: boolean,
			transformFunc: OptionTransformFunc = null,
		): OptionSchema {
			return <OptionSchema>this.createValueOptionEx(
				true,
				ValueType.String,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}

		createStringSubOption(
			name: string,
			optionToProperty: string,
			required: boolean,
			transformFunc: OptionTransformFunc = null,
		): SubOptionSchema {
			return <SubOptionSchema>this.createValueOptionEx(
				false,
				ValueType.String,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}

		createFloatOption(
			name: string,
			optionToProperty: string,
			required: boolean,
			transformFunc: OptionTransformFunc = null,
		): OptionSchema {
			return <OptionSchema>this.createValueOptionEx(
				true,
				ValueType.Float,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}

		createFloatSubOption(
			name: string,
			optionToProperty: string,
			required: boolean,
			transformFunc: OptionTransformFunc = null,
		): SubOptionSchema {
			return <SubOptionSchema>this.createValueOptionEx(
				false,
				ValueType.Float,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}

		private createObjectOptionEx(
			optionType: OptionType,
			name: string,
			optionToProperty: string,
			required: boolean,
			subOptionSchemas: SubOptionSchema[],
			transformFunc: OptionTransformFunc = null,
		): OptionSchema {
			return new OptionSchema(
				name,
				new OptionBindingToData(optionToProperty),
				optionType,
				null,
				required,
				subOptionSchemas,
				transformFunc,
			);
		}

		createObjectOption(
			name: string,
			optionToProperty: string,
			required: boolean,
			subOptionSchemas: SubOptionSchema[],
			transformFunc: OptionTransformFunc = null,
		): OptionSchema {
			return this.createObjectOptionEx(
				OptionType.Single,
				name,
				optionToProperty,
				required,
				subOptionSchemas,
				transformFunc,
			);
		}

		createObjectArrayOption(
			name: string,
			optionToProperty: string,
			required: boolean,
			subOptionSchemas: SubOptionSchema[],
			transformFunc: OptionTransformFunc = null,
		): OptionSchema {
			return this.createObjectOptionEx(
				OptionType.Multiple,
				name,
				optionToProperty,
				required,
				subOptionSchemas,
				transformFunc,
			);
		}
	}

}
