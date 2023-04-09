Events.on(EventType.ClientLoadEvent, () => {
    const settings = Vars.ui.settings.graphics;
    settings.row();
    settings.button(Core.bundle.get("eui.config"), Styles.defaultt, () => extendedUIDialogSettings.show()).width(240).height(50);
    const extendedUIDialogSettings = new BaseDialog(Core.bundle.get("eui.settings"));
    extendedUIDialogSettings.addCloseButton();
    extendedUIDialogSettings.buttons.defaults().size(240, 60);

    extendedUIDialogSettings.cont.pane((() => {

        let contentTable;
        if (Version.number < 7) {
            contentTable = new Packages.arc.scene.ui.SettingsDialog.SettingsTable();
        } else {
            contentTable = new SettingsMenuDialog.SettingsTable();
        }

       
        contentTable.sliderPref("eui-action-delay", 500, 0, 3000, 25, i => i + " ms");
        contentTable.sliderPref("eui-MinimalResourcesInCore", 30, 10, 500, 10, i => i);
        contentTable.sliderPref("eui-MinimalResourcesInCore2", 10, 10, 500, 10, i => i);
        if (!Vars.mobile) {
            contentTable.checkPref("eui-DragBlock", false);
            contentTable.checkPref("eui-DragPathfind", false);
        }

        return contentTable;
    })());
});
