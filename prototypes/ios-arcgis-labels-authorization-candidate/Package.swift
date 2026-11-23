// swift-tools-version: 5.9
import PackageDescription

// Certification package only. No shipping app, signing entitlement or build number.
let package = Package(
    name: "GridlyLabelsAuthorizationCandidate",
    platforms: [.iOS("16.4")],
    products: [.library(name: "GridlyLabelsAuthorizationCandidate", targets: ["GridlyLabelsAuthorizationCandidate"])],
    dependencies: [.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.3.4")],
    targets: [
        .target(name: "GridlyLabelsAuthorizationCandidate",
                dependencies: [.product(name: "Capacitor", package: "capacitor-swift-pm"),
                               .product(name: "Cordova", package: "capacitor-swift-pm")],
                path: "native", exclude: ["Tests"]),
        .testTarget(name: "GridlyLabelsAuthorizationCandidateTests",
                    dependencies: ["GridlyLabelsAuthorizationCandidate", .product(name: "Capacitor", package: "capacitor-swift-pm")],
                    path: "native/Tests")
    ],
    swiftLanguageVersions: [.v5]
)
