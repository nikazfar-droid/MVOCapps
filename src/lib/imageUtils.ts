/**
 * Utiliti untuk memampatkan imej dan menukarnya ke format WebP.
 * Ini akan mengurangkan saiz fail (bandwidth) untuk simpanan Firebase.
 */
export const compressImageToWebP = (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    // Jika ia bukan imej (cth: PDF, dll), kembalikan fail asal tanpa mengubah apa-apa
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    // Jika ia SVG, jangan convert (boleh pecah transparensi atau gaya)
    if (file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Kekalkan nisbah aspek jika imej terlalu besar
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // Fallback ke fail asal jika canvas gagal
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // Fallback
              return;
            }
            // Tukar nama fail kepada .webp
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const newFile = new File([blob], newFileName, {
              type: "image/webp",
              lastModified: Date.now(),
            });
            resolve(newFile);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
