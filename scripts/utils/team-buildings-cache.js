// Per-team snapshot of team.data().buildings, invalidated on
// build/destroy/world-load. API mirrors Seq.each(fn) so call sites
// stay unchanged.

const versions = {};
const cache = {};

function teamKey(team) {
    if (!team) return null;
    return team.id != null ? team.id : team.name;
}

function bumpForTeam(team) {
    const key = teamKey(team);
    if (key == null) return;
    versions[key] = (versions[key] || 0) + 1;
}

function bumpFromTile(tile) {
    if (!tile) return;
    try { bumpForTeam(tile.team()); } catch (e) {}
}

// Bare BlockBuildEndEvent isn't a global in every Mindustry build —
// go through EventType. Wrapped so a missing class on a different
// version can't take the module down.
function safeOn(evt, fn) {
    try { if (evt) Events.on(evt, fn); } catch (e) { try { log("eui team-buildings-cache: " + e); } catch (ee) {} }
}
function clearObj(o) {
    // Two `for (const k in obj)` in one scope is a Rhino parse error
    // here, hence Object.keys.
    Object.keys(o).forEach(k => delete o[k]);
}
safeOn(EventType.BlockBuildEndEvent, e => { if (e) bumpFromTile(e.tile); });
safeOn(EventType.BlockDestroyEvent, e => { if (e) bumpFromTile(e.tile); });
safeOn(EventType.WorldLoadEvent, () => {
    clearObj(versions);
    clearObj(cache);
});

function snapshot(team) {
    const key = teamKey(team);
    if (key == null) return null;
    const ver = versions[key] || 0;
    const entry = cache[key];
    if (entry && entry.version === ver) return entry;

    const data = team.data();
    if (!data || !data.buildings) return null;
    const arr = [];
    data.buildings.each(b => { if (b) arr.push(b); });
    const fresh = {
        version: ver,
        all: arr,
        each: function(fn) {
            const a = this.all;
            for (let i = 0; i < a.length; i++) fn(a[i]);
        }
    };
    cache[key] = fresh;
    return fresh;
}

exports.get = function(team) { return snapshot(team); };
exports.invalidate = function(team) { bumpForTeam(team); };
