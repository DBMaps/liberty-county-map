import UIKit

// Reuses the certified synthetic anchors and renderer for visual comparison.
@MainActor
enum HarnessRenderer {
    private static func pixel(_ tile: LabelTile, latitude: Double, longitude: Double) -> (x: Double, y: Double) {
        let world = Double(512 * (1 << tile.level))
        let radians = latitude * .pi / 180
        return (
            world * (longitude + 180) / 360 - Double(tile.column * 512),
            world * (1 - asinh(tan(radians)) / .pi) / 2 - Double(tile.row * 512)
        )
    }

    static func render(_ tile: LabelTile) -> Data? {
        let size = CGFloat(512)
        let bounds = CGRect(x: 0, y: 0, width: size, height: size)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = false
        format.preferredRange = .standard
        let renderer = UIGraphicsImageRenderer(size: bounds.size, format: format)
        return renderer.image { _ in
            draw("West Ridge", at: pixel(tile, latitude: 30.052, longitude: -94.891), fontSize: 24, in: bounds)
            draw("Cedar Lane", at: pixel(tile, latitude: 30.044, longitude: -94.880), fontSize: 18, in: bounds)
            draw("Mill Creek", at: pixel(tile, latitude: 30.038, longitude: -94.889), fontSize: 16, in: bounds)
        }.pngData()
    }

    private static func draw(_ label: String, at point: (x: Double, y: Double), fontSize: CGFloat, in bounds: CGRect) {
        let text = label as NSString
        let font = UIFont.systemFont(ofSize: fontSize, weight: .bold)
        let size = text.size(withAttributes: [.font: font])
        let anchor = CGPoint(x: CGFloat(point.x), y: CGFloat(point.y))
        let rect = CGRect(x: anchor.x - size.width / 2, y: anchor.y - size.height - 5,
                          width: size.width, height: size.height)
        guard rect.union(CGRect(x: anchor.x - 4, y: anchor.y - 4, width: 8, height: 8))
            .insetBy(dx: -4, dy: -4).intersects(bounds) else { return }
        text.draw(in: rect, withAttributes: [
            .font: font, .foregroundColor: UIColor.white,
            .strokeColor: UIColor.black, .strokeWidth: -4
        ])
        UIColor.white.setFill()
        UIBezierPath(ovalIn: CGRect(x: anchor.x - 3, y: anchor.y - 3, width: 6, height: 6)).fill()
    }
}
