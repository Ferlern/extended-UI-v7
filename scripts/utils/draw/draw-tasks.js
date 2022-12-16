exports.divergingCircles = (x, y, parameters) => {
    if (!parameters) parameters = {};
    const maxRadius = parameters.maxRadius || 2000;
    const startRadius = parameters.startRadius || 0;
    const color = parameters.color;
    const growSpeed = parameters.growSpeed || 1;
    const circlesAmount = parameters.circlesAmount || 3;

    let radius = startRadius;
    let startTime = Time.time;
    tasks.push(() => {
        Draw.color(color);
        for (let i = 0; i < circlesAmount; i++) {
            if (color) {
                Drawf.circles(x, y, radius * (1 + 0.2*i), color);
            } else {
                Drawf.circles(x, y, radius * (1 + 0.2*i));
            }
        }
        radius += (Time.time - startTime) / 8 * growSpeed;
        if (radius > maxRadius) return true;
    });
}

const tasks = [];

Events.run(Trigger.draw, () => {
    Draw.draw(Layer.overlayUI+0.01, ()=>{
        for (let task of tasks) {
            if (task()) {
                const index = tasks.indexOf(task);
                if (index > -1) tasks.splice(index, 1);
            }
        }
    });
});
