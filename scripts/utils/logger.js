// Shared debug logger. One toggle (eui-debug-autopilot by default)
// gates every prefixed logger.
function make(prefix, settingKey) {
    const key = settingKey || "eui-debug-autopilot";
    function enabled() {
        try { return Core.settings.getBool(key, false); } catch (e) { return false; }
    }
    function emit(s) { if (enabled()) try { log("[" + prefix + "] " + s); } catch (e) {} }
    function tag(b) {
        try { return b.block.name + "@" + b.tile.x + "," + b.tile.y; } catch (e) { return "?"; }
    }
    return { enabled: enabled, log: emit, tag: tag };
}

exports.make = make;
