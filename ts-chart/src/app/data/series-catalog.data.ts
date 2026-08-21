// =============================================================================
// Hardcoded catalog: ~30 well-known forecast/market series across 3 tabs.
// SERIES holds metadata; TREES hold the per-tab taxonomy (leaves -> seriesId).
// Values are realistic anchors for famous public data sources (no live data).
// =============================================================================

import { SeriesMeta, TabId, TreeNode } from './models';


function m(x: SeriesMeta): SeriesMeta {
  return x;
}

export const SERIES: Record<string, SeriesMeta> = {
  // --- Crude oil -------------------------------------------------------------
  brent: m({
    id: 'brent', name: 'Brent Crude Oil', symbol: 'BRN', tab: 'forecast',
    path: ['Energy', 'Crude Oil'], unit: 'USD/bbl', currency: 'USD',
    source: 'ICE Brent (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['energy', 'oil', 'benchmark'],
    description: 'North Sea Brent crude — the leading global oil price benchmark, pricing roughly two-thirds of internationally traded crude.',
    shape: { base: 82.4, drift: 0.04, volatility: 0.014, seasonality: 0.05, floor: 20 },
  }),
  wti: m({
    id: 'wti', name: 'WTI Crude Oil', symbol: 'CL', tab: 'forecast',
    path: ['Energy', 'Crude Oil'], unit: 'USD/bbl', currency: 'USD',
    source: 'NYMEX WTI (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['energy', 'oil', 'benchmark'],
    description: 'West Texas Intermediate — the US crude benchmark delivered at Cushing, Oklahoma.',
    shape: { base: 78.1, drift: 0.035, volatility: 0.015, seasonality: 0.05, floor: 15 },
  }),
  // --- Natural gas -----------------------------------------------------------
  ttf: m({
    id: 'ttf', name: 'Dutch TTF Natural Gas', symbol: 'TTF', tab: 'forecast',
    path: ['Energy', 'Natural Gas'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'ICE Endex TTF (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['energy', 'gas', 'europe'],
    description: 'Title Transfer Facility — the European natural-gas benchmark hub in the Netherlands. Strong winter seasonality.',
    shape: { base: 34.2, drift: -0.02, volatility: 0.032, seasonality: 0.22, seasonPhase: 200, floor: 4 },
  }),
  henryhub: m({
    id: 'henryhub', name: 'Henry Hub Natural Gas', symbol: 'NG', tab: 'forecast',
    path: ['Energy', 'Natural Gas'], unit: 'USD/MMBtu', currency: 'USD',
    source: 'NYMEX Henry Hub (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['energy', 'gas', 'us'],
    description: 'US natural-gas benchmark priced at the Henry Hub in Louisiana.',
    shape: { base: 2.84, drift: 0.03, volatility: 0.03, seasonality: 0.18, seasonPhase: 200, floor: 1.2 },
  }),
  nbp: m({
    id: 'nbp', name: 'UK NBP Natural Gas', symbol: 'NBP', tab: 'forecast',
    path: ['Energy', 'Natural Gas'], unit: 'GBp/therm', currency: 'GBP',
    source: 'ICE NBP (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['energy', 'gas', 'uk'],
    description: 'National Balancing Point — the UK wholesale gas benchmark quoted in pence per therm.',
    shape: { base: 84.5, drift: -0.01, volatility: 0.03, seasonality: 0.2, seasonPhase: 200, floor: 10 },
  }),
  // --- Power -----------------------------------------------------------------
  'de-power': m({
    id: 'de-power', name: 'German Baseload Power', symbol: 'DEB', tab: 'forecast',
    path: ['Power', 'Day-Ahead'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'EPEX SPOT DE (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['power', 'europe'],
    description: 'German day-ahead baseload electricity price — Europe’s most liquid power market.',
    shape: { base: 91.0, drift: -0.03, volatility: 0.05, seasonality: 0.12, seasonPhase: 200, floor: -20 },
  }),
  'fr-power': m({
    id: 'fr-power', name: 'French Baseload Power', symbol: 'FRB', tab: 'forecast',
    path: ['Power', 'Day-Ahead'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'EPEX SPOT FR (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['power', 'europe'],
    description: 'French day-ahead baseload electricity price, heavily nuclear-driven.',
    shape: { base: 85.5, drift: -0.02, volatility: 0.05, seasonality: 0.13, seasonPhase: 200, floor: -15 },
  }),
  nordpool: m({
    id: 'nordpool', name: 'Nord Pool System Price', symbol: 'NPS', tab: 'forecast',
    path: ['Power', 'Day-Ahead'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'Nord Pool (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['power', 'nordics'],
    description: 'Nordic system electricity price — hydro-dominated, seasonally wet/dry.',
    shape: { base: 58.4, drift: -0.02, volatility: 0.06, seasonality: 0.18, seasonPhase: 120, floor: 0 },
  }),
  // --- Carbon ----------------------------------------------------------------
  eua: m({
    id: 'eua', name: 'EU Carbon (EUA)', symbol: 'EUA', tab: 'forecast',
    path: ['Carbon'], unit: 'EUR/t', currency: 'EUR',
    source: 'ICE EUA Dec (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['carbon', 'europe', 'ets'],
    description: 'EU Emission Allowance — the price of one tonne of CO₂ under the EU Emissions Trading System.',
    shape: { base: 68.3, drift: 0.06, volatility: 0.02, seasonality: 0.04, floor: 5 },
  }),
  uka: m({
    id: 'uka', name: 'UK Carbon (UKA)', symbol: 'UKA', tab: 'forecast',
    path: ['Carbon'], unit: 'GBP/t', currency: 'GBP',
    source: 'ICE UKA (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['carbon', 'uk', 'ets'], status: 'forbidden',
    description: 'UK Allowance under the UK Emissions Trading Scheme (post-Brexit standalone carbon market).',
    shape: { base: 41.2, drift: 0.02, volatility: 0.028, seasonality: 0.04, floor: 5 },
  }),
  // --- Weather ---------------------------------------------------------------
  'temp-eu': m({
    id: 'temp-eu', name: 'CWE Temperature Forecast', symbol: 'T2M', tab: 'forecast',
    path: ['Weather', 'Temperature'], unit: '°C', currency: undefined,
    source: 'ECMWF ensemble (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['weather', 'temperature'],
    description: 'Central-Western Europe population-weighted 2m air temperature forecast. Drives heating/cooling demand.',
    shape: { base: 12.5, drift: 0.01, volatility: 0.06, seasonality: 0.9, seasonPhase: 20 },
  }),
  'wind-de': m({
    id: 'wind-de', name: 'German Wind Generation', symbol: 'WND', tab: 'forecast',
    path: ['Weather', 'Renewables'], unit: 'GW', currency: undefined,
    source: 'ENTSO-E / DWD (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['weather', 'wind', 'renewables'],
    description: 'Forecast German wind power output. High day-to-day variability, winter-weighted.',
    shape: { base: 14.2, drift: 0.04, volatility: 0.14, seasonality: 0.35, seasonPhase: 200, floor: 0.5 },
  }),
  'solar-es': m({
    id: 'solar-es', name: 'Iberian Solar Generation', symbol: 'SOL', tab: 'forecast',
    path: ['Weather', 'Renewables'], unit: 'GW', currency: undefined,
    source: 'ENTSO-E / AEMET (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['weather', 'solar', 'renewables'],
    description: 'Forecast Iberian solar PV output. Strong summer peak, near-zero winter troughs.',
    shape: { base: 8.6, drift: 0.06, volatility: 0.09, seasonality: 0.6, seasonPhase: 20, floor: 0.2 },
  }),
  // --- Agriculture -----------------------------------------------------------
  wheat: m({
    id: 'wheat', name: 'Milling Wheat', symbol: 'EBM', tab: 'forecast',
    path: ['Agriculture'], unit: 'EUR/t', currency: 'EUR',
    source: 'Euronext Milling Wheat (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['ags', 'grains'],
    description: 'Euronext milling wheat futures reference price — European feed & food benchmark.',
    shape: { base: 221.0, drift: 0.0, volatility: 0.018, seasonality: 0.06, seasonPhase: 150, floor: 120 },
  }),
  corn: m({
    id: 'corn', name: 'Corn', symbol: 'EMA', tab: 'forecast',
    path: ['Agriculture'], unit: 'EUR/t', currency: 'EUR',
    source: 'Euronext Corn (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['ags', 'grains'],
    description: 'Euronext corn futures reference price.',
    shape: { base: 198.5, drift: 0.0, volatility: 0.017, seasonality: 0.06, seasonPhase: 150, floor: 110 },
  }),
  // --- Metals ----------------------------------------------------------------
  gold: m({
    id: 'gold', name: 'Gold', symbol: 'XAU', tab: 'forecast',
    path: ['Metals', 'Precious'], unit: 'USD/oz', currency: 'USD',
    source: 'LBMA / COMEX (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['metals', 'safe-haven'],
    description: 'Spot gold price per troy ounce — the classic safe-haven store of value.',
    shape: { base: 2358.0, drift: 0.09, volatility: 0.01, seasonality: 0.02, floor: 800 },
  }),
  copper: m({
    id: 'copper', name: 'Copper', symbol: 'HG', tab: 'forecast',
    path: ['Metals', 'Base'], unit: 'USD/t', currency: 'USD',
    source: 'LME Copper (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['metals', 'industrial'],
    description: 'LME copper — the bellwether industrial metal, closely tracking global growth.',
    shape: { base: 9240.0, drift: 0.05, volatility: 0.015, seasonality: 0.03, floor: 4000 },
  }),

  // === Contracts tab =========================================================
  'brent-fm': m({
    id: 'brent-fm', name: 'Brent Front Month', symbol: 'BRN M1', tab: 'contracts',
    path: ['Absolute Contracts'], unit: 'USD/bbl', currency: 'USD',
    source: 'ICE Brent front month', frequency: 'daily', chartKind: 'candlestick',
    tags: ['oil', 'front-month'],
    description: 'Nearest-expiry Brent futures contract (absolute, un-rolled).',
    shape: { base: 82.9, drift: 0.04, volatility: 0.016, seasonality: 0.05, floor: 20 },
  }),
  'ttf-cal26': m({
    id: 'ttf-cal26', name: 'TTF Calendar 2026', symbol: 'TTF CAL26', tab: 'contracts',
    path: ['Absolute Contracts'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'ICE Endex TTF Cal-26', frequency: 'daily', chartKind: 'candlestick',
    tags: ['gas', 'calendar'],
    description: 'TTF calendar-year 2026 baseload gas contract (annual average delivery).',
    shape: { base: 33.1, drift: -0.01, volatility: 0.022, seasonality: 0.05, floor: 6 },
  }),
  'brent-c1': m({
    id: 'brent-c1', name: 'Brent Continuous M+1', symbol: 'BRN C1', tab: 'contracts',
    path: ['Continuous Contracts'], unit: 'USD/bbl', currency: 'USD',
    source: 'ICE Brent rolled M+1', frequency: 'daily', chartKind: 'line',
    tags: ['oil', 'continuous'],
    description: 'Continuous first-position Brent, back-adjusted across monthly rolls.',
    shape: { base: 82.4, drift: 0.04, volatility: 0.014, seasonality: 0.05, floor: 20 },
  }),
  'wti-c1': m({
    id: 'wti-c1', name: 'WTI Continuous M+1', symbol: 'CL C1', tab: 'contracts',
    path: ['Continuous Contracts'], unit: 'USD/bbl', currency: 'USD',
    source: 'NYMEX WTI rolled M+1', frequency: 'daily', chartKind: 'line',
    tags: ['oil', 'continuous'],
    description: 'Continuous first-position WTI, back-adjusted across monthly rolls.',
    shape: { base: 78.0, drift: 0.035, volatility: 0.015, seasonality: 0.05, floor: 15 },
  }),
  'eua-dec26': m({
    id: 'eua-dec26', name: 'EUA December 2026', symbol: 'EUA DEC26', tab: 'contracts',
    path: ['Futures', 'Monthly Rolling'], unit: 'EUR/t', currency: 'EUR',
    source: 'ICE EUA Dec-26', frequency: 'daily', chartKind: 'candlestick',
    tags: ['carbon', 'futures'],
    description: 'December 2026 EU carbon allowance future — the benchmark ETS delivery month.',
    shape: { base: 71.0, drift: 0.06, volatility: 0.021, seasonality: 0.04, floor: 5 },
  }),
  'ttf-q127': m({
    id: 'ttf-q127', name: 'TTF Q1 2027', symbol: 'TTF Q127', tab: 'contracts',
    path: ['Futures', 'Monthly Rolling'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'ICE Endex TTF Q1-27', frequency: 'daily', chartKind: 'candlestick',
    tags: ['gas', 'quarterly'],
    description: 'TTF Q1 2027 gas contract — winter-quarter delivery, premium to summer.',
    shape: { base: 38.5, drift: -0.01, volatility: 0.026, seasonality: 0.08, floor: 8 },
  }),
  'hh-jan27': m({
    id: 'hh-jan27', name: 'Henry Hub January 2027', symbol: 'NG JAN27', tab: 'contracts',
    path: ['Futures', 'Monthly Rolling'], unit: 'USD/MMBtu', currency: 'USD',
    source: 'NYMEX Henry Hub Jan-27', frequency: 'daily', chartKind: 'candlestick',
    tags: ['gas', 'futures'], status: 'missing',
    description: 'January 2027 US gas future — peak-winter heating demand month.',
    shape: { base: 3.35, drift: 0.03, volatility: 0.03, seasonality: 0.1, floor: 1.2 },
  }),
  'brent-wti-spread': m({
    id: 'brent-wti-spread', name: 'Brent–WTI Spread', symbol: 'BRN-CL', tab: 'contracts',
    path: ['Spreads'], unit: 'USD/bbl', currency: 'USD',
    source: 'ICE / NYMEX (derived)', frequency: 'daily', chartKind: 'line',
    tags: ['oil', 'spread'],
    description: 'Price differential between Brent and WTI crude — a key transatlantic arbitrage signal.',
    shape: { base: 4.3, drift: 0.0, volatility: 0.12, seasonality: 0.1 },
  }),
  'ttf-nbp-spread': m({
    id: 'ttf-nbp-spread', name: 'TTF–NBP Spread', symbol: 'TTF-NBP', tab: 'contracts',
    path: ['Spreads'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'ICE (derived)', frequency: 'daily', chartKind: 'line',
    tags: ['gas', 'spread'],
    description: 'Dutch TTF minus UK NBP gas spread — drives interconnector flows across the Channel.',
    shape: { base: 1.1, drift: 0.0, volatility: 0.25, seasonality: 0.15 },
  }),

  // === Regions tab (new series) =============================================
  pjm: m({
    id: 'pjm', name: 'PJM West Hub Power', symbol: 'PJM', tab: 'regions',
    path: ['North America', 'United States'], unit: 'USD/MWh', currency: 'USD',
    source: 'PJM Interconnection (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['power', 'us'],
    description: 'PJM Western Hub day-ahead LMP — the largest US wholesale electricity market.',
    shape: { base: 42.5, drift: 0.02, volatility: 0.07, seasonality: 0.14, seasonPhase: 200, floor: -10 },
  }),
  ercot: m({
    id: 'ercot', name: 'ERCOT North Power', symbol: 'ERCOT', tab: 'regions',
    path: ['North America', 'United States'], unit: 'USD/MWh', currency: 'USD',
    source: 'ERCOT (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['power', 'us', 'texas'], status: 'missing',
    description: 'ERCOT North zone electricity price — famous for extreme summer scarcity spikes.',
    shape: { base: 38.0, drift: 0.03, volatility: 0.13, seasonality: 0.25, seasonPhase: 20, floor: -20 },
  }),
  jkm: m({
    id: 'jkm', name: 'JKM LNG (Asia)', symbol: 'JKM', tab: 'regions',
    path: ['Asia Pacific', 'LNG'], unit: 'USD/MMBtu', currency: 'USD',
    source: 'Platts JKM (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['lng', 'asia'],
    description: 'Japan-Korea Marker — the benchmark spot price for LNG delivered into Northeast Asia.',
    shape: { base: 12.4, drift: -0.01, volatility: 0.035, seasonality: 0.2, seasonPhase: 200, floor: 4 },
  }),

  // === Additional catalog (to 50 series) =====================================
  // --- Crude & refined products ---------------------------------------------
  dubai: m({
    id: 'dubai', name: 'Dubai Crude Oil', symbol: 'DUB', tab: 'forecast',
    path: ['Energy', 'Crude Oil'], unit: 'USD/bbl', currency: 'USD',
    source: 'Platts Dubai (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['energy', 'oil', 'benchmark', 'asia'],
    description: 'Dubai crude — the pricing benchmark for Middle East sour crude flowing to Asia.',
    shape: { base: 80.6, drift: 0.035, volatility: 0.015, seasonality: 0.05, floor: 15 },
  }),
  gasoil: m({
    id: 'gasoil', name: 'ICE Gasoil', symbol: 'GO', tab: 'forecast',
    path: ['Energy', 'Refined Products'], unit: 'USD/t', currency: 'USD',
    source: 'ICE Gasoil (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['energy', 'oil', 'products'],
    description: 'ICE low-sulphur gasoil — the European middle-distillate (diesel/heating oil) benchmark.',
    shape: { base: 735.0, drift: 0.03, volatility: 0.017, seasonality: 0.06, seasonPhase: 200, floor: 200 },
  }),
  rbob: m({
    id: 'rbob', name: 'RBOB Gasoline', symbol: 'RB', tab: 'forecast',
    path: ['Energy', 'Refined Products'], unit: 'USD/gal', currency: 'USD',
    source: 'NYMEX RBOB (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['energy', 'oil', 'products', 'us'],
    description: 'Reformulated blendstock gasoline — the US gasoline futures benchmark. Strong summer driving season.',
    shape: { base: 2.42, drift: 0.03, volatility: 0.02, seasonality: 0.12, seasonPhase: 60, floor: 0.5 },
  }),
  // --- Gas hubs --------------------------------------------------------------
  psv: m({
    id: 'psv', name: 'Italian PSV Gas', symbol: 'PSV', tab: 'forecast',
    path: ['Energy', 'Natural Gas'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'GME PSV (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['energy', 'gas', 'europe'],
    description: 'Punto di Scambio Virtuale — the Italian wholesale gas hub, at a premium to TTF.',
    shape: { base: 37.1, drift: -0.02, volatility: 0.03, seasonality: 0.2, seasonPhase: 200, floor: 5 },
  }),
  the: m({
    id: 'the', name: 'German THE Gas', symbol: 'THE', tab: 'forecast',
    path: ['Energy', 'Natural Gas'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'Trading Hub Europe (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['energy', 'gas', 'europe'],
    description: 'Trading Hub Europe — the merged German gas market area benchmark.',
    shape: { base: 34.9, drift: -0.02, volatility: 0.03, seasonality: 0.21, seasonPhase: 200, floor: 5 },
  }),
  // --- Power -----------------------------------------------------------------
  'it-power': m({
    id: 'it-power', name: 'Italian Baseload Power', symbol: 'ITB', tab: 'forecast',
    path: ['Power', 'Day-Ahead'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'GME PUN (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['power', 'europe'],
    description: 'Italian single national price (PUN) day-ahead power — typically Europe’s priciest major market.',
    shape: { base: 112.0, drift: -0.02, volatility: 0.05, seasonality: 0.14, seasonPhase: 40, floor: 0 },
  }),
  'es-power': m({
    id: 'es-power', name: 'Spanish Baseload Power', symbol: 'ESB', tab: 'forecast',
    path: ['Power', 'Day-Ahead'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'OMIE (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['power', 'europe', 'iberia'],
    description: 'Spanish (OMIE) day-ahead power — high solar penetration drives deep midday troughs.',
    shape: { base: 68.0, drift: -0.02, volatility: 0.06, seasonality: 0.15, seasonPhase: 40, floor: -5 },
  }),
  // --- Carbon ----------------------------------------------------------------
  cca: m({
    id: 'cca', name: 'California Carbon (CCA)', symbol: 'CCA', tab: 'forecast',
    path: ['Carbon'], unit: 'USD/t', currency: 'USD',
    source: 'ICE CCA (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['carbon', 'us', 'ets'],
    description: 'California Carbon Allowance — the price of one tonne of CO₂ under California’s cap-and-trade.',
    shape: { base: 38.5, drift: 0.04, volatility: 0.018, seasonality: 0.03, floor: 5 },
  }),
  // --- Metals ----------------------------------------------------------------
  silver: m({
    id: 'silver', name: 'Silver', symbol: 'XAG', tab: 'forecast',
    path: ['Metals', 'Precious'], unit: 'USD/oz', currency: 'USD',
    source: 'LBMA / COMEX (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['metals', 'safe-haven'],
    description: 'Spot silver — the higher-beta precious metal, both monetary and industrial.',
    shape: { base: 29.4, drift: 0.07, volatility: 0.02, seasonality: 0.03, floor: 8 },
  }),
  aluminium: m({
    id: 'aluminium', name: 'Aluminium', symbol: 'ALU', tab: 'forecast',
    path: ['Metals', 'Base'], unit: 'USD/t', currency: 'USD',
    source: 'LME Aluminium (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['metals', 'industrial'],
    description: 'LME aluminium — an energy-intensive base metal sensitive to power prices.',
    shape: { base: 2480.0, drift: 0.03, volatility: 0.014, seasonality: 0.03, floor: 1200 },
  }),
  nickel: m({
    id: 'nickel', name: 'Nickel', symbol: 'NI', tab: 'forecast',
    path: ['Metals', 'Base'], unit: 'USD/t', currency: 'USD',
    source: 'LME Nickel (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['metals', 'industrial', 'battery'],
    description: 'LME nickel — a key stainless-steel and EV-battery metal, historically volatile.',
    shape: { base: 16800.0, drift: 0.0, volatility: 0.028, seasonality: 0.03, floor: 8000 },
  }),
  // --- Agriculture -----------------------------------------------------------
  soybean: m({
    id: 'soybean', name: 'Soybeans', symbol: 'ZS', tab: 'forecast',
    path: ['Agriculture'], unit: 'USd/bu', currency: 'USD',
    source: 'CBOT Soybeans (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['ags', 'oilseeds'],
    description: 'CBOT soybeans — the global oilseed benchmark, weather- and export-driven.',
    shape: { base: 1180.0, drift: 0.0, volatility: 0.016, seasonality: 0.07, seasonPhase: 150, floor: 700 },
  }),
  sugar: m({
    id: 'sugar', name: 'Sugar No.11', symbol: 'SB', tab: 'forecast',
    path: ['Agriculture'], unit: 'USd/lb', currency: 'USD',
    source: 'ICE Sugar No.11 (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['ags', 'softs'],
    description: 'ICE raw sugar — the world softs benchmark, tied to Brazilian cane and ethanol.',
    shape: { base: 21.3, drift: 0.0, volatility: 0.02, seasonality: 0.08, seasonPhase: 120, floor: 8 },
  }),
  // --- Weather / freight -----------------------------------------------------
  'hdd-us': m({
    id: 'hdd-us', name: 'US Heating Degree Days', symbol: 'HDD', tab: 'forecast',
    path: ['Weather', 'Degree Days'], unit: 'HDD', currency: undefined,
    source: 'NOAA (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['weather', 'gas', 'us'],
    description: 'US population-weighted heating degree days — the core cold-demand driver for gas & power.',
    shape: { base: 14.0, drift: 0.0, volatility: 0.12, seasonality: 0.95, seasonPhase: 200, floor: 0 },
  }),
  'cdd-us': m({
    id: 'cdd-us', name: 'US Cooling Degree Days', symbol: 'CDD', tab: 'forecast',
    path: ['Weather', 'Degree Days'], unit: 'CDD', currency: undefined,
    source: 'NOAA (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['weather', 'power', 'us'],
    description: 'US population-weighted cooling degree days — the summer power-demand driver.',
    shape: { base: 9.0, drift: 0.0, volatility: 0.14, seasonality: 0.95, seasonPhase: 20, floor: 0 },
  }),
  baltic: m({
    id: 'baltic', name: 'Baltic Dry Index', symbol: 'BDI', tab: 'forecast',
    path: ['Freight'], unit: 'points', currency: undefined,
    source: 'Baltic Exchange (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['freight', 'shipping'],
    description: 'Baltic Dry Index — dry-bulk ocean freight rates, a bellwether of global commodity trade.',
    shape: { base: 1720.0, drift: 0.0, volatility: 0.04, seasonality: 0.12, seasonPhase: 150, floor: 300 },
  }),

  // --- Extra contracts -------------------------------------------------------
  'ttf-sum26': m({
    id: 'ttf-sum26', name: 'TTF Summer 2026', symbol: 'TTF SUM26', tab: 'contracts',
    path: ['Futures', 'Seasonal'], unit: 'EUR/MWh', currency: 'EUR',
    source: 'ICE Endex TTF Sum-26', frequency: 'daily', chartKind: 'candlestick',
    tags: ['gas', 'seasonal'],
    description: 'TTF summer-2026 gas contract (Apr–Sep delivery) — the injection-season benchmark.',
    shape: { base: 30.4, drift: -0.01, volatility: 0.024, seasonality: 0.06, floor: 6 },
  }),
  'eua-dec27': m({
    id: 'eua-dec27', name: 'EUA December 2027', symbol: 'EUA DEC27', tab: 'contracts',
    path: ['Futures', 'Monthly Rolling'], unit: 'EUR/t', currency: 'EUR',
    source: 'ICE EUA Dec-27', frequency: 'daily', chartKind: 'candlestick',
    tags: ['carbon', 'futures'],
    description: 'December 2027 EU carbon allowance future — the next-year ETS benchmark.',
    shape: { base: 74.0, drift: 0.06, volatility: 0.022, seasonality: 0.04, floor: 5 },
  }),
  'wti-cal26': m({
    id: 'wti-cal26', name: 'WTI Calendar 2026', symbol: 'CL CAL26', tab: 'contracts',
    path: ['Absolute Contracts'], unit: 'USD/bbl', currency: 'USD',
    source: 'NYMEX WTI Cal-26', frequency: 'daily', chartKind: 'candlestick',
    tags: ['oil', 'calendar'],
    description: 'WTI calendar-2026 strip contract (annual average delivery).',
    shape: { base: 74.8, drift: 0.02, volatility: 0.016, seasonality: 0.04, floor: 15 },
  }),

  // --- Extra regions ---------------------------------------------------------
  caiso: m({
    id: 'caiso', name: 'CAISO SP15 Power', symbol: 'SP15', tab: 'regions',
    path: ['North America', 'United States'], unit: 'USD/MWh', currency: 'USD',
    source: 'CAISO SP15 (reference)', frequency: 'daily', chartKind: 'line',
    tags: ['power', 'us', 'california'],
    description: 'CAISO SP15 day-ahead power — Southern California, deep solar-driven midday dips.',
    shape: { base: 46.0, drift: 0.02, volatility: 0.09, seasonality: 0.16, seasonPhase: 20, floor: -15 },
  }),
  'des-nwe': m({
    id: 'des-nwe', name: 'DES NWE LNG', symbol: 'NWE', tab: 'regions',
    path: ['Europe', 'LNG'], unit: 'USD/MMBtu', currency: 'USD',
    source: 'Platts DES NWE (reference)', frequency: 'daily', chartKind: 'area',
    tags: ['lng', 'europe'],
    description: 'Delivered ex-ship North-West Europe LNG — the European seaborne LNG marker vs TTF.',
    shape: { base: 11.6, drift: -0.01, volatility: 0.035, seasonality: 0.18, seasonPhase: 200, floor: 4 },
  }),

  // --- Deep nested contracts (Curve Builder) ---------------------------------
  'brent-jan27': m({ id: 'brent-jan27', name: 'Brent Jan 2027', symbol: 'BRN JAN27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Jan-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 81.2, drift: 0.03, volatility: 0.014, seasonality: 0.04, floor: 20 } }),
  'brent-feb27': m({ id: 'brent-feb27', name: 'Brent Feb 2027', symbol: 'BRN FEB27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Feb-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 81.0, drift: 0.03, volatility: 0.014, seasonality: 0.04, floor: 20 } }),
  'brent-mar27': m({ id: 'brent-mar27', name: 'Brent Mar 2027', symbol: 'BRN MAR27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Mar-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 80.8, drift: 0.03, volatility: 0.015, seasonality: 0.04, floor: 20 } }),
  'brent-apr27': m({ id: 'brent-apr27', name: 'Brent Apr 2027', symbol: 'BRN APR27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Apr-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 80.5, drift: 0.03, volatility: 0.015, seasonality: 0.04, floor: 20 } }),
  'brent-may27': m({ id: 'brent-may27', name: 'Brent May 2027', symbol: 'BRN MAY27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent May-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 80.2, drift: 0.03, volatility: 0.015, seasonality: 0.04, floor: 20 } }),
  'brent-jun27': m({ id: 'brent-jun27', name: 'Brent Jun 2027', symbol: 'BRN JUN27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Jun-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 79.9, drift: 0.03, volatility: 0.015, seasonality: 0.04, floor: 20 } }),
  'brent-jul27': m({ id: 'brent-jul27', name: 'Brent Jul 2027', symbol: 'BRN JUL27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Jul-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 79.7, drift: 0.03, volatility: 0.015, seasonality: 0.04, floor: 20 } }),
  'brent-aug27': m({ id: 'brent-aug27', name: 'Brent Aug 2027', symbol: 'BRN AUG27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Aug-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 79.4, drift: 0.03, volatility: 0.015, seasonality: 0.04, floor: 20 } }),
  'brent-sep27': m({ id: 'brent-sep27', name: 'Brent Sep 2027', symbol: 'BRN SEP27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Sep-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 79.1, drift: 0.03, volatility: 0.016, seasonality: 0.04, floor: 20 } }),
  'brent-oct27': m({ id: 'brent-oct27', name: 'Brent Oct 2027', symbol: 'BRN OCT27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Oct-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 78.8, drift: 0.03, volatility: 0.016, seasonality: 0.04, floor: 20 } }),
  'brent-nov27': m({ id: 'brent-nov27', name: 'Brent Nov 2027', symbol: 'BRN NOV27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Nov-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 78.5, drift: 0.03, volatility: 0.016, seasonality: 0.04, floor: 20 } }),
  'brent-dec27': m({ id: 'brent-dec27', name: 'Brent Dec 2027', symbol: 'BRN DEC27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Contracts'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Dec-27', frequency: 'daily', chartKind: 'candlestick', tags: ['oil', 'monthly'], shape: { base: 78.2, drift: 0.03, volatility: 0.016, seasonality: 0.04, floor: 20 } }),
  'brent-roll-jan27': m({ id: 'brent-roll-jan27', name: 'Brent Roll Jan 2027', symbol: 'BRN R JAN27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Jan-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 81.0, drift: 0.03, volatility: 0.013, seasonality: 0.04, floor: 20 } }),
  'brent-roll-feb27': m({ id: 'brent-roll-feb27', name: 'Brent Roll Feb 2027', symbol: 'BRN R FEB27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Feb-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 80.8, drift: 0.03, volatility: 0.013, seasonality: 0.04, floor: 20 } }),
  'brent-roll-mar27': m({ id: 'brent-roll-mar27', name: 'Brent Roll Mar 2027', symbol: 'BRN R MAR27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Mar-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 80.5, drift: 0.03, volatility: 0.013, seasonality: 0.04, floor: 20 } }),
  'brent-roll-apr27': m({ id: 'brent-roll-apr27', name: 'Brent Roll Apr 2027', symbol: 'BRN R APR27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Apr-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 80.2, drift: 0.03, volatility: 0.013, seasonality: 0.04, floor: 20 } }),
  'brent-roll-may27': m({ id: 'brent-roll-may27', name: 'Brent Roll May 2027', symbol: 'BRN R MAY27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll May-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 79.9, drift: 0.03, volatility: 0.013, seasonality: 0.04, floor: 20 } }),
  'brent-roll-jun27': m({ id: 'brent-roll-jun27', name: 'Brent Roll Jun 2027', symbol: 'BRN R JUN27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Jun-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 79.6, drift: 0.03, volatility: 0.013, seasonality: 0.04, floor: 20 } }),
  'brent-roll-jul27': m({ id: 'brent-roll-jul27', name: 'Brent Roll Jul 2027', symbol: 'BRN R JUL27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Jul-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 79.3, drift: 0.03, volatility: 0.013, seasonality: 0.04, floor: 20 } }),
  'brent-roll-aug27': m({ id: 'brent-roll-aug27', name: 'Brent Roll Aug 2027', symbol: 'BRN R AUG27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Aug-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 79.0, drift: 0.03, volatility: 0.013, seasonality: 0.04, floor: 20 } }),
  'brent-roll-sep27': m({ id: 'brent-roll-sep27', name: 'Brent Roll Sep 2027', symbol: 'BRN R SEP27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Sep-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 78.7, drift: 0.03, volatility: 0.014, seasonality: 0.04, floor: 20 } }),
  'brent-roll-oct27': m({ id: 'brent-roll-oct27', name: 'Brent Roll Oct 2027', symbol: 'BRN R OCT27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Oct-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 78.4, drift: 0.03, volatility: 0.014, seasonality: 0.04, floor: 20 } }),
  'brent-roll-nov27': m({ id: 'brent-roll-nov27', name: 'Brent Roll Nov 2027', symbol: 'BRN R NOV27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Nov-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 78.1, drift: 0.03, volatility: 0.014, seasonality: 0.04, floor: 20 } }),
  'brent-roll-dec27': m({ id: 'brent-roll-dec27', name: 'Brent Roll Dec 2027', symbol: 'BRN R DEC27', tab: 'contracts', path: ['Curve Builder', 'Brent', 'Rolling'], unit: 'USD/bbl', currency: 'USD', source: 'ICE Brent Roll Dec-27', frequency: 'daily', chartKind: 'line', tags: ['oil', 'rolling'], shape: { base: 77.8, drift: 0.03, volatility: 0.014, seasonality: 0.04, floor: 20 } }),
  'ttf-jan27': m({ id: 'ttf-jan27', name: 'TTF Jan 2027', symbol: 'TTF JAN27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Jan-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 37.5, drift: -0.01, volatility: 0.025, seasonality: 0.07, floor: 8 } }),
  'ttf-feb27': m({ id: 'ttf-feb27', name: 'TTF Feb 2027', symbol: 'TTF FEB27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Feb-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 36.8, drift: -0.01, volatility: 0.025, seasonality: 0.07, floor: 8 } }),
  'ttf-mar27': m({ id: 'ttf-mar27', name: 'TTF Mar 2027', symbol: 'TTF MAR27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Mar-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 35.2, drift: -0.01, volatility: 0.024, seasonality: 0.07, floor: 8 } }),
  'ttf-apr27': m({ id: 'ttf-apr27', name: 'TTF Apr 2027', symbol: 'TTF APR27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Apr-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 33.1, drift: -0.01, volatility: 0.023, seasonality: 0.06, floor: 8 } }),
  'ttf-may27': m({ id: 'ttf-may27', name: 'TTF May 2027', symbol: 'TTF MAY27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF May-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 31.5, drift: -0.01, volatility: 0.022, seasonality: 0.06, floor: 7 } }),
  'ttf-jun27': m({ id: 'ttf-jun27', name: 'TTF Jun 2027', symbol: 'TTF JUN27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Jun-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 30.2, drift: -0.01, volatility: 0.022, seasonality: 0.06, floor: 7 } }),
  'ttf-jul27': m({ id: 'ttf-jul27', name: 'TTF Jul 2027', symbol: 'TTF JUL27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Jul-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 29.5, drift: -0.01, volatility: 0.022, seasonality: 0.06, floor: 7 } }),
  'ttf-aug27': m({ id: 'ttf-aug27', name: 'TTF Aug 2027', symbol: 'TTF AUG27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Aug-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 29.0, drift: -0.01, volatility: 0.022, seasonality: 0.06, floor: 7 } }),
  'ttf-sep27': m({ id: 'ttf-sep27', name: 'TTF Sep 2027', symbol: 'TTF SEP27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Sep-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 30.8, drift: -0.01, volatility: 0.023, seasonality: 0.07, floor: 7 } }),
  'ttf-oct27': m({ id: 'ttf-oct27', name: 'TTF Oct 2027', symbol: 'TTF OCT27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Oct-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 33.0, drift: -0.01, volatility: 0.024, seasonality: 0.07, floor: 8 } }),
  'ttf-nov27': m({ id: 'ttf-nov27', name: 'TTF Nov 2027', symbol: 'TTF NOV27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Nov-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 35.5, drift: -0.01, volatility: 0.025, seasonality: 0.07, floor: 8 } }),
  'ttf-dec27': m({ id: 'ttf-dec27', name: 'TTF Dec 2027', symbol: 'TTF DEC27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Contracts'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Dec-27', frequency: 'daily', chartKind: 'candlestick', tags: ['gas', 'monthly'], shape: { base: 37.8, drift: -0.01, volatility: 0.026, seasonality: 0.08, floor: 8 } }),
  'ttf-roll-jan27': m({ id: 'ttf-roll-jan27', name: 'TTF Roll Jan 2027', symbol: 'TTF R JAN27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Jan-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 37.2, drift: -0.01, volatility: 0.024, seasonality: 0.07, floor: 8 } }),
  'ttf-roll-feb27': m({ id: 'ttf-roll-feb27', name: 'TTF Roll Feb 2027', symbol: 'TTF R FEB27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Feb-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 36.5, drift: -0.01, volatility: 0.024, seasonality: 0.07, floor: 8 } }),
  'ttf-roll-mar27': m({ id: 'ttf-roll-mar27', name: 'TTF Roll Mar 2027', symbol: 'TTF R MAR27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Mar-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 34.8, drift: -0.01, volatility: 0.023, seasonality: 0.07, floor: 8 } }),
  'ttf-roll-apr27': m({ id: 'ttf-roll-apr27', name: 'TTF Roll Apr 2027', symbol: 'TTF R APR27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Apr-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 32.8, drift: -0.01, volatility: 0.022, seasonality: 0.06, floor: 7 } }),
  'ttf-roll-may27': m({ id: 'ttf-roll-may27', name: 'TTF Roll May 2027', symbol: 'TTF R MAY27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll May-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 31.2, drift: -0.01, volatility: 0.022, seasonality: 0.06, floor: 7 } }),
  'ttf-roll-jun27': m({ id: 'ttf-roll-jun27', name: 'TTF Roll Jun 2027', symbol: 'TTF R JUN27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Jun-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 29.9, drift: -0.01, volatility: 0.021, seasonality: 0.06, floor: 7 } }),
  'ttf-roll-jul27': m({ id: 'ttf-roll-jul27', name: 'TTF Roll Jul 2027', symbol: 'TTF R JUL27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Jul-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 29.2, drift: -0.01, volatility: 0.021, seasonality: 0.06, floor: 7 } }),
  'ttf-roll-aug27': m({ id: 'ttf-roll-aug27', name: 'TTF Roll Aug 2027', symbol: 'TTF R AUG27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Aug-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 28.7, drift: -0.01, volatility: 0.021, seasonality: 0.06, floor: 7 } }),
  'ttf-roll-sep27': m({ id: 'ttf-roll-sep27', name: 'TTF Roll Sep 2027', symbol: 'TTF R SEP27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Sep-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 30.5, drift: -0.01, volatility: 0.022, seasonality: 0.07, floor: 7 } }),
  'ttf-roll-oct27': m({ id: 'ttf-roll-oct27', name: 'TTF Roll Oct 2027', symbol: 'TTF R OCT27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Oct-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 32.7, drift: -0.01, volatility: 0.023, seasonality: 0.07, floor: 8 } }),
  'ttf-roll-nov27': m({ id: 'ttf-roll-nov27', name: 'TTF Roll Nov 2027', symbol: 'TTF R NOV27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Nov-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 35.2, drift: -0.01, volatility: 0.024, seasonality: 0.07, floor: 8 } }),
  'ttf-roll-dec27': m({ id: 'ttf-roll-dec27', name: 'TTF Roll Dec 2027', symbol: 'TTF R DEC27', tab: 'contracts', path: ['Curve Builder', 'TTF', 'Rolling'], unit: 'EUR/MWh', currency: 'EUR', source: 'ICE Endex TTF Roll Dec-27', frequency: 'daily', chartKind: 'line', tags: ['gas', 'rolling'], shape: { base: 37.5, drift: -0.01, volatility: 0.025, seasonality: 0.08, floor: 8 } }),
};

// -----------------------------------------------------------------------------
// Leaf helper — builds a TreeNode from a series id (caption = unit).
// -----------------------------------------------------------------------------
function leaf(seriesId: string, labelOverride?: string, idSuffix?: string): TreeNode {
  const s = SERIES[seriesId];
  return {
    id: idSuffix ? `n-${seriesId}-${idSuffix}` : `n-${seriesId}`,
    label: labelOverride ?? s.name,
    caption: s.unit,
    seriesId,
    badge: s.status === 'forbidden' ? 'locked' : s.status === 'missing' ? 'n/a' : undefined,
  };
}


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface StripSpec {
  idPrefix: string;
  name: string;
  symbol: string;
  unit: string;
  currency: string;
  source: string;
  base: string;
  slope: number;
  group: string;
}

/**
 * Registers `count` monthly contracts as real series and returns their tree
 * nodes. A production forward curve carries thirty to fifty of these, which is
 * the case the tree's "show more" affordance exists for: every contract is a
 * distinct, chartable series, so the list cannot be shortened by de-duplicating.
 */
function curveStrip(spec: StripSpec, count: number, startYear = 2027): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (let i = 0; i < count; i += 1) {
    const year = startYear + Math.floor(i / 12);
    const mon = MONTHS[i % 12];
    const yy = String(year).slice(2);
    const id = `${spec.idPrefix}-${mon.toLowerCase()}${yy}`;
    SERIES[id] = m({
      id,
      name: `${spec.name} ${mon} ${year}`,
      symbol: `${spec.symbol} ${mon.toUpperCase()}${yy}`,
      tab: 'contracts',
      path: [spec.group, 'Contracts'],
      unit: spec.unit,
      currency: spec.currency,
      source: `${spec.source} ${mon}-${yy}`,
      frequency: 'daily',
      chartKind: 'line',
      tags: ['monthly', 'curve'],
      shape: {
        base: Number(spec.base) - i * spec.slope,
        drift: 0.03,
        volatility: 0.014,
        seasonality: 0.04,
        floor: 1,
      },
    });
    nodes.push(leaf(id, `${mon} ${yy}`));
  }
  return nodes;
}

const CURVE_BRENT_C: StripSpec = {
  idPrefix: 'cb-brent-c', name: 'Brent Curve', symbol: 'BRN C', unit: 'USD/bbl', currency: 'USD',
  source: 'ICE Brent curve', base: '81.5', slope: 0.14, group: 'Curve Builder',
};
const CURVE_BRENT_R: StripSpec = {
  idPrefix: 'cb-brent-r', name: 'Brent Roll', symbol: 'BRN R', unit: 'USD/bbl', currency: 'USD',
  source: 'ICE Brent roll', base: '81.1', slope: 0.13, group: 'Curve Builder',
};
const CURVE_WTI_C: StripSpec = {
  idPrefix: 'cw-wti-c', name: 'WTI Curve', symbol: 'CL C', unit: 'USD/bbl', currency: 'USD',
  source: 'NYMEX WTI curve', base: '77.8', slope: 0.12, group: 'WTI Forward Curve',
};
const CURVE_WTI_R: StripSpec = {
  idPrefix: 'cw-wti-r', name: 'WTI Roll', symbol: 'CL R', unit: 'USD/bbl', currency: 'USD',
  source: 'NYMEX WTI roll', base: '77.4', slope: 0.11, group: 'WTI Forward Curve',
};
const CURVE_TTF_C: StripSpec = {
  idPrefix: 'ct-ttf-c', name: 'TTF Curve', symbol: 'TTF C', unit: 'EUR/MWh', currency: 'EUR',
  source: 'ICE Endex TTF curve', base: '31.4', slope: 0.06, group: 'TTF Forward Curve',
};
const CURVE_TTF_R: StripSpec = {
  idPrefix: 'ct-ttf-r', name: 'TTF Roll', symbol: 'TTF R', unit: 'EUR/MWh', currency: 'EUR',
  source: 'ICE Endex TTF roll', base: '31.1', slope: 0.05, group: 'TTF Forward Curve',
};

// -----------------------------------------------------------------------------
// TREES — one per tab. Max 10 parents each.
// -----------------------------------------------------------------------------
export const TREES: Record<TabId, TreeNode[]> = {
  forecast: [
    {
      id: 'f-energy', label: 'Energy', icon: 'flame',
      children: [
        { id: 'f-crude', label: 'Crude Oil', children: [leaf('brent'), leaf('wti'), leaf('dubai')] },
        { id: 'f-gas', label: 'Natural Gas', children: [leaf('ttf'), leaf('henryhub'), leaf('nbp'), leaf('psv'), leaf('the')] },
        { id: 'f-refined', label: 'Refined Products', children: [leaf('gasoil'), leaf('rbob')] },
      ],
    },
    {
      id: 'f-power', label: 'Power', icon: 'zap',
      children: [
        {
          id: 'f-da', label: 'Day-Ahead',
          children: [leaf('de-power'), leaf('fr-power'), leaf('nordpool'), leaf('it-power'), leaf('es-power')],
        },
      ],
    },
    { id: 'f-carbon', label: 'Carbon', icon: 'leaf', children: [leaf('eua'), leaf('uka'), leaf('cca')] },
    {
      id: 'f-weather', label: 'Weather', icon: 'cloud',
      children: [
        { id: 'f-temp', label: 'Temperature', children: [leaf('temp-eu')] },
        { id: 'f-dd', label: 'Degree Days', children: [leaf('hdd-us'), leaf('cdd-us')] },
        { id: 'f-ren', label: 'Renewables', children: [leaf('wind-de'), leaf('solar-es')] },
      ],
    },
    {
      id: 'f-ag', label: 'Agriculture', icon: 'wheat',
      children: [leaf('wheat'), leaf('corn'), leaf('soybean'), leaf('sugar')],
    },
    {
      id: 'f-metals', label: 'Metals', icon: 'gem',
      children: [
        { id: 'f-prec', label: 'Precious', children: [leaf('gold'), leaf('silver')] },
        { id: 'f-base', label: 'Base', children: [leaf('copper'), leaf('aluminium'), leaf('nickel')] },
      ],
    },
    { id: 'f-freight', label: 'Freight', icon: 'globe', children: [leaf('baltic')] },
  ],
  contracts: [
    {
      id: 'c-curve', label: 'Curve Builder', icon: 'git-branch',
      children: [
        {
          id: 'c-curve-brent', label: 'Brent',
          children: [
            {
              id: 'c-curve-brent-m1', label: 'M+1', seriesId: 'brent-fm',
              children: [
                { id: 'c-brent-m1-contracts', label: 'Contracts', lazy: true, children: curveStrip(CURVE_BRENT_C, 30) },
                { id: 'c-brent-m1-rolling', label: 'Rolling Contracts', lazy: true, children: curveStrip(CURVE_BRENT_R, 30) },
              ],
            },
            {
              id: 'c-curve-brent-m2', label: 'M+2', seriesId: 'brent-c1',
              children: [
                { id: 'c-brent-m2-contracts', label: 'Contracts', lazy: true, children: [leaf('brent-jan27', 'Jan 27 (M+2)', 'm2'), leaf('brent-feb27', 'Feb 27 (M+2)', 'm2')] },
                { id: 'c-brent-m2-rolling', label: 'Rolling Contracts', lazy: true, children: [leaf('brent-roll-jan27', 'Jan 27 Roll (M+2)', 'm2'), leaf('brent-roll-feb27', 'Feb 27 Roll (M+2)', 'm2')] },
              ],
            },
          ],
        },
        {
          id: 'c-curve-ttf', label: 'TTF',
          children: [
            {
              id: 'c-curve-ttf-m1', label: 'M+1', seriesId: 'ttf-cal26',
              children: [
                { id: 'c-ttf-m1-contracts', label: 'Contracts', lazy: true, children: [leaf('ttf-jan27'), leaf('ttf-feb27'), leaf('ttf-mar27'), leaf('ttf-apr27'), leaf('ttf-may27'), leaf('ttf-jun27'), leaf('ttf-jul27'), leaf('ttf-aug27'), leaf('ttf-sep27'), leaf('ttf-oct27'), leaf('ttf-nov27'), leaf('ttf-dec27')] },
                { id: 'c-ttf-m1-rolling', label: 'Rolling Contracts', lazy: true, children: [leaf('ttf-roll-jan27'), leaf('ttf-roll-feb27'), leaf('ttf-roll-mar27'), leaf('ttf-roll-apr27'), leaf('ttf-roll-may27'), leaf('ttf-roll-jun27'), leaf('ttf-roll-jul27'), leaf('ttf-roll-aug27'), leaf('ttf-roll-sep27'), leaf('ttf-roll-oct27'), leaf('ttf-roll-nov27'), leaf('ttf-roll-dec27')] },
              ],
            },
            {
              id: 'c-curve-ttf-m2', label: 'M+2', seriesId: 'ttf-q127',
              children: [
                { id: 'c-ttf-m2-contracts', label: 'Contracts', lazy: true, children: [leaf('ttf-jan27', 'Jan 27 (M+2)', 'm2'), leaf('ttf-feb27', 'Feb 27 (M+2)', 'm2')] },
                { id: 'c-ttf-m2-rolling', label: 'Rolling Contracts', lazy: true, children: [leaf('ttf-roll-jan27', 'Jan 27 Roll (M+2)', 'm2'), leaf('ttf-roll-feb27', 'Feb 27 Roll (M+2)', 'm2')] },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'c-curve-wti', label: 'WTI Forward Curve', icon: 'git-branch',
      children: [
        {
          id: 'c-curve-wti-root', label: 'WTI',
          children: [
            {
              id: 'c-curve-wti-m1', label: 'M+1', seriesId: 'wti-c1',
              children: [
                { id: 'c-wti-m1-contracts', label: 'Contracts', lazy: true, children: curveStrip(CURVE_WTI_C, 40) },
                { id: 'c-wti-m1-rolling', label: 'Rolling Contracts', lazy: true, children: curveStrip(CURVE_WTI_R, 40) },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'c-curve-ttf-fwd', label: 'TTF Forward Curve', icon: 'git-branch',
      children: [
        {
          id: 'c-curve-ttf-fwd-root', label: 'TTF',
          children: [
            {
              id: 'c-curve-ttf-fwd-m1', label: 'M+1', seriesId: 'ttf-cal26',
              children: [
                { id: 'c-ttffwd-m1-contracts', label: 'Contracts', lazy: true, children: curveStrip(CURVE_TTF_C, 50) },
                { id: 'c-ttffwd-m1-rolling', label: 'Rolling Contracts', lazy: true, children: curveStrip(CURVE_TTF_R, 50) },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'c-abs', label: 'Absolute Contracts', icon: 'file',
      children: [leaf('brent-fm'), leaf('ttf-cal26'), leaf('wti-cal26')],
    },
    {
      id: 'c-cont', label: 'Continuous Contracts', icon: 'infinity',
      children: [leaf('brent-c1'), leaf('wti-c1')],
    },
    {
      id: 'c-fut', label: 'Futures', icon: 'calendar',
      children: [
        {
          id: 'c-roll', label: 'Monthly Rolling',
          children: [leaf('eua-dec26'), leaf('eua-dec27'), leaf('ttf-q127'), leaf('hh-jan27')],
        },
        { id: 'c-seas', label: 'Seasonal', children: [leaf('ttf-sum26')] },
      ],
    },
    {
      id: 'c-spread', label: 'Spreads', icon: 'git-compare',
      children: [leaf('brent-wti-spread'), leaf('ttf-nbp-spread')],
    },
  ],
  regions: [
    {
      id: 'r-eu', label: 'Europe', icon: 'globe',
      children: [
        { id: 'r-eu-power', label: 'Power', children: [leaf('de-power'), leaf('fr-power'), leaf('nordpool'), leaf('it-power'), leaf('es-power')] },
        { id: 'r-eu-gas', label: 'Gas', children: [leaf('ttf'), leaf('nbp'), leaf('psv'), leaf('the')] },
        { id: 'r-eu-lng', label: 'LNG', children: [leaf('des-nwe')] },
        { id: 'r-eu-carbon', label: 'Carbon', children: [leaf('eua'), leaf('uka')] },
      ],
    },
    {
      id: 'r-na', label: 'North America', icon: 'globe',
      children: [
        { id: 'r-na-us', label: 'United States', children: [leaf('henryhub'), leaf('pjm'), leaf('ercot'), leaf('caiso')] },
      ],
    },
    {
      id: 'r-ap', label: 'Asia Pacific', icon: 'globe',
      children: [{ id: 'r-ap-lng', label: 'LNG', children: [leaf('jkm')] }],
    },
  ],
};

export const TAB_LABELS: Record<TabId, string> = {
  forecast: 'Forecast Series',
  contracts: 'Contracts',
  regions: 'Regions & Markets',
};

export const TAB_ICONS: Record<TabId, string> = {
  forecast: 'chart-line',
  contracts: 'file-text',
  regions: 'globe',
};

/** Flat search across all series for a query string. */
