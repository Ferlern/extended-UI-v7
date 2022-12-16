const iterationTools = require("extended-ui/utils/iteration-tools");
const formattingUtil = require("extended-ui/utils/formatting");

const powerBarDefaultWidth = 300;
const powerBarDefaultHeight = 25;

let powerBar = null

let graphs = [];
let storedNetPower;
let maxNetPower;
let currentNetPower;

let debugTimer;


exports.createTableWithBarFrom = (table) => {
    if (!powerBar) powerBar = new Bar(prov(() => formattingUtil.powerToString(currentNetPower, graphs)), prov(() => Pal.accent), floatp(() => currentPowerStatus()));

    const tableWithBar = new Table();
    tableWithBar.add(table);
    tableWithBar.row();
    tableWithBar.add(powerBar).visible(() => powerBarVisible()).width(powerBarDefaultWidth).height(powerBarDefaultHeight).pad(4);
    return tableWithBar;
}


Events.run(Trigger.update, () => {
    if (!Core.settings.getBool("eui-showPowerBar", true)) return;

    let newStoredNetPower = 0;
    let newMaxNetPower = 0;
    let newCurrentNetPower = 0;
    let newGraphs = [];

    let getAllPowerGraphs = (build) => {
        if (build && build.power) {
            let graph = build.power.graph;

            if (!newGraphs.includes(graph)) {


                newStoredNetPower += graph.getBatteryStored();
                newMaxNetPower += graph.getTotalBatteryCapacity();
                newCurrentNetPower += graph.getPowerBalance();

                // storing more than 100 graphs can provide some lags
                if (graph.getPowerBalance() && newGraphs.length < 100) newGraphs.push(graph);
            }
        }
    }

    iterationTools.iterateSeq(getAllPowerGraphs, Vars.indexer.getFlagged(Vars.player.team(), BlockFlag.generator).iterator());
    iterationTools.iterateSeq(getAllPowerGraphs, Vars.indexer.getFlagged(Vars.player.team(), BlockFlag.reactor).iterator());
    
    // when player remove power node, power go to 0 for ~half of a second somehow.
    if (currentNetPower && !newCurrentNetPower) {
        if (!debugTimer) {
            debugTimer = Date.now();
            return;
        } else if (Date.now() < debugTimer + 500) {
            return;
        }
    }

    debugTimer = 0;

    storedNetPower = newStoredNetPower;
    maxNetPower = newMaxNetPower;
    currentNetPower = newCurrentNetPower;
    graphs = newGraphs;
});

function currentPowerStatus() {
    if (!maxNetPower) {
        return 0;
    }
    return storedNetPower / maxNetPower;
}

function powerBarVisible() {
    return Core.settings.getBool("eui-showPowerBar", true) && (Boolean(storedNetPower) || Boolean(currentNetPower)); 
}
