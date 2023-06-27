const m = require('mithril');

const Appearance = () => {
  let rsBaseFontSize =
    localStorage.getItem('rsBaseFontSize') ||
    window.getComputedStyle(document.body).getPropertyValue('font-size');
  return {
    view: () =>
      m('.widget', [
        m('.widget__heading', m('h3', 'Appearance')),
        m('.widget__body', [
          m('.set-font', [
            m('h3', 'Set font size'),
            m('.set-font__slider', [
              m('div.set-font__slider-scale', [
                m('p', '12px'),
                m('p', '14px'),
                m('p', '16px'),
                m('p', '18px'),
                m('p', '20px'),
              ]),
              m('input[type=range][min=1][max=5]', {
                value: (rsBaseFontSize.substring(0, rsBaseFontSize.length - 2) - 10) / 2,
                oninput: (e) => (rsBaseFontSize = `${10 + e.target.value * 2}px`),
                onchange: () => {
                  document.documentElement.style.fontSize = rsBaseFontSize;
                  localStorage.setItem('rsBaseFontSize', rsBaseFontSize);
                },
              }),
            ]),
          ]),
        ]),
      ]),
  };
};
module.exports = Appearance;
