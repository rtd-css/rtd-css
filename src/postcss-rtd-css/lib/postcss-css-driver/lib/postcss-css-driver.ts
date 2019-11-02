import postcss from 'postcss';
import postcssPrettify from '../../../../third-party/postcss-prettify';
import { TypedCssDriver, CssTree, CssResult } from '../../../../css-driver';
import { PostcssCssTree } from './postcss-css-tree';
import { PostcssCssResult } from './postcss-css-result';

export class PostcssCssDriver
	implements TypedCssDriver<postcss.Root, postcss.AtRule, postcss.Rule, postcss.Declaration, postcss.Comment> {
	createRoot(sourceRoot?: postcss.Root): CssTree.Root {
		return new PostcssCssTree.Root(sourceRoot || postcss.root());
	}

	createAtRule(sourceAtRule?: postcss.AtRule): CssTree.AtRule {
		return new PostcssCssTree.AtRule(sourceAtRule || postcss.atRule());
	}

	createRule(sourceRule?: postcss.Rule): CssTree.Rule {
		return new PostcssCssTree.Rule(sourceRule || postcss.rule());
	}

	createDeclaration(sourceDeclaration?: postcss.Declaration): CssTree.Declaration {
		return new PostcssCssTree.Declaration(sourceDeclaration || postcss.decl());
	}

	createComment(sourceComment?: postcss.Comment): CssTree.Comment {
		return new PostcssCssTree.Comment(sourceComment || postcss.comment());
	}

	sourceRootToRoot(sourceRoot: postcss.Root): CssTree.Root {
		return this.createRoot(sourceRoot);
	}

	rootToSourceRoot(root: CssTree.Root): postcss.Root {
		return (root as PostcssCssTree.Root).postcssRoot;
	}

	inputCssToSourceRoot(inputCss: string | postcss.Root): postcss.Root {
		let sourceRoot: postcss.Root;

		if (typeof inputCss === 'string') {
			sourceRoot = this.parseCssToSourceRoot(inputCss);
		} else {
			sourceRoot = inputCss;
		}

		return sourceRoot;
	}

	parseCssToSourceRoot(css: string | Buffer): postcss.Root {
		return postcss.parse(css);
	}

	createResult(sourceRoot: postcss.Root): CssResult<postcss.Root> {
		return new PostcssCssResult(sourceRoot);
	}

	prettify(sourceRoot: postcss.Root): postcss.Root {
		return postcssPrettify.process(sourceRoot).root;
	}
}
