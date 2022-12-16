const euiEvents = require("extended-ui/utils/event/events");

let startPos;
let startTile;
let dragging = false;

euiEvents.eventType.dragStarted = "dragStarted";
euiEvents.eventType.dragged = "dragged";
euiEvents.eventType.dragEnded = "dragEnded";


Events.run(Trigger.update, () => {
    const tap = Core.input.keyTap(Packages.arc.input.KeyCode.mouseLeft);
    const release = Core.input.keyRelease(Packages.arc.input.KeyCode.mouseLeft);

    if (dragging || tap || release) {
        let pos = Core.input.mouseWorld(Core.input.mouseX(), Core.input.mouseY());
        let mouseTile = Vars.world.tileWorld(pos.x, pos.y);

        if (!mouseTile) return;

        if (tap) {
            startPos = { x: pos.x, y: pos.y };
            startTile = mouseTile;
            dragging = true;
            euiEvents.emit(euiEvents.eventType.dragStarted, startPos, startTile);
        }
        if (release) {
            if (dragging) {
                dragging = false;
                euiEvents.emit(euiEvents.eventType.dragEnded, startPos, startTile, pos, mouseTile);
            }
        }
        if (dragging) euiEvents.emit(euiEvents.eventType.dragged, startPos, startTile, pos, mouseTile);
    }
});
