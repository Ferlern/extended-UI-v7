exports.getAll = function() {
    return Object.assign({}, allIcons, allSprites);
}

exports.getIcons = function() {
    if (Object.keys(allIcons).length == 0) {
        Icon.icons.each((name, icon) => {
            allIcons[name] = new TextureRegionDrawable(icon);
        });
    }
    return allIcons;
}

exports.getSprites = function() {
    if (Object.keys(allSprites).length == 0) {
        setupSprites();
    }
    return allSprites;
}

exports.getUnitSprites = function() {
    if (spriteStorage.length == 0) setupSprites();
    return spriteStorage[2]; 
}

exports.getByName = function(name) {
    return exports.getIcons()[name] || exports.getSprites()[name] || new TextureRegionDrawable(Icon.pencil);
}

const spriteClasses = [Items, Liquids, UnitTypes, StatusEffects, Blocks]
const spriteStorage = [];
let allIcons = Object.create(null, {});
let allSprites = Object.create(null, {});

function setupSprites() {
    for (let spriteClass of spriteClasses) {
        let sprites = [];
        for (let key in spriteClass) {
            let item = spriteClass[key];
            if (!item || !item.uiIcon) continue;
            try {
                sprites[item.name] = new TextureRegionDrawable(item.uiIcon);
                allSprites[item.name] = new TextureRegionDrawable(item.uiIcon);
            } catch (e) {}
        }
        spriteStorage.push(sprites);
    }
}
