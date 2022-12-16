module.exports = function (countTimer, startValue, episodeDuration) {
    this.episodeDuration = episodeDuration || 1000;
    this.countTimer = countTimer;
    this.episodesAmount = countTimer / this.episodeDuration;
    this.prevDifference = 0;
    this.currentValue = startValue || 0;
    this.currentTime = Time.time / 60 * 1000; // convert to milliseconds

    this.difference = (value) => {
        const time = Time.time / 60 * 1000;
        const currentDifference = value - this.currentValue;

        if (time - this.currentTime > this.countTimer) {
            this.prevDifference = currentDifference;
            this.currentValue = value;
            this.currentTime = time;
            return this.prevDifference / this.episodesAmount;
        } else {
            const measurement = (time - this.currentTime) / this.countTimer;

            const countedDifference = currentDifference*measurement / this.episodesAmount;
            const countedPrevDifference = this.prevDifference*(1 - measurement) / this.episodesAmount;
            return countedDifference + countedPrevDifference;
        }
    }
}
