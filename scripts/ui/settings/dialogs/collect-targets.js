const collectConfig = require("extended-ui/interact/collect-config");
const iconsUtil = require("extended-ui/utils/icons");
const helpers = require("extended-ui/ui/settings/helpers");
const resetHelpers = require("extended-ui/ui/settings/reset-helpers");

function build() {
    const dialog = new BaseDialog(Core.bundle.get("eui.collect-targets.title"));
    dialog.addCloseButton();
    helpers.addStandardReset(dialog, () => {
        resetHelpers.resetCollectTargetsSettings();
        rebuild();
    });

    function listFactories() {
        const factories = [];
        Vars.content.blocks().each(block => {
            if (block instanceof GenericCrafter
                && block.outputItems != null
                && block.outputItems.length > 0
                && !block.isHidden()) {
                factories.push(block);
            }
        });
        factories.sort((a, b) => a.id - b.id);
        return factories;
    }

    function listDrillItems() {
        const items = [];
        Vars.content.items().each(item => items.push(item));
        items.sort((a, b) => a.id - b.id);
        return items;
    }

    function allEnabled() {
        const factories = listFactories();
        for (let i = 0; i < factories.length; i++) {
            if (!collectConfig.isFactoryEnabled(factories[i])) return false;
        }
        const items = listDrillItems();
        for (let i = 0; i < items.length; i++) {
            if (!collectConfig.isDrillItemEnabled(items[i])) return false;
        }
        return true;
    }

    function setAll(value) {
        listFactories().forEach(b => collectConfig.setFactoryEnabled(b, value));
        listDrillItems().forEach(it => collectConfig.setDrillItemEnabled(it, value));
    }

    dialog.buttons.button(Core.bundle.get("eui.collect-targets.toggle-all"), () => {
        setAll(!allEnabled());
        rebuild();
    }).size(240, 60);

    let listTable = null;
    dialog.cont.add(Core.bundle.get("eui.collect-targets.hint")).width(580).wrap().pad(6).get().setAlignment(Align.center);
    dialog.cont.row();
    dialog.cont.pane(t => { listTable = t; t.top(); }).grow().maxHeight(540);

    function rebuild() {
        if (!listTable) return;
        listTable.clearChildren();

        listTable.add(Core.bundle.get("eui.collect-targets.factories")).colspan(3).left().pad(8);
        listTable.row();

        const factories = listFactories();

        if (factories.length === 0) {
            listTable.add(Core.bundle.get("eui.collect-targets.no-factories")).colspan(3).left().pad(8);
            listTable.row();
        } else {
            for (let i = 0; i < factories.length; i++) {
                addFactoryRow(listTable, factories[i]);
            }
        }

        listTable.add(Core.bundle.get("eui.collect-targets.drills")).colspan(3).left().pad(8);
        listTable.row();

        const items = listDrillItems();
        for (let i = 0; i < items.length; i++) {
            addDrillItemRow(listTable, items[i]);
        }
    }

    function addFactoryRow(parent, block) {
        parent.table(helpers.ROW_BG, row => {
            row.image(iconsUtil.getByName(block.name)).size(32).pad(4);
            row.add(block.localizedName).left().growX().pad(4);
            row.check("", collectConfig.isFactoryEnabled(block), b => {
                collectConfig.setFactoryEnabled(block, b);
            }).pad(4);
        }).growX().pad(4);
        parent.row();
        helpers.addRowSeparator(parent);
    }

    function addDrillItemRow(parent, item) {
        parent.table(helpers.ROW_BG, row => {
            row.image(iconsUtil.getByName(item.name)).size(32).pad(4);
            row.add(item.localizedName).left().growX().pad(4);
            row.check("", collectConfig.isDrillItemEnabled(item), b => {
                collectConfig.setDrillItemEnabled(item, b);
            }).pad(4);
        }).growX().pad(4);
        parent.row();
        helpers.addRowSeparator(parent);
    }

    dialog.shown(() => rebuild());
    return dialog;
}

exports.build = build;
