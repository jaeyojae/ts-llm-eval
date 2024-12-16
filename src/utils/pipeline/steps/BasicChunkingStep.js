"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicChunkingStep = void 0;
var gpt_tokenizer_1 = require("gpt-tokenizer");
var BasicChunkingStep = /** @class */ (function () {
    function BasicChunkingStep(options) {
        if (options === void 0) { options = {}; }
        this.name = 'BasicChunking';
        this.options = __assign({ method: 'paragraph', chunkSize: 500, chunkOverlap: 50, separators: __assign({ sentence: /[.!?]+/g, paragraph: /\n\s*\n/g, word: /\s+/g }, options.separators) }, options);
    }
    BasicChunkingStep.prototype.countTokens = function (text) {
        return (0, gpt_tokenizer_1.encode)(text).length;
    };
    BasicChunkingStep.prototype.splitText = function (text) {
        var _this = this;
        var chunks = [];
        var currentChunk = [];
        var currentSize = 0;
        var getSeparator = function () {
            switch (_this.options.method) {
                case 'sentence':
                    return _this.options.separators.sentence;
                case 'paragraph':
                    return _this.options.separators.paragraph;
                case 'word':
                    return _this.options.separators.word;
                default:
                    return null;
            }
        };
        var separator = getSeparator();
        if (separator) {
            // Split by separator
            var segments = text.split(separator).filter(function (s) { return s.trim().length > 0; });
            for (var _i = 0, segments_1 = segments; _i < segments_1.length; _i++) {
                var segment = segments_1[_i];
                var segmentSize = this.countTokens(segment);
                if (currentSize + segmentSize > this.options.chunkSize && currentChunk.length > 0) {
                    chunks.push(currentChunk.join(' '));
                    // Keep last segment for overlap if needed
                    if (this.options.chunkOverlap > 0 && currentChunk.length > 0) {
                        currentChunk = [currentChunk[currentChunk.length - 1]];
                        currentSize = this.countTokens(currentChunk[0]);
                    }
                    else {
                        currentChunk = [];
                        currentSize = 0;
                    }
                }
                currentChunk.push(segment);
                currentSize += segmentSize;
            }
        }
        else {
            // Character-based splitting
            var i = 0;
            while (i < text.length) {
                var chunk = text.slice(i, i + this.options.chunkSize);
                chunks.push(chunk);
                i += this.options.chunkSize - this.options.chunkOverlap;
            }
        }
        // Add remaining chunk
        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
        }
        return chunks;
    };
    BasicChunkingStep.prototype.calculateStats = function (chunks) {
        var _this = this;
        var stats = {
            sentenceStats: { total: 0, perChunk: [] },
            wordStats: { total: 0, perChunk: [] },
            overlapSizes: []
        };
        chunks.forEach(function (chunk, i) {
            // Count sentences
            var sentences = chunk.split(_this.options.separators.sentence).filter(function (s) { return s.trim().length > 0; });
            stats.sentenceStats.total += sentences.length;
            stats.sentenceStats.perChunk.push(sentences.length);
            // Count words
            var words = chunk.split(_this.options.separators.word).filter(function (w) { return w.trim().length > 0; });
            stats.wordStats.total += words.length;
            stats.wordStats.perChunk.push(words.length);
            // Calculate overlap with next chunk
            if (i < chunks.length - 1) {
                var overlap = 0;
                var nextChunk = chunks[i + 1];
                for (var j = 1; j <= Math.min(chunk.length, nextChunk.length); j++) {
                    if (chunk.slice(-j) === nextChunk.slice(0, j)) {
                        overlap = j;
                    }
                }
                stats.overlapSizes.push(overlap);
            }
        });
        return stats;
    };
    BasicChunkingStep.prototype.process = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, startMemory, chunks, stats, tokenCounts, endTime, endMemory, error;
            var _this = this;
            return __generator(this, function (_a) {
                try {
                    startTime = performance.now();
                    startMemory = process.memoryUsage().heapUsed;
                    chunks = this.splitText(text);
                    stats = this.calculateStats(chunks);
                    tokenCounts = chunks.map(function (chunk) { return _this.countTokens(chunk); });
                    endTime = performance.now();
                    endMemory = process.memoryUsage().heapUsed;
                    return [2 /*return*/, {
                            chunks: chunks,
                            performance: {
                                totalTime: endTime - startTime,
                                chunksCreated: chunks.length,
                                averageChunkSize: chunks.length ? tokenCounts.reduce(function (a, b) { return a + b; }, 0) / chunks.length : 0,
                                tokensProcessed: tokenCounts.reduce(function (a, b) { return a + b; }, 0),
                                memoryUsage: endMemory - startMemory,
                                chunkSizeDistribution: {
                                    min: chunks.length ? Math.min.apply(Math, tokenCounts) : 0,
                                    max: chunks.length ? Math.max.apply(Math, tokenCounts) : 0,
                                    median: chunks.length ?
                                        tokenCounts.sort(function (a, b) { return a - b; })[Math.floor(tokenCounts.length / 2)] : 0
                                },
                                chunkStats: {
                                    avgSentencesPerChunk: stats.sentenceStats.total / chunks.length,
                                    minSentencesPerChunk: Math.min.apply(Math, stats.sentenceStats.perChunk),
                                    maxSentencesPerChunk: Math.max.apply(Math, stats.sentenceStats.perChunk),
                                    avgWordsPerChunk: stats.wordStats.total / chunks.length,
                                    minWordsPerChunk: Math.min.apply(Math, stats.wordStats.perChunk),
                                    maxWordsPerChunk: Math.max.apply(Math, stats.wordStats.perChunk)
                                },
                                overlapStats: {
                                    averageOverlap: stats.overlapSizes.length ?
                                        stats.overlapSizes.reduce(function (a, b) { return a + b; }, 0) / stats.overlapSizes.length : 0,
                                    minOverlap: stats.overlapSizes.length ? Math.min.apply(Math, stats.overlapSizes) : 0,
                                    maxOverlap: stats.overlapSizes.length ? Math.max.apply(Math, stats.overlapSizes) : 0,
                                    overlapRatio: stats.overlapSizes.length ?
                                        (stats.overlapSizes.reduce(function (a, b) { return a + b; }, 0) / stats.overlapSizes.length) / this.options.chunkSize : 0
                                }
                            }
                        }];
                }
                catch (err) {
                    error = err;
                    throw new Error("Chunking failed: ".concat(error.message || 'Unknown error'));
                }
                return [2 /*return*/];
            });
        });
    };
    return BasicChunkingStep;
}());
exports.BasicChunkingStep = BasicChunkingStep;
