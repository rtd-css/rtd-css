import postcss from 'postcss';
import { CssTree } from '../../../../css-driver';
import { PostcssCssTreeUtils } from './postcss-css-tree-utils';

export module PostcssCssTree {

	// Node type

	export enum PostcssNodeType {
		root = 'root',
		atrule = 'atrule',
		rule = 'rule',
		decl = 'decl',
		comment = 'comment',
	}

	// Base nodes

	export abstract class NodeBase implements CssTree.NodeBase {
		protected _postcssNodeBase: postcss.NodeBase;
		get postcssNodeBase(): postcss.NodeBase {
			return this._postcssNodeBase;
		}

		abstract get type(): CssTree.NodeType;

		constructor(postcssNodeBase: postcss.NodeBase) {
			this._postcssNodeBase = postcssNodeBase;
		}

		clone(): this {
			const clonedPostcssNode = this._postcssNodeBase.clone();
			const clonedNode = PostcssCssTreeUtils.postcssNodeToNode(clonedPostcssNode as postcss.Node) as this;
			return clonedNode as this;
		}

		remove(): this {
			this._postcssNodeBase.remove();
			return this;
		}
	}

	export abstract class ChildNode extends NodeBase implements CssTree.ChildNode {
		get postcssChildNode(): postcss.ChildNode {
			return this._postcssNodeBase as postcss.ChildNode;
		}

		constructor(postcssChildNode: postcss.ChildNode) {
			super(postcssChildNode);
		}
	}

	export abstract class ContainerBase extends NodeBase implements CssTree.ContainerBase {
		get postcssContainerBase(): postcss.ContainerBase {
			return this._postcssNodeBase as postcss.ContainerBase;
		}

		constructor(postcssContainerBase: postcss.ContainerBase) {
			super(postcssContainerBase);
		}

		hasNodes(): boolean {
			return !!(this.postcssContainerBase.nodes && this.postcssContainerBase.nodes.length);
		}

		each(callback: (node: CssTree.ChildNode, index: number) => any): boolean | void {
			this.postcssContainerBase.each((postcssNode, index) => {
				callback(
					PostcssCssTreeUtils.postcssNodeToNode(postcssNode),
					index,
				);
			});
		}

		append(...nodes: CssTree.NodeBase[]): this {
			this.postcssContainerBase.append(
				...nodes.map(
					(curNode) => {
						return (curNode as PostcssCssTree.NodeBase).postcssNodeBase;
					},
				),
			);

			return this;
		}

		removeAll(): this {
			this.postcssContainerBase.removeAll();
			return this;
		}
	}

	export abstract class ChildContainerBase extends ContainerBase implements CssTree.ChildNode {}

	// Nodes

	export class Root extends ContainerBase {
		get postcssRoot(): postcss.Root {
			return this._postcssNodeBase as postcss.Root;
		}

		get type(): CssTree.NodeType {
			return CssTree.NodeType.root;
		}

		constructor(postcssRoot: postcss.Root) {
			super(postcssRoot);
		}
	}

	export class AtRule extends ChildContainerBase {
		get postcssAtRule(): postcss.AtRule {
			return this._postcssNodeBase as postcss.AtRule;
		}

		get type(): CssTree.NodeType {
			return CssTree.NodeType.atrule;
		}

		get name(): string {
			return this.postcssAtRule.name;
		}

		get params(): string { return this.postcssAtRule.params; }
		set params(value: string) { this.postcssAtRule.params = value; }

		constructor(postcssAtRule: postcss.AtRule) {
			super(postcssAtRule);
		}
	}

	export class Rule extends ChildContainerBase {
		get postcssRule(): postcss.Rule {
			return this._postcssNodeBase as postcss.Rule;
		}

		get type(): CssTree.NodeType {
			return CssTree.NodeType.rule;
		}

		get selector(): string { return this.postcssRule.selector; }
		set selector(value: string) { this.postcssRule.selector = value; }

		constructor(postcssRule: postcss.Rule) {
			super(postcssRule);
		}
	}

	export class Declaration extends ChildNode {
		get postcssDeclaration(): postcss.Declaration {
			return this._postcssNodeBase as postcss.Declaration;
		}

		get type(): CssTree.NodeType {
			return CssTree.NodeType.decl;
		}

		get prop(): string { return this.postcssDeclaration.prop; }
		set prop(value: string) { this.postcssDeclaration.prop = value; }

		get value(): string { return this.postcssDeclaration.value; }
		set value(value: string) { this.postcssDeclaration.value = value; }

		get important(): boolean { return this.postcssDeclaration.important; }
		set important(value: boolean) { this.postcssDeclaration.important = value; }

		constructor(postcssDeclaration: postcss.Declaration) {
			super(postcssDeclaration);
		}
	}

	export class Comment extends ChildNode {
		get postcssComment(): postcss.Comment {
			return this._postcssNodeBase as postcss.Comment;
		}

		get type(): CssTree.NodeType {
			return CssTree.NodeType.comment;
		}

		constructor(postcssComment: postcss.Comment) {
			super(postcssComment);
		}
	}

}
