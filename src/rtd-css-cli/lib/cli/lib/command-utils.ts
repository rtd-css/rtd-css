import { fsEx } from '../../../../core-lib/fs-ex';
import { Program } from './program';
import { CliArgv } from './cli-argv';
import { CommandOption } from './command-option';
import { CliError } from './cli-error';

export module CommandUtils {
	export function validateFileExists(
		program: Program,
		argv: CliArgv,
		fileCommandOption: CommandOption,
	): boolean {
		const filePath = argv[fileCommandOption.name];
		let fileExists: boolean;

		try {
			fileExists = fsEx.fileExistsSync(filePath);
		} catch (e) {
			program.printer.showCommandHelpWithSingleError(fileCommandOption, e);
			return false;
		}

		if (!fileExists) {
			program.printer.showCommandHelpWithSingleError(fileCommandOption, `Can not find file "${filePath}"`);
			return false;
		}

		return true;
	}

	export function validateDirectoryExists(
		program: Program,
		argv: CliArgv,
		directoryCommandOption: CommandOption,
	): boolean {
		const directoryPath = argv[directoryCommandOption.name];
		let directoryExists: boolean;

		try {
			directoryExists = fsEx.directoryExistsSync(directoryPath);
		} catch (e) {
			program.printer.showCommandHelpWithSingleError(directoryCommandOption, e);
			return false;
		}

		if (!directoryExists) {
			program.printer.showCommandHelpWithSingleError(directoryCommandOption, `Can not find directory "${directoryPath}"`);
			return false;
		}

		return true;
	}

	export function validateOptionListNotEmpty(
		program: Program,
		argv: CliArgv,
		options: CommandOption[],
	): boolean {
		let valid: boolean = true;
		const cliErrors: CliError[] = [];

		for (const curOption of options) {
			const curOptionEmpty = stringOptionValueIsEmpty(argv, curOption);
			if (curOptionEmpty) {
				cliErrors.push(new CliError(curOption, 'Must be not empty'));
				valid = false;
			}
		}

		if (!valid) {
			program.printer.showCommandHelpWithErrors(...cliErrors);
		}

		return valid;
	}

	function stringOptionValueIsEmpty(argv: CliArgv, option: CommandOption): boolean {
		const optionValue = argv[option.name];
		const optionEmpty = !(typeof optionValue === 'string' && optionValue);
		return optionEmpty;
	}
}
