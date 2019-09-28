export module CssTree {

	// Node type

	export enum NodeType {
		root = 'root',
		atrule = 'atrule',
		rule = 'rule',
		decl = 'decl',
		comment = 'comment',
	}

	// At rule name

	export enum AtRuleName {
		media = 'media',
	}

	// Base nodes

	export interface NodeBase {
		readonly type: NodeType;

		clone(): this;

		remove(): this;
	}

	export interface ChildNode extends NodeBase {}

	export interface ContainerBase extends NodeBase {
		hasNodes(): boolean;

		each(callback: (node: ChildNode, index: number) => any): boolean | void;

		append(...nodes: NodeBase[]): this;

		removeAll(): this;
	}

	// Nodes

	export interface Root extends NodeBase, ContainerBase {}

	export interface AtRule extends NodeBase, ChildNode, ContainerBase {
		readonly name: string;

		params: string;
	}

	export interface Rule extends NodeBase, ChildNode, ContainerBase {
		selector: string;
	}

	export interface Declaration extends NodeBase, ChildNode {
		prop: string;
		value: string;
		important: boolean;
	}

	export interface Comment extends NodeBase, ChildNode {}

}
