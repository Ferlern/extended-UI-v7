const storageConfig = require("extended-ui/interact/storage-config");
const storageFill = require("extended-ui/interact/storage-fill");
const iconsUtil = require("extended-ui/utils/icons");

let panel = null;
let lastBuild = null;
let isBuilt = false;

Events.on(ClientLoadEvent, () => {
    Vars.ui.hudGroup.fill(null, t => {
        panel = t.table(Styles.black3).margin(6).get();
        panel.visibility = () => isBuilt && Vars.ui.hudfrag.shown;
        t.bottom().right();
        t.pack();
    });
});

Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-storage-hover-ui", true)) {
        if (isBuilt) clearPanel();
        lastBuild = null;
        return;
    }
    if (!panel) return;

    const mx = Core.input.mouseX();
    const my = Core.input.mouseY();
    const pos = Core.input.mouseWorld(mx, my);
    const tile = Vars.world.tileWorld(pos.x, pos.y);
    if (!tile) {
        if (isBuilt) clearPanel();
        lastBuild = null;
        return;
    }
    const build = tile.build;
    if (!build || build.team !== Vars.player.team() || !storageFill.isManagedStorage(build.block)) {
        if (isBuilt) clearPanel();
        lastBuild = null;
        return;
    }

    if (build !== lastBuild) {
        lastBuild = build;
        rebuildPanel(build);
    }
});

function clearPanel() {
    if (!isBuilt) return;
    panel.clearChildren();
    isBuilt = false;
}

function rebuildPanel(build) {
    panel.clearChildren();
    isBuilt = true;

    panel.image(iconsUtil.getByName(build.block.name)).size(24).pad(2);
    panel.add(build.block.localizedName).pad(4);
    panel.row();
    panel.add(Core.bundle.get("eui.storage.hover-hint")).colspan(2).pad(4);
    panel.row();

    const configured = [];
    Vars.content.items().each(item => {
        const thr = storageConfig.getThreshold(build, item);
        if (thr > 0) configured.push({ item: item, threshold: thr });
    });

    if (configured.length === 0) {
        panel.add(Core.bundle.get("eui.storage.hover-empty")).colspan(2).pad(4);
        return;
    }

    for (let i = 0; i < configured.length; i++) {
        const entry = configured[i];
        panel.image(iconsUtil.getByName(entry.item.name)).size(20).pad(2);
        panel.label(() => {
            const stock = build.items ? build.items.get(entry.item) : 0;
            return stock + " / " + entry.threshold;
        }).pad(4);
        panel.row();
    }
}
