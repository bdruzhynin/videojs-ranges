import videojs from 'video.js';

const Component = videojs.getComponent('Component');
const dom = videojs.dom;

export default class RangeWrapper extends Component {
    constructor(player, options) {
        super(player, options);
        this.options = options;
    }

    createEl () {
        let className = 'vr-control-wrapper';
        const wrapper = dom.createEl('div', {className});
        return wrapper;
    }
}
