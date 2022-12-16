exports.isBusy = function() {
    return Vars.ui.chatfrag.shown() || Vars.ui.schematics.isShown() || Vars.control.input.isUsingSchematic() || Vars.control.input.selectedBlock();
}
