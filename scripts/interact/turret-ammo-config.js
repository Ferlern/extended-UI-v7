const ENABLED_PREFIX = "eui-turret-ammo-enabled-";
const PRIORITY_PREFIX = "eui-turret-ammo-priority-";
const MAX_PRIORITY = 999;

exports.MAX_PRIORITY = MAX_PRIORITY;

function key(block, item) {
    return block.name + "-" + item.name;
}

exports.isEnabled = function(block, item) {
    return Core.settings.getBool(ENABLED_PREFIX + key(block, item), true);
}

exports.setEnabled = function(block, item, value) {
    Core.settings.put(ENABLED_PREFIX + key(block, item), !!value);
}

exports.getPriority = function(block, item) {
    try {
        const raw = Core.settings.getString(PRIORITY_PREFIX + key(block, item), "");
        if (!raw) return 0;
        const v = parseInt(raw);
        return isNaN(v) ? 0 : v;
    } catch (e) {
        return 0;
    }
}

exports.setPriority = function(block, item, value) {
    const v = value | 0;
    if (v <= 0) {
        Core.settings.remove(PRIORITY_PREFIX + key(block, item));
    } else {
        Core.settings.put(PRIORITY_PREFIX + key(block, item), v + "");
    }
}
