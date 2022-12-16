Object.fromEntries = function(entries) {
    if (!entries || !entries[Symbol.iterator]) { throw new Error('Object.fromEntries() requires a single iterable argument'); }
    let obj = {};
    for (let [key, value] of entries) {
        obj[key] = value;
    }
    return obj;
};

Object.entries = function(obj) {
    let ownProps = Object.keys( obj );
    let i = ownProps.length;
    let resArray = new Array(i);
    while (i--)
        resArray[i] = [ownProps[i], obj[ownProps[i]]];

    return resArray;
};

if (String.prototype.splice === undefined) {
    /**
    * Splices text within a string.
    * @param {int} offset The position to insert the text at (before)
    * @param {string} text The text to insert
    * @param {int} [removeCount=0] An optional number of characters to overwrite
    * @returns {string} A modified string containing the spliced text.
    */
    String.prototype.splice = function(offset, text, removeCount) {
        removeCount = removeCount || 0;
        let calculatedOffset = offset < 0 ? this.length + offset : offset;
        return this.substring(0, calculatedOffset) +
            text + this.substring(calculatedOffset + removeCount);
    };
}
