const timer = require("extended-ui/interact/interact-timer");
const coreLimits = require("extended-ui/interact/core-limits");
const storageFill = require("extended-ui/interact/storage-fill");
const consumerConfig = require("extended-ui/interact/consumer-config");
const turretAmmoConfig = require("extended-ui/interact/turret-ammo-config");
const autoPilot = require("extended-ui/interact/auto-pilot");
const logger = require("extended-ui/utils/logger").make("eui-af");
const teamBuildingsCache = require("extended-ui/utils/team-buildings-cache");
const turretFetchPending = require("extended-ui/utils/turret-fetch-pending");

const FETCH_PENDING_TTL_SECONDS = 2.0;

function dbg() { return logger.enabled(); }
function dlog(s) { logger.log(s); }
function bTag(b) { return logger.tag(b); }

// Suppresses the core-dump fallback while the autopilot is heading
// somewhere other than the core.
function autopilotHeadingNonCore() {
    if (!Core.settings.getBool("eui-auto-pilot", false)) return false;
    const target = autoPilot.getTarget();
    if (!target) return false;
    return target.kind !== "core-dump" && target.kind !== "core-fetch";
}

Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-auto-fill", false) || !timer.canInteract()) return;
    const player = Vars.player;
    if (player.unit() == null) return;
    const stack = player.unit().stack;
    const team = player.team();
    const core = player.closestCore();
    const isCoreAvailible = Core.settings.getBool("eui-interact-core", false) && core;

    let request = null;
    let requestPriority = -1;
    // FETCH path: request is an Item, requestBuilding is its turret.
    // Delivery path: request is the Building itself.
    let requestBuilding = null;
    let config = Core.settings.getJson("eui.autofill.priority", ObjectMap, () => new ObjectMap());

    const turretsOn = Core.settings.getBool("eui-auto-fill-turrets", true);

    Vars.indexer.eachBlock(team, player.x, player.y, Vars.buildingRange, () => true, b => {
        if (!timer.canInteract()) return;

        const block = b.tile.block();
        if (block instanceof ItemTurret && !turretsOn) return;
        if (!consumerConfig.isEnabled(block)) return;
        // Turrets accept ammo via ammoTypes, not consumers[].
        const isItemTurret = block instanceof ItemTurret;
        if (!isItemTurret && !block.consumers.find(c => c instanceof ConsumeItems || c instanceof ConsumeItemFilter || c instanceof ConsumeItemDynamic)) return;

        // If a request is in-flight for this building, skip unless we're
        // already carrying the item it asked for.
        const pendingEntry = turretFetchPending.get(b);
        if (pendingEntry && !(stack.amount > 0 && stack.item === pendingEntry.item)) {
            if (dbg()) dlog("range-iter " + bTag(b) + " skip: pending fetch of " + pendingEntry.item.name);
            return;
        }

        let blockPriority = config.get(block.name, 0);
        const custom = consumerConfig.getPriority(block);
        if (custom > 0) blockPriority = custom;

        // We want insert requests to have priority over deposit requests
        if (blockPriority < requestPriority) return;
        if (blockPriority == requestPriority && request instanceof Building) return;

        const wantsItem = stack.amount > 0 && stack.item != null;
        if (wantsItem) {
            // Turret with this specific ammo disabled — fall through to
            // the fetch path; it may still want a different ammo type.
            if (isItemTurret && !turretAmmoConfig.isEnabled(block, stack.item)) {
            } else {
                const target = consumerConfig.getTargetFill(b, stack.item);
                const stock = consumerConfig.getItemStock(b, stack.item);
                const accepted = b.acceptStack(stack.item, stack.amount, player.unit());
                if (stock < target && accepted > 0) {
                    if (dbg()) dlog("range-iter " + bTag(b) + " wants " + stack.item.name + " (stock=" + stock + " target=" + target + " accepted=" + accepted + ")");
                    request = b;
                    requestPriority = blockPriority;
                    return;
                }
            }
        }

        if (blockPriority <= requestPriority) return;

        let newRequest = null;
        if (!isCoreAvailible) return;
        if (block instanceof ItemTurret) {
            newRequest = getBestAmmo(b, core);
        } else if (block instanceof UnitFactory) {
            newRequest = getUnitFactoryRequest(b, block, core);
        } else if (b.items) {
            newRequest = getItemRequest(b, block, core);
        }
        if (newRequest) {
            if (dbg()) dlog("range-iter " + bTag(b) + " requests " + newRequest.name + " from core");
            request = newRequest;
            requestBuilding = b;
            requestPriority = blockPriority;
        }
    });

    if (request instanceof Building) {
        if (dbg()) dlog("transfer " + (stack.item ? stack.item.name : "?") + "x" + stack.amount + " -> " + bTag(request));
        Call.transferInventory(player, request);
        turretFetchPending.clear(request);
        timer.increase();
        return;
    }

    if (!isCoreAvailible || !player.within(core, Vars.buildingRange)) return;

    if (stack.amount) {
        // 5-unit floor matches the reservation floor in storage-fill.js.
        if (stack.amount >= 5 && storageFill.isItemReservedForStorage(stack.item, team)) {
            if (dbg()) dlog("dump-suppressed: storage reserves " + stack.item.name + " stack=" + stack.amount);
            return;
        }
        if (autopilotHeadingNonCore()) {
            if (dbg()) {
                const t = autoPilot.getTarget();
                dlog("dump-suppressed: autopilot heading " + (t && t.kind ? t.kind : "?") + " (" + (t && t.item ? t.item.name : "?") + ")");
            }
            return;
        }
        if (dbg()) {
            const t = autoPilot.getTarget();
            dlog("DUMP " + (stack.item ? stack.item.name : "?") + "x" + stack.amount
                + " to core (autopilot target=" + (t ? (t.kind || "?") : "null") + ")");
        }
        Call.transferInventory(player, core);
        if (stack.amount > 0) {
            Call.dropItem(0);
        }
        timer.increase();
    } else if (request) {
        const amount = computeFetchAmount(request, team, player);
        if (dbg()) dlog("FETCH " + request.name + " x" + amount + " from core");
        Call.requestItem(player, core, request, amount);
        if (requestBuilding) {
            turretFetchPending.markRequested(requestBuilding, request, FETCH_PENDING_TTL_SECONDS);
        }
        timer.increase();
    }
});

// Slider=0 % activates smart-batch fetch: sum need across stuck
// consumers/turrets up to drone cap, otherwise fall back to 999.
function computeFetchAmount(item, team, player) {
    const debugging = dbg();
    if (consumerConfig.getFillPct() !== 0 && consumerConfig.getTurretFillPct() !== 0) {
        if (debugging) dlog("computeFetchAmount(" + item.name + "): both sliders !=0 -> 999");
        return 999;
    }
    const unit = player.unit();
    if (!unit || !unit.type) return 999;
    const droneCap = unit.type.itemCapacity || 0;
    if (droneCap <= 0) return 999;

    const turretsOn = Core.settings.getBool("eui-auto-fill-turrets", true);
    let total = 0;
    const counts = { added: 0, stocked: 0, ammoOff: 0, noRoom: 0, wouldOverflow: 0 };

    const visit = b => {
        if (total >= droneCap) return;
        try {
            const block = b.block;
            if (!block || !consumerConfig.isEnabled(block)) return;
            const isItemTurret = block instanceof ItemTurret;
            if (isItemTurret && !turretsOn) return;
            let need = 0;
            if (!isItemTurret) {
                if (!block.consumers) return;
                if (!block.consumers.find(c =>
                    c instanceof ConsumeItems
                    || c instanceof ConsumeItemFilter
                    || c instanceof ConsumeItemDynamic)) return;
                const target = consumerConfig.getTargetFill(b, item);
                if (target <= 0) return;
                const stock = consumerConfig.getItemStock(b, item);
                if (stock >= target) { counts.stocked++; return; }
                need = consumerConfig.getSmartBatchAmount(b, item) - stock;
            } else {
                if (!b.ammo) return;
                if (!turretAmmoConfig.isEnabled(block, item)) { counts.ammoOff++; return; }
                const tTarget = consumerConfig.getTargetFill(b, item);
                if (tTarget <= 0) return;
                const tStock = consumerConfig.getItemStock(b, item);
                if (tStock >= tTarget) { counts.stocked++; return; }
                need = b.acceptStack(item, droneCap, unit);
                if (need <= 0) { counts.noRoom++; return; }
            }
            if (need <= 0) return;
            if (total + need <= droneCap) {
                total += need;
                counts.added++;
            } else {
                counts.wouldOverflow++;
            }
        } catch (e) {}
    };

    // With autopilot, sum across the whole team — the drone can reach
    // anywhere. Without it, stay in range.
    if (Core.settings.getBool("eui-auto-pilot", false)) {
        const builds = teamBuildingsCache.get(team);
        if (builds) builds.each(visit);
    } else {
        Vars.indexer.eachBlock(team, player.x, player.y, Vars.buildingRange, () => true, visit);
    }

    if (debugging) {
        dlog("computeFetchAmount(" + item.name + ") added=" + counts.added
            + " skipped(S=" + counts.stocked + ",A=" + counts.ammoOff
            + ",F=" + counts.noRoom + ",O=" + counts.wouldOverflow + ")"
            + " -> " + (total > 0 ? total + "/" + droneCap : "0 (fallback 999)"));
    }
    return total > 0 ? total : 999;
}

function getBestAmmo(turretBuild, core) {
    const turret = turretBuild.block;
    let best = null;
    let bestScore = -Infinity;
    const probeUnit = Vars.player.unit();
    turret.ammoTypes.each((item, ammo) => {
        if (!turretAmmoConfig.isEnabled(turret, item)) return;
        if (core.items.get(item) < coreLimits.getLimit(item)) return;
        // acceptStack lives on Building, not Block.
        if (turretBuild.acceptStack(item, 1, probeUnit) <= 0) return;
        const ggTarget = consumerConfig.getTargetFill(turretBuild, item);
        const ggStock = consumerConfig.getItemStock(turretBuild, item);
        if (ggStock >= ggTarget) return;
        const damage = ammo.damage + ammo.splashDamage;
        const priority = turretAmmoConfig.getPriority(turret, item);
        const score = priority * 100000 + damage;
        if (score > bestScore) {
            best = item;
            bestScore = score;
        }
    });
    return best;
}

function consumerWantsItem(build, item) {
    try {
        const target = consumerConfig.getTargetFill(build, item);
        const stock = consumerConfig.getItemStock(build, item);
        if (stock >= target) return false;
        return build.acceptStack(item, 1, Vars.player.unit()) > 0;
    } catch (e) { return false; }
}

function getUnitFactoryRequest(build, block, core) {
    if (build.currentPlan == -1) return null;
    const stacks = block.plans.get(build.currentPlan).requirements;
    return findRequiredItem(stacks, build, core);
}

function getItemRequest(build, block, core) {
    const consumesItems = block.consumers.find(c => c instanceof ConsumeItems || c instanceof ConsumeItemFilter || c instanceof ConsumeItemDynamic);
    if (!consumesItems) return null;

    if (consumesItems instanceof ConsumeItemFilter) {
        return getFilterRequest(consumesItems, build, core);
    } else if (consumesItems instanceof ConsumeItems) {
        return findRequiredItem(consumesItems.items, build, core);
    } else {
        return null;
    }
}

function getFilterRequest(filter, build, core) {
    let request = null;
    Vars.content.items().each(item => {
        if (request) return;
        if (!filter.filter.get(item)) return;
        if (item == Items.blastCompound) return;
        if (core.items.get(item) < coreLimits.getLimit(item)) return;
        if (!consumerWantsItem(build, item)) return;
        request = item;
    });
    return request;
}

function findRequiredItem(stacks, build, core) {
    for (let itemStack of stacks) {
        let item = itemStack.item;
        if (core.items.get(item) >= coreLimits.getLimit(item) && consumerWantsItem(build, item)) {
            return item;
        }
    }
    return null;
}
