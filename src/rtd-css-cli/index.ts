#!/usr/bin/env node

import yargs from 'yargs';
import { Cli } from './lib/cli';
import { ThisProgram } from './lib/this-program';

const program = new ThisProgram(
	yargs,
	new Cli.Printer(yargs),
);

program.register();
