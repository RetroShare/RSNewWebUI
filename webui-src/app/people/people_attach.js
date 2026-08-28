const m = require('mithril');
const rs = require('rswebui');
const { State, setChatDraft } = require('people/people_state');

//  Attaching a file means publishing it as an extra file and sending the
//  retroshare:// link the core answers with. What the paperclip used to do was
//  paste the path itself into the message, so the peer received "/home/me/x.iso"
//  and nothing else. The chat page does this properly; this is the same flow,
//  without its ChatHubState.
//
//  Hashing a large file takes minutes, so there is no deadline. The poll just
//  must not ask at full speed: it backs off from one second towards ten, each
//  request being a fresh connection since the JSON API answers Connection:close.
const HASH_POLL_START_MS = 1000;
const HASH_POLL_MAX_MS = 10000;

function pollHashStatus(localpath, delay = HASH_POLL_START_MS) {
  rs.rsJsonApiRequest('/rsFiles/ExtraFileStatus', { localpath }, (data) => {
    //  Cancelled, or another file started in the meantime: this chain lives in
    //  a setTimeout, not in a component, so it has to check for itself.
    if (!State.isHashing || State.attachPath !== localpath) return;

    const info = data && data.retval ? data.info : null;
    if (info && info.hash && info.hash !== '0000000000000000000000000000000000000000') {
      const size = info.size && typeof info.size === 'object'
        ? (info.size.xint64 || parseInt(info.size.xstr64) || 0)
        : Number(info.size) || 0;
      const link = `<a href="retroshare://file?name=${encodeURIComponent(info.name)}`
        + `&size=${size}&hash=${info.hash}">${info.name}</a> (${rs.formatBytes(size)})`;

      const draft = State.chatInputMsg || '';
      setChatDraft(draft ? draft + '\n' + link : link);
      stopAttachHash();
      m.redraw();
      return;
    }

    setTimeout(
      () => pollHashStatus(localpath, Math.min(delay * 2, HASH_POLL_MAX_MS)),
      delay
    );
  });
}

//  The core drops a file it failed to hash without a word -- ftExtraList only
//  records successes -- so a file that exists but cannot be read would leave
//  this polling for ever. Stopping must therefore always be possible.
function stopAttachHash() {
  State.isHashing = false;
  State.attachPath = '';
}

function startAttachHash(path) {
  const localpath = String(path || '').trim();
  if (!localpath) return;

  State.attachPath = localpath;
  State.isHashing = true;
  State.attachError = '';
  m.redraw();

  rs.rsJsonApiRequest(
    '/rsFiles/ExtraFileHash',
    { localpath, period: 86400 * 7, flags: 0 },
    (data, success) => {
      if (success && data && data.retval) {
        pollHashStatus(localpath);
        return;
      }
      stopAttachHash();
      State.attachError = 'Could not hash that file. Check the path — it is read on the RetroShare node, not in the browser.';
      m.redraw();
    }
  );
}

module.exports = { startAttachHash, stopAttachHash };
