# Fictional multispectral satellite raster

This self-contained example supplies six retained optical bands, per-pixel quality annotations, a projected grid and exact source-byte selections. It is authored numerical data, not satellite imagery, a physical calibration, an observed event or an actual survey of the nominal grid location.

Run `node examples/satellite-raster/build.mjs`, then `pnpm verify:satellite-raster` after building the schema package. `model.mjs` reproduces every raw cell. `methods.json` records assumptions and limits.

The 72 × 96 grid has 30 m projected cell spacing in WGS84 / UTM zone 11N. The affine origin is the upper-left pixel corner; centers add half a cell. The grid location is arbitrary and is not a depiction of that real site. Pixel spacing is not a measurement of spatial resolution or accuracy.

`reflectance.u16` stores six band planes in blue, green, red, near-infrared, shortwave-infrared-1, shortwave-infrared-2 order. Each plane is row-major little-endian uint16. Decode each band with its declared scale and offset. `quality.u8` is a row-major uint8 grid: 0 source-declared clear, 1 cloud, 2 shadow, 3 no data. The categorical codes are this profile's declarations, not Landsat QA bits. No-data pixels contain the declared sentinel in every band. Band-level missingness is also possible without a whole-pixel no-data flag.

The example includes a zero-signal cell at row 6, column 6, and missing NIR at row 6, column 7. NDVI uses scaled red and NIR only when both are present, nonnegative, source-declared clear, and have a positive sum. Missing or excluded values remain null, not zero. NDVI is a spectral index, not a vegetation classifier.

This profile does not decode GeoTIFF, COG or any satellite product format. It does not verify atmospheric correction, reflectance calibration, spectral response, cloud accuracy, registration or resolution. No orbit, spacecraft identification, acquisition time or link to the Meridian field-session timing is supplied.
