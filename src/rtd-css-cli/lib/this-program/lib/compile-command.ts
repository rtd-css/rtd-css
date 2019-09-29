import { Cli } from '../../cli';
import { FileCompiler } from '../../file-compiler';

interface CompileCommandInputData extends Cli.CommandInputData {
	inputFilePath: string;
	outputDirectoryPath: string;
}

export class CompileCommand extends Cli.Command<CompileCommandInputData> {
	inputCssFileOption: Cli.CommandOption;
	outputDirectoryOption: Cli.CommandOption;

	constructor(program: Cli.Program) {
		super(program, {
			name: 'compile',
			alias: 'c',
			describe: 'Compile the source responsive CSS to RTD CSS',
			options: null,
		});

		this.inputCssFileOption = new Cli.CommandOption(this.program, {
			name: 'input-css-file',
			alias: 'i',
			describe: 'Input responsive CSS file',
			required: true,
		});

		this.outputDirectoryOption = new Cli.CommandOption(this.program, {
			name: 'output-directory',
			alias: 'o',
			describe: 'Output directory',
			required: true,
		});

		this.options = [this.inputCssFileOption, this.outputDirectoryOption];
	}

	protected validateAndGetInputData(argv: Cli.CliArgv): CompileCommandInputData {
		if (
			!(
				Cli.CommandUtils.validateOptionListNotEmpty(this.program, argv, [
					this.inputCssFileOption,
					this.outputDirectoryOption,
				]) &&
				Cli.CommandUtils.validateFileExists(this.program, argv, this.inputCssFileOption) &&
				Cli.CommandUtils.validateDirectoryExists(this.program, argv, this.outputDirectoryOption)
			)
		) {
			return;
		}

		return <CompileCommandInputData>{
			inputFilePath: argv[this.inputCssFileOption.name],
			outputDirectoryPath: argv[this.outputDirectoryOption.name],
		};
	}

	protected actionBody(inputData: CompileCommandInputData): void {
		const compiler = new FileCompiler();
		compiler.compile(inputData.inputFilePath, inputData.outputDirectoryPath);
	}
}
