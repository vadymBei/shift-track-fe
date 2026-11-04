/** The largest side of a photo kept on the server: avatars are at most 128px, twice that for sharp screens. */
export const PHOTO_SIZE = 512;

/**
 * The centre square of the image, scaled down to at most `size`, as a JPEG:
 * small enough to show in lists, the same for every format the browser can open.
 * Rejects if the browser can't read the image.
 */
export async function squarePhoto(file: Blob, size = PHOTO_SIZE): Promise<Blob> {
  const image = await createImageBitmap(file);
  try {
    const side = Math.min(image.width, image.height);
    const target = Math.min(size, side);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;

    const context = canvas.getContext('2d');
    if (!context || !target) throw new Error('The image can\'t be drawn.');

    // JPEG has no transparency.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, target, target);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, target, target);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image can\'t be encoded.')), 'image/jpeg', 0.88));
  } finally {
    image.close();
  }
}
