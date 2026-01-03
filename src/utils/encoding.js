/**
 * Encoding utilities for subtitle files
 * 
 * Many subtitle files are encoded in various formats (Latin-1, Windows-1252, UTF-8, etc.)
 * This module provides utilities to detect and convert encodings to UTF-8.
 */

const chardet = require('chardet');
const iconv = require('iconv-lite');

/**
 * Detect encoding of a buffer and convert to UTF-8 string
 * 
 * @param {Buffer} buffer - Raw bytes from subtitle file
 * @returns {string} UTF-8 string
 */
function bufferToUtf8(buffer) {
    // Check for BOM markers first
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        // UTF-8 BOM
        return buffer.toString('utf-8').slice(1); // Remove BOM
    }
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        // UTF-16 LE BOM
        return iconv.decode(buffer, 'utf-16le');
    }
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
        // UTF-16 BE BOM
        return iconv.decode(buffer, 'utf-16be');
    }
    
    // Try to detect encoding
    const detected = chardet.detect(buffer);
    
    if (!detected) {
        // Fallback: try UTF-8, then Latin-1
        try {
            const utf8 = buffer.toString('utf-8');
            // Check for replacement character (indicates bad UTF-8)
            if (!utf8.includes('\uFFFD')) {
                return utf8;
            }
        } catch (e) {
            // Ignore
        }
        
        // Fallback to Latin-1 which preserves all bytes
        return iconv.decode(buffer, 'iso-8859-1');
    }
    
    // Map some common encodings that might be detected differently
    const encodingMap = {
        'ISO-8859-1': 'iso-8859-1',
        'ISO-8859-15': 'iso-8859-15',
        'windows-1252': 'windows-1252',
        'UTF-8': 'utf-8',
        'ascii': 'utf-8',
        'Big5': 'big5',
        'GB2312': 'gb2312',
        'GBK': 'gbk',
        'EUC-KR': 'euc-kr',
        'Shift_JIS': 'shift-jis',
        'EUC-JP': 'euc-jp',
        'KOI8-R': 'koi8-r'
    };
    
    const normalizedEncoding = encodingMap[detected] || detected.toLowerCase();
    
    // Check if iconv-lite supports this encoding
    if (!iconv.encodingExists(normalizedEncoding)) {
        console.warn(`[Encoding] Unknown encoding: ${detected}, falling back to Latin-1`);
        return iconv.decode(buffer, 'iso-8859-1');
    }
    
    return iconv.decode(buffer, normalizedEncoding);
}

/**
 * Convert a buffer to UTF-8 and get encoding info
 * 
 * @param {Buffer} buffer - Raw bytes from subtitle file
 * @returns {{ content: string, detectedEncoding: string }}
 */
function bufferToUtf8WithInfo(buffer) {
    const detected = chardet.detect(buffer) || 'unknown';
    const content = bufferToUtf8(buffer);
    
    return {
        content,
        detectedEncoding: detected
    };
}

module.exports = {
    bufferToUtf8,
    bufferToUtf8WithInfo
};
