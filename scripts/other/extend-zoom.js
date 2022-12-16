let minZoom = 0.5;
let maxZoom = 25;

function setZoom(min, max) {
    Vars.renderer.minZoom = min;
    Vars.renderer.maxZoom = max;
}

Events.run(Trigger.update, () => {
    //TODO convert to linear scale
    const newMinZoom = 2.5 - Core.settings.getInt("eui-maxZoom", 10)/5;

    if (newMinZoom != minZoom) {
        setZoom(newMinZoom, maxZoom);
        minZoom = newMinZoom;
    }
});

setZoom(minZoom, maxZoom);
