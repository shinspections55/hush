# AdSense Launch Checklist

## Hush Readiness: 2026-11-04

**Not ready to submit or serve live ads yet.** The account has been created but
not submitted. The operator reported Minnesota (MN), an audience that is not
adults-only, and free-entry prizes planned but not launched. No minimum age,
public support address, or operator identity has been selected.

Completed public content:
- /about.html: original explanation of Hush and its current capabilities.
- /contest-rules.html: current practice scoring and responsible-play information,
  explicitly NOT official rules for a prize competition.
- The homepage links About, the draft guide, mock practice, and practice rules
  without requiring sign-in. Account/draft workflows still require authentication.

Blocking decisions before policy pages can be finalized:
- Choose the legal operator name, country/state, and a working public contact
  method that also accepts privacy requests. Then publish a real Contact page.
- Decide minimum age and whether children under 13 are an intended or permitted
  audience. Obtain qualified advice on applicable children's privacy and consent
  requirements before collecting children's data or selecting ad treatment.
  Do not simply label the site 13+ without implementing the corresponding policy.
- Inventory actual collection, third-party processing, cookies/local storage,
  retention, deletion, and sharing. Finalize Privacy Policy and Terms against
  actual operations and user age policy; do not publish invented assurances.
- Obtain legal review of any planned Minnesota/other-jurisdiction prize contest;
  publish official eligibility, dates, prizes, judging/ties, verification, and
  award rules before opening entries. Current practice rules are not a substitute.
- Add finalized Contact, Privacy, and Terms links to the homepage and all
  monetized pages. Audit the entire production site, not just these public pages.

No public Contact/Privacy/Terms placeholders or fictional contact details were
published. These items remain blockers, not completed legal work.

## Existing Controlled Ad Integration

AdSense support is prepared but OFF. Nothing is requested from Google with the
default configuration. Unconfigured placements stay hidden and take no space.
Currently integrated pages: dashboard, mock draft contest introduction, and
standalone My Rankings (draftView=off).
Other placement names in the configuration are reserved, not yet integrated.
No ads are inserted into live auctions, bidding controls, admin pages, or printouts.
The shared loader has an explicit page allowlist: dashboard, contest intro, and
standalone rankings only. Rankings without draftView=off never loads ads.
Silent auction URLs (including extensionless and legacy copies) return
before fetching configuration or loading any ad provider, even if a slot or the
loader is accidentally added. Keep this exclusion when adding future placements.

Current locations (4 total, all disabled):
- dashboard-bottom: a wide banner below all three dashboard columns.
- dashboard-news-footer: at the top of the center column, above the RSS feed
  (placement ID retained so existing configuration continues to work).
- mock-intro-between: after the contest hero, before the scoring rules.
- rankings-bottom: below the complete workspace, outside player lists and tools.

Sample previews (no Google requests): /dashboard.html?adPreview=1,
/rankings.html?draftView=off&adPreview=1, and
/mock-draft-contest-intro.html?adPreview=1. Normal pages remain fully collapsed.
Start with a subset of dashboard placements rather than enabling every slot;
check ad density, mobile usability, and viewability before increasing inventory.

Regression check: `node tools/test-ad-placements.js`.

## Configure After Account Approval

This is a static HTML/CSS/JavaScript site served by Express, not WordPress or
React. It has no global HTML template. The supplied AdSense verification script
is included in the public homepage head only; it is not copied to every page.
The existing placement loader separately handles approved manual units only on
its allowlisted pages. The script's publisher ID was supplied by the operator.
No ads.txt seller record has been fabricated. Verify the deployed canonical host
and redirects in AdSense.

In ad-placements.json, use your real AdSense publisher ID and responsive display
ad-unit IDs. The IDs are public identifiers, not passwords. Example structure:

```json
{
  "adsense": {
    "enabled": false,
    "publisherId": "ca-pub-YOUR_16_DIGIT_ID",
    "productionHosts": ["your-domain.com", "www.your-domain.com"],
    "launchApproved": false
  },
  "placements": {
    "dashboard-bottom": { "enabled": true, "provider": "adsense", "slotId": "YOUR_10_DIGIT_SLOT" },
    "mock-intro-between": { "enabled": true, "provider": "adsense", "slotId": "ANOTHER_10_DIGIT_SLOT" }
  }
}
```

Leave enabled and launchApproved false until every launch gate below is complete.
launchApproved is an operator release gate, NOT a visitor consent signal.

## Required Launch Gates

- Get site/account approval and create responsive display units in AdSense.
- Publish an accurate privacy/cookie policy, accessible from every monetized page.
- Configure Google's Privacy & messaging or another Google-certified CMP for
  applicable visitors, including EEA, UK, and Switzerland. Integrate its supplied
  code before ad requests and verify regional consent and withdrawal behavior.
  This loader does not implement a CMP or grant consent for visitors.
- Publish the exact ads.txt line supplied by your AdSense account at /ads.txt.
  Do not publish a fabricated publisher ID. Verify it on the production domain.
- The server CSP allows the AdSense verification script origin only. This does
  not enable or authorize ad serving. Before release, integrate Google's current
  CSP/nonce guidance and CMP requirements in server.js, verify Google script,
  frame, image, and connection origins on production, and keep the policy
  restrictive. Do not solve this by adding unsafe-inline or wildcard script access.
- Keep Auto ads OFF initially, or exclude admin, account/payment, login,
  live draft/bidding, and shared mock-report pages. Manual units alone do not
  prevent Auto ads from injecting placements if you enable it in the account.
- Only after verification set adsense.enabled and launchApproved to true.
- Do not enable Auto ads globally as part of approval. AdSense site verification
  is separate from permission to insert ad units into protected draft workflows.

## Behavior And Performance

- One asynchronous Google loader per page; no refresh loops or click handlers.
- Units request once near the viewport, on explicitly allowed HTTPS hosts only.
  Localhost and embedded builders never make live AdSense requests.
- Disabled or unconfigured slots are fully collapsed. Enabled AdSense units
  become visible before requesting, as Google requires. A brief pending space is
  possible; hiding requests until filled is NOT supported by Google.
- data-ad-status="unfilled" collapses the entire placement. A network/ad blocker
  preventing the Google script from loading leaves the placement collapsed.
  A request that never receives a status may retain pending space; no timeout
  removes an ad that could fill later. Do not hide filled creatives.
- Google's unfill-optimized behavior is not treated as unfilled. Review the
  account's "Fill empty in-page ads" setting if you want no replacement content.
- Google determines fill, auction prices, and eligibility; revenue is not
  guaranteed. Compare placement RPM/viewability and Core Web Vitals after launch.
- Test desktop/mobile on staging using Google's supported testing workflow;
  do not click live ads or generate artificial impressions.

Official references:
- https://support.google.com/adsense/answer/10762946
- https://support.google.com/adsense/answer/9183363
- https://support.google.com/adsense/answer/13554116