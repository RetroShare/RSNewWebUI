function chatPreviewText(rawText) {
  if (!rawText) return '';

  const source = String(rawText);
  if (!/[<&]/.test(source)) return source.trim();

  const hasImage = /<img\b/i.test(source) || /&lt;img\b/i.test(source);
  const decodeEntities = (text) => {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = text;
    return decoder.value;
  };
  const stripMarkup = (text) => text
    .replace(/<(style|script|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p\s*>|<\/div\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  // Some peers send literal HTML while others send the same payload with its
  // tags entity-encoded. Decode and strip a second time for the latter form.
  let text = decodeEntities(stripMarkup(source));
  if (/<[^>]+>/.test(text)) text = decodeEntities(stripMarkup(text));
  text = text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text) return text;
  if (hasImage) return 'Photo';
  return 'Message';
}

module.exports = chatPreviewText;
