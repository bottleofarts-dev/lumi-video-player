package com.videoplayer.app;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.Manifest;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "VideoProvider",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE },
            alias = "storage"
        ),
        @Permission(
            strings = { Manifest.permission.READ_MEDIA_VIDEO },
            alias = "media"
        )
    }
)
public class VideoProviderPlugin extends Plugin {

    @PluginMethod
    public void getVideos(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            if (getPermissionState("media") != com.getcapacitor.PermissionState.GRANTED) {
                requestPermissionForAlias("media", call, "mediaPermsCallback");
            } else {
                loadVideos(call);
            }
        } else {
            if (getPermissionState("storage") != com.getcapacitor.PermissionState.GRANTED) {
                requestPermissionForAlias("storage", call, "storagePermsCallback");
            } else {
                loadVideos(call);
            }
        }
    }

    @PermissionCallback
    private void mediaPermsCallback(PluginCall call) {
        if (getPermissionState("media") == com.getcapacitor.PermissionState.GRANTED) {
            loadVideos(call);
        } else {
            call.reject("Media permission is required to read videos");
        }
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        if (getPermissionState("storage") == com.getcapacitor.PermissionState.GRANTED) {
            loadVideos(call);
        } else {
            call.reject("Storage permission is required to read videos");
        }
    }

    private void loadVideos(PluginCall call) {
        JSArray videos = new JSArray();
        
        String[] projection = new String[] {
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.DISPLAY_NAME,
            MediaStore.Video.Media.DURATION,
            MediaStore.Video.Media.DATA,
            MediaStore.Video.Media.BUCKET_DISPLAY_NAME
        };
        
        Uri collection;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        } else {
            collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
        }

        try (Cursor cursor = getContext().getContentResolver().query(
            collection,
            projection,
            null,
            null,
            MediaStore.Video.Media.DATE_ADDED + " DESC"
        )) {
            if (cursor != null) {
                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID);
                int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME);
                int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION);
                int dataColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATA);
                int bucketColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.BUCKET_DISPLAY_NAME);

                while (cursor.moveToNext()) {
                    long id = cursor.getLong(idColumn);
                    String name = cursor.getString(nameColumn);
                    long duration = cursor.getLong(durationColumn);
                    String dataPath = cursor.getString(dataColumn);
                    String bucketName = cursor.getString(bucketColumn);

                    Uri contentUri = ContentUris.withAppendedId(collection, id);

                    JSObject video = new JSObject();
                    video.put("id", id);
                    video.put("title", name);
                    video.put("duration", duration);
                    video.put("path", dataPath != null ? dataPath : contentUri.toString());
                    video.put("album", bucketName != null ? bucketName : "Gallery");
                    
                    if (dataPath != null) {
                        int lastDot = dataPath.lastIndexOf('.');
                        if (lastDot > 0) {
                            String basePath = dataPath.substring(0, lastDot);
                            java.io.File srtFile = new java.io.File(basePath + ".srt");
                            java.io.File vttFile = new java.io.File(basePath + ".vtt");
                            
                            if (srtFile.exists()) {
                                video.put("subtitle", srtFile.getAbsolutePath());
                            } else if (vttFile.exists()) {
                                video.put("subtitle", vttFile.getAbsolutePath());
                            }
                        }
                    }

                    java.io.File cacheDir = getContext().getCacheDir();
                    java.io.File thumbFile = new java.io.File(cacheDir, "thumb_" + id + ".jpg");
                    
                    if (thumbFile.exists()) {
                        video.put("thumbnail", thumbFile.getAbsolutePath());
                    } else {
                        android.graphics.Bitmap thumbnail = null;
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                            try {
                                thumbnail = getContext().getContentResolver().loadThumbnail(
                                    contentUri, new android.util.Size(320, 240), null);
                            } catch (java.io.IOException e) {
                                // ignore
                            }
                        } else {
                            thumbnail = MediaStore.Video.Thumbnails.getThumbnail(
                                getContext().getContentResolver(), id, MediaStore.Video.Thumbnails.MINI_KIND, null);
                        }

                        if (thumbnail != null) {
                            try {
                                java.io.FileOutputStream fos = new java.io.FileOutputStream(thumbFile);
                                thumbnail.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, fos);
                                fos.close();
                                video.put("thumbnail", thumbFile.getAbsolutePath());
                            } catch (Exception e) {
                               // ignore
                            }
                        }
                    }

                    videos.put(video);
                }
            }
        } catch (Exception e) {
            call.reject("Failed to query videos", e);
            return;
        }

        JSObject ret = new JSObject();
        ret.put("videos", videos);
        call.resolve(ret);
    }
}
