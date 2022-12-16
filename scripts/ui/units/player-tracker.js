exports.drawCursor = function(player) {
    //For Players who's set up don't show the system cursor properly, at all or for the hell of it
    if (player == Vars.player && !Core.settings.getBool("eui-ShowOwnCursor", false)) return;

    const unitX = player.x;
    const unitY = player.y;
    const cursorX = player.mouseX;
    const cursorY = player.mouseY;
    const style = Core.settings.getInt("eui-playerCursorStyle");
    const drawLine = () => {
        Lines.stroke(1, player.team().color);
        Draw.alpha(0.7);
        Lines.line(unitX, unitY, cursorX, cursorY);
        Draw.reset(); // it is necessary?
    }

    Draw.draw(Layer.overlayUI+0.01, () => {
        if (style == 1) { //square (Inspired from Mindustry Ranked Server's spectator mode )
            Drawf.square(cursorX, cursorY, 2, player.team().color);
        } else if (style == 2) { //square + line
            drawLine()
            Drawf.square(cursorX, cursorY, 2, player.team().color);
        } else if (style == 3) { //Circle
            Drawf.circles(cursorX, cursorY, 1, player.team().color);
        } else if (style == 4) { //Circle + line
            drawLine()
            Drawf.circles(cursorX, cursorY, 1, player.team().color);
        } else if (style == 5) { //Target
            Drawf.target(cursorX, cursorY, 3, player.team().color);
        } else if (style == 6) { // Target + Line
            drawLine()
            Drawf.target(cursorX, cursorY, 3, player.team().color);
        } else { //Line (original)
            drawLine()
        }
    });
    Draw.reset();
}