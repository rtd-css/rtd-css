const clone = require('clone');

export const deepClone = function<T> (arg: T): T {
	return clone.call(this, arg);
};
