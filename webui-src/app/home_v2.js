const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const util = require('channels/channels_util');

const logo = () => {
  return {
    view() {
      return m('.logo', [
        m('img', {
          src: 'images/retroshare.svg',
          alt: 'retroshare_icon',
        }),
        m('.retroshareText', [
          m('.retrotext', [m('span', 'RETRO'), 'SHARE']),
          m('b', 'secure communication for everyone'),
        ]),
      ]);
    },
  };
};

const retroshareId = () => {
  return {
    view(v) {
      return m('.retroshareID', [
        m(
          'textarea[readonly].textArea',
          {
            id: 'retroId',
            placeholder: 'certificate',
            onclick: () => {
              document.getElementById('retroId').select();
            },
          },
          v.attrs.ownCert
        ),
        m('i.fas.fa-copy', {
          onclick: () => {
            document.getElementById('retroId').select();
            document.execCommand('copy');
          },
        }),
      ]);
    },
  };
};

const ChannelPostCard = () => {
  return {
    view: (v) => {
      const post = v.attrs.post;
      const channel = v.attrs.channel;
      const thumb = post.mThumbnail.mData.base64 === '' ? 'data/streaming.png' : 'data:image/png;base64,' + post.mThumbnail.mData.base64;
      return m('.channel-post-card', {
        onclick: () => {
          m.route.set('/channels/subscribed/' + channel.mGroupId + '/' + post.mMeta.mMsgId);
        },
      }, [
        m('.channel-post-card__thumb', m('img', { src: thumb, alt: post.mMeta.mMsgName })),
        m('.channel-post-card__info', [
          m('p.channel-post-card__title', post.mMeta.mMsgName),
          m('p.channel-post-card__channel', channel.name || 'Unknown Channel'),
          m('p.channel-post-card__date', new Date(post.mMeta.mPublishTs * 1000).toLocaleDateString()),
        ]),
      ]);
    },
  };
};

const ChannelCard = () => {
  return {
    view: (v) => {
      const ch = v.attrs.channel;
      const img = ch.image.mData.base64 === '' ? 'data/streaming.png' : 'data:image/png;base64,' + ch.image.mData.base64;
      return m('.channel-card', {
        onclick: () => m.route.set('/channels/subscribed/' + ch.mGroupId),
      }, [
        m('.channel-card__img', m('img', { src: img, alt: ch.name })),
        m('.channel-card__info', [
          m('p.channel-card__name', ch.name),
          m('p.channel-card__posts', (ch.posts || 0) + ' posts'),
        ]),
      ]);
    },
  };
};

const HomeV2 = () => {
  let ownCert = '';
  let latestPosts = [];
  let subscribedChannels = [];
  let loading = true;

  const loadData = () => {
    // Load own certificate
    rs.rsJsonApiRequest('/rsPeers/GetShortInvite', { formatRadix: true }, (data) => {
      ownCert = decodeURIComponent(data.invite).substring(34);
      m.redraw();
    });

    // Load channels
    rs.rsJsonApiRequest('/rsgxschannels/getChannelsSummaries', {}, (data) => {
      if (data && data.channels) {
        const channels = data.channels;
        // Get subscribed channels
        subscribedChannels = channels.filter((ch) => ch.mSubscribed);
        m.redraw();

        // Load display info for channels to get names and images
        subscribedChannels.slice(0, 6).forEach((ch) => {
          util.updatedisplaychannels(ch.mGroupId);
        });

        // Load latest posts from subscribed channels
        loadLatestPosts();
      }
    });
  };

  const loadLatestPosts = () => {
    const posts = [];
    let count = 0;
    // Collect posts from all subscribed channels (limit to 10)
    for (const chanId in util.Data.Posts) {
      const channelInfo = util.Data.DisplayChannels[chanId];
      if (!channelInfo || !channelInfo.isSubscribed) continue;
      const chanPosts = util.Data.Posts[chanId];
      for (const postId in chanPosts) {
        if (chanPosts[postId] && chanPosts[postId].post) {
          posts.push({
            post: chanPosts[postId].post,
            channel: channelInfo,
          });
          count++;
          if (count >= 10) break;
        }
      }
      if (count >= 10) break;
    }
    // Sort by publish time (newest first)
    posts.sort((a, b) => (b.post.mMeta.mPublishTs || 0) - (a.post.mMeta.mPublishTs || 0));
    latestPosts = posts;
    loading = false;
    m.redraw();
  };

  return {
    oninit: () => {
      loadData();
      // Refresh data periodically
      rs.setBackgroundTask(loadData, 30000, () => {});
    },
    view: () => {
      return m('.homepage-v2', [
        m(logo),
        m('.home-v2-content', [
          // Quick Access Row
          m('.home-v2-section', [
            m('h3', 'Quick Access'),
            m('.quick-access', [
              m('a.quick-access__item[href="/channels/subscribed"]', [
                m('i.fas.fa-tv'),
                m('span', 'My Channels'),
              ]),
              m('a.quick-access__item[href="/mail/inbox"]', [
                m('i.fas.fa-envelope'),
                m('span', 'Mail'),
              ]),
              m('a.quick-access__item[href="/people/MyContacts"]', [
                m('i.fas.fa-address-book'),
                m('span', 'Contacts'),
              ]),
              m('a.quick-access__item[href="/forums"]', [
                m('i.fas.fa-comments'),
                m('span', 'Forums'),
              ]),
            ]),
          ]),

          // My Channels
          m('.home-v2-section', [
            m('h3', 'My Channels'),
            m('.channel-grid', [
              subscribedChannels.length === 0
                ? m('p', 'No subscribed channels yet')
                : subscribedChannels.slice(0, 6).map((ch) =>
                    m(ChannelCard, { channel: util.Data.DisplayChannels[ch.mGroupId] || { name: ch.mGroupId, image: { mData: { base64: '' } }, mGroupId: ch.mGroupId } })
                  ),
            ]),
          ]),

          // Latest Channel Posts
          m('.home-v2-section', [
            m('h3', 'Latest from Channels'),
            loading
              ? m('p', 'Loading...')
              : m('.latest-posts', [
                  latestPosts.length === 0
                    ? m('p', 'No posts yet. Subscribe to channels to see content here.')
                    : latestPosts.map((item) =>
                        m(ChannelPostCard, { post: item.post, channel: item.channel })
                      ),
                ]),
          ]),

          // Your ID section
          m('.home-v2-section', [
            m('h3', 'Your Retroshare ID'),
            m('.rs-id-section', [
              ownCert
                ? m(retroshareId, { ownCert })
                : m('p', 'Loading your ID...'),
              m('p.help-text', 'Share this ID with friends to connect'),
            ]),
          ]),
        ]),
      ]);
    },
  };
};

const Layout = () => {
  return {
    view: () => m(HomeV2),
  };
};

module.exports = Layout;