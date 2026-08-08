const PREFIX = "eui-task-priority-";
const ENABLED_PREFIX = "eui-task-enabled-";

// Stable list of every automation task auto-pilot can pick. Each entry is
// what gets sorted against the others when multiple are valid for the
// current drone state. Defaults are the legacy hard-coded ordering: feed
// consumers first, then storages, then collect, then last-resort dumps.
const TASKS = [
    { id: "producer-topup",       defaultPriority: 110, bundleKey: "eui.task.producer-topup" },
    { id: "consumer-deliver",     defaultPriority: 100, bundleKey: "eui.task.consumer-deliver" },
    { id: "storage-deliver",      defaultPriority: 80,  bundleKey: "eui.task.storage-deliver" },
    { id: "storage-drain-fetch",  defaultPriority: 75,  bundleKey: "eui.task.storage-drain-fetch" },
    { id: "storage-fetch",        defaultPriority: 70,  bundleKey: "eui.task.storage-fetch" },
    { id: "consumer-core-fetch",  defaultPriority: 60,  bundleKey: "eui.task.consumer-core-fetch" },
    { id: "producer-collect",     defaultPriority: 50,  bundleKey: "eui.task.producer-collect" },
    { id: "core-dump",            defaultPriority: 10,  bundleKey: "eui.task.core-dump" },
];

exports.PREFIX = PREFIX;
exports.ENABLED_PREFIX = ENABLED_PREFIX;
exports.TASKS = TASKS;

exports.isEnabled = function(taskId) {
    return Core.settings.getBool(ENABLED_PREFIX + taskId, true);
}

exports.setEnabled = function(taskId, value) {
    Core.settings.put(ENABLED_PREFIX + taskId, !!value);
}

function defaultFor(taskId) {
    for (let i = 0; i < TASKS.length; i++) {
        if (TASKS[i].id === taskId) return TASKS[i].defaultPriority;
    }
    return 0;
}

exports.get = function(taskId) {
    try {
        const raw = Core.settings.getString(PREFIX + taskId, "");
        if (!raw) return defaultFor(taskId);
        const v = parseInt(raw);
        return isNaN(v) ? defaultFor(taskId) : v;
    } catch (e) {
        return defaultFor(taskId);
    }
}

exports.set = function(taskId, value) {
    Core.settings.put(PREFIX + taskId, ((value | 0)) + "");
}

exports.reset = function(taskId) {
    Core.settings.remove(PREFIX + taskId);
}

// Sort the given candidates ({ task, target } pairs) by descending priority
// in place, then return the highest-priority target (or null). Disabled
// tasks are filtered out so the user's checkboxes actually take effect.
exports.pickHighest = function(candidates) {
    if (!candidates || candidates.length === 0) return null;
    const live = [];
    for (let i = 0; i < candidates.length; i++) {
        if (exports.isEnabled(candidates[i].task)) live.push(candidates[i]);
    }
    if (live.length === 0) return null;
    live.sort((a, b) => exports.get(b.task) - exports.get(a.task));
    return live[0].target;
}
