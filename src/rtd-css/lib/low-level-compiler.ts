import { NotImplementedError } from '../../core-lib/not-implemented-error';
import { MediaQuery } from '../../core-lib/media-query';
import { CssDriver, CssTree } from '../../css-driver';
import { Options } from './options';
import { InputConfigModule, ConfigModule, ConfigBuilderModule } from './config';
import { DeviceExpandingInputConfigModule, DeviceExpandingScriptConfigModule } from './device-expanding-config';
import { MediaQueryToDevices } from './media-query-to-devices';
import { DeviceMediaQuery } from './device-media-query';
import { PassedQuery_Passed, PassedQuery_QueryType } from './media-query-passer';

export class LowLevelCompiler {
	private _options: Options;
	private _config: ConfigModule.Config;
	private _cssDriver: CssDriver;

	constructor() {
		this._options = {};
	}

	setOptions(options: Options): void {
		const finalOptions = <Options>{};
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
			this.removeConfigDecl(resultRoot);
		}
		return resultRoot;
	}

	processRoot(root: CssTree.Root): CssTree.Root {
		const newRoot = this._cssDriver.createRoot();

		const deviceName = this._options.compileOnlyThisDevice;
		let device: ConfigModule.Device | LowLevelCompiler.UnknownDevice;
		if (!deviceName) {
			device = null;
		} else {
			if (deviceName === this._config.unknownDevice.name) {
				device = LowLevelCompiler.UnknownDevice.instance;
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
		parentDevice: ConfigModule.Device | LowLevelCompiler.UnknownDevice | null,
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
		parentDevice: ConfigModule.Device | LowLevelCompiler.UnknownDevice | null,
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
		parentDevice: ConfigModule.Device | LowLevelCompiler.UnknownDevice | null,
	): void {
		const mediaQueryList = MediaQueryToDevices.mediaQueryToDeviceMediaQueries(this._config, mediaAtRule.params);

		if (parentDevice) {
			if (parentDevice instanceof LowLevelCompiler.UnknownDevice) {
				this.processUnknownDeviceMediaAtRule(
					mediaAtRule,
					newParent,
					parentDevice as LowLevelCompiler.UnknownDevice,
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

			this.processUnknownDeviceMediaAtRule(mediaAtRule, newParent, LowLevelCompiler.UnknownDevice.instance);
		}
	}

	processUnknownDeviceMediaAtRule(
		mediaAtRule: CssTree.AtRule,
		newParent: CssTree.ContainerBase,
		unknownDevice: LowLevelCompiler.UnknownDevice,
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
		parentDevice: ConfigModule.Device | LowLevelCompiler.UnknownDevice | null,
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

	computeDeviceSelector(baseSelector: string, device: ConfigModule.Device | LowLevelCompiler.UnknownDevice): string {
		let deviceSelector: string;

		if (this._options.compileOnlyThisDevice) {
			deviceSelector = baseSelector;
		} else {
			const deviceCssClass = this.computeDeviceCssClass(device);
			deviceSelector = MediaQueryToDevices.addDeviceFilteringToSelector(baseSelector, deviceCssClass);
		}

		return deviceSelector;
	}

	computeDeviceCssClass(device: ConfigModule.Device | LowLevelCompiler.UnknownDevice): string {
		let deviceCssClass: string;

		if (device instanceof LowLevelCompiler.UnknownDevice) {
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

	createConfigExporter(root: CssTree.Root): DeviceExpandingInputConfigModule.ConfigExporter {
		const configString = this.loadConfigString(root);
		const expandingInputConfig = DeviceExpandingInputConfigModule.ConfigParser.parse(configString);
		const expandingInputConfigExporter = new DeviceExpandingInputConfigModule.ConfigExporter(expandingInputConfig);

		return expandingInputConfigExporter;
	}

	loadConfig(root: CssTree.Root): ConfigModule.Config {
		const configExporter = this.createConfigExporter(root);
		const inputConfig = configExporter.exportToBaseConfig();
		const config = new ConfigBuilderModule.ConfigBuilder()
			.setUnits(inputConfig.units)
			.setUnknownDevice(inputConfig.unknownDevice)
			.setDeviceList(inputConfig.deviceList)
			.createConfig();

		return config;
	}

	loadScriptConfig(root: CssTree.Root): DeviceExpandingScriptConfigModule.Config {
		const configExporter = this.createConfigExporter(root);
		const scriptConfig = configExporter.exportToScriptConfig();

		return scriptConfig;
	}
}

export module LowLevelCompiler {
	export class UnknownDevice {
		private static _instance: UnknownDevice;
		static get instance(): UnknownDevice {
			if (!this._instance) {
				this._instance = new UnknownDevice();
			}
			return this._instance;
		}

		private constructor() {}
	}
}
