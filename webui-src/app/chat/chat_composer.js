const m = require('mithril');
const icon = require('icon');
const { Menu } = require('widgets');
const chatEmoji = require('chat/chat_emoji');
const { autoResizeTextarea } = require('chat/chat_state');

// -----------------------------------------------------------------------------
// The chat composer.
//
// One component for all three chat surfaces -- Network's direct chat, People's
// distant chat, and the Chat hub. They were three copies of the same ~170 lines:
// the same four tools, the same enter-to-send, the same paste-an-image handler,
// the same autosizing textarea. Changing the composer meant finding and editing
// all three, and they had already drifted -- different paddings, different
// radii, and in People's case a whole second palette written inline.
//
// Layout lives in scss/components/_chat-composer.scss. Nothing here sets style.
//
// attrs
//   value                the draft text
//   placeholder
//   disabled             tools and send are inert, e.g. while a tunnel opens
//   onInput(text)
//   onSend()
//   onAttachFile()       optional; omit and the paperclip is not rendered
//   onImage(file)        optional; omit and the image tool is not rendered
//   attachment           { dataUrl, name } or null
//   onRemoveAttachment()
//   onViewAttachment(dataUrl)
// -----------------------------------------------------------------------------

const ChatComposer = () => {
  let emojiOpen = false;

  //  Enter sends. Shift+Enter inserts a newline natively; Ctrl/Cmd+Enter has
  //  to insert one by hand, the browser does nothing with it in a textarea.
  //  execCommand keeps the undo stack; the splice is the fallback for the
  //  browsers that dropped it.
  const onKeyDown = (attrs) => (e) => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    if (e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const field = e.target;
      if (!document.execCommand || !document.execCommand('insertText', false, '\n')) {
        const start = field.selectionStart || 0;
        const end = field.selectionEnd || 0;
        const val = field.value;
        field.value = val.substring(0, start) + '\n' + val.substring(end);
        field.selectionStart = field.selectionEnd = start + 1;
      }
      attrs.onInput(field.value);
      autoResizeTextarea(field);
      return;
    }
    if (!attrs.disabled) attrs.onSend();
  };

  const onPaste = (attrs) => (e) => {
    if (!attrs.onImage) return;
    const items = (e.clipboardData || {}).items || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === -1) continue;
      e.preventDefault();
      attrs.onImage(items[i].getAsFile());
      return;
    }
  };

  const tool = (attrs, opts) => m('button.chat-composer__tool.chat-hub-action-btn[type=button]', {
    disabled: attrs.disabled,
    title: opts.title,
    'aria-label': opts.title,
    class: [opts.on ? 'is-on' : '', opts.class || ''].filter(Boolean).join(' '),
    'aria-pressed': opts.on === undefined ? undefined : String(opts.on),
    onclick: opts.onclick,
  }, icon(opts.icon));

  return {
    view: ({ attrs }) => [
      attrs.attachment && m('.chat-attachment-preview', [
        m('.chat-attachment-preview__item', [
          m('img.chat-attachment-preview__thumb', {
            src: attrs.attachment.dataUrl,
            alt: 'Preview',
            title: 'Click to view full image',
            onclick: () => attrs.onViewAttachment && attrs.onViewAttachment(attrs.attachment.dataUrl),
          }),
          m('button.chat-attachment-preview__remove[type=button]', {
            title: 'Remove image',
            onclick: () => attrs.onRemoveAttachment && attrs.onRemoveAttachment(),
          }, icon('times')),
        ]),
        m('.chat-attachment-preview__info', [
          m('span.chat-attachment-preview__name', attrs.attachment.name || 'Image attached'),
          m('span.chat-attachment-preview__hint', 'Will be sent with your message'),
        ]),
      ]),

      m('.chat-composer', [
        attrs.onAttachFile && m('button.chat-composer__tool.chat-composer__desktop-attach.chat-hub-action-btn[type=button]', {
          disabled: attrs.disabled,
          title: 'Attach file link',
          'aria-label': 'Attach file link',
          onclick: attrs.onAttachFile,
        }, icon('paperclip')),

        attrs.onImage && m('label.chat-composer__tool.chat-composer__desktop-attach.chat-hub-action-btn', {
          title: 'Send image',
          'aria-label': 'Send image',
          'aria-disabled': attrs.disabled ? 'true' : undefined,
        }, [
          icon('image'),
          m('input[type=file][accept=image/*].chat-composer__file', {
            disabled: attrs.disabled,
            onchange: (e) => {
              const file = e.target.files && e.target.files[0];
              if (file) attrs.onImage(file);
              e.target.value = '';
            },
          }),
        ]),

        (attrs.onAttachFile || attrs.onImage) && m(Menu, {
          class: 'chat-composer__attach',
          buttonClass: 'chat-composer__tool chat-composer__attach-button chat-hub-action-btn',
          title: 'Attach',
          mark: 'paperclip',
          align: 'start',
          up: true,
          disabled: attrs.disabled,
          items: [
            attrs.onImage && {
              label: 'Photo', icon: 'image', accept: 'image/*',
              disabled: attrs.disabled, onfile: attrs.onImage,
            },
            attrs.onAttachFile && {
              label: 'File link', icon: 'paperclip', disabled: attrs.disabled, onclick: attrs.onAttachFile,
            },
          ].filter(Boolean),
        }),

        m('.chat-composer__emoji', [
          tool(attrs, {
            icon: 'smile',
            title: 'Insert emoji',
            on: emojiOpen,
            onclick: (e) => {
              //  The picker ignores clicks that land inside itself; this stops
              //  the reopening click reaching its outside-click listener.
              e.stopPropagation();
              emojiOpen = !emojiOpen;
            },
          }),
          emojiOpen && m(chatEmoji.EmojiPicker, {
            onSelect: (emoji) => {
              attrs.onInput((attrs.value || '') + emoji);
              emojiOpen = false;
            },
            onClose: () => { emojiOpen = false; },
          }),
        ]),

        m('textarea.chat-composer__field[rows=1]', {
          'aria-label': attrs.label || 'Message',
          placeholder: attrs.placeholder || 'Type a message here...',
          enterkeyhint: 'send',
          value: attrs.value || '',
          disabled: attrs.disabled,
          oncreate: (v) => autoResizeTextarea(v.dom),
          onupdate: (v) => autoResizeTextarea(v.dom),
          oninput: (e) => {
            attrs.onInput(e.target.value);
            autoResizeTextarea(e.target);
          },
          onpaste: onPaste(attrs),
          onkeydown: onKeyDown(attrs),
        }),

        m('button.chat-composer__send.is-primary[type=button]', {
          'aria-label': 'Send message',
          title: 'Send message',
          disabled: attrs.disabled,
          onclick: () => attrs.onSend(),
        }, [icon('paper-plane'), m('span.btn-text', 'Send')]),
      ]),
    ],
  };
};

module.exports = { ChatComposer };
