let prevStatus = false;
let nowMineble = [];

Events.run(Trigger.update, () => {
    const status = Core.settings.getBool("eui-makeMineble", false);
    if (status == prevStatus) return;

    if (status) {
        makeAllMineble();
    } else {
        removeMineble();
    }
    prevStatus = status;
});

function makeAllMineble() {
    Vars.content.blocks().each((b) => {
        if (!b.playerUnmineable) return;
        b.playerUnmineable = false;
        nowMineble.push(b);
    });
}

function removeMineble() {
    nowMineble.forEach((b) => {
        b.playerUnmineable = true;
    });
    nowMineble = [];
}
