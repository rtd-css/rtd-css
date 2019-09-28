import { CommandOption } from './command-option';

export type CliErrorTarget = null | CommandOption;
export type UnionError = string | Error | any;

export class CliError {
	constructor(
		public target: CliErrorTarget,
		public error: UnionError,
	) {}
}
