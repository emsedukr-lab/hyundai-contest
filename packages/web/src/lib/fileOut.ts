import { isNativeApp } from './platform';

/**
 * Hands a file this phone just made (a backup, a friend's share) to the user.
 *
 * - Web: a download, as before.
 * - Phone app: a web view has no downloads, so the file is written to the app's cache folder, offered through the
 *   system share sheet (which includes "save to files"), and removed again whether or not it was sent.
 *
 * Returns false when the user closed the share sheet without choosing anything.
 */
export async function saveFile(file: File, share?: { title?: string; text?: string }): Promise<boolean> {
  if (!isNativeApp) {
    downloadFile(file);
    return true;
  }
  const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const path = `out/${file.name}`;
  const { uri } = await Filesystem.writeFile({ path, data: await file.text(), directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
  try {
    await Share.share({ files: [uri], title: share?.title, text: share?.text });
    return true;
  } catch {
    return false; // the sheet was dismissed
  } finally {
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined);
  }
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000); // revoking at once can abort the download on some mobile browsers
}
