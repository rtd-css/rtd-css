import postcss from 'postcss';
import path from 'path';
import fs from 'fs';
import { Compiler, Options } from '../../rtd-css';
import { PostcssCssDriver } from '../../postcss-rtd-css';
import { Cli } from './cli';

export class FileCompiler {
	private static readonly cssNamespaceExt = '.rtd';

	compile(inputFilePath: string, outputDirectoryPath: string): void {
		const inputRoot = this.parseCssFile(inputFilePath);

		const compiler = new Compiler();
		const config = compiler.loadConfig(inputRoot, new PostcssCssDriver());

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
			const outputRoot = compiler.compile<postcss.Root>(
				inputRoot,
				outFileOptions.compileOptions,
				new PostcssCssDriver(),
			);
			fs.writeFileSync(outFileOptions.filePath, outputRoot.toResult().css);
		}
	}

	private parseCssFile(cssFilePath: string): postcss.Root {
		const css = fs.readFileSync(cssFilePath);
		const cssRoot = postcss.parse(css);
		return cssRoot;
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
