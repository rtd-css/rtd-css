const mediaQueryLib = require('css-mediaquery');

export module LibraryMediaQueryAst {
	export interface MediaQueryAst {
		orQueries: ReadonlyArray<MediaQueryOrQueryAst>;
	}

	export interface MediaQueryOrQueryAst {
		inverse: boolean;
		type: string;
		expressions: ReadonlyArray<MediaQueryFeatureAst>;
	}

	export interface MediaQueryFeatureAst {
		modifier: string;
		feature: string;
		value: string;
	}
}

export class MediaQueryParser {
	parse(mediaQueryString: string): LibraryMediaQueryAst.MediaQueryAst {
		return <LibraryMediaQueryAst.MediaQueryAst>{
			orQueries: mediaQueryLib.parse(mediaQueryString),
		};
	}
}
