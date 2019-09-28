import { Printer } from './printer';
import { YargsType } from './yargs-type';
import { Command, CommandInputData } from './command';

export abstract class Program {
	yargsInstance: YargsType;
	printer: Printer;
	commands: Command<CommandInputData>[];

	constructor(
		yargsInstance: YargsType,
		printer: Printer,
	) {
		this.yargsInstance = yargsInstance;
		this.printer = printer;
	}

	register(): void {
		for (const command of this.commands) {
			command.register();
		}

		this.yargsInstance
			.command({
				command: '*',
				handler: () => {
					this.yargsInstance.showHelp();
				},
			})
			.demandCommand()
			.version()
			.showHelpOnFail(true)
			.help()
			.argv;
	}
}
