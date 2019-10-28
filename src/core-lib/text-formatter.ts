export enum IndentType {
	Tab = 'Tab',
	Spaces = 'Spaces',
}

export abstract class IndentStyle {
	readonly type: IndentType;

	constructor(type: IndentType) {
		this.type = type;
	}
}

export class TabIndentStyle extends IndentStyle {
	constructor() {
		super(IndentType.Tab);
	}
}

export class SpacesIndentStyle extends IndentStyle {
	readonly numberOfSpaces: number;

	constructor(numberOfSpaces: number) {
		super(IndentType.Spaces);
		this.numberOfSpaces = numberOfSpaces;
	}
}

export class TextFormatter {
	//
	// Static fields
	//

	static readonly lineBreakRegEx = /\r\n|\n\r|\n|\r/g;
	static readonly rnLineBreak = '\r\n';
	static readonly nLineBreak = '\n';
	static readonly defaultLineBreak = TextFormatter.nLineBreak;

	//
	// Fields
	//

	private _text: string;

	//
	// Contructor
	//

	constructor(text: string, defaultLineBreak: string = TextFormatter.defaultLineBreak) {
		this._text = text;
		this.normalizeLineBreaks();
	}

	//
	// Create functions
	//

	static jsonStringifyPretty(value: any, indentStyle: IndentStyle): TextFormatter {
		if (!indentStyle) {
			throw new Error('{indentStyle} required');
		}

		let textFormatter: TextFormatter;

		if (indentStyle instanceof SpacesIndentStyle) {
			const typedIndentStyle = indentStyle as SpacesIndentStyle;
			textFormatter = new TextFormatter(JSON.stringify(value, null, typedIndentStyle.numberOfSpaces));
		} else if (indentStyle instanceof TabIndentStyle) {
			const numberOfSpaces = 10;
			textFormatter = new TextFormatter(JSON.stringify(value, null, numberOfSpaces));
			textFormatter = textFormatter.spacesIndentsToTabIndents(numberOfSpaces);
		}

		return textFormatter;
	}

	//
	// Public methods
	//

	getText(): string {
		return TextFormatter.normalizeLineBreaks(this._text);
	}

	static spacesIndentsToTabIndents(text: string, numberOfSpaces: number): string {
		return text.replace(new RegExp(' '.repeat(numberOfSpaces), 'g'), '	');
	}

	spacesIndentsToTabIndents(numberOfSpaces: number): TextFormatter {
		this._text = TextFormatter.spacesIndentsToTabIndents(this._text, numberOfSpaces);
		return this;
	}

	static tabIndentsToSpacesIndents(text: string, numberOfSpaces: number): string {
		return text.replace(new RegExp('	', 'g'), ' '.repeat(numberOfSpaces));
	}

	tabIndentsToSpacesIndents(numberOfSpaces: number): TextFormatter {
		this._text = TextFormatter.tabIndentsToSpacesIndents(this._text, numberOfSpaces);
		return this;
	}

	static addTabsAtBeginOfAllLines(text: string, numberOfTabs: number): string {
		const initialLines = this.splitToLines(text);
		const resultLines = initialLines.map(line => '\t'.repeat(numberOfTabs) + line);
		const resultText = this.linesToText(resultLines);

		return resultText;
	}

	addTabsAtBeginOfAllLines(numberOfTabs: number): TextFormatter {
		this._text = TextFormatter.addTabsAtBeginOfAllLines(this._text, numberOfTabs);
		return this;
	}

	//
	// Private methods
	//

	private static normalizeLineBreaks(text: string): string {
		return text.replace(TextFormatter.lineBreakRegEx, TextFormatter.defaultLineBreak);
	}

	private normalizeLineBreaks(): TextFormatter {
		this._text = TextFormatter.normalizeLineBreaks(this._text);
		return this;
	}

	private static splitToLines(text: string): string[] {
		return this.normalizeLineBreaks(text).split(TextFormatter.defaultLineBreak);
	}

	private splitToLines(): string[] {
		return TextFormatter.splitToLines(this._text);
	}

	private static linesToText(lines: string[]): string {
		return lines.join(TextFormatter.defaultLineBreak);
	}

	//
	// Indent styles creating methods
	//

	static indentTab(): TabIndentStyle {
		return new TabIndentStyle();
	}

	static indentSpaces(numberOfSpaces: number): SpacesIndentStyle {
		return new SpacesIndentStyle(numberOfSpaces);
	}
}
