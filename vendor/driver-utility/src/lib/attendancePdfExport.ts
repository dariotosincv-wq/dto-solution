import type jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const exportAttendancePdf = async (pdf: jsPDF, fileName: string): Promise<'browser'|'shared'> => {
  if (!Capacitor.isNativePlatform()) { pdf.save(fileName); return 'browser'; }
  const dataUri = pdf.output('datauristring');
  const path = `turni-driver/${fileName}`;
  await Filesystem.mkdir({ path: 'turni-driver', directory: Directory.Cache, recursive: true }).catch(() => undefined);
  await Filesystem.writeFile({ path, data: dataUri.slice(dataUri.indexOf(',') + 1), directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({ title: 'Turni Driver', text: 'PDF Turni Driver', files: [uri], dialogTitle: 'Condividi PDF Turni Driver' });
  return 'shared';
};
