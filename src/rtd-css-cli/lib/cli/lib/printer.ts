import { CliError, CliErrorTarget, UnionError } from './cli-error';
import { CommandOption } from './command-option';
import { YargsType } from './yargs-type';

export class Printer {
	yargsInstance: YargsType;

	constructor(yargsInstance: YargsType) {
		this.yargsInstance = yargsInstance;
	}

	showCommandHelp(showCustomHelp: () => void): void {
		this.yargsInstance.showHelp();
		console.log();
		showCustomHelp();
	}

	showCommandHelpWithErrors(...cliErrors: CliError[]): void {
		this.showCommandHelp(
			() => {
				for (const curCliError of cliErrors) {
					if (!curCliError.target) {
						this.showError(curCliError.error);
					} else if (curCliError.target instanceof CommandOption) {
						this.showOptionError(curCliError.target, curCliError.error);
					} else {
						throw new Error('Error target has unexpected type');
					}
				}
			},
		);
	}

	showCommandHelpWithSingleError(
		target: CliErrorTarget,
		error: UnionError,
	) {
		this.showCommandHelpWithErrors(
			new CliError(target, error),
		);
	}

	showError(error: UnionError): void {
		const errorMessage = this.getErrorMessageFromUnionError(error);

		if (errorMessage) {
			console.log(`Error: ${errorMessage}`);
		} else {
			console.log('Error');
		}
	}

	showOptionError(option: CommandOption, error: UnionError): void {
		const errorTitle = `"${option.name}" error`;
		const errorMessage = this.getErrorMessageFromUnionError(error);

		if (errorMessage) {
			console.log(`${errorTitle}: ${errorMessage}`);
		} else {
			console.log(errorTitle);
		}
	}

	private getErrorMessageFromUnionError(error: UnionError): string {
		let errorMessage: string;
		if (!error) {
			errorMessage = null;
		} else if (typeof error === 'string') {
			errorMessage = <string>error;
		} else if (typeof error === 'object') {
			if (error.hasOwnProperty('message')) {
				errorMessage = error.message;
			}
		}
		return errorMessage;
	}
}
