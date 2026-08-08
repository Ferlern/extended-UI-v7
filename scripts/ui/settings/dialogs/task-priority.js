const consumerConfig = require("extended-ui/interact/consumer-config");
const turretAmmoConfig = require("extended-ui/interact/turret-ammo-config");
const taskPriority = require("extended-ui/interact/task-priority");
const iconsUtil = require("extended-ui/utils/icons");
const helpers = require("extended-ui/ui/settings/helpers");
const resetHelpers = require("extended-ui/ui/settings/reset-helpers");

function build() {
    const dialog = new BaseDialog(Core.bundle.get("eui.task-priority.title"));
    dialog.addCloseButton();

    let listTable = null;

    helpers.addStandardReset(dialog, () => {
        resetHelpers.resetTaskPrioritySettings();
        rebuild();
    });

    dialog.cont.add(Core.bundle.get("eui.task-priority.hint")).width(580).wrap().pad(6).get().setAlignment(Align.center);
    dialog.cont.row();
    dialog.cont.pane(t => { listTable = t; t.top(); }).grow().maxHeight(560);

    function rebuild() {
        if (!listTable) return;
        listTable.clearChildren();

        listTable.add(Core.bundle.get("eui.task-priority.section-tasks")).left().colspan(5).pad(8);
        listTable.row();
        const tasks = taskPriority.TASKS.slice();
        tasks.sort((a, b) => taskPriority.get(b.id) - taskPriority.get(a.id));
        for (let i = 0; i < tasks.length; i++) {
            addTaskRow(listTable, tasks[i]);
        }

        listTable.add(Core.bundle.get("eui.task-priority.section-consumers")).left().colspan(5).pad(8).padTop(20);
        listTable.row();

        const byCategory = {};
        for (let i = 0; i < consumerConfig.CATEGORIES.length; i++) {
            byCategory[consumerConfig.CATEGORIES[i]] = [];
        }
        Vars.content.blocks().each(block => {
            try {
                if (block.isHidden()) return;
                if (!consumerConfig.consumesItems(block)) return;
                const cat = consumerConfig.categorize(block);
                byCategory[cat].push(block);
            } catch (e) {}
        });

        for (let i = 0; i < consumerConfig.CATEGORIES.length; i++) {
            const cat = consumerConfig.CATEGORIES[i];
            const blocks = byCategory[cat];
            if (blocks.length === 0) continue;
            blocks.sort((a, b) => {
                const pa = consumerConfig.getPriority(a);
                const pb = consumerConfig.getPriority(b);
                if (pa !== pb) return pb - pa;
                return a.id - b.id;
            });
            addCategoryHeader(listTable, cat, blocks);
            if (consumerConfig.isCategoryExpanded(cat)) {
                for (let j = 0; j < blocks.length; j++) {
                    addBlockRow(listTable, blocks[j]);
                }
            }
        }
    }

    function addTaskRow(parent, task) {
        parent.table(helpers.ROW_BG, row => {
            row.check("", taskPriority.isEnabled(task.id), v => {
                taskPriority.setEnabled(task.id, v);
            }).pad(4).tooltip(Core.bundle.get("eui.task-priority.enable-tooltip"));

            row.add(Core.bundle.get(task.bundleKey)).left().growX().width(320).pad(4);

            const fieldCell = row.field(taskPriority.get(task.id) + "", text => {
                const v = parseInt(text);
                if (!isNaN(v)) taskPriority.set(task.id, Math.max(0, Math.min(999, v)));
            });
            fieldCell.valid(text => /^\d+$/.test(text) && parseInt(text) <= 999);
            fieldCell.width(110).pad(4);
            const fieldElement = fieldCell.get();

            row.button(Icon.cancel, Styles.cleari, () => {
                taskPriority.reset(task.id);
                fieldElement.setText(task.defaultPriority + "");
            }).size(36).pad(4);
        }).growX().pad(4);
        parent.row();
        helpers.addRowSeparator(parent);
    }

    function addCategoryHeader(parent, category, blocks) {
        const expanded = consumerConfig.isCategoryExpanded(category);
        const label = (expanded ? "[ - ] " : "[ + ] ")
            + Core.bundle.get("eui.task-priority.cat-" + category)
            + " (" + blocks.length + ")";
        parent.button(label, Styles.cleart, () => {
            consumerConfig.setCategoryExpanded(category, !consumerConfig.isCategoryExpanded(category));
            rebuild();
        }).colspan(5).left().growX().pad(4);
        parent.row();
    }

    function addBlockRow(parent, block) {
        parent.table(helpers.ROW_BG, row => {
            row.image(iconsUtil.getByName(block.name)).size(28).pad(2).padLeft(20);

            row.check("", consumerConfig.isEnabled(block), v => {
                consumerConfig.setEnabled(block, v);
            }).pad(4);

            row.add(block.localizedName).left().growX().pad(4);

            const fieldCell = row.field(consumerConfig.getPriority(block) + "", text => {
                const v = parseInt(text);
                if (!isNaN(v)) consumerConfig.setPriority(block, Math.max(0, Math.min(consumerConfig.MAX_PRIORITY, v)));
            });
            fieldCell.valid(text => /^\d+$/.test(text) && parseInt(text) <= consumerConfig.MAX_PRIORITY);
            fieldCell.width(80).pad(4);

            if (block instanceof ItemTurret && block.ammoTypes && !block.ammoTypes.isEmpty()) {
                row.button(Icon.pencil, Styles.cleari, () => {
                    buildTurretAmmoDialog(block).show();
                }).size(36).pad(4).tooltip(Core.bundle.get("eui.turret-ammo.button-tooltip"));
            } else {
                row.add().size(36).pad(4);
            }
        }).growX().pad(4);
        parent.row();
        helpers.addRowSeparator(parent);
    }

    dialog.shown(() => rebuild());
    return dialog;
}

function buildTurretAmmoDialog(turretBlock) {
    const dialog = new BaseDialog(turretBlock.localizedName + " — " + Core.bundle.get("eui.turret-ammo.title"));
    dialog.addCloseButton();

    let listTable = null;
    dialog.cont.add(Core.bundle.get("eui.turret-ammo.hint")).width(580).wrap().pad(6).get().setAlignment(Align.center);
    dialog.cont.row();
    dialog.cont.pane(t => { listTable = t; t.top(); }).grow().maxHeight(540);

    function rebuild() {
        if (!listTable) return;
        listTable.clearChildren();

        const entries = [];
        turretBlock.ammoTypes.each((item, bullet) => {
            entries.push({ item: item, bullet: bullet });
        });
        entries.sort((a, b) => {
            const pa = turretAmmoConfig.getPriority(turretBlock, a.item);
            const pb = turretAmmoConfig.getPriority(turretBlock, b.item);
            if (pa !== pb) return pb - pa;
            const da = a.bullet.damage + a.bullet.splashDamage;
            const db = b.bullet.damage + b.bullet.splashDamage;
            return db - da;
        });

        for (let i = 0; i < entries.length; i++) {
            addRow(listTable, entries[i]);
        }
    }

    function addRow(parent, entry) {
        parent.table(helpers.ROW_BG, row => {
            row.image(iconsUtil.getByName(entry.item.name)).size(32).pad(4);

            row.check("", turretAmmoConfig.isEnabled(turretBlock, entry.item), v => {
                turretAmmoConfig.setEnabled(turretBlock, entry.item, v);
            }).pad(4);

            row.add(entry.item.localizedName).left().width(160).pad(4);

            const dmg = entry.bullet.damage + entry.bullet.splashDamage;
            row.label(() => Core.bundle.format("eui.turret-ammo.damage", Math.round(dmg))).pad(4);

            const fieldCell = row.field(turretAmmoConfig.getPriority(turretBlock, entry.item) + "", text => {
                const v = parseInt(text);
                if (!isNaN(v)) turretAmmoConfig.setPriority(turretBlock, entry.item, Math.max(0, Math.min(turretAmmoConfig.MAX_PRIORITY, v)));
            });
            fieldCell.valid(text => /^\d+$/.test(text) && parseInt(text) <= turretAmmoConfig.MAX_PRIORITY);
            fieldCell.width(80).pad(4);
        }).growX().pad(4);
        parent.row();
        helpers.addRowSeparator(parent);
    }

    dialog.shown(() => rebuild());
    return dialog;
}

exports.build = build;
