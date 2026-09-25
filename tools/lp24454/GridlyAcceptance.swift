import XCTest
import UIKit

// Runs in a separate signed XCTest runner. No Gridly hooks, launch arguments,
// storage mutation, synthetic GPS, reporting action, or production target.
@MainActor
final class GridlyAcceptance: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.gridlygo.gridly")
    private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    private var sequence = 0
    private var pages: [[String: Any]] = []
    private var events: [[String: Any]] = []
    private let titles = ["Welcome to Gridly", "Know Before You Go", "See what's happening nearby",
        "Stay informed with important updates", "Your report helps everyone nearby", "Make Gridly yours", "Set your awareness area"]

    override func setUpWithError() throws {
        continueAfterFailure = false
        // This activates the installed app without resetting or reinstalling it.
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 20))
    }

    private func attach(_ value: Any, name: String) throws {
        let data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = name + ".json"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func rect(_ r: CGRect) -> [String: Double] {
        ["x": Double(r.origin.x), "y": Double(r.origin.y), "width": Double(r.width), "height": Double(r.height)]
    }

    private func tree(_ node: XCUIElementSnapshot, depth: Int = 0) -> [String: Any] {
        var row: [String: Any] = ["label": node.label, "identifier": node.identifier,
            "type": node.elementType.rawValue, "frame": rect(node.frame), "enabled": node.isEnabled,
            "selected": node.isSelected, "value": String(describing: node.value ?? "")]
        if depth < 35 { row["children"] = node.children.prefix(500).map { tree($0, depth: depth + 1) } }
        return row
    }

    @discardableResult private func capture(_ name: String) throws -> [String: Any] {
        sequence += 1
        let prefix = String(format: "%03d-", sequence) + name
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = prefix + ".png"
        attachment.lifetime = .keepAlways
        add(attachment)
        let snapshot = try app.snapshot()
        let data: [String: Any] = ["kind": "physical-screen", "name": name,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "screenPixels": ["width": screenshot.image.cgImage?.width ?? 0, "height": screenshot.image.cgImage?.height ?? 0],
            "appFramePoints": rect(snapshot.frame), "orientation": XCUIDevice.shared.orientation.rawValue,
            "safeAreaBounds": NSNull(), "cardBounds": NSNull(),
            "geometryLimitation": "Accessibility frames are observed; WKWebView DOM card bounds and safe-area insets are not exposed by XCTest.",
            "accessibility": tree(snapshot)]
        try attach(data, name: prefix)
        return data
    }

    private func visibleButtons(_ label: String) -> [XCUIElement] {
        app.buttons.matching(NSPredicate(format: "label == %@ OR identifier == %@", label, label))
            .allElementsBoundByIndex.filter { $0.exists && $0.isHittable && $0.isEnabled }
    }

    private func tap(_ label: String) throws {
        try waitForHumanIfPrompt(context: "before-" + label, contextualLocation: false)
        let buttons = visibleButtons(label)
        guard buttons.count == 1 else {
            try capture("ambiguous-or-missing-control")
            throw NSError(domain: "LP24454.Harness", code: 1, userInfo: [NSLocalizedDescriptionKey: "Expected exactly one hittable semantic button: \(label); found \(buttons.count). No coordinate fallback."])
        }
        buttons[0].tap()
        events.append(["action": "semantic-tap", "label": label])
    }

    private func visibleTitle() -> Int? {
        let viewport = app.frame
        return titles.indices.first { i in
            app.staticTexts.matching(NSPredicate(format: "label == %@", titles[i])).allElementsBoundByIndex.contains {
                $0.exists && $0.frame.width > 0 && $0.frame.height > 0 && viewport.contains(CGPoint(x: $0.frame.midX, y: $0.frame.midY)) && $0.isHittable
            }
        }
    }

    private func poll(_ timeout: TimeInterval, _ ready: () -> Bool) -> Bool {
        let until = Date().addingTimeInterval(timeout)
        repeat {
            if ready() { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        } while Date() < until
        return ready()
    }

    private func prompts() -> [XCUIElement] {
        (springboard.alerts.allElementsBoundByIndex + app.alerts.allElementsBoundByIndex).filter { $0.exists }
    }

    private func waitForHumanIfPrompt(context: String, contextualLocation: Bool) throws {
        guard !prompts().isEmpty else { return }
        let alert = prompts()[0]
        let labels = alert.descendants(matching: .any).allElementsBoundByIndex.map { $0.label }.filter { !$0.isEmpty }
        try capture("permission-or-security-prompt")
        try attach(["context": context, "labels": labels, "alert": tree(try alert.snapshot()),
            "chosenPermission": "UNOBSERVED — disappearance does not identify the chosen option",
            "preciseLocation": "See captured accessible switch value if exposed; otherwise UNKNOWN",
            "contextualLocationIntent": contextualLocation], name: "human-prompt-\(sequence)")
        let location = labels.joined(separator: " ").localizedCaseInsensitiveContains("location")
        if location && !contextualLocation {
            throw NSError(domain: "LP24454.Observation", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unexpected location prompt before this harness invoked contextual location; capture retained. Do not dismiss automatically."])
        }
        if location && labels.contains(where: { $0.localizedCaseInsensitiveContains("Always Allow") || $0 == "Always" }) {
            throw NSError(domain: "LP24454.Observation", code: 3, userInfo: [NSLocalizedDescriptionKey: "Always/background location choice observed; preserve evidence and stop."])
        }
        print(location
            ? "HUMAN ACTION REQUIRED: On Denise’s iPhone choose Allow While Using App if you consent. Note the Precise Location state. The harness will detect dismissal; it cannot infer your selection."
            : "HUMAN ACTION REQUIRED: Review the security/permission prompt on Denise’s iPhone. The harness will never press its buttons.")
        guard poll(180, { self.prompts().isEmpty }) else {
            throw NSError(domain: "LP24454.HumanAction", code: 4, userInfo: [NSLocalizedDescriptionKey: "Prompt remains after 180 seconds. Evidence retained; no permission was granted by automation."])
        }
        try capture("after-human-prompt")
    }

    private func onboarding(finish: Bool) throws {
        try waitForHumanIfPrompt(context: "initial-launch", contextualLocation: false)
        guard let initial = visibleTitle() else {
            try capture("onboarding-not-visible")
            events.append(["gate": "fresh-onboarding", "status": "NOT_OBSERVED", "reason": "No known onboarding title exposed. App is not reset or replayed."])
            return
        }
        if initial != 0 { events.append(["gate": "fresh-onboarding", "status": "PARTIAL", "firstPage": initial + 1]) }
        for index in initial..<titles.count {
            guard poll(15, { self.visibleTitle() == index }) else {
                try capture("onboarding-transition-timeout")
                throw NSError(domain: "LP24454.Harness", code: 5, userInfo: [NSLocalizedDescriptionKey: "Expected semantic onboarding title \(index + 1), did not observe it. No blind Next tap."])
            }
            try waitForHumanIfPrompt(context: "onboarding-page-\(index + 1)", contextualLocation: false)
            var page = try capture("onboarding-\(index + 1)")
            page["page"] = index + 1
            page["visibleTitle"] = titles[index]
            page["navigationControls"] = app.buttons.allElementsBoundByIndex.filter { $0.exists && $0.isHittable }.map {
                ["label": $0.label, "enabled": $0.isEnabled, "frame": rect($0.frame)] as [String: Any]
            }
            pages.append(page)
            if index < titles.count - 1 { try tap("Next") }
        }
        try attach(["kind": "onboarding", "pages": pages,
            "classification": "INCONCLUSIVE — HUMAN VISUAL CONFIRMATION REQUIRED",
            "reason": "Physical screenshots and accessibility geometry retained; no DOM card/safe-area measurement or visual judgment is invented."], name: "onboarding-summary")
        if finish {
            // Existing Finish explicitly permits completing without a Home choice.
            // No location, town or ZIP is selected on the owner's behalf.
            try tap("Finish")
            XCTAssertTrue(poll(15, { self.visibleTitle() == nil }), "Onboarding did not close after Finish")
            try capture("after-finish-without-home-selection")
        }
    }

    func testOnboardingCapture() throws {
        defer { try? attach(events, name: "events") }
        try capture("initial-installed-state")
        try onboarding(finish: false)
    }

    func testPhysicalJourney() throws {
        defer { try? attach(events, name: "events") }
        try capture("journey-initial")
        try onboarding(finish: true)
        try waitForHumanIfPrompt(context: "home-before-location", contextualLocation: false)
        try capture("home-before-around-me")
        try tap("Around Me — use my location")
        // No new geolocation request is injected: the actual UI owns the request.
        var until = Date().addingTimeInterval(25)
        repeat {
            let hadPrompt = !prompts().isEmpty
            try waitForHumanIfPrompt(context: "around-me", contextualLocation: true)
            if hadPrompt { until = Date().addingTimeInterval(25) }
            if !visibleButtons("Return Home").isEmpty { break }
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        } while Date() < until
        try capture("around-me-terminal")
        events.append(["gate": "R1-real-geolocation", "status": "INCONCLUSIVE",
            "returnHomeVisible": !visibleButtons("Return Home").isEmpty,
            "reason": "UI outcome captured. Exact WKWebView coordinates, location source, permission choice and persisted Home bytes are not exposed by XCTest. Do not equate a visible control with proven GPS success."])
        if visibleButtons("Return Home").count == 1 { try tap("Return Home"); try capture("return-home") }
        for label in ["Home", "Search", "Alerts", "Settings"] {
            if visibleButtons(label).count == 1 {
                try tap(label)
                try capture("surface-" + label.lowercased())
                if label == "Search" { try searchCities() }
            } else { events.append(["gate": "surface-" + label, "status": "NOT_OBSERVED", "reason": "No unique hittable semantic control; evidence retained, no coordinates."]) }
        }
        events.append(["gate": "R3-native-provider-networking", "status": "INCONCLUSIVE",
            "reason": "Native UI screenshots alone cannot prove capacitor://localhost requests, normalized counts or CORS failures. Inspector/console evidence must be correlated before classification."])
        try waitForHumanIfPrompt(context: "before-background", contextualLocation: false)
        XCUIDevice.shared.press(.home)
        RunLoop.current.run(until: Date().addingTimeInterval(2))
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 15))
        try capture("resume")
        let original = XCUIDevice.shared.orientation
        XCUIDevice.shared.orientation = .landscapeLeft
        try capture("landscape-left")
        XCUIDevice.shared.orientation = .portrait
        try capture("portrait-return")
        if original != .unknown { XCUIDevice.shared.orientation = original }
        app.terminate()
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 20))
        try capture("relaunch")
        events.append(["gate": "network-provider-recovery", "status": "NOT_RUN", "reason": "No OS network switch or endpoint modification performed. Requires an explicitly controlled physical network interruption."])
    }

    private func searchCities() throws {
        let predicate = NSPredicate(format: "placeholderValue == %@ OR label == %@", "Search address or place", "Search address or place")
        let fields = (app.textFields.matching(predicate).allElementsBoundByIndex + app.searchFields.matching(predicate).allElementsBoundByIndex).filter { $0.exists && $0.isHittable }
        guard fields.count == 1 else {
            events.append(["gate": "multi-county-search", "status": "NOT_OBSERVED", "reason": "Search field not uniquely exposed in accessibility."])
            return
        }
        let field = fields[0]
        for city in ["Dayton", "Dallas", "Austin"] {
            field.tap()
            let current = field.value as? String ?? ""
            if current != field.placeholderValue && !current.isEmpty { field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count)) }
            field.typeText(city)
            try capture("keyboard-" + city.lowercased())
            if visibleButtons("Search addresses and places").count == 1 { try tap("Search addresses and places") }
            RunLoop.current.run(until: Date().addingTimeInterval(5))
            try capture("search-" + city.lowercased())
            events.append(["gate": "search-" + city, "status": "OBSERVED_ONLY", "reason": "Typed production search and captured result surface; no inferred provider success or geographic selection."])
        }
    }
}
