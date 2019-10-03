import postcss from 'postcss';
import { CssResult } from '../../../../css-driver';

export class PostcssCssResult implements CssResult<postcss.Root> {
	private _result: postcss.Result;

	get cssRoot(): postcss.Root {
		return this._result.root;
	}

	get css(): string {
		return this._result.css;
	}

	constructor(cssRoot: postcss.Root) {
		this._result = cssRoot.toResult();
	}
}
