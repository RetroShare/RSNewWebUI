const m = require('mithril');

const Layout = () => {
    return{
        view: () => [
            m('.widget', [m('h2', 'Other Forums'), m('hr'), ])
        ]
    };
};

module.exports = Layout();
