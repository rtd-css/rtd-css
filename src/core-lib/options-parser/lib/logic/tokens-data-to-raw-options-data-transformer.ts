import { TokensData } from '../data/tokens-data';
import { RawOptionsData } from '../data/raw-options-data';

export class TokensDataToRawOptionsDataTransformer {
	private _rawOptionsData: RawOptionsData;
	private _currentRawOption: RawOptionsData.RawOption;
	private _currentRawSubOption: RawOptionsData.RawSubOption;

	transform(tokensData: TokensData): RawOptionsData {
		this._rawOptionsData = new RawOptionsData();

		for (const token of tokensData.tokens) {
			switch (token.type) {
				case TokensData.TokenType.OptionName:
					this.processOptionNameToken(token);
					break;
				case TokensData.TokenType.SubOptionName:
					this.processSubOptionNameToken(token);
					break;
				case TokensData.TokenType.KeywordValue:
					this.processKeywordValueToken(token);
					break;
				case TokensData.TokenType.StringValue:
					this.processStringValueToken(token);
					break;
				case TokensData.TokenType.FloatValue:
					this.processFloatValueToken(token);
					break;
				default:
					throw new Error('Unknown token type');
			}
		}

		return this._rawOptionsData;
	}

	private processOptionNameToken(token: TokensData.Token): void {
		const optionName = token.value;
		const rawOption = new RawOptionsData.RawOption(optionName);
		this._currentRawOption = rawOption;
		this._rawOptionsData.rawOptions.add(rawOption);
	}

	private processSubOptionNameToken(token: TokensData.Token): void {
		if (this._currentRawOption) {
			const subOptionName = token.value;
			const rawSubOption = new RawOptionsData.RawSubOption(subOptionName);
			this._currentRawSubOption = rawSubOption;
			this._currentRawOption.rawSubOptions.add(rawSubOption);
		} else {
			throw new Error('Sub option must be only in option');
		}
	}

	private processKeywordValueToken(token: TokensData.Token): void {
		let rawValue: RawOptionsData.RawValue;
		const keywordValue = token.value;
		if (keywordValue === 'rtd-none') {
			rawValue = new RawOptionsData.RawValue(RawOptionsData.ValueType.Null, null);
		} else {
			throw new Error('Unknown keyword value');
		}

		this.addValue(rawValue);
	}

	private processStringValueToken(token: TokensData.Token): void {
		const rawValue = new RawOptionsData.RawValue(RawOptionsData.ValueType.String, token.typedValue);
		this.addValue(rawValue);
	}

	private processFloatValueToken(token: TokensData.Token): void {
		const rawValue = new RawOptionsData.RawValue(RawOptionsData.ValueType.Float, token.typedValue);
		this.addValue(rawValue);
	}

	private addValue(rawValue: RawOptionsData.RawValue): void {
		if (this._currentRawSubOption) {
			this._currentRawSubOption.rawValues.push(rawValue);
		} else if (this._currentRawOption) {
			this._currentRawOption.rawValues.push(rawValue);
		} else {
			throw new Error('Value must be only in option or sub option');
		}
	}
}
