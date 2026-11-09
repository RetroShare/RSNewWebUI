const GROUP_LOGO_SIZE = 64;

module.exports = function prepareGroupThumbnail(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        if (!size) throw new Error('Image is empty.');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = GROUP_LOGO_SIZE;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image processing is unavailable.');
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, (image.naturalWidth - size) / 2,
          (image.naturalHeight - size) / 2, size, size, 0, 0, GROUP_LOGO_SIZE, GROUP_LOGO_SIZE);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(source);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('Unable to load thumbnail.'));
    };
    image.src = source;
  });
};
