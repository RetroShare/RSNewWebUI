const rs = require('rswebui');

//  Deleting a mail, whatever box it is in.
//
//  The core's MessageDelete searches the received, sent, trash and outgoing
//  boxes -- never the draft box (p3msgservice.cc, MessageDelete), so deleting
//  a draft by id fails and the draft stays. MessageToTrash does move drafts,
//  so a delete goes through the trash: move, then delete. Chained, not fired
//  together, or the delete can land first, fail, and leave the mail in Trash.
//  A mail already in Trash is not found by the move (harmless) and is found
//  by the delete.
function deleteMessage(msgId) {
  return rs.rsJsonApiRequest('/rsMail/MessageToTrash', { msgId, bTrash: true })
    .then(() => rs.rsJsonApiRequest('/rsMail/MessageDelete', { msgId }))
    .then((res) => Boolean(res && res.body && res.body.retval));
}

module.exports = { deleteMessage };
