import fs from 'fs';

export module fsEx {
	export const errors = {
		ENOENT: 'ENOENT',
	};

	export function pathExistsSync(path: string, statsFilter: (stats: fs.Stats) => boolean): boolean {
		let result: boolean;
		try {
			const stats = fs.lstatSync(path);
			result = (statsFilter && stats) ? statsFilter(stats) : !!stats;
		} catch (e) {
			if (e.code === errors.ENOENT) {
				result = false;
			} else {
				throw e;
			}
		}
		return result;
	}

	export function fileExistsSync(path: string): boolean {
		return pathExistsSync(
			path,
			stats => stats.isFile(),
		);
	}

	export function directoryExistsSync(path: string): boolean {
		return pathExistsSync(
			path,
			stats => stats.isDirectory(),
		);
	}
}
