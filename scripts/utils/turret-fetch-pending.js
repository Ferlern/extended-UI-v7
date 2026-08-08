// Per-turret pending-fetch cache. Call.requestItem is asynchronous, so
// without throttling auto-fill re-issues the same request every tick
// when eui-action-delay=0 and the drone never catches up. Cleared on
// successful delivery, BlockDestroyEvent, WorldLoadEvent, or TTL.

const pending = new ObjectMap();

function markRequested(building, item, ttlSeconds) {
    if (!building || !item) return;
    pending.put(building, { item: item, expireAt: Time.time + Time.toSeconds * ttlSeconds });
}

function get(building) {
    if (!building) return null;
    const entry = pending.get(building);
    if (!entry) return null;
    if (Time.time >= entry.expireAt) {
        pending.remove(building);
        return null;
    }
    return entry;
}

function clear(building) {
    if (!building) return;
    pending.remove(building);
}

function safeOn(evt, fn) {
    try { if (evt) Events.on(evt, fn); } catch (e) { try { log("eui turret-fetch-pending: " + e); } catch (ee) {} }
}
safeOn(EventType.BlockDestroyEvent, e => {
    try { if (e && e.tile && e.tile.build) clear(e.tile.build); } catch (err) {}
});
safeOn(EventType.WorldLoadEvent, () => {
    try { pending.clear(); } catch (e) {}
});

exports.markRequested = markRequested;
exports.get = get;
exports.clear = clear;
