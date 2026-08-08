const DEFAULT_STEERING_COOLDOWN_SEC = 2;

let lastSteeringTime = -1e9;

function steeringCooldownTicks() {
    const sec = Core.settings.getInt("eui-steering-cooldown-sec", DEFAULT_STEERING_COOLDOWN_SEC);
    return (sec >= 0 ? sec : DEFAULT_STEERING_COOLDOWN_SEC) * 60;
}

Events.run(Trigger.update, () => {
    // Both Binding.select (clicking on the world) and active movement
    // suspend the auto-pilot's steering for the configured cooldown so
    // the player gets uninterrupted manual control. Inventory transfers
    // are NOT gated here — the player has the auto-fill toggle for that.
    if (isSelectActive() || isSteeringActive()) {
        lastSteeringTime = Time.time;
    }
});

function isSelectActive() {
    try {
        if (Core.input.keyDown(Binding.select)) return true;
    } catch (e) {}
    return false;
}

function isSteeringActive() {
    // [primary] InputHandler's computed movement intent vector. Populated
    // by DesktopInput from Binding.move_x/y axes (regardless of remapping),
    // by mouse-follow mode, and by gamepad sticks.
    try {
        const ih = Vars.control ? Vars.control.input : null;
        if (ih && ih.movement && (Math.abs(ih.movement.x) > 0.1 || Math.abs(ih.movement.y) > 0.1)) return true;
    } catch (e) {}

    // [mobile] On phones / tablets: tap-to-move via MobileInput.
    try {
        if (Vars.mobile) {
            const unit = Vars.player.unit();
            if (unit) {
                if (unit.isFlying && typeof unit.moving === "function" && unit.moving()) return true;
                if (typeof unit.isShooting === "function" && unit.isShooting()) return true;
            }
            const ih = Vars.control ? Vars.control.input : null;
            if (ih && ih.lineMode) return true;
            if (ih && ih.selectedUnit) return true;
        }
    } catch (e) {}

    // [desktop fallback] Default WASD / arrow keys via physical scancodes.
    try {
        if (Core.input.keyDown(KeyCode.w)) return true;
        if (Core.input.keyDown(KeyCode.a)) return true;
        if (Core.input.keyDown(KeyCode.s)) return true;
        if (Core.input.keyDown(KeyCode.d)) return true;
        if (Core.input.keyDown(KeyCode.up)) return true;
        if (Core.input.keyDown(KeyCode.down)) return true;
        if (Core.input.keyDown(KeyCode.left)) return true;
        if (Core.input.keyDown(KeyCode.right)) return true;
    } catch (e) {}

    // [remap fallback] Binding axes for users who remapped to other keys.
    try {
        if (Math.abs(Core.input.axis(Binding.move_x)) > 0.1) return true;
        if (Math.abs(Core.input.axis(Binding.move_y)) > 0.1) return true;
    } catch (e) {}

    // [mouse-follow fallback] Cursor distance from unit when "mousemove"
    // mode is on.
    try {
        if (Core.settings.getBool("mousemove", false) || Core.settings.getBool("mouseMove", false)) {
            const unit = Vars.player.unit();
            if (unit) {
                const m = Core.input.mouseWorld();
                const dx = m.x - unit.x;
                const dy = m.y - unit.y;
                if (dx * dx + dy * dy > Vars.tilesize * Vars.tilesize * 9) return true;
            }
        }
    } catch (e) {}

    // [bindings] Mine / boost via remapped Binding.
    try {
        if (Core.input.keyDown(Binding.mine)) return true;
    } catch (e) {}
    try {
        if (Core.input.keyDown(Binding.boost)) return true;
    } catch (e) {}

    // [state] Unit is actively mining a tile.
    try {
        const unit = Vars.player ? Vars.player.unit() : null;
        if (unit && unit.mining && unit.mining()) return true;
    } catch (e) {}
    return false;
}

// True while/just-after the player did anything that would steer the
// unit (movement keys / mouse-follow / mining / Binding.select click).
// Pauses auto-pilot for the configured cooldown after release so the
// player gets a clear stretch of manual control. Inventory transfers
// are intentionally NOT gated by this — the auto-fill toggle button
// is the only manual override for those.
exports.isPlayerSteering = function() {
    return Time.time - lastSteeringTime < steeringCooldownTicks();
}
