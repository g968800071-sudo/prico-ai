import Foundation
import Capacitor
import AVFoundation
import UIKit
import CoreMedia

@objc(PricoExportPlugin)
public class PricoExportPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PricoExportPlugin"
    public let jsName = "PricoExport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "mux", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readAsset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "begin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "frame", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise)
    ]
    private let q = DispatchQueue(label: "studio.pricop.export")
    private var writer: AVAssetWriter?
    private var videoIn: AVAssetWriterInput?
    private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var audioIn: AVAssetWriterInput?
    private var frameIndex = 0
    private var audioSamples = 0
    private var fps = 30
    private var width = 1080
    private var height = 1920
    private var sampleRate = 44100
    private var channels = 2
    private var dir: URL?
    private var pcm: FileHandle?

    @objc func readAsset(_ call: CAPPluginCall) {
        q.async {
            do {
                guard let rel = call.getString("path"), !rel.contains(".."), !rel.hasPrefix("/") else { throw self.err("bad path") }
                let roots = [Bundle.main.bundleURL.appendingPathComponent("public"), Bundle.main.resourceURL?.appendingPathComponent("public")].compactMap { $0 }
                var data: Data?
                var tried: [String] = []
                for root in roots {
                    let url = root.appendingPathComponent(rel)
                    tried.append(url.path)
                    if let d = try? Data(contentsOf: url), !d.isEmpty { data = d; break }
                }
                guard let data else { throw self.err("missing " + tried.joined(separator: " | ")) }
                call.resolve(["data": data.base64EncodedString(), "bytes": data.count])
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func begin(_ call: CAPPluginCall) {
        q.async {
            do {
                self.reset()
                guard let uri = call.getString("uri") else { throw self.err("uri") }
                let dir = URL(fileURLWithPath: URL(string: uri)?.path ?? uri.replacingOccurrences(of: "file://", with: ""))
                self.dir = dir
                self.width = Self.even(call.getInt("width") ?? 1080)
                self.height = Self.even(call.getInt("height") ?? 1920)
                self.fps = max(1, call.getInt("fps") ?? 30)
                self.sampleRate = call.getInt("sampleRate") ?? 44100
                self.channels = max(1, call.getInt("channels") ?? 2)
                let out = dir.appendingPathComponent("out.mp4")
                if FileManager.default.fileExists(atPath: out.path) { try FileManager.default.removeItem(at: out) }
                let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
                writer.movieFragmentInterval = .invalid
                let bitrate = self.width >= 1000 ? 5_000_000 : 2_800_000
                let video = AVAssetWriterInput(mediaType: .video, outputSettings: [
                    AVVideoCodecKey: AVVideoCodecType.h264,
                    AVVideoWidthKey: self.width,
                    AVVideoHeightKey: self.height,
                    AVVideoCompressionPropertiesKey: [
                        AVVideoAverageBitRateKey: bitrate,
                        AVVideoProfileLevelKey: AVVideoProfileLevelH264BaselineAutoLevel
                    ]
                ])
                video.expectsMediaDataInRealTime = false
                let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [
                    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                    kCVPixelBufferWidthKey as String: self.width,
                    kCVPixelBufferHeightKey as String: self.height
                ])
                writer.add(video)
                let audio = AVAssetWriterInput(mediaType: .audio, outputSettings: [
                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                    AVSampleRateKey: self.sampleRate,
                    AVNumberOfChannelsKey: self.channels,
                    AVEncoderBitRateKey: 128_000
                ])
                audio.expectsMediaDataInRealTime = false
                writer.add(audio)
                guard writer.startWriting() else { throw writer.error ?? self.err("writer") }
                writer.startSession(atSourceTime: .zero)
                FileManager.default.createFile(atPath: dir.appendingPathComponent("audio.pcm").path, contents: nil)
                self.pcm = try FileHandle(forWritingTo: dir.appendingPathComponent("audio.pcm"))
                self.writer = writer
                self.videoIn = video
                self.adaptor = adaptor
                self.audioIn = audio
                call.resolve(["width": self.width, "height": self.height, "fps": self.fps])
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func frame(_ call: CAPPluginCall) {
        q.async {
            do {
                guard let writer = self.writer, let video = self.videoIn, let adaptor = self.adaptor, let dir = self.dir else { throw self.err("begin") }
                let repeatCount = max(1, call.getInt("repeat") ?? 1)
                let jpg = dir.appendingPathComponent("frame.jpg")
                let data = try Data(contentsOf: jpg)
                guard let image = UIImage(data: data)?.cgImage else { throw self.err("frame") }
                guard let buffer = Self.pixelBuffer(from: image, width: self.width, height: self.height) else { throw self.err("pixel") }
                try? FileManager.default.removeItem(at: jpg)
                for _ in 0..<repeatCount {
                    var spins = 0
                    while !video.isReadyForMoreMediaData && spins < 500 { Thread.sleep(forTimeInterval: 0.01); spins += 1 }
                    let time = CMTime(value: CMTimeValue(self.frameIndex), timescale: CMTimeScale(self.fps))
                    if !adaptor.append(buffer, withPresentationTime: time) { throw writer.error ?? self.err("append video") }
                    self.frameIndex += 1
                }
                call.resolve(["frames": self.frameIndex])
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func audio(_ call: CAPPluginCall) {
        q.async {
            do {
                guard let pcm = self.pcm, let b64 = call.getString("data"), let data = Data(base64Encoded: b64) else { throw self.err("audio") }
                try pcm.write(contentsOf: data)
                call.resolve()
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        q.async {
            do {
                guard let writer = self.writer, let video = self.videoIn else { throw self.err("begin") }
                try self.pcm?.close()
                video.markAsFinished()
                if let audio = self.audioIn, let dir = self.dir {
                    let raw = try Data(contentsOf: dir.appendingPathComponent("audio.pcm"))
                    let bytesPerFrame = self.channels * 2
                    var offset = 0
                    var sampleIndex = 0
                    while offset + bytesPerFrame <= raw.count {
                        let nbytes = min(1024 * bytesPerFrame, raw.count - offset)
                        let aligned = nbytes - (nbytes % bytesPerFrame)
                        let chunk = raw.subdata(in: offset..<(offset + aligned))
                        let nframes = aligned / bytesPerFrame
                        var spins = 0
                        while !audio.isReadyForMoreMediaData && spins < 500 { Thread.sleep(forTimeInterval: 0.01); spins += 1 }
                        if let sample = Self.pcmSample(chunk, frames: nframes, sampleRate: self.sampleRate, channels: self.channels, frameOffset: sampleIndex) {
                            if !audio.append(sample) { throw writer.error ?? self.err("append audio") }
                        }
                        sampleIndex += nframes
                        offset += aligned
                    }
                    audio.markAsFinished()
                }
                let done = DispatchSemaphore(value: 0)
                writer.finishWriting { done.signal() }
                done.wait()
                if writer.status != .completed { throw writer.error ?? self.err("finish") }
                let out = writer.outputURL
                if let copy = call.getString("copyTo") {
                    let dest = URL(fileURLWithPath: URL(string: copy)?.path ?? copy.replacingOccurrences(of: "file://", with: ""))
                    try? FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
                    if FileManager.default.fileExists(atPath: dest.path) { try FileManager.default.removeItem(at: dest) }
                    try FileManager.default.copyItem(at: out, to: dest)
                }
                let size = (try FileManager.default.attributesOfItem(atPath: out.path)[.size] as? NSNumber)?.intValue ?? 0
                let head = try Data(contentsOf: out, options: [.mappedIfSafe]).prefix(16)
                let hex = head.map { String(format: "%02x", $0) }.joined()
                let frames = self.frameIndex
                let w = self.width
                let h = self.height
                self.reset()
                call.resolve(["path": out.path, "bytes": size, "width": w, "height": h, "frames": frames, "header": hex])
            } catch { self.reset(); call.reject(error.localizedDescription) }
        }
    }

    private func reset() {
        try? pcm?.close()
        pcm = nil
        writer = nil
        videoIn = nil
        adaptor = nil
        audioIn = nil
        frameIndex = 0
        audioSamples = 0
        dir = nil
    }

    private func err(_ message: String) -> NSError { NSError(domain: "prico", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

    @objc func mux(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                guard let uri = call.getString("uri") else { throw NSError(domain: "prico", code: 1, userInfo: [NSLocalizedDescriptionKey: "uri"]) }
                let dir = URL(fileURLWithPath: URL(string: uri)?.path ?? uri.replacingOccurrences(of: "file://", with: ""))
                let frames = call.getInt("frames") ?? 0
                let width = Self.even(call.getInt("width") ?? 540)
                let height = Self.even(call.getInt("height") ?? 960)
                let fps = max(1, call.getInt("fps") ?? 10)
                let sampleRate = call.getInt("sampleRate") ?? 44100
                let channels = max(1, call.getInt("channels") ?? 2)
                let hasAudio = call.getBool("hasAudio") ?? false
                let out = dir.appendingPathComponent("out.mp4")
                if FileManager.default.fileExists(atPath: out.path) { try FileManager.default.removeItem(at: out) }
                try Self.encode(dir: dir, frames: frames, width: width, height: height, fps: fps, sampleRate: sampleRate, channels: channels, hasAudio: hasAudio, out: out)
                let size = (try FileManager.default.attributesOfItem(atPath: out.path)[.size] as? NSNumber)?.intValue ?? 0
                if size < 800 { throw NSError(domain: "prico", code: 2, userInfo: [NSLocalizedDescriptionKey: "empty mp4"]) }
                call.resolve(["path": out.path, "bytes": size])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private static func even(_ n: Int) -> Int { max(2, n - (n & 1)) }

    private static func encode(dir: URL, frames: Int, width: Int, height: Int, fps: Int, sampleRate: Int, channels: Int, hasAudio: Bool, out: URL) throws {
        let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
        writer.movieFragmentInterval = .invalid
        let video = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 1_800_000,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264BaselineAutoLevel
            ]
        ])
        video.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height
        ])
        writer.add(video)
        var audio: AVAssetWriterInput?
        if hasAudio {
            let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: sampleRate,
                AVNumberOfChannelsKey: channels,
                AVEncoderBitRateKey: 96_000
            ])
            input.expectsMediaDataInRealTime = false
            writer.add(input)
            audio = input
        }
        guard writer.startWriting() else { throw writer.error ?? NSError(domain: "prico", code: 3, userInfo: [NSLocalizedDescriptionKey: "writer"]) }
        writer.startSession(atSourceTime: .zero)
        for i in 0..<frames {
            let jpg = dir.appendingPathComponent(String(format: "f%04d.jpg", i))
            let data = try Data(contentsOf: jpg)
            guard let image = UIImage(data: data)?.cgImage else { throw NSError(domain: "prico", code: 4, userInfo: [NSLocalizedDescriptionKey: "frame \(i)"]) }
            while !video.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.01) }
            guard let buffer = pixelBuffer(from: image, width: width, height: height) else { throw NSError(domain: "prico", code: 5, userInfo: [NSLocalizedDescriptionKey: "pixel"]) }
            if !adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: CMTimeScale(fps))) {
                throw writer.error ?? NSError(domain: "prico", code: 6, userInfo: [NSLocalizedDescriptionKey: "append video"])
            }
        }
        video.markAsFinished()
        if let audio = audio {
            let pcm = try Data(contentsOf: dir.appendingPathComponent("audio.pcm"))
            let framesPerChunk = 1024
            let bytesPerFrame = channels * 2
            var offset = 0
            var frameIndex = 0
            while offset < pcm.count {
                let nbytes = min(framesPerChunk * bytesPerFrame, pcm.count - offset)
                let chunk = pcm.subdata(in: offset..<(offset + nbytes))
                let nframes = nbytes / bytesPerFrame
                while !audio.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.01) }
                if let sample = pcmSample(chunk, frames: nframes, sampleRate: sampleRate, channels: channels, frameOffset: frameIndex) {
                    if !audio.append(sample) { throw writer.error ?? NSError(domain: "prico", code: 7, userInfo: [NSLocalizedDescriptionKey: "append audio"]) }
                }
                frameIndex += nframes
                offset += nbytes
            }
            audio.markAsFinished()
        }
        let done = DispatchSemaphore(value: 0)
        writer.finishWriting { done.signal() }
        done.wait()
        if writer.status != .completed { throw writer.error ?? NSError(domain: "prico", code: 8, userInfo: [NSLocalizedDescriptionKey: "finish"]) }
    }

    private static func pixelBuffer(from image: CGImage, width: Int, height: Int) -> CVPixelBuffer? {
        var pb: CVPixelBuffer?
        let attrs = [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary
        CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, attrs, &pb)
        guard let pb else { return nil }
        CVPixelBufferLockBaseAddress(pb, [])
        defer { CVPixelBufferUnlockBaseAddress(pb, []) }
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else { return nil }
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return pb
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
