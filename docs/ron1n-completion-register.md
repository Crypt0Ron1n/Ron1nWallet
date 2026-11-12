# Ron1n Syndicate / Shogun Wallet — Completion Register

Audit-first session. Report only — no wallet, transaction, crypto, vault, key-management, or
navigation logic was changed to produce this document. All claims below were verified by reading
the cited file/function; anything not traced to code is explicitly marked **Unverified**.

Generated: 2026-11-12. Branch: `main`, HEAD at commit `c584f3c`.

---

## CRITICAL FINDING (stop-condition triggered)

**Plaintext mnemonic held in React component state, outside the vault boundary, in two separate
screens.**

- `src/screens/SettingsScreen.tsx:175,182` — `openRecoveryBackup()` calls
  `VaultService.getMnemonic()` and stores the raw plaintext phrase via `setRecoveryPhrase(mnemonic)`
  (state declared line 43) immediately after a **single** biometric prompt (`authenticate(...)`,
  line 168), even though the phrase is not yet visually shown (a *second* `revealPhrase()` biometric
  prompt gates `phraseVisible`). The plaintext therefore sits in component state, retrievable via
  React DevTools/state inspection, for the entire time the recovery screen is mounted — not just
  while visible on screen. It is cleared on `closeRecoveryScreen()` (line 452) and on vault deletion
  (line 423), so it is not permanently retained, but it does live outside `CryptoCore`/the vault
  module for part of the flow.
- `src/screens/RecoveryRevealScreen.tsx:24,49` — a second, separate recovery-reveal implementation
  with the identical pattern: `CryptoCore.revealRecoveryPhrase()` result is stored via
  `setMnemonic(storedMnemonic.split(' '))` into `useState<string[] | null>`.
- Also note: `VaultService.ts:21-23` still exposes `getMnemonic()` as a public (if `@deprecated`-
  annotated) method, and `src/services/crypto/CryptoCore.ts:455-493`'s own
  `revealRecoveryPhrase()` contains a dead/tautological self-check (lines 478-484 test conditions
  against a literal object constructed seven lines above them, which can never be false) — not a
  vulnerability, but worth noting as misleading code.

**Why this matters:** the project's own `VaultService.ts` comment says "New cryptographic code
should use CryptoCore instead of retrieving the mnemonic directly," and `InternalVaultService.ts`'s
own header comment says "Application code must not import this module directly." Two live screens
retrieve and hold the raw phrase anyway. Both are biometric-gated and both clear the value on exit,
so this is not an unauthenticated leak — but it is plaintext secret material outside the vault
boundary, which is exactly what the audit brief's stop condition names. Reporting immediately per
instruction; **no fix applied** (this is wallet/vault logic, out of scope for this session without
your approval).

**No other stop condition fired.** I did not find any code path that can sign or broadcast without
passing both `SigningAuthorizationService.authorize()` and `BroadcastAuthorizationService.authorize()`
(see §3.4).

---

## STEP 0 — Baseline

- `git status` — clean in `src/` (only the long-standing untracked dump/backup/zip files and
  `project_files.txt` are present; same as every prior session).
- `git log --oneline -8` confirms all five shipped commits on `main` in order:
  `c584f3c`, `2a15d4a`, `258714f`, `5143cb8`, `f31e123` (plus `bd48366` and earlier). Not redone.
- **Typecheck:** `npx tsc --noEmit` → exit 0, clean.
- **Test command:** there is no `test` script in `package.json` (`scripts` = start/android/ios/web
  only). The project's only automated checks are four standalone self-test files, run manually via
  an ad hoc `tsc --skipLibCheck` + `node` invocation (no CI wiring found):
  `src/services/transactions/BroadcastRecoveryService.selfTest.ts`,
  `src/services/transactions/TransactionLifecycleService.selfTest.ts`,
  `src/utils/candlestickMath.selfTest.ts`, `src/utils/sparklineMath.selfTest.ts`. They were not
  re-run this session (report-only, and none of the touched areas changed their inputs).
- **adb / Metro:** `adb devices` returned no device attached; Metro (`localhost:8081`) is down
  (connection refused). Reported only, nothing restarted, per instruction.

---

## STEP 1 — Verify shipped changes

### a. Theme tokens
`src/theme/ron1nTheme.ts` confirmed to contain every token the brief called for: `inputBg`
(`#22232D`), `pressed` (`#292936`), `Ron1nGradients.primaryButton`, `Ron1nRadii.button/input/card/
cardLarge/modal` (13/12/18/22/26), `Ron1nGlass.modalOverlay` (`rgba(0,0,0,0.68)`). All present,
unmodified since shipping.

**Hardcoded hex/rgba outside the theme file** — 12 occurrences remain, all previously justified and
unchanged:

| File | What | Why it's left |
|---|---|---|
| `ReceiveModal.tsx:81` | QR `color`/`backgroundColor` | QR scannability requires pure black/white |
| `ReceiveModal.tsx:191,212` | drag-handle highlight, QR backing white | Same QR-contrast / generic neutral, not a brand color |
| `Ron1nButton.tsx:47,53` | outline-variant border, danger-text tint | Untouched variants outside the brief's scope; legibility tint |
| `FlickerButton.tsx:21` | `#050505` background | Dead component — not imported/used anywhere in `src/` |
| `assetVisuals.ts:16,22,59,65,71` | 5 per-chain brand accents | Canonical third-party brand colors, not UI theme |
| `Ron1nSeoMetadata.tsx:43` | `theme-color` meta tag | Web-only SEO tag, value already equals `Ron1nColors.black` |

No new leftovers introduced since the prior report.

### b. Tab bar
`src/components/Ron1nTabBar.tsx:132` — `bar.height: 60` confirmed. `item` style (line 144-154)
carries `borderWidth`, `borderColor: Ron1nGlass.border`, `backgroundColor: Ron1nGlass.surface`
unconditionally (not gated on `focused`), so every tab renders a persistent chip at rest; `itemActive`
only overrides color. Confirmed exactly as shipped.

### c. Timeframes
`src/screens/SyndicateScreen.tsx:379-396` — the chart render block branches only on `chartMode`
for which component to render (`Ron1nCandlestick` vs `Ron1nSparkline`); both read
`candlesByTimeframe[timeframe]?.[row.symbol]`, so **both chart types do read the selected
timeframe**, confirmed.

**Correction to the brief's expectation:** 5m, 15m, 4h, and 24h do **not** each map to a distinct
network request. `src/services/syndicate/SyndicateMarketService.ts:121-150` —
`loadCandles('4h')` calls `PriceService.getOhlc()` (its own request burst). `loadCandles('5m'|'15m'|
'24h')` all share **one** cached call to `PriceService.getFineGrainedPrices()` (module-level
`cachedPointSeries`, 60s TTL) and differ only in the client-side bucket width passed to
`pointsToCandles()`. This is intentional (it's the fix for the rate-limit regression you reported
last session) but contradicts a literal reading of "each maps to a distinct request" — flagging the
discrepancy rather than silently confirming it.

**Candle cap:** `MAX_CANDLES = 48` (line 37), applied via `.slice(-MAX_CANDLES)` in both the OHLC
branch (line 128) and the resample branch (line 143). Confirmed.

### d. Rate limiting
All CoinGecko call sites are in `src/services/PriceService.ts`, four methods:
`getUsdPrices` (line 44), `getMarketData` (line 106), `getOhlc` (line 192), `getFineGrainedPrices`
(line 251). No other file in `src/` calls `coingecko` directly (confirmed by repo-wide grep).

- **No request fires per chart mode on mount** — confirmed. `SyndicateScreen.tsx:193-198`'s candle-
  load effect does not depend on `chartMode`, and is gated on `!marketLoading`, so it fires once per
  timeframe regardless of which chart mode is active, and only after the single batched price call
  (`loadMarket`) has resolved.
- **Cache key correctness** — `candlesByTimeframe` (component state) is keyed per-timeframe
  correctly. The new `cachedPointSeries` (module-level, `SyndicateMarketService.ts:16`) is **not**
  keyed at all — it's a single shared slot reused by 5m/15m/24h, by design, and is global to the
  module (shared across any component instance that calls `loadCandles`), not request-scoped. Not a
  bug, but worth naming as a design detail if another screen ever calls this service concurrently.
- **Calls that can still fire in parallel** — `getOhlc` and `getFineGrainedPrices` each still fire
  one simultaneous request per unique CoinGecko id via `Promise.allSettled` (≈12-13 requests at
  once for the current 16-asset catalog, since ARB/BASE/ETH share the `ethereum` id). The burst
  itself is not throttled or staggered — only de-duplicated across timeframe switches and sequenced
  relative to the price call. This is the most likely remaining source of a rate-limit incident if
  the user rapidly cycles through 4h repeatedly (each 4h selection re-fires the full OHLC burst,
  uncached).

### e. Security Score guidance
`src/screens/SecurityScreen.tsx:41-66` (`calculateSecurityScore`) deducts: ELEVATED −10, UNKNOWN −6,
LOW −3 per asset, plus −2 per `failedAssets`. The guidance text added at line 307-312 says to
"rotate any LOW or ELEVATED exposure asset" and "resolve failed syncs via Wallet → Manual Sync."
Cross-checked against `src/services/security/ExposureScannerService.ts:28-45`
(`classifyExposure`): `UNKNOWN` is produced specifically when the provider sync `status === 'FAILED'`
— i.e. UNKNOWN *is* a failed sync. So "resolve failed syncs" correctly covers both the UNKNOWN
exposure penalty and the separate `failedAssets` penalty, even though UNKNOWN isn't named explicitly.
**No mismatch found** — the guidance text is accurate.

---

## STEP 2 — Price feed privacy and reliability (report only)

### Hosts contacted and what they receive

| Host | Purpose | Data received |
|---|---|---|
| `api.coingecko.com` | Market prices/candles (Syndicate) | Caller IP only — no wallet address, no user identifier. Requests are by CoinGecko coin id (e.g. `bitcoin`), never by this wallet's address. |
| `ethereum.publicnode.com`, `api.avax.network`, `evm.cronos.org`, `rpc.berachain.com`, `mainnet.base.org`, `polygon-rpc.com`, `arb1.arbitrum.io` | EVM balance/gas/nonce RPC | **Wallet address** (`eth_getBalance`, `eth_getTransactionCount` params), caller IP |
| `eth.blockscout.com`, `avax.blockscout.com`, `base.blockscout.com`, `arbitrum.blockscout.com` | EVM transaction history | **Wallet address** (in URL path/query), caller IP |
| `api.mainnet-beta.solana.com` | SOL balance/history | **Wallet address** (JSON-RPC body param), caller IP |
| `s1.ripple.com` | XRP balance/history | **Wallet address** (JSON-RPC `account` field), caller IP |
| `horizon.stellar.org` | XLM balance/history | **Wallet address** (URL path), caller IP |
| `mainnet-idx.algonode.cloud` | ALGO balance/history | **Wallet address** (URL path), caller IP |
| `blockstream.info` | BTC balance/history | **Wallet address** (URL path), caller IP |
| `litecoinspace.org` | LTC balance/history | **Wallet address** (URL path), caller IP |

No analytics, crash-reporting, or telemetry SDK is present (`package.json` has no Sentry/Firebase/
Amplitude/Bugsnag/Crashlytics dependency — confirmed by grep). No host above receives the mnemonic,
a private key, or a signed transaction's digest before the user explicitly authorizes a broadcast.

### Flagged: every per-chain balance/history provider sends the user's address to a third party

This is inherent to any non-custodial wallet without a self-hosted/local node — stated here per the
brief's instruction to flag it, not as a defect. CoinGecko (price-only) is the one call path that
never receives the address.

### Proposed design (not implemented): price-feed proxy

To stop CoinGecko from ever seeing the user's IP in correlation with usage patterns (it still
wouldn't see the wallet address, since Syndicate never sends one — but IP + request timing/asset-
interest pattern is itself a privacy signal):

- Add a thin server-side proxy (e.g. a small Cloudflare Worker / Vercel edge function) that holds a
  CoinGecko **paid-tier API key** server-side, exposes `/markets`, `/ohlc`, `/chart` endpoints
  mirroring today's three `PriceService` call shapes, and caches each upstream response for a short
  TTL (30-60s) shared across all app users.
- The app's `PriceService` would point at the proxy's URL instead of `api.coingecko.com` directly —
  a one-line base-URL change per method, no other code change.
- Effect: CoinGecko only ever sees the proxy's server IP and the paid-tier key, never any individual
  user's IP; the shared cache also multiplies the effective rate-limit budget across all users
  instead of each device burning its own.
- This does not change the RPC/explorer calls in the table above — those still need the user's
  address sent somewhere to look up a balance, unless/until a self-hosted indexer or light-client
  model is adopted (out of scope here).

---

## STEP 3 — Crypto and transaction audit

Status legend: **Complete+tested** (code + a self-test covering it) / **Implemented-untested**
(code exists, verified by reading, no automated test) / **Partial** / **Stubbed-mocked** /
**Missing** / **Blocked**.

### 1. Vault — `src/services/crypto/InternalVaultService.ts`, `src/services/VaultService.ts`

- **Implemented-untested.** Mnemonic stored via `expo-secure-store` with
  `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`InternalVaultService.ts:23-25`) — hardware
  keystore-backed, device-bound, non-exportable. A legacy key is carried for migration (`LEGACY_
  MNEMONIC_KEY`) and auto-migrated forward on first read (lines 36-45).
- No app-level "unlock/lock" session exists — there's no persistent "unlocked" state to attack;
  every sensitive read is biometric-gated at the point of use (see §3.4) rather than once per app
  session. Confirm this is the intended model, not a gap — it reads as a deliberate, stronger design.
- Recovery: `CryptoCore.revealRecoveryPhrase()` (biometric-gated) and the duplicate
  `VaultService.getMnemonic()` path in `SettingsScreen.tsx` (also biometric-gated, one prompt
  earlier than the former — see **Critical Finding** above).
- **No plaintext mnemonic found in `AsyncStorage`, logs, or analytics** — confirmed by grep (only one
  console statement references "mnemonic" at all, and it logs a generic error object, not the value;
  see §3.7). The one real gap is the React-state residency documented at the top of this report.

### 2. CryptoCore — `src/services/crypto/CryptoCore.ts`

Chain coverage at the **signing** layer (`signTransaction`, line 495) vs. the **product/broadcast**
layer (`assetCatalog.ts`):

| Chain | `CryptoCore.signTransaction` | `assetCatalog.supportsBroadcast` | Outbound in app today |
|---|---|---|---|
| EVM (ETH) | Enabled | `true` | **Enabled** — only chain with a live send path |
| EVM (AVAX/CRO/BERA/BASE/POL/ARB) | Enabled (shares EVM path) | `false` | Disabled |
| BITCOIN | Enabled | `false` | Disabled |
| LITECOIN | Enabled | `false` | Disabled |
| SOLANA | Explicitly blocked (line 500-508: `throw` if chain not EVM/BITCOIN/LITECOIN) | `false` | Disabled |
| XRP | Explicitly blocked | `false` | Disabled |
| STELLAR | Explicitly blocked | `false` | Disabled |
| ALGORAND | Explicitly blocked | `false` | Disabled |

So signing *code* exists for three chains (EVM/BTC/LTC), but the product gate — both the catalog
flag (enforced fail-closed in `SecurityPolicyEngine.evaluate`, see §3.3) and an explicit
`asset.symbol !== 'ETH'` check in `SendScreen.tsx:474` — restricts actual end-to-end sending to ETH
only. I did not trace a BTC/LTC send UI path to confirm whether one exists and is merely gated off,
or doesn't exist at all; **marking that specific question Unverified** rather than guessing.

Key-derivation libraries present: `@scure/bip32`/`@scure/bip39` (HD derivation, all chains),
`@noble/curves/secp256k1` + `ethers` (EVM/BTC/LTC secp256k1), `tweetnacl` (ed25519 — SOL/XLM/ALGO),
`ripple-keypairs` (XRP), `@stellar/stellar-base` (XLM), `algosdk` (ALGO), `bitcoinjs-lib` (BTC/LTC
serialization). **Correction to a likely assumption:** CryptoCore is not secp256k1-only — it already
has ed25519 derivation code paths (Solana/Stellar/Algorand use ed25519). For Monero, the gap isn't
the curve (Monero is also ed25519-family) but the entire transaction model: stealth addresses,
key images, ring signatures, RingCT — none of which exist anywhere in this codebase (confirmed:
`EvmPrivacyStrategy.ts:5` explicitly states no stealth-address execution exists "here or anywhere
else in the app yet"). For Zcash, transparent (t-addr) signing would fit the existing secp256k1
pattern, but shielded (z-addr) support needs a zk-SNARK proving system (Sapling/Orchard) which is an
entirely separate subsystem, not an extension of `CryptoCore`'s current shape. Both are **Missing**,
correctly out of scope for "later."

### 3. Transaction pipeline

| Stage | File : function | Status |
|---|---|---|
| TransactionIntent | `transactions/TransactionIntent.ts` (built in `TransactionSecurityGateService.ts:193-208`) | Complete+tested (shape validated via `validateTransactionIntent`) |
| Validation | `TransactionSecurityGateService.ts:210` (`validateTransactionIntent`) | Implemented-untested |
| SecurityPolicyEngine | `SecurityPolicyEngine.ts:77-99` (`evaluate`) — fails closed: default capabilities param (line 79-83) is `broadcastSupported:false, providerConnected:false, providerMode:'DISABLED'`; `!capabilities.broadcastSupported` → immediate `BLOCK` (line 93-99) | Implemented-untested |
| Rotate Before Send | `SendScreen.tsx:437-462` (`ProtectBeforeSendService.assess` → blocks on `REQUIRED`/`UNREGISTERED`/`BLOCKED`/`requiresRotation`/`requiresMigration`) | Implemented-untested |
| Biometric authorization (sign) | `SigningAuthorizationService.ts:35-127` | Implemented-untested, confirmed fail-closed (§3.4) |
| CryptoCore sign | `CryptoCore.ts:495` via `TransactionSigningService.sign` (`SendScreen.tsx:309`) | Implemented-untested (ETH only, live) |
| Biometric authorization (broadcast) | `BroadcastAuthorizationService.ts` (`authorize`, same hardware/enrolled/authenticateAsync pattern) | Implemented-untested, confirmed fail-closed |
| Broadcast | `BroadcastService.ts:68` (`broadcast`) | Implemented-untested |
| Reconciliation | `BroadcastService.ts` → `TransactionLifecycleService.ts` (terminal-state guard at line 160, write-serialization queue at line 67-71 — both from last session's Phase 5.1 fix, confirmed still present) | Complete+tested (has a dedicated `.selfTest.ts`) |
| Audit | `ActivityService.addActivity(...)` calls at every stage transition in `SendScreen.tsx` (SEND_REVIEW/SEND_BLOCKED/etc.) | Implemented-untested |

No stage is missing. Order is correctly enforced top-to-bottom by the code's own control flow (each
stage's failure path `return`s before the next stage runs).

### 4. Biometric authorization

**Confirmed: gates every send, no silent fallback.** Both `SigningAuthorizationService.authorize`
and `BroadcastAuthorizationService.authorize` check `hasHardwareAsync()` → `isEnrolledAsync()` →
`authenticateAsync()`, and return `authorized:false` on any failure, with no code path that sets
`authorized:true` without `auth.success`. `SendScreen.tsx` `return`s immediately on
`!authorizationResult.authorized` (line 298-306) and on `!broadcastAuthorizationResult.authorized`
(line 331-339) — neither signing nor broadcasting proceeds past a failed check. `fallbackLabel:
'Use device passcode'` allows the OS passcode as an *explicit, user-initiated* alternative to
biometrics — this is standard device-authentication fallback, not a silent bypass.

### 5. Address rotation

- **Confirmed exists and rotates before send.** `src/services/security/EvmAddressRotationService.ts`
  (321 lines) implements the sweep-and-retire rotation invoked from `KeyRotationModal`; `SendScreen.
  tsx`'s `ProtectBeforeSendService.assess()` check (§3.3 "Rotate Before Send" row) blocks sending
  from an address that needs rotation before `executeFinalSend` is ever reached.
- **Receive-side rotation / stealth addresses: confirmed not yet implemented**, matching the brief's
  expectation. `src/services/privacy/EvmPrivacyStrategy.ts:5` states directly: "no stealth-address
  execution exists here or anywhere else in the app yet." What exists instead is a manual,
  user-triggered "prepare a fresh receive address" flow (`AddressRotationPrepService.ts`) — a
  suggestion/record-keeping feature, not automatic stealth derivation.

### 6. Duplicate-submission / retry / nonce (ETH)

- **Nonce:** `NetworkStateService.ts:121-129` fetches `eth_getTransactionCount(address, 'pending')`
  live immediately before construction — correct use of `'pending'` (accounts for already-pending
  txs), no local nonce counter that could drift out of sync with the chain.
- **Duplicate broadcast guard:** `BroadcastService.ts:47,87,138,303` — a module-level `inFlightHashes`
  `Set` blocks re-broadcasting the same signed transaction hash while one is already in flight.
- **UI double-tap:** no explicit `busy`/`isSending` flag disables the confirm button during the async
  send (`SendScreen.tsx:877` only disables on `!acknowledged || policy===BLOCK`). In practice,
  `confirmSendReview()` synchronously calls `setReviewOpen(false)` as its first state update
  (line 433, before any `await`), which closes the modal containing that button on the same tick —
  so a second tap on the *same* button instance isn't possible in practice, even though there's no
  explicit named guard. **Partial** — works today, but recommend an explicit in-flight flag for
  robustness/clarity rather than relying on modal-close timing (listed as FIX-OK below is too risky
  since it touches the send screen directly — flagging as a P2 recommendation instead, not FIX-OK).

### 7. Android `allowBackup` / release log scrubbing

- **`allowBackup`:** `android/app/src/main/AndroidManifest.xml:16` sets `android:allowBackup="true"`
  but pairs it with `android:fullBackupContent="@xml/secure_store_backup_rules"` and
  `android:dataExtractionRules="@xml/secure_store_data_extraction_rules"` — the correct Android
  pattern (backup enabled, but with an explicit exclusion ruleset for sensitive data). **However:**
  neither referenced XML resource file exists anywhere in the checked-in `android/` tree (searched
  `res/` and all build intermediates — zero matches for `secure_store_backup_rules.xml` or
  `secure_store_data_extraction_rules.xml`). These are normally generated by the `expo-secure-store`
  config plugin during `npx expo prebuild`. **Blocked/Unverified** — I did not run a clean
  `./gradlew assembleRelease` to confirm whether this is a hard build failure from this exact
  checked-in tree, or whether a prebuild step regenerates them before any real release build. Flagging
  rather than asserting either way.
- **Log scrubbing:** no `babel-plugin-transform-remove-console` or equivalent is configured (no
  `babel.config.js` present at all in this project, confirmed), and no custom logger abstraction
  exists (`find src -iname "*logger*"` → nothing). 38 raw `console.log/error/warn` call sites exist
  across `src/`. Grepped specifically for any that log a mnemonic/seed/private-key/recovery-phrase
  value: **one match**, `RecoveryRevealScreen.tsx:58` (`console.error('Failed to reveal mnemonic:',
  error)`), which logs the generic error object, not the secret value — safe. No raw secret is logged
  anywhere. The broader gap: in a release build, all 38 statements (including addresses and policy
  decisions) ship as-is and are retrievable via `adb logcat` on a debuggable/rooted device — not a
  secret leak, but worth hardening. **Missing** (no stripping mechanism), **not** a critical finding.

### 8. Key-scheme abstraction

Covered under §3.2 above — not secp256k1-only; already spans secp256k1 and ed25519 families across
7 `SupportedChain` values. Monero and Zcash would each need a net-new subsystem (ring
signatures/stealth addresses/RingCT for Monero; a zk-SNARK proving system for Zcash shielded pool),
not an extension of the current derive→build→sign→serialize shape.

---

## Summary counts

| Status | Count | Items |
|---|---|---|
| Complete+tested | 2 | Transaction lifecycle/reconciliation (has `.selfTest.ts`); intent-shape validation path |
| Implemented-untested | 9 | Vault storage, CryptoCore signing (ETH live path), validation, SecurityPolicyEngine, rotate-before-send, both biometric authorizations, broadcast, audit logging |
| Partial | 2 | UI double-tap guard (works via modal-close timing, not an explicit flag); Security Score guidance (accurate but UNKNOWN not named explicitly) |
| Stubbed/Mocked | 0 | — |
| Missing | 3 | Release console-log stripping; receive-side stealth addressing (expected); Monero/Zcash key schemes (expected, future) |
| Blocked/Unverified | 2 | Android backup-rule XML resources (existence unresolved without a clean build); BTC/LTC send-UI wiring (signing code exists, UI path not traced) |

---

## Priority buckets

### P0 — release blockers
1. **Plaintext mnemonic in React state outside the vault** (`SettingsScreen.tsx`,
   `RecoveryRevealScreen.tsx`) — see Critical Finding. *Files:* `src/screens/SettingsScreen.tsx`
   (lines 43, 67, 76, 175-184, 423, 452), `src/screens/RecoveryRevealScreen.tsx` (lines 24, 49-50).
   *What's missing:* fetch the mnemonic only at the moment of the *second* (reveal) authentication,
   not the first (open); consider consolidating the two duplicate recovery-reveal implementations
   into one. *Estimated effort:* 0.5-1 day (mostly reordering + removing the duplicate screen;
   requires your explicit approval since it's vault/wallet logic).
2. **Android backup-rule resource files missing from the checked-in native project**
   (`android/app/src/main/AndroidManifest.xml:16` references two non-existent `res/xml/*.xml` files).
   *What's missing:* confirm via a clean `expo prebuild` + release build whether this fails the
   build, and either commit the generated rule files or regenerate them. *Estimated effort:*
   0.5 day to verify + fix once confirmed.

### P1 — product
1. CoinGecko OHLC/fine-grained bursts still fire ~12-13 simultaneous requests per cache miss
   (§Step 1d) — the remaining rate-limit exposure. *Estimated effort:* 0.5 day to stagger/throttle.
2. Price-feed proxy design (Step 2) to stop sending user IPs directly to CoinGecko. *Estimated
   effort:* 1-2 days for a minimal edge-function proxy + cache.
3. Explicit in-flight/`isSending` guard on the Send confirm button, rather than relying on
   modal-close timing. *Estimated effort:* <0.5 day.

### P2 — readiness
1. Release-build console-log stripping (babel plugin or custom logger gate). *Estimated effort:*
   <0.5 day.
2. Resolve whether BTC/LTC have any live send-UI path, document the answer either way.

### P3 — deferred (expected, not gaps)
1. Receive-side stealth addressing / unlinkable receive identities.
2. Monero support (ring signatures, stealth addresses, RingCT).
3. Zcash shielded-pool support (zk-SNARK proving system).

---

## FIX-OK candidates (small, safe, non-crypto — not applied, awaiting your approval)

1. Remove the dead/tautological self-check in `CryptoCore.ts:478-484` (`revealRecoveryPhrase`) —
   it tests a literal object against itself and can never fail; harmless but misleading to read.
2. In `SettingsScreen.tsx`'s `loadSettings` (line 67), replace `VaultService.getMnemonic()` with
   the already-existing `VaultService.hasVault()` — the mnemonic value is discarded immediately via
   `Boolean(mnemonic)` (line 76), so decrypting it at all is unnecessary. This is a strict
   improvement (reduces how often the plaintext phrase is decrypted) but still touches vault-adjacent
   code, so I'm listing it rather than applying it.

No other FIX-OK items identified — everything else either touches the flagged P0 items directly (so
needs your sign-off, not a quiet fix) or isn't safe to change without touching crypto/transaction
code.

---

## Path

`docs/ron1n-completion-register.md` (this file, new, uncommitted — left in the working tree per
instruction; not committed or pushed).
