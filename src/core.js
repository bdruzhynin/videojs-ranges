import videojs from 'video.js';
import Range from './components/range';

// Default options for the plugin.
const defaults = {
    ranges: []
};

export default class RangesCore {
    constructor(player, options) {
        this.player = player;
        this.settings = videojs.obj.merge(defaults, options);
        this.state = {ranges: {}, loop: {}};
        this.player.one("loadedmetadata", () => {
            this.initialize();
        });
    }

    initialize () {
        this.buildWrapper();
        this.addRanges(this.settings.ranges);
    }

    /**
     * Make sure that passed range exists, throw an error if not
     * @param {Range} range 
     */
    existsWithError (range) {
        let exists = this.exists(range);
        if (!exists) {
            this.player.log.error('Range doesn\'t exists', range);
        }
        return exists;
    }

    /**
     * Make sure that passed range exists
     * @param {Range} range 
     */
    exists (range) {
        return range.id_ && this.state.ranges[range.id_];
    }

    /**
     * Creates and render ranges wrapper
     */
    buildWrapper () {
        this.seekbar = this.player.controlBar
            .getChild('ProgressControl')
            .getChild('SeekBar');
        this.wrapper = this.seekbar.getChild('RangeWrapper');
        if (this.wrapper) {
            this.wrapper.el().remove();
        }
        this.wrapper = this.seekbar.addChild('RangeWrapper');
    }

    /**
     * Add ranges
     * @param {Range[] | Range} ranges 
     */
    addRanges (ranges) {
        ranges = [ranges].flat();
        for (const range of ranges) {
            try {
                let rangeEl = this.wrapper.addChild('Range', {core: this, range});
                this.state.ranges[rangeEl.id_] = rangeEl;
            } catch (error) {
                console.error(error);
            }
        }
    }

    /**
     * Remove passed ranges
     * @param {Range[] | Range} ranges 
     */
    removeRanges (ranges) {
        ranges = [ranges].flat();
        for (const range of ranges) {
            if (this.existsWithError(range)) {
                range.el().parentNode.removeChild(range.el());
                delete this.state.ranges[range.id_];
            } else {
            }
        }
    }

    /**
     * Loop video within specified range
     * @param {Range} range range too loop
     */
    addLoop (range) {
        if (this.existsWithError(range)) {
            const {start, end} = range;
            this.state.loop = {start, end};
            this.player.currentTime(this.state.loop.start);
            this.player.on('timeupdate', this.timeupdateHandler);
            this.player.on('seeking', this.seekingHandle);
            this.player.on('pause', this.unloop);
        }
    }

    /**
     * Video.js `timeupdate` event listener
     */
    timeupdateHandler () {
        const {start, end} = this.state.loop;
        if (this.player.currentTime() > end - .2) {
            this.player.currentTime(start);
        }
    }
    /**
     * Video.js `seeking` event listener
     */
    seekingHandle () {
        const {end} = this.state.loop;
        if (this.player.currentTime() > end - .2) {
            this.unloop();

        }
    }
    /**
     * Remove setted loop
     */
    unloop () {
        this.player.off('timeupdate', this.timeupdateHandler);
        this.player.off('seeking', this.seekingHandle);
        this.player.off('pause', this.unloop);
        this.state.loop = {};
    }
}