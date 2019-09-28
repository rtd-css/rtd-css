'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var postcss = _interopDefault(require('postcss'));
var cssWhat = require('css-what');

class NotImplementedError extends Error {
    constructor() {
        super('Not implemented');
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
        }
        else if (value instanceof ValueInUnits) {
            const valueInUnits = value;
            this.value = `${valueInUnits.value}${valueInUnits.units}`;
            this.valueInUnits = valueInUnits;
        }
        else if (!value) {
            this.value = null;
            this.valueInUnits = null;
        }
        else {
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
        if ((matchResult = normalizedValue.match(/(\d*\.?\d+)([a-z]+)/))
            && matchResult[0] === matchResult.input) {
            valueInUnits = new ValueInUnits(Number(matchResult[1]), matchResult[2]);
        }
        else if ((matchResult = normalizedValue.match(/^[+-]?\d+(\.\d+)?$/))) {
            valueInUnits = new ValueInUnits(Number(normalizedValue));
        }
        else {
            throw new Error('Invalid {value}');
        }
        return valueInUnits;
    }
    static tryParseValueInUnits(value) {
        let valueInUnits;
        try {
            valueInUnits = CssValue.parseValueInUnits(value);
        }
        catch (e) {
            valueInUnits = null;
        }
        return valueInUnits;
    }
}

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
        for (let i = 1; i < rangeList.length;) {
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
        }
        else {
            result = new Range(Math.max(range1.from, range2.from), Math.min(range1.to, range2.to));
        }
        return result;
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
        return !this.type && (this._features.length === 0);
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
        return this.name === featureName
            && (this.modifier === 'min' || this.modifier === 'max')
            && (this.value.valueInUnits && this.value.valueInUnits.units === units);
    }
}
var MqRangeFeatureSummaryForUnitsType;
(function (MqRangeFeatureSummaryForUnitsType) {
    MqRangeFeatureSummaryForUnitsType["NoRange"] = "NoRange";
    MqRangeFeatureSummaryForUnitsType["EmptyRange"] = "EmptyRange";
    MqRangeFeatureSummaryForUnitsType["HasRange"] = "HasRange";
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
        }
        else if (mediaQuery instanceof MediaQueryAst) {
            this.initFromMediaQueryAst(mediaQuery);
        }
        else {
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
        const rangeFeatureSummaryList = this.mediaQueryAst.orQueries.map((orQuery) => {
            const ranges = orQuery.features
                .filter(feature => feature.isRangeFeatureInUnits(featureName, units))
                .map((feature) => {
                let range;
                const value = feature.value.valueInUnits.value;
                if (feature.modifier === 'min') {
                    range = new Range(value, Infinity);
                }
                else {
                    range = new Range(-Infinity, value);
                }
                return range;
            });
            let rangeFeatureSummary;
            if (ranges.length === 0) {
                rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createNoRange(featureName);
            }
            else if (ranges.length === 1) {
                rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits(featureName, ranges[0], units);
            }
            else {
                const totalRange = Range.intersect(...ranges);
                if (totalRange) {
                    rangeFeatureSummary = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits(featureName, totalRange, units);
                }
                else {
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
        ast.addOrQueries(...libAst.orQueries.map((orQuery) => {
            const outOrQuery = new MediaQueryOrQueryAst();
            outOrQuery.inverse = orQuery.inverse;
            outOrQuery.type = orQuery.type;
            outOrQuery.addFeatures(...orQuery.expressions.map((feature) => {
                const outFeature = new MediaQueryFeatureAst();
                outFeature.modifier = feature.modifier;
                outFeature.name = feature.feature;
                outFeature.value = new CssValue(feature.value);
                return outFeature;
            }));
            return outOrQuery;
        }));
        return ast;
    }
    astToLibAst(ast) {
        const libAst = {
            orQueries: ast.orQueries.map((orQuery) => {
                const outOrQuery = {
                    inverse: orQuery.inverse,
                    type: orQuery.type,
                    expressions: orQuery.features.map((feature) => {
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

var CssTree;
(function (CssTree) {
    // Node type
    let NodeType;
    (function (NodeType) {
        NodeType["root"] = "root";
        NodeType["atrule"] = "atrule";
        NodeType["rule"] = "rule";
        NodeType["decl"] = "decl";
        NodeType["comment"] = "comment";
    })(NodeType = CssTree.NodeType || (CssTree.NodeType = {}));
    // At rule name
    let AtRuleName;
    (function (AtRuleName) {
        AtRuleName["media"] = "media";
    })(AtRuleName = CssTree.AtRuleName || (CssTree.AtRuleName = {}));
})(CssTree || (CssTree = {}));

const clone = require('clone');
const deepClone = function (arg) {
    return clone.call(this, arg);
};

class IndexedList {
    constructor() {
        this._indices = [];
        this._indicesForFriends = [];
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
    }
    remove(...items) {
        for (const index of this._indicesForFriends) {
            index._remove(...items);
        }
    }
    // Friends method
    _addIndex(index) {
        this._indices.push(index);
        this._indicesForFriends.push(index);
    }
}

class IndexedListIndex {
    constructor(indexedList, keyFunc, allowDuplicates = false) {
        this._dictByKey = {};
        this._indexedList = indexedList;
        this._indexedListForFriends = indexedList;
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
            throw new Error('Items with such ket not found');
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
            if (!itemsWithSuchKey
                || (curItemIndex = itemsWithSuchKey.findIndex(_item => this._keyFunc(_item) === key)) < 0) {
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
(function (ConfigModule) {
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
(function (ConfigBuilderModule) {
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
            this._outputConfig.deviceList =
                new DeviceListBuilder()
                    .setDeviceList(deviceList)
                    .createDeviceList();
            return this;
        }
        createConfig() {
            const config = new ConfigModule.Config(this._outputConfig.units, this._outputConfig.unknownDevice, this._outputConfig.deviceList);
            return deepClone(config);
        }
    }
    ConfigBuilderModule.ConfigBuilder = ConfigBuilder;
    (function (ConfigBuilder) {
        let Data;
        (function (Data) {
            class OutputConfig {
            }
            Data.OutputConfig = OutputConfig;
        })(Data = ConfigBuilder.Data || (ConfigBuilder.Data = {}));
    })(ConfigBuilder = ConfigBuilderModule.ConfigBuilder || (ConfigBuilderModule.ConfigBuilder = {}));
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
            this._outputDeviceList = this._intermediateData.sortedDeviceList.map((device) => {
                return new ConfigModule.Device(device.name, device.cssClass, device.maxWidth, device.mergeDownTo, device.mergeUpTo, this._intermediateData.deviceMergedRangeByName[device.name]);
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
                }
                else if (a.maxWidth === b.maxWidth) {
                    result = 0;
                }
                else {
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
                this._intermediateData.deviceRangeByName[device.name] =
                    new Range(curMinWidth, device.maxWidth);
                curMinWidth = device.maxWidth + 1;
            }
        }
        initDeviceMergedRangeByName() {
            this._intermediateData.deviceMergedRangeByName =
                deepClone(this._intermediateData.deviceRangeByName);
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
                throw new Error(mergeUpOrDown
                    ? `Device "${mergeToDeviceName}" for merging "up to" not found`
                    : `Device "${mergeToDeviceName}" for merging "down to" not found`);
            }
            if (mergeUpOrDown) {
                if (mergeToDevice.maxWidth < device.maxWidth) {
                    throw new Error([
                        `Device "${mergeToDeviceName}" for merging "up to" has max width`,
                        `that less than target device "${device.name}" max width`,
                    ].join(' '));
                }
                this._intermediateData.deviceMergedRangeByName[device.name] = new Range(this._intermediateData.deviceMergedRangeByName[device.name].from, this._intermediateData.deviceRangeByName[mergeToDeviceName].to);
            }
            else {
                if (mergeToDevice.maxWidth > device.maxWidth) {
                    throw new Error([
                        `Device "${mergeToDeviceName}" for merging "down to" has max width`,
                        `that greater than target device "${device.name}" max width`,
                    ].join(' '));
                }
                this._intermediateData.deviceMergedRangeByName[device.name] = new Range(this._intermediateData.deviceRangeByName[mergeToDeviceName].from, this._intermediateData.deviceMergedRangeByName[device.name].to);
            }
        }
    }
    ConfigBuilderModule.DeviceListBuilder = DeviceListBuilder;
    (function (DeviceListBuilder) {
        let Data;
        (function (Data) {
            class OutputDeviceList extends Array {
            }
            Data.OutputDeviceList = OutputDeviceList;
            class IntermediateData {
            }
            Data.IntermediateData = IntermediateData;
        })(Data = DeviceListBuilder.Data || (DeviceListBuilder.Data = {}));
    })(DeviceListBuilder = ConfigBuilderModule.DeviceListBuilder || (ConfigBuilderModule.DeviceListBuilder = {}));
    let Types;
    (function (Types) {
        class DeviceByName {
        }
        Types.DeviceByName = DeviceByName;
        class DeviceByMaxWidth {
        }
        Types.DeviceByMaxWidth = DeviceByMaxWidth;
        class DeviceRangeByName {
        }
        Types.DeviceRangeByName = DeviceRangeByName;
    })(Types = ConfigBuilderModule.Types || (ConfigBuilderModule.Types = {}));
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
(function (RawOptionsData) {
    let ValueType;
    (function (ValueType) {
        ValueType["Null"] = "Null";
        ValueType["String"] = "String";
        ValueType["Float"] = "Float";
    })(ValueType = RawOptionsData.ValueType || (RawOptionsData.ValueType = {}));
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
    class RawSubOption extends BaseRawOption {
    }
    RawOptionsData.RawSubOption = RawSubOption;
    class BaseRawOptionIndexedList extends BaseOptionIndexedList {
    }
    RawOptionsData.BaseRawOptionIndexedList = BaseRawOptionIndexedList;
    class RawOptionIndexedList extends BaseRawOptionIndexedList {
    }
    RawOptionsData.RawOptionIndexedList = RawOptionIndexedList;
    class RawSubOptionIndexedList extends BaseRawOptionIndexedList {
    }
    RawOptionsData.RawSubOptionIndexedList = RawSubOptionIndexedList;
})(RawOptionsData || (RawOptionsData = {}));

class DataSchema {
    constructor(optionSchemas) {
        this.optionSchemas = new DataSchema.OptionSchemaIndexedList();
        this.optionSchemas.add(...optionSchemas);
    }
}
(function (DataSchema) {
    let ValueFormat;
    (function (ValueFormat) {
        ValueFormat["NoValue"] = "NoValue";
        ValueFormat["SingleValue"] = "SingleValue";
    })(ValueFormat = DataSchema.ValueFormat || (DataSchema.ValueFormat = {}));
    let ValueType;
    (function (ValueType) {
        ValueType["String"] = "String";
        ValueType["Float"] = "Float";
    })(ValueType = DataSchema.ValueType || (DataSchema.ValueType = {}));
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
        static createNoValue(bindingToData) {
            return new ValueSchema(bindingToData, ValueFormat.NoValue, null);
        }
        static createSingleValue(bindingToData, valueType) {
            return new ValueSchema(bindingToData, ValueFormat.SingleValue, valueType);
        }
    }
    DataSchema.ValueSchema = ValueSchema;
    let OptionType;
    (function (OptionType) {
        OptionType["Single"] = "Single";
        OptionType["Multiple"] = "Multiple";
    })(OptionType = DataSchema.OptionType || (DataSchema.OptionType = {}));
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
    class SubOptionSchema extends BaseOptionSchema {
    }
    DataSchema.SubOptionSchema = SubOptionSchema;
    class BaseOptionSchemaIndexedList extends BaseOptionIndexedList {
    }
    DataSchema.BaseOptionSchemaIndexedList = BaseOptionSchemaIndexedList;
    class OptionSchemaIndexedList extends BaseOptionSchemaIndexedList {
    }
    DataSchema.OptionSchemaIndexedList = OptionSchemaIndexedList;
    class SubOptionSchemaIndexedList extends BaseOptionSchemaIndexedList {
    }
    DataSchema.SubOptionSchemaIndexedList = SubOptionSchemaIndexedList;
    class SchemaFactory {
        createValueOptionEx(optionOrSubOption, valueType, name, optionToProperty, required, transformFunc = null) {
            let optionSchema;
            if (optionOrSubOption) {
                optionSchema = new OptionSchema(name, new OptionBindingToData(optionToProperty), OptionType.Single, ValueSchema.createSingleValue(null, valueType), required, null, transformFunc);
            }
            else {
                optionSchema = new SubOptionSchema(name, new OptionBindingToData(optionToProperty), OptionType.Single, ValueSchema.createSingleValue(null, valueType), required, transformFunc);
            }
            return optionSchema;
        }
        createStringOption(name, optionToProperty, required, transformFunc = null) {
            return this.createValueOptionEx(true, ValueType.String, name, optionToProperty, required, transformFunc);
        }
        createStringSubOption(name, optionToProperty, required, transformFunc = null) {
            return this.createValueOptionEx(false, ValueType.String, name, optionToProperty, required, transformFunc);
        }
        createFloatOption(name, optionToProperty, required, transformFunc = null) {
            return this.createValueOptionEx(true, ValueType.Float, name, optionToProperty, required, transformFunc);
        }
        createFloatSubOption(name, optionToProperty, required, transformFunc = null) {
            return this.createValueOptionEx(false, ValueType.Float, name, optionToProperty, required, transformFunc);
        }
        createObjectOptionEx(optionType, name, optionToProperty, required, subOptionSchemas, transformFunc = null) {
            return new OptionSchema(name, new OptionBindingToData(optionToProperty), optionType, null, required, subOptionSchemas, transformFunc);
        }
        createObjectOption(name, optionToProperty, required, subOptionSchemas, transformFunc = null) {
            return this.createObjectOptionEx(OptionType.Single, name, optionToProperty, required, subOptionSchemas, transformFunc);
        }
        createObjectArrayOption(name, optionToProperty, required, subOptionSchemas, transformFunc = null) {
            return this.createObjectOptionEx(OptionType.Multiple, name, optionToProperty, required, subOptionSchemas, transformFunc);
        }
    }
    DataSchema.SchemaFactory = SchemaFactory;
})(DataSchema || (DataSchema = {}));

class RawOptionsDataToDataTransformer {
    transform(rawOptionsData, schema) {
        const result = {};
        const clonedRawOptionsData = deepClone(rawOptionsData);
        this.transformOptionList(result, clonedRawOptionsData.rawOptions, schema.optionSchemas, (rawOption, optionSchema) => {
            return this.transformOptionItem(rawOption, optionSchema);
        });
        return result;
    }
    transformOptionList(toObject, rawOptions, optionSchemas, transformRawOptionFunc) {
        optionSchemas.each((curOptionSchema) => {
            this.transformOption(toObject, rawOptions, curOptionSchema, transformRawOptionFunc);
            rawOptions.byNameMany.removeAll(curOptionSchema.name);
        });
        if (rawOptions.any()) {
            throw new Error(`Unexpected option with name "${rawOptions.first().name}"`);
        }
    }
    setOptionToObject(toObject, optionValue, optionSchema) {
        const propertyName = optionSchema.bindingToData.optionToProperty;
        toObject[propertyName] = optionSchema.transformFunc
            ? optionSchema.transformFunc(optionValue)
            : optionValue;
    }
    transformOption(toObject, rawOptions, optionSchema, transformRawOptionFunc) {
        const rawOptionsWithSuchName = rawOptions.byNameMany.getAll(optionSchema.name);
        if (!(rawOptionsWithSuchName && rawOptionsWithSuchName.length)) {
            if (optionSchema.required) {
                throw new Error(`Required option with name "${optionSchema.name}" not found`);
            }
        }
        const optionBindingToData = optionSchema.bindingToData;
        switch (optionSchema.type) {
            case DataSchema.OptionType.Single:
                if (rawOptionsWithSuchName.length !== 1) {
                    throw new Error(`Single option with name "${optionSchema.name}" occurred more that once`);
                }
                this.setOptionToObject(toObject, transformRawOptionFunc(rawOptionsWithSuchName[0], optionSchema), optionSchema);
                break;
            case DataSchema.OptionType.Multiple:
                this.setOptionToObject(toObject, rawOptionsWithSuchName.map(curRawOption => transformRawOptionFunc(curRawOption, optionSchema)), optionSchema);
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
            }
            else {
                const value = this.transformValue(rawOption, optionSchema);
                result = this.applyValueBindingToDataIfExists(value, optionSchema);
            }
        }
        else {
            result = {};
            this.transformOptionList(result, rawOption.rawSubOptions, optionSchema.subOptionSchemas, (rawSubOption, subOptionSchema) => {
                return this.transformSubOptionItem(rawSubOption, subOptionSchema);
            });
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
        const result = valueBindingToData
            ? { [valueBindingToData.valueToProperty]: value }
            : value;
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
}

var FloatNumberParser;
(function (FloatNumberParser) {
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
        }
        catch (e) {
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
(function (TokensData) {
    let TokenType;
    (function (TokenType) {
        TokenType["OptionName"] = "OptionName";
        TokenType["SubOptionName"] = "SubOptionName";
        TokenType["KeywordValue"] = "KeywordValue";
        TokenType["StringValue"] = "StringValue";
        TokenType["FloatValue"] = "FloatValue";
    })(TokenType = TokensData.TokenType || (TokensData.TokenType = {}));
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
        tokensData.tokens = stringParts.map((part) => {
            let token;
            if (part.startsWith('--')) {
                token = TokensData.Token.createToken(TokensData.TokenType.OptionName, part.substr('--'.length).trim());
            }
            else if (part.startsWith('[') && part.endsWith(']')) {
                token = TokensData.Token.createToken(TokensData.TokenType.SubOptionName, part.substr(1, part.length - 2).trim());
            }
            else if (part.startsWith('#')) {
                token = TokensData.Token.createToken(TokensData.TokenType.KeywordValue, part.substr('#'.length).trim());
            }
            else if (StringToTokensDataTransformer._quotationMarks.includes(part.charAt(0))
                && part.charAt(0) === part.charAt(part.length - 1)) {
                token = TokensData.Token.createToken(TokensData.TokenType.StringValue, part.substr(1, part.length - 2).trim());
            }
            else {
                const partAsFloatNumber = FloatNumberParser.tryParse(part);
                if (typeof partAsFloatNumber === 'number') {
                    token = TokensData.Token.createTokenWithTypedValue(TokensData.TokenType.FloatValue, part, partAsFloatNumber);
                }
                else {
                    throw new Error('Unexpected string part in config string');
                }
            }
            return token;
        });
        return tokensData;
    }
}
StringToTokensDataTransformer._quotationMarks = ['\'', '\"'];

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
        }
        else {
            throw new Error('Sub option must be only in option');
        }
    }
    processKeywordValueToken(token) {
        let rawValue;
        const keywordValue = token.value;
        if (keywordValue === 'rtd-none') {
            rawValue = new RawOptionsData.RawValue(RawOptionsData.ValueType.Null, null);
        }
        else {
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
        }
        else if (this._currentRawOption) {
            this._currentRawOption.rawValues.push(rawValue);
        }
        else {
            throw new Error('Value must be only in option or sub option');
        }
    }
}

var OptionsParser;
(function (OptionsParser) {
    function parse(string, schema) {
        const tokensData = (new StringToTokensDataTransformer()).transform(string);
        const rawOptionsData = (new TokensDataToRawOptionsDataTransformer()).transform(tokensData);
        const data = (new RawOptionsDataToDataTransformer()).transform(rawOptionsData, schema);
        return data;
    }
    OptionsParser.parse = parse;
    class DataSchema$1 extends DataSchema {
    }
    OptionsParser.DataSchema = DataSchema$1;
})(OptionsParser || (OptionsParser = {}));

var InputConfigModule;
(function (InputConfigModule) {
    let ConfigParser;
    (function (ConfigParser) {
        const schemaFactory = new OptionsParser.DataSchema.SchemaFactory();
        const schema = new OptionsParser.DataSchema([
            schemaFactory.createStringOption('rtd-units', 'units', true),
            schemaFactory.createObjectOption('rtd-unknown-device', 'unknownDevice', true, [
                schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
                schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
            ]),
            schemaFactory.createObjectArrayOption('rtd-device', 'deviceList', true, [
                schemaFactory.createStringSubOption('rtd-device-name', 'name', true),
                schemaFactory.createStringSubOption('rtd-device-class', 'cssClass', true),
                schemaFactory.createFloatSubOption('rtd-device-max-width', 'maxWidth', true, value => (value === null) ? Infinity : value),
                schemaFactory.createStringSubOption('rtd-device-merge-down-to', 'mergeDownTo', true),
                schemaFactory.createStringSubOption('rtd-device-merge-up-to', 'mergeUpTo', true),
            ]),
        ]);
        function parse(string) {
            const config = OptionsParser.parse(string, schema);
            return config;
        }
        ConfigParser.parse = parse;
    })(ConfigParser = InputConfigModule.ConfigParser || (InputConfigModule.ConfigParser = {}));
})(InputConfigModule || (InputConfigModule = {}));

class InputProjection {
}
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
(function (PassedQuery_Passed) {
    PassedQuery_Passed["NotPassed"] = "NotPassed";
    PassedQuery_Passed["Passed"] = "Passed";
})(PassedQuery_Passed || (PassedQuery_Passed = {}));
var PassedQuery_QueryType;
(function (PassedQuery_QueryType) {
    PassedQuery_QueryType["Empty"] = "Empty";
    PassedQuery_QueryType["NotEmpty"] = "NotEmpty";
})(PassedQuery_QueryType || (PassedQuery_QueryType = {}));
class BasePassedQuery {
}
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

class PassedMediaQuery extends BasePassedQuery {
}
class PassedMediaQueryOrQuery extends BasePassedQuery {
}
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
                }
                else if (rangeFeatureSummary.type === MqRangeFeatureSummaryForUnitsType.HasRange) {
                    passedOrQueryValue = deepClone(orQuery);
                    const range = rangeFeatureSummary.rangeInUnits.range;
                    const rangeStartsWithInfinity = (range.from === Number.NEGATIVE_INFINITY);
                    const rangeEndsWithInfinity = (range.to === Number.POSITIVE_INFINITY);
                    if (!rangeStartsWithInfinity) {
                        passedOrQueryValue.addFeatures(new MediaQueryFeatureAst('min', 'width', new CssValue(new ValueInUnits(range.from, rangeFeatureSummary.rangeInUnits.units))));
                    }
                    if (!rangeEndsWithInfinity) {
                        passedOrQueryValue.addFeatures(new MediaQueryFeatureAst('max', 'width', new CssValue(new ValueInUnits(range.to, rangeFeatureSummary.rangeInUnits.units))));
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
        }
        else {
            const notEmptyOrQueryList = passedOrQueryList.filter(orQuery => orQuery.queryType === PassedQuery_QueryType.NotEmpty);
            if (!notEmptyOrQueryList.length) {
                passedMediaQuery = passedMediaQueryFactory.createPassedEmpty();
            }
            else {
                passedMediaQuery = passedMediaQueryFactory.createPassedNotEmpty(new MediaQueryAst(notEmptyOrQueryList.map(orQuery => orQuery.query)));
            }
        }
        return passedMediaQuery;
    }
}

class OutputProjection {
}
(function (OutputProjection) {
    class DeviceOutput {
    }
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
        const deviceOutputList = this._config.deviceList.map((device) => {
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
        if (width.type === MqRangeFeatureSummaryForUnitsType.NoRange
            || width.type === MqRangeFeatureSummaryForUnitsType.EmptyRange) {
            outputWidth = width;
        }
        else if (width.type === MqRangeFeatureSummaryForUnitsType.HasRange) {
            let outputWidthRange = Range.intersect(width.rangeInUnits.range, device.widthRange);
            if (!outputWidthRange) {
                outputWidth = MqRangeFeatureSummaryForUnits.createEmptyRange('width');
            }
            else {
                outputWidthRange = new Range((outputWidthRange.from !== device.widthRange.from)
                    ? outputWidthRange.from
                    : -Infinity, (outputWidthRange.to !== device.widthRange.to)
                    ? outputWidthRange.to
                    : Infinity);
                outputWidth = MqRangeFeatureSummaryForUnits.createHasRangeWithRangeAndUnits('width', outputWidthRange, this._config.units);
            }
        }
        return outputWidth;
    }
}

var MediaQueryToDevices;
(function (MediaQueryToDevices) {
    function mediaQueryToDeviceMediaQueries(config, mediaQuery) {
        if (!config) {
            throw new Error('{config} required');
        }
        if (!mediaQuery) {
            throw new Error('{mediaQuery} required');
        }
        const inputProjection = new InputProjectionBuilder(config, mediaQuery).createInputProjection();
        const outputProjection = new OutputProjectionBuilder(config, inputProjection).createOutputProjection();
        const result = new DeviceMediaQueryIndexedList();
        result.add(...outputProjection.deviceOutputList);
        return result;
    }
    MediaQueryToDevices.mediaQueryToDeviceMediaQueries = mediaQueryToDeviceMediaQueries;
    function addDeviceFilteringToSelector(selector, deviceCssClass) {
        const parsedSelector = cssWhat.parse(selector);
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
            }
            else {
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
        return cssWhat.stringify(parsedSelector);
    }
    MediaQueryToDevices.addDeviceFilteringToSelector = addDeviceFilteringToSelector;
    class DeviceMediaQueryIndexedList extends IndexedList {
        constructor() {
            super(...arguments);
            this.byDeviceNameOne = new UniqueIndexedListIndex(this, item => item.device.name);
        }
    }
    MediaQueryToDevices.DeviceMediaQueryIndexedList = DeviceMediaQueryIndexedList;
})(MediaQueryToDevices || (MediaQueryToDevices = {}));

class LowLevelCompiler {
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
            this.removeConfigDecl(resultRoot);
        }
        return resultRoot;
    }
    processRoot(root) {
        const newRoot = this._cssDriver.createRoot();
        const deviceName = this._options.compileOnlyThisDevice;
        let device;
        if (!deviceName) {
            device = null;
        }
        else {
            if (deviceName === this._config.unknownDevice.name) {
                device = LowLevelCompiler.UnknownDevice.instance;
            }
            else {
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
        node.each((child) => {
            if (child.type === CssTree.NodeType.atrule) {
                this.processAtRule(child, newParent, parentDevice);
            }
            else if (child.type === CssTree.NodeType.rule) {
                this.processRule(child, newParent, parentDevice);
            }
            else if (child.type === CssTree.NodeType.decl) {
                this.processDecl(child, newParent);
            }
        });
    }
    processAtRule(atRule, newParent, parentDevice) {
        if (atRule.name === CssTree.AtRuleName.media) {
            this.processMediaAtRule(atRule, newParent, parentDevice);
        }
        else {
            if (!parentDevice) {
                newParent.append(atRule.clone());
            }
            else {
                const newAtRule = this.cloneContainerWithoutChildNodes(atRule);
                newParent.append(newAtRule);
                this.processChildNodesOfNode(atRule, newAtRule, parentDevice);
            }
        }
    }
    processMediaAtRule(mediaAtRule, newParent, parentDevice) {
        const mediaQueryList = MediaQueryToDevices.mediaQueryToDeviceMediaQueries(this._config, mediaAtRule.params);
        if (parentDevice) {
            if (parentDevice instanceof LowLevelCompiler.UnknownDevice) {
                this.processUnknownDeviceMediaAtRule(mediaAtRule, newParent, parentDevice);
            }
            else if (parentDevice instanceof ConfigModule.Device) {
                const mediaQuery = mediaQueryList.byDeviceNameOne.get(parentDevice.name);
                this.processDeviceMediaAtRule(mediaAtRule, newParent, mediaQuery);
            }
            else {
                throw new NotImplementedError();
            }
        }
        else {
            mediaQueryList.each((mediaQuery) => {
                this.processDeviceMediaAtRule(mediaAtRule, newParent, mediaQuery);
            });
            this.processUnknownDeviceMediaAtRule(mediaAtRule, newParent, LowLevelCompiler.UnknownDevice.instance);
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
        }
        else {
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
        }
        else {
            const deviceCssClass = this.computeDeviceCssClass(device);
            deviceSelector = MediaQueryToDevices.addDeviceFilteringToSelector(baseSelector, deviceCssClass);
        }
        return deviceSelector;
    }
    computeDeviceCssClass(device) {
        let deviceCssClass;
        if (device instanceof LowLevelCompiler.UnknownDevice) {
            deviceCssClass = this._config.unknownDevice.cssClass;
        }
        else if (device instanceof ConfigModule.Device) {
            deviceCssClass = device.cssClass;
        }
        else {
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
    loadConfig(root) {
        const configString = this.loadConfigString(root);
        const inputConfig = InputConfigModule.ConfigParser.parse(configString);
        const config = (new ConfigBuilderModule.ConfigBuilder())
            .setUnits(inputConfig.units)
            .setUnknownDevice(inputConfig.unknownDevice)
            .setDeviceList(inputConfig.deviceList)
            .createConfig();
        return config;
    }
    loadConfigString(root, removeConfigDecl = false) {
        let configString;
        let configFoundInCss = false;
        root.each((node) => {
            if (node.type === CssTree.NodeType.rule) {
                const rule = node;
                if (rule.selector.toLowerCase() === 'html') {
                    rule.each((node) => {
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
(function (LowLevelCompiler) {
    class UnknownDevice {
        constructor() { }
        static get instance() {
            if (!this._instance) {
                this._instance = new UnknownDevice();
            }
            return this._instance;
        }
    }
    LowLevelCompiler.UnknownDevice = UnknownDevice;
})(LowLevelCompiler || (LowLevelCompiler = {}));

class Compiler {
    compile(sourceCssRoot, options, cssDriver) {
        const inCompilerCssRoot = cssDriver.sourceRootToRoot(sourceCssRoot);
        const lowLevelCompiler = new LowLevelCompiler();
        const config = lowLevelCompiler.loadConfig(inCompilerCssRoot);
        lowLevelCompiler.setConfig(config);
        lowLevelCompiler.setOptions(options);
        lowLevelCompiler.setCssDriver(cssDriver);
        const outCompilerCssRoot = lowLevelCompiler.compile(inCompilerCssRoot);
        let resultSourceCssRoot = cssDriver.rootToSourceRoot(outCompilerCssRoot);
        resultSourceCssRoot = cssDriver.prettify(resultSourceCssRoot);
        return resultSourceCssRoot;
    }
    loadConfig(sourceCssRoot, cssDriver) {
        const lowLevelCompiler = new LowLevelCompiler();
        const config = lowLevelCompiler.loadConfig(cssDriver.sourceRootToRoot(sourceCssRoot));
        return config;
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
    let result = (typeof oldIndent === 'string') ? oldIndent : '';
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
    if (nodeDepth === 0)
        doubleSpace(node);
}
function comment(node) {
    if (getDepth(node) === 0)
        doubleSpace(node);
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
    if (nodeDepth === 0)
        doubleSpace(node);
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
const plugin = postcss.plugin('postcss-prettify', () => (css) => {
    css.walk(format);
    if (css.first && css.first.raws)
        css.first.raws.before = '';
});
plugin.process = css => postcss([plugin]).process(css);

var PostcssCssTreeUtils;
(function (PostcssCssTreeUtils) {
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
(function (PostcssCssTree) {
    // Node type
    let PostcssNodeType;
    (function (PostcssNodeType) {
        PostcssNodeType["root"] = "root";
        PostcssNodeType["atrule"] = "atrule";
        PostcssNodeType["rule"] = "rule";
        PostcssNodeType["decl"] = "decl";
        PostcssNodeType["comment"] = "comment";
    })(PostcssNodeType = PostcssCssTree.PostcssNodeType || (PostcssCssTree.PostcssNodeType = {}));
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
            this.postcssContainerBase.append(...nodes.map((curNode) => {
                return curNode.postcssNodeBase;
            }));
            return this;
        }
        removeAll() {
            this.postcssContainerBase.removeAll();
            return this;
        }
    }
    PostcssCssTree.ContainerBase = ContainerBase;
    class ChildContainerBase extends ContainerBase {
    }
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
        get params() { return this.postcssAtRule.params; }
        set params(value) { this.postcssAtRule.params = value; }
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
        get selector() { return this.postcssRule.selector; }
        set selector(value) { this.postcssRule.selector = value; }
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
        get prop() { return this.postcssDeclaration.prop; }
        set prop(value) { this.postcssDeclaration.prop = value; }
        get value() { return this.postcssDeclaration.value; }
        set value(value) { this.postcssDeclaration.value = value; }
        get important() { return this.postcssDeclaration.important; }
        set important(value) { this.postcssDeclaration.important = value; }
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
    prettify(sourceRoot) {
        return plugin.process(sourceRoot).root;
    }
}

const postcssRtdCssPlugin = postcss.plugin('postcss-rtd-css', (opts) => {
    return (root, result) => {
        const compiler = new Compiler();
        result.root = compiler.compile(result.root, opts, new PostcssCssDriver());
    };
});

module.exports = postcssRtdCssPlugin;
//# sourceMappingURL=postcss-rtd-css.cjs.js.map
