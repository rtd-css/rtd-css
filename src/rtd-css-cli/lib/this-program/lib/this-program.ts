import { Cli } from '../../cli';
import { CompileCommand } from './compile-command';

export class ThisProgram extends Cli.Program {
	constructor(
		yargsInstance: Cli.YargsType,
		printer: Cli.Printer,
	) {
		super(yargsInstance, printer);

		this.commands = [
			new CompileCommand(this),
		];
	}
}
