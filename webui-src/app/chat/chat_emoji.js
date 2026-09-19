const m = require('mithril');
const widget = require('widgets');

const EMOJI_CATEGORIES = ['Smileys', 'People', 'Animals', 'Food', 'Travel', 'Activities', 'Objects', 'Symbols'];
const EMOJI_ICONS = {
  Smileys: '😊', People: '👥', Animals: '🐾', Food: '🍎',
  Travel: '✈️', Activities: '⚽', Objects: '💡', Symbols: '❤️',
};
//  Generated from Python's Unicode database (unicodedata, Unicode 16) --
//  offline, no dependency. Categories follow the Unicode blocks, which is
//  what the eight buttons in the picker already mean.
const EMOJI_DATA = {
  Smileys: [
    '😀', '😁', '😂', '😃', '😄', '😅', '😆', '😇', '😈', '😉', '😊', '😋', '😌', '😍', '😎', '😏', '😐', '😑',
    '😒', '😓', '😔', '😕', '😖', '😗', '😘', '😙', '😚', '😛', '😜', '😝', '😞', '😟', '😠', '😡', '😢', '😣',
    '😤', '😥', '😦', '😧', '😨', '😩', '😪', '😫', '😬', '😭', '😮', '😯', '😰', '😱', '😲', '😳', '😴', '😵',
    '😶', '😷', '😸', '😹', '😺', '😻', '😼', '😽', '😾', '😿', '🙀', '🙁', '🙂', '🙃', '🙄', '🙅', '🙆', '🙇',
    '🙈', '🙉', '🙊', '🙋', '🙌', '🙍', '🙎', '🙏', '🤐', '🤑', '🤒', '🤓', '🤔', '🤕', '🤖', '🤗', '🤘', '🤙',
    '🤚', '🤛', '🤜', '🤝', '🤞', '🤟', '🤠', '🤡', '🤢', '🤣', '🤤', '🤥', '🤦', '🤧', '🤨', '🤩', '🤪', '🤫',
    '🤬', '🤭', '🤮', '🤯', '🥰', '🥱', '🥲', '🥳', '🥴', '🥵', '🥶', '🥷', '🥸', '🥹', '🥺', '🧐', '🫠', '🫡',
    '🫢', '🫣', '🫤', '🫥', '🫦', '🫧', '🫨',
  ],
  People: [
    '👀', '👁', '👂', '👃', '👄', '👅', '👆', '👇', '👈', '👉', '👊', '👋', '👌', '👍', '👎', '👏', '👐', '👤',
    '👥', '👦', '👧', '👨', '👩', '👪', '👫', '👬', '👭', '👮', '👯', '👰', '👱', '👲', '👳', '👴', '👵', '👶',
    '👷', '👸', '👹', '👺', '👻', '👼', '👽', '👾', '👿', '💀', '💁', '💂', '💃', '💄', '💅', '💆', '💇', '🤰',
    '🤱', '🤲', '🤳', '🤴', '🤵', '🤶', '🤷', '🦴', '🦵', '🦶', '🦷', '🦸', '🦹', '🦺', '🦻', '🧍', '🧎', '🧏',
    '🧑', '🧒', '🧓', '🧔', '🧕', '🧖', '🧗', '🧘', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '🫰', '🫱', '🫲',
    '🫳', '🫴', '🫵', '🫶', '🫷', '🫸', '✊', '✋',
  ],
  Animals: [
    '🐀', '🐁', '🐂', '🐃', '🐄', '🐅', '🐆', '🐇', '🐈', '🐉', '🐊', '🐋', '🐌', '🐍', '🐎', '🐏', '🐐', '🐑',
    '🐒', '🐓', '🐔', '🐕', '🐖', '🐗', '🐘', '🐙', '🐚', '🐛', '🐜', '🐝', '🐞', '🐟', '🐠', '🐡', '🐢', '🐣',
    '🐤', '🐥', '🐦', '🐧', '🐨', '🐩', '🐪', '🐫', '🐬', '🐭', '🐮', '🐯', '🐰', '🐱', '🐲', '🐳', '🐴', '🐵',
    '🐶', '🐷', '🐸', '🐹', '🐺', '🐻', '🐼', '🐽', '🐾', '🐿', '🦀', '🦁', '🦂', '🦃', '🦄', '🦅', '🦆', '🦇',
    '🦈', '🦉', '🦊', '🦋', '🦌', '🦍', '🦎', '🦏', '🦐', '🦑', '🦒', '🦓', '🦔', '🦕', '🦖', '🦗', '🦘', '🦙',
    '🦚', '🦛', '🦜', '🦝', '🦞', '🦟', '🦠', '🦡', '🦢', '🦣', '🦤', '🦥', '🦦', '🦧', '🦨', '🦩', '🦪', '🦫',
    '🦬', '🦭', '🦮', '🌷', '🌸', '🌹', '🌺', '🌻', '🌼', '🌽', '🌾', '🌿', '🍀', '🍁', '🍂', '🍃', '🍄', '🪰',
    '🪱', '🪲', '🪳', '🪴', '🪵', '🪶', '🪷', '🪸', '🪹',
  ],
  Food: [
    '🍅', '🍆', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🍔', '🍕', '🍖',
    '🍗', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍞', '🍟', '🍠', '🍡', '🍢', '🍣', '🍤', '🍥', '🍦', '🍧', '🍨',
    '🍩', '🍪', '🍫', '🍬', '🍭', '🍮', '🍯', '🍰', '🍱', '🍲', '🍳', '🍴', '🍵', '🍶', '🍷', '🍸', '🍹', '🍺',
    '🍻', '🍼', '🍽', '🍾', '🍿', '🌭', '🌮', '🌯', '🌰', '🥐', '🥑', '🥒', '🥓', '🥔', '🥕', '🥖', '🥗', '🥘',
    '🥙', '🥚', '🥛', '🥜', '🥝', '🥞', '🥟', '🥠', '🥡', '🥢', '🥣', '🥤', '🥥', '🥦', '🥧', '🥨', '🥩', '🥪',
    '🥫', '🥬', '🥭', '🥮', '🥯', '🫐', '🫑', '🫒', '🫓', '🫔', '🫕', '🫖', '🫗', '🫘', '🫙', '🫚', '🫛',
  ],
  Travel: [
    '🚀', '🚁', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚋', '🚌', '🚍', '🚎', '🚏', '🚐', '🚑',
    '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚘', '🚙', '🚚', '🚛', '🚜', '🚝', '🚞', '🚟', '🚠', '🚡', '🚢', '🚣',
    '🚤', '🚥', '🚦', '🚧', '🚨', '🚩', '🚪', '🚫', '🚬', '🚭', '🚮', '🚯', '🚰', '🚱', '🚲', '🚳', '🚴', '🚵',
    '🚶', '🚷', '🚸', '🚹', '🚺', '🚻', '🚼', '🚽', '🚾', '🚿', '🌍', '🌎', '🌏', '🌐', '🌑', '🌒', '🌓', '🌔',
    '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '🌝', '🌞', '🌟', '🌠', '🛠', '🛡', '🛢', '🛣', '🛤', '🛥',
    '🛦', '🛧', '🛨', '🛩', '🛪', '🛫', '🛬', '🛰', '🛱', '🛲', '🛳', '🛴', '🛵', '🛶', '🛷', '🛸', '🛹', '🛺',
    '🛻', '🛼', '⛵', '⛽',
  ],
  Activities: [
    '🎠', '🎡', '🎢', '🎣', '🎤', '🎥', '🎦', '🎧', '🎨', '🎩', '🎪', '🎫', '🎬', '🎭', '🎮', '🎯', '🎰', '🎱',
    '🎲', '🎳', '🎴', '🎵', '🎶', '🎷', '🎸', '🎹', '🎺', '🎻', '🎼', '🎽', '🎾', '🎿', '🏀', '🏁', '🏂', '🏃',
    '🏄', '🏅', '🏆', '🏇', '🏈', '🏉', '🏊', '🏏', '🏐', '🏑', '🏒', '🏓', '🏔', '🏕', '🏖', '🏗', '🏘', '🏙',
    '🏚', '🏛', '🏜', '🏝', '🏞', '🏟', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏧', '🏨', '🏩', '🏪', '🏫',
    '🏬', '🏭', '🏮', '🏯', '🏰', '🤼', '🤽', '🤾', '🤿', '🥀', '🥁', '🥂', '🥃', '🥄', '🥅', '🥆', '🥇', '🥈',
    '🥉', '🥊', '🥋', '🥌', '🥍', '🥎', '🥏', '⚽', '⚾', '🀄', '🃏',
  ],
  Objects: [
    '💠', '💡', '💢', '💣', '💤', '💥', '💦', '💧', '💨', '💩', '💪', '💫', '💬', '💭', '💮', '💯', '💰', '💱',
    '💲', '💳', '💴', '💵', '💶', '💷', '💸', '💹', '💺', '💻', '💼', '💽', '💾', '💿', '📀', '📁', '📂', '📃',
    '📄', '📅', '📆', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '📏', '📐', '📑', '📒', '📓', '📔', '📕',
    '📖', '📗', '📘', '📙', '📚', '📛', '📜', '📝', '📞', '📟', '📠', '📡', '📢', '📣', '📤', '📥', '📦', '📧',
    '📨', '📩', '📪', '📫', '📬', '📭', '📮', '📯', '📰', '📱', '📲', '📳', '📴', '📵', '📶', '📷', '📸', '📹',
    '📺', '📻', '📼', '📽', '📾', '📿', '🔦', '🔧', '🔨', '🔩', '🔪', '🔫', '🔬', '🔭', '🔮', '🔯', '🔰', '🔱',
    '🔲', '🔳', '🔴', '🔵', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '🔼', '🔽', '🩰', '🩱', '🩲', '🩳', '🩴', '🩵',
    '🩶', '🩷', '🩸', '🩹', '🩺', '🩻', '🩼', '🪀', '🪁', '🪂', '🪃', '🪄', '🪅', '🪆', '🪇', '🪈', '🪉', '🪏',
    '🧰', '🧱', '🧲', '🧳', '🧴', '🧵', '🧶', '🧷', '🧸', '🧹', '🧺', '🧻', '🧼', '🧽', '🧾', '🧿', '⌚', '⌛',
    '🖤',
  ],
  Symbols: [
    '🔀', '🔁', '🔂', '🔃', '🔄', '🔅', '🔆', '🔇', '🔈', '🔉', '🔊', '🔋', '🔌', '🔍', '🔎', '🔏', '🔐', '🔑',
    '🔒', '🔓', '🔔', '🔕', '🔖', '🔗', '🔘', '🔙', '🔚', '🔛', '🔜', '🔝', '🔞', '🔟', '🔠', '🔡', '🔢', '🔣',
    '🔤', '🔥', '🆑', '🆒', '🆓', '🆔', '🆕', '🆖', '🆗', '🆘', '🆙', '🆚', '💐', '💑', '💒', '💓', '💔', '💕',
    '💖', '💗', '💘', '💙', '💚', '💛', '💜', '💝', '💞', '💟', '🤌', '🤍', '🤎', '🤏', '♈', '♉', '♊', '♋',
    '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⭐', '⭕', '⚡', '⚪', '⚫', '❌', '❎', '➕', '➖', '➗',
    '❓', '❔', '❕', '❗', '✅', '✨', '♿',
  ],
};

//  Search keywords. One Unicode name per character, which is what makes
//  `Search emoji` able to match anything at all: the data is bare characters,
//  which a query has nothing to match against.
const EMOJI_NAMES = {
  '😀': 'grinning face', '😁': 'grinning face with smiling eyes', '😂': 'face with tears of joy',
  '😃': 'smiling face with open mouth', '😄': 'smiling face with open mouth and smiling eyes',
  '😅': 'smiling face with open mouth and cold sweat',
  '😆': 'smiling face with open mouth and tightly-closed eyes', '😇': 'smiling face with halo',
  '😈': 'smiling face with horns', '😉': 'winking face', '😊': 'smiling face with smiling eyes',
  '😋': 'face savouring delicious food', '😌': 'relieved face', '😍': 'smiling face with heart-shaped eyes',
  '😎': 'smiling face with sunglasses', '😏': 'smirking face', '😐': 'neutral face', '😑': 'expressionless face',
  '😒': 'unamused face', '😓': 'face with cold sweat', '😔': 'pensive face', '😕': 'confused face',
  '😖': 'confounded face', '😗': 'kissing face', '😘': 'face throwing a kiss',
  '😙': 'kissing face with smiling eyes', '😚': 'kissing face with closed eyes',
  '😛': 'face with stuck-out tongue', '😜': 'face with stuck-out tongue and winking eye',
  '😝': 'face with stuck-out tongue and tightly-closed eyes', '😞': 'disappointed face', '😟': 'worried face',
  '😠': 'angry face', '😡': 'pouting face', '😢': 'crying face', '😣': 'persevering face',
  '😤': 'face with look of triumph', '😥': 'disappointed but relieved face',
  '😦': 'frowning face with open mouth', '😧': 'anguished face', '😨': 'fearful face', '😩': 'weary face',
  '😪': 'sleepy face', '😫': 'tired face', '😬': 'grimacing face', '😭': 'loudly crying face',
  '😮': 'face with open mouth', '😯': 'hushed face', '😰': 'face with open mouth and cold sweat',
  '😱': 'face screaming in fear', '😲': 'astonished face', '😳': 'flushed face', '😴': 'sleeping face',
  '😵': 'dizzy face', '😶': 'face without mouth', '😷': 'face with medical mask',
  '😸': 'grinning cat face with smiling eyes', '😹': 'cat face with tears of joy',
  '😺': 'smiling cat face with open mouth', '😻': 'smiling cat face with heart-shaped eyes',
  '😼': 'cat face with wry smile', '😽': 'kissing cat face with closed eyes', '😾': 'pouting cat face',
  '😿': 'crying cat face', '🙀': 'weary cat face', '🙁': 'slightly frowning face', '🙂': 'slightly smiling face',
  '🙃': 'upside-down face', '🙄': 'face with rolling eyes', '🙅': 'face with no good gesture',
  '🙆': 'face with ok gesture', '🙇': 'person bowing deeply', '🙈': 'see-no-evil monkey',
  '🙉': 'hear-no-evil monkey', '🙊': 'speak-no-evil monkey', '🙋': 'happy person raising one hand',
  '🙌': 'person raising both hands in celebration', '🙍': 'person frowning', '🙎': 'person with pouting face',
  '🙏': 'person with folded hands', '🤐': 'zipper-mouth face', '🤑': 'money-mouth face',
  '🤒': 'face with thermometer', '🤓': 'nerd face', '🤔': 'thinking face', '🤕': 'face with head-bandage',
  '🤖': 'robot face', '🤗': 'hugging face', '🤘': 'sign of the horns', '🤙': 'call me hand',
  '🤚': 'raised back of hand', '🤛': 'left-facing fist', '🤜': 'right-facing fist', '🤝': 'handshake',
  '🤞': 'hand with index and middle fingers crossed', '🤟': 'i love you hand sign', '🤠': 'face with cowboy hat',
  '🤡': 'clown face', '🤢': 'nauseated face', '🤣': 'rolling on the floor laughing', '🤤': 'drooling face',
  '🤥': 'lying face', '🤦': 'face palm', '🤧': 'sneezing face', '🤨': 'face with one eyebrow raised',
  '🤩': 'grinning face with star eyes', '🤪': 'grinning face with one large and one small eye',
  '🤫': 'face with finger covering closed lips', '🤬': 'serious face with symbols covering mouth',
  '🤭': 'smiling face with smiling eyes and hand covering mouth', '🤮': 'face with open mouth vomiting',
  '🤯': 'shocked face with exploding head', '🥰': 'smiling face with smiling eyes and three hearts',
  '🥱': 'yawning face', '🥲': 'smiling face with tear', '🥳': 'face with party horn and party hat',
  '🥴': 'face with uneven eyes and wavy mouth', '🥵': 'overheated face', '🥶': 'freezing face', '🥷': 'ninja',
  '🥸': 'disguised face', '🥹': 'face holding back tears', '🥺': 'face with pleading eyes',
  '🧐': 'face with monocle', '🫠': 'melting face', '🫡': 'saluting face',
  '🫢': 'face with open eyes and hand over mouth', '🫣': 'face with peeking eye',
  '🫤': 'face with diagonal mouth', '🫥': 'dotted line face', '🫦': 'biting lip', '🫧': 'bubbles',
  '🫨': 'shaking face', '👀': 'eyes', '👁': 'eye', '👂': 'ear', '👃': 'nose', '👄': 'mouth', '👅': 'tongue',
  '👆': 'white up pointing backhand index', '👇': 'white down pointing backhand index',
  '👈': 'white left pointing backhand index', '👉': 'white right pointing backhand index',
  '👊': 'fisted hand sign', '👋': 'waving hand sign', '👌': 'ok hand sign', '👍': 'thumbs up sign',
  '👎': 'thumbs down sign', '👏': 'clapping hands sign', '👐': 'open hands sign', '👤': 'bust in silhouette',
  '👥': 'busts in silhouette', '👦': 'boy', '👧': 'girl', '👨': 'man', '👩': 'woman', '👪': 'family',
  '👫': 'man and woman holding hands', '👬': 'two men holding hands', '👭': 'two women holding hands',
  '👮': 'police officer', '👯': 'woman with bunny ears', '👰': 'bride with veil', '👱': 'person with blond hair',
  '👲': 'man with gua pi mao', '👳': 'man with turban', '👴': 'older man', '👵': 'older woman', '👶': 'baby',
  '👷': 'construction worker', '👸': 'princess', '👹': 'japanese ogre', '👺': 'japanese goblin', '👻': 'ghost',
  '👼': 'baby angel', '👽': 'extraterrestrial alien', '👾': 'alien monster', '👿': 'imp', '💀': 'skull',
  '💁': 'information desk person', '💂': 'guardsman', '💃': 'dancer', '💄': 'lipstick', '💅': 'nail polish',
  '💆': 'face massage', '💇': 'haircut', '🤰': 'pregnant woman', '🤱': 'breast-feeding', '🤲': 'palms up together',
  '🤳': 'selfie', '🤴': 'prince', '🤵': 'man in tuxedo', '🤶': 'mother christmas', '🤷': 'shrug', '🦴': 'bone',
  '🦵': 'leg', '🦶': 'foot', '🦷': 'tooth', '🦸': 'superhero', '🦹': 'supervillain', '🦺': 'safety vest',
  '🦻': 'ear with hearing aid', '🧍': 'standing person', '🧎': 'kneeling person', '🧏': 'deaf person',
  '🧑': 'adult', '🧒': 'child', '🧓': 'older adult', '🧔': 'bearded person', '🧕': 'person with headscarf',
  '🧖': 'person in steamy room', '🧗': 'person climbing', '🧘': 'person in lotus position', '🧙': 'mage',
  '🧚': 'fairy', '🧛': 'vampire', '🧜': 'merperson', '🧝': 'elf', '🧞': 'genie', '🧟': 'zombie',
  '🫰': 'hand with index finger and thumb crossed', '🫱': 'rightwards hand', '🫲': 'leftwards hand',
  '🫳': 'palm down hand', '🫴': 'palm up hand', '🫵': 'index pointing at the viewer', '🫶': 'heart hands',
  '🫷': 'leftwards pushing hand', '🫸': 'rightwards pushing hand', '✊': 'raised fist', '✋': 'raised hand',
  '🐀': 'rat', '🐁': 'mouse', '🐂': 'ox', '🐃': 'water buffalo', '🐄': 'cow', '🐅': 'tiger', '🐆': 'leopard',
  '🐇': 'rabbit', '🐈': 'cat', '🐉': 'dragon', '🐊': 'crocodile', '🐋': 'whale', '🐌': 'snail', '🐍': 'snake',
  '🐎': 'horse', '🐏': 'ram', '🐐': 'goat', '🐑': 'sheep', '🐒': 'monkey', '🐓': 'rooster', '🐔': 'chicken',
  '🐕': 'dog', '🐖': 'pig', '🐗': 'boar', '🐘': 'elephant', '🐙': 'octopus', '🐚': 'spiral shell', '🐛': 'bug',
  '🐜': 'ant', '🐝': 'honeybee', '🐞': 'lady beetle', '🐟': 'fish', '🐠': 'tropical fish', '🐡': 'blowfish',
  '🐢': 'turtle', '🐣': 'hatching chick', '🐤': 'baby chick', '🐥': 'front-facing baby chick', '🐦': 'bird',
  '🐧': 'penguin', '🐨': 'koala', '🐩': 'poodle', '🐪': 'dromedary camel', '🐫': 'bactrian camel', '🐬': 'dolphin',
  '🐭': 'mouse face', '🐮': 'cow face', '🐯': 'tiger face', '🐰': 'rabbit face', '🐱': 'cat face',
  '🐲': 'dragon face', '🐳': 'spouting whale', '🐴': 'horse face', '🐵': 'monkey face', '🐶': 'dog face',
  '🐷': 'pig face', '🐸': 'frog face', '🐹': 'hamster face', '🐺': 'wolf face', '🐻': 'bear face',
  '🐼': 'panda face', '🐽': 'pig nose', '🐾': 'paw prints', '🐿': 'chipmunk', '🦀': 'crab', '🦁': 'lion face',
  '🦂': 'scorpion', '🦃': 'turkey', '🦄': 'unicorn face', '🦅': 'eagle', '🦆': 'duck', '🦇': 'bat', '🦈': 'shark',
  '🦉': 'owl', '🦊': 'fox face', '🦋': 'butterfly', '🦌': 'deer', '🦍': 'gorilla', '🦎': 'lizard',
  '🦏': 'rhinoceros', '🦐': 'shrimp', '🦑': 'squid', '🦒': 'giraffe face', '🦓': 'zebra face', '🦔': 'hedgehog',
  '🦕': 'sauropod', '🦖': 't-rex', '🦗': 'cricket', '🦘': 'kangaroo', '🦙': 'llama', '🦚': 'peacock',
  '🦛': 'hippopotamus', '🦜': 'parrot', '🦝': 'raccoon', '🦞': 'lobster', '🦟': 'mosquito', '🦠': 'microbe',
  '🦡': 'badger', '🦢': 'swan', '🦣': 'mammoth', '🦤': 'dodo', '🦥': 'sloth', '🦦': 'otter', '🦧': 'orangutan',
  '🦨': 'skunk', '🦩': 'flamingo', '🦪': 'oyster', '🦫': 'beaver', '🦬': 'bison', '🦭': 'seal', '🦮': 'guide dog',
  '🌷': 'tulip', '🌸': 'cherry blossom', '🌹': 'rose', '🌺': 'hibiscus', '🌻': 'sunflower', '🌼': 'blossom',
  '🌽': 'ear of maize', '🌾': 'ear of rice', '🌿': 'herb', '🍀': 'four leaf clover', '🍁': 'maple leaf',
  '🍂': 'fallen leaf', '🍃': 'leaf fluttering in wind', '🍄': 'mushroom', '🪰': 'fly', '🪱': 'worm', '🪲': 'beetle',
  '🪳': 'cockroach', '🪴': 'potted plant', '🪵': 'wood', '🪶': 'feather', '🪷': 'lotus', '🪸': 'coral',
  '🪹': 'empty nest', '🍅': 'tomato', '🍆': 'aubergine', '🍇': 'grapes', '🍈': 'melon', '🍉': 'watermelon',
  '🍊': 'tangerine', '🍋': 'lemon', '🍌': 'banana', '🍍': 'pineapple', '🍎': 'red apple', '🍏': 'green apple',
  '🍐': 'pear', '🍑': 'peach', '🍒': 'cherries', '🍓': 'strawberry', '🍔': 'hamburger', '🍕': 'slice of pizza',
  '🍖': 'meat on bone', '🍗': 'poultry leg', '🍘': 'rice cracker', '🍙': 'rice ball', '🍚': 'cooked rice',
  '🍛': 'curry and rice', '🍜': 'steaming bowl', '🍝': 'spaghetti', '🍞': 'bread', '🍟': 'french fries',
  '🍠': 'roasted sweet potato', '🍡': 'dango', '🍢': 'oden', '🍣': 'sushi', '🍤': 'fried shrimp',
  '🍥': 'fish cake with swirl design', '🍦': 'soft ice cream', '🍧': 'shaved ice', '🍨': 'ice cream',
  '🍩': 'doughnut', '🍪': 'cookie', '🍫': 'chocolate bar', '🍬': 'candy', '🍭': 'lollipop', '🍮': 'custard',
  '🍯': 'honey pot', '🍰': 'shortcake', '🍱': 'bento box', '🍲': 'pot of food', '🍳': 'cooking',
  '🍴': 'fork and knife', '🍵': 'teacup without handle', '🍶': 'sake bottle and cup', '🍷': 'wine glass',
  '🍸': 'cocktail glass', '🍹': 'tropical drink', '🍺': 'beer mug', '🍻': 'clinking beer mugs',
  '🍼': 'baby bottle', '🍽': 'fork and knife with plate', '🍾': 'bottle with popping cork', '🍿': 'popcorn',
  '🌭': 'hot dog', '🌮': 'taco', '🌯': 'burrito', '🌰': 'chestnut', '🥐': 'croissant', '🥑': 'avocado',
  '🥒': 'cucumber', '🥓': 'bacon', '🥔': 'potato', '🥕': 'carrot', '🥖': 'baguette bread', '🥗': 'green salad',
  '🥘': 'shallow pan of food', '🥙': 'stuffed flatbread', '🥚': 'egg', '🥛': 'glass of milk', '🥜': 'peanuts',
  '🥝': 'kiwifruit', '🥞': 'pancakes', '🥟': 'dumpling', '🥠': 'fortune cookie', '🥡': 'takeout box',
  '🥢': 'chopsticks', '🥣': 'bowl with spoon', '🥤': 'cup with straw', '🥥': 'coconut', '🥦': 'broccoli',
  '🥧': 'pie', '🥨': 'pretzel', '🥩': 'cut of meat', '🥪': 'sandwich', '🥫': 'canned food', '🥬': 'leafy green',
  '🥭': 'mango', '🥮': 'moon cake', '🥯': 'bagel', '🫐': 'blueberries', '🫑': 'bell pepper', '🫒': 'olive',
  '🫓': 'flatbread', '🫔': 'tamale', '🫕': 'fondue', '🫖': 'teapot', '🫗': 'pouring liquid', '🫘': 'beans',
  '🫙': 'jar', '🫚': 'ginger root', '🫛': 'pea pod', '🚀': 'rocket', '🚁': 'helicopter', '🚂': 'steam locomotive',
  '🚃': 'railway car', '🚄': 'high-speed train', '🚅': 'high-speed train with bullet nose', '🚆': 'train',
  '🚇': 'metro', '🚈': 'light rail', '🚉': 'station', '🚊': 'tram', '🚋': 'tram car', '🚌': 'bus',
  '🚍': 'oncoming bus', '🚎': 'trolleybus', '🚏': 'bus stop', '🚐': 'minibus', '🚑': 'ambulance',
  '🚒': 'fire engine', '🚓': 'police car', '🚔': 'oncoming police car', '🚕': 'taxi', '🚖': 'oncoming taxi',
  '🚗': 'automobile', '🚘': 'oncoming automobile', '🚙': 'recreational vehicle', '🚚': 'delivery truck',
  '🚛': 'articulated lorry', '🚜': 'tractor', '🚝': 'monorail', '🚞': 'mountain railway',
  '🚟': 'suspension railway', '🚠': 'mountain cableway', '🚡': 'aerial tramway', '🚢': 'ship', '🚣': 'rowboat',
  '🚤': 'speedboat', '🚥': 'horizontal traffic light', '🚦': 'vertical traffic light', '🚧': 'construction sign',
  '🚨': 'police cars revolving light', '🚩': 'triangular flag on post', '🚪': 'door', '🚫': 'no entry sign',
  '🚬': 'smoking symbol', '🚭': 'no smoking symbol', '🚮': 'put litter in its place symbol',
  '🚯': 'do not litter symbol', '🚰': 'potable water symbol', '🚱': 'non-potable water symbol', '🚲': 'bicycle',
  '🚳': 'no bicycles', '🚴': 'bicyclist', '🚵': 'mountain bicyclist', '🚶': 'pedestrian', '🚷': 'no pedestrians',
  '🚸': 'children crossing', '🚹': 'mens symbol', '🚺': 'womens symbol', '🚻': 'restroom', '🚼': 'baby symbol',
  '🚽': 'toilet', '🚾': 'water closet', '🚿': 'shower', '🌍': 'earth globe europe-africa',
  '🌎': 'earth globe americas', '🌏': 'earth globe asia-australia', '🌐': 'globe with meridians',
  '🌑': 'new moon symbol', '🌒': 'waxing crescent moon symbol', '🌓': 'first quarter moon symbol',
  '🌔': 'waxing gibbous moon symbol', '🌕': 'full moon symbol', '🌖': 'waning gibbous moon symbol',
  '🌗': 'last quarter moon symbol', '🌘': 'waning crescent moon symbol', '🌙': 'crescent moon',
  '🌚': 'new moon with face', '🌛': 'first quarter moon with face', '🌜': 'last quarter moon with face',
  '🌝': 'full moon with face', '🌞': 'sun with face', '🌟': 'glowing star', '🌠': 'shooting star',
  '🛠': 'hammer and wrench', '🛡': 'shield', '🛢': 'oil drum', '🛣': 'motorway', '🛤': 'railway track',
  '🛥': 'motor boat', '🛦': 'up-pointing military airplane', '🛧': 'up-pointing airplane',
  '🛨': 'up-pointing small airplane', '🛩': 'small airplane', '🛪': 'northeast-pointing airplane',
  '🛫': 'airplane departure', '🛬': 'airplane arriving', '🛰': 'satellite', '🛱': 'oncoming fire engine',
  '🛲': 'diesel locomotive', '🛳': 'passenger ship', '🛴': 'scooter', '🛵': 'motor scooter', '🛶': 'canoe',
  '🛷': 'sled', '🛸': 'flying saucer', '🛹': 'skateboard', '🛺': 'auto rickshaw', '🛻': 'pickup truck',
  '🛼': 'roller skate', '⛵': 'sailboat', '⛽': 'fuel pump', '🎠': 'carousel horse', '🎡': 'ferris wheel',
  '🎢': 'roller coaster', '🎣': 'fishing pole and fish', '🎤': 'microphone', '🎥': 'movie camera', '🎦': 'cinema',
  '🎧': 'headphone', '🎨': 'artist palette', '🎩': 'top hat', '🎪': 'circus tent', '🎫': 'ticket',
  '🎬': 'clapper board', '🎭': 'performing arts', '🎮': 'video game', '🎯': 'direct hit', '🎰': 'slot machine',
  '🎱': 'billiards', '🎲': 'game die', '🎳': 'bowling', '🎴': 'flower playing cards', '🎵': 'musical note',
  '🎶': 'multiple musical notes', '🎷': 'saxophone', '🎸': 'guitar', '🎹': 'musical keyboard', '🎺': 'trumpet',
  '🎻': 'violin', '🎼': 'musical score', '🎽': 'running shirt with sash', '🎾': 'tennis racquet and ball',
  '🎿': 'ski and ski boot', '🏀': 'basketball and hoop', '🏁': 'chequered flag', '🏂': 'snowboarder',
  '🏃': 'runner', '🏄': 'surfer', '🏅': 'sports medal', '🏆': 'trophy', '🏇': 'horse racing',
  '🏈': 'american football', '🏉': 'rugby football', '🏊': 'swimmer', '🏏': 'cricket bat and ball',
  '🏐': 'volleyball', '🏑': 'field hockey stick and ball', '🏒': 'ice hockey stick and puck',
  '🏓': 'table tennis paddle and ball', '🏔': 'snow capped mountain', '🏕': 'camping',
  '🏖': 'beach with umbrella', '🏗': 'building construction', '🏘': 'house buildings', '🏙': 'cityscape',
  '🏚': 'derelict house building', '🏛': 'classical building', '🏜': 'desert', '🏝': 'desert island',
  '🏞': 'national park', '🏟': 'stadium', '🏠': 'house building', '🏡': 'house with garden',
  '🏢': 'office building', '🏣': 'japanese post office', '🏤': 'european post office', '🏥': 'hospital',
  '🏦': 'bank', '🏧': 'automated teller machine', '🏨': 'hotel', '🏩': 'love hotel', '🏪': 'convenience store',
  '🏫': 'school', '🏬': 'department store', '🏭': 'factory', '🏮': 'izakaya lantern', '🏯': 'japanese castle',
  '🏰': 'european castle', '🤼': 'wrestlers', '🤽': 'water polo', '🤾': 'handball', '🤿': 'diving mask',
  '🥀': 'wilted flower', '🥁': 'drum with drumsticks', '🥂': 'clinking glasses', '🥃': 'tumbler glass',
  '🥄': 'spoon', '🥅': 'goal net', '🥆': 'rifle', '🥇': 'first place medal', '🥈': 'second place medal',
  '🥉': 'third place medal', '🥊': 'boxing glove', '🥋': 'martial arts uniform', '🥌': 'curling stone',
  '🥍': 'lacrosse stick and ball', '🥎': 'softball', '🥏': 'flying disc', '⚽': 'soccer ball', '⚾': 'baseball',
  '🀄': 'mahjong tile red dragon', '🃏': 'playing card black joker', '💠': 'diamond shape with a dot inside',
  '💡': 'electric light bulb', '💢': 'anger symbol', '💣': 'bomb', '💤': 'sleeping symbol',
  '💥': 'collision symbol', '💦': 'splashing sweat symbol', '💧': 'droplet', '💨': 'dash symbol',
  '💩': 'pile of poo', '💪': 'flexed biceps', '💫': 'dizzy symbol', '💬': 'speech balloon',
  '💭': 'thought balloon', '💮': 'white flower', '💯': 'hundred points symbol', '💰': 'money bag',
  '💱': 'currency exchange', '💲': 'heavy dollar sign', '💳': 'credit card', '💴': 'banknote with yen sign',
  '💵': 'banknote with dollar sign', '💶': 'banknote with euro sign', '💷': 'banknote with pound sign',
  '💸': 'money with wings', '💹': 'chart with upwards trend and yen sign', '💺': 'seat',
  '💻': 'personal computer', '💼': 'briefcase', '💽': 'minidisc', '💾': 'floppy disk', '💿': 'optical disc',
  '📀': 'dvd', '📁': 'file folder', '📂': 'open file folder', '📃': 'page with curl', '📄': 'page facing up',
  '📅': 'calendar', '📆': 'tear-off calendar', '📇': 'card index', '📈': 'chart with upwards trend',
  '📉': 'chart with downwards trend', '📊': 'bar chart', '📋': 'clipboard', '📌': 'pushpin', '📍': 'round pushpin',
  '📎': 'paperclip', '📏': 'straight ruler', '📐': 'triangular ruler', '📑': 'bookmark tabs', '📒': 'ledger',
  '📓': 'notebook', '📔': 'notebook with decorative cover', '📕': 'closed book', '📖': 'open book',
  '📗': 'green book', '📘': 'blue book', '📙': 'orange book', '📚': 'books', '📛': 'name badge', '📜': 'scroll',
  '📝': 'memo', '📞': 'telephone receiver', '📟': 'pager', '📠': 'fax machine', '📡': 'satellite antenna',
  '📢': 'public address loudspeaker', '📣': 'cheering megaphone', '📤': 'outbox tray', '📥': 'inbox tray',
  '📦': 'package', '📧': 'e-mail symbol', '📨': 'incoming envelope', '📩': 'envelope with downwards arrow above',
  '📪': 'closed mailbox with lowered flag', '📫': 'closed mailbox with raised flag',
  '📬': 'open mailbox with raised flag', '📭': 'open mailbox with lowered flag', '📮': 'postbox',
  '📯': 'postal horn', '📰': 'newspaper', '📱': 'mobile phone',
  '📲': 'mobile phone with rightwards arrow at left', '📳': 'vibration mode', '📴': 'mobile phone off',
  '📵': 'no mobile phones', '📶': 'antenna with bars', '📷': 'camera', '📸': 'camera with flash',
  '📹': 'video camera', '📺': 'television', '📻': 'radio', '📼': 'videocassette', '📽': 'film projector',
  '📾': 'portable stereo', '📿': 'prayer beads', '🔦': 'electric torch', '🔧': 'wrench', '🔨': 'hammer',
  '🔩': 'nut and bolt', '🔪': 'hocho', '🔫': 'pistol', '🔬': 'microscope', '🔭': 'telescope', '🔮': 'crystal ball',
  '🔯': 'six pointed star with middle dot', '🔰': 'japanese symbol for beginner', '🔱': 'trident emblem',
  '🔲': 'black square button', '🔳': 'white square button', '🔴': 'large red circle', '🔵': 'large blue circle',
  '🔶': 'large orange diamond', '🔷': 'large blue diamond', '🔸': 'small orange diamond',
  '🔹': 'small blue diamond', '🔺': 'up-pointing red triangle', '🔻': 'down-pointing red triangle',
  '🔼': 'up-pointing small red triangle', '🔽': 'down-pointing small red triangle', '🩰': 'ballet shoes',
  '🩱': 'one-piece swimsuit', '🩲': 'briefs', '🩳': 'shorts', '🩴': 'thong sandal', '🩵': 'light blue heart',
  '🩶': 'grey heart', '🩷': 'pink heart', '🩸': 'drop of blood', '🩹': 'adhesive bandage', '🩺': 'stethoscope',
  '🩻': 'x-ray', '🩼': 'crutch', '🪀': 'yo-yo', '🪁': 'kite', '🪂': 'parachute', '🪃': 'boomerang',
  '🪄': 'magic wand', '🪅': 'pinata', '🪆': 'nesting dolls', '🪇': 'maracas', '🪈': 'flute', '🪉': 'harp',
  '🪏': 'shovel', '🧰': 'toolbox', '🧱': 'brick', '🧲': 'magnet', '🧳': 'luggage', '🧴': 'lotion bottle',
  '🧵': 'spool of thread', '🧶': 'ball of yarn', '🧷': 'safety pin', '🧸': 'teddy bear', '🧹': 'broom',
  '🧺': 'basket', '🧻': 'roll of paper', '🧼': 'bar of soap', '🧽': 'sponge', '🧾': 'receipt', '🧿': 'nazar amulet',
  '⌚': 'watch', '⌛': 'hourglass', '🖤': 'black heart', '🔀': 'twisted rightwards arrows',
  '🔁': 'clockwise rightwards and leftwards open circle arrows',
  '🔂': 'clockwise rightwards and leftwards open circle arrows with circled one overlay',
  '🔃': 'clockwise downwards and upwards open circle arrows',
  '🔄': 'anticlockwise downwards and upwards open circle arrows', '🔅': 'low brightness symbol',
  '🔆': 'high brightness symbol', '🔇': 'speaker with cancellation stroke', '🔈': 'speaker',
  '🔉': 'speaker with one sound wave', '🔊': 'speaker with three sound waves', '🔋': 'battery',
  '🔌': 'electric plug', '🔍': 'left-pointing magnifying glass', '🔎': 'right-pointing magnifying glass',
  '🔏': 'lock with ink pen', '🔐': 'closed lock with key', '🔑': 'key', '🔒': 'lock', '🔓': 'open lock',
  '🔔': 'bell', '🔕': 'bell with cancellation stroke', '🔖': 'bookmark', '🔗': 'link symbol', '🔘': 'radio button',
  '🔙': 'back with leftwards arrow above', '🔚': 'end with leftwards arrow above',
  '🔛': 'on with exclamation mark with left right arrow above', '🔜': 'soon with rightwards arrow above',
  '🔝': 'top with upwards arrow above', '🔞': 'no one under eighteen symbol', '🔟': 'keycap ten',
  '🔠': 'input symbol for latin capital letters', '🔡': 'input symbol for latin small letters',
  '🔢': 'input symbol for numbers', '🔣': 'input symbol for symbols', '🔤': 'input symbol for latin letters',
  '🔥': 'fire', '🆑': 'squared cl', '🆒': 'squared cool', '🆓': 'squared free', '🆔': 'squared id',
  '🆕': 'squared new', '🆖': 'squared ng', '🆗': 'squared ok', '🆘': 'squared sos',
  '🆙': 'squared up with exclamation mark', '🆚': 'squared vs', '💐': 'bouquet', '💑': 'couple with heart',
  '💒': 'wedding', '💓': 'beating heart', '💔': 'broken heart', '💕': 'two hearts', '💖': 'sparkling heart',
  '💗': 'growing heart', '💘': 'heart with arrow', '💙': 'blue heart', '💚': 'green heart', '💛': 'yellow heart',
  '💜': 'purple heart', '💝': 'heart with ribbon', '💞': 'revolving hearts', '💟': 'heart decoration',
  '🤌': 'pinched fingers', '🤍': 'white heart', '🤎': 'brown heart', '🤏': 'pinching hand', '♈': 'aries',
  '♉': 'taurus', '♊': 'gemini', '♋': 'cancer', '♌': 'leo', '♍': 'virgo', '♎': 'libra', '♏': 'scorpius',
  '♐': 'sagittarius', '♑': 'capricorn', '♒': 'aquarius', '♓': 'pisces', '⭐': 'white medium star',
  '⭕': 'heavy large circle', '⚡': 'high voltage sign', '⚪': 'medium white circle', '⚫': 'medium black circle',
  '❌': 'cross mark', '❎': 'negative squared cross mark', '➕': 'heavy plus sign', '➖': 'heavy minus sign',
  '➗': 'heavy division sign', '❓': 'black question mark ornament', '❔': 'white question mark ornament',
  '❕': 'white exclamation mark ornament', '❗': 'heavy exclamation mark symbol', '✅': 'white heavy check mark',
  '✨': 'sparkles', '♿': 'wheelchair symbol',
};

function insertEmojiIntoTextarea(emoji, onSelect) {
  if (typeof onSelect === 'function') {
    onSelect(emoji);
    return;
  }
  const textarea = document.querySelector('.chat-composer__field');
  if (!textarea) return;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + emoji + after;
  const newPos = start + emoji.length;
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

//  One picker for every surface that inserts an emoji: the chat composer, the
//  mail composer, the forum thread composer. Its state is its own, so it does
//  not need a host's store to live in.
const EmojiPicker = () => {
  let search = '';
  let category = EMOJI_CATEGORIES[0];
  let close = null;
  let root = null;

  //  A click anywhere else dismisses it. Registered by the picker rather than
  //  by each surface that hosts one, so every host gets the behaviour and none
  //  of them can forget to take the listener down again.
  //
  //  The test is whether the click landed inside the picker, not whether
  //  something stopped it on the way up. An earlier version listened in the
  //  capture phase, which runs from the document DOWN to the target -- so it
  //  fired before the click had reached anything, and typing in the search
  //  field closed the picker.
  const onDocClick = (e) => {
    if (root && root.contains(e.target)) return;
    if (close) close();
    m.redraw();
  };

  return {
    oncreate: (vnode) => {
      root = vnode.dom;
      document.addEventListener('click', onDocClick);
    },
    onremove: () => document.removeEventListener('click', onDocClick),

    view: ({ attrs: { onSelect, onClose } }) => {
      close = onClose;
      const query = search.trim().toLowerCase();
      const emojis = query
        ? Object.values(EMOJI_DATA).flat().filter((e) => (EMOJI_NAMES[e] || '').includes(query))
        : (EMOJI_DATA[category] || []);

      return m('.emoji-picker', {
        onclick: (e) => e.stopPropagation(),
      }, [
        m(widget.SearchField, {
          class: 'emoji-search-row',
          placeholder: 'Search emoji',
          value: search,
          oninput: (e) => { search = e.target.value; },
          onclear: () => { search = ''; },
        }),

        !query && m('.emoji-categories', EMOJI_CATEGORIES.map((c) =>
          m('button.emoji-cat-btn[type=button]' + (c === category ? '.active' : ''), {
            title: c,
            onclick: () => { category = c; },
          }, EMOJI_ICONS[c])
        )),

        m('.emoji-grid',
          emojis.length === 0
            ? m('p.emoji-grid__empty', 'No emoji match that.')
            : emojis.map((e) =>
                m('button.emoji-btn[type=button]', {
                  key: e,
                  title: EMOJI_NAMES[e],
                  onclick: () => {
                    insertEmojiIntoTextarea(e, onSelect);
                    if (onClose) onClose();
                    m.redraw();
                  },
                }, e)
              )
        ),
      ]);
    },
  };
};

//  The picker holds its own state now, so nothing here needs a handle on
//  ChatHubState and the setDependencies shim that existed to break the
//  circular import is gone with it.
module.exports = {
  EMOJI_CATEGORIES,
  EMOJI_ICONS,
  EMOJI_DATA,
  EMOJI_NAMES,
  insertEmojiIntoTextarea,
  EmojiPicker,
};
