import XCTest
import UIKit
import Vision

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
        let regions = flatten(snapshot).filter { isTourRegion($0.label) && onScreen($0.frame) }
        guard regions.count == 1 else { return [] }
        return flatten(regions[0]).filter { onScreen($0.frame) }
    }

    private func isTourRegion(_ label: String) -> Bool {
        ["Quick Tour cards and setup", "Quick Tour cards and setup, region"].contains(label)
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
        let nodes = flatten(snapshot)
        guard !nodes.contains(where: { isTourRegion($0.label) && onScreen($0.frame) }) else { return false }
        return ["Open Settings", "Open Alerts", "Around Me — use my location"].allSatisfy { label in
            // WKWebView exposes the dock actions as Other, not Button.
            // This is passive state evidence, not proof of tappability.
            nodes.filter { $0.label == label && self.onScreen($0.frame) && $0.isEnabled }.count == 1
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
        guard poll(15, { self.visibleTitle() != nil || self.shellVisible() }) else {
            try blocked("No known page or proven Gridly shell after bounded readiness wait; no reset allowed")
        }
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
        print("HUMAN ACTION REQUIRED: Automation stopped. Native prompt: " + labels.joined(separator: " | "))
        throw NSError(domain: "LP24454.HumanAction", code: 4, userInfo: [NSLocalizedDescriptionKey: "Native dialog requires owner review; evidence retained, no automatic dismissal or continuation."])
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

    private func journeyBlock(_ reason: String) throws -> Never {
        events.append(["gate": "journey", "status": "BLOCKED", "reason": reason])
        try? capture("journey-BLOCKED")
        throw NSError(domain: "LP24454.Harness", code: 6, userInfo: [NSLocalizedDescriptionKey: reason])
    }

    private func journeyNodes() -> [XCUIElementSnapshot] {
        guard let snapshot = try? app.snapshot() else { return [] }
        return flatten(snapshot).filter {
            let r = $0.frame
            return [r.minX, r.minY, r.width, r.height].allSatisfy { $0.isFinite } && r.width > 0 && r.height > 0
                && snapshot.frame.contains(CGPoint(x: r.midX, y: r.midY))
        }
    }

    // Types and labels below come from saved physical AX, never a coordinate fallback.
    private func journeyTap(_ label: String, role: XCUIElement.ElementType) throws {
        try waitForHumanIfPrompt(context: "before-" + label, contextualLocation: false)
        let nodes = journeyNodes().filter { $0.label == label && $0.elementType == role && $0.isEnabled }
        guard nodes.count == 1 else { try journeyBlock("Missing/ambiguous observed AX control: " + label) }
        try capture("before-tap-" + label)
        let matches = app.descendants(matching: role).matching(NSPredicate(format: "label == %@", label))
            .allElementsBoundByIndex.filter { $0.exists && self.onScreen($0.frame) && $0.frame == nodes[0].frame }
        guard matches.count == 1, matches[0].isEnabled, matches[0].isHittable else {
            try journeyBlock("Observed AX control is not safely actionable: " + label)
        }
        matches[0].tap()
        events.append(["action": "journey-tap", "label": label, "role": role.rawValue])
    }

    // Verify rendered identity as well as AX; AX can update ahead of compositing.
    private func renderedWords(_ screenshot: XCUIScreenshot) throws -> String {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["en-US"]
        request.usesLanguageCorrection = false
        guard let image = screenshot.image.cgImage else { try journeyBlock("Screenshot pixels unavailable") }
        try VNImageRequestHandler(cgImage: image).perform([request])
        return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ").lowercased()
    }

    private func visualIdentity(_ name: String) -> [String] {
        switch name {
        case "search-open": return ["where are you going", "search"]
        case "search-results": return ["best matches", "austin", "multi-county"]
        case "destination-selected": return ["selected destination", "austin", "ready to preview"]
        case "destination": return ["location context", "austin", "return home"]
        case "kbyg-expanded", "road-awareness": return ["official roadways", "no active official roadway conditions"]
        case "weather": return ["weather", "no active weather alerts"]
        case "alerts-open": return ["no active alerts", "0 active conditions", "no active community reports", "no active weather alerts"]
        case "layers-open": return ["map layers", "standard", "satellite"]
        case "around-me": return ["location context", "around me", "return home"]
        default: return ["location context", "dayton", "search"]
        }
    }

    private func retainSettled(_ name: String, screenshot: XCUIScreenshot, snapshot: XCUIElementSnapshot) throws {
        sequence += 1
        let prefix = String(format: "%03d-", sequence) + name
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = prefix + ".png"; attachment.lifetime = .keepAlways; add(attachment)
        try attach(["kind": "physical-screen", "name": name,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "screenPixels": ["width": screenshot.image.cgImage?.width ?? 0, "height": screenshot.image.cgImage?.height ?? 0],
            "appFramePoints": rect(snapshot.frame), "orientation": XCUIDevice.shared.orientation.rawValue,
            "safeAreaBounds": NSNull(), "cardBounds": NSNull(), "accessibility": tree(snapshot)], name: prefix)
    }

    // Require both semantic state and three stable rendered frames. Tile loads,
    // animations and context transitions reset stability; no fixed long sleep.
    private func settled(_ name: String, required: [String], contextualLocation: Bool = false) throws {
        let until = Date().addingTimeInterval(35)
        var previous: [UInt8]?; var previousAX: Data?; var stable = 0
        var samples: [[String: Any]] = []
        repeat {
            try waitForHumanIfPrompt(context: name, contextualLocation: contextualLocation)
            let snapshot = try app.snapshot()
            let nodes = flatten(snapshot).filter { node in
                let r = node.frame
                return [r.minX, r.minY, r.width, r.height].allSatisfy { $0.isFinite } && r.width > 0 && r.height > 0
                    && snapshot.frame.contains(CGPoint(x: r.midX, y: r.midY))
            }
            let ready = app.state == .runningForeground && !nodes.contains { self.isTourRegion($0.label) }
                && required.allSatisfy { label in nodes.contains { $0.label == label } }
            let screenshot = XCUIScreen.main.screenshot()
            // Compare decoded pixels, excluding native time/battery chrome. Encoded
            // PNG containers may differ independently of the rendered content.
            let image = screenshot.image.cgImage!
            let crop = image.cropping(to: CGRect(x: 0, y: 60 * screenshot.image.scale,
                width: CGFloat(image.width), height: CGFloat(image.height) - 60 * screenshot.image.scale))!
            // Normalize color/stride and downsample for a bounded pixel-difference
            // measurement. Tiny raster noise is allowed; substantial tile/layout
            // changes reset stability. Full-resolution screenshots still require review.
            var pixels = [UInt8](repeating: 0, count: 86 * 174 * 4)
            pixels.withUnsafeMutableBytes { bytes in
                let context = CGContext(data: bytes.baseAddress, width: 86, height: 174, bitsPerComponent: 8,
                    bytesPerRow: 86 * 4, space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                context.draw(crop, in: CGRect(x: 0, y: 0, width: 86, height: 174))
            }
            var delta = 255.0; var changed = 1.0
            if let previous {
                let differences = zip(pixels, previous).map { abs(Int($0) - Int($1)) }
                delta = Double(differences.reduce(0, +)) / Double(differences.count)
                changed = Double(differences.filter { $0 > 16 }.count) / Double(differences.count)
            }
            let ax = try JSONSerialization.data(withJSONObject: nodes.map { ["label": $0.label, "frame": rect($0.frame)] }, options: .sortedKeys)
            let sameAX = ax == previousAX
            samples.append(["ready": ready, "meanPixelDelta": delta, "changedChannelFraction": changed, "sameAX": sameAX])
            if ready && delta <= 1 && changed <= 0.005 && sameAX { stable += 1 } else { stable = 0 }
            previous = ready ? pixels : nil
            previousAX = ready ? ax : nil
            if stable >= 2 {
                let rawWords = try renderedWords(screenshot)
                // Vision reads the displayed zero as O; AX independently requires 0.
                let words = rawWords.replacingOccurrences(of: " o active conditions", with: " 0 active conditions")
                let expectedWords = visualIdentity(name)
                if expectedWords.allSatisfy({ words.contains($0) }) {
                    // Retain this measured frame, never take a different screenshot
                    // after declaring stability. OCR observations remain auditable.
                    try retainSettled(name, screenshot: screenshot, snapshot: snapshot)
                    events.append(["action": "settled", "evidence": name, "required": required, "stableFrames": 3,
                        "samples": samples, "rawRenderedText": rawWords, "renderedText": words, "requiredRenderedText": expectedWords])
                    return
                }
                stable = 0
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        } while Date() < until
        try attach(samples, name: "unsettled-" + name)
        try journeyBlock("No settled physical rendering for " + name)
    }

    private func searchDestination() throws {
        if journeyNodes().contains(where: { $0.label == "Clear search" && $0.elementType == .button }) {
            try journeyTap("Clear search", role: .button)
        }
        try journeyTap("Where are you going?", role: .searchField)
        let fields = app.searchFields.matching(NSPredicate(format: "label == %@", "Where are you going?"))
            .allElementsBoundByIndex.filter { $0.exists && self.onScreen($0.frame) }
        guard fields.count == 1 else { try journeyBlock("Search field not unique") }
        let field = fields[0]
        let current = field.value as? String ?? ""
        guard current.isEmpty || current == field.placeholderValue else { try journeyBlock("Search did not clear; refusing to append query") }
        field.typeText("Austin, Texas")
        guard field.value as? String == "Austin, Texas" else { try journeyBlock("Typed search value not proven") }
        events.append(["action": "journey-type", "label": "Where are you going?", "text": "Austin, Texas"])
        try journeyTap("Search addresses and places", role: .button)
        try settled("search-results", required: ["Where are you going?, web dialog", "Austin Multi-county Community · Bastrop County · Hays County · Travis County · Williamson County Place"])
    }

    private func weatherScroll() throws {
        try waitForHumanIfPrompt(context: "weather-scroll", contextualLocation: false)
        let regions = app.otherElements.matching(NSPredicate(format: "label == %@", "Know Before You Go, region"))
            .allElementsBoundByIndex.filter { $0.exists && self.onScreen($0.frame) }
        guard regions.count == 1 else { try journeyBlock("KBYG region not unique") }
        let region = regions[0]
        let weather = journeyNodes().filter { $0.elementType == .staticText && ["Weather", "No active weather alerts."].contains($0.label) }
        if weather.count == 2 && weather.allSatisfy({ region.frame.contains($0.frame) }) {
            try settled("weather", required: ["Know Before You Go, region", "Weather", "No active weather alerts."])
            return
        }
        // Observed semantic endpoints stay inside the panel. XCTest's region
        // swipe rejects its visible frame; element-to-element drag uses the
        // proven child activation points without inventing screen coordinates.
        let starts = region.staticTexts.matching(NSPredicate(format: "label == %@", "No active official roadway conditions."))
            .allElementsBoundByIndex.filter { $0.exists && region.frame.contains($0.frame) }
        let ends = region.staticTexts.matching(NSPredicate(format: "label == %@", "No active local issues reported."))
            .allElementsBoundByIndex.filter { $0.exists && region.frame.contains($0.frame) }
        guard starts.count == 1, ends.count == 1, starts[0].isHittable, ends[0].isHittable else {
            try journeyBlock("KBYG semantic scroll endpoints not safely actionable")
        }
        try capture("before-weather-scroll")
        starts[0].press(forDuration: 0.1, thenDragTo: ends[0])
        events.append(["action": "journey-scroll", "label": "Know Before You Go, region", "direction": "up",
            "from": "No active official roadway conditions.", "to": "No active local issues reported."])
        try settled("weather", required: ["Know Before You Go, region", "Weather", "No active weather alerts."])
    }

    func testPhysicalJourney() throws {
        defer { try? attach(events, name: "events") }
        XCUIDevice.shared.orientation = .portrait
        try waitForHumanIfPrompt(context: "journey-launch", contextualLocation: false)
        guard visibleTitle() == nil else { try journeyBlock("Onboarding is present; journey cannot replay or complete it") }
        if journeyNodes().contains(where: { $0.label == "Map Layers, web dialog" }) {
            try journeyTap("Close Layers", role: .button)
        }
        if journeyNodes().contains(where: { $0.label == "No Active Alerts, web dialog" }) {
            try journeyTap("Close Alerts", role: .button)
        }
        if journeyNodes().contains(where: { $0.label == "Where are you going?, web dialog" }) {
            try journeyTap("Close destination search", role: .button)
        }
        if journeyNodes().contains(where: { $0.label == "Know Before You Go, region" }) {
            try journeyTap("Know Before You Go", role: .button)
        }
        try settled("home", required: ["LOCATION CONTEXT • DAYTON", "Open Alerts", "Know Before You Go"])
        try journeyTap("Search", role: .other)
        try settled("search-open", required: ["Where are you going?, web dialog", "Search addresses and places"])
        try searchDestination()
        try journeyTap("Austin Multi-county Community · Bastrop County · Hays County · Travis County · Williamson County Place", role: .button)
        try settled("destination-selected", required: ["SELECTED DESTINATION", "Austin", "Ready to preview."])
        try journeyTap("Close destination search", role: .button)
        try settled("destination", required: ["LOCATION CONTEXT • AUSTIN", "Return Home"])
        try journeyTap("Return Home", role: .button)
        try settled("destination-return-home", required: ["LOCATION CONTEXT • DAYTON", "Search"])

        try journeyTap("Know Before You Go", role: .button)
        try settled("kbyg-expanded", required: ["Know Before You Go, region", "Official Roadways"])
        try weatherScroll()
        try settled("road-awareness", required: ["Official Roadways", "No active official roadway conditions."])
        try journeyTap("Know Before You Go", role: .button)
        try settled("kbyg-collapsed", required: ["LOCATION CONTEXT • DAYTON"])
        try journeyTap("Open Alerts", role: .other)
        try settled("alerts-open", required: ["No Active Alerts, web dialog", "Close Alerts", "0 active conditions"])
        try journeyTap("Close Alerts", role: .button)
        try settled("alerts-closed", required: ["LOCATION CONTEXT • DAYTON", "Search"])

        try journeyTap("Zoom in", role: .button)
        try settled("map-zoom-in", required: ["Interactive travel conditions map. Use arrow keys to pan., region", "LOCATION CONTEXT • DAYTON"])
        try journeyTap("Zoom out", role: .button)
        try settled("map-zoom-restored", required: ["Interactive travel conditions map. Use arrow keys to pan., region", "LOCATION CONTEXT • DAYTON"])
        try journeyTap("Layers", role: .other)
        try settled("layers-open", required: ["Map Layers, web dialog", "Standard", "Satellite", "Close Layers"])
        try journeyTap("Close Layers", role: .button)
        try settled("layers-closed", required: ["LOCATION CONTEXT • DAYTON"])

        try journeyTap("Around Me — use my location", role: .button)
        try capture("around-me-request")
        try settled("around-me", required: ["LOCATION CONTEXT • AROUND ME", "Return Home"], contextualLocation: true)
        events.append(["gate": "R1-real-geolocation", "status": "INCONCLUSIVE",
            "reason": "Physical UI context activation is proven separately. Exact coordinates, GPS source, permission choice and persisted Home bytes are not exposed by XCTest."])
        try journeyTap("Return Home", role: .button)
        try settled("return-home", required: ["LOCATION CONTEXT • DAYTON", "Search"])
        guard !journeyNodes().contains(where: { $0.label == "Return Home" }) else { try journeyBlock("Temporary context did not clear") }

        try waitForHumanIfPrompt(context: "before-background", contextualLocation: false)
        XCUIDevice.shared.press(.home)
        if !poll(3, { self.app.state == .runningBackground || self.app.state == .runningBackgroundSuspended }) {
            events.append(["action": "home-button-unconfirmed", "appState": app.state.rawValue])
            // Public OS activation; no app data reset or permission interaction.
            springboard.activate()
        }
        guard poll(10, { self.app.state == .runningBackground || self.app.state == .runningBackgroundSuspended }) else {
            try journeyBlock("App background state not observed after OS activation; raw state " + String(app.state.rawValue))
        }
        let background = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        background.name = "background.png"; background.lifetime = .keepAlways; add(background)
        try attach(["kind": "background", "appState": app.state.rawValue, "springboard": tree(try springboard.snapshot())], name: "background-AX")
        events.append(["action": "lifecycle", "state": "background", "appState": app.state.rawValue])
        app.activate()
        try settled("resume", required: ["LOCATION CONTEXT • DAYTON", "Search", "Know Before You Go"])
        try waitForHumanIfPrompt(context: "before-relaunch", contextualLocation: false)
        app.terminate()
        guard app.wait(for: .notRunning, timeout: 10) else { try journeyBlock("Termination not observed") }
        events.append(["action": "lifecycle", "state": "terminated"])
        app.activate()
        try settled("relaunch", required: ["LOCATION CONTEXT • DAYTON", "Search", "Know Before You Go"])
        events.append(["gate": "R3-native-provider-networking", "status": "INCONCLUSIVE",
            "reason": "Visible roadway/weather states do not establish provider request origin, CORS or network recovery internals."])
        events.append(["action": "journey-complete", "onboardingRun": false, "visualReview": "REQUIRED"])
    }
}
