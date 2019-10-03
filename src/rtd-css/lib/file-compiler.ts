import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';
import { CssDriver } from '../../css-driver';
import { CssCompiler } from './css-compiler';
import { Options } from './options';

export class FileCompiler {
	private static readonly cssNamespaceExt = '.rtd';

	compile(inputFilePath: string, outputDirectoryPath: string, cssDriver: CssDriver): void {
		fsExtra.ensureDirSync(outputDirectoryPath);

		const inputRoot = cssDriver.parseCssToSourceRoot(fs.readFileSync(inputFilePath));

		const compiler = new CssCompiler();
		const config = compiler.loadConfig(inputRoot, cssDriver);

		const parsedInputFilePath = path.parse(inputFilePath);

		const createFileOptionsWithDevice = (outputDeviceName: string): FileCompiler.OutputFileOptions => {
			return <FileCompiler.OutputFileOptions>{
				compileOptions: <Options>{
					compileOnlyThisDevice: outputDeviceName,
				},
				filePath: this.createOutputFilePath(
					outputDirectoryPath,
					parsedInputFilePath.name,
					parsedInputFilePath.ext,
					outputDeviceName,
				),
			};
		};

		const outFileOptionsList: FileCompiler.OutputFileOptions[] = [
			createFileOptionsWithDevice(null),
			createFileOptionsWithDevice(config.unknownDevice.name),
			...config.deviceList.map(device => createFileOptionsWithDevice(device.name)),
		];

		for (const outFileOptions of outFileOptionsList) {
			const outputResult = compiler.compile<any>(inputRoot, outFileOptions.compileOptions, cssDriver);
			fs.writeFileSync(outFileOptions.filePath, outputResult.css);
		}
	}

	private createOutputFilePath(
		outputDirectoryPath: string,
		outputFileNameWithoutExt: string,
		outputExt: string,
		outputDeviceName: string = null,
	): string {
		const result = path.join(
			outputDirectoryPath,
			[
				outputFileNameWithoutExt,
				FileCompiler.cssNamespaceExt,
				outputDeviceName ? `.${outputDeviceName}` : '',
				outputExt,
			].join(''),
		);

		return result;
	}
}

export module FileCompiler {
	export interface OutputFileOptions {
		compileOptions: Options;
		filePath: string;
	}
}
