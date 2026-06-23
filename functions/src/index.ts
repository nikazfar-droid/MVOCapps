import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { pipeline } from 'stream/promises';

// Initialize the Firebase Admin App
admin.initializeApp();

// Load the sharp library statically if you have it installed
const sharp = require('sharp');

// Set resource limits to 128MB as requested to optimize costs
const runtimeOpts = {
  timeoutSeconds: 300,
  memory: '128MB' as const
};

/**
 * Fungsi ini memproses imej URL luaran (melalui Client App).
 * Admin hantar pautan URL (contoh: https://imgur.../image.jpg),
 * Firebase akan download imej ke temp server, mampatkannya,
 * dan upload ke Storage dengan header caching yang betul.
 */
export const uploadImageFromUrl = functions.region('asia-southeast1').runWith(runtimeOpts).https.onCall(async (data, context) => {
  // Hanya benarkan authenticated users (Admin check should ideally be here too)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sila log masuk sebagai Admin untuk memuat naik imej.');
  }

  const { imageUrl, albumId } = data;

  if (!imageUrl || !albumId) {
    throw new functions.https.HttpsError('invalid-argument', 'Pautan URL dan Album ID diperlukan.');
  }

  const bucket = admin.storage().bucket();
  const timestamp = Date.now();
  const rawFileName = `url_upload_${timestamp}.jpg`;
  const tempRawPath = path.join(os.tmpdir(), rawFileName);
  
  const webpFileName = `url_upload_${timestamp}.webp`;
  const tempWebpPath = path.join(os.tmpdir(), webpFileName);
  
  // Storage destination
  const destinationPath = `gallery_processed/${albumId}/${webpFileName}`;

  try {
    functions.logger.info(`Memuat turun imej daripada: ${imageUrl}`);
    
    // 1. Download image from external URL using native fetch (Node 18+)
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Gagal memuat turun: status ${response.status}`);
    }

    // 2. Stream the image body to temp file
    if (!response.body) throw new Error("Body kosong");
    // Convert Web stream to Node stream for pipeline
    const fileStream = fs.createWriteStream(tempRawPath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webStream = response.body as any;
    for await (const chunk of webStream) {
      fileStream.write(chunk);
    }
    fileStream.end();

    functions.logger.info(`Selesai muat turun ke ${tempRawPath}`);

    // 3. Convert to WebP via Sharp
    await sharp(tempRawPath)
      .webp({ quality: 80 })
      .toFile(tempWebpPath);
      
    functions.logger.info(`Imej WebP dijana di ${tempWebpPath}`);

    // 4. Upload to Firebase Storage with Cache Headers
    await bucket.upload(tempWebpPath, {
      destination: destinationPath,
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, s-maxage=31536000',
      },
    });

    // 5. Generate URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media`;
    
    // Clean up
    if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
    if (fs.existsSync(tempWebpPath)) fs.unlinkSync(tempWebpPath);

    return { success: true, url: publicUrl };

  } catch (err) {
    functions.logger.error("Ralat muat naik dari pautan", err);
    if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
    if (fs.existsSync(tempWebpPath)) fs.unlinkSync(tempWebpPath);
    throw new functions.https.HttpsError('internal', 'Gagal memproses pautan gambar luaran.');
  }
});

// Mengekalkan fungsi onFinalize sedia ada bagi Manual Upload (Phone / PC)
export const processGalleryImage = functions
  .region('asia-southeast1')
  .runWith(runtimeOpts)
  .storage
  .object()
  .onFinalize(async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;

    if (!contentType?.startsWith('image/')) return null;
    if (!filePath || !filePath.includes('gallery_raw/')) return null;
    if (contentType === 'image/webp') return null;

    const bucket = admin.storage().bucket(fileBucket);
    const fileName = path.basename(filePath);
    const tempFilePath = path.join(os.tmpdir(), fileName);

    const newFileName = fileName.replace(/\.[^/.]+$/, "") + ".webp";
    const tempWebpPath = path.join(os.tmpdir(), newFileName);
    const newFilePath = filePath.replace('gallery_raw/', 'gallery_processed/').replace(/\.[^/.]+$/, "") + ".webp";

    try {
      await bucket.file(filePath).download({ destination: tempFilePath });
      await sharp(tempFilePath).webp({ quality: 80 }).toFile(tempWebpPath);
      await bucket.upload(tempWebpPath, {
        destination: newFilePath,
        metadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, s-maxage=31536000',
        },
      });

      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newFilePath)}?alt=media`;

      // Kemas kini ke Firestore secara berperingkat tidak sesuai dalam trigger rawak jika upload pukal 8 fail serentak. 
      // Untuk stabiliti (mengelakkan Race Conditions apabila 8 gambar dikemaskini serentak ke 1 document), 
      // lebih baik client App yang handle proses penyimpanan URL ke Firestore selepas WebP selesai.
      // Dalam onFinalize ini, kita cuma sediakan gambar WebP di backend.
      
      fs.unlinkSync(tempFilePath);
      fs.unlinkSync(tempWebpPath);
      await bucket.file(filePath).delete();
      
      return null;
    } catch (error) {
      functions.logger.error('Error during image processing workflow', error);
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      if (fs.existsSync(tempWebpPath)) fs.unlinkSync(tempWebpPath);
      return null;
    }
  });
