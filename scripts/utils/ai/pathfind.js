const debug = false;
let unpassebleTiles = [];
let jumpPassebleTiles = [];
let rotationBlockedTile = [];
let linearPassebleTiles = [];

if (debug) {
    Events.run(Trigger.draw, () => {
        Draw.draw(Layer.overlayUI+0.01, ()=>{
            Lines.stroke(1, Color.green);
            for (let tile of linearPassebleTiles) {
                Lines.circle(tile.x * 8, tile.y * 8, 1);
            }
            Lines.stroke(1, Color.blue);
            for (let tile of rotationBlockedTile) {
                Lines.circle(tile.x * 8, tile.y * 8, 1);
            }
            Lines.stroke(1, Color.yellow);
            for (let tile of jumpPassebleTiles) {
                Lines.circle(tile.x * 8, tile.y * 8, 1);
            }
            Lines.stroke(1, Color.red);
            for (let tile of unpassebleTiles) {
                Lines.circle(tile.x * 8, tile.y * 8, 1);
            }
            Draw.reset();
        });
    });
}

exports.conveyorPathfind = function (source, target, lastRotationTo, conveyor) {
    const placeable = (tile, rotationTo) => {
        return passable(tile, conveyor) && !tile.build && isNoTransportationContact(tile, conveyor);
        //(!tile.build || !isSameTransportationAxis(rotationTo, tile) && isPathClear(inverseRotation(rotationTo), tile));
    }
    const pathLinear = new PathLinear(conveyor, placeable);
    const pathRotation = new PathRotation(conveyor, placeable, 1);
    const pathJumps = [new PathJump(Blocks.itemBridge, 3, 4)]
    //, new PathJump(Blocks.phaseConveyor, 11, 10)];

    return pathfind(source, target, lastRotationTo, pathLinear, pathRotation, pathJumps);
}

exports.junctionPathfind = function (source, target, lastRotationTo, block) {
    const linearPlaceable = (tile, rotationTo) => {
        return passable(tile, block) && !tile.build;
    }
    const rotationPlaceable = (tile, rotationTo) => {
        return linearPlaceable(tile, rotationTo) && isNoTransportationContact(tile, block);
    }
    const pathLinear = new PathLinear(block, linearPlaceable);
    const pathRotation = new PathRotation(Blocks.underflowGate, rotationPlaceable, 1);
    const pathJumps = [new PathJump(Blocks.itemBridge, 3, 4)]
    // new PathJump(Blocks.phaseConveyor, 11, 10)];

    return pathfind(source, target, lastRotationTo, pathLinear, pathRotation, pathJumps);
}

exports.gatePathfind = function (source, target, lastRotationTo) {
    return exports.junctionPathfind(source, target, lastRotationTo, Blocks.junction);
}

function pathfind(source, target, lastRotationTo, pathLinear, pathRotation, pathJumps) {
    const blockedTilesMap = new Map();
    const tiles = blockPathfind(source, target, pathLinear, pathRotation, pathJumps, blockedTilesMap);
    if (!tiles) return [];

    const rotationsMap = makeRotationsMap(tiles);
    const jumpsMap = makeJumpsMap(tiles, blockedTilesMap, rotationsMap, pathJumps);
    global.eui.pm = blockedTilesMap;
    return planner(tiles, lastRotationTo, pathLinear, pathRotation, rotationsMap, jumpsMap);
}

function blockPathfind(source, target, pathLinear, pathRotation, pathJumps, unplacebleTilesJumps) {
    if (debug) {
        unpassebleTiles = [];
        jumpPassebleTiles = [];
        rotationBlockedTile = [];
        linearPassebleTiles = [];
    }
    if (!passable(target, pathLinear.block)) return null;

    const rotations = new Map();
    const distanceSourceTarget = Math.abs(source.centerX() - target.centerX()) + Math.abs(source.centerY() - target.centerY());
    const center = { x: (target.centerX() + source.centerX())/2, y: (target.centerY() + source.centerY())/2 };
    const R = distanceSourceTarget/2;
    const R2 = R*R;

    const tilesSeq = Astar.pathfind(source, target, {
        cost: function (from, tile) {
            const isCheckedBefore = rotations.has(tile.pos());
            if (isCheckedBefore) return 0;
            const rotationFrom = rotations.get(from.pos());
            const rotationTo = tile.relativeTo(from);
            const isPathRotated = rotationFrom != rotationTo;
            const passableTile = pathLinear.placeable(tile, rotationTo);
            let cost = 1;

            if (rotationFrom == inverseRotation(rotationTo)) return 0;

            rotations.set(tile.pos(), rotationTo);

            const fromPossibleJumps = unplacebleTilesJumps.get(from.pos());
            let jump;
            let minPathJump;
            if (fromPossibleJumps) {
                jump = fromPossibleJumps.find(jump => jump.direction == rotationTo);
                if (!jump) {
                    if (debug) unpassebleTiles.push(tile);
                    return 27145;
                }

                minPathJump = pathJumps.find(pathJump => pathJump.length >= jump.cost);
                if (!minPathJump) {
                    if (debug) unpassebleTiles.push(tile);
                    return 27145;
                }
            }

            if (isPathRotated && !pathRotation.placeable(from, rotationFrom)) {
                if (debug) {
                    rotationBlockedTile.push(tile);
                }
                return 1000;
            }
            
            if (!passableTile) {
                if (debug) jumpPassebleTiles.push(tile);

                let tilePossibleJumps = unplacebleTilesJumps.get(tile.pos());
                if (!tilePossibleJumps) tilePossibleJumps = [];

                if (!jump) {
                    jump = new PossibleJump(rotationTo, 1);
                    tilePossibleJumps.push(jump);
                } else {
                    tilePossibleJumps.push(new PossibleJump(rotationTo, jump.cost + 1));
                }
                
                unplacebleTilesJumps.set(tile.pos(), tilePossibleJumps);

                if (!minPathJump) {
                    cost += pathJumps[0].cost;
                } else {
                    cost += minPathJump.cost;
                }
            } else {
                if (debug) {
                    linearPassebleTiles.push(tile);
                }
            }

            if (isPathRotated) cost += pathRotation.cost;

            const ore = tile.overlay().itemDrop;
            if (ore) {
                cost += gerOreCost(ore);
            }

            return cost;
        }
    }, (tile) => {
        const dx = tile.centerX() - center.x;
        const dy = tile.centerY() - center.y;
        const inCircle = dx * dx + dy * dy < R2 + 49;
        if (inCircle) return true;

        return false;
    });

    const tiles = tilesSeq.removeAll((tile) => {
        return tile == null;
    }).toArray();

    if (tiles.length > 0) {
        const tmp = [];
        tmp.push(source);
        for (let i = 0; i < tiles.length; i++) {
            tmp.push(tiles[i]);
        }
        return tmp;
    }
    return null;
}

function planner(tiles, lastRotationTo, pathLinear, pathRotation, rotationsMap, jumpsMap) {
    const makePlan = (tile, block, rotation) => {
        return new BuildPlan(tile.x, tile.y, rotation || 0, block);
    }

    const plans = [];
    const last = tiles[tiles.length - 1];
    if (!last) return plans;

    let rotation;
    for (let i = 0; i < tiles.length - 1; i++) {
        let current = tiles[i];
        let prev = tiles[i - 1];
        let jump = jumpsMap.get(current.pos());
        rotation = rotationsMap.get(current.pos());
        let prevRotation = prev ? rotationsMap.get(prev.pos()) : -1;

        let buildPlan;
        if (jump) {
            if (typeof jump == "object") {
                let target = jump.target;
                let block = jump.pathJump.block;
                buildPlan = makePlan(current, block, rotation);

                if (target) {
                    buildPlan.config = new Point2(target.x - current.x, target.y - current.y);
                }

            }
        } else if (rotation != prevRotation) {
            buildPlan = makePlan(current, pathRotation.block, rotation);
        } else {
            buildPlan = makePlan(current, pathLinear.block, rotation);
        }

        if (buildPlan) plans.push(buildPlan);
    }

    let lastRotation = rotationsMap.get(last.pos());
    const lastRotationToBuild = lastRotationTo.build;
    if (lastRotationToBuild) {
        for (let i = 0; i < 4; i++) {
            let neighbour = last.nearby(i);

            if (neighbour.build != null && neighbour.build == lastRotationToBuild) {
                lastRotation = last.relativeTo(neighbour);
            }
        }
    }

    let lastPlan;
    if (jumpsMap.has(last.pos())) {
        lastPlan = makePlan(last, jumpsMap.get(last.pos()).pathJump.block, lastRotation);
    } else if (rotation != lastRotation && !pathLinear.block.rotate) {
        lastPlan = makePlan(last, pathRotation.block, lastRotation);
    } else {
        lastPlan = makePlan(last, pathLinear.block, lastRotation);
    }

    plans.push(lastPlan);
    return plans;
}

function PathLinear(block, placeable) {
    this.block = block;
    this.placeable = placeable;
}

function PathRotation(block, placeable, cost) {
    this.block = block;
    this.placeable = placeable;
    this.cost = cost;
}

function PathJump(block, length, cost) {
    this.block = block;
    this.length = length;
    this.cost = cost;
}

function PossibleJump(direction, cost) {
    this.direction = direction;
    this.cost = cost;
}

function makeRotationsMap(tiles) {
    const length = tiles.length;
    const rotationMap = new Map();
    for (let i = 0; i < length - 1; i++) {
        let current = tiles[i];
        let next = tiles[i + 1];
        let rotation = current.relativeTo(next);
        rotationMap.set(current.pos(), rotation);
    }

    const last = tiles[length - 1];
    const penultimate = tiles[length - 2];

    const lastRoration = penultimate ? rotationMap.get(penultimate.pos()) : 0;

    rotationMap.set(last.pos(), lastRoration);

    return rotationMap;
}

function makeJumpsMap(tiles, blockedTilesMap, rotationsMap, pathJumps) {
    const length = tiles.length;
    const jumpsMap = new Map();
    const tileblocked = (tile) => {
        if (!tile) return false;
        return blockedTilesMap.get(tile.pos()) && tile != tiles[length - 1];
    }
    for (let i = 0; i < length; i++) {
        if (!tileblocked(tiles[i+1])) continue;
        if (jumpsMap.has(tiles[i].pos())) continue;

        let j = i;
        let maxJumpSize = 0;
        let jumpSize = 0;
        let matchingTiles = [tiles[i]];

        do {
            j++;
            if (!tileblocked(tiles[j])) {
                matchingTiles.push(tiles[j]);
                if (maxJumpSize < jumpSize) maxJumpSize = jumpSize;
                jumpSize = 0;
            } else {
                jumpSize++;
                jumpsMap.set(tiles[j].pos(), 'overlap');
            }
        } while (tileblocked(tiles[j]) || tileblocked(tiles[j + 1]));

        let minPathJump = pathJumps.find(pj => pj.length >= maxJumpSize);
        if (!minPathJump) return jumpsMap;

        for (let muchTileIndex = 0; muchTileIndex < matchingTiles.length - 1; muchTileIndex++) {
            let muchTile = matchingTiles[muchTileIndex];
            let nextMuchTile = matchingTiles[muchTileIndex + 1];

            jumpsMap.set(muchTile.pos(), {target: nextMuchTile, pathJump: minPathJump});
            jumpsMap.set(nextMuchTile.pos(), {target: null, pathJump: minPathJump});
        }
    }
    return jumpsMap;
}

function inverseRotation(rotation) {
    return (rotation + 2) % 4;
}

function isPathClear(direction, tile) {
    let tilex = tile.x;
    let tiley = tile.y;
    tilex += directionToX(direction);
    tiley += directionToY(direction);
    let tile = Vars.world.tile(tilex, tiley);
    if (!tile.build && tile.passable()) return true;
    return false;
}

function directionToX(direction) {
    if (direction % 2 != 0) return 0;
    return direction == 0 ? 1 : -1;
}

function directionToY(direction) {
    if (direction % 2 == 0) return 0;
    return direction == 1 ? -1 : 1;
}

function isSameTransportationAxis(rotation, tile) {
    return rotation % 2 == tile.build.rotation % 2;
}

function passable(tile, block) {
    return tile.passable() && (tile.block() == block || (new BuildPlan(tile.centerX(), tile.centerY(), 0, block)).placeable(Vars.player.team()));
}

function isNoTransportationContact (tile, block) {
    return isNoContact(tile, block, block => {
        return (block.group == BlockGroup.drills ||
               (block.group == BlockGroup.transportation && !isLinearTransporter(block)) && !(block instanceof CoreBlock) ||
                block instanceof GenericCrafter);
    });
}

function isNoContact(tile, block, shouldAvoid) {
    let noContact = true;
    const edges = Edges.getEdges(block.size);
    edges.forEach(point2D => {
        let neighbour = Vars.world.tile(tile.x + point2D.x, tile.y + point2D.y);
        if (!neighbour) return;

        if (shouldAvoid(neighbour.block())) {
            noContact = false;
        }
    });
    return noContact;
}

function gerOreCost(ore) {
    return 1 + ore.hardness;
}

function isLinearTransporter(block) {
    return block == Blocks.conveyor ||
        block == Blocks.titaniumConveyor ||
        block == Blocks.armoredConveyor ||
        block == Blocks.plastaniumConveyor ||
        block == Blocks.junction ||
        block == Blocks.vault ||
        block == Blocks.container ||
        block == Blocks.conduit ||
        block == Blocks.pulseConduit ||
        block == Blocks.platedConduit;
}
