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

import com.arthenica.ffmpegkit.FFprobeKit;
import com.arthenica.ffmpegkit.MediaInformationSession;
import com.arthenica.ffmpegkit.MediaInformation;
import com.arthenica.ffmpegkit.StreamInformation;
import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import org.json.JSONObject;

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

    @PluginMethod
    public void getEmbeddedSubtitles(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Path is required");
            return;
        }

        try {
            MediaInformationSession session = FFprobeKit.getMediaInformation(path);
            MediaInformation info = session.getMediaInformation();
            JSArray subs = new JSArray();

            if (info != null) {
                java.util.List<StreamInformation> streams = info.getStreams();
                for (StreamInformation stream : streams) {
                    if ("subtitle".equalsIgnoreCase(stream.getType())) {
                        JSObject sub = new JSObject();
                        sub.put("index", stream.getIndex());
                        sub.put("codec", stream.getCodec());
                        
                        JSONObject tags = stream.getTags();
                        String lang = "unknown";
                        String title = "Embedded Subtitle";
                        
                        if (tags != null) {
                            lang = tags.optString("language", "unknown");
                            title = tags.optString("title", title);
                        }
                        
                        sub.put("language", lang);
                        sub.put("title", title);
                        subs.put(sub);
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("subtitles", subs);
            call.resolve(ret);
        } catch(Exception e) {
            call.reject("Failed to get embedded subtitles", e);
        }
    }

    @PluginMethod
    public void extractSubtitle(PluginCall call) {
        String path = call.getString("path");
        Integer streamIndex = call.getInt("index");
        
        if (path == null || streamIndex == null) {
            call.reject("Path and index are required");
            return;
        }

        try {
            java.io.File cacheDir = getContext().getCacheDir();
            String outPath = new java.io.File(cacheDir, "extracted_sub_" + streamIndex + "_" + System.currentTimeMillis() + ".vtt").getAbsolutePath();
            
            // WebVTT is the target format
            String cmd = "-i \"" + path + "\" -map 0:" + streamIndex + " -c:s webvtt -y \"" + outPath + "\"";
            
            FFmpegSession session = FFmpegKit.execute(cmd);
            if (session.getReturnCode().isValueSuccess()) {
                JSObject ret = new JSObject();
                ret.put("path", outPath);
                call.resolve(ret);
            } else {
                call.reject("FFmpeg extraction failed: " + session.getFailStackTrace());
            }
        } catch(Exception e) {
            call.reject("Extraction exception", e);
        }
    }
}
