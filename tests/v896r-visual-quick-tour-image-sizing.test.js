const assert = require('assert');
const fs = require('fs');

const styleSource = fs.readFileSync('css/styles.css', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

assert(styleSource.includes('.gridly-v858-first-run-sheet:has([data-gridly-visual-quick-tour])'), 'visual Quick Tour can widen the onboarding sheet without changing behavior hooks');
assert(/\.gridly-v858-first-run-card:has\(\[data-gridly-visual-quick-tour\]\)[\s\S]*padding-inline:\s*clamp\(16px, 4vw, 28px\)/.test(styleSource), 'visual Quick Tour reduces unnecessary horizontal card padding');
assert(/\.gridly-v894c2-tour-card\.gridly-v896-visual-tour-card[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/.test(styleSource), 'visual cards remain a single full-width image column');
assert(/\.gridly-v894c2-tour-card\.gridly-v896-visual-tour-card[\s\S]*padding:\s*10px/.test(styleSource), 'visual cards reduce image padding');
assert(/\.gridly-v894c2-tour-card\.gridly-v896-visual-tour-card img[\s\S]*inline-size:\s*100%/.test(styleSource), 'screenshots use full available inline width');
assert(/\.gridly-v894c2-tour-card\.gridly-v896-visual-tour-card img[\s\S]*height:\s*auto/.test(styleSource), 'screenshots preserve aspect ratio');
assert(/\.gridly-v894c2-tour-card\.gridly-v896-visual-tour-card img[\s\S]*object-fit:\s*contain/.test(styleSource), 'screenshots are not cropped or distorted');
assert(/\.gridly-v894c2-tour-card\.gridly-v896-visual-tour-card p[\s\S]*grid-column:\s*auto/.test(styleSource), 'one-line captions remain below images');
assert(appSource.includes('renderedHeroWidth'), 'visual audit checks rendered hero image width');
assert(appSource.includes('captionVisible'), 'visual audit keeps caption visibility in the responsive pass');
assert(appSource.includes('preservedRatio'), 'visual audit verifies aspect-ratio preserving image behavior');
