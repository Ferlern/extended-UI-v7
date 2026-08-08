const storageConfig = require("extended-ui/interact/storage-config");
const storageFill = require("extended-ui/interact/storage-fill");
const timer = require("extended-ui/interact/interact-timer");

let carrying = false;

exports.isCarrying = function() { return carrying; }

// Drone must be able to pull at least this much before we touch a drain
// storage — otherwise the module would shuttle 1 unit per tick the moment
// anything trickles into the storage, ruining whatever else was queued.
function droneItemCap() {
    const player = Vars.player;
    if (!player) return 0;
    const unit = player.unit();
    if (!unit || !unit.type) return 0;
    return unit.type.itemCapacity || 0;
}

// Pick the storage with the most stock of any item flagged for drain. The
// auto-pilot uses this to plan the trip; the actual fetch happens here once
// the drone is in range. Storages below the drone's own capacity are
// skipped so a trip is only worth taking when at least one full inventory
// can be cleared in one go.
exports.findDrainSource = function(team) {
    if (!team) return null;
    const data = team.data();
    if (!data || !data.buildings) return null;
    const cap = droneItemCap();
    let best = null;
    let bestPriority = -1;
    let bestStock = 0;
    data.buildings.each(b => {
        try {
            if (!storageFill.isManagedStorage(b.block)) return;
            const item = storageConfig.findDrainItem(b);
            if (!item || !b.items) return;
            const stock = b.items.get(item);
            if (cap > 0 && stock < cap) return;
            const prio = storageConfig.getPriority(b);
            if (prio > bestPriority || (prio === bestPriority && stock > bestStock)) {
                bestPriority = prio;
                bestStock = stock;
                best = { x: b.x, y: b.y, b: b, item: item, expectsConsumer: false, kind: "drain-fetch" };
            }
        } catch (e) {}
    });
    return best;
}

// Loaded after our exports above to break the auto-pilot <-> storage-drain
// require cycle (auto-pilot already requires this module up top). We only
// touch autoPilot inside the runtime helpers below, so the late require
// is safe — by the time Trigger.update fires, auto-pilot has finished
// initialising.
const autoPilot = require("extended-ui/interact/auto-pilot");

// True when the autopilot is heading somewhere other than a drain trip.
// Suppresses opportunistic drain pickups while a higher-priority task
// is in progress.
function autopilotElsewhere() {
    if (!Core.settings.getBool("eui-auto-pilot", false)) return false;
    const target = autoPilot.getTarget();
    if (!target) return false;
    return target.kind !== "drain-fetch" && target.kind !== "core-dump";
}

Events.run(Trigger.update, () => {
    // Master switch: the bottom-bar auto-fill button gates every automation.
    // Drain has no per-feature switch (per-item flags configure it instead),
    // so we also gate on interact-core because drain only delivers to core.
    if (!Core.settings.getBool("eui-auto-fill", false)) {
        carrying = false;
        return;
    }
    if (!Core.settings.getBool("eui-interact-core", false)) {
        carrying = false;
        return;
    }
    if (!timer.canInteract()) return;
    const player = Vars.player;
    if (!player) return;
    const unit = player.unit();
    if (!unit) return;
    const stack = unit.stack;
    const team = player.team();

    if (stack.amount === 0) {
        carrying = false;
        if (autopilotElsewhere()) return;
        // If standing on / next to a drain storage, pull from it. The
        // storage must hold at least the drone's full inventory so we
        // don't shuttle 1 silicon every regen tick — otherwise drain at
        // priority 0 still preempts every other task whenever it scrapes
        // a single unit off a slow drain storage.
        const cap = (unit.type && unit.type.itemCapacity) || 0;
        let pickup = null;
        Vars.indexer.eachBlock(team, player.x, player.y, Vars.buildingRange, () => true, b => {
            if (pickup) return;
            try {
                if (!storageFill.isManagedStorage(b.block)) return;
                const item = storageConfig.findDrainItem(b);
                if (!item || !b.items) return;
                if (cap > 0 && b.items.get(item) < cap) return;
                pickup = { b: b, item: item };
            } catch (e) {}
        });
        if (pickup) {
            Call.requestItem(player, pickup.b, pickup.item, 999);
            carrying = true;
            timer.increase();
        }
        return;
    }

    // Carrying drained items: dump to the closest core when in range. We do
    // this here (bypassing auto-fill / auto-collect) because the storage
    // reservation guard there would otherwise refuse the drop for items that
    // some other storage still wants to fill.
    if (carrying) {
        const core = player.closestCore();
        if (core && player.within(core, Vars.buildingRange)) {
            Call.transferInventory(player, core);
            timer.increase();
        }
    }
});
