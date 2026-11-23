import Foundation
#if canImport(ImageIO)
import ImageIO
#endif

struct LabelTile: Hashable {
    static let scheme = "gridly-label"
    static let host = "mock"
    static let size = 512
    let level: Int
    let row: Int
    let column: Int

    init?(url: URL, method: String?) {
        guard method == "GET",
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == Self.scheme, parts.host == Self.host,
              parts.user == nil, parts.password == nil, parts.port == nil,
              parts.percentEncodedQuery == nil, parts.percentEncodedFragment == nil else { return nil }
        let segments = parts.percentEncodedPath.split(separator: "/", omittingEmptySubsequences: false)
        guard segments.count == 5, segments[0].isEmpty, segments[1] == "tile",
              let level = Self.integer(segments[2]), level <= 19,
              let row = Self.integer(segments[3]), let column = Self.integer(segments[4]),
              row < (1 << level), column < (1 << level) else { return nil }
        self.level = level
        self.row = row
        self.column = column
        // Require the exact canonical form, including authority and path.
        guard url.absoluteString == "\(Self.scheme)://\(Self.host)/tile/\(level)/\(row)/\(column)" else { return nil }
    }

    private static func integer(_ text: Substring) -> Int? {
        guard (1...6).contains(text.utf8.count),
              text.utf8.allSatisfy({ (48...57).contains($0) }),
              text.count == 1 || text.first != "0" else { return nil }
        return Int(text)
    }

    func pixel(latitude: Double, longitude: Double) -> (x: Double, y: Double) {
        let world = Double(Self.size * (1 << level))
        let radians = latitude * .pi / 180
        return (
            world * (longitude + 180) / 360 - Double(column * Self.size),
            world * (1 - asinh(tan(radians)) / .pi) / 2 - Double(row * Self.size)
        )
    }
}

enum TileError: String, Error, Equatable {
    case invalidRequest, busy, unavailable, timedOut, invalidImage, cancelled
}

enum TilePNG {
    static let maximumBytes = 512 * 1024
    static let mimeType = "image/png"

    static func isValid(_ data: Data) -> Bool {
        guard (45...maximumBytes).contains(data.count) else { return false }
        let bytes = Array(data)
        guard bytes.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]) else { return false }

        func number(_ start: Int) -> UInt32 {
            bytes[start..<start + 4].reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
        }

        var index = 8
        var hasImageData = false
        while index <= bytes.count - 12 {
            let length = Int(number(index))
            guard length <= bytes.count - index - 12 else { return false }
            let end = index + 8 + length
            let kind = String(bytes: bytes[index + 4..<index + 8], encoding: .ascii)
            var crc = UInt32.max
            for byte in bytes[index + 4..<end] {
                crc = (crc >> 8) ^ crcTable[Int((crc ^ UInt32(byte)) & 255)]
            }
            guard (crc ^ UInt32.max) == number(end) else { return false }

            if index == 8 {
                guard kind == "IHDR", length == 13,
                      number(index + 8) == 512, number(index + 12) == 512 else { return false }
            } else if kind == "IHDR" {
                return false
            }
            if kind == "IDAT", length > 0 { hasImageData = true }
            if kind == "IEND" {
                guard hasImageData, length == 0, end + 4 == bytes.count else { return false }
                #if canImport(ImageIO)
                guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                      let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
                      image.width == 512, image.height == 512,
                      CGImageSourceGetStatusAtIndex(source, 0) == .statusComplete else { return false }
                #endif
                return true
            }
            index = end + 4
        }
        return false
    }

    private static let crcTable = (0..<256).map { value -> UInt32 in
        var crc = UInt32(value)
        for _ in 0..<8 { crc = (crc >> 1) ^ (crc & 1 == 0 ? 0 : 0xedb88320) }
        return crc
    }
}

typealias TileResult = Result<Data, TileError>
typealias TileCancel = @MainActor () -> Void
typealias TileCompletion = @MainActor (TileResult) -> Void
typealias TileDeadline = @MainActor (TimeInterval, @escaping TileCancel) -> TileCancel

@MainActor
protocol MockLabelTransport {
    // Complete once, including after cancellation. The queue keeps that work
    // counted until the transport acknowledges cancellation.
    func request(_ tile: LabelTile, completion: @escaping TileCompletion) -> TileCancel
}

@MainActor
final class LabelTileQueue {
    private struct Work {
        let generation = UUID()
        var listeners: [UUID: TileCompletion]
        var deadline: TileCancel?
        var cancel: TileCancel?
        var active = false
    }

    private let transport: MockLabelTransport
    private let schedule: TileDeadline
    private let timeout: TimeInterval
    private let maxActive: Int
    private let maxWork: Int
    private let maxListeners: Int
    private var work: [LabelTile: Work] = [:]
    private var pending: [LabelTile] = []
    private var active = 0

    init(transport: MockLabelTransport, maxActive: Int = 4, maxWork: Int = 24,
         maxListeners: Int = 48, timeout: TimeInterval = 1,
         schedule: @escaping TileDeadline = { seconds, fire in
             let task = Task { @MainActor in
                 do { try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000)) }
                 catch { return }
                 fire()
             }
             return { task.cancel() }
         }) {
        precondition(maxActive > 0 && maxWork >= maxActive && maxListeners > 0 && timeout > 0)
        self.transport = transport
        self.maxActive = maxActive
        self.maxWork = maxWork
        self.maxListeners = maxListeners
        self.timeout = timeout
        self.schedule = schedule
    }

    @discardableResult
    func submit(_ tile: LabelTile, completion: @escaping TileCompletion) -> TileCancel {
        let id = UUID()
        let listenerCount = work.values.reduce(0) { $0 + $1.listeners.count }
        guard listenerCount < maxListeners else {
            completion(.failure(.busy))
            return {}
        }
        if var existing = work[tile] {
            guard !existing.listeners.isEmpty else {
                completion(.failure(.busy))
                return {}
            }
            existing.listeners[id] = completion
            work[tile] = existing
        } else {
            guard work.count < maxWork else {
                completion(.failure(.busy))
                return {}
            }
            var entry = Work(listeners: [id: completion])
            let generation = entry.generation
            entry.deadline = schedule(timeout) { [weak self] in self?.expire(tile, generation) }
            work[tile] = entry
            pending.append(tile)
            pump()
        }
        return { [weak self] in self?.cancel(tile, listener: id) }
    }

    private func pump() {
        while active < maxActive, !pending.isEmpty {
            let tile = pending.removeFirst()
            guard var entry = work[tile] else { continue }
            let generation = entry.generation
            entry.active = true
            work[tile] = entry
            active += 1
            let cancel = transport.request(tile) { [weak self] result in self?.finish(tile, generation, result) }
            if work[tile]?.generation == generation { work[tile]?.cancel = cancel }
        }
    }

    private func finish(_ tile: LabelTile, _ generation: UUID, _ result: TileResult) {
        guard let entry = work[tile], entry.generation == generation else { return }
        work.removeValue(forKey: tile)
        entry.deadline?()
        if entry.active { active -= 1 }
        if !entry.listeners.isEmpty {
            let checked = result.flatMap { TilePNG.isValid($0) ? .success($0) : .failure(.invalidImage) }
            for callback in entry.listeners.values { callback(checked) }
        }
        pump()
    }

    private func expire(_ tile: LabelTile, _ generation: UUID) {
        guard let entry = work[tile], entry.generation == generation, !entry.listeners.isEmpty else { return }
        retire(tile, entry)
        for callback in entry.listeners.values { callback(.failure(.timedOut)) }
    }

    private func cancel(_ tile: LabelTile, listener id: UUID) {
        guard var entry = work[tile], entry.listeners.removeValue(forKey: id) != nil else { return }
        if entry.listeners.isEmpty { retire(tile, entry) }
        else { work[tile] = entry }
    }

    private func retire(_ tile: LabelTile, _ entry: Work) {
        entry.deadline?()
        if entry.active {
            var retiring = entry
            retiring.listeners.removeAll()
            retiring.deadline = nil
            work[tile] = retiring
            entry.cancel?()
        } else {
            work.removeValue(forKey: tile)
            pending.removeAll { $0 == tile }
            pump()
        }
    }
}
