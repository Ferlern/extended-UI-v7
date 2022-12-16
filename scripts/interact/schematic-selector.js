const euiEvents = require("extended-ui/utils/event/events");
const schematicsCreate = require("extended-ui/utils/schematics");

let drawing = false;
let startDrawX = 0;
let startDrawY = 0;
let endDrawX = 0;
let endDrawY = 0;

Events.run(Trigger.draw, () => {
    if (drawing) {
        Draw.draw(Layer.overlayUI+0.01, () => {
            Draw.z(Layer.darkness + 1);

            Lines.stroke(1, Pal.accent);
            Lines.rect(startDrawX, startDrawY, endDrawX - startDrawX, endDrawY - startDrawY);
            Draw.reset();
        });
    }
});

const coordListener = (startPos, startTile, pos, mouseTile) => {
    startDrawX = startPos.x;
    startDrawY = startPos.y;
    endDrawX = pos.x;
    endDrawY = pos.y;
}


const creator = (startPos, startTile, pos, mouseTile) => {
    if (!mouseTile || !startTile) return;

    Vars.control.input.lastSchematic = schematicsCreate.create(
        Math.min(startTile.centerX(), mouseTile.centerX()), Math.min(startTile.centerY(), mouseTile.centerY()),
        Math.max(startTile.centerX(), mouseTile.centerX()), Math.max(startTile.centerY(), mouseTile.centerY())
    );

    if (Vars.control.input.lastSchematic != null) {
        Vars.control.input.useSchematic(Vars.control.input.lastSchematic);
        euiEvents.emit(euiEvents.eventType.schemSelectionEnd);
        euiEvents.removeListener(euiEvents.eventType.dragEnded, creator);
        drawing = false;
    };
}

euiEvents.on(euiEvents.eventType.schemSelectionButtonPresed, (active) => {
    if (active) {
        euiEvents.on(euiEvents.eventType.dragEnded, creator);
        euiEvents.on(euiEvents.eventType.dragged, coordListener);
        drawing = true;
    } else {
        euiEvents.removeListener(euiEvents.eventType.dragEnded, creator);
        euiEvents.removeListener(euiEvents.eventType.dragged, coordListener);
        drawing = false;
    }
});
