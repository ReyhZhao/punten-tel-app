// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "PuntentellerKit",
    defaultLocalization: "nl",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "PuntentellerKit", targets: ["PuntentellerKit"]),
    ],
    targets: [
        .target(name: "PuntentellerKit"),
        .testTarget(name: "PuntentellerKitTests", dependencies: ["PuntentellerKit"]),
    ]
)
