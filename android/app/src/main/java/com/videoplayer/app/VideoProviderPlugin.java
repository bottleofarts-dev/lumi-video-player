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

    @PluginMethod
    public void getEmbeddedSubtitles(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Path is required");
            return;
        }

        try {
            android.media.MediaExtractor extractor = new android.media.MediaExtractor();
            if (path.startsWith("content://")) {
                extractor.setDataSource(getContext(), android.net.Uri.parse(path), null);
            } else {
                java.io.File file = new java.io.File(path);
                if (file.exists()) {
                    extractor.setDataSource(path);
                } else {
                    call.reject("File does not exist: " + path);
                    return;
                }
            }

            java.util.ArrayList<JSObject> subsList = new java.util.ArrayList<>();
            int numTracks = extractor.getTrackCount();

            for (int i = 0; i < numTracks; i++) {
                android.media.MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(android.media.MediaFormat.KEY_MIME);
                if (mime != null && (mime.startsWith("text/") || mime.contains("subrip") || mime.contains("ass") || mime.contains("pgs") || mime.contains("ttml"))) {
                    JSObject sub = new JSObject();
                    sub.put("index", i);
                    sub.put("codec", mime);
                    
                    String language = format.containsKey(android.media.MediaFormat.KEY_LANGUAGE) ? format.getString(android.media.MediaFormat.KEY_LANGUAGE) : "unknown";
                    sub.put("language", language);
                    
                    String title = format.containsKey("title") ? format.getString("title") : "Subtitle Track " + i;
                    sub.put("title", title);
                    
                    subsList.add(sub);
                }
            }
            extractor.release();
            JSArray subs = new JSArray();
            for(JSObject o : subsList) subs.put(o);
            JSObject ret = new JSObject();
            ret.put("subtitles", subs);
            call.resolve(ret);
        } catch(Exception e) {
            call.reject("Failed to get embedded subtitles", e);
        }
    }

    private String formatTime(long timeUs) {
        long totalMs = timeUs / 1000;
        long ms = totalMs % 1000;
        long s = (totalMs / 1000) % 60;
        long m = (totalMs / (1000 * 60)) % 60;
        long h = totalMs / (1000 * 60 * 60);
        return String.format(java.util.Locale.US, "%02d:%02d:%02d.%03d", h, m, s, ms);
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
            android.media.MediaExtractor extractor = new android.media.MediaExtractor();
            if (path.startsWith("content://")) {
                extractor.setDataSource(getContext(), android.net.Uri.parse(path), null);
            } else {
                java.io.File file = new java.io.File(path);
                if (file.exists()) {
                    extractor.setDataSource(path);
                } else {
                    call.reject("File does not exist: " + path);
                    return;
                }
            }
            extractor.selectTrack(streamIndex);
            
            android.media.MediaFormat format = extractor.getTrackFormat(streamIndex);
            String mime = format.getString(android.media.MediaFormat.KEY_MIME);

            java.io.File cacheDir = getContext().getCacheDir();
            java.io.File outFile = new java.io.File(cacheDir, "extracted_sub_" + streamIndex + "_" + System.currentTimeMillis() + ".vtt");
            
            java.io.FileOutputStream fos = new java.io.FileOutputStream(outFile);
            
            // Write WebVTT header
            fos.write("WEBVTT\n\n".getBytes("UTF-8"));

            java.nio.ByteBuffer buffer = java.nio.ByteBuffer.allocate(2 * 1024 * 1024);
            int blockIndex = 1;
            while (true) {
                int sampleSize = extractor.readSampleData(buffer, 0);
                if (sampleSize < 0) {
                    break;
                }
                long presentationTimeUs = extractor.getSampleTime();
                
                byte[] data = new byte[sampleSize];
                buffer.get(data);
                
                String textData = new String(data, "UTF-8");
                // For subrip inside mkv, the text might already include coordinates. Let's just write VTT timing
                fos.write((blockIndex + "\n").getBytes("UTF-8"));
                fos.write((formatTime(presentationTimeUs) + " --> " + formatTime(presentationTimeUs + 5000000) + "\n").getBytes("UTF-8"));
                // In a perfect world we'd get sample duration. As this is a fallback native extractor, 5 sec is a rough bound
                // Usually players don't use 5 sec, but wait, textData for ASS often includes the timestamps inside the payload.
                // We're wrapping it in WebVTT anyway.
                fos.write(textData.getBytes("UTF-8"));
                fos.write("\n\n".getBytes("UTF-8"));

                extractor.advance();
                buffer.clear();
                blockIndex++;
            }
            
            fos.close();
            extractor.release();
            
            JSObject ret = new JSObject();
            ret.put("path", outFile.getAbsolutePath());
            call.resolve(ret);
        } catch(Exception e) {
            call.reject("Extraction exception", e);
        }
    }
}
