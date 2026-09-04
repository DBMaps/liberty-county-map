import { expect, test } from "@playwright/test";

test("short-landscape controls float clear of the contained Location Context tray", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => document.querySelector("#gridlyLandscapeCommandToggle")?.dataset.lp243h10bBound === "true");

  const rail = page.locator("#gridlyPortraitV2 > .gridly-v2-control-rail");
  await expect(rail).toBeHidden();
  await page.locator("#gridlyLandscapeCommandToggle").evaluate((button) => button.click());
  await expect(rail).toBeVisible();

  const geometry = await page.evaluate(() => {
    const railNode = document.querySelector("#gridlyPortraitV2 > .gridly-v2-control-rail");
    const panel = document.querySelector("#mobileDestinationCommandPanel");
    const button = document.querySelector("#mobileDestinationCommandBtn");
    const railRect = railNode.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const railStyle = getComputedStyle(railNode);
    const panelStyle = getComputedStyle(panel);
    const beforeStyle = getComputedStyle(panel, "::before");
    const buttonStyle = getComputedStyle(button);
    return {
      railParent: railNode.parentElement.id,
      panelParent: panel.parentElement.id,
      railBottom: railRect.bottom,
      panelTop: panelRect.top,
      gap: panelRect.top - railRect.bottom,
      rightInset: innerWidth - railRect.right,
      railPosition: railStyle.position,
      controls: [...railNode.querySelectorAll("button")].map((node) => node.getBoundingClientRect().height),
      panelRight: panelRect.right,
      panelOverflow: panelStyle.overflow,
      beforeContent: beforeStyle.content,
      beforeDisplay: beforeStyle.display,
      buttonHeight: buttonRect.height,
      buttonWidth: buttonRect.width,
      buttonFontSize: buttonStyle.fontSize,
      buttonFontWeight: buttonStyle.fontWeight
    };
  });

  expect(geometry.railParent).toBe("gridlyPortraitV2");
  expect(geometry.panelParent).toBe("gridlyPortraitBottomRegion");
  expect(geometry.railPosition).toBe("fixed");
  expect(geometry.railBottom).toBeCloseTo(246, 0);
  expect(geometry.panelTop).toBeCloseTo(278, 0);
  expect(geometry.gap).toBeGreaterThanOrEqual(28);
  expect(geometry.gap).toBeLessThanOrEqual(34);
  expect(geometry.rightInset).toBeGreaterThanOrEqual(16);
  expect(geometry.controls.every((height) => height >= 44)).toBe(true);
  expect(geometry.panelRight).toBeLessThanOrEqual(875);
  expect(geometry.panelOverflow).toBe("clip");
  expect(["none", "normal"]).toContain(geometry.beforeContent);
  expect(geometry.beforeDisplay).toBe("none");
  expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.buttonWidth).toBe(88);
  expect(geometry.buttonFontSize).toBe("12.48px");
  expect(Number(geometry.buttonFontWeight)).toBeLessThanOrEqual(600);
});

test("portrait does not receive the short-landscape polish", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 875 });
  await page.goto("/");
  const values = await page.locator("#mobileDestinationCommandPanel").evaluate((panel) => ({
    containment: getComputedStyle(panel).contain,
    beforeDisplay: getComputedStyle(panel, "::before").display,
    buttonWidth: document.querySelector("#mobileDestinationCommandBtn").getBoundingClientRect().width
  }));
  expect(values.containment).not.toBe("paint");
  expect(values.beforeDisplay).not.toBe("none");
  expect(values.buttonWidth).not.toBe(88);
});
