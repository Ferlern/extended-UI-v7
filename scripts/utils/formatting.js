exports.powerToString = function(currentNetPower, graphs) {
    let num = Math.round(currentNetPower*60); 

    let graphString = graphs.length > 1 ? " (sep " + graphs.length + ')' : '';
    let sign = num > 0 ? '+' : '';
    let color = num >= 0 ? '[stat]' : '[red]';

    let powerString = exports.numberToString(num, 1);
    return color + sign + powerString + '[white]' + graphString;
}

exports.numberToString = function(num, triplets) {
    triplets = triplets || 0;
    let power = Math.floor(Math.log(Math.abs(num)) / Math.log(1000)) - triplets;
    if (power > 0) {
        // somehow crashed on this string one time. Idk how
        // TODO remove this stupid hack
        try {
            return num.toString().slice(0, (-3*power + 1)).splice(-1, '.') + 'k'.repeat(power);
        } catch (e) {
            return num.toString();
        }
    } else {
        return num.toString();
    }
}
