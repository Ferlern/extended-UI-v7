const barBuilder = require("extended-ui/utils/draw/bar-builder");

let storage = new Map();

Events.on(EventType.WorldLoadEvent, () => {
    storage = new Map();
});

function EfficiencyLabel() {
    this.replace = false;
    this.draw = function(build) {
        if (!Core.settings.getBool("eui-ShowEfficiency", false)) return;

        let efficiency = countEfficiency(build);

        let text = barBuilder.buildPercentLabel(efficiency);
        Draw.z(Layer.effect+1);
        barBuilder.drawLabel(text, build.x, build.y, Color.white, true);
        Draw.reset();
    }
}

Events.on(ClientLoadEvent, () => {
    if (!Core.settings.getBool("eui-ShowEfficiency", false)) return;
    const version = Version.number;
    const is6 = version < 7;
    const is7 = version >= 7;
    Vars.content.blocks().each((block) => {
        
        let base;
        if (block instanceof Fracker) {
            base = Fracker.FrackerBuild;
        } else if (block instanceof SolidPump) {
            base = SolidPump.SolidPumpBuild;
        } else if (block instanceof Separator) {
            base = Separator.SeparatorBuild;
        } else if (block instanceof HeatProducer) {
            base = HeatProducer.HeatProducerBuild;
        } else if (block instanceof HeatCrafter) {
            base = HeatCrafter.HeatCrafterBuild;
        } else if (is7 && block instanceof AttributeCrafter) {
            base = AttributeCrafter.AttributeCrafterBuild;
        } else if (is6 && block instanceof Cultivator) {
            base = Cultivator.CultivatorBuild;
        } else if (is6 && block instanceof AttributeSmelter) {
            base = AttributeSmelter.AttributeSmelterBuild;
        } else if (block instanceof GenericCrafter) {
            base = GenericCrafter.GenericCrafterBuild;
        } else if (block instanceof BurstDrill) {
            base = BurstDrill.BurstDrillBuild;
        } else if (block instanceof BeamDrill) {
            base = BeamDrill.BeamDrillBuild;
        } else if (block instanceof Drill) {
            base = Drill.DrillBuild;
        } else if (block instanceof ImpactReactor) {
            base = ImpactReactor.ImpactReactorBuild;
        } else if (block instanceof NuclearReactor) {
            base = NuclearReactor.NuclearReactorBuild;
        } else {
            return;
        }

        block.buildType = () => {  
            return extend(base, block, {
                drawables: [
                    new EfficiencyLabel(),
                ],
                draw() {
                    let replaced = false;
                    for (let i = 0; i < this.drawables.length; i++) {
                        if (this.drawables[i].replace) {
                            replaced = true;
                            break;
                        }
                    }
                    if (!replaced) {
                        this.super$draw();
                    }
                    for (let i = 0; i < this.drawables.length; i++) {
                        this.drawables[i].draw(this);
                    }
                }
            });
        }
    });
});

//TODO does not work correctly for liquid
function countEfficiency(build) {
    const state = storage.get(build.id);
    const points = build.status().toString() == "active" ? 0.001 : 0;
    const currentTime = Time.time / 60 * 1000; // convert to milliseconds
    const timer = Core.settings.getInt("eui-EfficiencyTimer", 15);
    const millisecondTimer = timer * 1000;


    if (!state) {
        storage.set(build.id, {
            prevValue: 0,
            value: 0,
            time: currentTime,
            startTime: currentTime,
        });
        return 0;
    } else {
        const passed_time = currentTime - state.time;
        const startTime = state.startTime;
        
        if (currentTime - startTime > millisecondTimer) {
            state.prevValue = state.value;
            state.value = 0;
            state.startTime = currentTime;
            state.time = currentTime;
            return state.prevValue / timer;
        } else {
            const measurement = (currentTime - startTime) / millisecondTimer;

            state.value += passed_time * points;
            state.time = currentTime;

            let countedValue = state.value*measurement / (timer*measurement);
            let countedPrevValue = state.prevValue*(1 - measurement) / timer;
            return countedValue + countedPrevValue;
        }
    }
}
