import postcss from 'postcss';
import { CssTree } from '../../../../css-driver';
import { PostcssCssTree } from './postcss-css-tree';

export module PostcssCssTreeUtils {

	export function postcssNodeToNode(postcssNode: postcss.Node): CssTree.NodeBase {
		let node: CssTree.NodeBase;

		switch (postcssNode.type) {
			case PostcssCssTree.PostcssNodeType.root:
				node = new PostcssCssTree.Root(postcssNode);
				break;
			case PostcssCssTree.PostcssNodeType.atrule:
				node = new PostcssCssTree.AtRule(postcssNode);
				break;
			case PostcssCssTree.PostcssNodeType.rule:
				node = new PostcssCssTree.Rule(postcssNode);
				break;
			case PostcssCssTree.PostcssNodeType.decl:
				node = new PostcssCssTree.Declaration(postcssNode);
				break;
			case PostcssCssTree.PostcssNodeType.comment:
				node = new PostcssCssTree.Comment(postcssNode);
				break;
			default:
				throw new Error('Unknown postcss node type');
		}

		return node;
	}

}
