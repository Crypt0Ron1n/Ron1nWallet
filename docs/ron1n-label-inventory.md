# Ron1n Syndicate / Shogun Wallet — Label Inventory

Generated for the style-restyle task (visual-only, matching `docs/reference/style-reference.html`'s
look). **These labels are fixed.** The reference's own labels (Home, Market, Activity, Settings,
Assets, Vaults, Command Center, Card, Shogun Neon Swap, Cyber Vault, 1D/1W/1M/1Y, etc.) must not
replace any entry below. Restyling changes color/shape/spacing only.

## Brand wordmark
- **"RON1N SYNDICATE"** — Onboarding title, Syndicate screen header title
- **"SHOGUN WALLET"** — Onboarding subtitle, Wallet screen header title
- App display name (app.json): **"Ron1n Syndicate"**; wallet UI title: **"SHOGUN WALLET"**

## Top-level shell tabs (`Ron1nShellTabBar`)
Order fixed: **SYNDICATE → SHOGUN → SECURITY** (route names `Syndicate`/`Shogun`/`Security`,
rendered uppercase)

## Bottom tab bar (`Ron1nTabBar`, inside the Shogun shell)
Order fixed: **WALLET → SEND → ACTIVITY → SETTINGS** (route names, rendered uppercase; `Assets`,
`AssetProtection`, and `Disclosures` routes exist but are not bottom-bar items — reached via
in-screen buttons)

## Network selector
**Does not exist in the app today.** No network-switcher pill was found anywhere in `src/`. Per
the brief ("restyle only, and only if they already exist"), nothing to restyle here — do not add one.

## Privacy toggle / notification bell (header icons)
**Neither exists as a header icon button today.** "Privacy Mode" exists only as a `Switch` row
inside Settings → Privacy (label: "Privacy Mode"). There is no bell/notifications icon anywhere.
Per the brief, do not add either — restyle the existing Settings toggle only.

## Quick actions (Syndicate screen)
**SEND → RECEIVE → SECURITY → PROTECTION** (`QuickAction` labels, `SyndicateScreen.tsx`)

## Quick actions (Wallet screen hero)
**SEND → RECEIVE → SECURITY** (`WalletScreen.tsx` action cards)

## Chart mode toggle (Syndicate screen)
**LINE / CANDLES**

## Timeframe labels (Syndicate screen)
**5M / 15M / 4H / 24H** — exactly these four. Do not introduce 1D/1W/1M/1Y.

## Sub-tabs / segmented controls
- Activity screen tabs: **SIGNED TRANSACTION LIFECYCLE** / **PRIVATE DEVICE LEDGER** / **PUBLIC
  CHAIN ACTIVITY** (section headers, not a sliding segmented control — each renders as its own
  section)
- Send screen "SEND MODE": **EXACT SEND / SPEND TOTAL**
- Send screen "SECURITY PROFILE": **STANDARD / PROTECTED / MAXIMUM**
- Settings "STARTUP PAGE" radio options: **Syndicate / Shogun Wallet / Security**
- Assets screen groups: **NATIVE WALLETS / EVM NETWORKS / TOKENS / FUTURE NATIVE SUPPORT**

## Screen titles / subtitles (`Ron1nScreenHeader` and in-screen titles)
| Screen | Title | Subtitle |
|---|---|---|
| Syndicate | RON1N SYNDICATE | SELF-CUSTODY • DEFI • SECURITY |
| Wallet | SHOGUN WALLET | RON1N SECURITY LAYER |
| Security | SECURITY LAYER | EXPOSURE + ADDRESS HYGIENE |
| Settings | SETTINGS | VAULT CONTROL CENTER |
| Settings (recovery mode) | RECOVERY BACKUP | BIOMETRIC PROTECTED |
| Activity | ACTIVITY | PRIVATE + CHAIN LEDGER |
| Assets | ASSET LAYER | Your assets remain yours — Ron1n adds security visibility |
| Asset Protection | ASSET PROTECTION | YOUR KEYS. YOUR PRIVACY. YOUR DECISION. |
| Disclosures | DISCLOSURES | Security, privacy, network fees, and self-custody notices |
| Send (review) | SEND REVIEW | Reviewed, confirmed, signed, and verified before anything reaches the network |
| Onboarding | RON1N SYNDICATE | SHOGUN WALLET |
| Recovery Reveal | VAULT BACKUP | BIOMETRIC-GATED RECOVERY ACCESS // ZERO-KNOWLEDGE LAYER |

## Sheet / modal titles
- **ReceiveModal**: "RECEIVE {symbol}" (header), buttons: COPY / SHARE / CLOSE / ROTATE ADDRESS NOW
- **KeyRotationModal**: "QUANTUM KEY ROTATION" / "ASSET HYGIENE: {symbol}", button: ROTATE ADDRESS
  NOW (SWEEP + RETIRE) / CLOSE
- **ManualSyncConsentModal**: "Manual Chain Sync" (kicker: PRIVACY NOTICE), buttons: CANCEL / I
  UNDERSTAND
- **Send asset-select modal**: "SELECT ASSET", button: CANCEL
- **Send review modal**: "REVIEW TRANSACTION", buttons: BIOMETRIC CONFIRM / CANCEL

## Buttons (representative, not exhaustive — every existing button label is fixed)
SEND, RECEIVE, CLOSE, COPY, SHARE, ROTATE ADDRESS NOW, ROTATE ADDRESS NOW (SWEEP + RETIRE),
REVIEW SEND, BIOMETRIC CONFIRM, CANCEL, I UNDERSTAND, CREATE SHOGUN WALLET, RESTORE EXISTING
WALLET, I SAVED MY PHRASE, START OVER, REVIEW PHRASE AGAIN, BACK, REVEAL PHRASE, HIDE PHRASE,
I HAVE BACKED THIS UP, BACK TO SETTINGS, HIDE PHRASE IMMEDIATELY, RETURN TO SETTINGS, RECOVERY
PHRASE BACKUP, CLEAR PRIVATE ACTIVITY, CLEAR CHAIN CACHE, CLEAR ROTATION PREP RECORDS, CLEAR ALL
NON-VAULT DATA, DELETE LOCAL VAULT, RUN EXPOSURE SCAN, ASSET PROTECTION, CLEAR, DISMISS, MARK
COMPLETED, KEEP AS IS, SEPARATE IDENTITY, PROTECT ASSET, OPEN SHOGUN WALLET, INSPECT & ROTATE KEYS

## Toggle labels
- Settings → "Privacy Mode" ("Prevent automatic public-chain polling...")
- Settings → "Screen Capture Protection" ("Helps block screenshots and screen recording...")

## Status badges (representative)
SEND READY, RECEIVE ONLY, NOT YET AVAILABLE, NO SCAN YET, NOT AVAILABLE, ALL PROVIDERS OK,
ATTENTION REQUIRED, LIVE, FRESH/PROTECTED, LOW, ELEVATED, UNKNOWN, STRONG, WATCHFUL, ROTATION
ADVISED, ELEVATED RISK

## Section titles (representative, every existing one is fixed)
SELF-CUSTODY FIRST, PRIVACY MODE, RECOVERY PHRASE, CONFIRM RECOVERY PHRASE, RESTORE WALLET, MARKET,
RECENT ACTIVITY, CURRENT EXPOSURE, IDENTITIES, LIMITATIONS, RECOMMENDATIONS, YOUR DECISION,
SELF-CUSTODY, NETWORK FEES, PRIVACY, QUANTUM READINESS, NO INVESTMENT ADVICE, CORE RULES, RON1N
SECURITY SCORE, EXPOSURE SCANNER, PORTFOLIO READINESS, PREPARED FRESH RECEIVE ADDRESSES, RON1N IS
A SECURITY LAYER, POST-QUANTUM VAULT ROADMAP, RECENT PRIVATE ACTIVITY, STARTUP PAGE, LOCAL DATA
CONTROLS, APP ENVIRONMENT, DANGER ZONE, SYNC STATUS, TOTAL BALANCE, ASSETS HELD, PRIVACY MODE,
YOUR CRYPTO, WHY SENDING FEELS SLOWER, WHAT THESE LABELS MEAN

---

**Verification note:** this inventory was built by grepping every `title=`, `label=`, and literal
`<Text>` string across `src/screens/**` and `src/components/**`, plus reading the navigator
(`App.tsx`) to confirm no `tabBarLabel`/`title` override exists for the bottom tabs (so their
rendered text is the uppercased route name). It is not claimed to be byte-for-byte exhaustive of
every dynamic/interpolated string, but covers every static label, title, and button in the app —
which is what the STOP CONDITION ("matching the reference would change an existing label") cares
about.
