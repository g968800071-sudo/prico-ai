package studio.pricop.pricoai;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;

/** JPEG frames plus PCM become an H.264 + AAC MP4. Platform MediaCodec only. No network and no WebM remux. */
@CapacitorPlugin(name = "PricoExport")
public class PricoExportPlugin extends Plugin {
    private Session session;

    @PluginMethod
    public void readAsset(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.contains("..") || path.startsWith("/")) { call.reject("bad path"); return; }
        try (InputStream in = getContext().getAssets().open("public/" + path)) {
            byte[] data = readStream(in);
            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
            ret.put("bytes", data.length);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("readAsset " + path + ": " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void begin(PluginCall call) {
        try {
            releaseSession();
            String uri = call.getString("uri");
            if (uri == null) throw new IllegalArgumentException("uri");
            File dir = new File(android.net.Uri.parse(uri).getPath());
            int w = even(call.getInt("width", 1080));
            int h = even(call.getInt("height", 1920));
            int fps = Math.max(1, call.getInt("fps", 30));
            int sampleRate = call.getInt("sampleRate", 44100);
            int channels = Math.max(1, call.getInt("channels", 2));
            session = Session.start(dir, w, h, fps, sampleRate, channels);
            JSObject ret = new JSObject();
            ret.put("width", w);
            ret.put("height", h);
            ret.put("fps", fps);
            call.resolve(ret);
        } catch (Exception e) {
            releaseSession();
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void frame(PluginCall call) {
        try {
            if (session == null) throw new IllegalStateException("begin");
            int repeat = Math.max(1, call.getInt("repeat", 1));
            session.encodeJpeg(new File(session.dir, "frame.jpg"), repeat);
            JSObject ret = new JSObject();
            ret.put("frames", session.frameIndex);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void audio(PluginCall call) {
        try {
            if (session == null) throw new IllegalStateException("begin");
            String data = call.getString("data");
            if (data == null) throw new IllegalArgumentException("data");
            session.appendPcm(Base64.decode(data, Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void finish(PluginCall call) {
        try {
            if (session == null) throw new IllegalStateException("begin");
            File out = session.finish();
            String copyTo = call.getString("copyTo");
            if (copyTo != null) {
                File dest = new File(android.net.Uri.parse(copyTo).getPath());
                File parent = dest.getParentFile();
                if (parent != null) parent.mkdirs();
                try (FileInputStream in = new FileInputStream(out); FileOutputStream fos = new FileOutputStream(dest)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) >= 0) fos.write(buf, 0, n);
                }
            }
            byte[] head = new byte[16];
            try (FileInputStream in = new FileInputStream(out)) { in.read(head); }
            StringBuilder hex = new StringBuilder();
            for (byte b : head) hex.append(String.format("%02x", b & 255));
            JSObject ret = new JSObject();
            ret.put("path", out.getAbsolutePath());
            ret.put("bytes", out.length());
            ret.put("width", session.w);
            ret.put("height", session.h);
            ret.put("frames", session.frameIndex);
            ret.put("header", hex.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage());
        } finally {
            releaseSession();
        }
    }

    private void releaseSession() {
        if (session != null) { try { session.close(); } catch (Exception ignored) {} session = null; }
    }

    @PluginMethod
    public void mux(PluginCall call) {
        try {
            String uri = call.getString("uri");
            if (uri == null) throw new IllegalArgumentException("uri");
            File dir = new File(android.net.Uri.parse(uri).getPath());
            int frames = call.getInt("frames", 0);
            int w = even(call.getInt("width", 540));
            int h = even(call.getInt("height", 960));
            int fps = Math.max(1, call.getInt("fps", 8));
            int sampleRate = call.getInt("sampleRate", 44100);
            int channels = Math.max(1, call.getInt("channels", 2));
            boolean hasAudio = Boolean.TRUE.equals(call.getBoolean("hasAudio", Boolean.FALSE));
            if (frames < 1) throw new IllegalArgumentException("frames");
            File out = new File(dir, "out.mp4");
            if (out.exists() && !out.delete()) throw new IllegalStateException("replace");
            encode(dir, frames, w, h, fps, sampleRate, channels, hasAudio, out);
            if (!out.exists() || out.length() < 800) throw new IllegalStateException("empty mp4");
            JSObject ret = new JSObject();
            ret.put("path", out.getAbsolutePath());
            ret.put("bytes", out.length());
            ret.put("width", w);
            ret.put("height", h);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    private static int even(int n) { return Math.max(2, n - (n & 1)); }

    private void encode(File dir, int frames, int w, int h, int fps, int sampleRate, int channels, boolean hasAudio, File out) throws Exception {
        MediaCodec venc = MediaCodec.createEncoderByType("video/avc");
        int color = pickColor(venc);
        boolean planar = color == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar;
        MediaFormat vf = MediaFormat.createVideoFormat("video/avc", w, h);
        vf.setInteger(MediaFormat.KEY_COLOR_FORMAT, color);
        vf.setInteger(MediaFormat.KEY_BIT_RATE, 1_600_000);
        vf.setInteger(MediaFormat.KEY_FRAME_RATE, fps);
        vf.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1);
        vf.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, w * h * 3 / 2);
        try {
            venc.configure(vf, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        } catch (Exception first) {
            venc.release();
            venc = MediaCodec.createEncoderByType("video/avc");
            color = MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible;
            planar = false;
            vf.setInteger(MediaFormat.KEY_COLOR_FORMAT, color);
            venc.configure(vf, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        }
        venc.start();
        MediaCodec aenc = null;
        if (hasAudio) {
            MediaFormat af = MediaFormat.createAudioFormat("audio/mp4a-latm", sampleRate, channels);
            af.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            af.setInteger(MediaFormat.KEY_BIT_RATE, 96_000);
            af.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);
            aenc = MediaCodec.createEncoderByType("audio/mp4a-latm");
            aenc.configure(af, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            aenc.start();
        }
        MediaMuxer muxer = new MediaMuxer(out.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        ArrayList<Sample> video = new ArrayList<>();
        ArrayList<Sample> audio = new ArrayList<>();
        MediaFormat vFormat = null;
        MediaFormat aFormat = null;
        boolean started = false;
        try {
            boolean videoEos = false;
            for (int i = 0; i < frames; i++) {
                File jpg = new File(dir, String.format("f%04d.jpg", i));
                Bitmap bmp = BitmapFactory.decodeFile(jpg.getAbsolutePath());
                if (bmp == null) throw new IllegalStateException("bad frame " + i);
                Bitmap scaled = bmp.getWidth() == w && bmp.getHeight() == h ? bmp : Bitmap.createScaledBitmap(bmp, w, h, true);
                byte[] yuv = planar ? toI420(scaled) : toNV12(scaled);
                if (scaled != bmp) scaled.recycle();
                bmp.recycle();
                boolean last = i == frames - 1;
                queue(venc, yuv, i * 1_000_000L / fps, last);
                Drain d = drain(venc, last);
                video.addAll(d.samples);
                if (d.format != null) vFormat = d.format;
                videoEos = videoEos || d.eos;
            }
            if (!videoEos) {
                Drain d = drain(venc, true);
                video.addAll(d.samples);
                if (d.format != null) vFormat = d.format;
            }
            if (vFormat == null) vFormat = venc.getOutputFormat();
            if (aenc != null) {
                byte[] pcm = readAll(new File(dir, "audio.pcm"));
                int chunk = 2048 * channels * 2;
                int off = 0;
                long pts = 0;
                int bytesPerSec = sampleRate * channels * 2;
                boolean audioEos = false;
                while (off < pcm.length) {
                    int n = Math.min(chunk, pcm.length - off);
                    n -= n % (channels * 2);
                    if (n <= 0) break;
                    byte[] piece = new byte[n];
                    System.arraycopy(pcm, off, piece, 0, n);
                    boolean last = off + n >= pcm.length;
                    queue(aenc, piece, pts, last);
                    pts += n * 1_000_000L / bytesPerSec;
                    off += n;
                    Drain d = drain(aenc, last);
                    audio.addAll(d.samples);
                    if (d.format != null) aFormat = d.format;
                    audioEos = audioEos || d.eos;
                }
                if (!audioEos) {
                    Drain d = drain(aenc, true);
                    audio.addAll(d.samples);
                    if (d.format != null) aFormat = d.format;
                }
                if (aFormat == null) aFormat = aenc.getOutputFormat();
            }
            if (video.isEmpty()) throw new IllegalStateException("no video samples color=" + color);
            int vTrack = muxer.addTrack(vFormat);
            int aTrack = aFormat != null ? muxer.addTrack(aFormat) : -1;
            muxer.start();
            started = true;
            for (Sample s : video) muxer.writeSampleData(vTrack, s.data, s.info);
            if (aTrack >= 0) for (Sample s : audio) muxer.writeSampleData(aTrack, s.data, s.info);
        } finally {
            try { venc.stop(); } catch (Exception ignored) {}
            venc.release();
            if (aenc != null) { try { aenc.stop(); } catch (Exception ignored) {} aenc.release(); }
            if (started) { try { muxer.stop(); } catch (Exception ignored) {} }
            muxer.release();
        }
    }

    private static int pickColor(MediaCodec codec) {
        MediaCodecInfo.CodecCapabilities caps = codec.getCodecInfo().getCapabilitiesForType("video/avc");
        for (int c : caps.colorFormats) if (c == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar) return c;
        for (int c : caps.colorFormats) if (c == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar) return c;
        return caps.colorFormats.length > 0 ? caps.colorFormats[0] : MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar;
    }

    private static void queue(MediaCodec codec, byte[] data, long ptsUs, boolean eos) {
        int in = -1;
        for (int i = 0; i < 50 && in < 0; i++) in = codec.dequeueInputBuffer(100_000);
        if (in < 0) throw new IllegalStateException("no input buffer");
        ByteBuffer buf = codec.getInputBuffer(in);
        if (buf.capacity() < data.length) throw new IllegalStateException("input " + buf.capacity() + " < " + data.length);
        buf.clear();
        buf.put(data);
        codec.queueInputBuffer(in, 0, data.length, Math.max(0, ptsUs), eos ? MediaCodec.BUFFER_FLAG_END_OF_STREAM : 0);
    }

    private static Drain drain(MediaCodec codec, boolean untilEos) {
        Drain out = new Drain();
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        long deadline = System.nanoTime() + (untilEos ? 8_000_000_000L : 150_000_000L);
        while (System.nanoTime() < deadline) {
            int idx = codec.dequeueOutputBuffer(info, 20_000);
            if (idx == MediaCodec.INFO_TRY_AGAIN_LATER) { if (!untilEos) return out; continue; }
            if (idx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) { out.format = codec.getOutputFormat(); continue; }
            if (idx < 0) continue;
            ByteBuffer buf = codec.getOutputBuffer(idx);
            boolean eos = (info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
            if (info.size > 0 && (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && buf != null) {
                byte[] copy = new byte[info.size];
                buf.position(info.offset);
                buf.limit(info.offset + info.size);
                buf.get(copy);
                MediaCodec.BufferInfo bi = new MediaCodec.BufferInfo();
                bi.set(0, copy.length, info.presentationTimeUs, info.flags & ~MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                out.samples.add(new Sample(ByteBuffer.wrap(copy), bi));
            }
            codec.releaseOutputBuffer(idx, false);
            if (eos) { out.eos = true; return out; }
        }
        if (untilEos) throw new IllegalStateException("encoder timeout");
        return out;
    }

    private static byte[] readAll(File f) throws Exception {
        try (FileInputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        }
    }

    private static byte[] toNV12(Bitmap bmp) { return yuv(bmp, false); }
    private static byte[] toI420(Bitmap bmp) { return yuv(bmp, true); }

    private static byte[] yuv(Bitmap bmp, boolean planar) {
        int w = bmp.getWidth(), h = bmp.getHeight();
        int[] argb = new int[w * h];
        bmp.getPixels(argb, 0, w, 0, 0, w, h);
        byte[] yuv = new byte[w * h * 3 / 2];
        int uPlane = w * h;
        int vPlane = uPlane + (w * h) / 4;
        int uv = uPlane;
        for (int j = 0; j < h; j++) {
            for (int i = 0; i < w; i++) {
                int c = argb[j * w + i];
                int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
                int y = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
                yuv[j * w + i] = (byte) Math.max(0, Math.min(255, y));
                if ((j & 1) == 0 && (i & 1) == 0) {
                    int u = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                    int v = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                    if (planar) {
                        int chroma = (j / 2) * (w / 2) + (i / 2);
                        yuv[uPlane + chroma] = (byte) Math.max(0, Math.min(255, u));
                        yuv[vPlane + chroma] = (byte) Math.max(0, Math.min(255, v));
                    } else if (uv + 1 < yuv.length) {
                        yuv[uv++] = (byte) Math.max(0, Math.min(255, u));
                        yuv[uv++] = (byte) Math.max(0, Math.min(255, v));
                    }
                }
            }
        }
        return yuv;
    }

    private static byte[] readStream(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) >= 0) bos.write(buf, 0, n);
        return bos.toByteArray();
    }

    private static final class Session {
        final File dir; final int w, h, fps, sampleRate, channels; final boolean planar;
        final MediaCodec venc; final MediaCodec aenc;
        final ArrayList<Sample> video = new ArrayList<>();
        final ArrayList<Sample> audio = new ArrayList<>();
        MediaFormat vFormat, aFormat;
        int frameIndex;
        FileOutputStream pcmOut;
        boolean closed;

        Session(File dir, int w, int h, int fps, int sampleRate, int channels, boolean planar, MediaCodec venc, MediaCodec aenc) {
            this.dir = dir; this.w = w; this.h = h; this.fps = fps; this.sampleRate = sampleRate; this.channels = channels;
            this.planar = planar; this.venc = venc; this.aenc = aenc;
        }

        static Session start(File dir, int w, int h, int fps, int sampleRate, int channels) throws Exception {
            MediaCodec venc = MediaCodec.createEncoderByType("video/avc");
            int color = pickColor(venc);
            boolean planar = color == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar;
            int bitrate = w >= 1000 ? 5_000_000 : 2_800_000;
            MediaFormat vf = MediaFormat.createVideoFormat("video/avc", w, h);
            vf.setInteger(MediaFormat.KEY_COLOR_FORMAT, color);
            vf.setInteger(MediaFormat.KEY_BIT_RATE, bitrate);
            vf.setInteger(MediaFormat.KEY_FRAME_RATE, fps);
            vf.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1);
            vf.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, w * h * 3 / 2);
            try {
                venc.configure(vf, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            } catch (Exception first) {
                venc.release();
                venc = MediaCodec.createEncoderByType("video/avc");
                color = MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible;
                planar = false;
                vf.setInteger(MediaFormat.KEY_COLOR_FORMAT, color);
                venc.configure(vf, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            }
            venc.start();
            MediaFormat af = MediaFormat.createAudioFormat("audio/mp4a-latm", sampleRate, channels);
            af.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            af.setInteger(MediaFormat.KEY_BIT_RATE, 128_000);
            af.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);
            MediaCodec aenc = MediaCodec.createEncoderByType("audio/mp4a-latm");
            aenc.configure(af, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            aenc.start();
            Session s = new Session(dir, w, h, fps, sampleRate, channels, planar, venc, aenc);
            s.pcmOut = new FileOutputStream(new File(dir, "audio.pcm"));
            return s;
        }

        void encodeJpeg(File jpg, int repeat) throws Exception {
            Bitmap bmp = BitmapFactory.decodeFile(jpg.getAbsolutePath());
            if (bmp == null) throw new IllegalStateException("bad frame");
            Bitmap scaled = bmp.getWidth() == w && bmp.getHeight() == h ? bmp : Bitmap.createScaledBitmap(bmp, w, h, true);
            byte[] yuv = planar ? toI420(scaled) : toNV12(scaled);
            if (scaled != bmp) scaled.recycle();
            bmp.recycle();
            jpg.delete();
            for (int i = 0; i < repeat; i++) {
                queue(venc, yuv, frameIndex * 1_000_000L / fps, false);
                Drain d = drain(venc, false);
                video.addAll(d.samples);
                if (d.format != null) vFormat = d.format;
                frameIndex++;
            }
        }

        void appendPcm(byte[] data) throws Exception { pcmOut.write(data); }

        File finish() throws Exception {
            pcmOut.close();
            queue(venc, new byte[0], Math.max(0, frameIndex - 1) * 1_000_000L / fps, true);
            Drain vd = drain(venc, true);
            video.addAll(vd.samples);
            if (vd.format != null) vFormat = vd.format;
            if (vFormat == null) vFormat = venc.getOutputFormat();
            byte[] pcm = readAll(new File(dir, "audio.pcm"));
            int chunk = 2048 * channels * 2;
            int off = 0; long pts = 0; int bytesPerSec = sampleRate * channels * 2; boolean audioEos = false;
            while (off < pcm.length) {
                int n = Math.min(chunk, pcm.length - off);
                n -= n % (channels * 2);
                if (n <= 0) break;
                byte[] piece = new byte[n];
                System.arraycopy(pcm, off, piece, 0, n);
                boolean last = off + n >= pcm.length;
                queue(aenc, piece, pts, last);
                pts += n * 1_000_000L / bytesPerSec;
                off += n;
                Drain d = drain(aenc, last);
                audio.addAll(d.samples);
                if (d.format != null) aFormat = d.format;
                audioEos = audioEos || d.eos;
            }
            if (!audioEos) {
                Drain d = drain(aenc, true);
                audio.addAll(d.samples);
                if (d.format != null) aFormat = d.format;
            }
            if (aFormat == null) aFormat = aenc.getOutputFormat();
            if (video.isEmpty()) throw new IllegalStateException("no video samples");
            File out = new File(dir, "out.mp4");
            if (out.exists()) out.delete();
            MediaMuxer muxer = new MediaMuxer(out.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            boolean started = false;
            try {
                int vTrack = muxer.addTrack(vFormat);
                int aTrack = muxer.addTrack(aFormat);
                muxer.start();
                started = true;
                for (Sample s : video) muxer.writeSampleData(vTrack, s.data, s.info);
                for (Sample s : audio) muxer.writeSampleData(aTrack, s.data, s.info);
            } finally {
                if (started) { try { muxer.stop(); } catch (Exception ignored) {} }
                muxer.release();
            }
            if (!out.exists() || out.length() < 800) throw new IllegalStateException("empty mp4");
            close();
            return out;
        }

        void close() {
            if (closed) return;
            closed = true;
            try { pcmOut.close(); } catch (Exception ignored) {}
            try { venc.stop(); } catch (Exception ignored) {}
            try { venc.release(); } catch (Exception ignored) {}
            try { aenc.stop(); } catch (Exception ignored) {}
            try { aenc.release(); } catch (Exception ignored) {}
        }
    }

    private static final class Sample {
        final ByteBuffer data; final MediaCodec.BufferInfo info;
        Sample(ByteBuffer d, MediaCodec.BufferInfo i) { data = d; info = i; }
    }
    private static final class Drain {
        final ArrayList<Sample> samples = new ArrayList<>();
        MediaFormat format; boolean eos;
    }
}
