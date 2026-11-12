import Foundation
import XCTest
@testable import TileCore

final class LabelTileSchemeHandlerTests: XCTestCase {
    private func tile(_ suffix: String = "12/1689/968", method: String? = "GET") throws -> LabelTile {
        try XCTUnwrap(LabelTile(url: XCTUnwrap(URL(string: "gridly-label://mock/tile/\(suffix)")), method: method))
    }

    private func png() throws -> Data {
        try Data(contentsOf: XCTUnwrap(Bundle.module.url(forResource: "valid", withExtension: "png")))
    }

    func testAcceptsOnlyCanonicalLabelTileAndPreservesRowOrder() throws {
        let result = try tile()
        XCTAssertEqual(result.level, 12)
        XCTAssertEqual(result.row, 1689)
        XCTAssertEqual(result.column, 968)
        XCTAssertEqual(try tile("0/0/0").level, 0)
        XCTAssertEqual(try tile("19/524287/524287").column, 524287)
    }

    func testRejectsForeignAuthorityPathMethodAndExtraURLComponents() throws {
        for text in [
            "https://mock/tile/12/1689/968", "gridly-label://other/tile/12/1689/968",
            "gridly-label://user:pass@mock/tile/12/1689/968",
            "gridly-label://mock:80/tile/12/1689/968", "gridly-label://mock/path/12/1689/968",
            "gridly-label://mock/tile/12/1689/968/", "gridly-label://mock/tile/12/1689/968?",
            "gridly-label://mock/tile/12/1689/968#", "gridly-label://mock/tile/%31%32/1689/968",
            "gridly-label://mock/tile/12/../968", "gridly-label://MOCK/tile/12/1689/968",
        ] {
            XCTAssertNil(LabelTile(url: try XCTUnwrap(URL(string: text)), method: "GET"), text)
        }
        let valid = try XCTUnwrap(URL(string: "gridly-label://mock/tile/12/1689/968"))
        XCTAssertNil(LabelTile(url: valid, method: "HEAD"))
        XCTAssertNil(LabelTile(url: valid, method: nil))
    }

    func testRejectsMalformedAndOutOfRangeCoordinates() throws {
        for suffix in ["-1/0/0", "20/0/0", "0/0/1", "1/2/0", "12/1689/4096",
                       "12/01689/968", "12/1689.0/968", "12//968", "999999999999999/0/0"] {
            let url = try XCTUnwrap(URL(string: "gridly-label://mock/tile/\(suffix)"))
            XCTAssertNil(LabelTile(url: url, method: "GET"), suffix)
        }
    }

    func testProjectionKeepsPositionAcrossLevelsAndTileEdges() throws {
        let point = (latitude: 30.0466, longitude: -94.8852)
        let coarse = try tile()
        let a = coarse.pixel(latitude: point.latitude, longitude: point.longitude)
        XCTAssertTrue((0.0..<512.0).contains(a.x))
        XCTAssertTrue((0.0..<512.0).contains(a.y))
        let row = coarse.row * 2 + Int(a.y * 2) / 512
        let col = coarse.column * 2 + Int(a.x * 2) / 512
        let fine = try tile("13/\(row)/\(col)")
        let b = fine.pixel(latitude: point.latitude, longitude: point.longitude)
        XCTAssertEqual(b.x + Double(col * 512), 2 * (a.x + Double(coarse.column * 512)), accuracy: 1e-8)
        XCTAssertEqual(b.y + Double(row * 512), 2 * (a.y + Double(coarse.row * 512)), accuracy: 1e-8)
    }

    func testValid512PixelPNGAndCorruptImageRejection() throws {
        let valid = try png()
        XCTAssertTrue(TilePNG.isValid(valid))
        XCTAssertEqual(TilePNG.mimeType, "image/png")
        XCTAssertFalse(TilePNG.isValid(Data(valid.dropLast())))
        XCTAssertFalse(TilePNG.isValid(Data(repeating: 0, count: TilePNG.maximumBytes + 1)))
        XCTAssertFalse(TilePNG.isValid(Data("not an image".utf8)))
        var corrupt = valid
        corrupt[32] ^= 1
        XCTAssertFalse(TilePNG.isValid(corrupt))
    }

    @MainActor
    func testTwoListenersShareOneWorkItemAndOneCancellationKeepsOtherListener() async throws {
        let transport = ManualTransport()
        let queue = LabelTileQueue(transport: transport)
        let tile = try tile()
        var result: TileResult?
        let cancel = queue.submit(tile) { _ in XCTFail("Cancelled listener was called") }
        queue.submit(tile) { result = $0 }
        XCTAssertEqual(transport.started, [tile])
        cancel()
        XCTAssertTrue(transport.cancelled.isEmpty)
        let image = try png()
        transport.finish(tile, .success(image))
        XCTAssertEqual(result, .success(image))
    }

    @MainActor
    func testLastCancellationSuppressesCallbackAndDoesNotStartDuplicateWhileDraining() async throws {
        let transport = ManualTransport()
        let queue = LabelTileQueue(transport: transport)
        let tile = try tile()
        let cancel = queue.submit(tile) { _ in XCTFail("Cancelled listener was called") }
        cancel()
        var busy: TileResult?
        queue.submit(tile) { busy = $0 }
        XCTAssertEqual(transport.started, [tile])
        XCTAssertEqual(transport.cancelled, [tile])
        XCTAssertEqual(busy, .failure(.busy))
        transport.finish(tile, .failure(.cancelled))
        queue.submit(tile) { _ in }
        XCTAssertEqual(transport.started, [tile, tile])
    }

    @MainActor
    func testBurstBoundsActiveWorkAndSkipsCancelledQueuedTiles() async throws {
        let transport = ManualTransport()
        let queue = LabelTileQueue(transport: transport, maxActive: 2, maxWork: 3)
        let tiles = try (0..<4).map { try tile("12/1689/\(968 + $0)") }
        queue.submit(tiles[0]) { _ in }
        queue.submit(tiles[1]) { _ in }
        let queuedCancel = queue.submit(tiles[2]) { _ in XCTFail("Cancelled queue callback") }
        var excess: TileResult?
        queue.submit(tiles[3]) { excess = $0 }
        XCTAssertEqual(excess, .failure(.busy))
        queuedCancel()
        queue.submit(tiles[3]) { _ in }
        XCTAssertEqual(transport.started, Array(tiles.prefix(2)))
        transport.finish(tiles[0], .failure(.unavailable))
        XCTAssertEqual(transport.started, [tiles[0], tiles[1], tiles[3]])
        XCTAssertEqual(transport.peakActive, 2)
    }

    @MainActor
    func testTimeoutReportsOnceAndKeepsSlotUntilCancellationAcknowledged() async throws {
        let transport = ManualTransport()
        let deadlines = ManualDeadlines()
        let queue = LabelTileQueue(transport: transport, maxActive: 1, schedule: deadlines.schedule)
        let first = try tile(), second = try tile("12/1689/969")
        var results: [TileResult] = []
        queue.submit(first) { results.append($0) }
        queue.submit(second) { _ in }
        deadlines.fireFirst()
        XCTAssertEqual(results, [.failure(.timedOut)])
        XCTAssertEqual(transport.cancelled, [first])
        XCTAssertEqual(transport.started, [first])
        transport.finish(first, .failure(.cancelled))
        XCTAssertEqual(results, [.failure(.timedOut)])
        XCTAssertEqual(transport.started, [first, second])
    }

    @MainActor
    func testTransportFailureAndInvalidPNGStayControlled() async throws {
        let transport = ManualTransport()
        let queue = LabelTileQueue(transport: transport)
        let tile = try tile()
        var results: [TileResult] = []
        queue.submit(tile) { results.append($0) }
        transport.finish(tile, .failure(.unavailable))
        queue.submit(tile) { results.append($0) }
        transport.finish(tile, .success(Data([0, 1, 2])))
        XCTAssertEqual(results, [.failure(.unavailable), .failure(.invalidImage)])
    }

    @MainActor
    func testDuplicateListenerCountIsBounded() async throws {
        let transport = ManualTransport()
        let queue = LabelTileQueue(transport: transport, maxListeners: 1)
        let tile = try tile()
        queue.submit(tile) { _ in }
        var rejected: TileResult?
        queue.submit(tile) { rejected = $0 }
        XCTAssertEqual(rejected, .failure(.busy))
        XCTAssertEqual(transport.started, [tile])
    }
}

@MainActor
private final class ManualTransport: MockLabelTransport {
    private var active: [LabelTile: TileCompletion] = [:]
    private(set) var started: [LabelTile] = []
    private(set) var cancelled: [LabelTile] = []
    private(set) var peakActive = 0

    func request(_ tile: LabelTile, completion: @escaping TileCompletion) -> TileCancel {
        XCTAssertNil(active[tile])
        started.append(tile)
        active[tile] = completion
        peakActive = max(peakActive, active.count)
        return { [weak self] in self?.cancelled.append(tile) }
    }

    func finish(_ tile: LabelTile, _ result: TileResult) {
        let completion = active.removeValue(forKey: tile)
        XCTAssertNotNil(completion)
        completion?(result)
    }
}

@MainActor
private final class ManualDeadlines {
    private var order: [UUID] = []
    private var actions: [UUID: TileCancel] = [:]
    func schedule(_ seconds: TimeInterval, _ fire: @escaping TileCancel) -> TileCancel {
        XCTAssertGreaterThan(seconds, 0)
        let id = UUID()
        order.append(id)
        actions[id] = fire
        return { [weak self] in _ = self?.actions.removeValue(forKey: id) }
    }

    func fireFirst() {
        while !order.isEmpty {
            if let fire = actions.removeValue(forKey: order.removeFirst()) {
                fire()
                return
            }
        }
        XCTFail("No timeout is scheduled")
    }
}
