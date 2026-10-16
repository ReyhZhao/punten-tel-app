#!/usr/bin/env swift
// Genereert het iOS-app-icoon uit het icoon van de web-app.
//
//   swift ios/scripts/generate-app-icon.swift
//
// Bron: frontend/public/pwa-icon.svg (vlak met afgeronde hoeken).
// Doel: ios/Puntenteller/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png
//
// De App Store eist een vierkante PNG van 1024×1024 zonder transparantie; iOS
// rondt de hoeken zelf af. Daarom vullen we eerst het hele vlak met de
// achtergrondkleur van het SVG (#FF5A3C) en tekenen we het SVG daaroverheen,
// zodat de afgeronde hoeken van de web-versie dichtlopen.

import AppKit
import ImageIO

// Repo-root: de eerste map vanaf de huidige map (omhoog) met frontend/ en ios/.
func findRoot() -> URL {
    var dir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    while dir.path != "/" {
        if FileManager.default.fileExists(atPath: dir.appending(path: "frontend/public/pwa-icon.svg").path),
           FileManager.default.fileExists(atPath: dir.appending(path: "ios").path) {
            return dir
        }
        dir.deleteLastPathComponent()
    }
    fatalError("Draai dit script vanuit de repo (frontend/public/pwa-icon.svg niet gevonden)")
}

let root = findRoot()
let source = root.appending(path: "frontend/public/pwa-icon.svg")
let target = root.appending(path: "ios/Puntenteller/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png")
let size = 1024
let background = NSColor(srgbRed: 0xFF / 255, green: 0x5A / 255, blue: 0x3C / 255, alpha: 1)

guard let svg = NSImage(contentsOf: source) else {
    fatalError("Kon \(source.path) niet laden")
}

// Tekenen in een sRGB-context zonder alfakanaal; de PNG krijgt dus geen transparantie.
let rect = CGRect(x: 0, y: 0, width: size, height: size)
guard let context = CGContext(
    data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
    fatalError("Kon tekencontext niet maken")
}
context.setFillColor(background.cgColor)
context.fill(rect)

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
svg.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)
NSGraphicsContext.restoreGraphicsState()

guard let image = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(target as CFURL, "public.png" as CFString, 1, nil) else {
    fatalError("Kon PNG niet maken")
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Kon \(target.path) niet schrijven") }
print("Geschreven: \(target.path)")
