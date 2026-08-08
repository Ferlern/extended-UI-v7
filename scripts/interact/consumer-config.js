const ENABLED_PREFIX = "eui-consumer-enabled-";
const PRIORITY_PREFIX = "eui-consumer-priority-";
const EXPANDED_PREFIX = "eui-consumer-cat-expanded-";
const LEGACY_TURRET_PRIORITY_PREFIX = "eui-turret-priority-";
const MAX_PRIORITY = 999;
const FILL_PCT_KEY = "eui-consumer-fill-pct";
const DEFAULT_FILL_PCT = 50;
const TURRET_FILL_PCT_KEY = "eui-turret-fill-pct";
const DEFAULT_TURRET_FILL_PCT = 50;

exports.MAX_PRIORITY = MAX_PRIORITY;
exports.DEFAULT_FILL_PCT = DEFAULT_FILL_PCT;
exports.DEFAULT_TURRET_FILL_PCT = DEFAULT_TURRET_FILL_PCT;
exports.CATEGORIES = ["turrets", "crafters", "unit-factories", "generators", "other"];

// Returns the configured fill threshold as a percentage of consumer
// capacity (0-100). The auto-pilot uses it to derive a per-block batch
// size: a 10-cap factory and a 100-cap one share one slider that scales
// to each, so the same setting works whether you have small or large
// consumers in the line.
exports.getFillPct = function() {
    const v = Core.settings.getInt(FILL_PCT_KEY, DEFAULT_FILL_PCT);
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
}

// Same shape as getFillPct, scoped to ItemTurrets. Turrets behave
// differently from crafters: they have no recipe, their ammo lives in
// b.ammo (not b.items), and the user explicitly asked for separate
// gating (the consumer-fill slider used to dictate turret loading too,
// which led to either turrets being neglected when factories preempted
// or the pyratite shuttle loop). With this slider the user can keep
// crafters lean (low %) while keeping turrets topped up (high %), or
// vice versa.
exports.getTurretFillPct = function() {
    const v = Core.settings.getInt(TURRET_FILL_PCT_KEY, DEFAULT_TURRET_FILL_PCT);
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
}

// Per-block batch size derived from the fill-pct slider.
// floor(cap * pct / 100), clamped to a minimum of 1 so blocks with tiny
// capacity (or unknown cap) still get a workable threshold.
//
// For ItemTurrets the relevant cap is ammo, not items: maxAmmo is in
// ammo-units and each item produces ammoMultiplier ammo-units, so the
// item-equivalent capacity is maxAmmo / ammoMultiplier. When the caller
// knows which item the drone is delivering we use the matching turret
// multiplier; otherwise we fall back to itemCapacity (which on most
// turrets is the default 10) so the threshold is at least workable.
exports.getMinAmountFor = function(block, item) {
    if (!block) return 1;
    let cap = 0;
    try {
        if (block instanceof ItemTurret && block.maxAmmo > 0 && block.ammoTypes) {
            if (item != null) {
                const ammoType = block.ammoTypes.get(item);
                if (ammoType && ammoType.ammoMultiplier > 0) {
                    cap = Math.floor(block.maxAmmo / ammoType.ammoMultiplier);
                }
            }
        }
    } catch (e) {}
    if (cap <= 0) cap = block.itemCapacity || 0;
    if (cap <= 0) return 1;
    return Math.max(1, Math.floor(cap * exports.getFillPct() / 100));
}

// Does this block actually consume the given item? Walks block.consumers
// and matches against ConsumeItems / ConsumeItemFilter precisely;
// ConsumeItemDynamic is build-state-dependent (UnitFactory.currentPlan)
// so without a Building reference we conservatively return true and
// let the caller's acceptStack be the actual gate.
function consumesSpecificItem(block, item) {
    if (!block || !item || !block.consumers) return false;
    try {
        for (let i = 0; i < block.consumers.length; i++) {
            const c = block.consumers[i];
            if (c instanceof ConsumeItems) {
                for (let j = 0; j < c.items.length; j++) {
                    if (c.items[j].item === item) return true;
                }
            } else if (c instanceof ConsumeItemFilter) {
                if (c.filter && c.filter.get(item)) return true;
            } else if (c instanceof ConsumeItemDynamic) {
                return true;
            }
        }
    } catch (e) {}
    return false;
}

// Per-item capacity. Returns 0 when the item isn't relevant to this
// block — silicon-smelter has itemCapacity=10 but doesn't consume
// silicon (silicon is its output), so getCapacityFor(smelter, silicon)
// must be 0; otherwise findBestConsumer reads the smelter's full
// silicon output buffer as "smelter wants silicon up to 10" and the
// log fills with `silicon-smelter skip(silicon): stock=10>=target=10`
// false rejections. ItemTurrets only have capacity for items in their
// ammoTypes; everything else returns 0 too.
exports.getCapacityFor = function(block, item) {
    if (!block) return 0;
    try {
        if (block instanceof ItemTurret) {
            if (item == null || !block.ammoTypes) return 0;
            const ammoType = block.ammoTypes.get(item);
            if (!ammoType) return 0; // turret really doesn't accept this item
            // Standard math: maxAmmo / ammoMultiplier = item-equivalent cap.
            try {
                if (block.maxAmmo > 0 && ammoType.ammoMultiplier > 0) {
                    const cap = Math.floor(block.maxAmmo / ammoType.ammoMultiplier);
                    if (cap > 0) return cap;
                }
            } catch (e) {}
            // Fallback when ammo-math returns 0 (modded turret / Rhino
            // reading maxAmmo or ammoMultiplier as 0).
            return block.itemCapacity || 0;
        }
    } catch (e) {}
    if (item != null && !consumesSpecificItem(block, item)) return 0;
    return block.itemCapacity || 0;
}

// Per-craft amount of `item` this build needs in stock to actually
// run. ConsumeItems lists fixed ItemStacks (e.g. silicon-smelter wants
// 1 coal + 1 sand per craft); UnitFactory's ConsumeItemDynamic resolves
// via the currently-selected plan's requirements (often much larger:
// a Mega plan needs 30 silicon). Filter consumers don't carry per-item
// amounts (predicate only) and fall through to 0. Returns 0 means
// "no fixed minimum — slider rules".
function recipeMinForBuild(b, item) {
    if (!b || !item) return 0;
    const block = b.block;
    if (!block || !block.consumers) return 0;
    try {
        for (let i = 0; i < block.consumers.length; i++) {
            const c = block.consumers[i];
            if (c instanceof ConsumeItems) {
                for (let j = 0; j < c.items.length; j++) {
                    if (c.items[j].item === item) return c.items[j].amount;
                }
            } else if (c instanceof ConsumeItemDynamic) {
                if (block instanceof UnitFactory && b.currentPlan != -1) {
                    const reqs = block.plans.get(b.currentPlan).requirements;
                    for (let k = 0; k < reqs.length; k++) {
                        if (reqs[k].item === item) return reqs[k].amount;
                    }
                }
            }
        }
    } catch (e) {}
    return 0;
}

// Stock level the drone is supposed to keep this consumer at. Two
// inputs combine:
//   1) slider target = floor(cap * fillPct / 100), the user's "top up
//      consumers to X% of capacity" knob.
//   2) recipe minimum = per-craft amount from ConsumeItems / current
//      UnitFactory plan. The drone must deliver at least this much or
//      the factory can't run a single cycle — ignoring this would
//      strand a multi-press at silicon=2/30 with fillPct=5% (slider
//      target=1) even though it needs 4 to consume.
// Final target = min(max(slider, recipe), cap). Capped at cap so a
// UnitFactory plan needing more than itemCapacity still terminates
// (we ask for as much as the block can hold). Returns 0 when the
// block has no per-item capacity (doesn't consume `item` at all);
// callers' `stock >= target` skip catches that cleanly.
exports.getTargetFill = function(b, item) {
    if (!b) return 0;
    const block = b.block;
    if (!block) return 0;
    // Turrets read their own slider (eui-turret-fill-pct) — separate
    // from the crafter fill slider so the user can tune ammo loading
    // independently of factory top-up behavior. Both sliders share
    // the same 0..100 % semantics; 0 % is the recipe-only / stock=0
    // smart-batch trigger.
    let pct = exports.getFillPct();
    try {
        if (block instanceof ItemTurret) pct = exports.getTurretFillPct();
    } catch (e) {}
    const recipe = recipeMinForBuild(b, item);
    // Slider=0 % is the visit trigger for smart-batch mode: drone
    // intervenes only when the consumer can't run another cycle
    // (stock < recipe). Anything at or above recipe is left alone —
    // either it's running on its own stock or being topped up by an
    // external feed (conveyor, another trip). For consumers without a
    // fixed recipe (filter / turret) we fall back to "stock=0" as the
    // trigger: returning 1 makes the existing `stock >= target` gate
    // fire iff stock>=1.
    //
    // The previous strict stock=0 rule deadlocked Reconstructors: their
    // per-cycle requirements are large (e.g. additive needs 40 silicon
    // + 40 graphite per upgrade), so a partially-loaded reconstructor
    // sits at silicon=20 / graphite=30 forever — neither input is
    // exactly 0, but the factory still can't craft.
    //
    // This branch deliberately runs *before* the cap check below — for
    // ItemTurrets in particular, getCapacityFor depends on
    // block.maxAmmo and ammoType.ammoMultiplier; if either reads back
    // as 0 from Rhino for any quirky turret/ammo combo, getCapacityFor
    // returns 0, target would land at 0, and findBestConsumer's
    // `stock >= target` test fires at `0 >= 0` and skips the turret.
    // Pass-1 still picks it (uses acceptStack directly), drone fetches
    // ammo, but no consumer-deliver candidate exists — only core-dump
    // does, and the dump loop the user reported kicks in. The
    // capacity is irrelevant for the trigger threshold; downstream
    // acceptStack handles the actual room check anyway.
    if (pct === 0) return recipe > 0 ? recipe : 1;
    const cap = exports.getCapacityFor(block, item);
    if (cap <= 0) return 0;
    const slider = Math.floor(cap * pct / 100);
    // Floor at 1 when the consumer genuinely accepts this item
    // (cap > 0). Without it, low slider % on small-cap consumers
    // collapses to 0 — e.g. swarmer + pyratite has cap=8, at slider=
    // 5 % the math gives floor(0.4)=0, target=0, and findBestConsumer
    // skips every swarmer at `stock=0 >= target=0`. Drone fetches
    // pyratite from core, can't deliver to any swarmer, dumps back,
    // loops. Treating target=0 as 'never visit' makes sense only when
    // cap=0 (consumer doesn't accept the item) — but that path is
    // already handled by the early return above. Inside the slider
    // branch the floor is always 1.
    let target = Math.max(1, slider, recipe);
    if (target > cap) target = cap;
    // Quantize up to a multiple of `recipe` so the buffer drains
    // exactly to 0 over N craft cycles. Round UP so the slider
    // biases toward a fuller buffer; if rounding up exceeds cap,
    // fall back to the largest multiple that still fits.
    if (recipe > 0) {
        target = Math.ceil(target / recipe) * recipe;
        if (target > cap) target = Math.floor(cap / recipe) * recipe;
    }
    return target;
}

// Size of one smart-batch delivery to a consumer at slider=0 %:
// largest multiple of recipe that fits in cap (so the buffer drains
// cleanly to 0 again). Filter / turret consumers without a fixed
// recipe fall back to cap. Drives the fetch-from-core size in
// auto-fill.computeFetchAmount.
exports.getSmartBatchAmount = function(b, item) {
    if (!b) return 0;
    const block = b.block;
    if (!block) return 0;
    const cap = exports.getCapacityFor(block, item);
    if (cap <= 0) return 0;
    const recipe = recipeMinForBuild(b, item);
    if (recipe > 0) return Math.floor(cap / recipe) * recipe;
    return cap;
}

exports.isEnabled = function(block) {
    return Core.settings.getBool(ENABLED_PREFIX + block.name, true);
}

exports.setEnabled = function(block, value) {
    Core.settings.put(ENABLED_PREFIX + block.name, !!value);
}

exports.getPriority = function(block) {
    try {
        let raw = Core.settings.getString(PRIORITY_PREFIX + block.name, "");
        if (!raw) {
            raw = Core.settings.getString(LEGACY_TURRET_PRIORITY_PREFIX + block.name, "");
        }
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
        Core.settings.remove(PRIORITY_PREFIX + block.name);
    } else {
        Core.settings.put(PRIORITY_PREFIX + block.name, v + "");
    }
}

exports.isCategoryExpanded = function(category) {
    return Core.settings.getBool(EXPANDED_PREFIX + category, false);
}

exports.setCategoryExpanded = function(category, value) {
    Core.settings.put(EXPANDED_PREFIX + category, !!value);
}

exports.categorize = function(block) {
    try { if (block instanceof ItemTurret) return "turrets"; } catch (e) {}
    try { if (block instanceof UnitFactory) return "unit-factories"; } catch (e) {}
    try { if (block instanceof GenericCrafter) return "crafters"; } catch (e) {}
    try {
        const PG = Packages.mindustry.world.blocks.power.PowerGenerator;
        if (block instanceof PG) return "generators";
    } catch (e) {}
    return "other";
}

// Item-equivalent stock of `item` currently held by `b`. For most
// blocks this is just b.items.get(item). For ItemTurret we derive
// stock from acceptStack: the per-item cap minus the room the turret
// reports it can still take is the items it currently holds. Reading
// b.ammo entries directly was unreliable — Mindustry's AmmoEntry
// .amount tracks shot accounting (decremented per fire, incremented
// per ammoMultiplier on receive), and matching entries by item via
// JS === can also miss when item references aren't reused by the
// runtime. acceptStack is what every other gate already uses to
// decide 'can the turret take more?', so deriving stock from the
// same primitive keeps all the math consistent.
exports.getItemStock = function(b, item) {
    if (!b || !item) return 0;
    try {
        if (b.block instanceof ItemTurret) {
            const cap = exports.getCapacityFor(b.block, item);
            if (cap <= 0) return 0;
            const probe = Vars.player ? Vars.player.unit() : null;
            const room = b.acceptStack(item, cap, probe);
            if (room == null || room < 0) return cap;
            if (room > cap) return 0;
            return cap - room;
        }
    } catch (e) {}
    if (!b.items) return 0;
    const v = b.items.get(item);
    return v == null ? 0 : v;
}

exports.consumesItems = function(block) {
    if (!block || !block.consumers) return false;
    try {
        return block.consumers.find(c =>
            c instanceof ConsumeItems || c instanceof ConsumeItemFilter || c instanceof ConsumeItemDynamic) != null;
    } catch (e) {
        return false;
    }
}
