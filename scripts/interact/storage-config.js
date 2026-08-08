const PREFIX = "eui-storage-fill-";
const DRAIN_PREFIX = "eui-storage-drain-";
const PRIORITY_PREFIX = "eui-storage-priority-";
const MAX_THRESHOLD = 99999;
const MAX_PRIORITY = 999;

exports.PREFIX = PREFIX;
exports.DRAIN_PREFIX = DRAIN_PREFIX;
exports.PRIORITY_PREFIX = PRIORITY_PREFIX;
exports.MAX_THRESHOLD = MAX_THRESHOLD;
exports.MAX_PRIORITY = MAX_PRIORITY;

function key(b, item) {
    return PREFIX + b.tile.x + "_" + b.tile.y + "-" + item.name;
}

function drainKey(b, item) {
    return DRAIN_PREFIX + b.tile.x + "_" + b.tile.y + "-" + item.name;
}

function priorityKey(b) {
    return PRIORITY_PREFIX + b.tile.x + "_" + b.tile.y;
}

exports.getKey = key;
exports.getDrainKey = drainKey;
exports.getPriorityKey = priorityKey;

exports.getPriority = function(b) {
    try {
        const raw = Core.settings.getString(priorityKey(b), "");
        if (!raw) return 0;
        const v = parseInt(raw);
        return isNaN(v) ? 0 : v;
    } catch (e) {
        return 0;
    }
}

exports.setPriority = function(b, value) {
    const v = value | 0;
    if (v <= 0) {
        Core.settings.remove(priorityKey(b));
    } else {
        Core.settings.put(priorityKey(b), v + "");
    }
}

// Snapshot of every per-item config a storage holds. Used for the
// copy/paste UX in the storage-list dialog.
exports.snapshot = function(b) {
    const data = { thresholds: {}, drains: {}, priority: exports.getPriority(b) };
    Vars.content.items().each(item => {
        const t = exports.getThreshold(b, item);
        if (t > 0) data.thresholds[item.name] = t;
        if (exports.getDrain(b, item)) data.drains[item.name] = true;
    });
    return data;
}

exports.applySnapshot = function(b, data) {
    if (!data) return;
    // Wipe existing config first so paste replaces (not merges).
    Vars.content.items().each(item => {
        Core.settings.remove(key(b, item));
        Core.settings.remove(drainKey(b, item));
    });
    Vars.content.items().each(item => {
        const t = data.thresholds && data.thresholds[item.name];
        if (t) Core.settings.put(key(b, item), (t | 0) + "");
        const d = data.drains && data.drains[item.name];
        if (d) Core.settings.put(drainKey(b, item), true);
    });
    exports.setPriority(b, (data.priority | 0));
}

exports.getThreshold = function(b, item) {
    try {
        const raw = Core.settings.getString(key(b, item), "");
        if (!raw) return 0;
        const v = parseInt(raw);
        return isNaN(v) ? 0 : v;
    } catch (e) {
        return 0;
    }
}

exports.setThreshold = function(b, item, value) {
    const v = value | 0;
    if (v <= 0) {
        Core.settings.remove(key(b, item));
    } else {
        Core.settings.put(key(b, item), v + "");
        // Mutually exclusive with drain: setting a fill goal clears the drain
        // flag so the drone never shuttles the same item in and out of the
        // same storage forever.
        Core.settings.remove(drainKey(b, item));
    }
}

exports.countConfigured = function(b) {
    let count = 0;
    Vars.content.items().each(item => {
        if (exports.getThreshold(b, item) > 0 || exports.getDrain(b, item)) count++;
    });
    return count;
}

exports.getDrain = function(b, item) {
    return Core.settings.getBool(drainKey(b, item), false);
}

exports.setDrain = function(b, item, value) {
    if (value) {
        Core.settings.put(drainKey(b, item), true);
        Core.settings.remove(key(b, item));
    } else {
        Core.settings.remove(drainKey(b, item));
    }
}

exports.countDrains = function(b) {
    let count = 0;
    Vars.content.items().each(item => {
        if (exports.getDrain(b, item)) count++;
    });
    return count;
}

// Per-storage rotation memory: which item was picked the last time we
// resolved a tie. Lives in-memory only (resets on game launch). Survives
// across ticks and pickTarget rescans, which is all we need to chain
// "different item next time" when stocks are tied.
const lastPickedDrain = {};
const lastPickedFill = {};

function tileKey(b) {
    return b.tile.x + "_" + b.tile.y;
}

// Round-robin among `tied` (already filtered to the winning stock value):
// returns the item that doesn't equal the previously-picked one for this
// storage; updates the memory. With a uniform-stock storage that holds N
// distinct items the drone cycles through all N over N consecutive picks.
function rotate(b, tied, memoryMap) {
    if (tied.length === 0) return null;
    if (tied.length === 1) {
        memoryMap[tileKey(b)] = tied[0].name;
        return tied[0];
    }
    const last = memoryMap[tileKey(b)];
    let pick = null;
    for (let i = 0; i < tied.length; i++) {
        if (tied[i].name !== last) { pick = tied[i]; break; }
    }
    if (!pick) pick = tied[0];
    memoryMap[tileKey(b)] = pick.name;
    return pick;
}

// Pick an item this storage is configured to drain and currently has stock for.
// `coreAccepts` is an optional predicate (item -> bool) that filters by whether
// the core can still accept the item without overflow. Among eligible items the
// one with the HIGHEST stock wins; ties rotate through tied items so the same
// item isn't drained twice in a row when stocks are equal.
exports.findDrainItem = function(b, coreAccepts) {
    if (!b || !b.items) return null;
    let bestStock = -1;
    Vars.content.items().each(item => {
        if (!exports.getDrain(b, item)) return;
        const stock = b.items.get(item);
        if (stock <= 0) return;
        if (coreAccepts && !coreAccepts(item)) return;
        if (stock > bestStock) bestStock = stock;
    });
    if (bestStock <= 0) return null;
    const tied = [];
    Vars.content.items().each(item => {
        if (!exports.getDrain(b, item)) return;
        const stock = b.items.get(item);
        if (stock <= 0) return;
        if (coreAccepts && !coreAccepts(item)) return;
        if (stock === bestStock) tied.push(item);
    });
    return rotate(b, tied, lastPickedDrain);
}

// Pick an item this storage needs filled. The eligible item with the
// LOWEST current stock wins; ties rotate so the drone cycles through
// equally-empty items rather than always feeding the same one.
exports.findNeededItem = function(b, coreSupply, minDeficit) {
    if (!b || !b.items) return null;
    let bestStock = Infinity;
    Vars.content.items().each(item => {
        const threshold = exports.getThreshold(b, item);
        if (threshold <= 0) return;
        const stock = b.items.get(item);
        if (stock >= threshold) return;
        if (minDeficit > 0 && (threshold - stock) < minDeficit) return;
        if (coreSupply && !coreSupply(item)) return;
        if (stock < bestStock) bestStock = stock;
    });
    if (bestStock === Infinity) return null;
    const tied = [];
    Vars.content.items().each(item => {
        const threshold = exports.getThreshold(b, item);
        if (threshold <= 0) return;
        const stock = b.items.get(item);
        if (stock >= threshold) return;
        if (minDeficit > 0 && (threshold - stock) < minDeficit) return;
        if (coreSupply && !coreSupply(item)) return;
        if (stock === bestStock) tied.push(item);
    });
    return rotate(b, tied, lastPickedFill);
}
