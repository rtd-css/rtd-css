export class TokensData {
	tokens: TokensData.Token[];

	constructor() {
		this.tokens = [];
	}
}

export module TokensData {
	export enum TokenType {
		OptionName = 'OptionName',
		SubOptionName = 'SubOptionName',
		KeywordValue = 'KeywordValue',
		StringValue = 'StringValue',
		FloatValue = 'FloatValue',
	}

	export class Token {
		type: TokenType;
		value: string;
		typedValue: any;

		private constructor(
			type: TokenType,
			value: string,
			typedValue: any,
		) {
			this.type = type;
			this.value = value;
			this.typedValue = typedValue;
		}

		static createToken(
			type: TokenType,
			value: string,
		): Token {
			const typedValue = value;
			const token = new Token(type, value, typedValue);
			return token;
		}

		static createTokenWithTypedValue(
			type: TokenType,
			value: string,
			typedValue: any,
		): Token {
			const token = new Token(type, value, typedValue);
			return token;
		}
	}
}
