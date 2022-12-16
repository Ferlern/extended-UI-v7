// from https://github.com/Pointifix/EvictionToolkit/blob/main/MindustryToolkit/scripts/schematics.js

exports.create = function(x, y, x2, y2) {
    if (x == x2 && y == y2) return null;

    let ox = x, oy = y, ox2 = x2, oy2 = y2;

    let tiles = new Seq();

    let minx = x2, miny = y2, maxx = x, maxy = y;
    let found = false;
    for(let cx = x; cx <= x2; cx++){
        for(let cy = y; cy <= y2; cy++){
            let linked = Vars.world.build(cx, cy);
            let realBlock = linked == null ? null : linked instanceof ConstructBlock.ConstructBuild ? cons.current : linked.block;

            if(linked != null && realBlock != null && (realBlock.isVisible() || realBlock instanceof CoreBlock)){
                let top = realBlock.size/2;
                let bot = realBlock.size % 2 == 1 ? -realBlock.size/2 : -(realBlock.size - 1)/2;
                minx = Math.min(linked.tileX() + bot, minx);
                miny = Math.min(linked.tileY() + bot, miny);
                maxx = Math.max(linked.tileX() + top, maxx);
                maxy = Math.max(linked.tileY() + top, maxy);
                found = true;
            }
        }
    }

    if(found){
        x = minx;
        y = miny;
        x2 = maxx;
        y2 = maxy;
    }else{
        return new Schematic(new Seq(), new StringMap(), 1, 1);
    }

    let width = x2 - x + 1, height = y2 - y + 1;
    let offsetX = -x, offsetY = -y;
    let counted = new IntSet();
    for(let cx = ox; cx <= ox2; cx++){
        for(let cy = oy; cy <= oy2; cy++){
            let tile = Vars.world.build(cx, cy);
            let realBlock = tile == null ? null : tile instanceof ConstructBlock.ConstructBuild ? cons.current : tile.block;

            if(tile != null && !counted.contains(tile.pos()) && realBlock != null
                && (realBlock.isVisible() || realBlock instanceof CoreBlock)){
                let config = tile instanceof ConstructBlock.ConstructBuild ? cons.lastConfig : tile.config();

                try {
                    tiles.add(new Schematic.Stile(realBlock, tile.tileX() + offsetX, tile.tileY() + offsetY, config, tile.rotation));
                } catch (e) {
                    // is message neded? Sometimes it throws an error but error is not important
                }
                counted.add(tile.pos());
            }
        }
    }

    return new Schematic(tiles, new StringMap(), width, height);
}
