const euiEvents = require("extended-ui/utils/event/events");
const drawPlans = require("extended-ui/utils/draw/build-plan");
const adjacentPosition = require("extended-ui/utils/ai/adjacent-position");
const busy = require("extended-ui/input/busy");

const targetBlock = Blocks.vault;
let isListen = false;
let buildPlan = null;

Events.run(Trigger.draw, () => {
    if (buildPlan) {
        drawPlans.drawOne(buildPlan);
    }
});

const listener = (startPos, startTile, pos, mouseTile) => {
    if (Core.input.keyTap(Packages.arc.input.KeyCode.mouseRight)) {
        buildPlan = null;
        endListen();
        return;
    }

    if (mouseTile.block() instanceof CoreBlock) {
        buildPlan = null;
        return;
    }

    const position = adjacentPosition.find(startTile, mouseTile, targetBlock);
    if (!position) {
        buildPlan = null;
        return;
    }

    buildPlan = new BuildPlan(position.x, position.y, 0, targetBlock);
}

euiEvents.on(euiEvents.eventType.dragStarted, (startPos, startTile) => {
    if (startTile && startTile.block() instanceof CoreBlock && !busy.isBusy() &&!isListen) {
        startListen();
    }
});

euiEvents.on(euiEvents.eventType.dragEnded, () => {
    if (isListen) {
        endListen();
    }
});

function startListen() {
    if (Core.settings.getBool("eui-DragBlock", false)) {
        isListen = true;
        euiEvents.on(euiEvents.eventType.dragged, listener);
    }
}

function endListen() {
    if (buildPlan) {
        Vars.player.unit().addBuild(buildPlan);
        buildPlan = null;
    }
    isListen = false;
    euiEvents.removeListener(euiEvents.eventType.dragged, listener);
}
