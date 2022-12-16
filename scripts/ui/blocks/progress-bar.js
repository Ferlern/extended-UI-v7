const settings = require("extended-ui/settings");
const barBuilder = require("extended-ui/utils/draw/bar-builder");


const factoryProgressBarSize = settings.factoryProgressBarSize;

function ProgressBar() {
    this.replace = false;
    this.draw = function(build) {
        if (!Core.settings.getBool("eui-showFactoryProgress", true)) return;
        if (build.currentPlan == -1) return;

        let progress = 0;

        if (build instanceof UnitFactory.UnitFactoryBuild) {
            progress = build.progress / build.block.plans.get(build.currentPlan).time;
        } else {
            progress = build.progress / build.block.constructTime;
        }

        let text = barBuilder.buildPercentLabel(progress);
        barBuilder.draw(
            build.x, build.y, progress, build.block.size, factoryProgressBarSize, text, build.team.color, 1
        )
    }
}

Events.on(ClientLoadEvent, event => {
    Vars.content.blocks().each((block) => {
        let base;
        
        if (block instanceof UnitFactory) {
            base = UnitFactory.UnitFactoryBuild;
        } else if (block instanceof Reconstructor) {
            base = Reconstructor.ReconstructorBuild;
        } else {
            return;
        }

        block.buildType = () => {  
            return extend(base, block, {
                drawables: [
                    new ProgressBar(),
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
