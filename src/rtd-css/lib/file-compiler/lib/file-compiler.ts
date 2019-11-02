import { CssDriver } from '../../../../css-driver';
import { defaultCssDriver } from '../../default-css-driver';
import { LowLevelFileCompiler } from './low-level-file-compiler';
import { FileCompilerOutputRequest } from './file-compiler-output-request';

export class FileCompiler {
	compile(
		outputRequest: FileCompilerOutputRequest,
		inputFilePath: string,
		outputDirectoryPath: string,
		cssDriver: CssDriver = defaultCssDriver,
	): void {
		const lowLevelFileCompiler = new LowLevelFileCompiler(inputFilePath, outputDirectoryPath, cssDriver);

		lowLevelFileCompiler.compile(outputRequest);
	}
}
