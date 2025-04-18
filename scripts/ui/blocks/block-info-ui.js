const formattingUtil = require("extended-ui/utils/formatting");
let contentTable;

let hovered = null;
let isPlayerTeam = null;

let isBuilded = false;

Events.on(ClientLoadEvent, () => {
    Vars.ui.hudGroup.fill(null, t => {
        contentTable = t.table(Styles.black3).margin(4).get();
        contentTable.visibility = () => infoTableVisibility();
        t.bottom().left();
        t.pack();
    });
})

Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-ShowBlockInfo", true)) {
        if (isBuilded) {
            clearTable();
        }
        hovered = null;
        return;
    }

    if (!contentTable) return;

    let x = Core.input.mouseX();
    let y = Core.input.mouseY();

    let pos = Core.input.mouseWorld(x, y);
    let mouseTile = Vars.world.tileWorld(pos.x, pos.y);

    if (!mouseTile) return;

    let build = mouseTile.build;

    if (!build) {
        if (isBuilded) {
            clearTable();
        }
        hovered = null;
        return;
    }

    isPlayerTeam = build.team == Vars.player.team();
    hovered = build;

    if (isRebuildNeeded(build)) {
        rebuildTable(build);
    }
});

Events.run(Trigger.draw, () => {
    if (hovered && hovered.range && !isPlayerTeam) {
        Draw.draw(Layer.overlayUI+0.01, () => {
            let realRange;

            if (hovered.realRange) {
                realRange = hovered.realRange();
            } else {
                realRange = hovered.range();
            }

            Drawf.dashCircle(hovered.x, hovered.y, realRange, hovered.team.color);
        });
    }
})

function isRebuildNeeded(build) {
    //Useless? Should be rebuilded every frame to get last info about hovered block
    return true;
}

function rebuildTable(build) {
    clearTable();
    buildTable(build);
}

function clearTable() {
    if (!isBuilded) return;

    contentTable.clearChildren();
    isBuilded = false;
}

function buildTable(build) {
    const power = build.power;
    const items = build.items;
    // If there's a field named "config" rhino will give it instead of always defined for Buinding
    // subclasses "config" method. See LangindPad implementation for example
    const config = typeof build.config == 'function' ? build.config() : build.config;
    const displayPower = power && !isPlayerTeam;
    const displayItems = items && build.items.total() > 0 && (!isPlayerTeam || build.items.total() <= 50);
    const displayConfig = typeof config == "string" && !isPlayerTeam;
    if (![displayPower, displayItems, displayConfig].includes(true)) return;

    if (displayPower) {
        const powerTable = contentTable.table().get();
        const graph = build.power.graph;

        const storedNetPower = graph.getBatteryStored();
        const maxNetPower = graph.getTotalBatteryCapacity();
        const currentNetPower = graph.getPowerBalance();

        powerTable.label(() => {
            return Core.bundle.get("block-info.power") + ": " + formattingUtil.powerToString(currentNetPower, []);
        })
        powerTable.row();
        if (maxNetPower) {
            powerTable.label(() => Core.bundle.get("block-info.stored") + ": " + Math.round(storedNetPower/maxNetPower*100) + "%");
        }
        contentTable.row();
    }
    if (displayItems) {
        const resourcesTable = contentTable.table().get();
        let i = 0;
        build.items.each((item,amount) => {
            resourcesTable.image(item.uiIcon).left();
            resourcesTable.label(() => {
                return amount.toString();
            }).padLeft(2).left().padRight(4);

            if(++i % 4 == 0) {
                resourcesTable.row();
            }
        });
        contentTable.row();
    }
    if (displayConfig) {
        const configTable = contentTable.table().get();
        configTable.label(() => {
            return build.config();
        })
        contentTable.row();
    }
    isBuilded = true;
}

function infoTableVisibility() {
    return Vars.ui.hudfrag.shown && isBuilded;
}
