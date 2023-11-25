import videojs from 'video.js';
import {v4 as uuid} from 'uuid';
import Events from '../events';

const Component = videojs.getComponent('Component');
const dom = videojs.dom;

const defaults = {
    name: 'Range',
    color: 'darkseagreen',
    editable: false,
    start: undefined,
    end: undefined,
    className: undefined,
};

/**
 * Some methods implemented as arrow function to preserv lexical context
 */
export default class Range extends Component {
    #core;
    constructor(player, {range, core}) {
        super(player, videojs.obj.merge(defaults, range, {id: uuid()}));
        const {start, end} = this.options_;
        if (start == undefined || end == undefined) {
            throw new Error('`start` and `end` is required');
        }

        if (start >= end) {
            throw new Error('`start` cannot be higher than `end`');
        }
        this.#core = core;
        this.seekbar = this.player_.controlBar
            .getChild('ProgressControl')
            .getChild('SeekBar');

        this.state = {
            currentDragObject: false,
            currentPlayerTime: false,
            pixelCorrection: 0,
            isPaused: false
        };
    }

    seconds (percent) {
        var duration = this.player_.duration();
        if (isNaN(duration)) {
            return 0;
        }
        return Math.min(duration, Math.max(0, percent * duration));
    }

    getPosition (time) {
        return (time / this.player_.duration()) * 100;
    }

    findPosition = (element) => {
        return element.getBoundingClientRect();
    }

    round = (n, precision) => {
        return parseFloat(n.toFixed(precision));
    }

    createEl () {
        const options = this.options_;
        const wrapper = dom.createEl('div', {className: `vr-range`, id: this.id_});

        if (options.className) {
            wrapper.classList.add(options.className);
        }

        if (options.name) {
            let nameWrapper = dom.createEl('div', {className: 'vr-range-text-name'});
            nameWrapper.innerHTML = options.name;
            dom.appendContent(wrapper, nameWrapper);
        }

        if (options.editable) {
            let start = dom.createEl('div', {className: 'vr-range-controll-start'}),
                end = dom.createEl('div', {className: 'vr-range-controll-end'});
            dom.appendContent(wrapper, start);
            dom.appendContent(wrapper, end);

            // Bind drag and drop events for edges of ranges
            this.registerDragndrop(wrapper, start, end);
            this.start = start;
            this.end = end;
        }

        this.wrapper = wrapper;
        this.applyStyles(wrapper);

        return wrapper;
    }

    applyStyles (wrapper) {
        const {color, start, end} = this.options_;
        let startPosition = this.getPosition(start),
            endPosition = this.getPosition(end),
            bodyWidth = endPosition - startPosition;

        wrapper.style.left = startPosition + '%';
        wrapper.style.width = bodyWidth + '%';
        wrapper.style.backgroundColor = color;
        wrapper.style.color = color;
        wrapper.style.borderColor = color;
    }

    registerDragndrop (wrapper, start, end) {
        wrapper.addEventListener('mousedown', event => this.dndRangeMouseDown(event, wrapper), false);
        end.addEventListener('mousedown', event => this.dndPointMouseDown(event, end), false);
        start.addEventListener('mousedown', event => this.dndPointMouseDown(event, start), false);
    }

    dndPointMouseMove = (event) => {
        event.stopPropagation();
        this.player_.currentTime(this.state.currentPlayerTime);
        this.changePointPosition(event);
    }

    dndPointMouseDown = (event, element) => {
        event.stopPropagation();
        this.state.currentDragObject = element;
        this.state.currentPlayerTime = this.player_.currentTime();
        if (!this.player_.paused()) {
            this.state.isPaused = true;
            this.player_.pause();
        }
        document.addEventListener("mousemove", this.dndPointMouseMove, false)
        document.addEventListener("mouseup", this.dndPointMouseUp, false)
        this.player_.trigger({type: Events.RANGE_START_MOVE, range: this});
    }

    dndPointMouseUp = (event) => {
        event.stopPropagation();
        if (this.state.isPaused) {
            this.player_.play();
            this.state.isPaused = false;
        }
        this.state.currentPlayerTime = false;
        this.state.currentDragObject = false;
        document.removeEventListener("mousemove", this.dndPointMouseMove, false)
        document.removeEventListener("mouseup", this.dndPointMouseUp, false)
        this.player_.trigger({type: Events.RANGE_MOVED, range: this});
    }

    dndRangeMouseMove = (event) => {
        event.stopPropagation();
        this.changeRangePosition(event);
        this.player_.trigger({type: Events.RANGE_MOVING, range: this});
    }

    dndRangeMouseDown = (event, element) => {
        this.state.currentDragObject = element;
        this.state.currentPlayerTime = this.player_.currentTime();
        this.state.pixelCorrection = event.pageX - this.findPosition(element).left;

        this.disablePlayerSeeking();

        if (!this.player_.paused()) {
            this.state.isPaused = true;
            this.player_.pause();
        }
        document.addEventListener("mousemove", this.dndRangeMouseMove, false)
        document.addEventListener("mouseup", this.dndRangeMouseUp, false);

        this.player_.trigger({type: Events.RANGE_START_MOVE, range: this});
    }

    dndRangeMouseUp = (event) => {
        this.enablePlayerSeeking();

        if (this.state.isPaused) {
            this.player_.play();
            this.state.isPaused = false;
        }

        this.state.currentPlayerTime = false;
        this.state.currentDragObject = false;
        this.state.pixelCorrection = false;

        document.removeEventListener("mousemove", this.dndRangeMouseMove, false)
        document.removeEventListener("mouseup", this.dndRangeMouseUp, false);
        this.player_.trigger({type: Events.RANGE_MOVED, range: this});
    }

    enablePlayerSeeking = () => {
        this.player_.off('seeking', this.seekingPreventDefault);
        this.player_.off('seeked', this.seekingPreventDefault);
    }
    disablePlayerSeeking = () => {
        this.player_.on('seeking', this.seekingPreventDefault);
        this.player_.on('seeked', this.seekingPreventDefault);
    }

    seekingPreventDefault = () => {
        this.player_.currentTime(this.state.currentPlayerTime);
    }

    calculateDistance = (event) => {
        var rangeBarWidth = this.seekbar.el().offsetWidth;
        var rangeBarLeft = this.findPosition(this.seekbar.el()).left;
        var pointerW = this.start.offsetWidth;

        // Adjusted X and Width, so handle doesn't go outside_end the bar
        rangeBarWidth = rangeBarWidth + (pointerW / 2);
        rangeBarLeft = rangeBarLeft - pointerW + this.state.pixelCorrection;

        // Percent that the click is through the adjusted area
        return Math.max(0, Math.min(1, (event.pageX - rangeBarLeft) / rangeBarWidth));
    };

    changePointPosition = (event) => {
        let {end, start} = this.options_,
            left = this.calculateDistance(event),
            endPosition = this.getPosition(end),
            startPosition = this.getPosition(start),
            pointType = this.state.currentDragObject === this.start ? 'start' : 'end';
        const {collision, collideWith} = this.checkPointsCollision(left, pointType)

        if (collision) { // Adjust point's position in case if user move mouse too fast
            let collisionRStart = this.getPosition(collideWith.options_.start),
                collisionREnd = this.getPosition(collideWith.options_.end)
            if (pointType == 'start') {
                if (this == collideWith) {
                    //change div position
                    this.wrapper.style.left = endPosition + '%';
                    this.wrapper.style.width = 0 + '%';
                    //Update state 
                    this.options_.start = this.round(this.seconds(endPosition / 100), 1);
                } else {
                    //change div position
                    let bodyWidth = endPosition - collisionREnd;
                    this.wrapper.style.left = collisionREnd + '%';
                    this.wrapper.style.width = bodyWidth + '%';
                    //Update state 
                    this.options_.start = this.round(this.seconds(collisionREnd / 100), 1);
                }
            }
            else if (pointType == 'end') {
                if (this == collideWith) {
                    // Change div position
                    this.wrapper.style.width = 0 + '%';
                    //Update state 
                    this.options_.end = this.round(this.seconds(startPosition / 100), 1);
                } else {
                    // Change div position
                    let bodyWidth = collisionRStart - startPosition;
                    this.wrapper.style.left = startPosition + '%';
                    this.wrapper.style.width = bodyWidth + '%';
                    //Update state 
                    this.options_.end = this.round(this.seconds(collisionRStart / 100), 1);
                }
            }
            return false;
        }

        if (pointType == 'start') { // Normal D'N'D behavior
            //change div position
            let bodyWidth = endPosition - left * 100;
            this.wrapper.style.left = left * 100 + '%';
            this.wrapper.style.width = bodyWidth + '%';
            //Update state 
            this.options_.start = this.round(this.seconds(left), 1)
        } else if (pointType == 'end') {
            // Change div position
            let bodyWidth = left * 100 - startPosition;
            this.wrapper.style.left = startPosition + '%';
            this.wrapper.style.width = bodyWidth + '%';
            //Update state 
            this.options_.end = this.round(this.seconds(left), 1)
        };
    };

    checkPointsCollision = (left, pointType) => {
        let sec = this.seconds(left),
            {start, end} = this.options_;
        for (const range of Object.values(this.#core.state.ranges)) {
            let el = range.options_;
            if (range !== this) {// Check collision with other ranges
                if ((el.start < sec && sec < el.end) || (pointType == 'start' && el.start >= sec && sec < el.end && el.start < end && end > el.end)) {// cover case when range cover another range with start point
                    return {collision: true, collideWith: range};
                }
                if (
                    (pointType == 'end' && el.start < sec && sec >= el.end && el.start > start && start < el.end) // cover case when range cover another range with end point
                ) {
                    return {collision: true, collideWith: range};

                }
            } else {
                if (// Check collision with itself
                    (pointType == 'end' && start > sec) || // Collision of range by himself with end point
                    (pointType == 'start' && end < sec) // Collision of range by himself with start point
                ) {
                    return {collision: true, collideWith: range};
                }
            }
        }
        return {collision: false, collideWith: false};
    }

    changeRangePosition = (event) => {
        let left = this.calculateDistance(event),
            timeRangeBody = this.options_.end - this.options_.start,
            {collision, collideWith, collisionType} = this.checkRangeCollision(left);

        if (collision) {
            switch (collideWith) {
                case 'outside_end': {
                    let rangeBodyPercent = this.getPosition(timeRangeBody);
                    this.wrapper.style.left = (100 - rangeBodyPercent) + '%';
                    this.options_.start = this.player_.duration() - timeRangeBody;
                    this.options_.end = this.player_.duration();
                    break;
                }
                case 'outside_start': {
                    this.wrapper.style.left = 0 + '%';
                    this.options_.start = 0;
                    this.options_.end = timeRangeBody;
                    break;
                }
                default: { // Collided with another range
                    let collisionRStart = this.getPosition(collideWith.options_.start),
                        collisionREnd = this.getPosition(collideWith.options_.end);
                    switch (collisionType) {
                        case 'tetos': {
                            this.wrapper.style.left = collisionREnd + '%';
                            this.options_.start = collideWith.options_.end;
                            this.options_.end = collideWith.options_.end + timeRangeBody;
                            break;
                        }
                        case 'tstoe': {
                            this.wrapper.style.left = (collisionRStart - this.getPosition(timeRangeBody)) + '%';
                            this.options_.start = collideWith.options_.start - timeRangeBody;
                            this.options_.end = collideWith.options_.start;
                            break;
                        }
                    }
                }
            }
            return false
        };

        // Change div position
        this.wrapper.style.left = left * 100 + '%';

        //Update state 
        this.options_.start = this.round(this.seconds(left), 1);
        this.options_.end = this.round((this.seconds(left) + timeRangeBody), 1);
    }

    checkRangeCollision = (left) => {
        let collision = false,
            collideWith = false,
            collisionType = false,
            currentStart = this.options_.start,
            currentEnd = this.options_.end,
            rangeWidth = currentEnd - currentStart,
            newStart = this.seconds(left),
            newEnd = this.seconds(left) + rangeWidth;

        for (const range of Object.values(this.#core.state.ranges)) {
            if (range !== this) {
                const {start, end} = range.options_;
                if (
                    (start < newStart && newStart < end || start < newEnd && newEnd < end) ||// cant be within some range
                    (start > newStart && newStart < end && start < newEnd && newEnd > end)   // cover case when range cover another range with start point
                ) {
                    collision = true;
                    collideWith = range;

                    if (start <= currentStart && end <= currentStart && start <= currentEnd && end <= currentEnd) {
                        collisionType = 'tetos' // collision type "Their End To Our Start"
                        collideWith = this.checkFutureCollisions(range, 'tetos');
                    } else if (start >= currentStart && end >= currentStart && start >= currentEnd && end >= currentEnd) {
                        collisionType = 'tstoe'// collision type "Their Start To Our End"
                        collideWith = this.checkFutureCollisions(range, 'tstoe');
                    }
                    break;
                }
            } else {
                if (newEnd > this.player_.duration()) { // Check if right edge of range outside;
                    collision = true;
                    collideWith = this.checkFutureCollisions(range, 'outside_end');
                    break;
                }
                if (newStart <= 0) {
                    collision = true;
                    collideWith = this.checkFutureCollisions(range, 'outside_start');
                    break;
                }
            }
        }
        return {collision, collideWith, collisionType};
    }

    /**
     * Check if there a cases of 2 ranges one by one and
     * @param {*} checkedRange 
     * @param {*} collisionType 
     * @returns 
     */
    checkFutureCollisions = (checkedRange, collisionType) => {
        let checktarget = checkedRange;

        if (collisionType == 'outside_start') {
            checktarget = 'outside_start';
        }

        if (collisionType == 'outside_end') {
            checktarget = 'outside_end';
        }

        let checkedRanges = [checkedRange],
            timeRangeBody = this.options_.end - this.options_.start;

        let recursion = (targetRange) => {

            let target = targetRange.options_;

            if (collisionType == 'tetos') {
                for (const range of Object.values(this.#core.state.ranges)) {
                    let ele = range.options_,
                        supposedEnd = el.end + timeRangeBody;
                    if (range !== this && !checkedRanges.includes(range)) {
                        if ((ele.start < supposedEnd && ele.end > supposedEnd) ||
                            (ele.start <= supposedEnd && ele.end < supposedEnd && ele.start > el.start && ele.end >= el.start)) {
                            checktarget = range;
                            checkedRanges.push(range);
                            recursion(range);
                            break;
                        }
                    }
                }
            }

            if (collisionType == 'tstoe') {
                for (const range of Object.values(this.#core.state.ranges)) {
                    let ele = range.options_,
                        supposedStart = el.start - timeRangeBody
                    if (range !== this && !checkedRanges.includes(range)) {
                        if ((ele.start < supposedStart && ele.end > supposedStart) ||
                            (ele.start >= supposedStart && ele.end > supposedStart && ele.start < el.start && ele.end <= el.start)) {
                            checktarget = range;
                            checkedRanges.push(range)
                            recursion(range);
                            break;
                        }
                    }
                }
            }

            if (collisionType == 'outside_end') {
                for (const range of Object.values(this.#core.state.ranges)) {
                    let ele = range.options_,
                        supposedStart = checktarget == 'outside_end' ? this.player_.duration() - timeRangeBody : checktarget.options_.start - timeRangeBody,
                        supposedEnd = checktarget == 'outside_end' ? this.player_.duration() : checktarget.options_.start;
                    if (range !== this && range !== targetRange && !checkedRanges.includes(range)) {
                        if ((ele.start < supposedStart && ele.end > supposedStart) ||
                            (ele.start >= supposedStart && ele.end > supposedStart && ele.start < supposedEnd && ele.end <= supposedEnd)) {
                            checktarget = range;
                            checkedRanges.push(range)
                            recursion(range);
                            break;
                        }
                    }
                }
            }

            if (collisionType == 'outside_start') {
                for (const range of Object.values(this.#core.state.ranges)) {
                    let ele = range.options_,
                        supposedEnd = timeRangeBody;
                    if (range !== this && !checkedRanges.includes(range)) {
                        if ((ele.start < supposedEnd && ele.end > supposedEnd) ||
                            (ele.start >= 0 && ele.end >= 0 && ele.start < supposedEnd && ele.end <= supposedEnd)
                        ) {
                            checktarget = range;
                            checkedRanges.push(range)
                            recursion(range);
                            break;
                        }
                    }
                }
            }
        }

        recursion(checkedRange);
        return checktarget;
    }
}
