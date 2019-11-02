import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';
import { NotImplementedError } from '../../../../core-lib/not-implemented-error';
import { DictionaryUtils } from '../../../../core-lib/dictionary-utils';
import { CssDriver } from '../../../../css-driver';
import { ConcreteConfigLoader } from '../../concrete-config-loader';
import { CssCompiler, CssCompilerOptions } from '../../css-compiler';
import { JsCompiler } from '../../js-compiler';
import { defaultCssDriver } from '../../default-css-driver';
import { ConfigModule } from '../../config';
import { DeviceExpandingScriptConfigModule } from '../../device-expanding-config';
import { FileCompilerOutputRequest } from './file-compiler-output-request';

export class LowLevelFileCompiler {
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

	compile(outputRequest: FileCompilerOutputRequest): void {
		const outputRequestAny = !!(outputRequest.css || outputRequest.js);
		if (!outputRequestAny) {
			return;
		}

		fsExtra.ensureDirSync(this._outputDirectoryPath);

		const inputRoot = this._cssDriver.parseCssToSourceRoot(fs.readFileSync(this._inputFilePath));
		const configLoader = new ConcreteConfigLoader();

		if (outputRequest.css) {
			const cssConfig = configLoader.loadCssConfig(inputRoot);
			const cssCompiler = new CssCompiler();
			const outCssFileOptionsList = this.createOutputCssFileOptionsList(outputRequest, cssConfig);

			for (const outCssFile of outCssFileOptionsList) {
				const outputResult = cssCompiler.compile<any>(inputRoot, outCssFile.compileOptions, this._cssDriver);
				const outputCss = outputResult.css;
				fs.writeFileSync(outCssFile.filePath, outputCss);
			}
		}

		if (outputRequest.js) {
			const jsConfig = configLoader.loadJsConfig(inputRoot);
			const jsCompiler = new JsCompiler();
			const outJsFileOptionsList = this.createOutputJsFileOptionsList(outputRequest, jsConfig);

			for (const outJsFile of outJsFileOptionsList) {
				const outputJs = jsCompiler.compile(jsConfig, outJsFile.device);
				fs.writeFileSync(outJsFile.filePath, outputJs);
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

	private createOutputCssFileOptions(deviceName: string): LowLevelFileCompiler.OutputCssFileOptions {
		const result = <LowLevelFileCompiler.OutputCssFileOptions>{
			filePath: this.createOutputFilePath('.css', deviceName),
			compileOptions: <CssCompilerOptions>{
				compileOnlyThisDevice: deviceName,
			},
		};

		return result;
	}

	private createOutputCssFileOptionsList(
		outputRequest: FileCompilerOutputRequest,
		config: ConfigModule.Config,
	): LowLevelFileCompiler.OutputCssFileOptions[] {
		let result: LowLevelFileCompiler.OutputCssFileOptions[];

		if (outputRequest.css === FileCompilerOutputRequest.Css.General) {
			result = [this.createOutputCssFileOptions(null)];
		} else if (outputRequest.css === FileCompilerOutputRequest.Css.GeneralAndDevices) {
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

	private createOutputJsFileOptions(
		device: DeviceExpandingScriptConfigModule.Device,
	): LowLevelFileCompiler.OutputJsFileOptions {
		const result = <LowLevelFileCompiler.OutputJsFileOptions>{
			filePath: this.createOutputFilePath('.js', device && device.name),
			device,
		};

		return result;
	}

	private createOutputJsFileOptionsList(
		outputRequest: FileCompilerOutputRequest,
		config: DeviceExpandingScriptConfigModule.Config,
	): LowLevelFileCompiler.OutputJsFileOptions[] {
		let result: LowLevelFileCompiler.OutputJsFileOptions[];

		if (outputRequest.js === FileCompilerOutputRequest.Js.General) {
			result = [this.createOutputJsFileOptions(null)];
		} else if (outputRequest.js === FileCompilerOutputRequest.Js.GeneralAndDevices) {
			const deviceList: DeviceExpandingScriptConfigModule.Device[] = [
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

export module LowLevelFileCompiler {
	export interface OutputCssFileOptions {
		filePath: string;
		compileOptions: CssCompilerOptions;
	}

	export interface OutputJsFileOptions {
		filePath: string;
		device: DeviceExpandingScriptConfigModule.Device;
	}
}
