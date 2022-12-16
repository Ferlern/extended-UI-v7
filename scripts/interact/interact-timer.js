let timer = 0;

Events.on(WorldLoadEvent, () => {
    timer = Time.time;
});

exports.increase = function() {
    timer = Time.time + Time.toSeconds * (Core.settings.getInt("eui-action-delay", 500) / 1000);
    timer += 0.01; // prevent overflow
}

exports.canInteract = function() {
    return Time.time >= timer;
}
