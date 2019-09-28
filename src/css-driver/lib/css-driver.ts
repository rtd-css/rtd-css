import { CssTree } from './css-tree';

export interface CssDriver {
	createRoot(sourceRoot?: any): CssTree.Root;

	createAtRule(sourceAtRule?: any): CssTree.AtRule;

	createRule(sourceRule?: any): CssTree.Rule;

	createDeclaration(sourceDeclaration?: any): CssTree.Declaration;

	createComment(sourceComment?: any): CssTree.Comment;

	sourceRootToRoot(sourceRoot: any): CssTree.Root;

	rootToSourceRoot(root: CssTree.Root): any;

	prettify(sourceRoot: any): any;
}

export interface TypedCssDriver<
	TSourceRoot,
	TSourceAtRule,
	TSourceRule,
	TSourceDeclaration,
	TSourceComment,
> extends CssDriver {
	createRoot(sourceRoot?: TSourceRoot): CssTree.Root;

	createAtRule(sourceAtRule?: TSourceAtRule): CssTree.AtRule;

	createRule(sourceRule?: TSourceRule): CssTree.Rule;

	createDeclaration(sourceDeclaration?: TSourceDeclaration): CssTree.Declaration;

	createComment(sourceComment?: TSourceComment): CssTree.Comment;

	sourceRootToRoot(sourceRoot: TSourceRoot): CssTree.Root;

	rootToSourceRoot(root: CssTree.Root): TSourceRoot;

	prettify(sourceRoot: TSourceRoot): TSourceRoot;
}
