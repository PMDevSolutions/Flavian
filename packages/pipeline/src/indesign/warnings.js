// Non-fatal warning collector. The whole point of this object is to let the
// parser carry on through dodgy IDMLs without throwing — designers ship
// surprisingly broken files and we'd rather emit a partial IR with notes than
// halt at the first unknown attribute.

export class WarningCollector {
	constructor() {
		/** @type {Array<import('./ir.js').ParseWarningIR>} */
		this.entries = [];
	}

	/**
	 * @param {string} code
	 * @param {string} message
	 * @param {{file?: string, id?: string}} [context]
	 */
	add(code, message, context = {}) {
		this.entries.push({ code, message, context });
	}

	list() {
		return [...this.entries];
	}
}
