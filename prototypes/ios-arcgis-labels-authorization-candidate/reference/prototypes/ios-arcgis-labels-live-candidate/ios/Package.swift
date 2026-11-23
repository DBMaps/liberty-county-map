// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "GridlyLabelsPilot",
    platforms: [.iOS("16.4"), .macOS(.v13)],
    products: [.library(name: "GridlyLabelsPilot", targets: ["GridlyLabelsPilot"])],
    targets: [
        .target(name: "GridlyLabelsPilot"),
        .testTarget(name: "GridlyLabelsPilotTests", dependencies: ["GridlyLabelsPilot"])
    ]
)
