exports.find = function(fromTile, toTile, targetBlock, ingoreBlocks) {
    if (!fromTile.build) return fromTile;

    const stepAmount = targetBlock.size/2 + fromTile.block().size/2;
    const perimeterTiles = getPerimeterTiles(fromTile, stepAmount);

    let tile = null;
    let minDistance = Infinity;
    perimeterTiles.forEach((t) => {
        const vectorX = toTile.x - t.x;
        const vectorY = toTile.y - t.y;
        const distance = Mathf.dst(vectorX, vectorY);

        if (distance < minDistance) {
            if (!ingoreBlocks && !(new BuildPlan(t.centerX(), t.centerY(), 0, targetBlock).placeable(Vars.player.team()))) return;

            minDistance = distance;
            tile = t;
        }
    });

    return tile;
}

function getPerimeterTiles(tile, size) {
    const tiles = [];
    const x = tile.build.x/8;
    const y = tile.build.y/8;
    
    for (let i = -size; i <= size; i++) {
        for (let j = -size; j <= size; j++) {
            let xoffset = Math.abs(i);
            let yoffset = Math.abs(j);
            if (xoffset + yoffset >= size*2) continue;
            if (xoffset < size && yoffset < size) continue;
            tiles.push(Vars.world.tile(Math.floor(x + i), Math.floor(y + j)));
        }
    }

    return tiles;
}
