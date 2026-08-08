const DEFAULT_LIMIT = 20;
const LIMIT_MAX = 5000;
const KEY_PREFIX = "eui-core-limit-";
const OVERRIDE_KEY_PREFIX = "eui-core-limit-override-";
const GLOBAL_KEY = "eui-core-limit-global";

exports.DEFAULT_LIMIT = DEFAULT_LIMIT;
exports.LIMIT_MAX = LIMIT_MAX;
exports.KEY_PREFIX = KEY_PREFIX;
exports.OVERRIDE_KEY_PREFIX = OVERRIDE_KEY_PREFIX;
exports.GLOBAL_KEY = GLOBAL_KEY;

exports.getKey = function(item) {
    return KEY_PREFIX + item.name;
}

exports.getGlobalLimit = function() {
    return Core.settings.getInt(GLOBAL_KEY, DEFAULT_LIMIT);
}

exports.isOverridden = function(item) {
    return Core.settings.getBool(OVERRIDE_KEY_PREFIX + item.name, false);
}

exports.setOverridden = function(item, value) {
    Core.settings.put(OVERRIDE_KEY_PREFIX + item.name, !!value);
}

exports.getStoredLimit = function(item) {
    try {
        const raw = Core.settings.getString(KEY_PREFIX + item.name, "");
        if (!raw) return DEFAULT_LIMIT;
        const v = parseInt(raw);
        return isNaN(v) ? DEFAULT_LIMIT : v;
    } catch (e) {
        return DEFAULT_LIMIT;
    }
}

exports.getLimit = function(item) {
    if (exports.isOverridden(item)) {
        return exports.getStoredLimit(item);
    }
    return exports.getGlobalLimit();
}

exports.setLimit = function(item, value) {
    Core.settings.put(KEY_PREFIX + item.name, ((value | 0)) + "");
}

exports.resetLimit = function(item) {
    Core.settings.remove(KEY_PREFIX + item.name);
    Core.settings.remove(OVERRIDE_KEY_PREFIX + item.name);
}
