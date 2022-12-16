exports.draw = function(plans) {
    Draw.draw(Layer.plans + 0.01, ()=>{
        const echable = new Eachable(plans);
        plans.forEach(plan => {
            plan.block.drawPlanRegion(plan, echable);
            plan.block.drawPlanConfigTop(plan, echable);
        });
    });
}

exports.drawOne = function(plan) {
    exports.draw([plan]);
}
