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
            MediaStore.Video.Media.DURATION
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

                while (cursor.moveToNext()) {
                    long id = cursor.getLong(idColumn);
                    String name = cursor.getString(nameColumn);
                    long duration = cursor.getLong(durationColumn);

                    Uri contentUri = ContentUris.withAppendedId(collection, id);

                    JSObject video = new JSObject();
                    video.put("id", id);
                    video.put("title", name);
                    video.put("duration", duration);
                    video.put("path", contentUri.toString());
                    
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
