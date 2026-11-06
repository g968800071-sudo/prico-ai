import Foundation
import AVFoundation
import CoreMedia
import CoreImage
import CoreText
import ImageIO

enum PricoReelError: Error, LocalizedError {
    case message(String)
    var errorDescription: String? { switch self { case .message(let s): return s } }
}

enum PricoReelExporter {
    struct Clip {
        let kind: String
        let file: String
        let bundle: Bool
        let start: Double
        let dur: Double
        var video: [CGImage] = []
        var videoDur: Double = 1
        var still: CGImage?
    }

    static func export(project raw: String, copyTo: String?) throws -> [String: Any] {
        let t0 = CFAbsoluteTimeGetCurrent()
        guard let data = raw.data(using: .utf8),
              let spec = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw PricoReelError.message("project") }
        let width = even(spec["width"] as? Int ?? 1080)
        let height = even(spec["height"] as? Int ?? 1920)
        let fps = max(1, spec["fps"] as? Int ?? 30)
        let fade = spec["fade"] as? Double ?? 0.4
        let total = spec["total"] as? Double ?? 1
        let music = spec["music"] as? String ?? ""
        let cache = fileURL(spec["cache"] as? String ?? "")
        var clips = (spec["clips"] as? [[String: Any]] ?? []).map {
            Clip(kind: $0["kind"] as? String ?? "image",
                 file: $0["file"] as? String ?? "",
                 bundle: $0["bundle"] as? Bool ?? false,
                 start: $0["start"] as? Double ?? 0,
                 dur: $0["dur"] as? Double ?? 1)
        }
        let texts = spec["texts"] as? [[String: Any]] ?? []
        let captions = spec["captions"] as? [[String: Any]] ?? []
        NSLog("PRICO export start %dx%d fps %d total %.2f clips %d", width, height, fps, total, clips.count)
        let ci = CIContext(options: nil)
        for i in clips.indices {
            let url = try resolve(clips[i].file, bundle: clips[i].bundle, cache: cache)
            NSLog("PRICO export source %@ %@", clips[i].kind, url.path)
            if clips[i].kind == "video" {
                let (images, dur) = try readVideo(url, context: ci)
                if images.isEmpty { throw PricoReelError.message("no video frames") }
                clips[i].video = images
                clips[i].videoDur = dur
                NSLog("PRICO export decoded video frames %d dur %.2f", images.count, dur)
            } else {
                guard let image = stillImage(url) else { throw PricoReelError.message("still \(clips[i].file)") }
                clips[i].still = image
            }
        }
        let out = cache.appendingPathComponent("out.mp4")
        if FileManager.default.fileExists(atPath: out.path) { try FileManager.default.removeItem(at: out) }
        let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
        writer.movieFragmentInterval = .invalid
        let bitrate = width >= 1000 ? 5_000_000 : 2_800_000
        let videoIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: bitrate,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264BaselineAutoLevel,
                AVVideoMaxKeyFrameIntervalKey: fps
            ]
        ])
        videoIn.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: videoIn, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height
        ])
        writer.add(videoIn)
        let musicURL = try resolve(music, bundle: true, cache: cache)
        NSLog("PRICO export music %@", musicURL.path)
        let pcm = try readPCM(musicURL)
        NSLog("PRICO export pcm bytes %d", pcm.data.count)
        let audioIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: pcm.rate,
            AVNumberOfChannelsKey: pcm.channels,
            AVEncoderBitRateKey: 128_000
        ])
        audioIn.expectsMediaDataInRealTime = false
        writer.add(audioIn)
        guard writer.startWriting() else { throw writer.error ?? PricoReelError.message("writer") }
        writer.startSession(atSourceTime: .zero)
        let frames = max(1, Int((total * Double(fps)).rounded()))
        let budget = min(380.0, max(90.0, Double(frames) * 0.25))
        try appendVideo(frames: frames, fps: fps, total: total, fade: fade, clips: clips, texts: texts, captions: captions, width: width, height: height, input: videoIn, adaptor: adaptor, writer: writer, budget: budget)
        try appendAudio(pcm, seconds: total, input: audioIn, writer: writer, budget: 60)
        let done = DispatchSemaphore(value: 0)
        writer.finishWriting { done.signal() }
        if done.wait(timeout: .now() + 30) == .timedOut { throw PricoReelError.message("finish timeout") }
        if writer.status != .completed { throw writer.error ?? PricoReelError.message("finish \(writer.status.rawValue)") }
        if let copyTo, !copyTo.isEmpty {
            let dest = fileURL(copyTo)
            try? FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: dest.path) { try? FileManager.default.removeItem(at: dest) }
            try FileManager.default.copyItem(at: out, to: dest)
            NSLog("PRICO export copied %@", dest.path)
        }
        let size = (try FileManager.default.attributesOfItem(atPath: out.path)[.size] as? NSNumber)?.intValue ?? 0
        let head = try Data(contentsOf: out).prefix(16)
        let hex = head.map { String(format: "%02x", $0) }.joined()
        let elapsed = Int((CFAbsoluteTimeGetCurrent() - t0) * 1000)
        NSLog("PRICO export done bytes %d frames %d ms %d", size, frames, elapsed)
        return ["path": out.path, "bytes": size, "width": width, "height": height, "frames": frames, "fps": fps, "header": hex, "elapsedMs": elapsed, "engine": "avfoundation"]
    }

    private static func even(_ n: Int) -> Int { max(2, n - (n & 1)) }

    private static func fileURL(_ raw: String) -> URL {
        if let url = URL(string: raw), url.isFileURL { return url }
        let path = raw.hasPrefix("file://") ? String(raw.dropFirst(7)) : raw
        return URL(fileURLWithPath: path)
    }

    private static func bundleRoots() -> [URL] {
        [Bundle.main.bundleURL.appendingPathComponent("public"), Bundle.main.resourceURL?.appendingPathComponent("public")].compactMap { $0 }
    }

    private static func resolve(_ file: String, bundle: Bool, cache: URL) throws -> URL {
        if !bundle {
            let local = cache.appendingPathComponent(file)
            if FileManager.default.fileExists(atPath: local.path) { return local }
        }
        for root in bundleRoots() {
            let url = root.appendingPathComponent(file)
            if FileManager.default.fileExists(atPath: url.path) { return url }
        }
        let local = cache.appendingPathComponent(file)
        if FileManager.default.fileExists(atPath: local.path) { return local }
        throw PricoReelError.message("missing \(file)")
    }

    private static func stillImage(_ url: URL) -> CGImage? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(src, 0, nil)
    }

    private static func loadAsset(_ url: URL, media: AVMediaType) throws -> (AVURLAsset, AVAssetTrack, Double) {
        let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        let sem = DispatchSemaphore(value: 0)
        var tracks: [AVAssetTrack] = []
        var dur: Double = 0
        DispatchQueue.global(qos: .userInitiated).async {
            tracks = asset.tracks(withMediaType: media)
            let seconds = CMTimeGetSeconds(asset.duration)
            dur = seconds.isFinite ? seconds : 0
            sem.signal()
        }
        if sem.wait(timeout: .now() + 25) == .timedOut { throw PricoReelError.message("asset timeout \(url.lastPathComponent)") }
        guard let track = tracks.first else { throw PricoReelError.message("no \(media.rawValue) track") }
        return (asset, track, dur)
    }

    private static func readVideo(_ url: URL, context: CIContext) throws -> ([CGImage], Double) {
        let (asset, track, reported) = try loadAsset(url, media: .video)
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        output.alwaysCopiesSampleData = true
        reader.add(output)
        guard reader.startReading() else { throw reader.error ?? PricoReelError.message("reader") }
        var images: [CGImage] = []
        let deadline = CFAbsoluteTimeGetCurrent() + 30
        while CFAbsoluteTimeGetCurrent() < deadline {
            guard let sample = output.copyNextSampleBuffer() else { break }
            if let buf = CMSampleBufferGetImageBuffer(sample) {
                let ci = CIImage(cvPixelBuffer: buf)
                if let cg = context.createCGImage(ci, from: ci.extent) { images.append(cg) }
            }
        }
        if reader.status == .reading { throw PricoReelError.message("video decode timeout") }
        if images.isEmpty { throw reader.error ?? PricoReelError.message("no video frames") }
        var dur = reported
        if dur <= 0.05 {
            let rate = Double(track.nominalFrameRate)
            dur = rate > 1 ? Double(images.count) / rate : Double(images.count) / 12
        }
        return (images, max(0.1, dur))
    }

    private struct PCM { let data: Data; let rate: Int; let channels: Int }

    private static func readPCM(_ url: URL) throws -> PCM {
        let (asset, track, _) = try loadAsset(url, media: .audio)
        let reader = try AVAssetReader(asset: asset)
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 2,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false
        ]
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
        reader.add(output)
        guard reader.startReading() else { throw reader.error ?? PricoReelError.message("audio reader") }
        var data = Data()
        let deadline = CFAbsoluteTimeGetCurrent() + 30
        while CFAbsoluteTimeGetCurrent() < deadline {
            guard let sample = output.copyNextSampleBuffer() else { break }
            if let block = CMSampleBufferGetDataBuffer(sample) {
                var length = 0
                var ptr: UnsafeMutablePointer<Int8>?
                if CMBlockBufferGetDataPointer(block, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &ptr) == noErr, let ptr {
                    data.append(Data(bytes: ptr, count: length))
                }
            }
        }
        if reader.status == .reading { throw PricoReelError.message("audio decode timeout") }
        if data.count < 4 { throw PricoReelError.message("empty music") }
        return PCM(data: data, rate: 44100, channels: 2)
    }

    private static func appendVideo(frames: Int, fps: Int, total: Double, fade: Double, clips: [Clip], texts: [[String: Any]], captions: [[String: Any]], width: Int, height: Int, input: AVAssetWriterInput, adaptor: AVAssetWriterInputPixelBufferAdaptor, writer: AVAssetWriter, budget: Double) throws {
        let queue = DispatchQueue(label: "studio.pricop.export.video")
        let sem = DispatchSemaphore(value: 0)
        var writeError: String?
        var index = 0
        input.requestMediaDataWhenReady(on: queue) {
            while input.isReadyForMoreMediaData {
                if index >= frames {
                    input.markAsFinished()
                    sem.signal()
                    return
                }
                let frame = index
                autoreleasepool {
                    let time = min(total - 0.0001, Double(frame) / Double(fps))
                    if let buffer = drawFrame(clips: clips, time: time, fade: fade, texts: texts, captions: captions, width: width, height: height, pool: adaptor.pixelBufferPool) {
                        if !adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: CMTimeScale(fps))) {
                            writeError = writer.error?.localizedDescription ?? "append video \(frame)"
                            input.markAsFinished()
                        }
                    } else {
                        writeError = "pixel \(frame)"
                        input.markAsFinished()
                    }
                }
                if writeError != nil {
                    sem.signal()
                    return
                }
                index += 1
                if frame == 0 || frame % 150 == 0 { NSLog("PRICO export frame %d/%d", frame, frames) }
            }
        }
        if sem.wait(timeout: .now() + budget) == .timedOut { throw PricoReelError.message("video encode timeout \(index)/\(frames)") }
        if let writeError { throw PricoReelError.message(writeError) }
    }

    private static func drawFrame(clips: [Clip], time: Double, fade: Double, texts: [[String: Any]], captions: [[String: Any]], width: Int, height: Int, pool: CVPixelBufferPool?) -> CVPixelBuffer? {
        var pb: CVPixelBuffer?
        if let pool { CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb) }
        if pb == nil {
            let attrs = [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary
            CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, attrs, &pb)
        }
        guard let pb else { return nil }
        CVPixelBufferLockBaseAddress(pb, [])
        defer { CVPixelBufferUnlockBaseAddress(pb, []) }
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else { return nil }
        ctx.setFillColor(CGColor(srgbRed: 0.03, green: 0.03, blue: 0.05, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        ctx.translateBy(x: 0, y: CGFloat(height))
        ctx.scaleBy(x: 1, y: -1)
        for (clip, alpha) in layers(clips, time, fade) {
            let image = clip.kind == "video" ? frameImage(clip, time: time) : clip.still
            guard let image else { continue }
            ctx.saveGState()
            ctx.setAlpha(alpha)
            ctx.interpolationQuality = .medium
            ctx.draw(image, in: cover(image, width, height))
            ctx.restoreGState()
        }
        for item in texts {
            let start = item["start"] as? Double ?? 0
            let end = item["end"] as? Double ?? 1e9
            if time >= start && time <= end, let text = item["text"] as? String, !text.isEmpty {
                let y = CGFloat(item["y"] as? Double ?? 0.18) * CGFloat(height)
                draw(text, y: y, px: max(42, height / 18), width: width, in: ctx)
            }
        }
        for item in captions {
            let start = item["start"] as? Double ?? 0
            let end = item["end"] as? Double ?? 1e9
            if time >= start && time <= end, let text = item["text"] as? String, !text.isEmpty {
                draw(text, y: CGFloat(height) * 0.78, px: max(34, height / 24), width: width, in: ctx)
            }
        }
        return pb
    }

    private static func frameImage(_ clip: Clip, time: Double) -> CGImage? {
        guard !clip.video.isEmpty else { return nil }
        let local = time - clip.start
        let wrapped = local.truncatingRemainder(dividingBy: clip.videoDur)
        let pos = wrapped < 0 ? wrapped + clip.videoDur : wrapped
        let idx = min(clip.video.count - 1, max(0, Int(pos / clip.videoDur * Double(clip.video.count))))
        return clip.video[idx]
    }

    private static func layers(_ clips: [Clip], _ time: Double, _ fade: Double) -> [(Clip, CGFloat)] {
        let hits = clips.filter { time >= $0.start - 0.001 && time < $0.start + $0.dur }
        if hits.count < 2 { return hits.map { ($0, 1) } }
        let u = max(0, min(1, (time - hits[1].start) / max(0.05, fade)))
        return [(hits[0], CGFloat(1 - u)), (hits[1], CGFloat(u))]
    }

    private static func cover(_ image: CGImage, _ width: Int, _ height: Int) -> CGRect {
        let sw = CGFloat(image.width), sh = CGFloat(image.height)
        let W = CGFloat(width), H = CGFloat(height)
        let scale = max(W / sw, H / sh)
        let dw = sw * scale, dh = sh * scale
        return CGRect(x: (W - dw) / 2, y: (H - dh) / 2, width: dw, height: dh)
    }

    private static func draw(_ text: String, y: CGFloat, px: Int, width: Int, in ctx: CGContext) {
        let font = CTFontCreateWithName("Helvetica-Bold" as CFString, CGFloat(px), nil)
        let white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
        let black = CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: white]))
        let bounds = CTLineGetBoundsWithOptions(line, [])
        let x = (CGFloat(width) - bounds.width) / 2
        ctx.saveGState()
        ctx.translateBy(x: x, y: y)
        ctx.scaleBy(x: 1, y: -1)
        ctx.setShadow(offset: .zero, blur: 4, color: black)
        ctx.textPosition = CGPoint(x: 0, y: -bounds.height * 0.2)
        CTLineDraw(line, ctx)
        ctx.restoreGState()
    }

    private static func appendAudio(_ pcm: PCM, seconds: Double, input: AVAssetWriterInput, writer: AVAssetWriter, budget: Double) throws {
        let bpf = pcm.channels * 2
        let total = max(1, Int(seconds * Double(pcm.rate)))
        let sourceFrames = pcm.data.count / bpf
        if sourceFrames < 1 { throw PricoReelError.message("music") }
        let queue = DispatchQueue(label: "studio.pricop.export.audio")
        let sem = DispatchSemaphore(value: 0)
        var writeError: String?
        var produced = 0
        input.requestMediaDataWhenReady(on: queue) {
            while input.isReadyForMoreMediaData {
                if produced >= total {
                    input.markAsFinished()
                    sem.signal()
                    return
                }
                let n = min(1024, total - produced)
                var chunk = Data(count: n * bpf)
                chunk.withUnsafeMutableBytes { raw in
                    guard let dst = raw.baseAddress else { return }
                    pcm.data.withUnsafeBytes { srcRaw in
                        guard let src = srcRaw.baseAddress else { return }
                        for i in 0..<n {
                            let from = ((produced + i) % sourceFrames) * bpf
                            memcpy(dst.advanced(by: i * bpf), src.advanced(by: from), bpf)
                        }
                    }
                }
                if let sample = pcmSample(chunk, frames: n, sampleRate: pcm.rate, channels: pcm.channels, frameOffset: produced) {
                    if !input.append(sample) {
                        writeError = writer.error?.localizedDescription ?? "append audio"
                        input.markAsFinished()
                        sem.signal()
                        return
                    }
                }
                produced += n
            }
        }
        if sem.wait(timeout: .now() + budget) == .timedOut { throw PricoReelError.message("audio encode timeout") }
        if let writeError { throw PricoReelError.message(writeError) }
    }

    private static func pcmSample(_ data: Data, frames: Int, sampleRate: Int, channels: Int, frameOffset: Int) -> CMSampleBuffer? {
        var asbd = AudioStreamBasicDescription(mSampleRate: Float64(sampleRate), mFormatID: kAudioFormatLinearPCM, mFormatFlags: kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked, mBytesPerPacket: UInt32(channels * 2), mFramesPerPacket: 1, mBytesPerFrame: UInt32(channels * 2), mChannelsPerFrame: UInt32(channels), mBitsPerChannel: 16, mReserved: 0)
        var format: CMAudioFormatDescription?
        guard CMAudioFormatDescriptionCreate(allocator: kCFAllocatorDefault, asbd: &asbd, layoutSize: 0, layout: nil, magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &format) == noErr, let format else { return nil }
        var block: CMBlockBuffer?
        let raw = data as NSData
        guard CMBlockBufferCreateWithMemoryBlock(allocator: kCFAllocatorDefault, memoryBlock: nil, blockLength: raw.length, blockAllocator: kCFAllocatorDefault, customBlockSource: nil, offsetToData: 0, dataLength: raw.length, flags: 0, blockBufferOut: &block) == noErr, let block else { return nil }
        guard CMBlockBufferReplaceDataBytes(with: raw.bytes, blockBuffer: block, offsetIntoDestination: 0, dataLength: raw.length) == noErr else { return nil }
        var sample: CMSampleBuffer?
        var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: CMTimeScale(sampleRate)), presentationTimeStamp: CMTime(value: CMTimeValue(frameOffset), timescale: CMTimeScale(sampleRate)), decodeTimeStamp: .invalid)
        var sampleSize = channels * 2
        guard CMSampleBufferCreate(allocator: kCFAllocatorDefault, dataBuffer: block, dataReady: true, makeDataReadyCallback: nil, refcon: nil, formatDescription: format, sampleCount: frames, sampleTimingEntryCount: 1, sampleTimingArray: &timing, sampleSizeEntryCount: 1, sampleSizeArray: &sampleSize, sampleBufferOut: &sample) == noErr else { return nil }
        return sample
    }
}
