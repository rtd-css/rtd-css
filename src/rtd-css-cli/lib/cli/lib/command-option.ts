import { Program } from './program';

export class CommandOption {
	program: Program;

	name: string;
	alias: string;
	describe: string;
	required: boolean;

	constructor(
		program: Program,
		options: {
			name: string,
			alias: string,
			describe: string,
			required: boolean,
		},
	) {
		this.program = program;

		this.name = options.name;
		this.alias = options.alias;
		this.describe = options.describe;
		this.required = !!options.required;
	}
}
