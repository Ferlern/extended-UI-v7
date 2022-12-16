importPackage(Packages.arc.util.pooling);

const fontScale = 0.25 / Scl.scl(1.0);

exports.draw = function(drawX, drawY, value, targetSizeInBlocks, barSize, labelText, color, alpha) {
    if (!value) return;
    
    const fillSize = barSize - 2;
    const indent = barSize/2;
    const blockPixelSize = targetSizeInBlocks*8;
    const startX = drawX - blockPixelSize/2 - barSize;
    const startY = drawY + blockPixelSize/2;
    const endY = startY + barSize;
    
    Draw.z(Layer.darkness+1);

    Lines.stroke(1, Pal.darkerGray);
    Draw.alpha(alpha);
    Lines.rect(startX, startY, blockPixelSize + barSize*2, barSize);
    Lines.stroke(fillSize, color);
    Draw.alpha(alpha);
    // TODO 0% Looked like it was already built by 2 points (because of Lines.stroke)
    Lines.line(startX + indent, startY + barSize/2, startX + indent + (blockPixelSize + barSize*2 - indent*2)*value, startY + barSize/2);

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
