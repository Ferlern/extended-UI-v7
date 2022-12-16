exports.BaseAlert = function(start, cancel) {
    this.enabled = false;
    this.start = () => {
        if (!this.enabled) start();
        this.enabled = true;
    }
    this.cancel = () => {
        if (this.enabled) cancel();
        this.enabled = false;
    }
    alerts.push(this);
}

const alerts = [];
let prevStatus = false;

Events.on(ClientLoadEvent, () => {
    Timer.schedule(update, 0, 1);
});

function update() {
    const status = Core.settings.getBool("eui-ShowAlerts", true);
    if (status != prevStatus) {
        if (status) {
            for (let i of alerts) i.start();
        } else {
            for (let i of alerts) i.cancel();
        }
        prevStatus = status;
    }
}
