const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');
const icon = require('icon');
const { State, startDirectChat, getOnlineSslId } = require('network/network_state');
const toast = require('toast');

function formatFingerprint(fingerprint) {
  return String(fingerprint || '')
    .replace(/\s/g, '')
    .match(/.{1,4}/g)
    ?.join(' ') || '';
}

function isUsableAddress(address) {
  const value = String(address || '').trim();
  return value !== '' && !value.toUpperCase().includes('INVALID') && value !== '0.0.0.0';
}

//  An entry of RsPeerDetails::ipAddressList is what sockaddr_storage_tostring()
//  produced -- ipv4://1.2.3.4:1234, or ipv6://[fe80::1]:1234 since RsUrl wraps
//  IPv6 hosts in brackets -- followed by the core's own marker, "    123 sec
//  loc" or "    123 sec ext" (p3peers.cc, getPeerDetails).
//
//  That marker is the answer to "local or external", and it is worth more than
//  deducing it from the address range: a peer behind CGNAT (100.64/10) or a
//  double NAT has a private looking external address, and a loopback entry is
//  not external at all.
//
//  One entry carries no marker: GetRetroshareInvite() clears extAddr and pushes
//  the address here with a trailing space when it is IPv6, because the
//  certificate format only carries IPv4 numbers. It is external by construction
//  -- and it is exactly the one a peer added by short invite arrives with.
function parseLocator(entry) {
  const text = String(entry || '');
  const match = text.match(/^\s*(?:ipv4|ipv6):\/\/(\[[^\]]+\]|[^:/\s]+):(\d+)/i);
  if (!match) return null;
  //  RsUrl escapes the % of a link-local scope id as %25, as the RFC asks; put
  //  it back rather than showing fe80::1%25eth0 to a human.
  const host = (match[1].startsWith('[') ? match[1].slice(1, -1) : match[1]).replace(/%25/gi, '%');
  return {
    address: host,
    port: Number(match[2]),
    scope: /\bsec\s+loc\b/i.test(text) ? 'local' : 'external',
  };
}

function displayedAddresses(detail, knownAddresses) {
  const locators = knownAddresses.map(parseLocator).filter(Boolean);
  const localLocator = locators.find((locator) => locator.scope === 'local');
  const externalLocator = locators.find((locator) => locator.scope === 'external');

  return {
    localAddress: isUsableAddress(detail.localAddr) ? detail.localAddr : localLocator && localLocator.address,
    localPort: Number(detail.localPort) > 0 ? detail.localPort : localLocator && localLocator.port,
    externalAddress: isUsableAddress(detail.extAddr) ? detail.extAddr : externalLocator && externalLocator.address,
    externalPort: Number(detail.extPort) > 0 ? detail.extPort : externalLocator && externalLocator.port,
  };
}

const confirmRemove = (gpgId) => widget.confirmMessage({
  title: 'Remove Friend',
  message: 'Are you sure you want to end connections with this node?',
  confirmLabel: 'Remove friend',
  danger: true,
  onConfirm: async () => {
    //  Drop the placeholder first: refreshGpgDetails() re-injects any
    //  remembered friend the core does not return, so removing one added
    //  by short ID would otherwise put it straight back in the list.
    Data.forgetPendingFriend(gpgId);
    //  And wait for the removal before asking for the list again, or the
    //  refresh races the core and shows the friend as still there.
    await rs.rsJsonApiRequest('/rsPeers/removeFriend', { pgpId: gpgId });
    State.selectedFriendGpgId = null;
    await Data.refreshGpgDetails({ force: true });
    m.redraw();
    toast.info('Friend removed successfully.');
  },
});

//  Version and short invite of a node do not change while the web UI is open,
//  and the dialog is reopened often. Cached by node id so that reopening it
//  paints filled in, instead of showing "Loading..." and asking the core again.
const locationDetailsCache = {};

const LocationDetails = () => {
  let activeTab = 'details';
  let version = 'Loading...';
  let retroshareId = 'Loading...';

  return {
    oninit: (vnode) => {
      const nodeId = vnode.attrs.loc.id;
      const cached = locationDetailsCache[nodeId];
      if (cached) {
        version = cached.version;
        retroshareId = cached.retroshareId;
        return;
      }
      locationDetailsCache[nodeId] = { version, retroshareId };

      //  rsJsonApiRequest never rejects: it resolves undefined when the request
      //  fails, so the failure has to be read off the resolved value rather than
      //  waited for in a catch.
      rs.rsJsonApiRequest('/rsGossipDiscovery/getPeerVersion', { id: nodeId })
        .then((response) => {
          version = response && response.body && response.body.retval
            ? response.body.version || 'Unknown'
            : 'Unavailable';
          locationDetailsCache[nodeId].version = version;
          m.redraw();
        });
      rs.rsJsonApiRequest('/rsPeers/getShortInvite', { sslId: nodeId })
        .then((response) => {
          retroshareId = response && response.body && response.body.retval
            ? rs.cleanRetroshareId(response.body.invite) || 'Unavailable'
            : 'Unavailable';
          locationDetailsCache[nodeId].retroshareId = retroshareId;
          m.redraw();
        });
    },
    view: (vnode) => {
      const loc = vnode.attrs.loc;
      const detail = loc.peerDetails || {};
      const status = Data.getStatusPresentation(loc.statusValue, loc.isOnline);
      const knownAddresses = detail.ipAddressList || [];
      const addresses = displayedAddresses(detail, knownAddresses);
      const infoRow = (label, value) => [
        m('.info-label', label),
        m('.info-value', value || 'None'),
      ];

      const detailContent = m('.info-grid', [
        infoRow('Profile', `${detail.name || 'Unknown'} (${loc.gpg_id})`),
        infoRow('Node ID', loc.id),
        infoRow('Node Name', loc.name),
        infoRow('Status', status.label),
        infoRow('Connection', detail.connectStateString || status.label),
        infoRow('Last Contact', new Date(loc.lastSeen * 1000).toLocaleString()),
        infoRow('RetroShare Version', version),
        infoRow('Status Message', loc.customState || 'None'),
      ]);
      const connectivityContent = [
        m('.info-grid', detail.isHiddenNode ? [
          infoRow('Hidden Address', detail.hiddenNodeAddress),
          infoRow('Port', detail.hiddenNodePort),
        ] : [
          infoRow('Local Address', addresses.localAddress),
          infoRow('Local Port', addresses.localPort),
          infoRow('External Address', addresses.externalAddress),
          infoRow('External Port', addresses.externalPort),
          infoRow('Dynamic DNS', detail.dyndns),
        ]),
        m('h4', `Known Addresses (${knownAddresses.length})`),
        knownAddresses.length
          ? m('pre.known-addresses-list', knownAddresses.join('\n'))
          : m('p', 'No address history available.'),
      ];
      const tabs = [
        ['details', 'Details'],
        ['connectivity', 'Connectivity'],
        ['retroshare-id', 'RetroShare ID'],
      ];

      return m('.location-details-dialog', [
        m(widget.Segmented, {
          variant: 'underline',
          class: 'location-detail-tabs',
          ariaLabel: 'Location details',
          value: activeTab,
          options: tabs.map(([id, label]) => ({ id, label })),
          onSelect: (id) => (activeTab = id),
        }),
        m('.location-detail-content',
          activeTab === 'details'
            ? detailContent
            : activeTab === 'connectivity'
              ? connectivityContent
              : m('pre.retroshare-id-text', retroshareId)
        ),
      ]);
    },
  };
};

const DetailsTab = () => {
  return {
    view: () => {
      const gpgId = State.selectedFriendGpgId;
      const friend = Data.gpgDetails[gpgId];
      if (!friend) return null;

      const friendGxsId = State.gpgToGxsIdMap[gpgId.toLowerCase()];
      const status = friend.pendingValidation
        ? { label: 'Pending validation', color: 'var(--warn-ink)' }
        : Data.getStatusPresentation(friend.statusValue, friend.isOnline);
      const fingerprint = formatFingerprint(friend.fingerprint);

      return m('.network-detail-view', [
        m('.detail-header', [
          m('.friend-avatar', m(peopleUtil.UserAvatar, {
            avatar: friend.avatar ? { mData: { base64: friend.avatar } } : undefined,
            firstLetter: (friend.name || '?').slice(0, 1).toUpperCase(),
            size: 128,
            seed: gpgId,
          })),
          m('.detail-title', [
            m('h2', friend.name),
            m('.detail-subtitle', [
              icon('fingerprint'),
              m('span', 'GPG ID: ' + gpgId),
            ]),
            m('.detail-actions', [
              m('button.is-primary',
                {
                  onclick: () => {
                    const sslId = getOnlineSslId(gpgId);
                    if (sslId) {
                      State.activeTab = 'chat';
                      startDirectChat(sslId);
                    }
                  },
                },
                [icon('comments'), m('span.btn-text', ' Start Chat')]
              ),
              m('button.is-primary',
                {
                  onclick: () => {
                    State.showMailCompose = true;
                  },
                },
                [icon('envelope'), m('span.btn-text', ' Send Mail')]
              ),
            ]),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Profile Info'),
          m('.info-grid', [
            m('.info-label', 'Status'),
            m(
              '.info-value',
              { class: 'detail-status-label', style: { color: status.color } },
              status.label
            ),
            m('.info-label', 'Custom Status'),
            m(
              '.info-value',
              { class: 'detail-custom-status' },
              friend.customState || 'None'
            ),
            friendGxsId ? [
              m('.info-label', 'GXS Identity'),
              m('.info-value', friendGxsId),
            ] : null,
            m('.info-label', 'Node GPG Key'),
            m('.info-value', gpgId),
            m('.info-label', 'PGP Fingerprint'),
            m('.info-value', fingerprint || 'Unavailable'),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Locations (' + friend.locations.length + ')'),
          m(
            '.locations-grid',
            friend.locations
              .slice()
              .sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1))
              .map((loc) => {
              const locStatus = Data.getStatusPresentation(loc.statusValue, loc.isOnline);
              return m('.location-card', { key: loc.id }, [
                m('.loc-header', [
                  m('.loc-name', loc.name),
                  m(
                    '.loc-status',
                    { style: { color: locStatus.color } },
                    locStatus.label
                  ),
                ]),
                m('.loc-body', [
                  m('.loc-label', 'SSL ID'),
                  m('.loc-val', loc.id),
                  m('.loc-label', 'Last Seen'),
                  m('.loc-val', new Date(loc.lastSeen * 1000).toLocaleString()),
                ]),
                m('.loc-footer', [
                  m(
                    'button.is-sm',
                    {
                      onclick: () => widget.popupMessage(
                        m(LocationDetails, { loc }),
                        'location-details-modal',
                        {
                          title: loc.name || 'Location Details',
                          lead: friend.name ? `A location of ${friend.name}.` : undefined,
                        }
                      ),
                    },
                    [icon('info-circle'), 'View Details']
                  ),
                  m(
                    'button.red.is-sm',
                    {
                      onclick: () =>
                        confirmRemove(loc.gpg_id),
                    }, [icon('trash'), 'Remove Location']),
                ]),
              ]);
            })
          ),
        ]),
      ]);
    },
  };
};

module.exports = DetailsTab;
