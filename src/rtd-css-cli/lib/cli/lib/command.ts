import { CliArgv } from './cli-argv';
import { YargsType } from './yargs-type';
import { Program } from './program';
import { CommandOption } from './command-option';

export interface CommandInputData {}

export abstract class Command<TInputData extends CommandInputData> {
	program: Program;

	name: string;
	alias: string;
	describe: string;
	options: CommandOption[];

	constructor(
		program: Program,
		options: {
			name: string,
			alias: string,
			describe: string,
			options: CommandOption[],
		},
	) {
		this.program = program;

		this.name = options.name;
		this.alias = options.alias;
		this.describe = options.describe;
		this.options = options.options;
	}

	private action(argv: CliArgv): void {
		const inputData = this.validateAndGetInputData(argv);
		if (!inputData) {
			return;
		}

		this.actionBody(inputData);
	}

	protected abstract validateAndGetInputData(argv: CliArgv): TInputData;

	protected abstract actionBody(inputData: TInputData): void;

	register(): void {
		this.program.yargsInstance.command({
			command: this.name,
			aliases: [this.alias],
			describe: this.describe,
			builder: (yargsInstance: YargsType): YargsType => {
				for (const option of this.options) {
					yargsInstance.option(
						option.name,
						{
							alias: option.alias,
							describe: option.describe,
							demandOption: option.required,
						},
					);
				}

				return yargsInstance;
			},
			handler: (argv: CliArgv): void => {
				this.action(argv);
			},
		});
	}
}
