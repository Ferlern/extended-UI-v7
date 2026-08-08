const timer = require("extended-ui/interact/interact-timer");
const collectConfig = require("extended-ui/interact/collect-config");
const storageFill = require("extended-ui/interact/storage-fill");
const autoPilot = require("extended-ui/interact/auto-pilot");
const consumerConfig = require("extended-ui/interact/consumer-config");

// Same gating as auto-fill: when autopilot is steering toward a non-core
// destination, don't intercept the stack with a core deposit just because
// the path momentarily crossed core range.
function autopilotHeadingNonCore() {
    if (!Core.settings.getBool("eui-auto-pilot", false)) return false;
    const target = autoPilot.getTarget();
    if (!target) return false;
    return target.kind !== "core-dump" && target.kind !== "core-fetch";
}

Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-auto-fill", false)) return;
    if (!timer.canInteract()) return;

    const factoryEnabled = Core.settings.getBool("eui-auto-collect-factory", false);
    const drillEnabled = Core.settings.getBool("eui-auto-collect-drill", false);
    if (!factoryEnabled && !drillEnabled) return;

    const player = Vars.player;
    if (player.unit() == null) return;
    const unit = player.unit();
    const stack = unit.stack;
    const team = player.team();
    const core = player.closestCore();

    const capacity = unit.type ? unit.type.itemCapacity : 0;

    if (stack.amount > 0) {
        // Top up: drone has the item already and isn't full -- if any
        // configured same-item producer is in range, take more from it
        // instead of flying off to deliver a tiny stack.
        if (stack.item && stack.amount < capacity) {
            const topUp = findTopUpTarget(team, player, unit, stack.item, factoryEnabled, drillEnabled);
            if (topUp) {
                Call.requestItem(player, topUp, stack.item, 999);
                timer.increase();
                return;
            }
        }
        // Reservation only blocks core-dump when the drone is actually carrying
        // enough for storage-fill / auto-fill to pick up (their minimum is 5).
        // Otherwise the drone deadlocks: too few items to deliver anywhere, but
        // forbidden from dumping back to core.
        if (stack.amount >= 5 && storageFill.isItemReservedForStorage(stack.item, team)) return;
        if (autopilotHeadingNonCore()) return;
        if (core && player.within(core, Vars.buildingRange)) {
            if (!Core.settings.getBool("eui-interact-core", false)) return;
            Call.transferInventory(player, core);
            timer.increase();
        }
        return;
    }

    let target = null;
    let targetItem = null;

    Vars.indexer.eachBlock(team, player.x, player.y, Vars.buildingRange, () => true, b => {
        if (target) return;
        const block = b.tile.block();

        if (factoryEnabled && block instanceof GenericCrafter && collectConfig.isFactoryEnabled(block)) {
            const out = block.outputItems;
            if (out && b.items) {
                for (let i = 0; i < out.length; i++) {
                    const it = out[i].item;
                    if (b.items.get(it) >= collectConfig.getPickupThreshold(block, it)) {
                        target = b;
                        targetItem = it;
                        return;
                    }
                }
            }
        }

        if (!target && drillEnabled && block instanceof Drill) {
            const dom = b.dominantItem;
            if (dom != null && b.items && collectConfig.isDrillItemEnabled(dom)
                && b.items.get(dom) >= collectConfig.getPickupThreshold(block, dom)) {
                target = b;
                targetItem = dom;
            }
        }
    });

    if (!target || !targetItem) return;

    Call.requestItem(player, target, targetItem, 999);
    timer.increase();
});

function findTopUpTarget(team, player, unit, item, factoryEnabled, drillEnabled) {
    // Top-up only pulls from producers whose current stock is at or above
    // the user-configured pickup threshold (collect % slider). Otherwise
    // a drone carrying a partial stack would trickle-pull 1 unit at a
    // time from any source that just dripped a single item, ignoring
    // fully-stocked producers nearby.
    let target = null;
    Vars.indexer.eachBlock(team, player.x, player.y, Vars.buildingRange, () => true, b => {
        if (target) return;
        const block = b.tile.block();
        if (factoryEnabled && block instanceof GenericCrafter && collectConfig.isFactoryEnabled(block)
            && block.outputItems && b.items) {
            for (let i = 0; i < block.outputItems.length; i++) {
                if (block.outputItems[i].item !== item) continue;
                if (b.items.get(item) >= collectConfig.getPickupThreshold(block, item)) {
                    target = b;
                    return;
                }
            }
        }
        if (!target && drillEnabled && block instanceof Drill && b.items
            && b.dominantItem === item
            && collectConfig.isDrillItemEnabled(item)
            && b.items.get(item) >= collectConfig.getPickupThreshold(block, item)) {
            target = b;
        }
    });
    return target;
}
