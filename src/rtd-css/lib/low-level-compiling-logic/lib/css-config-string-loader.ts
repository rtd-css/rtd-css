import { CssTree } from '../../../../css-driver';

export class CssConfigStringLoader {
	loadConfigString(root: CssTree.Root, removeConfigDecl: boolean = false): string {
		let configString: string;
		let configFoundInCss: boolean = false;

		root.each((node: CssTree.ChildNode) => {
			if (node.type === CssTree.NodeType.rule) {
				const rule = <CssTree.Rule>node;
				if (rule.selector.toLowerCase() === 'html') {
					rule.each((node: CssTree.ChildNode) => {
						if (node.type === CssTree.NodeType.decl) {
							const decl = <CssTree.Declaration>node;
							if (decl.prop === '--rtd-config') {
								configString = decl.value;
								configFoundInCss = true;
								if (removeConfigDecl) {
									decl.remove();
								}
							}
						}
					});

					if (removeConfigDecl) {
						if (!rule.hasNodes()) {
							rule.remove();
						}
					}
				}
			}
		});

		if (!configFoundInCss) {
			throw new Error('RTD CSS config not found in CSS');
		}

		return configString;
	}

	removeConfigDecl(root: CssTree.Root): void {
		this.loadConfigString(root, true);
	}
}
