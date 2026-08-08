const storageConfig = require("extended-ui/interact/storage-config");
const storageFill = require("extended-ui/interact/storage-fill");
const storageEditDialog = require("extended-ui/ui/dialogs/storage-edit-dialog");
const iconsUtil = require("extended-ui/utils/icons");
const helpers = require("extended-ui/ui/settings/helpers");
const resetHelpers = require("extended-ui/ui/settings/reset-helpers");

function build() {
    const dialog = new BaseDialog(Core.bundle.get("eui.storage.title"));
    dialog.addCloseButton();
    helpers.addStandardReset(dialog, () => {
        resetHelpers.resetStorageSettings();
        clipboard = null;
        rebuild();
    });

    let clipboard = null;

    let listTable = null;
    dialog.cont.add(Core.bundle.get("eui.storage.hint")).width(580).wrap().pad(6).get().setAlignment(Align.center);
    dialog.cont.row();
    dialog.cont.pane(t => { listTable = t; t.top(); }).grow().maxHeight(540);

    function rebuild() {
        if (!listTable) return;
        listTable.clearChildren();
        const storages = [];
        const team = Vars.player.team();
        const data = team ? team.data() : null;
        const builds = data ? data.buildings : null;
        if (builds) {
            builds.each(b => {
                try {
                    if (storageFill.isManagedStorage(b.block)) storages.push(b);
                } catch (e) {}
            });
        }

        if (storages.length === 0) {
            listTable.add(Core.bundle.get("eui.storage.no-storages")).colspan(4).pad(8);
            listTable.row();
            return;
        }

        storages.sort((a, b) => {
            const pa = storageConfig.getPriority(a);
            const pb = storageConfig.getPriority(b);
            if (pa !== pb) return pb - pa;
            return (a.tile.y * 10000 + a.tile.x) - (b.tile.y * 10000 + b.tile.x);
        });
        for (let i = 0; i < storages.length; i++) {
            addStorageRow(listTable, storages[i]);
        }
    }

    function addStorageRow(parent, building) {
        const block = building.block;
        parent.table(helpers.ROW_BG, row => {
            row.image(iconsUtil.getByName(block.name)).size(32).pad(4);
            row.add(block.localizedName + " (" + building.tile.x + ", " + building.tile.y + ")").left().growX().pad(4);

            const configured = storageConfig.countConfigured(building);
            row.label(() => configured > 0
                ? Core.bundle.format("eui.storage.row-summary", configured)
                : Core.bundle.get("eui.storage.row-empty")).pad(4);

            const priorityField = row.field(storageConfig.getPriority(building) + "", text => {
                const v = parseInt(text);
                if (!isNaN(v)) {
                    storageConfig.setPriority(building, Math.max(0, Math.min(storageConfig.MAX_PRIORITY, v)));
                }
            });
            priorityField.valid(text => /^\d+$/.test(text) && parseInt(text) <= storageConfig.MAX_PRIORITY);
            priorityField.width(70).pad(4).tooltip(Core.bundle.get("eui.storage.priority-tooltip"));

            row.button(Icon.copy, Styles.cleari, () => {
                clipboard = storageConfig.snapshot(building);
            }).size(36).pad(4).tooltip(Core.bundle.get("eui.storage.copy-tooltip"));

            row.button(Icon.paste, Styles.cleari, () => {
                if (!clipboard) return;
                storageConfig.applySnapshot(building, clipboard);
                rebuild();
            }).size(36).pad(4).tooltip(Core.bundle.get("eui.storage.paste-tooltip"))
              .update(c => { c.setDisabled(clipboard == null); });

            row.button(Icon.pencil, Styles.cleari, () => {
                storageEditDialog.build(building, () => rebuild()).show();
            }).size(36).pad(4);
        }).growX().pad(4);
        parent.row();
        helpers.addRowSeparator(parent);
    }

    dialog.shown(() => rebuild());
    dialog.hidden(() => { clipboard = null; });
    return dialog;
}

exports.build = build;
