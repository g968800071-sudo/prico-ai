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
        CAPPluginMethod(name: "mux", returnType: CAPPluginReturnPromise)
    ]

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
