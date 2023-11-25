import videojs from 'video.js';
import RangesCore from './core';
import Range from './components/range';
import RangeWrapper from './components/wrapper';
import {version as VERSION} from '../package.json';

const Plugin = videojs.getPlugin('plugin');

class RangesPlugin extends Plugin {
  #core;
  /**
   * Create a Ranges plugin instance.
   *
   * @param  {Player} player
   *         A Video.js Player instance.
   *
   * @param  {Object} [options]
   *         An optional options object.
   *
   *         While not a core part of the Video.js plugin architecture, a
   *         second argument of options is a convenient way to accept inputs
   *         from your plugin's caller.
   */
  constructor(player, options) {
    super(player, options);
    this.#core = new RangesCore(player, options);
  }

  /**
   * Return list of all added ranges
   * @returns {Range[]} array of ranges
   */
  getRanges () {
    return Object.values(this.#core.state.ranges);
  }

  /**
   * Roll video forward to next range and return it
   * @returns {Range} next range
   */
  next () {
    const currentTime = this.player.currentTime();
    const ranges = this.getRanges().sort((a, b) => {
      return (a.start < b.start && a.start < b.end && a.end < b.start && a.end < b.end) ? -1 : 1;
    });
    for (const range of ranges) {
      if (range.start > currentTime) {
        this.player.currentTime(range.start);
        return range;
      }
    }
  }

  /**
   * Roll video back to previous range and return it
   * @returns {Range} previous range
   */
  prev () {
    const currentTime = this.player.currentTime();
    const ranges = this.getRanges().sort((a, b) => {
      return (a.start < b.start && a.start < b.end && a.end < b.start && a.end < b.end) ? -1 : 1;
    }).reverse();
    for (const range of ranges) {
      if (range.start + 0.5 < currentTime) {
        // .5 sec allow to hit prev multiple time and not stuck with 1 range
        this.player.currentTime(range.start);
        return range;
      }
    }
  }

  /**
   * Remove range
   * @param {Range[] | Range} ranges 
   */
  remove (ranges) {
    // remove markers given an array of index
    this.#core.removeRanges(ranges);
  }

  /**
   * Remove all ranges
   */
  removeAll () {
    const ranges = this.getRanges();
    this.#core.removeRanges(ranges);
  }

  /**
   * Add new range
   * @param {Range} range range to add
   */
  add (range) {
    return this.#core.addRanges(range);
  }

  /**
   * Reset plugin
   */
  reset () {
    // remove all the existing ranges
    this.removeAll();
    this.#core.addRanges(setting.ranges);
  }

  goto (rangeKeys) {
    let sortedRanges = Object.values(rangesState).sort((a, b) => {
      return (a.start < b.start && a.start < b.end && a.end < b.start && a.end < b.end) ? -1 : 1;
    })
    if (rangeKeys == 'first') {
      player.currentTime(sortedRanges[0].start);
    }
    if (rangeKeys == 'last') {
      sortedRanges.reverse();
      player.currentTime(sortedRanges[0].start);
    }
    if (typeof rangeKeys === 'string' && rangesState.hasOwnProperty(rangeKeys)) {
      player.currentTime(rangesState[rangeKeys].start);
    }
  }

  /**
   * Loop range
   * @param {Range} range 
   * @returns 
   */
  loop (range) {
    this.#core.addLoop(range);
  }

  /**
   * Remove setted loop range
   * @param {*} event 
   */
  unloop () {
    this.#core.unloop();
  }
}

// Include the version number.
RangesPlugin.VERSION = VERSION;

// Register the plugin with video.js.
videojs.registerComponent('RangeWrapper', RangeWrapper);
videojs.registerComponent('Range', Range);
videojs.registerPlugin('ranges', RangesPlugin);

export default RangesPlugin;
