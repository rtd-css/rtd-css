import { FloatNumberParser } from '../../../float-number-parser';
import { TokensData } from '../data/tokens-data';

export class StringToTokensDataTransformer {
	private static readonly _quotationMarks = ['\'', '\"'];

	transform(string: string): TokensData {
		const stringParts = this.stringToStringParts(string);
		const tokensData = this.stringPartsToTokensData(stringParts);

		return tokensData;
	}

	private stringToStringParts(string: string): string[] {
		const stringPartsRegEx = /(\S+)/g;
		const stringParts = string.match(stringPartsRegEx);

		return stringParts;
	}

	private stringPartsToTokensData(stringParts: string[]): TokensData {
		const tokensData = new TokensData();

		tokensData.tokens = stringParts.map(
			(part) => {
				let token: TokensData.Token;

				if (part.startsWith('--')) {
					token = TokensData.Token.createToken(
						TokensData.TokenType.OptionName,
						part.substr('--'.length).trim(),
					);
				} else if (part.startsWith('[') && part.endsWith(']')) {
					token = TokensData.Token.createToken(
						TokensData.TokenType.SubOptionName,
						part.substr(1, part.length - 2).trim(),
					);
				} else if (part.startsWith('#')) {
					token = TokensData.Token.createToken(
						TokensData.TokenType.KeywordValue,
						part.substr('#'.length).trim(),
					);
				} else if (
					StringToTokensDataTransformer._quotationMarks.includes(part.charAt(0))
					&& part.charAt(0) === part.charAt(part.length - 1)
				) {
					token = TokensData.Token.createToken(
						TokensData.TokenType.StringValue,
						part.substr(1, part.length - 2).trim(),
					);
				} else {
					const partAsFloatNumber = FloatNumberParser.tryParse(part);
					if (typeof partAsFloatNumber === 'number') {
						token = TokensData.Token.createTokenWithTypedValue(
							TokensData.TokenType.FloatValue,
							part,
							partAsFloatNumber,
						);
					} else {
						throw new Error('Unexpected string part in config string');
					}
				}

				return token;
			},
		);

		return tokensData;
	}
}
