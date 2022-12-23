const iconsUtil = require("extended-ui/utils/icons");
const coreUnits = require("extended-ui/units/core-units");
const blacklist = require("extended-ui/units/blacklist");

let selectUnitDialog;
let contentTable = null;
let isBuilded = false;
let showSettings = false;
let interactCore = Core.settings.getBool("eui-interact-core", false);
let fillBuildings = Core.settings.getBool("eui-auto-fill", false);
let selectedUnit = Core.settings.getString("eui-auto-unit");

Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-showInteractSettings", true)) {
        if (isBuilded) {
            clearTable();
        }
        return;
    };
    if (isRebuildNeeded()) rebuildTable();
});

Events.on(ClientLoadEvent, () => {
    Vars.ui.hudGroup.fill(null, t => {
        contentTable = t.table().get();
        t.center().bottom();
        t.pack();
    });
    contentTable.visibility = () => tableVisibility();

    const size = 568;

    selectUnitDialog = new BaseDialog(Core.bundle.get("schematics-table.dialog.change-image.title"));
    selectUnitDialog.addCloseButton();   

    const unitSprites = iconsUtil.getUnitSprites();
    unitSprites['cancel'] = iconsUtil.getByName("cancel");

    let r = 0;
    selectUnitDialog.cont.pane(table => {
        for (let [unitName, unitImage] of Object.entries(unitSprites)) {
            if (unitName == "block" || coreUnits.includes(unitName) || blacklist.includes(unitName)) continue;
            const setted_name = unitName;
            let imageButton = table.button(unitImage, Styles.cleari, () => {
                Core.settings.put("eui-auto-unit", setted_name);
                selectedUnit = setted_name;                            
                rebuildTable();
                selectUnitDialog.hide();
            }).size(48).pad(4).get();
            imageButton.resizeImage(48*0.8);
    
            if (++r % 10 == 0) table.row();
        }
    }).size(size, size);
});

function isRebuildNeeded() {
    if (!isBuilded) return true;
    return false;
}

function rebuildTable() {
    clearTable();
    buildTable();
}

function buildTable() {
    if (!contentTable) return;
    isBuilded = true;

    contentTable.button(Icon.upOpen, Styles.selecti, () => {
        showSettings = !showSettings;
        rebuildTable();
    }).width(64).height(16).marginBottom(3);
    if (!showSettings) return;

    contentTable.row();
    const buttonTable = contentTable.table().get();
    buttonTable.defaults().size(32);
    buttonTable.button(iconsUtil.getByName("core-nucleus"), Styles.clearTogglei, () => {
        interactCore = !interactCore;
        Core.settings.put("eui-interact-core", interactCore);
    }).tooltip(Core.bundle.get("interaction-settings.button.core.tooltip")).update(b => {
        b.setChecked(interactCore);
    }).get().resizeImage(32*0.8);

    buttonTable.button(Icon.box, Styles.clearTogglei, () => {
        fillBuildings = !fillBuildings;
        Core.settings.put("eui-auto-fill", fillBuildings);
    }).tooltip(Core.bundle.get("interaction-settings.button.auto-fill.tooltip")).update(b => {
        b.setChecked(fillBuildings);
    }).get().resizeImage(32*0.8);

    buttonTable.button(iconsUtil.getByName(selectedUnit), Styles.cleari, () => {
        selectUnitDialog.show();
    }).tooltip(Core.bundle.get("interaction-settings.button.auto-unit.tooltip")).get().resizeImage(32*0.8);
}


function clearTable() {
    if (!isBuilded) return;

    contentTable.clearChildren();
    isBuilded = false;
}

function tableVisibility() {
    return Vars.ui.hudfrag.shown && isBuilded;
}
