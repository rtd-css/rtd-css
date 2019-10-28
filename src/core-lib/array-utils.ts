export module ArrayUtils {
	export function isEqual<TItem>(arr1: TItem[], arr2: TItem[]): boolean {
		if (!arr1) {
			throw new Error('{arr1} required');
		}
		if (!arr2) {
			throw new Error('{arr2} required');
		}

		const isEqual = arr1.length === arr2.length && arr1.every((item, index) => item === arr2[index]);

		return isEqual;
	}
}
