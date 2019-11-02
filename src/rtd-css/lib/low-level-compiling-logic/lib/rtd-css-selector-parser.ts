import { Selector, parse, stringify } from 'css-what';

export class RtdCssSelectorParser {
	addDeviceFilteringToSelector(selector: string, deviceCssClass: string): string {
		const parsedSelector = parse(selector);

		for (const subSelector of parsedSelector) {
			const firstToken = subSelector[0];
			const deviceClassToken = <Selector>{
				type: 'attribute',
				name: 'class',
				action: 'element',
				value: deviceCssClass,
				ignoreCase: false,
			};

			if (firstToken.type === 'tag' && firstToken.name && firstToken.name.toLowerCase() === 'html') {
				subSelector.splice(1, 0, deviceClassToken);
			} else {
				const htmlTagToken = <Selector>{
					type: 'tag',
					name: 'html',
				};

				const descendantCombinatorToken = <Selector>{
					type: 'descendant',
				};

				subSelector.splice(0, 0, htmlTagToken, deviceClassToken, descendantCombinatorToken);
			}
		}

		return stringify(parsedSelector);
	}
}
