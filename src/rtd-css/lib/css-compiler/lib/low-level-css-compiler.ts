import { NotImplementedError } from '../../../../core-lib/not-implemented-error';
import { MediaQuery } from '../../../../core-lib/media-query';
import { CssDriver, CssTree } from '../../../../css-driver';
import { ConfigModule } from '../../config';
import { MediaQueryToDevicesCompiler, DeviceMediaQuery } from '../../media-query-to-devices';
import { PassedQuery_Passed, PassedQuery_QueryType } from '../../media-query-passer';
import { CssConfigStringLoader, RtdCssSelectorParser } from '../../low-level-compiling-logic';
import { CssCompilerOptions } from './css-compiler-options';

export class LowLevelCssCompiler {
	private _options: CssCompilerOptions;
	private _config: ConfigModule.Config;
	private _cssDriver: CssDriver;

	constructor() {
		this._options = {};
	}

	setOptions(options: CssCompilerOptions): void {
		const finalOptions = <CssCompilerOptions>{};
		if (options) {
			Object.assign(finalOptions, options);
		}

		this._options = finalOptions;
	}

	setConfig(config: ConfigModule.Config): void {
		this._config = config;
	}

	setCssDriver(cssDriver: CssDriver): void {
		this._cssDriver = cssDriver;
	}

	compile(root: CssTree.Root): CssTree.Root {
		const resultRoot = this.processRoot(root);
		if (!this._options.notRemoveConfigDecl) {
			const configStringLoader = new CssConfigStringLoader();
			configStringLoader.removeConfigDecl(resultRoot);
		}
		return resultRoot;
	}

	processRoot(root: CssTree.Root): CssTree.Root {
		const newRoot = this._cssDriver.createRoot();

		const deviceName = this._options.compileOnlyThisDevice;
		let device: ConfigModule.Device | ConfigModule.UnknownDevice;
		if (!deviceName) {
			device = null;
		} else {
			if (deviceName === this._config.unknownDevice.name) {
				device = this._config.unknownDevice;
			} else {
				device = this._config.deviceList.byNameOne.get(deviceName);
				if (!device) {
					throw new Error(`Device with name "${deviceName}" not found`);
				}
			}
		}

		this.processChildNodesOfNode(root, newRoot, device);

		return newRoot;
	}

	processChildNodesOfNode(
		node: CssTree.ContainerBase,
		newParent: CssTree.ContainerBase,
		parentDevice: ConfigModule.Device | ConfigModule.UnknownDevice | null,
	): void {
		node.each((child: CssTree.ChildNode) => {
			if (child.type === CssTree.NodeType.atrule) {
				this.processAtRule(<CssTree.AtRule>child, newParent, parentDevice);
			} else if (child.type === CssTree.NodeType.rule) {
				this.processRule(<CssTree.Rule>child, newParent, parentDevice);
			} else if (child.type === CssTree.NodeType.decl) {
				this.processDecl(<CssTree.Declaration>child, newParent);
			}
		});
	}

	processAtRule(
		atRule: CssTree.AtRule,
		newParent: CssTree.ContainerBase,
		parentDevice: ConfigModule.Device | ConfigModule.UnknownDevice | null,
	): void {
		if (atRule.name === CssTree.AtRuleName.media) {
			this.processMediaAtRule(atRule, newParent, parentDevice);
		} else {
			if (!parentDevice) {
				newParent.append(atRule.clone());
			} else {
				const newAtRule = this.cloneContainerWithoutChildNodes(atRule);
				newParent.append(newAtRule);
				this.processChildNodesOfNode(atRule, newAtRule, parentDevice);
			}
		}
	}

	processMediaAtRule(
		mediaAtRule: CssTree.AtRule,
		newParent: CssTree.ContainerBase,
		parentDevice: ConfigModule.Device | ConfigModule.UnknownDevice | null,
	): void {
		const mtdCompiler = new MediaQueryToDevicesCompiler();
		const mediaQueryList = mtdCompiler.mediaQueryToDeviceMediaQueries(this._config, mediaAtRule.params);

		if (parentDevice) {
			if (parentDevice instanceof ConfigModule.UnknownDevice) {
				this.processUnknownDeviceMediaAtRule(
					mediaAtRule,
					newParent,
					parentDevice as ConfigModule.UnknownDevice,
				);
			} else if (parentDevice instanceof ConfigModule.Device) {
				const mediaQuery = mediaQueryList.byDeviceNameOne.get(parentDevice.name);
				this.processDeviceMediaAtRule(mediaAtRule, newParent, mediaQuery);
			} else {
				throw new NotImplementedError();
			}
		} else {
			mediaQueryList.each(mediaQuery => {
				this.processDeviceMediaAtRule(mediaAtRule, newParent, mediaQuery);
			});

			this.processUnknownDeviceMediaAtRule(mediaAtRule, newParent, this._config.unknownDevice);
		}
	}

	processUnknownDeviceMediaAtRule(
		mediaAtRule: CssTree.AtRule,
		newParent: CssTree.ContainerBase,
		unknownDevice: ConfigModule.UnknownDevice,
	): void {
		const newMediaAtRule = this.cloneContainerWithoutChildNodes(mediaAtRule);
		newMediaAtRule.params = new MediaQuery(mediaAtRule.params).stringify();
		newParent.append(newMediaAtRule);
		this.processChildNodesOfNode(mediaAtRule, newMediaAtRule, unknownDevice);
	}

	processDeviceMediaAtRule(
		mediaAtRule: CssTree.AtRule,
		newParent: CssTree.ContainerBase,
		mediaQuery: DeviceMediaQuery,
	): void {
		const passed = mediaQuery.passedMediaQuery.passed;

		switch (passed) {
			case PassedQuery_Passed.NotPassed: {
				// Nothing to do
				break;
			}
			case PassedQuery_Passed.Passed: {
				this.processMediaAtRuleWithMediaQuery_passed(mediaAtRule, newParent, mediaQuery);
				break;
			}
			default: {
				throw new NotImplementedError();
			}
		}
	}

	processMediaAtRuleWithMediaQuery_passed(
		mediaAtRule: CssTree.AtRule,
		newParent: CssTree.ContainerBase,
		mediaQuery: DeviceMediaQuery,
	): void {
		const queryType = mediaQuery.passedMediaQuery.queryType;

		switch (queryType) {
			case PassedQuery_QueryType.Empty: {
				this.processChildNodesOfNode(mediaAtRule, newParent, mediaQuery.device);
				break;
			}
			case PassedQuery_QueryType.NotEmpty: {
				const newMediaAtRule = this.cloneContainerWithoutChildNodes(mediaAtRule);
				newMediaAtRule.params = new MediaQuery(mediaQuery.passedMediaQuery.query).stringify();
				newParent.append(newMediaAtRule);
				this.processChildNodesOfNode(mediaAtRule, newMediaAtRule, mediaQuery.device);
				break;
			}
			default: {
				throw new NotImplementedError();
			}
		}
	}

	processRule(
		rule: CssTree.Rule,
		newParent: CssTree.ContainerBase,
		parentDevice: ConfigModule.Device | ConfigModule.UnknownDevice | null,
	): void {
		if (!parentDevice) {
			newParent.append(rule.clone());
		} else {
			const newRule = this.cloneContainerWithoutChildNodes(rule);
			newRule.selector = this.computeDeviceSelector(rule.selector, parentDevice);

			newParent.append(newRule);
			this.processChildNodesOfNode(rule, newRule, null);
		}
	}

	computeDeviceSelector(baseSelector: string, device: ConfigModule.Device | ConfigModule.UnknownDevice): string {
		let deviceSelector: string;

		if (this._options.compileOnlyThisDevice) {
			deviceSelector = baseSelector;
		} else {
			const deviceCssClass = this.computeDeviceCssClass(device);
			const rtdCssSelectorParser = new RtdCssSelectorParser();
			deviceSelector = rtdCssSelectorParser.addDeviceFilteringToSelector(baseSelector, deviceCssClass);
		}

		return deviceSelector;
	}

	computeDeviceCssClass(device: ConfigModule.Device | ConfigModule.UnknownDevice): string {
		let deviceCssClass: string;

		if (device instanceof ConfigModule.UnknownDevice) {
			deviceCssClass = this._config.unknownDevice.cssClass;
		} else if (device instanceof ConfigModule.Device) {
			deviceCssClass = device.cssClass;
		} else {
			throw new NotImplementedError();
		}

		return deviceCssClass;
	}

	processDecl(decl: CssTree.Declaration, newParent: CssTree.ContainerBase): void {
		newParent.append(decl.clone());
	}

	cloneContainerWithoutChildNodes<TNode extends CssTree.ContainerBase>(container: TNode): TNode {
		const clonedContainer = container.clone();
		clonedContainer.removeAll();
		return clonedContainer;
	}
}
