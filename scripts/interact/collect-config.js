const FACTORY_KEY_PREFIX = "eui-collect-factory-";
const DRILL_KEY_PREFIX = "eui-collect-drill-";

exports.FACTORY_KEY_PREFIX = FACTORY_KEY_PREFIX;
exports.DRILL_KEY_PREFIX = DRILL_KEY_PREFIX;

exports.isFactoryEnabled = function(block) {
    return Core.settings.getBool(FACTORY_KEY_PREFIX + block.name, false);
}

exports.setFactoryEnabled = function(block, value) {
    Core.settings.put(FACTORY_KEY_PREFIX + block.name, !!value);
}

exports.isDrillItemEnabled = function(item) {
    return Core.settings.getBool(DRILL_KEY_PREFIX + item.name, false);
}

exports.setDrillItemEnabled = function(item, value) {
    Core.settings.put(DRILL_KEY_PREFIX + item.name, !!value);
}

// % of the producer's *achievable* output cap. For a GenericCrafter
// the output buffer never reaches itemCapacity in practice — the
// GenericCrafter steady-state max per output item is
// itemCapacity - craftAmount (the next craft must still fit, otherwise
// the crafter stalls). Drills produce one unit at a time so they use
// itemCapacity directly.
exports.getPickupThreshold = function(block, item) {
    if (!block) return 1;
    const baseCap = block.itemCapacity || 1;
    let effective = baseCap;
    if (item) {
        try {
            if (block instanceof GenericCrafter && block.outputItems) {
                for (let i = 0; i < block.outputItems.length; i++) {
                    const out = block.outputItems[i];
                    if (out.item === item) {
                        effective = Math.max(1, baseCap - out.amount);
                        break;
                    }
                }
            }
        } catch (e) {}
    }
    const percent = Core.settings.getInt("eui-collect-threshold", 50);
    const t = Math.floor(effective * percent / 100);
    return t < 1 ? 1 : t;
}
