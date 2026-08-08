const PREFIX = "eui-turret-priority-";
const MAX_PRIORITY = 999;

exports.PREFIX = PREFIX;
exports.MAX_PRIORITY = MAX_PRIORITY;

exports.getPriority = function(block) {
    try {
        const raw = Core.settings.getString(PREFIX + block.name, "");
        if (!raw) return 0;
        const v = parseInt(raw);
        return isNaN(v) ? 0 : v;
    } catch (e) {
        return 0;
    }
}

exports.setPriority = function(block, value) {
    const v = value | 0;
    if (v <= 0) {
        Core.settings.remove(PREFIX + block.name);
    } else {
        Core.settings.put(PREFIX + block.name, v + "");
    }
}
