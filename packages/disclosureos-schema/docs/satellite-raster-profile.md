# Satellite raster profile

The optional `satellite_raster_profile` contract describes retained multispectral surface-reflectance arrays on a north-up WGS84 UTM grid. It composes the V2 Observation, Acquisition Context and Product Source Selection contracts. Applications can use the same declarations, dependency-free reader and evaluator as the public viewer.

This is a bounded interchange profile for decoded source arrays. It does not decode GeoTIFF, COG, Landsat or Sentinel product formats. A producer must preserve the original source and document any conversion into these arrays.

## Public API

Import from `@disclosureos/schema/experimental/v2`:

- `SatelliteRasterProfileSchema` and `satelliteRasterProfileJsonSchema` expose the strict runtime and portable structural contracts.
- `evaluateSatelliteRasterProfile(observation, acquisition, selection, profile, { assets })` verifies exact document identifiers, pinned instrument channel, raw acquisition artifacts, digests, array extents and raster semantics.
- `readSatelliteRasterProducts(profile, layouts, assets)` decodes the retained values, quality and derived index. The dependency-free reader assumes declarations have been parsed. It does not verify hashes or certify physical measurements.
- `satelliteCellBounds(profile, row, column)` returns the selected projected cell footprint.

Portable schema imports are `@disclosureos/schema/experimental/v2/satellite-raster-profile/schema` and the pinned `/schema/0.1.0` path. Structural schema acceptance does not replace the evaluator's cross-document and numerical checks.

## Grid and arrays

`grid.crs` declares the WGS84 UTM zone, hemisphere, EPSG identifier and metre units. All must agree. The six affine coefficients use GDAL's corner convention: `(x, pixelWidth, 0, y, 0, negativePixelHeight)`. Rows increase southward and columns eastward. The cell center uses column + 0.5 and row + 0.5. Extents and scale bars represent projected grid distance, not a ground-distance correction or survey-accuracy claim. Rotated, geographic, non-UTM and point-sample grids need a different profile.

`reflectance` is a little-endian uint16, band-sequential `[band,row,column]` array. `quality` is a uint8 `[row,column]` array over the identical grid. Arrays have no header or prefix; each source selection identifies the exact retained element bytes. Grid size is bounded to 262,144 pixels and 2–16 bands. Larger products require a separately declared tiling strategy, rather than pretending that a preview is the complete source.

Each band declares its identifier, display label, nominal center wavelength, DN scale and additive offset, missing-value sentinel and accepted decoded range. Nominal center wavelengths do not define a spectral-response function. Reflectance is dimensionless and is decoded as `DN * scale + offset`. Missing values are detected before scaling. Declared ranges may include negative values or values above one; the reader does not clamp them. These values can exist in processed products and are not automatically usable in every calculation.

## Quality and index

Quality is an attributed, whole-pixel categorical annotation: clear (0), cloud (1), shadow (2), no data (3). These are not a particular satellite mission's QA bit assignments. A no-data pixel must contain the declared sentinel in every band. A missing band may also occur independently, including on a source-declared clear pixel. Clear is a source annotation, not a guarantee of accuracy or absence of atmospheric effects. This profile does not encode saturation or confidence flags; a product needing those distinctions requires an explicit extension or revised profile rather than reusing these codes.

The profile identifies red and near-infrared bands with matching nominal wavelength ranges. NDVI uses their scaled values: `(NIR - red) / (NIR + red)`. It is returned only for a source-declared clear pixel when both values exist, are nonnegative and have a positive sum. Otherwise the result is null with an explicit reason: no data, quality excluded, negative reflectance or zero denominator. Zero is a valid retained number; it is not a missing-value marker unless explicitly declared. NDVI is a spectral index, not a vegetation classifier or proof of a material's identity.

## Integrity and scientific boundaries

The evaluator snapshots input byte arrays before asynchronous hashing and rejects mismatched observations, source layouts, acquisition products, digests, data types, shapes, axes, units and array aliases. The manifest channel must describe `surface_reflectance` with unit `1` in the selected acquisition. The profile's source annotations and grid registration identify synthetic data explicitly.

Passing checks establish retained-source integrity and declared representation consistency. The result leaves scientific validity, physical calibration, quality accuracy and geographic registration `not_checked`. It does not validate atmospheric correction, band response, surface state, spatial resolving power, orbital position or acquisition timing.

## Reproducible example

[`examples/satellite-raster`](../../../examples/satellite-raster) contains six authored bands, an attributed quality grid, exact source documents, executable model and deterministic verifier. It retains a cloud patch, a shadow patch, no-data strip, valid all-zero pixel and partially missing pixel. The nominal projected location is arbitrary and does not depict that real site. No satellite, physical acquisition or field-session timing is claimed.

References that informed the representation:

- [GDAL affine geotransforms](https://gdal.org/en/stable/tutorials/geotransforms_tut.html) defines corner and pixel-center conventions.
- [USGS scale factors](https://www.usgs.gov/faqs/how-do-i-use-a-scale-factor-landsat-level-2-science-products) explains why scale and additive offset must be applied before physical interpretation. This example does not use or claim Landsat calibration.
- [USGS NDVI](https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index) gives the red/NIR index definition.
- [USGS quality bands](https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands) illustrates the importance of preserving source quality. This profile uses its own explicit categorical coding.
