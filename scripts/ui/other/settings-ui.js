const coreLimits = require("extended-ui/interact/core-limits");
const consumerConfig = require("extended-ui/interact/consumer-config");
const resetHelpers = require("extended-ui/ui/settings/reset-helpers");
const coreLimitsDialogModule = require("extended-ui/ui/settings/dialogs/core-limits");
const collectTargetsDialogModule = require("extended-ui/ui/settings/dialogs/collect-targets");
const storageListDialogModule = require("extended-ui/ui/settings/dialogs/storage-list");
const taskPriorityDialogModule = require("extended-ui/ui/settings/dialogs/task-priority");

Events.on(EventType.ClientLoadEvent, () => {
    Vars.ui.settings.addCategory("@eui.name", t => {
        t.row();
        t.button(Core.bundle.get("eui.name"), Styles.defaultt, () => extendedUIDialogSettings.show()).width(240).height(50);
    })

    const extendedUIDialogSettings = new BaseDialog(Core.bundle.get("eui.settings"));
    extendedUIDialogSettings.addCloseButton();
    extendedUIDialogSettings.buttons.defaults().size(240, 60);

    const coreLimitsDialog = coreLimitsDialogModule.build();
    const collectTargetsDialog = collectTargetsDialogModule.build();
    const storageListDialog = storageListDialogModule.build();
    const taskPriorityDialog = taskPriorityDialogModule.build();

    extendedUIDialogSettings.cont.pane((() => {

        let contentTable;
        if (Version.number < 7) {
            contentTable = new Packages.arc.scene.ui.SettingsDialog.SettingsTable();
        } else {
            contentTable = new SettingsMenuDialog.SettingsTable();
        }

        // Reset goes through Core.settings.remove — Core.settings.put
        // with a JS number is a Rhino-Double crash.
        const REGISTERED_PREF_NAMES = [];
        const checkPref = (name, def) => {
            REGISTERED_PREF_NAMES.push(name);
            contentTable.checkPref(name, def);
        };
        const sliderPref = (name, def, min, max, step, formatter) => {
            REGISTERED_PREF_NAMES.push(name);
            contentTable.sliderPref(name, def, min, max, step, formatter);
        };

        checkPref("eui-showPowerBar", true);
        checkPref("eui-showFactoryProgress", true);
        checkPref("eui-showUnitBar", true);
        checkPref("eui-ShowUnitTable", true);
        checkPref("eui-ShowBlockInfo", true);
        checkPref("eui-ShowAlerts", true);
        checkPref("eui-ShowAlertsBottom", false);
        checkPref("eui-ShowResourceRate", false);
        checkPref("eui-ShowSchematicsTable", true);
        checkPref("eui-ShowSchematicsPreview", true);
        sliderPref("eui-SchematicsTableRows", 4, 2, 20, 1, i => i);
        sliderPref("eui-SchematicsTableColumns", 5, 4, 16, 1, i => i);
        sliderPref("eui-SchematicsTableButtonSize", 30, 20, 80, 2, i => i);
        checkPref("eui-ShowEfficiency", false);
        sliderPref("eui-EfficiencyTimer", 15, 10, 180, 5, i => i);
        checkPref("eui-TrackPlayerCursor", false);
        sliderPref("eui-playerCursorStyle", 7, 1, 7, 1, i => i);
        checkPref("eui-ShowOwnCursor", false);
        checkPref("eui-TrackLogicControl", false);
        sliderPref("eui-maxZoom", 10, 1, 10, 1, i => i);
        checkPref("eui-makeMineble", false);
        checkPref("eui-showInteractSettings", true);
        sliderPref("eui-core-limit-global", coreLimits.DEFAULT_LIMIT, 0, 1000, 10, i => i);
        checkPref("eui-auto-collect-factory", false);
        checkPref("eui-auto-collect-drill", false);
        sliderPref("eui-collect-threshold", 50, 0, 100, 5, i => i + " %");
        checkPref("eui-storage-fill", false);
        checkPref("eui-storage-click-ui", true);
        checkPref("eui-storage-hover-ui", true);
        checkPref("eui-auto-fill-turrets", true);
        sliderPref("eui-consumer-fill-pct", consumerConfig.DEFAULT_FILL_PCT, 0, 100, 5, i => i + " %");
        sliderPref("eui-turret-fill-pct", consumerConfig.DEFAULT_TURRET_FILL_PCT, 0, 100, 5, i => i + " %");
        checkPref("eui-auto-pilot", false);
        sliderPref("eui-steering-cooldown-sec", 2, 0, 10, 1, i => i + " s");
        sliderPref("eui-action-delay", 500, 0, 3000, 25, i => i + " ms");
        checkPref("eui-debug-autopilot", false);
        if (!Vars.mobile) {
            checkPref("eui-DragBlock", false);
            checkPref("eui-DragPathfind", false);
        }

        // pref() registration places buttons before the auto-reset; the
        // .button() fallback is for Mindustry builds without the Setting
        // subclass.
        function pushButton(labelKey, dialog) {
            try {
                const Setting = SettingsMenuDialog.SettingsTable.Setting;
                const setting = new JavaAdapter(Setting, {
                    add: function(table) {
                        table.row();
                        table.button(Core.bundle.get(labelKey), Icon.box, () => dialog.show())
                            .width(360).height(50).pad(8).left();
                        table.row();
                    }
                }, "eui-btn-" + labelKey.replace(/\./g, "-"));
                contentTable.pref(setting);
            } catch (e) {
                contentTable.row();
                contentTable.button(Core.bundle.get(labelKey), Icon.box, () => dialog.show())
                    .width(360).height(50).pad(8).left();
            }
        }
        pushButton("eui.core-limits.open", coreLimitsDialog);
        pushButton("eui.collect-targets.open", collectTargetsDialog);
        pushButton("eui.storage.open", storageListDialog);
        pushButton("eui.task-priority.open", taskPriorityDialog);

        // Hide the auto-reset cell, append our own with showConfirm.
        function hideAutoReset() {
            try {
                const cells = contentTable.getCells();
                if (!cells || cells.size <= 0) return;
                const last = cells.peek();
                const elem = last.get();
                if (elem) {
                    try { elem.visible = false; } catch (e) {}
                }
                // Cell chain doesn't always return Cell here — pad(0)
                // can return the actor. Standalone try/catch each call.
                try { last.size(0, 0); } catch (e) {}
                try { last.pad(0); } catch (e) {}
                try { last.space(0); } catch (e) {}
            } catch (e) {
                log("eui hide auto-reset: " + e);
            }
        }
        function resetAllRegisteredPrefs() {
            for (let i = 0; i < REGISTERED_PREF_NAMES.length; i++) {
                try { Core.settings.remove(REGISTERED_PREF_NAMES[i]); } catch (e) {}
            }
        }
        function addCustomReset() {
            contentTable.row();
            contentTable.button(Core.bundle.get("settings.reset"), () => {
                Vars.ui.showConfirm(
                    Core.bundle.get("confirm"),
                    Core.bundle.get("eui.reset-confirm"),
                    () => {
                        resetAllRegisteredPrefs();
                        resetHelpers.resetAllSubDialogSettings();
                        try { contentTable.rebuild(); } catch (e) {}
                        hideAutoReset();
                        addCustomReset();
                    }
                );
            }).width(360).height(50).pad(8);
        }
        hideAutoReset();
        addCustomReset();

        return contentTable;
    })());

    global.eui.settings = extendedUIDialogSettings;
    global.eui.coreLimitsDialog = coreLimitsDialog;
    global.eui.collectTargetsDialog = collectTargetsDialog;
    global.eui.storageListDialog = storageListDialog;
    global.eui.taskPriorityDialog = taskPriorityDialog;
});
