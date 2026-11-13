// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "GridlyFixedPathTile",
    platforms: [.iOS(.v16), .macOS(.v13)],
    targets: [
        .target(name: "GridlyFixedPathTile"),
        .testTarget(name: "GridlyFixedPathTileTests", dependencies: ["GridlyFixedPathTile"],
                    resources: [.copy("tile-proof.json")])
    ]
)
