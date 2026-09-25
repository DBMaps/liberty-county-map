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

    private func rect(_ r: CGRect) -> [String: Any] {
        // Non-finite unrelated AX geometry must not abort JSON evidence export.
        let values = ["x": Double(r.origin.x), "y": Double(r.origin.y), "width": Double(r.width), "height": Double(r.height)]
        return values.mapValues { value -> Any in value.isFinite ? value as Any : NSNull() }
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

    // Observation uses snapshots/geometry only, never activation-point queries.
    private func onScreen(_ frame: CGRect) -> Bool {
        [frame.minX, frame.minY, frame.width, frame.height].allSatisfy { $0.isFinite }
            && frame.width > 0 && frame.height > 0
            && app.frame.contains(CGPoint(x: frame.midX, y: frame.midY))
    }

    private func flatten(_ node: XCUIElementSnapshot) -> [XCUIElementSnapshot] {
        [node] + node.children.flatMap { flatten($0) }
    }

    private func tourNodes() -> [XCUIElementSnapshot] {
        guard let snapshot = try? app.snapshot() else { return [] }
        let regions = flatten(snapshot).filter { $0.label == "Quick Tour cards and setup" && onScreen($0.frame) }
        guard regions.count == 1 else { return [] }
        return flatten(regions[0]).filter { onScreen($0.frame) }
    }

    private func visibleTitle() -> Int? {
        let nodes = tourNodes()
        let matches = titles.indices.filter { index in
            nodes.contains { $0.label == titles[index] && $0.elementType == .staticText }
        }
        return matches.count == 1 ? matches[0] : nil
    }

    private func blocked(_ reason: String) throws -> Never {
        events.append(["gate": "onboarding", "status": "BLOCKED", "reason": reason])
        try? capture("onboarding-BLOCKED")
        throw NSError(domain: "LP24454.Harness", code: 5,
            userInfo: [NSLocalizedDescriptionKey: "BLOCKED: " + reason])
    }

    // Query only the intended control. A malformed unrelated button is never hit-tested.
    private func requiredTap(_ label: String, identifier: String, tour: Bool = true, idOnly: Bool = false) throws {
        try waitForHumanIfPrompt(context: "before-" + label, contextualLocation: false)
        try capture("before-required-" + label)
        let predicate = idOnly ? NSPredicate(format: "identifier == %@", identifier)
            : NSPredicate(format: "identifier == %@ OR label == %@", identifier, label)
        let buttons = app.buttons.matching(predicate).allElementsBoundByIndex.filter {
            $0.exists && onScreen($0.frame)
        }
        guard buttons.count == 1 else { try blocked("Missing or ambiguous required control: " + label) }
        let button = buttons[0]
        if tour {
            let matches = tourNodes().filter {
                $0.elementType == .button && ($0.identifier == identifier || $0.label == label)
                    && $0.frame == button.frame
            }
            guard matches.count == 1 else { try blocked("Required control outside proven tour region: " + label) }
        }
        guard button.isEnabled else { try blocked("Required control disabled: " + label) }
        // Evidence already retained if XCTest itself rejects this intended activation point.
        guard button.isHittable else { try blocked("Required control not actionable: " + label) }
        button.tap()
        events.append(["action": "required-tap", "label": label, "identifier": identifier])
    }

    private func expectPage(_ index: Int, name: String) throws {
        guard poll(15, { self.visibleTitle() == index }) else {
            try blocked("Expected page identity: " + titles[index])
        }
        try waitForHumanIfPrompt(context: name, contextualLocation: false)
        try capture(name)
    }

    private func move(_ label: String, from: Int, to: Int, name: String) throws {
        guard visibleTitle() == from else { try blocked("Transition source page not proven") }
        try requiredTap(label, identifier: label == "Next" ? "gridlyV950NextBtn" : "gridlyV950BackBtn")
        try expectPage(to, name: name)
        events.append(["action": "transition", "control": label, "from": from + 1, "to": to + 1, "evidence": name])
    }

    private func shellVisible() -> Bool {
        guard app.state == .runningForeground, let snapshot = try? app.snapshot() else { return false }
        guard !flatten(snapshot).contains(where: { $0.label == "Quick Tour cards and setup" && onScreen($0.frame) }) else { return false }
        return ["Open Settings", "Open Alerts", "Around Me — use my location"].allSatisfy { label in
            app.buttons.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByIndex.filter {
                $0.exists && self.onScreen($0.frame) && $0.isEnabled
            }.count == 1
        }
    }

    private func expectShell(_ name: String) throws {
        guard poll(15, { self.shellVisible() }) else { try blocked("Expected Gridly map/dock state after " + name) }
        try capture(name)
        events.append(["action": "post-onboarding", "control": name, "evidence": name])
    }

    private func safeReopen() throws {
        // Only this legacy ID has a reopen-only handler. The similarly named
        // portrait Settings action resets saved profile fields and is forbidden.
        try requiredTap("Show walkthrough again", identifier: "settingsReplaySetupBtn", tour: false, idOnly: true)
        guard poll(15, { self.visibleTitle() != nil }), let initial = visibleTitle() else {
            try blocked("Safe reopen did not expose a known page")
        }
        // Reopening preserves the existing pager index; return with public Back.
        if initial > 0 {
            for index in stride(from: initial, to: 0, by: -1) {
                try move("Back", from: index, to: index - 1, name: "reopen-back-\(index)")
            }
        }
        try expectPage(0, name: "safe-reopen-page-1")
    }

    private func establishPageOne() throws {
        if visibleTitle() == nil {
            guard shellVisible() else { try blocked("No known page or proven Gridly shell; no reset allowed") }
            try safeReopen()
        }
        guard let initial = visibleTitle() else { try blocked("Cannot establish page 1 safely") }
        if initial > 0 {
            for index in stride(from: initial, to: 0, by: -1) {
                try move("Back", from: index, to: index - 1, name: "start-back-\(index)")
            }
        }
        try expectPage(0, name: "verified-page-1-start")
        events.append(["action": "page-1-start", "evidence": "verified-page-1-start"])
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

    private func onboarding() throws {
        defer {
            try? attach(["kind": "onboarding", "pages": pages,
                "classification": "INCONCLUSIVE — HUMAN VISUAL CONFIRMATION REQUIRED"], name: "onboarding-summary")
        }
        try waitForHumanIfPrompt(context: "initial-launch", contextualLocation: false)
        try establishPageOne()
        for index in titles.indices {
            try expectPage(index, name: "onboarding-\(index + 1)-identity")
            var page = try capture("onboarding-\(index + 1)")
            page["page"] = index + 1
            page["visibleTitle"] = titles[index]
            // Passive AX evidence retains indicators and geometry without hitting buttons.
            pages.append(page)
            if index == 1 {
                try move("Back", from: 1, to: 0, name: "back-verified-page-1")
                try move("Next", from: 0, to: 1, name: "forward-restored-page-2")
            }
            if index < titles.count - 1 {
                try move("Next", from: index, to: index + 1, name: "next-verified-page-\(index + 2)")
            }
        }
        // Complete sequential coverage before closing either walkthrough session.
        try requiredTap("Finish", identifier: "gridlyV894C2FirstRunFinishBtn")
        try expectShell("after-Finish")
        // Do not call the profile-resetting portrait replay action. If the safe
        // legacy control is unavailable, retain completed coverage and BLOCK.
        try safeReopen()
        try requiredTap("Skip walkthrough", identifier: "gridlyV894CFirstRunSkipBtn")
        try expectShell("after-Skip")
        events.append(["action": "onboarding-complete", "journeyStarted": false])
    }

    func testOnboardingCapture() throws {
        defer { try? attach(events, name: "events") }
        try capture("initial-installed-state")
        try onboarding()
        // STOP: journey is a separately selected test, never invoked here.
    }

    func testPhysicalJourney() throws {
        defer { try? attach(events, name: "events") }
        try capture("journey-initial")
        if visibleTitle() != nil {
            try establishPageOne()
            for index in 0..<(titles.count - 1) {
                try move("Next", from: index, to: index + 1, name: "journey-next-\(index + 2)")
            }
            try requiredTap("Finish", identifier: "gridlyV894C2FirstRunFinishBtn")
        }
        try expectShell("journey-start-shell")
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
