import postcss from 'postcss';

function getDepth(node: postcss.Node): number {
	let depth = 0;
	let parent = <postcss.Node>node.parent;
	while (parent.type !== 'root') {
		depth += 1;
		parent = parent.parent;
	}
	return depth;
}

function doubleSpace(node: postcss.Node): void {
	node.raws.before += '\n';
}

function modifyIndent(oldIndent: string, newIndent: string): string {
	let result = (typeof oldIndent === 'string') ? oldIndent : '';
	result = result.trim().concat(`\n${newIndent}`);
	return result;
}

function indent(
	node: postcss.Node,
	depth: number,
	options: {
		before?: boolean,
		after?: boolean,
	},
): void {
	const indentStr = '\t'.repeat(depth);
	if (options.before) {
		node.raws.before = modifyIndent(node.raws.before, indentStr);
	}
	if (options.after) {
		node.raws.after = modifyIndent(node.raws.after, indentStr);
	}
}

/**
 * Append space to colon if necessary. See at-rule-spacing-colon test case.
 */
const params = {
	match: /(\(.*)(:)([^\s])(.*\))/g,
	replace: '$1$2 $3$4',
};

function atrule(node: postcss.AtRule): void {
	const nodeDepth = getDepth(node);
	indent(
		node,
		nodeDepth,
		{
			before: true,
			after: true,
		},
	);
	node.raws.between = node.nodes ? ' ' : '';
	if (node.params) {
		node.raws.afterName = ' ';
		node.params = node.params.replace(params.match, params.replace);
	}
	if (nodeDepth === 0) doubleSpace(node);
}

function comment(node: postcss.Comment): void {
	if (getDepth(node) === 0) doubleSpace(node);
}

function decl(node: postcss.Declaration): void {
	indent(
		node,
		getDepth(node),
		{
			before: true,
		},
	);
	node.raws.between = ': ';
}

function rule(node: postcss.Rule): void {
	const nodeDepth = getDepth(node);
	indent(
		node,
		nodeDepth,
		{
			before: true,
			after: true,
		},
	);
	node.raws.between = ' ';
	node.raws.semicolon = true;
	if (node.selector.indexOf(', ') >= 0) {
		node.selector = node.selector.replace(/, /g, ',\n');
	}
	if (nodeDepth === 0) doubleSpace(node);
}

function format(node: postcss.ChildNode) {
	switch (node.type) {
		case 'atrule':
			atrule(node);
			break;
		case 'rule':
			rule(node);
			break;
		case 'decl':
			decl(node);
			break;
		case 'comment':
			comment(node);
			break;
	}
}

const plugin = postcss.plugin('postcss-prettify', () => (css) => {
	css.walk(format);
	if (css.first && css.first.raws) css.first.raws.before = '';
});

plugin.process = css => postcss([plugin]).process(css);

export default plugin;
