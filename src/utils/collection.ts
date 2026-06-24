export function arrayFromItems<T>(items: unknown): T[] {
	if (Array.isArray(items)) {
		return items as T[];
	}

	if (items && typeof (items as any).filter === 'function') {
		return (items as any).filter(() => true) as T[];
	}

	if (items && typeof (items as any)[Symbol.iterator] === 'function') {
		return Array.from(items as Iterable<T>);
	}

	if (items && typeof (items as any).contents === 'object' && Array.isArray((items as any).contents)) {
		return (items as any).contents as T[];
	}

	if (items && typeof (items as any).contents === 'object') {
		return Object.values((items as any).contents) as T[];
	}

	if (items && typeof (items as any).values === 'function') {
		return Array.from((items as any).values()) as T[];
	}

	return [];
}
