export class StringBuilder {
	private _parts: string[];
	private _space: string;

	constructor() {
		this._parts = [];
		this._space = ' ';
	}

	stringify(): string {
		return this._parts.join('');
	}

	isEmpty(): boolean {
		return !this._parts.length;
	}

	add(...parts: string[]) {
		this._parts.push(...parts);
	}

	addSpaceIfNotEmpty(): void {
		if (!this.isEmpty()) {
			this.add(this._space);
		}
	}

	addIfNotEmpty(...parts: string[]): void {
		if (!this.isEmpty()) {
			this.add(...parts);
		}
	}
}
