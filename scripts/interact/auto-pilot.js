const collectConfig = require("extended-ui/interact/collect-config");
const storageConfig = require("extended-ui/interact/storage-config");
const storageFill = require("extended-ui/interact/storage-fill");
const storageDrain = require("extended-ui/interact/storage-drain");
const coreLimits = require("extended-ui/interact/core-limits");
const playerBusy = require("extended-ui/interact/player-busy");
const taskPriority = require("extended-ui/interact/task-priority");
const consumerConfig = require("extended-ui/interact/consumer-config");
const turretAmmoConfig = require("extended-ui/interact/turret-ammo-config");
const logger = require("extended-ui/utils/logger").make("eui-ap");
const teamBuildingsCache = require("extended-ui/utils/team-buildings-cache");

const RESCAN_TICKS = 30;
const ARRIVE_PADDING = Vars.tilesize * 2;

let cached = null;
let scanTick = RESCAN_TICKS;

function dbg() { return logger.enabled(); }
function dlog(s) { logger.log(s); }
function blockTag(b) { return logger.tag(b); }

exports.getTarget = function() { return cached; };

Events.run(Trigger.update, () => {
    // Master switch: bottom-bar auto-fill button gates every automation.
    if (!Core.settings.getBool("eui-auto-fill", false)
        || !Core.settings.getBool("eui-auto-pilot", false)) {
        cached = null;
        return;
    }

    const player = Vars.player;
    if (player.unit() == null) return;
    const unit = player.unit();
    if (unit.dead) return;

    if (playerBusy.isPlayerSteering()) {
        cached = null;
        return;
    }

    // Null result is also cached for RESCAN_TICKS — without this the
    // !cached branch ran builds.each on every render frame.
    scanTick++;
    if (scanTick >= RESCAN_TICKS || (cached && isStale(cached, unit))) {
        scanTick = 0;
        cached = pickTarget(unit, player.team());
    }
    if (!cached) return;

    const dx = cached.x - unit.x;
    const dy = cached.y - unit.y;
    const dist2 = dx * dx + dy * dy;
    const inRange = Vars.buildingRange - ARRIVE_PADDING;
    if (dist2 <= inRange * inRange) return;

    const dist = Math.sqrt(dist2);
    const speed = unit.type.speed > 0 ? unit.type.speed : 1;
    const v = Tmp.v1.set(dx / dist, dy / dist).scl(speed);
    unit.moveAt(v);
});

function isStale(target, unit) {
    if (!target.b || target.b.dead || target.b.tile == null || target.b.tile.build !== target.b) return true;
    const stack = unit.stack;
    // Core trips self-stale on completion so pickTarget can flip the
    // drone to the next task in the same scan.
    if (target.kind === "core-fetch") return stack.amount > 0;
    if (target.kind === "core-dump") return stack.amount === 0;
    if (target.kind === "producer-topup") {
        if (stack.amount === 0 || stack.item !== target.item) return true;
        const cap = unit.type ? unit.type.itemCapacity : 0;
        if (cap > 0 && stack.amount >= cap) return true;
        if (target.b.block instanceof Drill && target.b.dominantItem !== target.item) return true;
        if (!target.b.items) return true;
        const pickupThr = collectConfig.getPickupThreshold(target.b.block, target.item);
        return target.b.items.get(target.item) < pickupThr;
    }
    if (stack.amount > 0 && stack.item) {
        if (!target.expectsConsumer) return true;
        if (target.item !== stack.item) return true;
        try {
            if (target.b.block instanceof ItemTurret
                && !turretAmmoConfig.isEnabled(target.b.block, stack.item)) return true;
        } catch (e) {}
        const tgt = consumerConfig.getTargetFill(target.b, stack.item);
        const stk = consumerConfig.getItemStock(target.b, stack.item);
        if (stk >= tgt) return true;
        return target.b.acceptStack(stack.item, 1, unit) <= 0;
    }
    if (target.expectsConsumer) return true;
    return !target.b.items || target.b.items.get(target.item) <= 0;
}

function pickTarget(unit, team) {
    const stack = unit.stack;
    const storageOn = Core.settings.getBool("eui-storage-fill", false);
    const fillOn = Core.settings.getBool("eui-auto-fill", false);
    const factoryOn = Core.settings.getBool("eui-auto-collect-factory", false);
    const drillOn = Core.settings.getBool("eui-auto-collect-drill", false);
    // Bottom-bar interact-core button gates every core trip.
    const coreOn = Core.settings.getBool("eui-interact-core", false);
    const debugging = dbg();
    const stackTag = stack.amount > 0 && stack.item
        ? stack.item.name + "x" + stack.amount
        : "empty";

    // Drain pickup overrides every other task — go straight to core.
    if (stack.amount > 0 && stack.item && storageDrain.isCarrying() && coreOn) {
        const core = Vars.player.closestCore();
        if (core) {
            if (debugging) dlog("pickTarget(" + stackTag + "): drain-carry override -> core-dump");
            return { x: core.x, y: core.y, b: core, item: stack.item, expectsConsumer: false, kind: "core-dump" };
        }
    }

    const candidates = [];

    if (stack.amount > 0 && stack.item) {
        const capacity = unit.type ? unit.type.itemCapacity : 0;
        const isFull = capacity > 0 && stack.amount >= capacity;

        if (!isFull && (factoryOn || drillOn)) {
            const p = findBestProducer(unit, team, factoryOn, drillOn, stack.item);
            if (p) {
                p.kind = "producer-topup";
                candidates.push({ task: "producer-topup", target: p });
            } else if (debugging) {
                dlog("pickTarget(" + stackTag + "): producer-topup -> none");
            }
        }
        if (fillOn) {
            const c = findBestConsumer(unit, stack.item, team);
            if (c) {
                c.kind = "consumer-deliver";
                candidates.push({ task: "consumer-deliver", target: c });
            } else if (debugging) {
                dlog("pickTarget(" + stackTag + "): consumer-deliver -> none");
            }
        }
        if (storageOn) {
            const s = findBestStorageNeed(unit, stack.item, team);
            if (s) {
                s.kind = "storage-deliver";
                candidates.push({ task: "storage-deliver", target: s });
            } else if (debugging) {
                dlog("pickTarget(" + stackTag + "): storage-deliver -> none");
            }
        }
        if (coreOn) {
            const dumpCore = Vars.player.closestCore();
            if (dumpCore) {
                candidates.push({
                    task: "core-dump",
                    target: { x: dumpCore.x, y: dumpCore.y, b: dumpCore, item: stack.item, expectsConsumer: false, kind: "core-dump" }
                });
            }
        }
    } else {
        if (storageOn && coreOn) {
            const fetch = findCoreFetchForStorage(unit, team);
            if (fetch) candidates.push({ task: "storage-fetch", target: fetch });
        }
        if (coreOn) {
            const drain = storageDrain.findDrainSource(team);
            if (drain) candidates.push({ task: "storage-drain-fetch", target: drain });
        }
        if (fillOn && coreOn) {
            const consumerFetch = findCoreFetchForConsumer(unit, team);
            if (consumerFetch) candidates.push({ task: "consumer-core-fetch", target: consumerFetch });
            else if (debugging) dlog("pickTarget(empty): consumer-core-fetch -> none");
        }
        if (factoryOn || drillOn) {
            const p = findBestProducer(unit, team, factoryOn, drillOn, null);
            if (p) {
                p.kind = "producer-collect";
                candidates.push({ task: "producer-collect", target: p });
            }
        }
    }

    const winner = taskPriority.pickHighest(candidates);
    if (debugging) {
        const list = candidates.map(c => {
            const item = c.target && c.target.item ? c.target.item.name : "?";
            return c.task + "[" + taskPriority.get(c.task) + "," + item + "]";
        }).join(", ");
        const winName = winner ? (winner.kind || "?") + (winner.item ? "(" + winner.item.name + ")" : "") : "null";
        dlog("pickTarget(" + stackTag + "): cands=[" + list + "] -> " + winName);
    }
    return winner;
}

function teamBuildings(team) {
    return teamBuildingsCache.get(team);
}

function findBestStorageNeed(unit, item, team) {
    const builds = teamBuildings(team);
    if (!builds) return null;
    let bestB = null;
    let bestPriority = -1;
    let bestDeficit = 0;
    const cap = (unit.type && unit.type.itemCapacity) || 0;
    builds.each(b => {
        try {
            if (!storageFill.isManagedStorage(b.block)) return;
            const threshold = storageConfig.getThreshold(b, item);
            if (threshold <= 0) return;
            if (!b.items) return;
            const stock = b.items.get(item);
            if (stock >= threshold) return;
            const deficit = threshold - stock;
            if (cap > 0 && deficit < cap) return;
            if (b.acceptStack(item, 5, unit) < 5) return;
            // Priority dominates, deficit breaks ties.
            const prio = storageConfig.getPriority(b);
            if (prio > bestPriority || (prio === bestPriority && deficit > bestDeficit)) {
                bestPriority = prio;
                bestDeficit = deficit;
                bestB = b;
            }
        } catch (e) {}
    });
    if (!bestB) return null;
    return { x: bestB.x, y: bestB.y, b: bestB, item: item, expectsConsumer: true };
}

function findCoreFetchForStorage(unit, team) {
    const core = Vars.player.closestCore();
    if (!core) return null;
    const builds = teamBuildings(team);
    if (!builds) return null;
    const cap = (unit.type && unit.type.itemCapacity) || 0;
    let chosenItem = null;
    let chosenPriority = -1;
    builds.each(b => {
        try {
            if (!storageFill.isManagedStorage(b.block)) return;
            const item = storageConfig.findNeededItem(b, it =>
                core.items.get(it) >= coreLimits.getLimit(it), cap);
            if (!item) return;
            const prio = storageConfig.getPriority(b);
            if (prio > chosenPriority) {
                chosenPriority = prio;
                chosenItem = item;
            }
        } catch (e) {}
    });
    if (!chosenItem) return null;
    return { x: core.x, y: core.y, b: core, item: chosenItem, expectsConsumer: false, kind: "core-fetch" };
}

function findCoreFetchForConsumer(unit, team) {
    const core = Vars.player.closestCore();
    if (!core || !core.items) return null;
    const builds = teamBuildings(team);
    if (!builds) return null;
    const turretsOn = Core.settings.getBool("eui-auto-fill-turrets", true);
    const probeUnit = Vars.player.unit();

    let chosenItem = null;

    // Pass 1: turrets first, gated on acceptStack>0 (any room) rather
    // than the recipe-aware stock<recipe used for non-turrets below.
    const debugging = dbg();
    let chosenBuild = null;
    const pass1 = { turrets: 0, disabled: 0, coreLow: 0, noRoom: 0, stocked: 0 };
    let pass1Reason = null;

    function ammoScore(block, item, ammo) {
        const damage = ammo.damage + ammo.splashDamage;
        const priority = turretAmmoConfig.getPriority(block, item);
        return priority * 100000 + damage;
    }

    if (turretsOn) {
        let bestScore = -Infinity;
        builds.each(b => {
            try {
                const block = b.block;
                if (!(block instanceof ItemTurret)) return;
                if (!consumerConfig.isEnabled(block)) return;
                if (!block.ammoTypes) return;
                pass1.turrets++;
                let pick = null;
                let pickReason = null;
                let pickScore = -Infinity;
                block.ammoTypes.each((item, ammo) => {
                    if (!turretAmmoConfig.isEnabled(block, item)) { pass1.disabled++; return; }
                    if (core.items.get(item) < coreLimits.getLimit(item)) { pass1.coreLow++; return; }
                    if (b.acceptStack(item, 1, probeUnit) <= 0) { pass1.noRoom++; return; }
                    // getItemStock reads b.ammo for turrets — items[] is
                    // always 0 there.
                    const target = consumerConfig.getTargetFill(b, item);
                    const stock = consumerConfig.getItemStock(b, item);
                    if (stock >= target) { pass1.stocked++; return; }
                    const score = ammoScore(block, item, ammo);
                    if (score > pickScore) {
                        pick = item;
                        pickScore = score;
                        pickReason = "score=" + score + " stock=" + stock + "/" + target;
                    }
                });
                if (pick && pickScore > bestScore) {
                    chosenItem = pick;
                    chosenBuild = b;
                    bestScore = pickScore;
                    pass1Reason = pickReason;
                }
            } catch (e) {}
        });
        if (debugging) {
            dlog("pass1 turrets=" + pass1.turrets
                + " skipped(D=" + pass1.disabled + ",L=" + pass1.coreLow
                + ",F=" + pass1.noRoom + ",S=" + pass1.stocked + ")"
                + " -> " + (chosenItem
                    ? chosenItem.name + " for " + blockTag(chosenBuild) + " (" + pass1Reason + ")"
                    : "no pick"));
        }
        if (chosenItem) {
            return { x: core.x, y: core.y, b: core, item: chosenItem, expectsConsumer: false, kind: "core-fetch" };
        }
    }

    // Pass 2: non-turret consumers (crafters, generators, unit factories).
    const pass2 = { consumers: 0 };
    builds.each(b => {
        if (chosenItem) return;
        try {
            const block = b.block;
            if (!block || block instanceof ItemTurret) return;
            if (!consumerConfig.isEnabled(block)) return;
            if (!block.consumers) return;
            const ci = block.consumers.find(c =>
                c instanceof ConsumeItems || c instanceof ConsumeItemFilter || c instanceof ConsumeItemDynamic);
            if (!ci) return;
            pass2.consumers++;

            const stockOf = (item) => consumerConfig.getItemStock(b, item);
            const wants = (item) => {
                const target = consumerConfig.getTargetFill(b, item);
                if (stockOf(item) >= target) return false;
                return b.acceptStack(item, 1, probeUnit) > 0;
            };

            if (ci instanceof ConsumeItems) {
                for (let i = 0; i < ci.items.length; i++) {
                    const item = ci.items[i].item;
                    if (core.items.get(item) < coreLimits.getLimit(item)) continue;
                    if (!wants(item)) continue;
                    chosenItem = item;
                    return;
                }
            } else if (ci instanceof ConsumeItemFilter) {
                Vars.content.items().each(item => {
                    if (chosenItem) return;
                    if (!ci.filter.get(item)) return;
                    try { if (item == Items.blastCompound) return; } catch (e) {}
                    if (core.items.get(item) < coreLimits.getLimit(item)) return;
                    if (!wants(item)) return;
                    chosenItem = item;
                });
            } else {
                // ConsumeItemDynamic — UnitFactory currentPlan.
                if (block instanceof UnitFactory && b.currentPlan != -1) {
                    const reqs = block.plans.get(b.currentPlan).requirements;
                    for (let i = 0; i < reqs.length; i++) {
                        const item = reqs[i].item;
                        if (core.items.get(item) < coreLimits.getLimit(item)) continue;
                        if (!wants(item)) continue;
                        chosenItem = item;
                        return;
                    }
                }
            }
        } catch (e) {}
    });

    if (debugging) {
        dlog("pass2 consumers=" + pass2.consumers + " -> " + (chosenItem ? chosenItem.name : "no pick"));
    }
    if (!chosenItem) return null;
    return { x: core.x, y: core.y, b: core, item: chosenItem, expectsConsumer: false, kind: "core-fetch" };
}

function findBestConsumer(unit, item, team) {
    const builds = teamBuildings(team);
    if (!builds) return null;
    let bestB = null;
    let bestStock = Infinity;
    const debugging = dbg();
    const counts = { cands: 0, ammoOff: 0, stocked: 0, noRoom: 0 };

    builds.each(b => {
        try {
            const block = b.block;
            if (!block) return;
            const isItemTurret = block instanceof ItemTurret;
            if (!isItemTurret) {
                if (!block.consumers) return;
                const wantsItem = block.consumers.find(c =>
                    c instanceof ConsumeItems || c instanceof ConsumeItemFilter || c instanceof ConsumeItemDynamic);
                if (!wantsItem) return;
            }
            if (!consumerConfig.isEnabled(block)) return;
            // Per-ammo whitelist overrides the block-level isEnabled.
            if (isItemTurret && !turretAmmoConfig.isEnabled(block, item)) { counts.ammoOff++; return; }

            const target = consumerConfig.getTargetFill(b, item);
            const stock = consumerConfig.getItemStock(b, item);
            if (stock >= target) { counts.stocked++; return; }
            if (b.acceptStack(item, 1, unit) <= 0) { counts.noRoom++; return; }

            counts.cands++;
            if (stock < bestStock) {
                bestStock = stock;
                bestB = b;
            }
        } catch (e) {}
    });

    if (debugging) {
        dlog("findBestConsumer(" + item.name + ") cands=" + counts.cands
            + " skipped(A=" + counts.ammoOff + ",S=" + counts.stocked + ",F=" + counts.noRoom + ")"
            + " -> " + (bestB ? blockTag(bestB) + " stock=" + bestStock : "none"));
    }
    if (!bestB) return null;
    return { x: bestB.x, y: bestB.y, b: bestB, item: item, expectsConsumer: true };
}

function findBestProducer(unit, team, factoryOn, drillOn, requireItem) {
    const builds = teamBuildings(team);
    if (!builds) return null;
    let bestB = null;
    let bestItem = null;
    let bestScore = -1;
    const topUp = requireItem != null;

    builds.each(b => {
        try {
            const block = b.block;
            if (!block) return;

            // pickup-threshold is per-item: GenericCrafter caps each
            // output below itemCapacity (cap - craftAmount).
            if (factoryOn && block instanceof GenericCrafter
                && block.outputItems != null
                && collectConfig.isFactoryEnabled(block)) {
                if (!b.items) return;
                for (let i = 0; i < block.outputItems.length; i++) {
                    const it = block.outputItems[i].item;
                    if (requireItem && it !== requireItem) continue;
                    const stock = b.items.get(it);
                    const pickupThr = collectConfig.getPickupThreshold(block, it);
                    if (stock >= pickupThr && stock > bestScore) {
                        bestScore = stock;
                        bestB = b;
                        bestItem = it;
                    }
                }
                return;
            }

            if (drillOn && block instanceof Drill && b.items) {
                const dom = b.dominantItem;
                if (dom == null) return;
                if (requireItem && dom !== requireItem) return;
                if (!collectConfig.isDrillItemEnabled(dom)) return;
                const stock = b.items.get(dom);
                const pickupThr = collectConfig.getPickupThreshold(block, dom);
                if (stock >= pickupThr && stock > bestScore) {
                    bestScore = stock;
                    bestB = b;
                    bestItem = dom;
                }
            }
        } catch (e) {}
    });

    if (!bestB || !bestItem) return null;
    return { x: bestB.x, y: bestB.y, b: bestB, item: bestItem, expectsConsumer: false };
}
