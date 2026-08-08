const coreLimits = require("extended-ui/interact/core-limits");
const iconsUtil = require("extended-ui/utils/icons");
const helpers = require("extended-ui/ui/settings/helpers");
const resetHelpers = require("extended-ui/ui/settings/reset-helpers");

function build() {
    const dialog = new BaseDialog(Core.bundle.get("eui.core-limits.title"));
    dialog.addCloseButton();
    helpers.addStandardReset(dialog, () => {
        resetHelpers.resetCoreLimitsSettings();
        rebuild();
    });

    let listTable = null;
    dialog.cont.add(Core.bundle.get("eui.core-limits.hint")).width(580).wrap().pad(6).get().setAlignment(Align.center);
    dialog.cont.row();
    dialog.cont.pane(t => { listTable = t; t.top(); }).grow().maxHeight(540);

    function rebuild() {
        if (!listTable) return;
        listTable.clearChildren();
        const items = [];
        Vars.content.items().each(item => items.push(item));
        items.sort((a, b) => a.id - b.id);
        for (let i = 0; i < items.length; i++) {
            addItemRow(listTable, items[i]);
        }
    }

    function addItemRow(parent, item) {
        parent.table(helpers.ROW_BG, row => {
            row.image(iconsUtil.getByName(item.name)).size(32).pad(4);
            row.add(item.localizedName).left().width(140).pad(4);

            row.check("", coreLimits.isOverridden(item), b => {
                coreLimits.setOverridden(item, b);
            }).pad(4).tooltip(Core.bundle.get("eui.core-limits.override-tooltip"));

            const fieldCell = row.field(coreLimits.getStoredLimit(item) + "", text => {
                const v = parseInt(text);
                if (!isNaN(v)) {
                    const clamped = Math.max(0, Math.min(coreLimits.LIMIT_MAX, v));
                    coreLimits.setLimit(item, clamped);
                }
            });
            fieldCell.valid(text => /^\d+$/.test(text) && parseInt(text) <= coreLimits.LIMIT_MAX);
            fieldCell.width(110).pad(4);
            const fieldElement = fieldCell.get();

            row.button(Icon.cancel, Styles.cleari, () => {
                coreLimits.resetLimit(item);
                fieldElement.setText(coreLimits.DEFAULT_LIMIT + "");
            }).size(36).pad(4).tooltip(Core.bundle.get("eui.core-limits.reset-tooltip"));
        }).growX().pad(4);
        parent.row();
        helpers.addRowSeparator(parent);
    }

    dialog.shown(() => rebuild());
    return dialog;
}

exports.build = build;
