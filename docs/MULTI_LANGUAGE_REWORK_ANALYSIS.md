# Multi-Language Selection Rework

## Overview

This document describes the rework from a primary/secondary language system to a multi-language selection system supporting up to 5 languages with equal priority.

## Changes Implemented

### 1. Frontend (Configuration Page)

**Files Modified:**
- `public/index.html` - Replaced dual dropdown with multi-select tags UI
- `public/style.css` - Added styling for tags, dropdown checkboxes
- `public/js/configure.js` - Complete rewrite for multi-language selection

**UI Changes:**
- Single "Select Languages" button opens dropdown with checkboxes
- Selected languages appear as removable tags
- Maximum 5 languages enforced with visual feedback
- Search/filter functionality for finding languages
- Clean, modern tag-based interface

### 2. Configuration Parsing

**File Modified:** `src/config.js`

**Changes:**
- `parseConfig()` now accepts `{languages: [...]}` format
- Backward compatibility with legacy `{primaryLang, secondaryLang}` format
- Validation ensures at least 1 and max 5 languages
- Exports `MAX_LANGUAGES` constant (5)

### 3. Backend (Subtitle Handler)

**File Modified:** `src/subtitles.js`

**Key Changes:**
- `handleSubtitles()` uses `config.languages` array
- New `prioritizeSubtitlesMulti()` function for balanced interleaving
- Subtitles from all languages interleaved in round-robin fashion
- Ensures fair representation of all selected languages in limited result set

### 4. WyzieProvider

**File Modified:** `src/providers/WyzieProvider.js`

**New Method:** `searchFastFirstMulti(query, languages)`
- Queries all sources for each language in parallel (N languages × M sources)
- Returns when ANY language hits the minimum threshold
- Background query for all languages (for caching)

### 5. Server Routes

**File Modified:** `server.js`

**Changes:**
- Custom `/:config/subtitles/:type/:id.json` route for JSON config format
- Updated manifest route to recognize `{languages: [...]}` format
- Removed `configurationRequired` when valid languages are present

### 6. Manifest Generation

**File Modified:** `manifest.js`

**Changes:**
- `generateDescription()` handles languages array
- Dynamic version from package.json
- Removed legacy primary/secondary config definition
- Grammar-aware language listing ("French", "French and English", "French, English and Spanish")

## Query Strategy

### N-Language Parallel Queries

For each subtitle request with N selected languages:

1. **Fast-First Phase:**
   - Fire N × M queries in parallel (N languages, M sources)
   - Return immediately when ANY language hits threshold (default: 5 subtitles)
   - All collected subtitles returned, not just threshold language

2. **Background Phase:**
   - 1 × M queries without language filter (for complete caching)
   - Caches ALL available subtitles for future users

3. **Result Interleaving:**
   - Round-robin distribution across all selected languages
   - Example with 3 languages and MAX_SUBTITLES=10: 4, 3, 3 distribution
   - Quality sorting within each language group

## Configuration URL Format

**New Format:**
```
/{encoded_json}/manifest.json
/{encoded_json}/subtitles/movie/tt1234567.json
```

Where `encoded_json` is URL-encoded JSON:
```json
{"languages":["fra","eng","spa"]}
```

**Example URL:**
```
http://127.0.0.1:3100/%7B%22languages%22%3A%5B%22fra%22%2C%22eng%22%5D%7D/manifest.json
```

## Stats Tracking

Language stats are recorded per-language (no more primary/secondary distinction):
- Each selected language tracked individually
- Found/not-found counts per language
- Availability rates calculated per language

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_SUBTITLES` | 30 | Maximum subtitles returned per request |

## Testing

### Test Commands

```powershell
# Test manifest with multi-language config
$config = [uri]::EscapeDataString('{"languages":["fra","eng"]}')
Invoke-RestMethod "http://127.0.0.1:3100/$config/manifest.json"

# Test subtitle request
$config = [uri]::EscapeDataString('{"languages":["fra","eng","spa"]}')
Invoke-RestMethod "http://127.0.0.1:3100/$config/subtitles/movie/tt0111161.json"
```

### Expected Results

With `MAX_SUBTITLES=10` and 3 languages:
- Total: 10 subtitles
- Distribution: ~3-4 per language (interleaved)

## Backward Compatibility

- Legacy `{primaryLang, secondaryLang}` configs still work
- Config parser converts legacy format to new `languages` array
- Existing cached subtitles remain valid
- Stats DB schema unchanged (uses 'primary' as default priority)

## Future Considerations

1. **Per-Language Limits:** Could allow users to set max subtitles per language
2. **Language Priority:** Could re-introduce priority for weighted distribution
3. **Source Preferences:** Could allow users to prioritize certain sources per language
