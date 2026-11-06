import Foundation
import AVFoundation
import UIKit
import CoreMedia
import CoreImage

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
        let cachePath = spec["cache"] as? String ?? ""
        let cache = URL(fileURLWithPath: cachePath)
        var clips = (spec["clips"] as? [[String: Any]] ?? []).map {
            Clip(kind: $0["kind"] as? String ?? "image",
                 file: $0["file"] as? String ?? "",
                 bundle: $0["bundle"] as? Bool ?? false,
                 start: $0["start"] as? Double ?? 0,
                 dur: $0["dur"] as? Double ?? 1)
        }
        let texts = spec["texts"] as? [[String: Any]] ?? []
        let captions = spec["captions"] as? [[String: Any]] ?? []
        let ci = CIContext(options: nil)
        for i in clips.indices {
            let url = try resolve(clips[i].file, bundle: clips[i].bundle, cache: cache)
            if clips[i].kind == "video" {
                let (images, dur) = try readVideo(url, context: ci)
                if images.isEmpty { throw PricoReelError.message("no video frames") }
                clips[i].video = images
                clips[i].videoDur = dur
            } else {
                guard let image = UIImage(contentsOfFile: url.path)?.cgImage else { throw PricoReelError.message("still \(clips[i].file)") }
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
                AVVideoProfileLevelKey: AVVideoProfileLevelH264BaselineAutoLevel
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
        let pcm = try readPCM(musicURL)
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
        for i in 0..<frames {
            let time = min(total - 0.0001, Double(i) / Double(fps))
            guard let buffer = drawFrame(clips: clips, time: time, fade: fade, texts: texts, captions: captions, width: width, height: height, pool: adaptor.pixelBufferPool) else {
                throw PricoReelError.message("pixel \(i)")
            }
            var spins = 0
            while !videoIn.isReadyForMoreMediaData && spins < 300 { Thread.sleep(forTimeInterval: 0.01); spins += 1 }
            if !adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: CMTimeScale(fps))) {
                throw writer.error ?? PricoReelError.message("append video \(i)")
            }
        }
        videoIn.markAsFinished()
        try appendAudio(pcm, seconds: total, input: audioIn, writer: writer)
        audioIn.markAsFinished()
        let done = DispatchSemaphore(value: 0)
        writer.finishWriting { done.signal() }
        done.wait()
        if writer.status != .completed { throw writer.error ?? PricoReelError.message("finish \(writer.status.rawValue)") }
        if let copyTo {
            let dest = URL(fileURLWithPath: URL(string: copyTo)?.path ?? copyTo.replacingOccurrences(of: "file://", with: ""))
            try? FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: dest.path) { try? FileManager.default.removeItem(at: dest) }
            try FileManager.default.copyItem(at: out, to: dest)
        }
        let size = (try FileManager.default.attributesOfItem(atPath: out.path)[.size] as? NSNumber)?.intValue ?? 0
        let head = try Data(contentsOf: out).prefix(16)
        let hex = head.map { String(format: "%02x", $0) }.joined()
        let elapsed = Int((CFAbsoluteTimeGetCurrent() - t0) * 1000)
        return ["path": out.path, "bytes": size, "width": width, "height": height, "frames": frames, "fps": fps, "header": hex, "elapsedMs": elapsed, "engine": "avfoundation"]
    }

    private static func even(_ n: Int) -> Int { max(2, n - (n & 1)) }

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

    private static func readVideo(_ url: URL, context: CIContext) throws -> ([CGImage], Double) {
        let asset = AVURLAsset(url: url)
        let sem = DispatchSemaphore(value: 0)
        asset.loadValuesAsynchronously(forKeys: ["tracks", "duration"]) { sem.signal() }
        sem.wait()
        guard let track = asset.tracks(withMediaType: .video).first else { throw PricoReelError.message("no video track") }
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        output.alwaysCopiesSampleData = true
        reader.add(output)
        guard reader.startReading() else { throw reader.error ?? PricoReelError.message("reader") }
        var images: [CGImage] = []
        while let sample = output.copyNextSampleBuffer() {
            if let buf = CMSampleBufferGetImageBuffer(sample) {
                let ci = CIImage(cvPixelBuffer: buf)
                if let cg = context.createCGImage(ci, from: ci.extent) { images.append(cg) }
            }
        }
        var dur = CMTimeGetSeconds(asset.duration)
        if !dur.isFinite || dur <= 0.05 {
            let rate = Double(track.nominalFrameRate)
            dur = rate > 1 ? Double(images.count) / rate : Double(images.count) / 12
        }
        return (images, max(0.1, dur))
    }

    private struct PCM { let data: Data; let rate: Int; let channels: Int }

    private static func readPCM(_ url: URL) throws -> PCM {
        let asset = AVURLAsset(url: url)
        let sem = DispatchSemaphore(value: 0)
        asset.loadValuesAsynchronously(forKeys: ["tracks"]) { sem.signal() }
        sem.wait()
        guard let track = asset.tracks(withMediaType: .audio).first else { throw PricoReelError.message("no audio track") }
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
        while let sample = output.copyNextSampleBuffer() {
            if let block = CMSampleBufferGetDataBuffer(sample) {
                var length = 0
                var ptr: UnsafeMutablePointer<Int8>?
                if CMBlockBufferGetDataPointer(block, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &ptr) == noErr, let ptr {
                    data.append(Data(bytes: ptr, count: length))
                }
            }
        }
        if data.count < 4 { throw PricoReelError.message("empty music") }
        return PCM(data: data, rate: 44100, channels: 2)
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
            ctx.interpolationQuality = .high
            ctx.draw(image, in: cover(image, width, height))
            ctx.restoreGState()
        }
        UIGraphicsPushContext(ctx)
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
        UIGraphicsPopContext()
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
        let para = NSMutableParagraphStyle()
        para.alignment = .center
        let font = UIFont.systemFont(ofSize: CGFloat(px), weight: .heavy)
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font, .foregroundColor: UIColor.white, .strokeColor: UIColor.black, .strokeWidth: -3, .paragraphStyle: para
        ]
        let rect = CGRect(x: 24, y: y - CGFloat(px), width: CGFloat(width - 48), height: CGFloat(px) * 1.5)
        (text as NSString).draw(in: rect, withAttributes: attrs)
    }

    private static func appendAudio(_ pcm: PCM, seconds: Double, input: AVAssetWriterInput, writer: AVAssetWriter) throws {
        let bpf = pcm.channels * 2
        let total = max(1, Int(seconds * Double(pcm.rate)))
        let sourceFrames = pcm.data.count / bpf
        if sourceFrames < 1 { throw PricoReelError.message("music") }
        var produced = 0
        while produced < total {
            let n = min(1024, total - produced)
            var chunk = Data(count: n * bpf)
            chunk.withUnsafeMutableBytes { raw in
                guard let dst = raw.baseAddress else { return }
                pcm.data.withUnsafeBytes { srcRaw in
                    let src = srcRaw.baseAddress!
                    for i in 0..<n {
                        let from = ((produced + i) % sourceFrames) * bpf
                        memcpy(dst.advanced(by: i * bpf), src.advanced(by: from), bpf)
                    }
                }
            }
            var spins = 0
            while !input.isReadyForMoreMediaData && spins < 300 { Thread.sleep(forTimeInterval: 0.01); spins += 1 }
            if let sample = pcmSample(chunk, frames: n, sampleRate: pcm.rate, channels: pcm.channels, frameOffset: produced) {
                if !input.append(sample) { throw writer.error ?? PricoReelError.message("append audio") }
            }
            produced += n
        }
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
