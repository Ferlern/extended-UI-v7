const unitsCounter = require("extended-ui/units/units-counter");
const barBuilder = require("extended-ui/utils/draw/bar-builder");

const granulatiry = 6;
const maxToDisplay = 8;

let prevUnitsUiVisible = true;
let unitsUiVisible = true;
let hideCoreUnits = false;
let hideSupportUnits = false;
let isBuilded = false;
let holdedEntity = null;
let hoveredEntity = null;
let amountToDisplay = 0;
let updateTimer = Date.now();

let overlayMarker;
let contentTable;
let unitTable;

Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-ShowUnitTable", true)) {
        if (isBuilded) {
            clearTable();
        }
        hoveredEntity = null;
        return;
    }

    if (hoveredEntity && !contentTable.hasMouse()) hoveredEntity = null;

    if (!overlayMarker) {
        setMarker();
    }

    // updated so rarely because fast makes click on label impossible
    const timer = Date.now();
    if (timer - 500 < updateTimer) return;
    updateTimer = timer;

    const unitsValueTop = unitsCounter.getUnitsValueTop(maxToDisplay, granulatiry, hideCoreUnits, hideSupportUnits);
    amountToDisplay = unitsValueTop.length;

    if (isRebuildNeeded()) {
        rebuildTable();
    }
    

    unitTable.clearChildren()
    for (let [, teamInfo] of unitsValueTop) {
        const team = teamInfo.team;
        const teamUnits = teamInfo.units;

        for (let [, unitInfo] of Object.entries(teamUnits)) {
            const entity = unitInfo.entity;
            const amount = unitInfo.amount;
            unitTable.label(() => {
                return getTeamColor(team) + amount + '[white]';
            }).left();
            const image = unitTable.image(entity.icon()).left().padRight(5).padBottom(2).maxSize(24).get();
            image.hovered(() => {
                hoveredEntity = entity;
            });
            image.clicked(() => {
                if (!holdedEntity || !isSameEntity(holdedEntity, entity)) {
                    holdedEntity = entity;
                } else {
                    holdedEntity = null;
                }
            });

            if (holdedEntity && holdedEntity.dead && isSameEntity(holdedEntity, entity)) {
                holdedEntity = entity;
            }
        };
        unitTable.row();
    }
});

Events.run(Trigger.draw, () => {
    if (!Core.settings.getBool("eui-ShowUnitTable", true)) return;
    let entity;
    if (hoveredEntity && !hoveredEntity.dead) {
        entity = hoveredEntity;
    } else if (holdedEntity && !holdedEntity.dead) {
        entity = holdedEntity;
    } else {
        return
    }
    
    Draw.draw(Layer.overlayUI+0.01, () => {
        let x;
        let y;

        if (Version.number >= 8 && Vars.player.unit() == null) {
            const position = Core.camera.position;
            x = position.x;
            y = position.y;
        } else if (Version.number < 8 && Vars.player.unit() instanceof NullUnit) {
            const position = Core.camera.position;
            x = position.x;
            y = position.y;
        } else {
            const unit = Vars.player.unit();
            x = unit.x;
            y = unit.y;
        }
        const distance = Mathf.dst(x, y, entity.x, entity.y);
        const text = Math.round(distance / 8).toString();
        
        Draw.color(entity.team.color);
        Lines.line(x, y, entity.x, entity.y);
        if (distance > 80) barBuilder.drawLabel(text, x, y + 20, Color.white, true);
    });
})

Events.on(EventType.WorldLoadEvent, () => {
    holdedEntity = null;
});

function rebuildTable() {
    clearTable();
    buildTable();
}

function clearTable() {
    if (!isBuilded) return;

    contentTable.clearChildren();
    isBuilded = false;
}

function buildTable() {
    const buttonSize = 40;

    let unitTableButtons = contentTable.table().top().left().margin(3).get();

    unitTableButtons.button(Icon.play, Styles.defaulti, () => {
        unitsUiVisible = !unitsUiVisible;
    }).width(buttonSize).height(buttonSize).pad(1).name("show").tooltip(Core.bundle.get("units-table.button.hide.tooltip"));

    let imageButton = unitTableButtons.button(new TextureRegionDrawable(Icon.players), Styles.defaulti, () => {
        hideCoreUnits = !hideCoreUnits;
    }).update(b => b.setChecked(hideCoreUnits)).width(buttonSize).height(buttonSize).pad(1).name("core-units").tooltip(Core.bundle.get("units-table.button.core-units.tooltip")).get();
    imageButton.visibility = () => unitsUiVisible;
    imageButton.resizeImage(buttonSize*0.6);

    imageButton = unitTableButtons.button(new TextureRegionDrawable(Icon.github), Styles.defaulti, () => {
        hideSupportUnits = !hideSupportUnits;
    }).update(b => b.setChecked(hideSupportUnits)).width(buttonSize).height(buttonSize).pad(1).name("support-units").tooltip(Core.bundle.get("units-table.button.support-units.tooltip")).get();
    imageButton.visibility = () => unitsUiVisible;
    imageButton.resizeImage(buttonSize*0.6);

    contentTable.row();

    unitTable = contentTable.table().margin(3).get();
    unitTable.visibility = () => unitsUiVisible;

    isBuilded = true;
}

function isRebuildNeeded() {
    if (!isBuilded) return true;
    return false;
}

function setMarker() {
    const contentTableStyle = Version.number > 6 ? Tex.buttonEdge4 : Styles.black3

    overlayMarker = Vars.ui.hudGroup.find("waves");
    overlayMarker.row();
    contentTable = overlayMarker.table(contentTableStyle).update((t) => {
        if (prevUnitsUiVisible != unitsUiVisible) {
            t.setBackground(unitsUiVisible ? contentTableStyle : Styles.none);
            prevUnitsUiVisible = unitsUiVisible;
        }
    }).name("unit-table").top().left().marginBottom(2).marginTop(2);
    contentTable = contentTable.get();
    contentTable.visibility = () => isBuilded && Boolean(amountToDisplay); // Boolean really neccessary
}

function isSameEntity(entity1, entity2) {
    if (entity1 == null || entity2 == null) return false;
    return entity1.team == entity2.team && entity1.type == entity2.type;
}

function getTeamColor(team) {
    return "[#"+team.color.toString()+"]";
}
