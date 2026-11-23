// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LabelTileGatewayIntegration",
    platforms: [.iOS(.v16), .macOS(.v13)],
    targets: [
        .target(name: "TileCore"),
        .testTarget(name: "TileCoreTests", dependencies: ["TileCore"],
                    resources: [.process("Fixtures")])
    ]
)
