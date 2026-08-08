// Shared dialog helpers used by every settings sub-dialog.

// First available drawable wins — Mindustry version differences.
const ROW_BG = (function() {
    try { if (Styles.black3 != null) return Styles.black3; } catch (e) {}
    try { if (Tex.buttonEdge4 != null) return Tex.buttonEdge4; } catch (e) {}
    try { if (Tex.button != null) return Tex.button; } catch (e) {}
    try { if (Tex.pane != null) return Tex.pane; } catch (e) {}
    return null;
})();

function addRowSeparator(parent) {
    try {
        parent.image(Tex.whiteui).color(Pal.gray).height(2).growX().padTop(0).padBottom(0);
        parent.row();
    } catch (e) {}
}

// Uses our own confirm-text key — engine's "settings.reset.confirm"
// returns "???...???" through Core.bundle.get from Rhino.
function addStandardReset(dialog, doReset) {
    dialog.buttons.button(Core.bundle.get("settings.reset"), () => {
        Vars.ui.showConfirm(
            Core.bundle.get("confirm"),
            Core.bundle.get("eui.reset-confirm"),
            doReset
        );
    }).size(240, 60);
}

exports.ROW_BG = ROW_BG;
exports.addRowSeparator = addRowSeparator;
exports.addStandardReset = addStandardReset;
