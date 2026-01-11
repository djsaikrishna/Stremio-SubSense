/**
 * Encoding utilities for subtitle files
 * Detect and convert encodings to UTF-8.
 * 
 * Subtitle files are encoded in various formats (Latin-1, Windows-1252, UTF-8, etc.)
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
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return buffer.toString('utf-8').slice(1); // Remove BOM
    }
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return iconv.decode(buffer, 'utf-16le');
    }
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return iconv.decode(buffer, 'utf-16be');
    }
    
    const detected = chardet.detect(buffer);
    
    if (!detected) {
        try {
            const utf8 = buffer.toString('utf-8');
            if (!utf8.includes('\uFFFD')) {
                return utf8;
            }
        } catch (e) {
            // Ignore
        }
        
        return iconv.decode(buffer, 'iso-8859-1');
    }
    
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
