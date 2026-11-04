# DokanKhata POS — Smart Retail & Google Sheets Inventory Suite

A bilingual (Bangla & English) Point-of-Sale, inventory management, and real-time analytics platform built for local small business owners (`৳` BDT), powered directly by Google Sheets as a zero-cost cloud database with full offline PWA resilience, multi-user synchronization, role-based security, and e-commerce order integration.

## User Review & Critical Decisions

> [!IMPORTANT]
> Please review the confirmed product choices below before we begin provisioning Google Workspace connectivity and building the application. Once you click **Proceed**, the first step will present a Google Workspace permission card so the app can connect to Google Sheets, Google Drive file selection, and Gmail alerts with your permission.

- **Confirmed — Google Sheets Database Workflow**: Users can either **auto-create a structured multi-tab POS Google Sheet** (pre-configured with native formulas, frozen headers, and validation rules) with one click, **or link an existing Google Sheet** via URL/ID or Google Picker. Pre-loaded immediately with your uploaded **"আমার ইলেকট্রনিকস শপ" (October 2026)** dataset so analytics and checkout work out of the box.
- **Confirmed — Bilingual Bangla & English with BDT (`৳`)**: Full one-toggle switching between **বাংলা (Bangla)** and **English**, formatted strictly in **Bangladeshi Taka (`৳` BDT)** for local retail owners and non-technical shop staff.
- **Recommended Default — Automated Email Alerts**: Uses the **free Gmail API** from the connected shop owner's Google account (with mandatory explicit confirmation dialogs before sending) alongside an automated in-app alert center for out-of-stock items, low-stock reorder thresholds, and overdue customer credit (`বাকির খাতা`) tasks.
- **Recommended Default — Shopify & WooCommerce Synchronization**: Provides **live REST API connectors and incoming webhook endpoints** to synchronize online orders, shipping statuses, and automatic SKU stock deductions directly into the POS and Google Sheet, paired with a connection tester for verifying store credentials.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms a shopkeeper's Google Sheet into an enterprise-grade, offline-capable retail POS register, real-time business intelligence dashboard, automated stock-alert system, customer credit ledger (`বাকির খাতা`), and omnichannel (Walk-in + Shopify + WooCommerce) order hub.
- **Target Audience / Persona**: Local small and medium retail business owners (such as electronics, mobile accessories, hardware, and general stores) and their non-technical cashiers, store managers, and inventory staff operating across desktop counters and mobile devices—including areas with intermittent internet.
- **Key Value**: Eliminates manual calculation errors, prevents costly stockouts on high-velocity products, tracks customer dues (`বাকি`) transparently, unifies online and physical store inventory, and stores 100% of business records inside the owner's own Google Sheet with zero recurring database or third-party connector fees.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Instant Dataset Insights & Drag-and-Drop Analytics**: Upon opening the dashboard, the owner sees real-time KPIs and interactive trend visualizations from **"আমার ইলেকট্রনিকস শপ"** (Monthly Sales `৳184,860`, Gross Profit `৳52,510`, Expenses `৳33,261`, Net Profit `৳24,949`, Stock Valuation `৳371,085` across 27 SKUs). Users drag filter tokens (Product Category, Channel, Payment Mode, Stock Status, Month/Season) into the **Active Filter Bar** (or tap to toggle on mobile) to dynamically recalculate every chart and table.
2. **One-Tap Counter Checkout (POS Terminal)**: Cashiers scan barcodes or tap large product tiles, adjust quantities, apply servicing fees or discounts, choose Cash, Mobile Banking (bKash/Nagad), or Customer Credit (`বাকিতে বিক্রি`), print/download a bilingual thermal receipt, and automatically sync the sale and stock deduction to Google Sheets (or queue offline if disconnected).
3. **Smart Inventory, Reorder Alerts & Credit Ledger (`বাকির খাতা`)**: Staff monitor real-time SKU quantities against minimum thresholds, resolve the 4 Out-of-Stock (`Walton Primo Keypad Phone`, `Fast Charger 25W`, `Bluetooth Speaker Mini`, `Smart Watch`) and 4 Low-Stock alerts via one-click restock entries, track the 8 customer credit balances (`৳42,530` total receivable), and dispatch overdue payment or low-stock email notifications after explicit confirmation.
4. **Google Sheets Sync, E-Commerce & Monthly Audit Exports**: Owners link or generate their Google Sheet workbook, configure staff roles (Owner, Manager, Cashier, Inventory Clerk), sync Shopify/WooCommerce orders and shipping metrics, and export monthly audit-ready reports in **PDF** or **CSV** formats.

### Visual Identity & Theme
- **Aesthetic Direction**: Utilitarian, high-clarity modern retail SaaS workspace—crisp, trustworthy, and fast to scan in bright shop lighting, avoiding decorative clutter so non-technical staff never feel overwhelmed.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - *60% Dominant Neutral Canvas*: Clean daylight surface (`#F8FAFC` light / `#0F172A` dark) for glare-free counter readability.
  - *30% Structural Surfaces*: Crisp white (`#FFFFFF`) or deep slate (`#1E293B`) containers separated by single-elevation `1px` hairline borders (`#E2E8F0` / `#334155`)—never nested card-in-card drop shadows.
  - *10% High-Intent Accent & Semantic States*: Deep Emerald (`#059669`) for primary POS checkout actions and healthy margins; Amber (`#D97706`) paired with explicit text/icons for Low-Stock and Pending Sync warnings; Crimson (`#DC2626`) paired with explicit labels for Out-of-Stock (`স্টক আউট`) and Overdue Credit alerts.
- **Typography & Hierarchy**:
  - *Display & Navigation*: **Plus Jakarta Sans** paired with **Noto Sans Bengali** for crisp, authoritative bilingual headings in both English and বাংলা.
  - *Body & Dense Controls*: **Public Sans** + **Noto Sans Bengali** at `13px–15px` for effortless legibility across menus, product names, and receipts.
  - *Financials, Stock Counts & Timestamps*: **JetBrains Mono** with strict `tabular-nums` alignment so every `৳` currency column, margin percentage, and SKU count aligns vertically without layout jitter.
- **Component Styling & Responsive Layout**:
  - *Desktop (1440px Counter View)*: `256px` left workspace navigation + clean single-row contextual top header + high-density multi-column workspace grids (`38px–44px` compact table rows, split-pane POS product grid and live cart).
  - *Mobile & Tablet (375px–768px Touch View)*: Collapses cleanly into a thumb-friendly mobile layout featuring `>= 44x44px` touch hitboxes, bottom-sheet cart/filter drawers, and a compact fixed bottom navigation bar adhering strictly to the `<= 15%` mobile sticky viewport cap.
  - *Zero-Pill Metadata*: Static product categories, timestamps, and SKU codes render as quiet unboxed inline text separated by `·`, keeping visual emphasis strictly on interactive filter buttons and primary actions.

### Interactive Feedback & Motion
- **Fast Compositor Feedback (`<= 180ms`)**: Tactile scale/opacity press feedback on POS keypad and product tiles, smooth drag-over drop-zone highlights for drag-and-drop analytics filtering, geometry-matched table loading skeletons, explicit confirmation modals before any destructive Google Sheet overwrite or email send, and clear live sync / offline queue badges.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Free Google Sheets v4 Batch API + Local IndexedDB Offline Engine**
  - *Chosen Approach*: Use native Google Sheets v4 batch operations (`spreadsheets.create`, `values.batchGet`, `values.batchUpdate`, `values.append`, and `spreadsheets.batchUpdate` for cell formatting, frozen headers, summary formulas, and data validation) paired with a browser IndexedDB cache and offline mutation queue.
  - *Why*: Delivers 100% zero-cost cloud persistence inside the user's own Google account while handling high-frequency POS checkouts smoothly via batched writes and surviving internet blackouts without losing a single sale.
  - *Alternatives Considered*: Third-party Sheet-to-REST SaaS wrappers (rejected due to recurring subscription fees and external data exposure) or direct unbatched cell-by-cell API calls (rejected due to Google Sheets per-minute quota limits during peak shop hours).

- **Decision 2: Client-Side OAuth Token Security with In-Memory Caching**
  - *Chosen Approach*: Authenticate via Firebase Google Sign-In popup using Principle of Least Privilege Workspace permissions, caching the OAuth access token strictly in memory (never in `localStorage` or `sessionStorage`) and passing it via `Authorization: Bearer` headers when server-side proxy validation or batch coordination is needed.
  - *Why*: Prevents XSS token theft, avoids `redirect_uri_mismatch` errors in dynamic cloud environments, and ensures maximum security for financial shop data.
  - *Alternatives Considered*: Storing tokens in `localStorage` (rejected as insecure) or server-side OAuth redirect flows (incompatible with ephemeral preview origins).

- **Decision 3: Real-Time WebSocket Collaboration + Immutable Sheet Audit Trail**
  - *Chosen Approach*: Attach a WebSocket server to the Express backend (sharing Port 3000) scoped by connected Spreadsheet ID, broadcasting idempotent delta events (`sale:created`, `stock:updated`, `due:collected`, `presence:updated`) across active staff devices while appending every action to an `Audit_Logs` tab in Google Sheets.
  - *Why*: Enables multiple staff members (e.g., a counter cashier and a back-office manager) to see stock deductions, online orders, and active colleagues instantaneously without polling loops or paid database tiers.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT WORKSPACE (React + PWA + IndexedDB)                │
│                                                                                  │
│  ┌────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────┐  │
│  │  Top Header &      │  │  Bilingual I18n Engine  │  │  Auth & RBAC Guard    │  │
│  │  PWA Install /     │  │  (বাংলা / English + ৳)   │  │  (In-Memory OAuth +   │  │
│  │  Sync Status Bar   │  └─────────────────────────┘  │   Owner/Mgr/Cashier)  │  │
│  └─────────┬──────────┘                               └───────────┬───────────┘  │
│            ▼                                                      ▼              │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                     MAIN RESPONSIVE VIEWS (Desktop + Mobile)               │  │
│  │                                                                            │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Analytics &      │  │ Counter POS      │  │ Inventory, Low-Stock     │  │  │
│  │  │ Drag-Drop Filter │  │ Register, Cart & │  │ Alerts & Purchase Orders │  │  │
│  │  │ Trends           │  │ Receipt Printer  │  │                          │  │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Credit Ledger    │  │ Shopify &        │  │ RBAC Staff, Audit Logs,  │  │  │
│  │  │ (বাকির খাতা) &   │  │ WooCommerce      │  │ Expenses & PDF/CSV       │  │  │
│  │  │ Gmail Alerts     │  │ Order & Shipping │  │ Monthly Audit Exporter   │  │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │  │
│  └─────────────────────────────────────┬──────────────────────────────────────┘  │
│                                        ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │         DATA SYNC ENGINE: IndexedDB Cache + Offline Mutation Queue         │  │
│  │         (Optimistic UI Updates -> Debounced Batch Flush -> Conflict Safe)  │  │
│  └──────────────────┬──────────────────────────────────────┬──────────────────┘  │
└─────────────────────┼──────────────────────────────────────┼─────────────────────┘
                      │ HTTPS + Bearer Token                 │ WebSocket (Port 3000)
                      ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS + WEBSOCKET SERVER (Port 3000)                       │
│                                                                                  │
│  ┌──────────────────────────────┐          ┌──────────────────────────────────┐  │
│  │  Workspace & E-Com Proxy     │          │  Real-Time Room Broadcaster      │  │
│  │  • Sheets Batch Coordinator  │          │  • Active Staff Presence         │  │
│  │  • Shopify REST / Webhooks   │          │  • Idempotent Sale/Stock Deltas  │  │
│  │  • WooCommerce REST/Webhooks │          │  • Reconnect State Reconciliation│  │
│  └──────────────┬───────────────┘          └──────────────────────────────────┘  │
└─────────────────┼────────────────────────────────────────────────────────────────┘
                  ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                 GOOGLE WORKSPACE & E-COMMERCE EXTERNAL APIS                      │
│  ┌─────────────────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
│  │ Google Sheets v4 +      │  │ Gmail API v1      │  │ Shopify & WooCommerce  │  │
│  │ Google Picker / Drive   │  │ (Alert Dispatch)  │  │ Store REST Endpoints   │  │
│  └─────────────────────────┘  └───────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Google Sheets Workbook Schema
When auto-created or linked, the Google Sheet workbook maintains 8 structured, human-readable tabs synced with local IndexedDB:
1. **`Summary_Dashboard` (`সারাংশ ড্যাসবোর্ড`)**: Live native Google Sheets formulas (`SUMIFS`, `COUNTIF`, margin ratios) mirroring the uploaded electronics shop layout (`৳184,860` sales, `৳52,510` gross profit, `৳33,261` expenses, `৳24,949` net profit).
2. **`Products_Inventory` (`পণ্য তালিকা`)**: 27 SKUs (seeded from your uploaded dataset including `Tempered Glass Screen Guard`, `Micro USB Cable 1m`, `Walton Primo Keypad Phone`, `Fast Charger 25W`, `Power Bank 10000mAh`, etc.) storing SKU, Name (BN/EN), Category, Buy Price (`৳`), Sell Price (`৳`), Current Stock, Min Stock Threshold, and E-Commerce SKU mapping.
3. **`Sales_Transactions` (`বিক্রির হিসাব`)**: Invoice ID, Timestamp, Channel (Walk-in / Shopify / WooCommerce), Line Items, Total (`৳`), Gross Profit (`৳`), Payment Method, Paid Amount, Due Amount, Cashier Name.
4. **`Credit_Ledger` (`বাকির খাতা`)**: Customer ID, Name (`জাহিদ হাসান`, `মোঃ শাহীন`, etc.), Mobile Number, Total Credit, Paid Amount, Balance Due (`৳`), Due Date, Overdue Status.
5. **`Expenses_Income` (`খরচ ও অন্যান্য আয়`)**: Monthly operating expense categories (`দোকান ভাড়া`, `কর্মচারী বেতন`, `বিদ্যুৎ বিল`, `পরিবহন`, etc.) plus servicing/commission income (`৳5,700`).
6. **`Ecommerce_Orders` (`ই-কমার্স ও শিপিং`)**: External Order ID, Platform (Shopify / WooCommerce), Customer, Order Total, Fulfillment Status, Carrier, Dispatch Time, Delivery Time (powering Shipping Efficiency metrics).
7. **`Staff_Roles` (`ব্যবহারকারী ও রোল`)**: Email, Name, Assigned Role (`Owner`, `Manager`, `Cashier`, `Inventory`), Granular Permissions, Status.
8. **`Audit_Logs` (`ইতিহাস লগ`)**: Log ID, Timestamp, Actor Email & Role, Action Type, Entity Affected, Summary of Changes.

### Interactive Component & State Mapping
- **Drag-and-Drop Analytics Workspace**: Dragging any dimension chip (Category, Month/Season, Sales Channel, Payment Type, Stock Health) into the filter bar updates the unified filter store, instantly recomputing KPI cards, Daily & Seasonal Sales/Profit Area Charts, Category Margin Breakdown, Expense Distribution, and Shipping Turnaround Metrics—plus offering a single-click **Reset Filters** control.
- **POS Checkout & Offline Queue**: Adding items validates available stock, calculates cart subtotals, discounts, and net totals in real time, and submits an idempotent transaction ID. If online and linked to Google Sheets, it appends rows via batched API calls and broadcasts `sale:created` over WebSockets to teammates; if offline, it commits locally to IndexedDB, updates inventory optimistically, and flushes queued mutations automatically upon reconnection.
- **Destructive & External Action Safeguards**: Deleting a product/expense, overwriting an existing Google Sheet tab structure, or sending automated low-stock / overdue due reminder emails via Gmail always opens an explicit **Confirmation Modal** detailing exact affected records with clear Confirm and Cancel actions.
- **Role-Based Access Enforcement**: Switching or authenticating as a specific staff role dynamically restricts navigation and actions—for example, `Cashier` accounts can process sales and collect customer dues (`বাকির খাতা`) without seeing net profit margins, shop rent/salary expenses, or role administration, enforced in both the UI and backend proxy routes.
