# Style Restyle Report — Sapphire reference match

Visual-only restyle matching `docs/reference/style-reference.html`'s color/shape language. No
label, route, or logic file was touched. Not committed or pushed — left in the working tree.

## Files changed

21 files, 91 insertions / 66 deletions (`git diff --stat`), all theme/component/screen **style**
files — no wallet, transaction, crypto, vault, key-management, API, or navigation-logic file
appears in the diff:

- `src/theme/ron1nTheme.ts` — new tokens (below)
- Shared components: `Ron1nButton.tsx`, `Ron1nCard.tsx`, `Ron1nScreen.tsx`, `Ron1nTabBar.tsx`,
  `Ron1nShellTabBar.tsx`, `Ron1nAssetCard.tsx`, `Ron1nEmptyState.tsx`
- Modals: `KeyRotationModal.tsx`, `ReceiveModal.tsx`, `ManualSyncConsentModal.tsx`
- Screens: `WalletScreen.tsx`, `SyndicateScreen.tsx`, `SendScreen.tsx`, `SettingsScreen.tsx`,
  `SecurityScreen.tsx`, `ActivityScreen.tsx`, `AssetsScreen.tsx`, `AssetProtectionScreen.tsx`,
  `RecoveryRevealScreen.tsx`

## Tokens added (`src/theme/ron1nTheme.ts`)

Every existing token kept. Added:
- `Ron1nColors.abyss` `#030816`, `.obsidian` `#061028`, `.sapphireSurface` `#0B1A3D`,
  `.sapphireSurfaceLight` `#0F2352`, `.sapphireModal` `#091636`
- `Ron1nGlass.borderSky` `rgba(56,189,248,0.18)`, `.borderSkyStrong` `rgba(56,189,248,0.25)`
- `Ron1nGradients.sapphireApp` (page background), `.sapphireHero` (static hero-card fill — no
  animated gradient border, per the brief)
- Updated two existing token **values** (not removed/renamed): `Ron1nGlass.modalOverlay` →
  `rgba(3,8,22,0.8)` (abyss at 80%, replacing the earlier neutral black), `Ron1nRadii.modal` →
  `30` (was 26, now inside the brief's 28-32 sheet-corner range); added `Ron1nRadii.hero: 25`
  (brief's 24-26 hero-card range).

Reference colors mapped to **existing** tokens, nothing new added for them: `#00FF88` →
`neonGreen`-equivalent is already `Ron1nColors.green`/`neonGreen` (left as-is, untouched);
`#B026FF` → `neonPurple` (already the primary-CTA/active-tab color, unchanged); `#9333EA` →
`purple` (`#8C00FF`, already the gradient's mid-stop); `#FF4D6D` → `danger` (`#FF4D4D`, unchanged);
sky-200 text tints → `gray`/`muted` (unchanged).

## What changed visually

- **Page background**: every screen (`Ron1nScreen`) now renders the sapphire `abyss→obsidian→abyss`
  gradient instead of the previous purple-tinted black.
- **Cards** (`Ron1nCard`, used on every screen): solid `sapphireSurface`/`sapphireSurfaceLight`
  fill with `borderSky`/`borderSkyStrong` hairlines, replacing the translucent white-glass fill.
- **Buttons** (`Ron1nButton`): primary unchanged (already a `neonPurple→purple→deepPurple`
  gradient with a white bold label — already matched the brief). Secondary now
  `sapphireSurfaceLight` + `borderSky` instead of the neutral `inputBg`/white-alpha border.
  Disabled unchanged (muted charcoal, no glow — already matched).
- **Bottom tab bar / shell tab bar**: dock background retinted to `sapphireModal`-tinted
  (`${sapphireModal}E0`) / `sapphireSurfaceLight`, borders to `borderSky`/`borderSkyStrong`.
  Height, order, and labels unchanged (60px, WALLET/SEND/ACTIVITY/SETTINGS and
  SYNDICATE/SHOGUN/SECURITY).
- **Modals/sheets** (`KeyRotationModal`, `ReceiveModal`, `ManualSyncConsentModal`, Send's
  asset-select and review modals via the shared overlay/radius tokens): background now
  `sapphireModal`, overlay now abyss@80%, top corners now 30 (was 26). Each sheet's existing
  semantic accent border (green for Receive, purple for Send/rotation, gold for fee notices) was
  **kept** — the reference itself uses a different accent border per sheet, so this matches rather
  than flattens it.
- **Asset rows** (`Ron1nAssetCard`): row fill moved from a translucent white-alpha surface to
  `sapphireSurfaceLight`; the per-asset colored icon chip/border (already existing) is unchanged —
  it already matched the reference's "icon chip" pattern.
- **Hero balance card** (`WalletScreen`): its inline-built gradient array was moved into
  `Ron1nGradients.sapphireHero` (fixing a pre-existing "gradient built in render" violation while
  restyling it), radius 27→25, border recolored to `borderSky`. Glow opacity was already ≤25%
  (0.25) — unchanged.
- **Per-screen custom cards/dividers** across Wallet/Assets/Send/Syndicate/Settings/Asset
  Protection/Activity/Security/Recovery-Reveal: every `Ron1nGlass.surface`/`surfaceElevated`/
  `border`/`borderStrong` reference was retinted to the matching sapphire token
  (`sapphireSurface`/`sapphireSurfaceLight`/`borderSky`/`borderSkyStrong`).

## Excluded reference items found and skipped (per Step 5)

Found in the reference and deliberately **not** copied:
- Device frame, fake status bar (9:41, notch), animated dot/ping badges, backdrop-filter blur,
  animated gradient border on the hero card, sparkline-dot pulse — none exist in this codebase to
  begin with (RN has no such chrome), so nothing needed removing.
- Mock data: balances ($52,480.90), the `0x71C...` address, card number/CVV, gas figures, APY
  figures — none were copied; the app's real data sources are untouched.
- New screens/features: Card/VIP card + freeze control, Vaults/Staking/Harvest, MEV Blocker toggle,
  Command Center, 3-mode theme switcher, market highlight tiles, Swap sheet/rate display, network
  selector pill, notification bell — **none added**. Confirmed via the label inventory: no new
  screen, tab, button, or toggle exists that wasn't already in the app.
- Claim text ("Apple Pay...", "Backed up to Hardware Enclave", "Supports Ethereum, Arbitrum, Base &
  Solana", "Zero Slippage", "Zero MEV Active", "Shogun Router") — none copied anywhere.
- Timeframes: app still shows exactly 5m/15m/4h/24h; 1D/1W/1M/1Y were not introduced.
- Brand: wordmark remains "RON1N SYNDICATE" / "SHOGUN WALLET" everywhere; "SHOGUN"/"Cyber Vault"
  branding from the reference was not copied.
- Toast system: the reference's toast banner was not added — no toast system exists in this app
  and none was introduced.

## Layout changes made (reported, not just proposed — all non-shifting)

Only radius-value changes, which don't move or resize sibling elements:
- `Ron1nCard`'s `glass`/`cardLarge` radii were already 18/22 (unchanged this pass).
- `Ron1nRadii.modal` 26→30; `WalletScreen.heroCard` radius 27→25; new `Ron1nRadii.hero: 25`.
- Tab bar height, button height, input height, and all padding/margin/dimension values are
  unchanged everywhere — confirmed by `git diff --stat`'s line counts (every changed line is a
  color/token swap, not a dimension).

No other layout change was made or is believed necessary.

## Not applied (reported per brief, out of scope for a "visual-only, no functional change" pass)

- **Input focus border** (brief: "neonPurple border on focus"): existing `TextInput`s already use
  `sapphireSurface`/`inputBg` + hairline borders (from the earlier color pass), but none has
  `onFocus`/`onBlur` wiring to swap border color on focus. Adding that requires new component
  state — treated as exceeding "visual-only, no functional change," consistent with the same call
  made in the prior color-redesign session. Flagging rather than adding silently.
- **Network pill / privacy-toggle / notification-bell restyle**: none of the three exist in the
  app today (confirmed in the label inventory), so there is nothing to restyle — the brief says
  "restyle only, and only if they already exist."
- `Ron1nSeoMetadata.tsx`'s web-only `theme-color` meta tag still reads `#050505`, slightly off the
  new `abyss` (`#030816`) base. Cosmetic, web-only, not fixed — low enough priority to flag rather
  than touch under time pressure.

## STEP 7 — Verification

1. **Typecheck**: `npx tsc --noEmit` → exit 0, matches the Step 0 baseline (also exit 0). No test
   script exists in `package.json` (confirmed again, same as every prior session) — nothing to
   regress there.
2. **Hardcoded hex/rgba outside the theme file**: 12 occurrences remain, identical set to before
   this task (QR `color`/`backgroundColor` must stay pure black/white for scannability;
   `Ron1nButton`'s untouched outline-variant border and danger-text legibility tint; dead/unused
   `FlickerButton.tsx`; 5 per-chain brand accents in `assetVisuals.ts`; the web-only SEO meta tag
   noted above). No new leftovers were introduced by this pass.
3. **Label diff**: zero label/text edits were made anywhere in this pass — every change was to a
   `style`/`StyleSheet` value, an import, or a gradient/radius token reference. `docs/ron1n-label-
   inventory.md` is therefore unchanged from what the app already renders; nothing in it was
   touched or needed touching.
4. **`git diff --stat`**: 21 files — exactly `ron1nTheme.ts`, component style files, and screen
   style files (listed above). No wallet/transaction/crypto/vault/key/API/navigation file appears.

## Manual device checklist (for you to run)

- [ ] Every tab navigates (Syndicate/Shogun/Security shell; Wallet/Send/Activity/Settings bottom bar)
- [ ] Sheets open and close (Receive, Key Rotation, Manual Sync consent, Send's asset-select and
  review modals) without flicker
- [ ] No layout jump on load for any screen
- [ ] Prices and charts still load on Syndicate (Line and Candles, all four timeframes)
- [ ] Send completes end to end (review → biometric confirm → broadcast); Receive still shows the
  QR/address/copy flow
- [ ] Privacy Mode toggle (Settings) still masks/unmasks whatever it already masked
- [ ] Biometric prompt still gates Send (signing) and the second broadcast authorization

(No "Swap" flow exists in this app to check — it's a reference-only feature, correctly excluded.)
