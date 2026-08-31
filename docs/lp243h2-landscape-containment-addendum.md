# LP243.H2 landscape containment addendum

## RCA and repair

LP243.H introduced the correct `min(760px, 100vw - 24px)` bound, but it appeared
before later, equally applicable Portrait declarations. The first losing surface
was the fixed `.gridly-v2-brief-stack`: its later Portrait `left` and `right`
anchors won while the H width and translate remained, producing mixed geometry.
The app shell and fixed overlays also had separate containing blocks (document
flow versus viewport), so they did not inherit one horizontal origin.

H2 is intentionally the final stylesheet block. In landscape or at widths above
760px it defines `--lp243h2-shell-width` once, centers flow-owned shell surfaces,
and gives fixed top, briefing, tabs, Location Context, dock, and sheet surfaces
the same 50%/translate center and width. The map remains bounded by its shell;
Leaflet's internal tile and marker overflow is not treated as structural overflow.
Sheets retain a viewport-relative maximum height and internal vertical scrolling.

## Isolation and certification

The H2 media query cannot match 320x700, 390x844, or 430x932 portrait. It adds no
classes, inline styles, or runtime state, so 390x844 -> 844x390 -> 390x844 returns
to identical Portrait declarations. At 932x430 the governed shell is 760px wide
with 86px equal viewport gutters; 768x1024 resolves to 744px with 12px gutters;
1440x900 remains a centered 760px mobile-derived shell. This is containment, not
a desktop redesign. Desktop information-density and navigation redesign remain
explicitly outside LP243.H2.
