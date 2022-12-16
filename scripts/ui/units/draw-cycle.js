const bars = require("extended-ui/ui/units/health-shield-bar");
const playerTracker = require("extended-ui/ui/units/player-tracker");
const logicTracker = require("extended-ui/ui/units/logic-tracker");

const force = false;

let showUnitBar;
let trackPlayerCursor;
let trackLogicControl;

Events.run(Trigger.draw, () => {
    showUnitBar = Core.settings.getBool("eui-showUnitBar", true);
    trackPlayerCursor = Core.settings.getBool("eui-TrackPlayerCursor", false);
    trackLogicControl = Core.settings.getBool("eui-TrackLogicControl", false);

    if (!showUnitBar && !trackLogicControl && !trackPlayerCursor) return;

    Groups.unit.each((unit) => {
        if (Core.settings.getBool("eui-showUnitBar", true)) {
            if (bars.drawUnitHealthBar(unit, force)) {
                bars.drawUnitShieldBar(unit, true, force);
            } else {
                bars.drawUnitShieldBar(unit, false, force);
            }
        }
        if (Core.settings.getBool("eui-TrackPlayerCursor", false)) {
            let player = unit.player;
            if (player) {
                playerTracker.drawCursor(player);
            }
        }
        if (Core.settings.getBool("eui-TrackLogicControl", false)) {
            if (unit.controller() instanceof LogicAI) {
                logicTracker.drawLogicLine(unit);
            }
        }
    });
});
