package com.tas.tdt;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.json.JSONArray;
import org.json.JSONException;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Enregistre un fichier texte dans le dossier public "Téléchargements/TDT".
 * Sur Android 10+ (API 29+) via MediaStore (scoped storage), sinon écriture directe.
 * Le fichier est ainsi visible quand la tablette est branchée en USB (MTP).
 */
public class TdtMediaStore extends CordovaPlugin {

    @Override
    public boolean execute(String action, JSONArray args, final CallbackContext cb) throws JSONException {
        if (!"saveToDownloads".equals(action)) {
            return false;
        }
        final String fileName = args.getString(0);
        final String mimeType = args.getString(1);
        final String content = args.getString(2);

        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                try {
                    String path = save(fileName, mimeType, content);
                    cb.success(path);
                } catch (Exception e) {
                    cb.error(e.getMessage() == null ? "Erreur enregistrement" : e.getMessage());
                }
            }
        });
        return true;
    }

    private String save(String fileName, String mimeType, String content) throws Exception {
        byte[] data = content.getBytes("UTF-8");
        String subDir = "TDT";

        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = cordova.getContext().getContentResolver();
            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;

            // Supprime un éventuel fichier du même nom (pour "écraser" au lieu de dupliquer).
            try {
                resolver.delete(collection,
                        MediaStore.Downloads.DISPLAY_NAME + "=?",
                        new String[]{fileName});
            } catch (Exception ignore) {
            }

            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/" + subDir);

            Uri uri = resolver.insert(collection, values);
            if (uri == null) {
                throw new Exception("Impossible de créer le fichier dans Téléchargements");
            }
            OutputStream os = resolver.openOutputStream(uri);
            os.write(data);
            os.flush();
            os.close();
            return "Téléchargements/" + subDir + "/" + fileName;
        } else {
            File dir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    subDir);
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File f = new File(dir, fileName);
            FileOutputStream fos = new FileOutputStream(f);
            fos.write(data);
            fos.flush();
            fos.close();
            return f.getAbsolutePath();
        }
    }
}
