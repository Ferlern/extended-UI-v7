const storageFill = require("extended-ui/interact/storage-fill");
const storageEditDialog = require("extended-ui/ui/dialogs/storage-edit-dialog");

Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-storage-click-ui", true)) return;
    if (Vars.ui.hudfrag == null || !Vars.ui.hudfrag.shown) return;
    if (Core.scene.getKeyboardFocus() != null) return;
    if (!Core.input.keyTap(KeyCode.j)) return;

    const mx = Core.input.mouseX();
    const my = Core.input.mouseY();
    const pos = Core.input.mouseWorld(mx, my);
    const tile = Vars.world.tileWorld(pos.x, pos.y);
    if (!tile) return;
    const build = tile.build;
    if (!build) return;
    if (build.team !== Vars.player.team()) return;
    if (!storageFill.isManagedStorage(build.block)) return;

    storageEditDialog.build(build).show();
});
