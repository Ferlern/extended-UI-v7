const Alerts = require("extended-ui/ui/alerts/alert");
const output = require("extended-ui/utils/output-wrapper");
const unitsCounter = require("extended-ui/units/units-counter");
const relativeValue = require("extended-ui/utils/relative-value");
const drawTasks = require("extended-ui/utils/draw/draw-tasks");

const sendCooldown = 60 * 60 // 1 min;
const searchSize = 36 * 8; // 36 blocks around destroyer
const destroyerSearchSize = 80 * 8; // 80 blocks away from destroyed
const AttackSizes = {
    "massive": 67500, // ≈4.5 corvus
    "large": 22500, // ≈6.5 quad
    "medium": 7500, // ≈22.6 zenith
    "small": 2500, // ≈7.5 zenith
}

let lastSendTime;
let lastCheckTime;

Events.on(EventType.WorldLoadEvent, () => {
    lastSendTime = -sendCooldown;
    lastCheckTime = -sendCooldown;
});

let event = (event) => {
    if (Time.time - 6 < lastCheckTime) return; // No more than 10 times per second. Reactor explosion can cause multiple useless checks
    if (Time.time - sendCooldown < lastCheckTime) return;

    const tile = event.tile;
    if (tile.team() != Vars.player.team()) return;

    const x = tile.x * 8;
    const y = tile.y * 8;
    let currentAttackValue = 0;

    lastCheckTime = Time.time;

    const destroyer = Units.closestEnemy(Vars.player.team(), x, y, destroyerSearchSize, (unit) => {
        if (!unitsCounter.isDangerous(unit)) return false;
        if (Mathf.dst(x, y, unit.x, unit.y) > unit.range()*1.5) return false;
        return true;
    });
    if (!destroyer) return;

    Units.nearbyEnemies(Vars.player.team(), destroyer.x - searchSize, destroyer.y - searchSize, searchSize*2, searchSize*2, (unit) => {
        if (!unitsCounter.isDangerous(unit)) return;
        currentAttackValue += relativeValue.getUnitValue(unit.type.toString());
    });

    for (let [name, value] of Object.entries(AttackSizes)) {
        if (currentAttackValue > value) {
            output.ingameAlert(Core.bundle.get("alerts." + name + "-attack"), drawTasks.divergingCircles(x, y, {color: Color.red}));
            lastSendTime = Time.time;
            return;
        }
    }
}

new Alerts.BaseAlert(
    () => {
        Events.on(BlockDestroyEvent, event);
    },
    () => {
        Events.remove(BlockDestroyEvent, event);
    }
)
