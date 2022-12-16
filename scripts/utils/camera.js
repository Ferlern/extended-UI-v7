exports.isIn = function(x, y) {
    const camera = Core.camera;
    return (Math.abs(camera.position.x - x) < camera.width*0.5 && Math.abs(camera.position.y - y) < camera.height*0.5);
}
