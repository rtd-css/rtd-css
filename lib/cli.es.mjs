#!/usr/bin/env node
import yargs from 'yargs';
import fs from 'fs';
import fsExtra from 'fs-extra';
import postcss from 'postcss';
import path from 'path';
import { parse, stringify } from 'css-what';

class CliError {
	constructor(target, error) {
		this.target = target;
		this.error = error;
	}
}

class CommandOption {
	constructor(program, options) {
		this.program = program;
		this.name = options.name;
		this.alias = options.alias;
		this.describe = options.describe;
		this.required = !!options.required;
	}
}

var fsEx;
(function(fsEx) {
	fsEx.errors = {
		ENOENT: 'ENOENT',
	};
	function pathExistsSync(path, statsFilter) {
		let result;
		try {
			const stats = fs.lstatSync(path);
			result = statsFilter && stats ? statsFilter(stats) : !!stats;
		} catch (e) {
			if (e.code === fsEx.errors.ENOENT) {
				result = false;
			} else {
				throw e;
			}
		}
		return result;
	}
	fsEx.pathExistsSync = pathExistsSync;
	function fileExistsSync(path) {
		return pathExistsSync(path, stats => stats.isFile());
	}
	fsEx.fileExistsSync = fileExistsSync;
	function directoryExistsSync(path) {
		return pathExistsSync(path, stats => stats.isDirectory());
	}
	fsEx.directoryExistsSync = directoryExistsSync;
})(fsEx || (fsEx = {}));

var CommandUtils;
(function(CommandUtils) {
	function validateFileExists(program, argv, fileCommandOption) {
		const filePath = argv[fileCommandOption.name];
		let fileExists;
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
	CommandUtils.validateFileExists = validateFileExists;
	function validateDirectoryExists(program, argv, directoryCommandOption) {
		const directoryPath = argv[directoryCommandOption.name];
		let directoryExists;
		try {
			directoryExists = fsEx.directoryExistsSync(directoryPath);
		} catch (e) {
			program.printer.showCommandHelpWithSingleError(directoryCommandOption, e);
			return false;
		}
		if (!directoryExists) {
			program.printer.showCommandHelpWithSingleError(
				directoryCommandOption,
				`Can not find directory "${directoryPath}"`,
			);
			return false;
		}
		return true;
	}
	CommandUtils.validateDirectoryExists = validateDirectoryExists;
	function validateOptionListNotEmpty(program, argv, options) {
		let valid = true;
		const cliErrors = [];
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
	CommandUtils.validateOptionListNotEmpty = validateOptionListNotEmpty;
	function stringOptionValueIsEmpty(argv, option) {
		const optionValue = argv[option.name];
		const optionEmpty = !(typeof optionValue === 'string' && optionValue);
		return optionEmpty;
	}
})(CommandUtils || (CommandUtils = {}));

class Command {
	constructor(program, options) {
		this.program = program;
		this.name = options.name;
		this.alias = options.alias;
		this.describe = options.describe;
		this.options = options.options;
	}
	action(argv) {
		const inputData = this.validateAndGetInputData(argv);
		if (!inputData) {
			return;
		}
		this.actionBody(inputData);
	}
	register() {
		this.program.yargsInstance.command({
			command: this.name,
			aliases: [this.alias],
			describe: this.describe,
			builder: yargsInstance => {
				for (const option of this.options) {
					yargsInstance.option(option.name, {
						alias: option.alias,
						describe: option.describe,
						demandOption: option.required,
					});
				}
				return yargsInstance;
			},
			handler: argv => {
				this.action(argv);
			},
		});
	}
}

class Printer {
	constructor(yargsInstance) {
		this.yargsInstance = yargsInstance;
	}
	showCommandHelp(showCustomHelp) {
		this.yargsInstance.showHelp();
		console.log();
		showCustomHelp();
	}
	showCommandHelpWithErrors(...cliErrors) {
		this.showCommandHelp(() => {
			for (const curCliError of cliErrors) {
				if (!curCliError.target) {
					this.showError(curCliError.error);
				} else if (curCliError.target instanceof CommandOption) {
					this.showOptionError(curCliError.target, curCliError.error);
				} else {
					throw new Error('Error target has unexpected type');
				}
			}
		});
	}
	showCommandHelpWithSingleError(target, error) {
		this.showCommandHelpWithErrors(new CliError(target, error));
	}
	showError(error) {
		const errorMessage = this.getErrorMessageFromUnionError(error);
		if (errorMessage) {
			console.log(`Error: ${errorMessage}`);
		} else {
			console.log('Error');
		}
	}
	showOptionError(option, error) {
		const errorTitle = `"${option.name}" error`;
		const errorMessage = this.getErrorMessageFromUnionError(error);
		if (errorMessage) {
			console.log(`${errorTitle}: ${errorMessage}`);
		} else {
			console.log(errorTitle);
		}
	}
	getErrorMessageFromUnionError(error) {
		let errorMessage;
		if (!error) {
			errorMessage = null;
		} else if (typeof error === 'string') {
			errorMessage = error;
		} else if (typeof error === 'object') {
			if (error.hasOwnProperty('message')) {
				errorMessage = error.message;
			}
		}
		return errorMessage;
	}
}

class Program {
	constructor(yargsInstance, printer) {
		this.yargsInstance = yargsInstance;
		this.printer = printer;
	}
	register() {
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
			.help().argv;
	}
}

function getDepth(node) {
	let depth = 0;
	let parent = node.parent;
	while (parent.type !== 'root') {
		depth += 1;
		parent = parent.parent;
	}
	return depth;
}
function doubleSpace(node) {
	node.raws.before += '\n';
}
function modifyIndent(oldIndent, newIndent) {
	let result = typeof oldIndent === 'string' ? oldIndent : '';
	result = result.trim().concat(`\n${newIndent}`);
	return result;
}
function indent(node, depth, options) {
	const indentStr = '\t'.repeat(depth);
	if (options.before) {
		node.raws.before = modifyIndent(node.raws.before, indentStr);
	}
	if (options.after) {
		node.raws.after = modifyIndent(node.raws.after, indentStr);
	}
}
/**
 * Append space to colon if necessary. See at-rule-spacing-colon test case.
 */
const params = {
	match: /(\(.*)(:)([^\s])(.*\))/g,
	replace: '$1$2 $3$4',
};
function atrule(node) {
	const nodeDepth = getDepth(node);
	indent(node, nodeDepth, {
		before: true,
		after: true,
	});
	node.raws.between = node.nodes ? ' ' : '';
	if (node.params) {
		node.raws.afterName = ' ';
		node.params = node.params.replace(params.match, params.replace);
	}
	if (nodeDepth === 0) doubleSpace(node);
}
function comment(node) {
	if (getDepth(node) === 0) doubleSpace(node);
}
function decl(node) {
	indent(node, getDepth(node), {
		before: true,
	});
	node.raws.between = ': ';
}
function rule(node) {
	const nodeDepth = getDepth(node);
	indent(node, nodeDepth, {
		before: true,
		after: true,
	});
	node.raws.between = ' ';
	node.raws.semicolon = true;
	if (node.selector.indexOf(', ') >= 0) {
		node.selector = node.selector.replace(/, /g, ',\n');
	}
	if (nodeDepth === 0) doubleSpace(node);
}
function format(node) {
	switch (node.type) {
		case 'atrule':
			atrule(node);
			break;
		case 'rule':
			rule(node);
			break;
		case 'decl':
			decl(node);
			break;
		case 'comment':
			comment(node);
			break;
	}
}
const plugin = postcss.plugin('postcss-prettify', () => css => {
	css.walk(format);
	if (css.first && css.first.raws) css.first.raws.before = '';
});
plugin.process = css => postcss([plugin]).process(css);

var CssTree;
(function(CssTree) {
	// Node type
	let NodeType;
	(function(NodeType) {
		NodeType['root'] = 'root';
		NodeType['atrule'] = 'atrule';
		NodeType['rule'] = 'rule';
		NodeType['decl'] = 'decl';
		NodeType['comment'] = 'comment';
	})((NodeType = CssTree.NodeType || (CssTree.NodeType = {})));
	// At rule name
	let AtRuleName;
	(function(AtRuleName) {
		AtRuleName['media'] = 'media';
	})((AtRuleName = CssTree.AtRuleName || (CssTree.AtRuleName = {})));
})(CssTree || (CssTree = {}));

var PostcssCssTreeUtils;
(function(PostcssCssTreeUtils) {
	function postcssNodeToNode(postcssNode) {
		let node;
		switch (postcssNode.type) {
			case PostcssCssTree.PostcssNodeType.root:
				node = new PostcssCssTree.Root(postcssNode);
				break;
			case PostcssCssTree.PostcssNodeType.atrule:
				node = new PostcssCssTree.AtRule(postcssNode);
				break;
			case PostcssCssTree.PostcssNodeType.rule:
				node = new PostcssCssTree.Rule(postcssNode);
				break;
			case PostcssCssTree.PostcssNodeType.decl:
				node = new PostcssCssTree.Declaration(postcssNode);
				break;
			case PostcssCssTree.PostcssNodeType.comment:
				node = new PostcssCssTree.Comment(postcssNode);
				break;
			default:
				throw new Error('Unknown postcss node type');
		}
		return node;
	}
	PostcssCssTreeUtils.postcssNodeToNode = postcssNodeToNode;
})(PostcssCssTreeUtils || (PostcssCssTreeUtils = {}));

var PostcssCssTree;
(function(PostcssCssTree) {
	// Node type
	let PostcssNodeType;
	(function(PostcssNodeType) {
		PostcssNodeType['root'] = 'root';
		PostcssNodeType['atrule'] = 'atrule';
		PostcssNodeType['rule'] = 'rule';
		PostcssNodeType['decl'] = 'decl';
		PostcssNodeType['comment'] = 'comment';
	})((PostcssNodeType = PostcssCssTree.PostcssNodeType || (PostcssCssTree.PostcssNodeType = {})));
	// Base nodes
	class NodeBase {
		constructor(postcssNodeBase) {
			this._postcssNodeBase = postcssNodeBase;
		}
		get postcssNodeBase() {
			return this._postcssNodeBase;
		}
		clone() {
			const clonedPostcssNode = this._postcssNodeBase.clone();
			const clonedNode = PostcssCssTreeUtils.postcssNodeToNode(clonedPostcssNode);
			return clonedNode;
		}
		remove() {
			this._postcssNodeBase.remove();
			return this;
		}
	}
	PostcssCssTree.NodeBase = NodeBase;
	class ChildNode extends NodeBase {
		get postcssChildNode() {
			return this._postcssNodeBase;
		}
		constructor(postcssChildNode) {
			super(postcssChildNode);
		}
	}
	PostcssCssTree.ChildNode = ChildNode;
	class ContainerBase extends NodeBase {
		get postcssContainerBase() {
			return this._postcssNodeBase;
		}
		constructor(postcssContainerBase) {
			super(postcssContainerBase);
		}
		hasNodes() {
			return !!(this.postcssContainerBase.nodes && this.postcssContainerBase.nodes.length);
		}
		each(callback) {
			this.postcssContainerBase.each((postcssNode, index) => {
				callback(PostcssCssTreeUtils.postcssNodeToNode(postcssNode), index);
			});
		}
		append(...nodes) {
			this.postcssContainerBase.append(
				...nodes.map(curNode => {
					return curNode.postcssNodeBase;
				}),
			);
			return this;
		}
		removeAll() {
			this.postcssContainerBase.removeAll();
			return this;
		}
	}
	PostcssCssTree.ContainerBase = ContainerBase;
	class ChildContainerBase extends ContainerBase {}
	PostcssCssTree.ChildContainerBase = ChildContainerBase;
	// Nodes
	class Root extends ContainerBase {
		get postcssRoot() {
			return this._postcssNodeBase;
		}
		get type() {
			return CssTree.NodeType.root;
		}
		constructor(postcssRoot) {
			super(postcssRoot);
		}
	}
	PostcssCssTree.Root = Root;
	class AtRule extends ChildContainerBase {
		get postcssAtRule() {
			return this._postcssNodeBase;
		}
		get type() {
			return CssTree.NodeType.atrule;
		}
		get name() {
			return this.postcssAtRule.name;
		}
		get params() {
			return this.postcssAtRule.params;
		}
		set params(value) {
			this.postcssAtRule.params = value;
		}
		constructor(postcssAtRule) {
			super(postcssAtRule);
		}
	}
	PostcssCssTree.AtRule = AtRule;
	class Rule extends ChildContainerBase {
		get postcssRule() {
			return this._postcssNodeBase;
		}
		get type() {
			return CssTree.NodeType.rule;
		}
		get selector() {
			return this.postcssRule.selector;
		}
		set selector(value) {
			this.postcssRule.selector = value;
		}
		constructor(postcssRule) {
			super(postcssRule);
		}
	}
	PostcssCssTree.Rule = Rule;
	class Declaration extends ChildNode {
		get postcssDeclaration() {
			return this._postcssNodeBase;
		}
		get type() {
			return CssTree.NodeType.decl;
		}
		get prop() {
			return this.postcssDeclaration.prop;
		}
		set prop(value) {
			this.postcssDeclaration.prop = value;
		}
		get value() {
			return this.postcssDeclaration.value;
		}
		set value(value) {
			this.postcssDeclaration.value = value;
		}
		get important() {
			return this.postcssDeclaration.important;
		}
		set important(value) {
			this.postcssDeclaration.important = value;
		}
		constructor(postcssDeclaration) {
			super(postcssDeclaration);
		}
	}
	PostcssCssTree.Declaration = Declaration;
	class Comment extends ChildNode {
		get postcssComment() {
			return this._postcssNodeBase;
		}
		get type() {
			return CssTree.NodeType.comment;
		}
		constructor(postcssComment) {
			super(postcssComment);
		}
	}
	PostcssCssTree.Comment = Comment;
})(PostcssCssTree || (PostcssCssTree = {}));

class PostcssCssResult {
	constructor(cssRoot) {
		this._result = cssRoot.toResult();
	}
	get cssRoot() {
		return this._result.root;
	}
	get css() {
		return this._result.css;
	}
}

class PostcssCssDriver {
	createRoot(sourceRoot) {
		return new PostcssCssTree.Root(sourceRoot || postcss.root());
	}
	createAtRule(sourceAtRule) {
		return new PostcssCssTree.AtRule(sourceAtRule || postcss.atRule());
	}
	createRule(sourceRule) {
		return new PostcssCssTree.Rule(sourceRule || postcss.rule());
	}
	createDeclaration(sourceDeclaration) {
		return new PostcssCssTree.Declaration(sourceDeclaration || postcss.decl());
	}
	createComment(sourceComment) {
		return new PostcssCssTree.Comment(sourceComment || postcss.comment());
	}
	sourceRootToRoot(sourceRoot) {
		return this.createRoot(sourceRoot);
	}
	rootToSourceRoot(root) {
		return root.postcssRoot;
	}
	inputCssToSourceRoot(inputCss) {
		let sourceRoot;
		if (typeof inputCss === 'string') {
			sourceRoot = this.parseCssToSourceRoot(inputCss);
		} else {
			sourceRoot = inputCss;
		}
		return sourceRoot;
	}
	parseCssToSourceRoot(css) {
		return postcss.parse(css);
	}
	createResult(sourceRoot) {
		return new PostcssCssResult(sourceRoot);
	}
	prettify(sourceRoot) {
		return plugin.process(sourceRoot).root;
	}
}

const defaultCssDriver = new PostcssCssDriver();

class NotImplementedError extends Error {
	constructor() {
		super('Not implemented');
	}
}

var DictionaryUtils;
(function(DictionaryUtils) {
	function getValues(dictionary) {
		const values = [];
		for (const key in dictionary) {
			values.push(dictionary[key]);
		}
		return values;
	}
	DictionaryUtils.getValues = getValues;
})(DictionaryUtils || (DictionaryUtils = {}));

const clone = require('clone');
const deepClone = function(arg) {
	return clone.call(this, arg);
};

class Range {
	constructor(from, to) {
		let normalizedFrom = from;
		if (normalizedFrom === null) {
			normalizedFrom = -Infinity;
		}
		let normalizedTo = to;
		if (normalizedTo === null) {
			normalizedTo = Infinity;
		}
		if (normalizedFrom > normalizedTo) {
			throw new Error('{from} must be less than or equal to {to}');
		}
		this.from = normalizedFrom;
		this.to = normalizedTo;
	}
	static intersect(...rangeList) {
		if (rangeList.length < 2) {
			throw new Error('Number of input ranges must be greater than or equal to 2');
		}
		for (const range in rangeList) {
			if (!range) {
				throw new Error('All ranges must be not null');
			}
		}
		let result = rangeList[0];
		for (let i = 1; i < rangeList.length; ) {
			result = Range.intersectTwoRanges(result, rangeList[i]);
			if (!result) {
				break;
			}
			i = i + 1;
		}
		return result;
	}
	static intersectTwoRanges(range1, range2) {
		if (!range1 || !range2) {
			throw new Error('{range1} and {range2} required');
		}
		let result;
		if (range2.from > range1.to || range1.from > range2.to) {
			result = null;
		} else {
			result = new Range(Math.max(range1.from, range2.from), Math.min(range1.to, range2.to));
		}
		return result;
	}
}

class IndexedListFriend {
	constructor(indexedList) {
		this._indexedList = indexedList;
		this._indexedListForFriends = indexedList;
	}
}

class ListInIndexedList extends IndexedListFriend {
	constructor(indexedList) {
		super(indexedList);
		this._list = [];
	}
	each(callback) {
		for (const item of this._list) {
			callback(item);
		}
	}
	_add(...items) {
		for (const curItem of items) {
			if (!curItem) {
				throw new Error('{item} required');
			}
			this._list.push(curItem);
		}
	}
	_remove(...items) {
		for (const curItem of items) {
			if (!curItem) {
				throw new Error('{item} required');
			}
			const curItemIndex = this._list.indexOf(curItem);
			if (curItemIndex < 0) {
				throw new Error('Can not remove item because such item not found');
			}
			this._list.splice(curItemIndex, 1);
		}
	}
}

class IndexedList {
	constructor() {
		this._indices = [];
		this._indicesForFriends = [];
		this._list = new ListInIndexedList(this);
		this._listForFriends = this._list;
	}
	get list() {
		return this._list;
	}
	each(callback) {
		this._indices[0].each(callback);
	}
	map(callback) {
		return this._indices[0].map(callback);
	}
	any() {
		return this._indices[0].any();
	}
	first() {
		return this._indices[0].first();
	}
	add(...items) {
		for (const index of this._indicesForFriends) {
			index._add(...items);
		}
		this._listForFriends._add(...items);
	}
	remove(...items) {
		for (const index of this._indicesForFriends) {
			index._remove(...items);
		}
		this._listForFriends._remove(...items);
	}
	// Friends method
	// tslint:disable-next-line:no-unused-variable
	_addIndex(index) {
		this._indices.push(index);
		this._indicesForFriends.push(index);
	}
}

class IndexedListIndex extends IndexedListFriend {
	constructor(indexedList, keyFunc, allowDuplicates = false) {
		super(indexedList);
		this._dictByKey = {};
		this._keyFunc = keyFunc;
		this._allowDuplicates = allowDuplicates;
		this._indexedListForFriends._addIndex(this);
	}
	each(callback) {
		for (const key in this._dictByKey) {
			const itemsWithSuchKey = this._dictByKey[key];
			for (const item of itemsWithSuchKey) {
				callback(item);
			}
		}
	}
	map(callback) {
		const result = [];
		this.each(item => result.push(callback(item)));
		return result;
	}
	any() {
		// tslint:disable-next-line:no-unused-variable
		for (const key in this._dictByKey) {
			return true;
		}
		return false;
	}
	first() {
		for (const key in this._dictByKey) {
			return this._dictByKey[key][0];
		}
		throw new Error('Can not get first item because there are no items');
	}
	_getAll(queryKey) {
		if (!this._dictByKey.hasOwnProperty(queryKey)) {
			throw new Error('Items with such key not found');
		}
		return this._dictByKey[queryKey];
	}
	_removeAll(queryKey) {
		if (!queryKey) {
			throw new Error('{key} required');
		}
		const itemsWithSuchKey = this._dictByKey[queryKey];
		if (!itemsWithSuchKey) {
			throw new Error('Items with such key not found');
		}
		this._indexedList.remove(...itemsWithSuchKey);
	}
	// Friends method
	// tslint:disable-next-line:no-unused-variable
	_add(...items) {
		for (const curItem of items) {
			if (!curItem) {
				throw new Error('{item} required');
			}
			const key = this._keyFunc(curItem);
			if (!key) {
				throw new Error('{key} required');
			}
			let itemsWithSuchKey = this._dictByKey[key];
			if (!itemsWithSuchKey) {
				itemsWithSuchKey = [];
				this._dictByKey[key] = itemsWithSuchKey;
			}
			if (!this._allowDuplicates && itemsWithSuchKey.length) {
				throw new Error('Duplicates not allowed');
			}
			itemsWithSuchKey.push(curItem);
		}
	}
	// Friends method
	// tslint:disable-next-line:no-unused-variable
	_remove(...items) {
		for (const curItem of items) {
			if (!curItem) {
				throw new Error('{item} required');
			}
			const key = this._keyFunc(curItem);
			if (!key) {
				throw new Error('{key} required');
			}
			const itemsWithSuchKey = this._dictByKey[key];
			let curItemIndex;
			if (
				!itemsWithSuchKey ||
				(curItemIndex = itemsWithSuchKey.findIndex(_item => this._keyFunc(_item) === key)) < 0
			) {
				throw new Error('Can not remove item with such key because such item not found');
			}
			itemsWithSuchKey.splice(curItemIndex, 1);
			if (!itemsWithSuchKey.length) {
				delete this._dictByKey[key];
			}
		}
	}
}

class NonUniqueIndexedListIndex extends IndexedListIndex {
	constructor(indexedList, keyFunc) {
		super(indexedList, keyFunc, true);
	}
	getAll(queryKey) {
		return this._getAll(queryKey);
	}
	removeAll(queryKey) {
		this._removeAll(queryKey);
	}
}

class UniqueIndexedListIndex extends IndexedListIndex {
	constructor(indexedList, keyFunc) {
		super(indexedList, keyFunc, false);
	}
	get(queryKey) {
		return this._getAll(queryKey)[0];
	}
	remove(queryKey) {
		this._removeAll(queryKey);
	}
}

var ConfigModule;
(function(ConfigModule) {
	class Config {
		constructor(units, unknownDevice, deviceList) {
			this.units = units;
			this.unknownDevice = unknownDevice;
			this.deviceList = deviceList;
		}
	}
	ConfigModule.Config = Config;
	class UnknownDevice {
		constructor(name, cssClass) {
			this.name = name;
			this.cssClass = cssClass;
		}
	}
	ConfigModule.UnknownDevice = UnknownDevice;
	class Device {
		constructor(name, cssClass, maxWidth, mergeDownTo, mergeUpTo, widthRange) {
			if (!widthRange) {
				throw new Error('{widthRange} required');
			}
			this.name = name;
			this.cssClass = cssClass;
			this.maxWidth = maxWidth;
			this.mergeDownTo = mergeDownTo;
			this.mergeUpTo = mergeUpTo;
			this.widthRange = widthRange;
		}
	}
	ConfigModule.Device = Device;
	class DeviceList extends IndexedList {
		constructor() {
			super(...arguments);
			this.byNameOne = new UniqueIndexedListIndex(this, item => item.name);
		}
	}
	ConfigModule.DeviceList = DeviceList;
})(ConfigModule || (ConfigModule = {}));

var ConfigBuilderModule;
(function(ConfigBuilderModule) {
	class ConfigBuilder {
		constructor() {
			this._outputConfig = new ConfigBuilder.Data.OutputConfig();
		}
		setUnits(units) {
			this._outputConfig.units = units;
			return this;
		}
		setUnknownDevice(unknownDevice) {
			this._outputConfig.unknownDevice = unknownDevice;
			return this;
		}
		setDeviceList(deviceList) {
			this._outputConfig.deviceList = new DeviceListBuilder().setDeviceList(deviceList).createDeviceList();
			return this;
		}
		createConfig() {
			const config = new ConfigModule.Config(
				this._outputConfig.units,
				this._outputConfig.unknownDevice,
				this._outputConfig.deviceList,
			);
			return deepClone(config);
		}
	}
	ConfigBuilderModule.ConfigBuilder = ConfigBuilder;
	(function(ConfigBuilder) {
		let Data;
		(function(Data) {
			class OutputConfig {}
			Data.OutputConfig = OutputConfig;
		})((Data = ConfigBuilder.Data || (ConfigBuilder.Data = {})));
	})((ConfigBuilder = ConfigBuilderModule.ConfigBuilder || (ConfigBuilderModule.ConfigBuilder = {})));
	class DeviceListBuilder {
		constructor() {
			this._intermediateData = new DeviceListBuilder.Data.IntermediateData();
		}
		setDeviceList(deviceList) {
			if (!deviceList) {
				throw new Error('{deviceList} required');
			}
			for (const device of deviceList) {
				if (!device) {
					throw new Error('All items in {deviceList} must be not null');
				}
			}
			this.initSortedDeviceList(deviceList);
			this.initDeviceByName(deviceList);
			this.initDeviceByMaxWidth(deviceList);
			this.initDeviceRangeByName();
			this.initDeviceMergedRangeByName();
			this._outputDeviceList = this._intermediateData.sortedDeviceList.map(device => {
				return new ConfigModule.Device(
					device.name,
					device.cssClass,
					device.maxWidth,
					device.mergeDownTo,
					device.mergeUpTo,
					this._intermediateData.deviceMergedRangeByName[device.name],
				);
			});
			return this;
		}
		createDeviceList() {
			const deviceList = new ConfigModule.DeviceList();
			deviceList.add(...this._outputDeviceList);
			return deepClone(deviceList);
		}
		initSortedDeviceList(deviceList) {
			this._intermediateData.sortedDeviceList = deviceList.sort((a, b) => {
				let result;
				if (a.maxWidth < b.maxWidth) {
					result = -1;
				} else if (a.maxWidth === b.maxWidth) {
					result = 0;
				} else {
					result = 1;
				}
				return result;
			});
		}
		initDeviceByName(deviceList) {
			this._intermediateData.deviceByName = new Types.DeviceByName();
			for (const device of deviceList) {
				if (this._intermediateData.deviceByName[device.name]) {
					throw new Error('Non unique device names in {deviceList}');
				}
				this._intermediateData.deviceByName[device.name] = device;
			}
		}
		initDeviceByMaxWidth(deviceList) {
			this._intermediateData.deviceByMaxWidth = new Types.DeviceByMaxWidth();
			for (const device of deviceList) {
				if (typeof device.maxWidth !== 'number') {
					throw new Error('Device max width must be a number');
				}
				const deviceMaxWidthStr = device.maxWidth.toString();
				if (this._intermediateData.deviceByMaxWidth[deviceMaxWidthStr]) {
					throw new Error('Non unique device max widths in {deviceList}');
				}
				this._intermediateData.deviceByMaxWidth[deviceMaxWidthStr] = device;
			}
			if (!this._intermediateData.deviceByMaxWidth[Infinity.toString()]) {
				throw new Error('{deviceList} must has device with unsetted (infinity) max width');
			}
		}
		initDeviceRangeByName() {
			this._intermediateData.deviceRangeByName = new Types.DeviceRangeByName();
			let curMinWidth = -Infinity;
			for (const device of this._intermediateData.sortedDeviceList) {
				this._intermediateData.deviceRangeByName[device.name] = new Range(curMinWidth, device.maxWidth);
				curMinWidth = device.maxWidth + 1;
			}
		}
		initDeviceMergedRangeByName() {
			this._intermediateData.deviceMergedRangeByName = deepClone(this._intermediateData.deviceRangeByName);
			for (const device of this._intermediateData.sortedDeviceList) {
				if (device.mergeDownTo) {
					this.mergeDeviceUpOrDownToDevice(device, false, device.mergeDownTo);
				}
				if (device.mergeUpTo) {
					this.mergeDeviceUpOrDownToDevice(device, true, device.mergeUpTo);
				}
			}
		}
		mergeDeviceUpOrDownToDevice(device, mergeUpOrDown, mergeToDeviceName) {
			const mergeToDevice = this._intermediateData.deviceByName[mergeToDeviceName];
			if (!mergeToDevice) {
				throw new Error(
					mergeUpOrDown
						? `Device "${mergeToDeviceName}" for merging "up to" not found`
						: `Device "${mergeToDeviceName}" for merging "down to" not found`,
				);
			}
			if (mergeUpOrDown) {
				if (mergeToDevice.maxWidth < device.maxWidth) {
					throw new Error(
						[
							`Device "${mergeToDeviceName}" for merging "up to" has max width`,
							`that less than target device "${device.name}" max width`,
						].join(' '),
					);
				}
				this._intermediateData.deviceMergedRangeByName[device.name] = new Range(
					this._intermediateData.deviceMergedRangeByName[device.name].from,
					this._intermediateData.deviceRangeByName[mergeToDeviceName].to,
				);
			} else {
				if (mergeToDevice.maxWidth > device.maxWidth) {
					throw new Error(
						[
							`Device "${mergeToDeviceName}" for merging "down to" has max width`,
							`that greater than target device "${device.name}" max width`,
						].join(' '),
					);
				}
				this._intermediateData.deviceMergedRangeByName[device.name] = new Range(
					this._intermediateData.deviceRangeByName[mergeToDeviceName].from,
					this._intermediateData.deviceMergedRangeByName[device.name].to,
				);
			}
		}
	}
	ConfigBuilderModule.DeviceListBuilder = DeviceListBuilder;
	(function(DeviceListBuilder) {
		let Data;
		(function(Data) {
			class OutputDeviceList extends Array {}
			Data.OutputDeviceList = OutputDeviceList;
			class IntermediateData {}
			Data.IntermediateData = IntermediateData;
		})((Data = DeviceListBuilder.Data || (DeviceListBuilder.Data = {})));
	})((DeviceListBuilder = ConfigBuilderModule.DeviceListBuilder || (ConfigBuilderModule.DeviceListBuilder = {})));
	let Types;
	(function(Types) {
		class DeviceByName {}
		Types.DeviceByName = DeviceByName;
		class DeviceByMaxWidth {}
		Types.DeviceByMaxWidth = DeviceByMaxWidth;
		class DeviceRangeByName {}
		Types.DeviceRangeByName = DeviceRangeByName;
	})((Types = ConfigBuilderModule.Types || (ConfigBuilderModule.Types = {})));
})(ConfigBuilderModule || (ConfigBuilderModule = {}));

class BaseOptionIndexedList extends IndexedList {
	constructor() {
		super(...arguments);
		this.byNameMany = new NonUniqueIndexedListIndex(this, option => option.name);
	}
}

class RawOptionsData {
	constructor() {
		this.rawOptions = new RawOptionsData.RawOptionIndexedList();
	}
}
(function(RawOptionsData) {
	let ValueType;
	(function(ValueType) {
		ValueType['Null'] = 'Null';
		ValueType['String'] = 'String';
		ValueType['Float'] = 'Float';
	})((ValueType = RawOptionsData.ValueType || (RawOptionsData.ValueType = {})));
	class RawValue {
		constructor(type, value) {
			this.type = type;
			this.value = value;
		}
	}
	RawOptionsData.RawValue = RawValue;
	class BaseRawOption {
		constructor(name) {
			this.name = name;
			this.rawValues = [];
		}
	}
	RawOptionsData.BaseRawOption = BaseRawOption;
	class RawOption extends BaseRawOption {
		constructor(name) {
			super(name);
			this.rawSubOptions = new RawSubOptionIndexedList();
		}
	}
	RawOptionsData.RawOption = RawOption;
	class RawSubOption extends BaseRawOption {}
	RawOptionsData.RawSubOption = RawSubOption;
	class BaseRawOptionIndexedList extends BaseOptionIndexedList {}
	RawOptionsData.BaseRawOptionIndexedList = BaseRawOptionIndexedList;
	class RawOptionIndexedList extends BaseRawOptionIndexedList {}
	RawOptionsData.RawOptionIndexedList = RawOptionIndexedList;
	class RawSubOptionIndexedList extends BaseRawOptionIndexedList {}
	RawOptionsData.RawSubOptionIndexedList = RawSubOptionIndexedList;
})(RawOptionsData || (RawOptionsData = {}));

class DataSchema {
	constructor(optionSchemas) {
		this.optionSchemas = new DataSchema.OptionSchemaIndexedList();
		this.optionSchemas.add(...optionSchemas);
	}
}
(function(DataSchema) {
	let ValueFormat;
	(function(ValueFormat) {
		ValueFormat['NoValue'] = 'NoValue';
		ValueFormat['SingleValue'] = 'SingleValue';
		ValueFormat['MultipleValue'] = 'MultipleValue';
	})((ValueFormat = DataSchema.ValueFormat || (DataSchema.ValueFormat = {})));
	let ValueType;
	(function(ValueType) {
		ValueType['String'] = 'String';
		ValueType['Float'] = 'Float';
	})((ValueType = DataSchema.ValueType || (DataSchema.ValueType = {})));
	class ValueBindingToData {
		constructor(valueToProperty) {
			this.valueToProperty = valueToProperty;
		}
	}
	DataSchema.ValueBindingToData = ValueBindingToData;
	class ValueSchema {
		constructor(bindingToData, format, type) {
			this.bindingToData = bindingToData;
			this.format = format;
			this.type = type;
		}
		static createEx(bindingToData, format, type) {
			return new ValueSchema(bindingToData, format, type);
		}
		static createNoValue(bindingToData) {
			return new ValueSchema(bindingToData, ValueFormat.NoValue, null);
		}
		static createSingleValue(bindingToData, valueType) {
			return new ValueSchema(bindingToData, ValueFormat.SingleValue, valueType);
		}
		static createMultipleValue(bindingToData, valueType) {
			return new ValueSchema(bindingToData, ValueFormat.MultipleValue, valueType);
		}
	}
	DataSchema.ValueSchema = ValueSchema;
	let OptionType;
	(function(OptionType) {
		OptionType['Single'] = 'Single';
		OptionType['Multiple'] = 'Multiple';
	})((OptionType = DataSchema.OptionType || (DataSchema.OptionType = {})));
	class OptionBindingToData {
		constructor(optionToProperty) {
			this.optionToProperty = optionToProperty;
		}
	}
	DataSchema.OptionBindingToData = OptionBindingToData;
	class BaseOptionSchema {
		constructor(name, bindingToData, type, valueSchema, required, transformFunc = null) {
			this.name = name;
			this.bindingToData = bindingToData;
			this.type = type;
			this.valueSchema = valueSchema;
			this.required = required;
			this.transformFunc = transformFunc;
		}
	}
	DataSchema.BaseOptionSchema = BaseOptionSchema;
	class OptionSchema extends BaseOptionSchema {
		constructor(name, bindingToData, type, valueSchema, required, subOptionSchemas, transformFunc = null) {
			super(name, bindingToData, type, valueSchema, required, transformFunc);
			this.subOptionSchemas = new SubOptionSchemaIndexedList();
			subOptionSchemas && this.subOptionSchemas.add(...subOptionSchemas);
		}
	}
	DataSchema.OptionSchema = OptionSchema;
	class SubOptionSchema extends BaseOptionSchema {}
	DataSchema.SubOptionSchema = SubOptionSchema;
	class BaseOptionSchemaIndexedList extends BaseOptionIndexedList {}
	DataSchema.BaseOptionSchemaIndexedList = BaseOptionSchemaIndexedList;
	class OptionSchemaIndexedList extends BaseOptionSchemaIndexedList {}
	DataSchema.OptionSchemaIndexedList = OptionSchemaIndexedList;
	class SubOptionSchemaIndexedList extends BaseOptionSchemaIndexedList {}
	DataSchema.SubOptionSchemaIndexedList = SubOptionSchemaIndexedList;
	class SchemaFactory {
		createValueOptionEx(
			optionOrSubOption,
			valueFormat,
			valueType,
			name,
			optionToProperty,
			required,
			transformFunc = null,
		) {
			let optionSchema;
			const bindingToData = new OptionBindingToData(optionToProperty);
			const valueSchema = ValueSchema.createEx(null, valueFormat, valueType);
			if (optionOrSubOption) {
				optionSchema = new OptionSchema(
					name,
					bindingToData,
					OptionType.Single,
					valueSchema,
					required,
					null,
					transformFunc,
				);
			} else {
				optionSchema = new SubOptionSchema(
					name,
					bindingToData,
					OptionType.Single,
					valueSchema,
					required,
					transformFunc,
				);
			}
			return optionSchema;
		}
		createStringOption(name, optionToProperty, required, transformFunc = null) {
			return this.createValueOptionEx(
				true,
				ValueFormat.SingleValue,
				ValueType.String,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}
		createStringArrayOption(name, optionToProperty, required, transformFunc = null) {
			return this.createValueOptionEx(
				true,
				ValueFormat.MultipleValue,
				ValueType.String,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}
		createStringSubOption(name, optionToProperty, required, transformFunc = null) {
			return this.createValueOptionEx(
				false,
				ValueFormat.SingleValue,
				ValueType.String,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}
		createStringArraySubOption(name, optionToProperty, required, transformFunc = null) {
			return this.createValueOptionEx(
				false,
				ValueFormat.MultipleValue,
				ValueType.String,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}
		createFloatOption(name, optionToProperty, required, transformFunc = null) {
			return this.createValueOptionEx(
				true,
				ValueFormat.SingleValue,
				ValueType.Float,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}
		createFloatSubOption(name, optionToProperty, required, transformFunc = null) {
			return this.createValueOptionEx(
				false,
				ValueFormat.SingleValue,
				ValueType.Float,
				name,
				optionToProperty,
				required,
				transformFunc,
			);
		}
		createObjectOptionEx(optionType, name, optionToProperty, required, subOptionSchemas, transformFunc = null) {
			return new OptionSchema(
				name,
				new OptionBindingToData(optionToProperty),
				optionType,
				null,
				required,
				subOptionSchemas,
				transformFunc,
			);
		}
		createObjectOption(name, optionToProperty, required, subOptionSchemas, transformFunc = null) {
			return this.createObjectOptionEx(
				OptionType.Single,
				name,
				optionToProperty,
				required,
				subOptionSchemas,
				transformFunc,
			);
		}
		createObjectMultipleOption(name, optionToProperty, required, subOptionSchemas, transformFunc = null) {
			return this.createObjectOptionEx(
				OptionType.Multiple,
				name,
				optionToProperty,
				required,
				subOptionSchemas,
				transformFunc,
			);
		}
	}
	DataSchema.SchemaFactory = SchemaFactory;
})(DataSchema || (DataSchema = {}));

class RawOptionsDataToDataTransformer {
	transform(rawOptionsData, schema) {
		const result = {};
		const clonedRawOptionsData = deepClone(rawOptionsData);
		this.transformOptionList(
			result,
			clonedRawOptionsData.rawOptions,
			schema.optionSchemas,
			(rawOption, optionSchema) => {
				return this.transformOptionItem(rawOption, optionSchema);
			},
		);
		return result;
	}
	transformOptionList(toObject, rawOptions, optionSchemas, transformRawOptionFunc) {
		optionSchemas.each(curOptionSchema => {
			this.transformOption(toObject, rawOptions, curOptionSchema, transformRawOptionFunc);
			rawOptions.byNameMany.removeAll(curOptionSchema.name);
		});
		if (rawOptions.any()) {
			throw new Error(`Unexpected option with name "${rawOptions.first().name}"`);
		}
	}
	setOptionToObject(toObject, optionValue, optionSchema) {
		const propertyName = optionSchema.bindingToData.optionToProperty;
		toObject[propertyName] = optionSchema.transformFunc ? optionSchema.transformFunc(optionValue) : optionValue;
	}
	transformOption(toObject, rawOptions, optionSchema, transformRawOptionFunc) {
		const rawOptionsWithSuchName = rawOptions.byNameMany.getAll(optionSchema.name);
		if (!(rawOptionsWithSuchName && rawOptionsWithSuchName.length)) {
			if (optionSchema.required) {
				throw new Error(`Required option with name "${optionSchema.name}" not found`);
			}
		}
		switch (optionSchema.type) {
			case DataSchema.OptionType.Single:
				if (rawOptionsWithSuchName.length !== 1) {
					throw new Error(`Single option with name "${optionSchema.name}" occurred more that once`);
				}
				this.setOptionToObject(
					toObject,
					transformRawOptionFunc(rawOptionsWithSuchName[0], optionSchema),
					optionSchema,
				);
				break;
			case DataSchema.OptionType.Multiple:
				this.setOptionToObject(
					toObject,
					rawOptionsWithSuchName.map(curRawOption => transformRawOptionFunc(curRawOption, optionSchema)),
					optionSchema,
				);
				break;
			default:
				throw new NotImplementedError();
		}
	}
	transformOptionItem(rawOption, optionSchema) {
		let result;
		if (!optionSchema.subOptionSchemas.any()) {
			if (rawOption.rawSubOptions.any()) {
				throw new Error(`Unexpected sub option with name "${rawOption.rawSubOptions.first().name}"`);
			} else {
				const value = this.transformValue(rawOption, optionSchema);
				result = this.applyValueBindingToDataIfExists(value, optionSchema);
			}
		} else {
			result = {};
			this.transformOptionList(
				result,
				rawOption.rawSubOptions,
				optionSchema.subOptionSchemas,
				(rawSubOption, subOptionSchema) => {
					return this.transformSubOptionItem(rawSubOption, subOptionSchema);
				},
			);
		}
		return result;
	}
	transformSubOptionItem(rawSubOption, subOptionSchema) {
		const value = this.transformValue(rawSubOption, subOptionSchema);
		const result = this.applyValueBindingToDataIfExists(value, subOptionSchema);
		return result;
	}
	applyValueBindingToDataIfExists(value, optionSchema) {
		const valueBindingToData = optionSchema.valueSchema.bindingToData;
		const result = valueBindingToData ? { [valueBindingToData.valueToProperty]: value } : value;
		return result;
	}
	transformValue(rawOption, optionSchema) {
		let result;
		switch (optionSchema.valueSchema.format) {
			case DataSchema.ValueFormat.NoValue:
				if (rawOption.rawValues.length > 0) {
					throw new Error(`Option with name "${optionSchema.name}" can not has values`);
				}
				result = true;
				break;
			case DataSchema.ValueFormat.SingleValue:
				if (rawOption.rawValues.length !== 1) {
					throw new Error(`Option with name "${optionSchema.name}" must has one value`);
				}
				result = this.transformValueItem(rawOption.rawValues[0], optionSchema);
				break;
			case DataSchema.ValueFormat.MultipleValue:
				result = this.transformValueItemList(rawOption.rawValues, optionSchema);
				break;
			default:
				throw new NotImplementedError();
		}
		return result;
	}
	transformValueItem(rawValue, optionSchema) {
		let result;
		switch (rawValue.type) {
			case RawOptionsData.ValueType.Null:
				result = null;
				break;
			case RawOptionsData.ValueType.String:
				if (optionSchema.valueSchema.type !== DataSchema.ValueType.String) {
					throw new Error(`Option with name "${optionSchema.name}" must has only string values`);
				}
				result = rawValue.value;
				break;
			case RawOptionsData.ValueType.Float:
				if (optionSchema.valueSchema.type !== DataSchema.ValueType.Float) {
					throw new Error(`Option with name "${optionSchema.name}" must has only float number values`);
				}
				result = rawValue.value;
				break;
			default:
				throw new NotImplementedError();
		}
		return result;
	}
	transformValueItemList(rawValueList, optionSchema) {
		return rawValueList.map(rawValue => this.transformValueItem(rawValue, optionSchema));
	}
}

var FloatNumberParser;
(function(FloatNumberParser) {
	const floatNumberRegEx = /^[+-]?\d+(\.\d+)?$/;
	function parse(string) {
		if (typeof string !== 'string') {
			throw new Error('{string} must be a string');
		}
		if (!string.match(floatNumberRegEx)) {
			throw new Error('Can not parse float number from string');
		}
		const floatNumber = Number(string);
		return floatNumber;
	}
	FloatNumberParser.parse = parse;
	function tryParse(string) {
		let floatNumber;
		try {
			floatNumber = parse(string);
		} catch (e) {
			floatNumber = null;
		}
		return floatNumber;
	}
	FloatNumberParser.tryParse = tryParse;
})(FloatNumberParser || (FloatNumberParser = {}));

class TokensData {
	constructor() {
		this.tokens = [];
	}
}
(function(TokensData) {
	let TokenType;
	(function(TokenType) {
		TokenType['OptionName'] = 'OptionName';
		TokenType['SubOptionName'] = 'SubOptionName';
		TokenType['KeywordValue'] = 'KeywordValue';
		TokenType['StringValue'] = 'StringValue';
		TokenType['FloatValue'] = 'FloatValue';
	})((TokenType = TokensData.TokenType || (TokensData.TokenType = {})));
	class Token {
		constructor(type, value, typedValue) {
			this.type = type;
			this.value = value;
			this.typedValue = typedValue;
		}
		static createToken(type, value) {
			const typedValue = value;
			const token = new Token(type, value, typedValue);
			return token;
		}
		static createTokenWithTypedValue(type, value, typedValue) {
			const token = new Token(type, value, typedValue);
			return token;
		}
	}
	TokensData.Token = Token;
})(TokensData || (TokensData = {}));

class StringToTokensDataTransformer {
	transform(string) {
		const stringParts = this.stringToStringParts(string);
		const tokensData = this.stringPartsToTokensData(stringParts);
		return tokensData;
	}
	stringToStringParts(string) {
		const stringPartsRegEx = /(\S+)/g;
		const stringParts = string.match(stringPartsRegEx);
		return stringParts;
	}
	stringPartsToTokensData(stringParts) {
		const tokensData = new TokensData();
		tokensData.tokens = stringParts.map(part => {
			let token;
			if (part.startsWith('--')) {
				token = TokensData.Token.createToken(TokensData.TokenType.OptionName, part.substr('--'.length).trim());
			} else if (part.startsWith('[') && part.endsWith(']')) {
				token = TokensData.Token.createToken(
					TokensData.TokenType.SubOptionName,
					part.substr(1, part.length - 2).trim(),
				);
			} else if (part.startsWith('#')) {
				token = TokensData.Token.createToken(TokensData.TokenType.KeywordValue, part.substr('#'.length).trim());
			} else if (
				StringToTokensDataTransformer._quotationMarks.includes(part.charAt(0)) &&
				part.charAt(0) === part.charAt(part.length - 1)
			) {
				token = TokensData.Token.createToken(
					TokensData.TokenType.StringValue,
					part.substr(1, part.length - 2).trim(),
				);
			} else {
				const partAsFloatNumber = FloatNumberParser.tryParse(part);
				if (typeof partAsFloatNumber === 'number') {
					token = TokensData.Token.createTokenWithTypedValue(
						TokensData.TokenType.FloatValue,
						part,
						partAsFloatNumber,
					);
				} else {
					throw new Error('Unexpected string part in config string');
				}
			}
			return token;
		});
		return tokensData;
	}
}
StringToTokensDataTransformer._quotationMarks = ["'", '"'];

class TokensDataToRawOptionsDataTransformer {
	transform(tokensData) {
		this._rawOptionsData = new RawOptionsData();
		for (const token of tokensData.tokens) {
			switch (token.type) {
				case TokensData.TokenType.OptionName:
					this.processOptionNameToken(token);
					break;
				case TokensData.TokenType.SubOptionName:
					this.processSubOptionNameToken(token);
					break;
				case TokensData.TokenType.KeywordValue:
					this.processKeywordValueToken(token);
					break;
				case TokensData.TokenType.StringValue:
					this.processStringValueToken(token);
					break;
				case TokensData.TokenType.FloatValue:
					this.processFloatValueToken(token);
					break;
				default:
					throw new Error('Unknown token type');
			}
		}
		return this._rawOptionsData;
	}
	processOptionNameToken(token) {
		const optionName = token.value;
		const rawOption = new RawOptionsData.RawOption(optionName);
		this._currentRawOption = rawOption;
		this._rawOptionsData.rawOptions.add(rawOption);
	}
	processSubOptionNameToken(token) {
		if (this._currentRawOption) {
			const subOptionName = token.value;
			const rawSubOption = new RawOptionsData.RawSubOption(subOptionName);
			this._currentRawSubOption = rawSubOption;
			this._currentRawOption.rawSubOptions.add(rawSubOption);
		} else {
			throw new Error('Sub option must be only in option');
		}
	}
	processKeywordValueToken(token) {
		let rawValue;
		const keywordValue = token.value;
		if (keywordValue === 'rtd-none') {
			rawValue = new RawOptionsData.RawValue(RawOptionsData.ValueType.Null, null);
		} else {
			throw new Error('Unknown keyword value');
		}
		this.addValue(rawValue);
	}
	processStringValueToken(token) {
		const rawValue = new RawOptionsData.RawValue(RawOptionsData.ValueType.String, token.typedValue);
		this.addValue(rawValue);
	}
	processFloatValueToken(token) {
		const rawValue = new RawOptionsData.RawValue(RawOptionsData.ValueType.Float, token.typedValue);
		this.addValue(rawValue);
	}
	addValue(rawValue) {
		if (this._currentRawSubOption) {
			this._currentRawSubOption.rawValues.push(rawValue);
		} else if (this._currentRawOption) {
			this._currentRawOption.rawValues.push(rawValue);
		} else {
			throw new Error('Value must be only in option or sub option');
		}
	}
}

var OptionsParser;
(function(OptionsParser) {
	function parse(string, schema) {
		const tokensData = new StringToTokensDataTransformer().transform(string);
		const rawOptionsData = new TokensDataToRawOptionsDataTransformer().transform(tokensData);
		const data = new RawOptionsDataToDataTransformer().transform(rawOptionsData, schema);
		return data;
	}
	OptionsParser.parse = parse;
	class DataSchema$1 extends DataSchema {}
	OptionsParser.DataSchema = DataSchema$1;
})(OptionsParser || (OptionsParser = {}));

var InputConfigModule;
(function(InputConfigModule) {
	let ConfigParser;
	(function(ConfigParser) {
		const schemaFactory = new OptionsParser.DataSchema.SchemaFactory();
		const schema = new OptionsParser.DataSchema([
			schemaFactory.createStringOption('rtd-units', 'units', true),
			schemaFactory.createObjectOption('rtd-unknown-device', 'unknownDevice', true, [
				schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
				schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
			]),
			schemaFactory.createObjectMultipleOption('rtd-device', 'deviceList', true, [
				schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
				schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
				schemaFactory.createFloatSubOption('rtd-device-max-width', 'maxWidth', true, value =>
					value === null ? Infinity : value,
				),
				schemaFactory.createStringSubOption('rtd-device-merge-down-to', 'mergeDownTo', true),
				schemaFactory.createStringSubOption('rtd-device-merge-up-to', 'mergeUpTo', true),
			]),
		]);
		function parse(string) {
			const config = OptionsParser.parse(string, schema);
			return config;
		}
		ConfigParser.parse = parse;
	})((ConfigParser = InputConfigModule.ConfigParser || (InputConfigModule.ConfigParser = {})));
})(InputConfigModule || (InputConfigModule = {}));

var ArrayUtils;
(function(ArrayUtils) {
	function isEqual(arr1, arr2) {
		if (!arr1) {
			throw new Error('{arr1} required');
		}
		if (!arr2) {
			throw new Error('{arr2} required');
		}
		const isEqual = arr1.length === arr2.length && arr1.every((item, index) => item === arr2[index]);
		return isEqual;
	}
	ArrayUtils.isEqual = isEqual;
})(ArrayUtils || (ArrayUtils = {}));

class Dictionary {
	constructor() {
		this._dict = {};
	}
	has(key) {
		const hasItem = this._dict.hasOwnProperty(key);
		return hasItem;
	}
	add(key, value) {
		const hasItem = this._dict.hasOwnProperty(key);
		if (hasItem) {
			throw new Error(`Item with key "${key}" already added to dictionary`);
		}
		this.set(key, value);
	}
	set(key, value) {
		this._dict[key] = value;
	}
	get(key) {
		const hasItem = this._dict.hasOwnProperty(key);
		if (!hasItem) {
			throw new Error(`Item with key "${key}" not found in dictionary`);
		}
		return this._dict[key];
	}
	getIfExists(key) {
		const hasItem = this._dict.hasOwnProperty(key);
		return hasItem ? this._dict[key] : null;
	}
}

var DictionaryCreator;
(function(DictionaryCreator) {
	let Target;
	(function(Target) {
		Target['Dictionary'] = 'Dictionary';
		Target['Object'] = 'Object';
		Target['Map'] = 'Map';
	})(Target || (Target = {}));
	function createFromArrayEx(target, array, keySelector, valueSelector) {
		let dictionary = null;
		let object = null;
		let map = null;
		if (target === Target.Dictionary) {
			dictionary = new Dictionary();
		} else if (target === Target.Object) {
			object = {};
		} else if (target === Target.Map) {
			map = new Map();
		} else {
			throw new NotImplementedError();
		}
		for (const item of array) {
			const key = keySelector(item);
			const value = valueSelector(item);
			if (target === Target.Dictionary) {
				dictionary.add(key, value);
			} else if (target === Target.Object) {
				object[key] = value;
			} else if (target === Target.Map) {
				map.set(key, value);
			} else {
				throw new NotImplementedError();
			}
		}
		if (target === Target.Dictionary) {
			return dictionary;
		}
		if (target === Target.Object) {
			return object;
		}
		if (target === Target.Map) {
			return map;
		}
		throw new NotImplementedError();
	}
	function createDictionaryFromArray(array, keySelector, valueSelector) {
		return createFromArrayEx(Target.Dictionary, array, keySelector, valueSelector);
	}
	DictionaryCreator.createDictionaryFromArray = createDictionaryFromArray;
	function createObjectFromArray(array, keySelector, valueSelector) {
		return createFromArrayEx(Target.Object, array, keySelector, valueSelector);
	}
	DictionaryCreator.createObjectFromArray = createObjectFromArray;
	function createMapFromArray(array, keySelector, valueSelector) {
		return createFromArrayEx(Target.Map, array, keySelector, valueSelector);
	}
	DictionaryCreator.createMapFromArray = createMapFromArray;
})(DictionaryCreator || (DictionaryCreator = {}));

var DeviceType;
(function(DeviceType) {
	DeviceType['Unknown'] = 'Unknown';
	DeviceType['Mobile'] = 'Mobile';
	DeviceType['Tablet'] = 'Tablet';
	DeviceType['Desktop'] = 'Desktop';
})(DeviceType || (DeviceType = {}));

var DeviceExpandingScriptConfigModule;
(function(DeviceExpandingScriptConfigModule) {
	class Device {
		constructor(type, name, cssClass) {
			this.type = type;
			this.name = name;
			this.cssClass = cssClass;
		}
	}
	DeviceExpandingScriptConfigModule.Device = Device;
	class Breakpoint {
		constructor(device, maxWidth) {
			this.device = device;
			this.maxWidth = maxWidth;
		}
	}
	DeviceExpandingScriptConfigModule.Breakpoint = Breakpoint;
	class BreakpointsForDevice {
		constructor(device, breakpoints) {
			this.device = device;
			this.breakpoints = breakpoints;
		}
	}
	DeviceExpandingScriptConfigModule.BreakpointsForDevice = BreakpointsForDevice;
})(DeviceExpandingScriptConfigModule || (DeviceExpandingScriptConfigModule = {}));

var DeviceExpandingInputConfigModule;
(function(DeviceExpandingInputConfigModule) {
	let ConfigParser;
	(function(ConfigParser) {
		const schemaFactory = new OptionsParser.DataSchema.SchemaFactory();
		const deviceSubOptionSchemas = [
			schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
			schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
			schemaFactory.createStringArraySubOption('rtd-device-breakpoints', 'breakpoints', true),
		];
		const schema = new OptionsParser.DataSchema([
			schemaFactory.createStringOption('rtd-units', 'units', true),
			schemaFactory.createStringArrayOption('rtd-breakpoints', 'breakpoints', true),
			schemaFactory.createObjectOption('rtd-unknown-device', 'unknownDevice', true, [
				schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
				schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
			]),
			schemaFactory.createObjectOption('rtd-mobile-device', 'mobileDevice', false, deviceSubOptionSchemas),
			schemaFactory.createObjectOption('rtd-tablet-device', 'tabletDevice', false, deviceSubOptionSchemas),
			schemaFactory.createObjectOption('rtd-desktop-device', 'desktopDevice', false, deviceSubOptionSchemas),
		]);
		function parse(string) {
			const config = OptionsParser.parse(string, schema);
			config.unknownDevice && (config.unknownDevice.type = DeviceType.Unknown);
			config.mobileDevice && (config.mobileDevice.type = DeviceType.Mobile);
			config.tabletDevice && (config.tabletDevice.type = DeviceType.Tablet);
			config.desktopDevice && (config.desktopDevice.type = DeviceType.Desktop);
			return config;
		}
		ConfigParser.parse = parse;
	})(
		(ConfigParser =
			DeviceExpandingInputConfigModule.ConfigParser || (DeviceExpandingInputConfigModule.ConfigParser = {})),
	);
	// TODO: Remake static methods to instance methods. There are so many static
	// methods in this class because this class was transformed from module.
	class ConfigExporter {
		constructor(config) {
			this._config = config;
			this._deviceList = ConfigExporter.createDeviceListFromConfig(config);
			this._deviceByName = ConfigExporter.createDeviceByName(this._deviceList);
			this._initialBreakpoints = ConfigExporter.parseInitialBreakpoints(config.breakpoints, this._deviceByName);
			this._initialBreakpointByName = ConfigExporter.createBreakpointByName(this._initialBreakpoints);
		}
		exportToBaseConfig() {
			const baseConfig = {
				units: this._config.units,
				unknownDevice: {
					name: this._config.unknownDevice.name,
					cssClass: this._config.unknownDevice.cssClass,
				},
				deviceList: this._deviceList.map(device => {
					const outDevice = {
						name: device.name,
						cssClass: device.cssClass,
						maxWidth: this._initialBreakpointByName.get(device.name).maxWidth,
						mergeDownTo: null,
						mergeUpTo: null,
					};
					return outDevice;
				}),
			};
			return baseConfig;
		}
		exportToScriptConfig() {
			const scriptConfig = {
				breakpointsForDeviceByDevice: DictionaryCreator.createObjectFromArray(
					this._deviceList,
					device => device.type,
					device => {
						const breakpoints = ConfigExporter.parseBreakpoints(
							device.breakpoints,
							this._deviceByName,
							this._initialBreakpointByName,
						);
						return new DeviceExpandingScriptConfigModule.BreakpointsForDevice(
							ConfigExporter.inputDeviceToScriptDevice(device),
							breakpoints,
						);
					},
				),
			};
			scriptConfig.breakpointsForDeviceByDevice[
				DeviceType.Unknown
			] = new DeviceExpandingScriptConfigModule.BreakpointsForDevice(
				this._config.unknownDevice,
				this._initialBreakpoints,
			);
			return scriptConfig;
		}
		static createDeviceListFromConfig(config) {
			const allNullableDevices = [config.mobileDevice, config.tabletDevice, config.desktopDevice];
			const devices = allNullableDevices.filter(device => !!device);
			return devices;
		}
		static createDeviceByName(deviceList) {
			return DictionaryCreator.createDictionaryFromArray(deviceList, device => device.name, device => device);
		}
		static createBreakpointByName(breakpoints) {
			return DictionaryCreator.createDictionaryFromArray(
				breakpoints,
				breakpoint => breakpoint.device.name,
				breakpoint => breakpoint,
			);
		}
		static parseBreakpointsRaw(tokens, deviceByName) {
			if (tokens.length % 2 === 0) {
				throw new Error('Breakpoints must end with device name but not with max width');
			}
			const breakpoints = [];
			for (let i = 0; i < tokens.length; i += 2) {
				// Device
				const deviceName = tokens[i];
				if (!deviceByName.has(deviceName)) {
					throw new Error(`Device with name "${deviceName}" not found in breakpoints`);
				}
				const device = deviceByName.get(deviceName);
				// Max width
				let maxWidth;
				if (i + 1 < tokens.length) {
					const maxWidthStr = tokens[i + 1];
					if (maxWidthStr === null) {
						maxWidth = null;
					} else if (typeof maxWidthStr === 'string') {
						maxWidth = FloatNumberParser.tryParse(maxWidthStr);
						if (typeof maxWidth !== 'number') {
							throw new Error('Max width in breakpoints must be a number');
						}
					} else {
						throw new Error('Max width in breakpoints has invalid type');
					}
				} else {
					maxWidth = Infinity;
				}
				// Breakpoint
				const curBreakpoint = new DeviceExpandingScriptConfigModule.Breakpoint(
					ConfigExporter.inputDeviceToScriptDevice(device),
					maxWidth,
				);
				breakpoints.push(curBreakpoint);
			}
			return breakpoints;
		}
		static validateBreakpoints_allMaxWidthsAreNumbers(breakpoints) {
			for (const curBreakpoint of breakpoints) {
				if (typeof curBreakpoint.maxWidth !== 'number') {
					return false;
				}
			}
			return true;
		}
		static validateBreakpoints_validOrdering(breakpoints, all = false) {
			// Device ordering
			const deviceTypes = breakpoints.map(curBreakpoint => curBreakpoint.device.type);
			const deviceOrderingValid = all
				? ArrayUtils.isEqual(deviceTypes, ConfigExporter.allOrderedDeviceTypes)
				: ArrayUtils.isEqual(
						deviceTypes,
						ConfigExporter.allOrderedDeviceTypes.filter(type => deviceTypes.includes(type)),
				  );
			if (!deviceOrderingValid) {
				return false;
			}
			// Max width ordering
			let maxWidthOrderingValid = true;
			for (let i = 1; i < breakpoints.length; i++) {
				const curMaxWidth = breakpoints[i].maxWidth;
				const prevMaxWidth = breakpoints[i - 1].maxWidth;
				if (!(prevMaxWidth < curMaxWidth)) {
					maxWidthOrderingValid = false;
					break;
				}
			}
			if (maxWidthOrderingValid && breakpoints[breakpoints.length - 1].maxWidth !== Infinity) {
				maxWidthOrderingValid = false;
			}
			if (!maxWidthOrderingValid) {
				return false;
			}
			// Valid
			return true;
		}
		static parseInitialBreakpoints(tokens, deviceByName) {
			const breakpoints = ConfigExporter.parseBreakpointsRaw(tokens, deviceByName);
			if (!ConfigExporter.validateBreakpoints_allMaxWidthsAreNumbers(breakpoints)) {
				throw new Error('All max widths in initial breakpoints must be a numbers');
			}
			if (!ConfigExporter.validateBreakpoints_validOrdering(breakpoints, true)) {
				throw new Error('Invalid ordering in initial breakpoints');
			}
			return breakpoints;
		}
		static parseBreakpoints(tokens, deviceByName, initialBreakpointByName) {
			// Parse breakpoints
			const breakpoints = ConfigExporter.parseBreakpointsRaw(tokens, deviceByName);
			// Replace null max widths to initial values
			for (const curBreakpoint of breakpoints) {
				if (typeof curBreakpoint.maxWidth === 'number') {
					continue;
				}
				const name = curBreakpoint.device.name;
				if (!initialBreakpointByName.has(name)) {
					throw new Error(`Initial breakpoint with name "${name}" not found`);
				}
				const initialBreakpoint = initialBreakpointByName.get(name);
				curBreakpoint.maxWidth = initialBreakpoint.maxWidth;
			}
			// Validate
			if (!ConfigExporter.validateBreakpoints_allMaxWidthsAreNumbers(breakpoints)) {
				throw new Error('All max widths in breakpoints must be a numbers');
			}
			if (!ConfigExporter.validateBreakpoints_validOrdering(breakpoints, false)) {
				throw new Error('Invalid ordering in breakpoints');
			}
			// Return
			return breakpoints;
		}
		static inputDeviceToScriptDevice(inputDevice) {
			const scriptDevice = new DeviceExpandingScriptConfigModule.Device(
				inputDevice.type,
				inputDevice.name,
				inputDevice.cssClass,
			);
			return scriptDevice;
		}
	}
	ConfigExporter.allOrderedDeviceTypes = [DeviceType.Mobile, DeviceType.Tablet, DeviceType.Desktop];
	DeviceExpandingInputConfigModule.ConfigExporter = ConfigExporter;
})(DeviceExpandingInputConfigModule || (DeviceExpandingInputConfigModule = {}));

class CssConfigStringLoader {
	loadConfigString(root, removeConfigDecl = false) {
		let configString;
		let configFoundInCss = false;
		root.each(node => {
			if (node.type === CssTree.NodeType.rule) {
				const rule = node;
				if (rule.selector.toLowerCase() === 'html') {
					rule.each(node => {
						if (node.type === CssTree.NodeType.decl) {
							const decl = node;
							if (decl.prop === '--rtd-config') {
								configString = decl.value;
								configFoundInCss = true;
								if (removeConfigDecl) {
									decl.remove();
								}
							}
						}
					});
					if (removeConfigDecl) {
						if (!rule.hasNodes()) {
							rule.remove();
						}
					}
				}
			}
		});
		if (!configFoundInCss) {
			throw new Error('RTD CSS config not found in CSS');
		}
		return configString;
	}
	removeConfigDecl(root) {
		this.loadConfigString(root, true);
	}
}

class RtdCssSelectorParser {
	addDeviceFilteringToSelector(selector, deviceCssClass) {
		const parsedSelector = parse(selector);
		for (const subSelector of parsedSelector) {
			const firstToken = subSelector[0];
			const deviceClassToken = {
				type: 'attribute',
				name: 'class',
				action: 'element',
				value: deviceCssClass,
				ignoreCase: false,
			};
			if (firstToken.type === 'tag' && firstToken.name && firstToken.name.toLowerCase() === 'html') {
				subSelector.splice(1, 0, deviceClassToken);
			} else {
				const htmlTagToken = {
					type: 'tag',
					name: 'html',
				};
				const descendantCombinatorToken = {
					type: 'descendant',
				};
				subSelector.splice(0, 0, htmlTagToken, deviceClassToken, descendantCombinatorToken);
			}
		}
		return stringify(parsedSelector);
	}
}

class ConcreteConfigLoader {
	loadCssConfig(root) {
		const configExporter = this.createConfigExporter(root);
		const inputConfig = configExporter.exportToBaseConfig();
		const config = new ConfigBuilderModule.ConfigBuilder()
			.setUnits(inputConfig.units)
			.setUnknownDevice(
				new ConfigModule.UnknownDevice(inputConfig.unknownDevice.name, inputConfig.unknownDevice.cssClass),
			)
			.setDeviceList(inputConfig.deviceList)
			.createConfig();
		return config;
	}
	loadJsConfig(root) {
		const configExporter = this.createConfigExporter(root);
		const config = configExporter.exportToScriptConfig();
		return config;
	}
	createConfigExporter(root) {
		const configStringLoader = new CssConfigStringLoader();
		const configString = configStringLoader.loadConfigString(root);
		const expandingInputConfig = DeviceExpandingInputConfigModule.ConfigParser.parse(configString);
		const expandingInputConfigExporter = new DeviceExpandingInputConfigModule.ConfigExporter(expandingInputConfig);
		return expandingInputConfigExporter;
	}
}

class ValueInUnits {
	constructor(value = 0, units = null) {
		this.value = value;
		this.units = units;
	}
}

class CssValue {
	constructor(value) {
		if (typeof value === 'string') {
			const stringValue = value;
			this.value = stringValue;
			this.valueInUnits = CssValue.tryParseValueInUnits(stringValue);
		} else if (value instanceof ValueInUnits) {
			const valueInUnits = value;
			this.value = `${valueInUnits.value}${valueInUnits.units}`;
			this.valueInUnits = valueInUnits;
		} else if (!value) {
			this.value = null;
			this.valueInUnits = null;
		} else {
			throw new Error('{value} has invalid type');
		}
	}
	static parseValueInUnits(value) {
		if (typeof value !== 'string') {
			throw new Error('{value} must be a string');
		}
		let valueInUnits;
		const normalizedValue = value.trim();
		let matchResult;
		if ((matchResult = normalizedValue.match(/(\d*\.?\d+)([a-z]+)/)) && matchResult[0] === matchResult.input) {
			valueInUnits = new ValueInUnits(Number(matchResult[1]), matchResult[2]);
		} else if ((matchResult = normalizedValue.match(/^[+-]?\d+(\.\d+)?$/))) {
			valueInUnits = new ValueInUnits(Number(normalizedValue));
		} else {
			throw new Error('Invalid {value}');
		}
		return valueInUnits;
	}
	static tryParseValueInUnits(value) {
		let valueInUnits;
		try {
			valueInUnits = CssValue.parseValueInUnits(value);
		} catch (e) {
			valueInUnits = null;
		}
		return valueInUnits;
	}
}

class RangeInUnits {
	constructor(range, units) {
		this.range = range;
		this.units = units;
	}
}

class StringBuilder {
	constructor() {
		this._parts = [];
		this._space = ' ';
	}
	stringify() {
		return this._parts.join('');
	}
	isEmpty() {
		return !this._parts.length;
	}
	add(...parts) {
		this._parts.push(...parts);
	}
	addSpaceIfNotEmpty() {
		if (!this.isEmpty()) {
			this.add(this._space);
		}
	}
	addIfNotEmpty(...parts) {
		if (!this.isEmpty()) {
			this.add(...parts);
		}
	}
}

const mediaQueryLib = require('css-mediaquery');
class MediaQueryParser {
	parse(mediaQueryString) {
		return {
			orQueries: mediaQueryLib.parse(mediaQueryString),
		};
	}
}

class MediaQueryAst {
	constructor(orQueries = null) {
		this._orQueries = [];
		if (orQueries) {
			this._orQueries.push(...orQueries);
		}
	}
	get orQueries() {
		return this._orQueries;
	}
	addOrQueries(...orQueries) {
		this._orQueries.push(...orQueries);
	}
	removeRangeFeaturesInUnits(featureName, units) {
		for (const orQuery of this._orQueries) {
			orQuery.removeRangeFeaturesInUnits(featureName, units);
		}
	}
}
class MediaQueryOrQueryAst {
	constructor(inverse = null, type = null, features = null) {
		this.inverse = inverse;
		this.type = type;
		this._features = [];
		if (features) {
			this._features.push(...features);
		}
	}
	get features() {
		return this._features;
	}
	isEmpty() {
		return !this.type && this._features.length === 0;
	}
	addFeatures(...features) {
		this._features.push(...features);
	}
	removeRangeFeaturesInUnits(featureName, units) {
		this._features = this._features.filter(feature => !feature.isRangeFeatureInUnits(featureName, units));
	}
}
class MediaQueryFeatureAst {
	constructor(modifier = null, name = null, value = null) {
		this.modifier = modifier;
		this.name = name;
		this.value = value;
	}
	isRangeFeatureInUnits(featureName, units) {
		return (
			this.name === featureName &&
			(this.modifier === 'min' || this.modifier === 'max') &&
			(this.value.valueInUnits && this.value.valueInUnits.units === units)
		);
	}
}
var MqRangeFeatureSummaryForUnitsType;
(function(MqRangeFeatureSummaryForUnitsType) {
	MqRangeFeatureSummaryForUnitsType['NoRange'] = 'NoRange';
	MqRangeFeatureSummaryForUnitsType['EmptyRange'] = 'EmptyRange';
	MqRangeFeatureSummaryForUnitsType['HasRange'] = 'HasRange';
})(MqRangeFeatureSummaryForUnitsType || (MqRangeFeatureSummaryForUnitsType = {}));
class MqRangeFeatureSummaryForUnits {
	static createNoRange(featureName) {
		MqRangeFeatureSummaryForUnits.validateFeatureName(featureName);
		const result = new MqRangeFeatureSummaryForUnits();
		result.featureName = featureName;
		result.type = MqRangeFeatureSummaryForUnitsType.NoRange;
		return result;
	}
	static createEmptyRange(featureName) {
		MqRangeFeatureSummaryForUnits.validateFeatureName(featureName);
		const result = new MqRangeFeatureSummaryForUnits();
		result.featureName = featureName;
		result.type = MqRangeFeatureSummaryForUnitsType.EmptyRange;
		return result;
	}
	static createHasRange(featureName, rangeInUnits) {
		MqRangeFeatureSummaryForUnits.validateFeatureName(featureName);
		const result = new MqRangeFeatureSummaryForUnits();
		result.featureName = featureName;
		result.type = MqRangeFeatureSummaryForUnitsType.HasRange;
		result.rangeInUnits = rangeInUnits;
		return result;
	}
	static createHasRangeWithRangeAndUnits(featureName, range, units) {
		return MqRangeFeatureSummaryForUnits.createHasRange(featureName, new RangeInUnits(range, units));
	}
	static validateFeatureName(featureName) {
		if (!featureName) {
			throw new Error('{featureName} required');
		}
	}
}
class MediaQuery {
	constructor(mediaQuery) {
		if (typeof mediaQuery === 'string') {
			this.initFromMediaQueryString(mediaQuery);
		} else if (mediaQuery instanceof MediaQueryAst) {
			this.initFromMediaQueryAst(mediaQuery);
		} else {
			throw new Error('{mediaQuery} has invalid type');
		}
	}
	stringify() {
		const stringBuilder = new StringBuilder();
		const notEmptyOrQueryList = this.mediaQueryAst.orQueries.filter(orQuery => !orQuery.isEmpty());
		for (const orQuery of notEmptyOrQueryList) {
			stringBuilder.addIfNotEmpty(', ');
			if (orQuery.type) {
				if (orQuery.inverse) {
					stringBuilder.addSpaceIfNotEmpty();
					stringBuilder.add('not');
				}
				stringBuilder.addSpaceIfNotEmpty();
				stringBuilder.add(orQuery.type);
			}
			for (const feature of orQuery.features) {
				stringBuilder.addIfNotEmpty(' and ');
				stringBuilder.add('(');
				if (feature.modifier) {
					stringBuilder.add(`${feature.modifier}-`);
				}
				stringBuilder.add(feature.name);
				if (feature.value.value) {
					stringBuilder.add(': ');
					stringBuilder.add(feature.value.value);
				}
				stringBuilder.add(')');
			}
		}
		const result = stringBuilder.stringify();
		return result;
	}
	getRangeFeatureSummaries(featureName, units) {
		const rangeFeatureSummaryList = this.mediaQueryAst.orQueries.map(orQuery => {
			const ranges = orQuery.features
				.filter(feature => feature.isRangeFeatureInUnits(featureName, units))
				.map(feature => {
					let range;
					const value = feature.value.valueInUnits.value;
					if (feature.modifier === 'min') {
						range = new Range(value, Infinity);
					} else {
						range = new Range(-Infinity, value);
					}
					return range;
				});
			let rangeFeatureSummary;
			if (ranges.length === 0) {
				rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createNoRange(featureName);
			} else if (ranges.length === 1) {
				rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits(
					featureName,
					ranges[0],
					units,
				);
			} else {
				const totalRange = Range.intersect(...ranges);
				if (totalRange) {
					rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits(
						featureName,
						totalRange,
						units,
					);
				} else {
					rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createEmptyRange(featureName);
				}
			}
			return rangeFeatureSummary;
		});
		return rangeFeatureSummaryList;
	}
	getRangeFeatureSummariesAndRemove(featureName, units) {
		const result = this.getRangeFeatureSummaries(featureName, units);
		this.mediaQueryAst.removeRangeFeaturesInUnits(featureName, units);
		return result;
	}
	initFromMediaQueryString(mediaQueryString) {
		const mediaQueryParser = new MediaQueryParser();
		const libraryMediaQueryAst = mediaQueryParser.parse(mediaQueryString);
		this.mediaQueryAst = this.libAstToAst(libraryMediaQueryAst);
	}
	initFromMediaQueryAst(mediaQueryAst) {
		this.mediaQueryAst = mediaQueryAst;
	}
	libAstToAst(libAst) {
		const ast = new MediaQueryAst();
		ast.addOrQueries(
			...libAst.orQueries.map(orQuery => {
				const outOrQuery = new MediaQueryOrQueryAst();
				outOrQuery.inverse = orQuery.inverse;
				outOrQuery.type = orQuery.type;
				outOrQuery.addFeatures(
					...orQuery.expressions.map(feature => {
						const outFeature = new MediaQueryFeatureAst();
						outFeature.modifier = feature.modifier;
						outFeature.name = feature.feature;
						outFeature.value = new CssValue(feature.value);
						return outFeature;
					}),
				);
				return outOrQuery;
			}),
		);
		return ast;
	}
	// tslint:disable-next-line:no-unused-variable
	astToLibAst(ast) {
		const libAst = {
			orQueries: ast.orQueries.map(orQuery => {
				const outOrQuery = {
					inverse: orQuery.inverse,
					type: orQuery.type,
					expressions: orQuery.features.map(feature => {
						const outFeature = {
							modifier: feature.modifier,
							feature: feature.name,
							value: feature.value.value,
						};
						return outFeature;
					}),
				};
				return outOrQuery;
			}),
		};
		return libAst;
	}
}

class InputProjection {}
class InputProjectionBuilder {
	constructor(config, mediaQueryString) {
		this._config = config;
		this._mediaQueryString = mediaQueryString;
	}
	createInputProjection() {
		const mediaQuery = new MediaQuery(this._mediaQueryString);
		const widths = mediaQuery.getRangeFeatureSummariesAndRemove('width', this._config.units);
		const inputProjection = new InputProjection();
		inputProjection.mediaQueryWithoutWidths = mediaQuery;
		inputProjection.widths = widths;
		return inputProjection;
	}
}

var PassedQuery_Passed;
(function(PassedQuery_Passed) {
	PassedQuery_Passed['NotPassed'] = 'NotPassed';
	PassedQuery_Passed['Passed'] = 'Passed';
})(PassedQuery_Passed || (PassedQuery_Passed = {}));
var PassedQuery_QueryType;
(function(PassedQuery_QueryType) {
	PassedQuery_QueryType['Empty'] = 'Empty';
	PassedQuery_QueryType['NotEmpty'] = 'NotEmpty';
})(PassedQuery_QueryType || (PassedQuery_QueryType = {}));
class BasePassedQuery {}
class PassedQueryFactory {
	constructor(passedQueryConstructor) {
		this.passedQueryConstructor = passedQueryConstructor;
	}
	createNotPassed() {
		const result = new this.passedQueryConstructor();
		result.passed = PassedQuery_Passed.NotPassed;
		result.queryType = null;
		result.query = null;
		return result;
	}
	createPassedEmpty() {
		const result = new this.passedQueryConstructor();
		result.passed = PassedQuery_Passed.Passed;
		result.queryType = PassedQuery_QueryType.Empty;
		result.query = null;
		return result;
	}
	createPassedNotEmpty(query) {
		const result = new this.passedQueryConstructor();
		result.passed = PassedQuery_Passed.Passed;
		result.queryType = PassedQuery_QueryType.NotEmpty;
		result.query = query;
		return result;
	}
}

class PassedMediaQuery extends BasePassedQuery {}
class PassedMediaQueryOrQuery extends BasePassedQuery {}
class MediaQueryPasser {
	passMediaQuery(mediaQueryAst, rangeFeatureSummaryList) {
		if (rangeFeatureSummaryList.length !== mediaQueryAst.orQueries.length) {
			throw new Error('{rangeFeatureSummaryList} must has same length as {orQueries} length');
		}
		const passedOrQueryList = [];
		const orQueriesLength = rangeFeatureSummaryList.length;
		for (let i = 0; i < orQueriesLength; i++) {
			const rangeFeatureSummary = rangeFeatureSummaryList[i];
			const orQuery = mediaQueryAst.orQueries[i];
			const passedOrQuery = this.passOrQuery(orQuery, rangeFeatureSummary);
			passedOrQueryList.push(passedOrQuery);
		}
		const passedMediaQuery = this.passedOrQueryListToPassedMediaQuery(passedOrQueryList);
		return passedMediaQuery;
	}
	passOrQuery(orQuery, rangeFeatureSummary) {
		let passedOrQuery;
		const passedOrQueryFactory = new PassedQueryFactory(PassedMediaQueryOrQuery);
		switch (rangeFeatureSummary.type) {
			case MqRangeFeatureSummaryForUnitsType.EmptyRange:
				passedOrQuery = passedOrQueryFactory.createNotPassed();
				break;
			case MqRangeFeatureSummaryForUnitsType.NoRange:
			case MqRangeFeatureSummaryForUnitsType.HasRange:
				let passedOrQueryValue;
				if (rangeFeatureSummary.type === MqRangeFeatureSummaryForUnitsType.NoRange) {
					passedOrQueryValue = orQuery;
				} else if (rangeFeatureSummary.type === MqRangeFeatureSummaryForUnitsType.HasRange) {
					passedOrQueryValue = deepClone(orQuery);
					const range = rangeFeatureSummary.rangeInUnits.range;
					const rangeStartsWithInfinity = range.from === Number.NEGATIVE_INFINITY;
					const rangeEndsWithInfinity = range.to === Number.POSITIVE_INFINITY;
					if (!rangeStartsWithInfinity) {
						passedOrQueryValue.addFeatures(
							new MediaQueryFeatureAst(
								'min',
								'width',
								new CssValue(new ValueInUnits(range.from, rangeFeatureSummary.rangeInUnits.units)),
							),
						);
					}
					if (!rangeEndsWithInfinity) {
						passedOrQueryValue.addFeatures(
							new MediaQueryFeatureAst(
								'max',
								'width',
								new CssValue(new ValueInUnits(range.to, rangeFeatureSummary.rangeInUnits.units)),
							),
						);
					}
				}
				passedOrQuery = passedOrQueryValue.isEmpty()
					? passedOrQueryFactory.createPassedEmpty()
					: passedOrQueryFactory.createPassedNotEmpty(passedOrQueryValue);
				break;
		} // switch
		return passedOrQuery;
	}
	passedOrQueryListToPassedMediaQuery(orQueryList) {
		let passedMediaQuery;
		const passedMediaQueryFactory = new PassedQueryFactory(PassedMediaQuery);
		const passedOrQueryList = orQueryList.filter(orQuery => orQuery.passed === PassedQuery_Passed.Passed);
		if (!passedOrQueryList.length) {
			passedMediaQuery = passedMediaQueryFactory.createNotPassed();
		} else {
			const notEmptyOrQueryList = passedOrQueryList.filter(
				orQuery => orQuery.queryType === PassedQuery_QueryType.NotEmpty,
			);
			if (!notEmptyOrQueryList.length) {
				passedMediaQuery = passedMediaQueryFactory.createPassedEmpty();
			} else {
				passedMediaQuery = passedMediaQueryFactory.createPassedNotEmpty(
					new MediaQueryAst(notEmptyOrQueryList.map(orQuery => orQuery.query)),
				);
			}
		}
		return passedMediaQuery;
	}
}

class OutputProjection {}
(function(OutputProjection) {
	class DeviceOutput {}
	OutputProjection.DeviceOutput = DeviceOutput;
})(OutputProjection || (OutputProjection = {}));
class OutputProjectionBuilder {
	constructor(config, inputProjection) {
		if (!config) {
			throw new Error('{config} required');
		}
		if (!inputProjection) {
			throw new Error('{input} required');
		}
		this._config = config;
		this._inputProjection = inputProjection;
		this.computeOutput();
	}
	createOutputProjection() {
		return deepClone(this._outputProjection);
	}
	computeOutput() {
		this._outputProjection = new OutputProjection();
		this._outputProjection.mediaQueryWithoutWidths = deepClone(this._inputProjection.mediaQueryWithoutWidths);
		this._outputProjection.deviceOutputList = this.computeDeviceOutputList();
	}
	computeDeviceOutputList() {
		const deviceOutputList = this._config.deviceList.map(device => {
			const deviceOutput = this.computeDeviceOutput(device);
			return deviceOutput;
		});
		return deviceOutputList;
	}
	computeDeviceOutput(device) {
		const deviceOutput = new OutputProjection.DeviceOutput();
		deviceOutput.device = device;
		const mediaQueryPasser = new MediaQueryPasser();
		const mediaQueryAst = this._outputProjection.mediaQueryWithoutWidths.mediaQueryAst;
		const widths = this._inputProjection.widths.map(width => this.applyWidthToDevice(device, width));
		deviceOutput.passedMediaQuery = mediaQueryPasser.passMediaQuery(mediaQueryAst, widths);
		return deviceOutput;
	}
	applyWidthToDevice(device, width) {
		let outputWidth;
		if (
			width.type === MqRangeFeatureSummaryForUnitsType.NoRange ||
			width.type === MqRangeFeatureSummaryForUnitsType.EmptyRange
		) {
			outputWidth = width;
		} else if (width.type === MqRangeFeatureSummaryForUnitsType.HasRange) {
			let outputWidthRange = Range.intersect(width.rangeInUnits.range, device.widthRange);
			if (!outputWidthRange) {
				outputWidth = MqRangeFeatureSummaryForUnits.createEmptyRange('width');
			} else {
				outputWidthRange = new Range(
					outputWidthRange.from !== device.widthRange.from ? outputWidthRange.from : -Infinity,
					outputWidthRange.to !== device.widthRange.to ? outputWidthRange.to : Infinity,
				);
				outputWidth = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits(
					'width',
					outputWidthRange,
					this._config.units,
				);
			}
		}
		return outputWidth;
	}
}

class MediaQueryToDevicesCompiler {
	mediaQueryToDeviceMediaQueries(config, mediaQuery) {
		if (!config) {
			throw new Error('{config} required');
		}
		if (!mediaQuery) {
			throw new Error('{mediaQuery} required');
		}
		const inputProjection = new InputProjectionBuilder(config, mediaQuery).createInputProjection();
		const outputProjection = new OutputProjectionBuilder(config, inputProjection).createOutputProjection();
		const result = new MediaQueryToDevicesCompiler.DeviceMediaQueryIndexedList();
		result.add(...outputProjection.deviceOutputList);
		return result;
	}
}
(function(MediaQueryToDevicesCompiler) {
	class DeviceMediaQueryIndexedList extends IndexedList {
		constructor() {
			super(...arguments);
			this.byDeviceNameOne = new UniqueIndexedListIndex(this, item => item.device.name);
		}
	}
	MediaQueryToDevicesCompiler.DeviceMediaQueryIndexedList = DeviceMediaQueryIndexedList;
})(MediaQueryToDevicesCompiler || (MediaQueryToDevicesCompiler = {}));

class LowLevelCssCompiler {
	constructor() {
		this._options = {};
	}
	setOptions(options) {
		const finalOptions = {};
		if (options) {
			Object.assign(finalOptions, options);
		}
		this._options = finalOptions;
	}
	setConfig(config) {
		this._config = config;
	}
	setCssDriver(cssDriver) {
		this._cssDriver = cssDriver;
	}
	compile(root) {
		const resultRoot = this.processRoot(root);
		if (!this._options.notRemoveConfigDecl) {
			const configStringLoader = new CssConfigStringLoader();
			configStringLoader.removeConfigDecl(resultRoot);
		}
		return resultRoot;
	}
	processRoot(root) {
		const newRoot = this._cssDriver.createRoot();
		const deviceName = this._options.compileOnlyThisDevice;
		let device;
		if (!deviceName) {
			device = null;
		} else {
			if (deviceName === this._config.unknownDevice.name) {
				device = this._config.unknownDevice;
			} else {
				device = this._config.deviceList.byNameOne.get(deviceName);
				if (!device) {
					throw new Error(`Device with name "${deviceName}" not found`);
				}
			}
		}
		this.processChildNodesOfNode(root, newRoot, device);
		return newRoot;
	}
	processChildNodesOfNode(node, newParent, parentDevice) {
		node.each(child => {
			if (child.type === CssTree.NodeType.atrule) {
				this.processAtRule(child, newParent, parentDevice);
			} else if (child.type === CssTree.NodeType.rule) {
				this.processRule(child, newParent, parentDevice);
			} else if (child.type === CssTree.NodeType.decl) {
				this.processDecl(child, newParent);
			}
		});
	}
	processAtRule(atRule, newParent, parentDevice) {
		if (atRule.name === CssTree.AtRuleName.media) {
			this.processMediaAtRule(atRule, newParent, parentDevice);
		} else {
			if (!parentDevice) {
				newParent.append(atRule.clone());
			} else {
				const newAtRule = this.cloneContainerWithoutChildNodes(atRule);
				newParent.append(newAtRule);
				this.processChildNodesOfNode(atRule, newAtRule, parentDevice);
			}
		}
	}
	processMediaAtRule(mediaAtRule, newParent, parentDevice) {
		const mtdCompiler = new MediaQueryToDevicesCompiler();
		const mediaQueryList = mtdCompiler.mediaQueryToDeviceMediaQueries(this._config, mediaAtRule.params);
		if (parentDevice) {
			if (parentDevice instanceof ConfigModule.UnknownDevice) {
				this.processUnknownDeviceMediaAtRule(mediaAtRule, newParent, parentDevice);
			} else if (parentDevice instanceof ConfigModule.Device) {
				const mediaQuery = mediaQueryList.byDeviceNameOne.get(parentDevice.name);
				this.processDeviceMediaAtRule(mediaAtRule, newParent, mediaQuery);
			} else {
				throw new NotImplementedError();
			}
		} else {
			mediaQueryList.each(mediaQuery => {
				this.processDeviceMediaAtRule(mediaAtRule, newParent, mediaQuery);
			});
			this.processUnknownDeviceMediaAtRule(mediaAtRule, newParent, this._config.unknownDevice);
		}
	}
	processUnknownDeviceMediaAtRule(mediaAtRule, newParent, unknownDevice) {
		const newMediaAtRule = this.cloneContainerWithoutChildNodes(mediaAtRule);
		newMediaAtRule.params = new MediaQuery(mediaAtRule.params).stringify();
		newParent.append(newMediaAtRule);
		this.processChildNodesOfNode(mediaAtRule, newMediaAtRule, unknownDevice);
	}
	processDeviceMediaAtRule(mediaAtRule, newParent, mediaQuery) {
		const passed = mediaQuery.passedMediaQuery.passed;
		switch (passed) {
			case PassedQuery_Passed.NotPassed: {
				// Nothing to do
				break;
			}
			case PassedQuery_Passed.Passed: {
				this.processMediaAtRuleWithMediaQuery_passed(mediaAtRule, newParent, mediaQuery);
				break;
			}
			default: {
				throw new NotImplementedError();
			}
		}
	}
	processMediaAtRuleWithMediaQuery_passed(mediaAtRule, newParent, mediaQuery) {
		const queryType = mediaQuery.passedMediaQuery.queryType;
		switch (queryType) {
			case PassedQuery_QueryType.Empty: {
				this.processChildNodesOfNode(mediaAtRule, newParent, mediaQuery.device);
				break;
			}
			case PassedQuery_QueryType.NotEmpty: {
				const newMediaAtRule = this.cloneContainerWithoutChildNodes(mediaAtRule);
				newMediaAtRule.params = new MediaQuery(mediaQuery.passedMediaQuery.query).stringify();
				newParent.append(newMediaAtRule);
				this.processChildNodesOfNode(mediaAtRule, newMediaAtRule, mediaQuery.device);
				break;
			}
			default: {
				throw new NotImplementedError();
			}
		}
	}
	processRule(rule, newParent, parentDevice) {
		if (!parentDevice) {
			newParent.append(rule.clone());
		} else {
			const newRule = this.cloneContainerWithoutChildNodes(rule);
			newRule.selector = this.computeDeviceSelector(rule.selector, parentDevice);
			newParent.append(newRule);
			this.processChildNodesOfNode(rule, newRule, null);
		}
	}
	computeDeviceSelector(baseSelector, device) {
		let deviceSelector;
		if (this._options.compileOnlyThisDevice) {
			deviceSelector = baseSelector;
		} else {
			const deviceCssClass = this.computeDeviceCssClass(device);
			const rtdCssSelectorParser = new RtdCssSelectorParser();
			deviceSelector = rtdCssSelectorParser.addDeviceFilteringToSelector(baseSelector, deviceCssClass);
		}
		return deviceSelector;
	}
	computeDeviceCssClass(device) {
		let deviceCssClass;
		if (device instanceof ConfigModule.UnknownDevice) {
			deviceCssClass = this._config.unknownDevice.cssClass;
		} else if (device instanceof ConfigModule.Device) {
			deviceCssClass = device.cssClass;
		} else {
			throw new NotImplementedError();
		}
		return deviceCssClass;
	}
	processDecl(decl, newParent) {
		newParent.append(decl.clone());
	}
	cloneContainerWithoutChildNodes(container) {
		const clonedContainer = container.clone();
		clonedContainer.removeAll();
		return clonedContainer;
	}
}

class CssCompiler {
	compile(inputCss, options = null, cssDriver = defaultCssDriver) {
		const inCssRoot = cssDriver.inputCssToSourceRoot(inputCss);
		const inCompilerCssRoot = cssDriver.sourceRootToRoot(inCssRoot);
		const lowLevelCssCompiler = new LowLevelCssCompiler();
		const configLoader = new ConcreteConfigLoader();
		const config = configLoader.loadCssConfig(inCompilerCssRoot);
		lowLevelCssCompiler.setConfig(config);
		lowLevelCssCompiler.setOptions(options);
		lowLevelCssCompiler.setCssDriver(cssDriver);
		const outCompilerCssRoot = lowLevelCssCompiler.compile(inCompilerCssRoot);
		let outCssRoot = cssDriver.rootToSourceRoot(outCompilerCssRoot);
		outCssRoot = cssDriver.prettify(outCssRoot);
		const outCssResult = cssDriver.createResult(outCssRoot);
		return outCssResult;
	}
}

var IndentType;
(function(IndentType) {
	IndentType['Tab'] = 'Tab';
	IndentType['Spaces'] = 'Spaces';
})(IndentType || (IndentType = {}));
class IndentStyle {
	constructor(type) {
		this.type = type;
	}
}
class TabIndentStyle extends IndentStyle {
	constructor() {
		super(IndentType.Tab);
	}
}
class SpacesIndentStyle extends IndentStyle {
	constructor(numberOfSpaces) {
		super(IndentType.Spaces);
		this.numberOfSpaces = numberOfSpaces;
	}
}
class TextFormatter {
	//
	// Contructor
	//
	constructor(text, defaultLineBreak = TextFormatter.defaultLineBreak) {
		this._text = text;
		this.normalizeLineBreaks();
	}
	//
	// Create functions
	//
	static jsonStringifyPretty(value, indentStyle) {
		if (!indentStyle) {
			throw new Error('{indentStyle} required');
		}
		let textFormatter;
		if (indentStyle instanceof SpacesIndentStyle) {
			const typedIndentStyle = indentStyle;
			textFormatter = new TextFormatter(JSON.stringify(value, null, typedIndentStyle.numberOfSpaces));
		} else if (indentStyle instanceof TabIndentStyle) {
			const numberOfSpaces = 10;
			textFormatter = new TextFormatter(JSON.stringify(value, null, numberOfSpaces));
			textFormatter = textFormatter.spacesIndentsToTabIndents(numberOfSpaces);
		}
		return textFormatter;
	}
	//
	// Public methods
	//
	getText() {
		return TextFormatter.normalizeLineBreaks(this._text);
	}
	static spacesIndentsToTabIndents(text, numberOfSpaces) {
		return text.replace(new RegExp(' '.repeat(numberOfSpaces), 'g'), '	');
	}
	spacesIndentsToTabIndents(numberOfSpaces) {
		this._text = TextFormatter.spacesIndentsToTabIndents(this._text, numberOfSpaces);
		return this;
	}
	static tabIndentsToSpacesIndents(text, numberOfSpaces) {
		return text.replace(new RegExp('	', 'g'), ' '.repeat(numberOfSpaces));
	}
	tabIndentsToSpacesIndents(numberOfSpaces) {
		this._text = TextFormatter.tabIndentsToSpacesIndents(this._text, numberOfSpaces);
		return this;
	}
	static addTabsAtBeginOfAllLines(text, numberOfTabs) {
		const initialLines = this.splitToLines(text);
		const resultLines = initialLines.map(line => '\t'.repeat(numberOfTabs) + line);
		const resultText = this.linesToText(resultLines);
		return resultText;
	}
	addTabsAtBeginOfAllLines(numberOfTabs) {
		this._text = TextFormatter.addTabsAtBeginOfAllLines(this._text, numberOfTabs);
		return this;
	}
	//
	// Private methods
	//
	static normalizeLineBreaks(text) {
		return text.replace(TextFormatter.lineBreakRegEx, TextFormatter.defaultLineBreak);
	}
	normalizeLineBreaks() {
		this._text = TextFormatter.normalizeLineBreaks(this._text);
		return this;
	}
	static splitToLines(text) {
		return this.normalizeLineBreaks(text).split(TextFormatter.defaultLineBreak);
	}
	// tslint:disable-next-line:no-unused-variable
	splitToLines() {
		return TextFormatter.splitToLines(this._text);
	}
	static linesToText(lines) {
		return lines.join(TextFormatter.defaultLineBreak);
	}
	//
	// Indent styles creating methods
	//
	static indentTab() {
		return new TabIndentStyle();
	}
	static indentSpaces(numberOfSpaces) {
		return new SpacesIndentStyle(numberOfSpaces);
	}
}
//
// Static fields
//
TextFormatter.lineBreakRegEx = /\r\n|\n\r|\n|\r/g;
TextFormatter.rnLineBreak = '\r\n';
TextFormatter.nLineBreak = '\n';
TextFormatter.defaultLineBreak = TextFormatter.nLineBreak;

const rtdScript = `(function () {

	var breakpointsForDevice = '{breakpointsForDevice}';

	var config = '{config}';

	var DeviceType = {
		Unknown: 'Unknown',
		Mobile: 'Mobile',
		Tablet: 'Tablet',
		Desktop: 'Desktop',
	};

	var desktopOsList = [
		'Windows',
		'Mac OS',
		'CentOS',
		'Fedora',
		'FreeBSD',
		'Debian',
		'GNU',
		'Linux',
		'OpenBSD',
		'PCLinuxOS',
		'RedHat',
		'Solaris',
		'SUSE',
		'Ubuntu',
		'Unix',
		'VectorLinux',
	];

	var lastBreakpoint;

	function getBreakpoint(breakpoints, winWidth) {
		var result,
			i, len,
			curBreakpoint;

		len = breakpoints.length;
		for (i = 0; i < len; i++) {
			curBreakpoint = breakpoints[i];

			if (i === len - 1 || winWidth <= curBreakpoint.maxWidth) {
				result = curBreakpoint;
				break;
			}
		}

		return result;
	}

	function addClassToElement(element, classToAdd) {
		var newClassName = element.className || '';
		if (newClassName) {
			newClassName += ' ';
		}
		newClassName += classToAdd;

		element.className = newClassName;
	}

	function removeClassFromElement(element, classToRemove) {
		if (element.className) {
			element.className = element.className.replace(
				new RegExp('(?:^|\\s)' + classToRemove + '(?!\\S)', 'g'),
				'',
			);
		}
	}

	function startRtdForBreakpoints(breakpointsForDevice) {
		setInterval(
			function () {
				var win = window,
					doc = document,
					docElem = doc.documentElement,
					body = doc.getElementsByTagName('body')[0],
					winWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
					breakpoint = getBreakpoint(breakpointsForDevice.breakpoints, winWidth);

				if (breakpoint !== lastBreakpoint) {
					if (lastBreakpoint) {
						removeClassFromElement(document.documentElement, lastBreakpoint.device.cssClass);
					}

					addClassToElement(document.documentElement, breakpoint.device.cssClass);

					lastBreakpoint = breakpoint;
				}
			},
			20,
		);
	}

	function startRtdForConfig(config) {
		var uaParser = new UAParser(),
			uaData = uaParser.getResult(),
			breakpointsForDevice;

		switch (uaData.device.model) {

			case 'mobile':
				breakpointsForDevice = config.breakpointsByDevice[DeviceType.Mobile];
				break;

			case 'tablet':
				breakpointsForDevice = config.breakpointsByDevice[DeviceType.Tablet];
				break;

			default:
				if (desktopOsList.indexOf(uaData.os.name) > -1) {
					breakpointsForDevice = config.breakpointsByDevice[DeviceType.Desktop];
				} else {
					breakpointsForDevice = config.breakpointsByDevice[DeviceType.Unknown];
				}

		}

		startRtdForBreakpoints(breakpointsForDevice);
	}

	function init() {
		if (breakpointsForDevice) {
			startRtdForBreakpoints(breakpointsForDevice);
		} else {
			startRtdForConfig(config);
		}
	}

	init();

})()`;

// tslint:disable:max-line-length
const uaParserScript = String.raw`/*!
* UAParser.js v0.7.20
* Lightweight JavaScript-based User-Agent string parser
* https://github.com/faisalman/ua-parser-js
*
* Copyright © 2012-2019 Faisal Salman <f@faisalman.com>
* Licensed under MIT License
*/
(function(window,undefined){"use strict";var LIBVERSION="0.7.20",EMPTY="",UNKNOWN="?",FUNC_TYPE="function",UNDEF_TYPE="undefined",OBJ_TYPE="object",STR_TYPE="string",MAJOR="major",MODEL="model",NAME="name",TYPE="type",VENDOR="vendor",VERSION="version",ARCHITECTURE="architecture",CONSOLE="console",MOBILE="mobile",TABLET="tablet",SMARTTV="smarttv",WEARABLE="wearable",EMBEDDED="embedded";var util={extend:function(regexes,extensions){var mergedRegexes={};for(var i in regexes){if(extensions[i]&&extensions[i].length%2===0){mergedRegexes[i]=extensions[i].concat(regexes[i])}else{mergedRegexes[i]=regexes[i]}}return mergedRegexes},has:function(str1,str2){if(typeof str1==="string"){return str2.toLowerCase().indexOf(str1.toLowerCase())!==-1}else{return false}},lowerize:function(str){return str.toLowerCase()},major:function(version){return typeof version===STR_TYPE?version.replace(/[^\d\.]/g,"").split(".")[0]:undefined},trim:function(str){return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,"")}};var mapper={rgx:function(ua,arrays){var i=0,j,k,p,q,matches,match;while(i<arrays.length&&!matches){var regex=arrays[i],props=arrays[i+1];j=k=0;while(j<regex.length&&!matches){matches=regex[j++].exec(ua);if(!!matches){for(p=0;p<props.length;p++){match=matches[++k];q=props[p];if(typeof q===OBJ_TYPE&&q.length>0){if(q.length==2){if(typeof q[1]==FUNC_TYPE){this[q[0]]=q[1].call(this,match)}else{this[q[0]]=q[1]}}else if(q.length==3){if(typeof q[1]===FUNC_TYPE&&!(q[1].exec&&q[1].test)){this[q[0]]=match?q[1].call(this,match,q[2]):undefined}else{this[q[0]]=match?match.replace(q[1],q[2]):undefined}}else if(q.length==4){this[q[0]]=match?q[3].call(this,match.replace(q[1],q[2])):undefined}}else{this[q]=match?match:undefined}}}}i+=2}},str:function(str,map){for(var i in map){if(typeof map[i]===OBJ_TYPE&&map[i].length>0){for(var j=0;j<map[i].length;j++){if(util.has(map[i][j],str)){return i===UNKNOWN?undefined:i}}}else if(util.has(map[i],str)){return i===UNKNOWN?undefined:i}}return str}};var maps={browser:{oldsafari:{version:{"1.0":"/8",1.2:"/1",1.3:"/3","2.0":"/412","2.0.2":"/416","2.0.3":"/417","2.0.4":"/419","?":"/"}}},device:{amazon:{model:{"Fire Phone":["SD","KF"]}},sprint:{model:{"Evo Shift 4G":"7373KT"},vendor:{HTC:"APA",Sprint:"Sprint"}}},os:{windows:{version:{ME:"4.90","NT 3.11":"NT3.51","NT 4.0":"NT4.0",2e3:"NT 5.0",XP:["NT 5.1","NT 5.2"],Vista:"NT 6.0",7:"NT 6.1",8:"NT 6.2",8.1:"NT 6.3",10:["NT 6.4","NT 10.0"],RT:"ARM"}}}};var regexes={browser:[[/(opera\smini)\/([\w\.-]+)/i,/(opera\s[mobiletab]+).+version\/([\w\.-]+)/i,/(opera).+version\/([\w\.]+)/i,/(opera)[\/\s]+([\w\.]+)/i],[NAME,VERSION],[/(opios)[\/\s]+([\w\.]+)/i],[[NAME,"Opera Mini"],VERSION],[/\s(opr)\/([\w\.]+)/i],[[NAME,"Opera"],VERSION],[/(kindle)\/([\w\.]+)/i,/(lunascape|maxthon|netfront|jasmine|blazer)[\/\s]?([\w\.]*)/i,/(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i,/(?:ms|\()(ie)\s([\w\.]+)/i,/(rekonq)\/([\w\.]*)/i,/(chromium|flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon)\/([\w\.-]+)/i],[NAME,VERSION],[/(konqueror)\/([\w\.]+)/i],[[NAME,"Konqueror"],VERSION],[/(trident).+rv[:\s]([\w\.]+).+like\sgecko/i],[[NAME,"IE"],VERSION],[/(edge|edgios|edga|edg)\/((\d+)?[\w\.]+)/i],[[NAME,"Edge"],VERSION],[/(yabrowser)\/([\w\.]+)/i],[[NAME,"Yandex"],VERSION],[/(puffin)\/([\w\.]+)/i],[[NAME,"Puffin"],VERSION],[/(focus)\/([\w\.]+)/i],[[NAME,"Firefox Focus"],VERSION],[/(opt)\/([\w\.]+)/i],[[NAME,"Opera Touch"],VERSION],[/((?:[\s\/])uc?\s?browser|(?:juc.+)ucweb)[\/\s]?([\w\.]+)/i],[[NAME,"UCBrowser"],VERSION],[/(comodo_dragon)\/([\w\.]+)/i],[[NAME,/_/g," "],VERSION],[/(windowswechat qbcore)\/([\w\.]+)/i],[[NAME,"WeChat(Win) Desktop"],VERSION],[/(micromessenger)\/([\w\.]+)/i],[[NAME,"WeChat"],VERSION],[/(brave)\/([\w\.]+)/i],[[NAME,"Brave"],VERSION],[/(qqbrowserlite)\/([\w\.]+)/i],[NAME,VERSION],[/(QQ)\/([\d\.]+)/i],[NAME,VERSION],[/m?(qqbrowser)[\/\s]?([\w\.]+)/i],[NAME,VERSION],[/(BIDUBrowser)[\/\s]?([\w\.]+)/i],[NAME,VERSION],[/(2345Explorer)[\/\s]?([\w\.]+)/i],[NAME,VERSION],[/(MetaSr)[\/\s]?([\w\.]+)/i],[NAME],[/(LBBROWSER)/i],[NAME],[/xiaomi\/miuibrowser\/([\w\.]+)/i],[VERSION,[NAME,"MIUI Browser"]],[/;fbav\/([\w\.]+);/i],[VERSION,[NAME,"Facebook"]],[/safari\s(line)\/([\w\.]+)/i,/android.+(line)\/([\w\.]+)\/iab/i],[NAME,VERSION],[/headlesschrome(?:\/([\w\.]+)|\s)/i],[VERSION,[NAME,"Chrome Headless"]],[/\swv\).+(chrome)\/([\w\.]+)/i],[[NAME,/(.+)/,"$1 WebView"],VERSION],[/((?:oculus|samsung)browser)\/([\w\.]+)/i],[[NAME,/(.+(?:g|us))(.+)/,"$1 $2"],VERSION],[/android.+version\/([\w\.]+)\s+(?:mobile\s?safari|safari)*/i],[VERSION,[NAME,"Android Browser"]],[/(sailfishbrowser)\/([\w\.]+)/i],[[NAME,"Sailfish Browser"],VERSION],[/(chrome|omniweb|arora|[tizenoka]{5}\s?browser)\/v?([\w\.]+)/i],[NAME,VERSION],[/(dolfin)\/([\w\.]+)/i],[[NAME,"Dolphin"],VERSION],[/((?:android.+)crmo|crios)\/([\w\.]+)/i],[[NAME,"Chrome"],VERSION],[/(coast)\/([\w\.]+)/i],[[NAME,"Opera Coast"],VERSION],[/fxios\/([\w\.-]+)/i],[VERSION,[NAME,"Firefox"]],[/version\/([\w\.]+).+?mobile\/\w+\s(safari)/i],[VERSION,[NAME,"Mobile Safari"]],[/version\/([\w\.]+).+?(mobile\s?safari|safari)/i],[VERSION,NAME],[/webkit.+?(gsa)\/([\w\.]+).+?(mobile\s?safari|safari)(\/[\w\.]+)/i],[[NAME,"GSA"],VERSION],[/webkit.+?(mobile\s?safari|safari)(\/[\w\.]+)/i],[NAME,[VERSION,mapper.str,maps.browser.oldsafari.version]],[/(webkit|khtml)\/([\w\.]+)/i],[NAME,VERSION],[/(navigator|netscape)\/([\w\.-]+)/i],[[NAME,"Netscape"],VERSION],[/(swiftfox)/i,/(icedragon|iceweasel|camino|chimera|fennec|maemo\sbrowser|minimo|conkeror)[\/\s]?([\w\.\+]+)/i,/(firefox|seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([\w\.-]+)$/i,/(mozilla)\/([\w\.]+).+rv\:.+gecko\/\d+/i,/(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir)[\/\s]?([\w\.]+)/i,/(links)\s\(([\w\.]+)/i,/(gobrowser)\/?([\w\.]*)/i,/(ice\s?browser)\/v?([\w\._]+)/i,/(mosaic)[\/\s]([\w\.]+)/i],[NAME,VERSION]],cpu:[[/(?:(amd|x(?:(?:86|64)[_-])?|wow|win)64)[;\)]/i],[[ARCHITECTURE,"amd64"]],[/(ia32(?=;))/i],[[ARCHITECTURE,util.lowerize]],[/((?:i[346]|x)86)[;\)]/i],[[ARCHITECTURE,"ia32"]],[/windows\s(ce|mobile);\sppc;/i],[[ARCHITECTURE,"arm"]],[/((?:ppc|powerpc)(?:64)?)(?:\smac|;|\))/i],[[ARCHITECTURE,/ower/,"",util.lowerize]],[/(sun4\w)[;\)]/i],[[ARCHITECTURE,"sparc"]],[/((?:avr32|ia64(?=;))|68k(?=\))|arm(?:64|(?=v\d+[;l]))|(?=atmel\s)avr|(?:irix|mips|sparc)(?:64)?(?=;)|pa-risc)/i],[[ARCHITECTURE,util.lowerize]]],device:[[/\((ipad|playbook);[\w\s\),;-]+(rim|apple)/i],[MODEL,VENDOR,[TYPE,TABLET]],[/applecoremedia\/[\w\.]+ \((ipad)/],[MODEL,[VENDOR,"Apple"],[TYPE,TABLET]],[/(apple\s{0,1}tv)/i],[[MODEL,"Apple TV"],[VENDOR,"Apple"]],[/(archos)\s(gamepad2?)/i,/(hp).+(touchpad)/i,/(hp).+(tablet)/i,/(kindle)\/([\w\.]+)/i,/\s(nook)[\w\s]+build\/(\w+)/i,/(dell)\s(strea[kpr\s\d]*[\dko])/i],[VENDOR,MODEL,[TYPE,TABLET]],[/(kf[A-z]+)\sbuild\/.+silk\//i],[MODEL,[VENDOR,"Amazon"],[TYPE,TABLET]],[/(sd|kf)[0349hijorstuw]+\sbuild\/.+silk\//i],[[MODEL,mapper.str,maps.device.amazon.model],[VENDOR,"Amazon"],[TYPE,MOBILE]],[/android.+aft([bms])\sbuild/i],[MODEL,[VENDOR,"Amazon"],[TYPE,SMARTTV]],[/\((ip[honed|\s\w*]+);.+(apple)/i],[MODEL,VENDOR,[TYPE,MOBILE]],[/\((ip[honed|\s\w*]+);/i],[MODEL,[VENDOR,"Apple"],[TYPE,MOBILE]],[/(blackberry)[\s-]?(\w+)/i,/(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|meizu|motorola|polytron)[\s_-]?([\w-]*)/i,/(hp)\s([\w\s]+\w)/i,/(asus)-?(\w+)/i],[VENDOR,MODEL,[TYPE,MOBILE]],[/\(bb10;\s(\w+)/i],[MODEL,[VENDOR,"BlackBerry"],[TYPE,MOBILE]],[/android.+(transfo[prime\s]{4,10}\s\w+|eeepc|slider\s\w+|nexus 7|padfone|p00c)/i],[MODEL,[VENDOR,"Asus"],[TYPE,TABLET]],[/(sony)\s(tablet\s[ps])\sbuild\//i,/(sony)?(?:sgp.+)\sbuild\//i],[[VENDOR,"Sony"],[MODEL,"Xperia Tablet"],[TYPE,TABLET]],[/android.+\s([c-g]\d{4}|so[-l]\w+)(?=\sbuild\/|\).+chrome\/(?![1-6]{0,1}\d\.))/i],[MODEL,[VENDOR,"Sony"],[TYPE,MOBILE]],[/\s(ouya)\s/i,/(nintendo)\s([wids3u]+)/i],[VENDOR,MODEL,[TYPE,CONSOLE]],[/android.+;\s(shield)\sbuild/i],[MODEL,[VENDOR,"Nvidia"],[TYPE,CONSOLE]],[/(playstation\s[34portablevi]+)/i],[MODEL,[VENDOR,"Sony"],[TYPE,CONSOLE]],[/(sprint\s(\w+))/i],[[VENDOR,mapper.str,maps.device.sprint.vendor],[MODEL,mapper.str,maps.device.sprint.model],[TYPE,MOBILE]],[/(htc)[;_\s-]+([\w\s]+(?=\)|\sbuild)|\w+)/i,/(zte)-(\w*)/i,/(alcatel|geeksphone|nexian|panasonic|(?=;\s)sony)[_\s-]?([\w-]*)/i],[VENDOR,[MODEL,/_/g," "],[TYPE,MOBILE]],[/(nexus\s9)/i],[MODEL,[VENDOR,"HTC"],[TYPE,TABLET]],[/d\/huawei([\w\s-]+)[;\)]/i,/(nexus\s6p)/i],[MODEL,[VENDOR,"Huawei"],[TYPE,MOBILE]],[/(microsoft);\s(lumia[\s\w]+)/i],[VENDOR,MODEL,[TYPE,MOBILE]],[/[\s\(;](xbox(?:\sone)?)[\s\);]/i],[MODEL,[VENDOR,"Microsoft"],[TYPE,CONSOLE]],[/(kin\.[onetw]{3})/i],[[MODEL,/\./g," "],[VENDOR,"Microsoft"],[TYPE,MOBILE]],[/\s(milestone|droid(?:[2-4x]|\s(?:bionic|x2|pro|razr))?:?(\s4g)?)[\w\s]+build\//i,/mot[\s-]?(\w*)/i,/(XT\d{3,4}) build\//i,/(nexus\s6)/i],[MODEL,[VENDOR,"Motorola"],[TYPE,MOBILE]],[/android.+\s(mz60\d|xoom[\s2]{0,2})\sbuild\//i],[MODEL,[VENDOR,"Motorola"],[TYPE,TABLET]],[/hbbtv\/\d+\.\d+\.\d+\s+\([\w\s]*;\s*(\w[^;]*);([^;]*)/i],[[VENDOR,util.trim],[MODEL,util.trim],[TYPE,SMARTTV]],[/hbbtv.+maple;(\d+)/i],[[MODEL,/^/,"SmartTV"],[VENDOR,"Samsung"],[TYPE,SMARTTV]],[/\(dtv[\);].+(aquos)/i],[MODEL,[VENDOR,"Sharp"],[TYPE,SMARTTV]],[/android.+((sch-i[89]0\d|shw-m380s|gt-p\d{4}|gt-n\d+|sgh-t8[56]9|nexus 10))/i,/((SM-T\w+))/i],[[VENDOR,"Samsung"],MODEL,[TYPE,TABLET]],[/smart-tv.+(samsung)/i],[VENDOR,[TYPE,SMARTTV],MODEL],[/((s[cgp]h-\w+|gt-\w+|galaxy\snexus|sm-\w[\w\d]+))/i,/(sam[sung]*)[\s-]*(\w+-?[\w-]*)/i,/sec-((sgh\w+))/i],[[VENDOR,"Samsung"],MODEL,[TYPE,MOBILE]],[/sie-(\w*)/i],[MODEL,[VENDOR,"Siemens"],[TYPE,MOBILE]],[/(maemo|nokia).*(n900|lumia\s\d+)/i,/(nokia)[\s_-]?([\w-]*)/i],[[VENDOR,"Nokia"],MODEL,[TYPE,MOBILE]],[/android[x\d\.\s;]+\s([ab][1-7]\-?[0178a]\d\d?)/i],[MODEL,[VENDOR,"Acer"],[TYPE,TABLET]],[/android.+([vl]k\-?\d{3})\s+build/i],[MODEL,[VENDOR,"LG"],[TYPE,TABLET]],[/android\s3\.[\s\w;-]{10}(lg?)-([06cv9]{3,4})/i],[[VENDOR,"LG"],MODEL,[TYPE,TABLET]],[/(lg) netcast\.tv/i],[VENDOR,MODEL,[TYPE,SMARTTV]],[/(nexus\s[45])/i,/lg[e;\s\/-]+(\w*)/i,/android.+lg(\-?[\d\w]+)\s+build/i],[MODEL,[VENDOR,"LG"],[TYPE,MOBILE]],[/(lenovo)\s?(s(?:5000|6000)(?:[\w-]+)|tab(?:[\s\w]+))/i],[VENDOR,MODEL,[TYPE,TABLET]],[/android.+(ideatab[a-z0-9\-\s]+)/i],[MODEL,[VENDOR,"Lenovo"],[TYPE,TABLET]],[/(lenovo)[_\s-]?([\w-]+)/i],[VENDOR,MODEL,[TYPE,MOBILE]],[/linux;.+((jolla));/i],[VENDOR,MODEL,[TYPE,MOBILE]],[/((pebble))app\/[\d\.]+\s/i],[VENDOR,MODEL,[TYPE,WEARABLE]],[/android.+;\s(oppo)\s?([\w\s]+)\sbuild/i],[VENDOR,MODEL,[TYPE,MOBILE]],[/crkey/i],[[MODEL,"Chromecast"],[VENDOR,"Google"]],[/android.+;\s(glass)\s\d/i],[MODEL,[VENDOR,"Google"],[TYPE,WEARABLE]],[/android.+;\s(pixel c)[\s)]/i],[MODEL,[VENDOR,"Google"],[TYPE,TABLET]],[/android.+;\s(pixel( [23])?( xl)?)[\s)]/i],[MODEL,[VENDOR,"Google"],[TYPE,MOBILE]],[/android.+;\s(\w+)\s+build\/hm\1/i,/android.+(hm[\s\-_]*note?[\s_]*(?:\d\w)?)\s+build/i,/android.+(mi[\s\-_]*(?:a\d|one|one[\s_]plus|note lte)?[\s_]*(?:\d?\w?)[\s_]*(?:plus)?)\s+build/i,/android.+(redmi[\s\-_]*(?:note)?(?:[\s_]*[\w\s]+))\s+build/i],[[MODEL,/_/g," "],[VENDOR,"Xiaomi"],[TYPE,MOBILE]],[/android.+(mi[\s\-_]*(?:pad)(?:[\s_]*[\w\s]+))\s+build/i],[[MODEL,/_/g," "],[VENDOR,"Xiaomi"],[TYPE,TABLET]],[/android.+;\s(m[1-5]\snote)\sbuild/i],[MODEL,[VENDOR,"Meizu"],[TYPE,MOBILE]],[/(mz)-([\w-]{2,})/i],[[VENDOR,"Meizu"],MODEL,[TYPE,MOBILE]],[/android.+a000(1)\s+build/i,/android.+oneplus\s(a\d{4})\s+build/i],[MODEL,[VENDOR,"OnePlus"],[TYPE,MOBILE]],[/android.+[;\/]\s*(RCT[\d\w]+)\s+build/i],[MODEL,[VENDOR,"RCA"],[TYPE,TABLET]],[/android.+[;\/\s]+(Venue[\d\s]{2,7})\s+build/i],[MODEL,[VENDOR,"Dell"],[TYPE,TABLET]],[/android.+[;\/]\s*(Q[T|M][\d\w]+)\s+build/i],[MODEL,[VENDOR,"Verizon"],[TYPE,TABLET]],[/android.+[;\/]\s+(Barnes[&\s]+Noble\s+|BN[RT])(V?.*)\s+build/i],[[VENDOR,"Barnes & Noble"],MODEL,[TYPE,TABLET]],[/android.+[;\/]\s+(TM\d{3}.*\b)\s+build/i],[MODEL,[VENDOR,"NuVision"],[TYPE,TABLET]],[/android.+;\s(k88)\sbuild/i],[MODEL,[VENDOR,"ZTE"],[TYPE,TABLET]],[/android.+[;\/]\s*(gen\d{3})\s+build.*49h/i],[MODEL,[VENDOR,"Swiss"],[TYPE,MOBILE]],[/android.+[;\/]\s*(zur\d{3})\s+build/i],[MODEL,[VENDOR,"Swiss"],[TYPE,TABLET]],[/android.+[;\/]\s*((Zeki)?TB.*\b)\s+build/i],[MODEL,[VENDOR,"Zeki"],[TYPE,TABLET]],[/(android).+[;\/]\s+([YR]\d{2})\s+build/i,/android.+[;\/]\s+(Dragon[\-\s]+Touch\s+|DT)(\w{5})\sbuild/i],[[VENDOR,"Dragon Touch"],MODEL,[TYPE,TABLET]],[/android.+[;\/]\s*(NS-?\w{0,9})\sbuild/i],[MODEL,[VENDOR,"Insignia"],[TYPE,TABLET]],[/android.+[;\/]\s*((NX|Next)-?\w{0,9})\s+build/i],[MODEL,[VENDOR,"NextBook"],[TYPE,TABLET]],[/android.+[;\/]\s*(Xtreme\_)?(V(1[045]|2[015]|30|40|60|7[05]|90))\s+build/i],[[VENDOR,"Voice"],MODEL,[TYPE,MOBILE]],[/android.+[;\/]\s*(LVTEL\-)?(V1[12])\s+build/i],[[VENDOR,"LvTel"],MODEL,[TYPE,MOBILE]],[/android.+;\s(PH-1)\s/i],[MODEL,[VENDOR,"Essential"],[TYPE,MOBILE]],[/android.+[;\/]\s*(V(100MD|700NA|7011|917G).*\b)\s+build/i],[MODEL,[VENDOR,"Envizen"],[TYPE,TABLET]],[/android.+[;\/]\s*(Le[\s\-]+Pan)[\s\-]+(\w{1,9})\s+build/i],[VENDOR,MODEL,[TYPE,TABLET]],[/android.+[;\/]\s*(Trio[\s\-]*.*)\s+build/i],[MODEL,[VENDOR,"MachSpeed"],[TYPE,TABLET]],[/android.+[;\/]\s*(Trinity)[\-\s]*(T\d{3})\s+build/i],[VENDOR,MODEL,[TYPE,TABLET]],[/android.+[;\/]\s*TU_(1491)\s+build/i],[MODEL,[VENDOR,"Rotor"],[TYPE,TABLET]],[/android.+(KS(.+))\s+build/i],[MODEL,[VENDOR,"Amazon"],[TYPE,TABLET]],[/android.+(Gigaset)[\s\-]+(Q\w{1,9})\s+build/i],[VENDOR,MODEL,[TYPE,TABLET]],[/\s(tablet|tab)[;\/]/i,/\s(mobile)(?:[;\/]|\ssafari)/i],[[TYPE,util.lowerize],VENDOR,MODEL],[/[\s\/\(](smart-?tv)[;\)]/i],[[TYPE,SMARTTV]],[/(android[\w\.\s\-]{0,9});.+build/i],[MODEL,[VENDOR,"Generic"]]],engine:[[/windows.+\sedge\/([\w\.]+)/i],[VERSION,[NAME,"EdgeHTML"]],[/webkit\/537\.36.+chrome\/(?!27)/i],[[NAME,"Blink"]],[/(presto)\/([\w\.]+)/i,/(webkit|trident|netfront|netsurf|amaya|lynx|w3m|goanna)\/([\w\.]+)/i,/(khtml|tasman|links)[\/\s]\(?([\w\.]+)/i,/(icab)[\/\s]([23]\.[\d\.]+)/i],[NAME,VERSION],[/rv\:([\w\.]{1,9}).+(gecko)/i],[VERSION,NAME]],os:[[/microsoft\s(windows)\s(vista|xp)/i],[NAME,VERSION],[/(windows)\snt\s6\.2;\s(arm)/i,/(windows\sphone(?:\sos)*)[\s\/]?([\d\.\s\w]*)/i,/(windows\smobile|windows)[\s\/]?([ntce\d\.\s]+\w)/i],[NAME,[VERSION,mapper.str,maps.os.windows.version]],[/(win(?=3|9|n)|win\s9x\s)([nt\d\.]+)/i],[[NAME,"Windows"],[VERSION,mapper.str,maps.os.windows.version]],[/\((bb)(10);/i],[[NAME,"BlackBerry"],VERSION],[/(blackberry)\w*\/?([\w\.]*)/i,/(tizen)[\/\s]([\w\.]+)/i,/(android|webos|palm\sos|qnx|bada|rim\stablet\sos|meego|sailfish|contiki)[\/\s-]?([\w\.]*)/i],[NAME,VERSION],[/(symbian\s?os|symbos|s60(?=;))[\/\s-]?([\w\.]*)/i],[[NAME,"Symbian"],VERSION],[/\((series40);/i],[NAME],[/mozilla.+\(mobile;.+gecko.+firefox/i],[[NAME,"Firefox OS"],VERSION],[/(nintendo|playstation)\s([wids34portablevu]+)/i,/(mint)[\/\s\(]?(\w*)/i,/(mageia|vectorlinux)[;\s]/i,/(joli|[kxln]?ubuntu|debian|suse|opensuse|gentoo|(?=\s)arch|slackware|fedora|mandriva|centos|pclinuxos|redhat|zenwalk|linpus)[\/\s-]?(?!chrom)([\w\.-]*)/i,/(hurd|linux)\s?([\w\.]*)/i,/(gnu)\s?([\w\.]*)/i],[NAME,VERSION],[/(cros)\s[\w]+\s([\w\.]+\w)/i],[[NAME,"Chromium OS"],VERSION],[/(sunos)\s?([\w\.\d]*)/i],[[NAME,"Solaris"],VERSION],[/\s([frentopc-]{0,4}bsd|dragonfly)\s?([\w\.]*)/i],[NAME,VERSION],[/(haiku)\s(\w+)/i],[NAME,VERSION],[/cfnetwork\/.+darwin/i,/ip[honead]{2,4}(?:.*os\s([\w]+)\slike\smac|;\sopera)/i],[[VERSION,/_/g,"."],[NAME,"iOS"]],[/(mac\sos\sx)\s?([\w\s\.]*)/i,/(macintosh|mac(?=_powerpc)\s)/i],[[NAME,"Mac OS"],[VERSION,/_/g,"."]],[/((?:open)?solaris)[\/\s-]?([\w\.]*)/i,/(aix)\s((\d)(?=\.|\)|\s)[\w\.])*/i,/(plan\s9|minix|beos|os\/2|amigaos|morphos|risc\sos|openvms|fuchsia)/i,/(unix)\s?([\w\.]*)/i],[NAME,VERSION]]};var UAParser=function(uastring,extensions){if(typeof uastring==="object"){extensions=uastring;uastring=undefined}if(!(this instanceof UAParser)){return new UAParser(uastring,extensions).getResult()}var ua=uastring||(window&&window.navigator&&window.navigator.userAgent?window.navigator.userAgent:EMPTY);var rgxmap=extensions?util.extend(regexes,extensions):regexes;this.getBrowser=function(){var browser={name:undefined,version:undefined};mapper.rgx.call(browser,ua,rgxmap.browser);browser.major=util.major(browser.version);return browser};this.getCPU=function(){var cpu={architecture:undefined};mapper.rgx.call(cpu,ua,rgxmap.cpu);return cpu};this.getDevice=function(){var device={vendor:undefined,model:undefined,type:undefined};mapper.rgx.call(device,ua,rgxmap.device);return device};this.getEngine=function(){var engine={name:undefined,version:undefined};mapper.rgx.call(engine,ua,rgxmap.engine);return engine};this.getOS=function(){var os={name:undefined,version:undefined};mapper.rgx.call(os,ua,rgxmap.os);return os};this.getResult=function(){return{ua:this.getUA(),browser:this.getBrowser(),engine:this.getEngine(),os:this.getOS(),device:this.getDevice(),cpu:this.getCPU()}};this.getUA=function(){return ua};this.setUA=function(uastring){ua=uastring;return this};return this};UAParser.VERSION=LIBVERSION;UAParser.BROWSER={NAME:NAME,MAJOR:MAJOR,VERSION:VERSION};UAParser.CPU={ARCHITECTURE:ARCHITECTURE};UAParser.DEVICE={MODEL:MODEL,VENDOR:VENDOR,TYPE:TYPE,CONSOLE:CONSOLE,MOBILE:MOBILE,SMARTTV:SMARTTV,TABLET:TABLET,WEARABLE:WEARABLE,EMBEDDED:EMBEDDED};UAParser.ENGINE={NAME:NAME,VERSION:VERSION};UAParser.OS={NAME:NAME,VERSION:VERSION};if(typeof exports!==UNDEF_TYPE){if(typeof module!==UNDEF_TYPE&&module.exports){exports=module.exports=UAParser}exports.UAParser=UAParser}else{if(typeof define==="function"&&define.amd){define(function(){return UAParser})}else if(window){window.UAParser=UAParser}}var $=window&&(window.jQuery||window.Zepto);if(typeof $!==UNDEF_TYPE&&!$.ua){var parser=new UAParser;$.ua=parser.getResult();$.ua.get=function(){return parser.getUA()};$.ua.set=function(uastring){parser.setUA(uastring);var result=parser.getResult();for(var prop in result){$.ua[prop]=result[prop]}}}})(typeof window==="object"?window:this);`;

var BrowserScriptParts;
(function(BrowserScriptParts) {
	BrowserScriptParts.rtdScript = rtdScript;
	BrowserScriptParts.uaParserScript = uaParserScript;
})(BrowserScriptParts || (BrowserScriptParts = {}));

class LowLevelJsCompiler {
	compile(jsConfig, device) {
		const jsStringBuilder = new StringBuilder();
		const numberOfTabsForJsVars = 1;
		if (!device) {
			const jsConfigJson = TextFormatter.jsonStringifyPretty(jsConfig, TextFormatter.indentTab())
				.addTabsAtBeginOfAllLines(numberOfTabsForJsVars)
				.getText()
				.trim();
			jsStringBuilder.add(BrowserScriptParts.uaParserScript);
			jsStringBuilder.add('\n\n');
			jsStringBuilder.add(
				BrowserScriptParts.rtdScript
					.replace("'{config}'", jsConfigJson)
					.replace("'{breakpointsForDevice}'", 'null'),
			);
		} else {
			const breakpointsForDevice = jsConfig.breakpointsForDeviceByDevice[device.type];
			const breakpointsForDeviceJson = TextFormatter.jsonStringifyPretty(
				breakpointsForDevice,
				TextFormatter.indentTab(),
			)
				.addTabsAtBeginOfAllLines(numberOfTabsForJsVars)
				.getText()
				.trim();
			jsStringBuilder.add(
				BrowserScriptParts.rtdScript
					.replace("'{config}'", 'null')
					.replace("'{breakpointsForDevice}'", breakpointsForDeviceJson),
			);
		}
		const js = jsStringBuilder.stringify();
		return js;
	}
}

class JsCompiler {
	compile(jsConfig, device) {
		const lowLevelJsCompiler = new LowLevelJsCompiler();
		const js = lowLevelJsCompiler.compile(jsConfig, device);
		return js;
	}
}

var FileCompilerOutputRequest;
(function(FileCompilerOutputRequest) {
	let Css;
	(function(Css) {
		Css['General'] = 'General';
		Css['GeneralAndDevices'] = 'GeneralAndDevices';
	})((Css = FileCompilerOutputRequest.Css || (FileCompilerOutputRequest.Css = {})));
	let Js;
	(function(Js) {
		Js['General'] = 'General';
		Js['GeneralAndDevices'] = 'GeneralAndDevices';
	})((Js = FileCompilerOutputRequest.Js || (FileCompilerOutputRequest.Js = {})));
})(FileCompilerOutputRequest || (FileCompilerOutputRequest = {}));

class LowLevelFileCompiler {
	constructor(inputFilePath, outputDirectoryPath, cssDriver = defaultCssDriver) {
		this._inputFilePath = inputFilePath;
		this._outputDirectoryPath = outputDirectoryPath;
		this._cssDriver = cssDriver;
		this._parsedInputFilePath = path.parse(this._inputFilePath);
	}
	compile(outputRequest) {
		const outputRequestAny = !!(outputRequest.css || outputRequest.js);
		if (!outputRequestAny) {
			return;
		}
		fsExtra.ensureDirSync(this._outputDirectoryPath);
		const inputRoot = this._cssDriver.parseCssToSourceRoot(fs.readFileSync(this._inputFilePath));
		const configLoader = new ConcreteConfigLoader();
		if (outputRequest.css) {
			const cssConfig = configLoader.loadCssConfig(inputRoot);
			const cssCompiler = new CssCompiler();
			const outCssFileOptionsList = this.createOutputCssFileOptionsList(outputRequest, cssConfig);
			for (const outCssFile of outCssFileOptionsList) {
				const outputResult = cssCompiler.compile(inputRoot, outCssFile.compileOptions, this._cssDriver);
				const outputCss = outputResult.css;
				fs.writeFileSync(outCssFile.filePath, outputCss);
			}
		}
		if (outputRequest.js) {
			const jsConfig = configLoader.loadJsConfig(inputRoot);
			const jsCompiler = new JsCompiler();
			const outJsFileOptionsList = this.createOutputJsFileOptionsList(outputRequest, jsConfig);
			for (const outJsFile of outJsFileOptionsList) {
				const outputJs = jsCompiler.compile(jsConfig, outJsFile.device);
				fs.writeFileSync(outJsFile.filePath, outputJs);
			}
		}
	}
	createOutputFilePath(outputExt, outputDeviceName = null) {
		const outputDirectoryPath = this._outputDirectoryPath;
		const outputFileNameWithoutExt = this._parsedInputFilePath.name;
		const result = path.join(
			outputDirectoryPath,
			[outputFileNameWithoutExt, '.rtd', outputDeviceName ? `.${outputDeviceName}` : '', outputExt].join(''),
		);
		return result;
	}
	createOutputCssFileOptions(deviceName) {
		const result = {
			filePath: this.createOutputFilePath('.css', deviceName),
			compileOptions: {
				compileOnlyThisDevice: deviceName,
			},
		};
		return result;
	}
	createOutputCssFileOptionsList(outputRequest, config) {
		let result;
		if (outputRequest.css === FileCompilerOutputRequest.Css.General) {
			result = [this.createOutputCssFileOptions(null)];
		} else if (outputRequest.css === FileCompilerOutputRequest.Css.GeneralAndDevices) {
			result = [
				this.createOutputCssFileOptions(null),
				this.createOutputCssFileOptions(config.unknownDevice.name),
				...config.deviceList.map(device => this.createOutputCssFileOptions(device.name)),
			];
		} else {
			throw new NotImplementedError();
		}
		return result;
	}
	createOutputJsFileOptions(device) {
		const result = {
			filePath: this.createOutputFilePath('.js', device && device.name),
			device,
		};
		return result;
	}
	createOutputJsFileOptionsList(outputRequest, config) {
		let result;
		if (outputRequest.js === FileCompilerOutputRequest.Js.General) {
			result = [this.createOutputJsFileOptions(null)];
		} else if (outputRequest.js === FileCompilerOutputRequest.Js.GeneralAndDevices) {
			const deviceList = [
				null,
				...DictionaryUtils.getValues(config.breakpointsForDeviceByDevice).map(
					breakpointsForDevice => breakpointsForDevice.device,
				),
			];
			result = deviceList.map(device => this.createOutputJsFileOptions(device));
		} else {
			throw new NotImplementedError();
		}
		return result;
	}
}

class FileCompiler {
	compile(outputRequest, inputFilePath, outputDirectoryPath, cssDriver = defaultCssDriver) {
		const lowLevelFileCompiler = new LowLevelFileCompiler(inputFilePath, outputDirectoryPath, cssDriver);
		lowLevelFileCompiler.compile(outputRequest);
	}
}

const postcssRtdCssPlugin = postcss.plugin('postcss-rtd-css', opts => {
	return (root, result) => {
		const compiler = new CssCompiler();
		result.root = compiler.compile(result.root, opts, new PostcssCssDriver()).cssRoot;
	};
});

class CompileCommand extends Command {
	constructor(program) {
		super(program, {
			name: 'compile',
			alias: 'c',
			describe: 'Compile the source responsive CSS to RTD CSS',
			options: null,
		});
		this.inputCssFileOption = new CommandOption(this.program, {
			name: 'input-css-file',
			alias: 'i',
			describe: 'Input responsive CSS file',
			required: true,
		});
		this.outputDirectoryOption = new CommandOption(this.program, {
			name: 'output-directory',
			alias: 'o',
			describe: 'Output directory',
			required: true,
		});
		this.options = [this.inputCssFileOption, this.outputDirectoryOption];
	}
	validateAndGetInputData(argv) {
		if (
			!CommandUtils.validateOptionListNotEmpty(this.program, argv, [
				this.inputCssFileOption,
				this.outputDirectoryOption,
			])
		) {
			return;
		}
		const inputData = {
			inputFilePath: argv[this.inputCssFileOption.name],
			outputDirectoryPath: argv[this.outputDirectoryOption.name],
		};
		try {
			fsExtra.ensureDirSync(inputData.outputDirectoryPath);
		} catch (e) {
			this.program.printer.showCommandHelpWithSingleError(
				this.outputDirectoryOption,
				`Can not create directory "${inputData.outputDirectoryPath}"`,
			);
			return;
		}
		if (
			!(
				CommandUtils.validateFileExists(this.program, argv, this.inputCssFileOption) &&
				CommandUtils.validateDirectoryExists(this.program, argv, this.outputDirectoryOption)
			)
		) {
			return;
		}
		return inputData;
	}
	actionBody(inputData) {
		const fileCompiler = new FileCompiler();
		fileCompiler.compile(
			{
				css: FileCompilerOutputRequest.Css.General,
				js: FileCompilerOutputRequest.Js.GeneralAndDevices,
			},
			inputData.inputFilePath,
			inputData.outputDirectoryPath,
			new PostcssCssDriver(),
		);
	}
}

class ThisProgram extends Program {
	constructor(yargsInstance, printer) {
		super(yargsInstance, printer);
		this.commands = [new CompileCommand(this)];
	}
}

const program = new ThisProgram(yargs, new Printer(yargs));
program.register();
//# sourceMappingURL=cli.es.mjs.map
