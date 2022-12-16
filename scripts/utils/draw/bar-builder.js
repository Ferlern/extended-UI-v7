importPackage(Packages.arc.util.pooling);

const fontScale = 0.25 / Scl.scl(1.0);
const borderSize = 1;

exports.draw = function(drawX, drawY, value, targetSizeInBlocks, barSize, labelText, color, alpha) {
    if (!value) return;
    
    const blockPixelSize = targetSizeInBlocks*8;
    const startX = drawX - blockPixelSize/2 - barSize;
    const startY = drawY + blockPixelSize/2;
    const endY = startY + barSize;

    const barLenght = blockPixelSize + barSize*2;
    const innerBarLenght = barLenght - borderSize*2
    const barHeight = barSize;
    const innerBarHeight = barHeight - borderSize*2;

    const fillSize = (innerBarLenght) * value;

    Draw.z(Layer.darkness+1);

    Lines.stroke(borderSize, Pal.darkerGray);
    Draw.alpha(alpha);
    Lines.rect(startX, startY, barLenght, barHeight);

    Draw.color(color, alpha);
    Fill.rect(drawX - (innerBarLenght * (1 - value))/2, startY + barSize/2, fillSize, innerBarHeight);

    if (labelText) {
        exports.drawLabel(labelText, drawX, endY + 4, Color.white);
    }

    Draw.reset();
}

exports.buildPercentLabel = function(value) {
    return Math.round(value*100) + "%";
}

exports.buildValueLabel = function(value) {
    // might be useful in future
}

exports.drawLabel = function(text, x, y, color, useIntegerPositions) {
    const lay = Pools.obtain(GlyphLayout, prov(()=>{return new GlyphLayout()}));
    let font;

    //change font because outline works bad with integer position
    if (useIntegerPositions) {
        font = Fonts.def;
        font.setUseIntegerPositions(true);
    } else {
        font = Fonts.outline;
        font.setUseIntegerPositions(false);
    }

    font.getData().setScale(fontScale);
    
    lay.setText(font, text);

    font.setColor(color);
    font.draw(text, x - lay.width/2, y + lay.height/2);
    font.getData().setScale(1);

    Pools.free(lay);
}
