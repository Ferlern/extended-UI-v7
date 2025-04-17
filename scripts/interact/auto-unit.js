const timer = require("extended-ui/interact/interact-timer");
const BreakException = {};

const tryTime = 300;

let prevSelectedUnitType = null;
let checkEndTime = 0;

Events.run(Trigger.update, () => {
    if (Vars.player.unit() == null) return;
    const selectedUnitType = Core.settings.getString("eui-auto-unit");

    if (selectedUnitType != prevSelectedUnitType) {
        prevSelectedUnitType = selectedUnitType;
        checkEndTime = Time.time + tryTime;
    }
    if (Time.time > checkEndTime) return;
    if (!isCheckNeeded(selectedUnitType)) return;

    try {
        Groups.unit.each((unit) => {
            if (unit.isAI() && !unit.dead && isEligible(unit, selectedUnitType)) {
                Call.unitControl(Vars.player, unit);
                timer.increase();
                checkEndTime = 0;
                throw BreakException;
            }
        });
    } catch (e) {
        if (e !== BreakException) throw e;
    }
});

Events.on(UnitCreateEvent, (event) => {
    if (Vars.player.unit() == null) return;
    const selectedUnitType = Core.settings.getString("eui-auto-unit");
    const unit = event.unit;

    if (!isCheckNeeded(selectedUnitType)) return;
    if (!isEligible(unit, selectedUnitType)) return;
    checkEndTime = Time.time + tryTime;
});

function isCheckNeeded(selectedUnitType) {
    const player = Vars.player;
    const currentType = player.unit().type;
    
    if (!currentType || !selectedUnitType || currentType.toString() == selectedUnitType) return false;
    return true;
}

function isEligible(unit, selectedUnitType) {
    const player = Vars.player;
    if (unit.team != player.team()) return false;
    if (unit.type.toString() != selectedUnitType) return false;
    return true;
}
