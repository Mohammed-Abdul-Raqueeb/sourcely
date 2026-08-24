# Product images — drop folder

Put product images **in this folder**, named by SKU, then run:

```
npm run images:ingest
```

Two ways to fill it:

- **Your own images** — photos you have rights to use, named per the list below.
- **Generated catalogue renders** — `npm run images:generate` renders every
  seeded product as a CGI-style studio illustration (`<SKU>.png`) into this
  folder. These are deterministic vector renders, not photographs. A real
  photo dropped here under the same SKU simply replaces the render on the
  next ingest.

The ingest script converts each image to WebP (long edge capped at 1600 px,
EXIF stripped), writes it to `public/products/`, and records it — with
dimensions and a blur-up placeholder — in the generated manifest that the
catalogue reads at boot. Restart `npm run dev` afterwards to see the images.

**Rules**

- One image per product minimum: `<SKU>.jpg` (this is the card / listing image).
- Up to three extra gallery views per product: `<SKU>-2.jpg`, `<SKU>-3.jpg`, `<SKU>-4.jpg`.
- `.jpg`, `.jpeg`, `.png`, `.webp` and `.avif` are all accepted; filenames are
  case-insensitive.
- Landscape around 4:3 (e.g. 1600 × 1200) fits the card and gallery frames
  best; anything else is displayed with `object-cover` cropping.
- A partial set is fine — any product without an image here keeps the current
  vector line-art automatically. Re-running the ingest merges: it replaces the
  entries for SKUs found in this folder and leaves the rest untouched.

**Expected files** (primary image per product; add `-2`…`-4` variants freely):

## Valves

| File | Product |
| --- | --- |
| `VTK-BV2S-050.jpg` | Vantek 2-Piece Ball Valve, SS316, DN50 Threaded |
| `VTK-BV2S-040.jpg` | Vantek 2-Piece Ball Valve, SS316, DN40 Threaded |
| `VTK-BV3S-050.jpg` | Vantek 3-Piece Ball Valve, SS316, DN50 Threaded |
| `DOR-BV-050T.jpg` | Dorsett Series 40 Ball Valve, SS316, DN50 Threaded |
| `VTK-BV2S-025.jpg` | Vantek 2-Piece Ball Valve, SS304, DN25 Threaded |
| `VTK-BV2S-065.jpg` | Vantek 2-Piece Ball Valve, SS316, DN65 Threaded |
| `VTK-BVB-050.jpg` | Vantek Ball Valve, Forged Brass, DN50 Threaded |
| `DOR-BFV-100.jpg` | Dorsett Butterfly Valve, Ductile Iron, DN100 Wafer |
| `VTK-GV-080F.jpg` | Vantek Gate Valve, Cast Iron, DN80 Flanged PN16 |
| `VTK-CV-050T.jpg` | Vantek Check Valve, SS316, DN50 Threaded |
| `VTK-YS-050T.jpg` | Vantek Y-Strainer, SS316, DN50 Threaded, 40 Mesh |
| `DOR-DRV-050.jpg` | Dorsett Double Regulating Valve, Bronze, DN50 Threaded |
| `DOR-MCV-050.jpg` | Dorsett 2-Way Motorised Control Valve, DN50, 24V Modulating |
| `DOR-PRV-050.jpg` | Dorsett Pressure Reducing Valve, Bronze, DN50 Threaded |

## HVAC

| File | Product |
| --- | --- |
| `AFX-AHU-8000.jpg` | Aeroflux Modular Air Handling Unit, 8,000 CMH |
| `AFX-AHU-15000.jpg` | Aeroflux Modular Air Handling Unit, 15,000 CMH |
| `AFX-FCU-600.jpg` | Aeroflux Ceiling Concealed Fan Coil Unit, 600 CFM |
| `AFX-FCU-1200.jpg` | Aeroflux Ceiling Concealed Fan Coil Unit, 1,200 CFM |
| `AFX-IFAN-400.jpg` | Aeroflux Inline Duct Fan, 400 mm, 4,200 CMH |
| `AFX-FLT-G4.jpg` | Aeroflux Pleated Pre-Filter, G4, 595 × 595 × 48 mm |
| `AFX-FLT-F7.jpg` | Aeroflux Bag Filter, F7, 595 × 595 × 600 mm, 6 Pocket |

## Pumps

| File | Product |
| --- | --- |
| `HYM-CP-ES-050.jpg` | Hydromek End-Suction Centrifugal Pump, DN50, 30 m³/h @ 30 m |
| `HYM-CP-ES-080.jpg` | Hydromek End-Suction Centrifugal Pump, DN80, 90 m³/h @ 45 m |
| `HYM-SUB-DW-15.jpg` | Hydromek Submersible Dewatering Pump, 1.5 kW, 15 m³/h |
| `HYM-SUB-SW-30.jpg` | Hydromek Submersible Sewage Pump, 3 kW, Non-Clog Vortex |
| `HYM-BST-VS3.jpg` | Hydromek Variable Speed Booster Set, 3 Pump, 45 m³/h |
| `HYM-DOS-25.jpg` | Hydromek Electronic Dosing Pump, 25 L/h, PVDF Head |
| `HYM-JCK-22.jpg` | Hydromek Fire Jockey Pump, 2.2 kW, Multistage Vertical |

## Electrical

| File | Product |
| --- | --- |
| `SNC-MCCB-100-3P.jpg` | Sanchay MCCB, 100 A, 3 Pole, 25 kA Thermal-Magnetic |
| `SNC-MCCB-250-4P.jpg` | Sanchay MCCB, 250 A, 4 Pole, 36 kA Microprocessor Release |
| `SNC-MCB-32-C.jpg` | Sanchay MCB, 32 A, Single Pole, C-Curve, 10 kA |
| `SNC-CONT-25.jpg` | Sanchay Contactor, 25 A, 3 Pole, 230 V AC Coil |
| `SNC-DB-12W.jpg` | Sanchay Distribution Board, 12 Way, TPN, IP42 Metal Enclosure |
| `SNC-TRAY-300.jpg` | Sanchay Perforated Cable Tray, 300 mm × 50 mm, GI, 2.5 m |

## Fire fighting

| File | Product |
| --- | --- |
| `PYR-SPK-PEN-68.jpg` | Pyrocore Pendent Sprinkler, 68 °C, K80, 1/2" NPT, UL Listed |
| `PYR-SPK-UPR-79.jpg` | Pyrocore Upright Sprinkler, 79 °C, K115, 1/2" NPT |
| `PYR-HYD-DH-63.jpg` | Pyrocore Double Headed Hydrant Valve, 63 mm, Stainless Steel |
| `PYR-HOSE-RRL-63.jpg` | Pyrocore RRL Fire Hose, 63 mm × 15 m, Type 2, with Couplings |
| `PYR-FLOW-SW-100.jpg` | Pyrocore Sprinkler Flow Switch, DN100, Vane Type |

## Instrumentation

| File | Product |
| --- | --- |
| `TRU-PG-100.jpg` | Trumeta Pressure Gauge, 100 mm Dial, 0–16 bar, SS316 Bourdon |
| `TRU-TG-100.jpg` | Trumeta Bimetal Thermometer, 100 mm Dial, 0–120 °C, Back Entry |
| `TRU-PT-420.jpg` | Trumeta Pressure Transmitter, 0–25 bar, 4–20 mA, 1/2" NPT |
| `ALT-PT-HP.jpg` | Altmeyer High-Accuracy Pressure Transmitter, 0–10 bar, 0.1% Class |
| `ALT-FM-EM-50.jpg` | Altmeyer Electromagnetic Flow Meter, DN50, PN16 Flanged |

## Plumbing

| File | Product |
| --- | --- |
| `CPL-CU-22.jpg` | Copperline Copper Tube, 22 mm × 0.9 mm, Half-Hard, 3 m |
| `CPL-CU-54.jpg` | Copperline Copper Tube, 54 mm × 1.2 mm, Half-Hard, 3 m |
| `CPL-CPVC-50.jpg` | Copperline CPVC Pipe, DN50, SDR 11, 3 m |
| `CPL-CPVC-BV-050.jpg` | Copperline CPVC Ball Valve, DN50, Solvent Weld |
| `CPL-GI-50.jpg` | Copperline GI Pipe, DN50 Medium Class, Threaded, 6 m |
| `CPL-INS-NBR-25.jpg` | Copperline Nitrile Rubber Pipe Insulation, 25 mm Wall, 54 mm Bore |
| `CPL-CLAMP-50.jpg` | Copperline Pipe Clamp with Rubber Lining, DN50, M10 Boss |

## Industrial

| File | Product |
| --- | --- |
| `SGD-COMP-SCR-15.jpg` | Steelgrid Rotary Screw Air Compressor, 15 kW, 8 bar, 2.4 m³/min |
| `SGD-MOT-IE3-75.jpg` | Steelgrid Induction Motor, 7.5 kW, 4 Pole, IE3, B3 Foot Mount |
| `SGD-VFD-75.jpg` | Steelgrid Variable Frequency Drive, 7.5 kW, 3 Phase, IP20 |
| `SGD-HOIST-2T.jpg` | Steelgrid Chain Hoist, 2 Tonne, 3 m Lift, Manual |

## Tools

| File | Product |
| --- | --- |
| `GRW-TW-200.jpg` | Gripwell Torque Wrench, 1/2" Drive, 40–200 Nm, Calibrated |
| `GRW-PW-450.jpg` | Gripwell Pipe Wrench, 450 mm, Drop-Forged Steel |
| `GRW-CM-600.jpg` | Gripwell Digital Clamp Meter, 600 A AC/DC, True RMS |

## Safety

| File | Product |
| --- | --- |
| `NRV-GLV-C5-L.jpg` | Nirvaan Cut-Resistant Gloves, EN388 Level C, HPPE, Size L |
| `NRV-GLV-C5-XL.jpg` | Nirvaan Cut-Resistant Gloves, EN388 Level C, HPPE, Size XL |
| `NRV-HLM-VNT.jpg` | Nirvaan Safety Helmet, Vented, Ratchet Harness, EN397 |
| `NRV-GOG-CLR.jpg` | Nirvaan Safety Goggles, Clear Anti-Fog, EN166 1B |
| `NRV-HRN-2PT.jpg` | Nirvaan Full Body Harness, Two-Point, EN361 with Shock Lanyard |
