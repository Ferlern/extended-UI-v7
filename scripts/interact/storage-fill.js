const timer = require("extended-ui/interact/interact-timer");
const storageConfig = require("extended-ui/interact/storage-config");
const coreLimits = require("extended-ui/interact/core-limits");

exports.isManagedStorage = function(block) {
    return block instanceof StorageBlock && !(block instanceof CoreBlock);
}

exports.isItemReservedForStorage = function(item, team) {
    if (!Core.settings.getBool("eui-auto-fill", false)) return false;
    if (!Core.settings.getBool("eui-storage-fill", false)) return false;
    if (!team) return false;
    const data = team.data();
    if (!data || !data.buildings) return false;
    const autopilot = Core.settings.getBool("eui-auto-pilot", false);
    const player = Vars.player;
    // Storages whose deficit is smaller than the drone's full inventory
    // never get visited, so they must NOT hold an item reservation.
    const droneCap = (player && player.unit() && player.unit().type
        && player.unit().type.itemCapacity) || 0;
    let reserved = false;
    data.buildings.each(b => {
        if (reserved) return;
        try {
            if (!exports.isManagedStorage(b.block)) return;
            const threshold = storageConfig.getThreshold(b, item);
            if (threshold <= 0) return;
            if (!b.items) return;
            const stock = b.items.get(item);
            if (stock >= threshold) return;
            if (autopilot && droneCap > 0 && (threshold - stock) < droneCap) return;
            if (autopilot || (player && player.within(b, Vars.buildingRange))) {
                reserved = true;
            }
        } catch (e) {}
    });
    return reserved;
}

// Loaded after our exports above so storage-drain (which requires this
// module) gets its own usable reference; we use storageDrain only inside
// Trigger.update.
const storageDrain = require("extended-ui/interact/storage-drain");

Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-auto-fill", false)) return;
    if (!Core.settings.getBool("eui-storage-fill", false) || !timer.canInteract()) return;

    const player = Vars.player;
    if (player.unit() == null) return;
    const unit = player.unit();
    const stack = unit.stack;
    const team = player.team();
    const core = player.closestCore();

    if (stack.amount > 0 && stack.item) {
        // Drained items are headed for the core; don't reroute them into
        // another fill-target storage on the way (would shuttle infinitely
        // when the drain source keeps producing).
        if (storageDrain.isCarrying()) return;

        const autopilotOn = Core.settings.getBool("eui-auto-pilot", false);
        const cap = (unit.type && unit.type.itemCapacity) || 0;
        // Mirror the fetch-side trip threshold: with auto-pilot on, only top
        // up storages whose deficit is at least one full inventory. Otherwise
        // a tiny deficit on a closer storage steals deliveries meant for a
        // bigger one further away.
        const minDeficit = autopilotOn ? cap : 0;

        let target = null;
        Vars.indexer.eachBlock(team, player.x, player.y, Vars.buildingRange, () => true, b => {
            if (target) return;
            if (!exports.isManagedStorage(b.block)) return;
            const threshold = storageConfig.getThreshold(b, stack.item);
            if (threshold <= 0) return;
            if (!b.items) return;
            const stock = b.items.get(stack.item);
            if (stock >= threshold) return;
            if (minDeficit > 0 && (threshold - stock) < minDeficit) return;
            if (b.acceptStack(stack.item, stack.amount, unit) < 5) return;
            target = b;
        });
        if (target) {
            Call.transferInventory(player, target);
            timer.increase();
        }
        return;
    }

    if (!Core.settings.getBool("eui-interact-core", false)) return;
    if (!core || !player.within(core, Vars.buildingRange)) return;

    const autopilotOn = Core.settings.getBool("eui-auto-pilot", false);
    // When auto-pilot is steering, mirror its trip threshold: don't fetch
    // a partial inventory just because some storage is short by a handful.
    // Otherwise the drone burns trips topping off near-full storages.
    const minDeficit = autopilotOn ? ((unit.type && unit.type.itemCapacity) || 0) : 0;
    let neededItem = null;

    const checkStorage = b => {
        if (neededItem) return;
        try {
            if (!exports.isManagedStorage(b.block)) return;
            const item = storageConfig.findNeededItem(b, it =>
                core.items.get(it) >= coreLimits.getLimit(it), minDeficit);
            if (item) neededItem = item;
        } catch (e) {}
    };

    if (autopilotOn) {
        const data = team.data();
        if (data && data.buildings) {
            data.buildings.each(checkStorage);
        }
    } else {
        Vars.indexer.eachBlock(team, player.x, player.y, Vars.buildingRange, () => true, checkStorage);
    }

    if (neededItem) {
        Call.requestItem(player, core, neededItem, 999);
        timer.increase();
    }
});
