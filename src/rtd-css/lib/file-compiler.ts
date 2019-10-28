import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';
import { TextFormatter } from '../../core-lib/text-formatter';
import { NotImplementedError } from '../../core-lib/not-implemented-error';
import { DictionaryUtils } from '../../core-lib/dictionary-utils';
import { StringBuilder } from '../../core-lib/string-builder';
import { CssDriver } from '../../css-driver';
import { CssCompiler } from './css-compiler';
import { Options } from './options';
import { defaultCssDriver } from './default-css-driver';
import { BrowserScript } from './browser-script';
import { ConfigModule } from './config';
import { DeviceExpandingScriptConfigModule } from './device-expanding-config';
import { DeviceType } from './device-type';

export class FileCompiler {
	private _inputFilePath: string;
	private _outputDirectoryPath: string;
	private _cssDriver: CssDriver;

	private _parsedInputFilePath: path.ParsedPath;

	constructor(inputFilePath: string, outputDirectoryPath: string, cssDriver: CssDriver = defaultCssDriver) {
		this._inputFilePath = inputFilePath;
		this._outputDirectoryPath = outputDirectoryPath;
		this._cssDriver = cssDriver;

		this._parsedInputFilePath = path.parse(this._inputFilePath);
	}

	compile(outputRequest: FileCompiler.OutputRequest): void {
		const outputRequestAny = !!(outputRequest.css || outputRequest.js);
		if (!outputRequestAny) {
			return;
		}

		fsExtra.ensureDirSync(this._outputDirectoryPath);

		const inputRoot = this._cssDriver.parseCssToSourceRoot(fs.readFileSync(this._inputFilePath));

		const cssCompiler = new CssCompiler();

		if (outputRequest.css) {
			const config = cssCompiler.loadConfig(inputRoot, this._cssDriver);
			const outFileOptionsList = this.createOutputCssFileOptionsList(outputRequest, config);

			for (const outFileOptions of outFileOptionsList) {
				const outputResult = cssCompiler.compile<any>(
					inputRoot,
					outFileOptions.compileOptions,
					this._cssDriver,
				);
				fs.writeFileSync(outFileOptions.filePath, outputResult.css);
			}
		}

		if (outputRequest.js) {
			const scriptConfig = cssCompiler.loadScriptConfig(inputRoot, this._cssDriver);
			const outFileOptionsList = this.createOutputJsFileOptionsList(outputRequest, scriptConfig);

			for (const outFileOptions of outFileOptionsList) {
				const scriptSb = new StringBuilder();
				const numberOfTabsForScriptVars = 1;

				if (!outFileOptions.device) {
					const scriptConfigJson = TextFormatter.jsonStringifyPretty(scriptConfig, TextFormatter.indentTab())
						.addTabsAtBeginOfAllLines(numberOfTabsForScriptVars)
						.getText()
						.trim();

					scriptSb.add(BrowserScript.uaParserScript);
					scriptSb.add('\n\n');
					scriptSb.add(
						BrowserScript.rtdScript
							.replace("'{config}'", scriptConfigJson)
							.replace("'{breakpointsForDevice}'", 'null'),
					);
				} else {
					const breakpointsForDevice = scriptConfig.breakpointsForDeviceByDevice[outFileOptions.device.type];
					const breakpointsForDeviceJson = TextFormatter.jsonStringifyPretty(
						breakpointsForDevice,
						TextFormatter.indentTab(),
					)
						.addTabsAtBeginOfAllLines(numberOfTabsForScriptVars)
						.getText()
						.trim();

					scriptSb.add(
						BrowserScript.rtdScript
							.replace("'{config}'", 'null')
							.replace("'{breakpointsForDevice}'", breakpointsForDeviceJson),
					);
				}

				const script = scriptSb.stringify();

				fs.writeFileSync(outFileOptions.filePath, script);
			}
		}
	}

	private createOutputFilePath(outputExt: string, outputDeviceName: string = null): string {
		const outputDirectoryPath = this._outputDirectoryPath;
		const outputFileNameWithoutExt = this._parsedInputFilePath.name;

		const result = path.join(
			outputDirectoryPath,
			[outputFileNameWithoutExt, '.rtd', outputDeviceName ? `.${outputDeviceName}` : '', outputExt].join(''),
		);

		return result;
	}

	private createOutputCssFileOptions(deviceName: string): FileCompiler.OutputCssFileOptions {
		const result = <FileCompiler.OutputCssFileOptions>{
			filePath: this.createOutputFilePath('.css', deviceName),
			compileOptions: <Options>{
				compileOnlyThisDevice: deviceName,
			},
		};

		return result;
	}

	private createOutputCssFileOptionsList(
		outputRequest: FileCompiler.OutputRequest,
		config: ConfigModule.Config,
	): FileCompiler.OutputCssFileOptions[] {
		let result: FileCompiler.OutputCssFileOptions[];

		if (outputRequest.css === FileCompiler.OutputRequestCss.General) {
			result = [this.createOutputCssFileOptions(null)];
		} else if (outputRequest.css === FileCompiler.OutputRequestCss.GeneralAndDevices) {
			result = [
				this.createOutputCssFileOptions(null),
				this.createOutputCssFileOptions(config.unknownDevice.name),
				...config.deviceList.map(device => this.createOutputCssFileOptions(device.name)),
			];
		} else {
			throw new NotImplementedError();
		}

		return result;
	}

	private createOutputJsFileOptions(device: FileCompiler.OutputJsDevice): FileCompiler.OutputJsFileOptions {
		const result = <FileCompiler.OutputJsFileOptions>{
			filePath: this.createOutputFilePath('.js', device && device.name),
			device,
		};

		return result;
	}

	private createOutputJsFileOptionsList(
		outputRequest: FileCompiler.OutputRequest,
		config: DeviceExpandingScriptConfigModule.Config,
	): FileCompiler.OutputJsFileOptions[] {
		let result: FileCompiler.OutputJsFileOptions[];

		if (outputRequest.js === FileCompiler.OutputRequestJs.General) {
			result = [this.createOutputJsFileOptions(null)];
		} else if (outputRequest.js === FileCompiler.OutputRequestJs.GeneralAndDevices) {
			const deviceList: FileCompiler.OutputJsDevice[] = [
				null,
				...DictionaryUtils.getValues(config.breakpointsForDeviceByDevice).map(
					breakpointsForDevice => breakpointsForDevice.device,
				),
			];

			result = deviceList.map(device => this.createOutputJsFileOptions(device));
		} else {
			throw new NotImplementedError();
		}

		return result;
	}
}

export module FileCompiler {
	export interface OutputCssFileOptions {
		filePath: string;
		compileOptions: Options;
	}

	export interface OutputJsFileOptions {
		filePath: string;
		device: OutputJsDevice;
	}

	export interface OutputJsDevice {
		type: DeviceType;
		name: string;
	}

	export enum OutputRequestCss {
		General = 'General',
		GeneralAndDevices = 'GeneralAndDevices',
	}

	export enum OutputRequestJs {
		General = 'General',
		GeneralAndDevices = 'GeneralAndDevices',
	}

	export interface OutputRequest {
		css: OutputRequestCss;
		js: OutputRequestJs;
	}
}
