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
exports.LangchainChunkingStep = void 0;
var text_splitter_1 = require("langchain/text_splitter");
var gpt_tokenizer_1 = require("gpt-tokenizer");
var LangchainChunkingStep = /** @class */ (function () {
    function LangchainChunkingStep(options) {
        if (options === void 0) { options = {}; }
        this.name = 'LangchainChunking';
        this.options = __assign({ splitterType: 'recursive', chunkSize: 500, chunkOverlap: 50, trackMetadata: true, separators: ['\n\n', '\n', ' ', ''], keepSeparator: true }, options);
        switch (this.options.splitterType) {
            case 'recursive':
                this.splitter = new text_splitter_1.RecursiveCharacterTextSplitter({
                    chunkSize: this.options.chunkSize,
                    chunkOverlap: this.options.chunkOverlap,
                    separators: this.options.separators,
                    keepSeparator: this.options.keepSeparator
                });
                break;
            case 'token':
                this.splitter = new text_splitter_1.TokenTextSplitter({
                    chunkSize: this.options.chunkSize,
                    chunkOverlap: this.options.chunkOverlap
                });
                break;
            case 'character':
                this.splitter = new text_splitter_1.CharacterTextSplitter({
                    chunkSize: this.options.chunkSize,
                    chunkOverlap: this.options.chunkOverlap,
                    separator: this.options.separators[0]
                });
                break;
            case 'markdown':
                this.splitter = new text_splitter_1.MarkdownTextSplitter({
                    chunkSize: this.options.chunkSize,
                    chunkOverlap: this.options.chunkOverlap
                });
                break;
        }
    }
    LangchainChunkingStep.prototype.countTokens = function (text) {
        return (0, gpt_tokenizer_1.encode)(text).length;
    };
    LangchainChunkingStep.prototype.trackSeparators = function (text) {
        var stats = new Map();
        for (var _i = 0, _a = this.options.separators; _i < _a.length; _i++) {
            var separator = _a[_i];
            var count = (text.match(new RegExp(separator, 'g')) || []).length;
            stats.set(separator, count);
        }
        return stats;
    };
    LangchainChunkingStep.prototype.calculateOverlap = function (chunks) {
        var overlaps = [];
        for (var i = 1; i < chunks.length; i++) {
            var prevChunk = chunks[i - 1].pageContent;
            var currentChunk = chunks[i].pageContent;
            var overlap = 0;
            // Find overlap by comparing end of prev chunk with start of current chunk
            for (var j = 1; j <= Math.min(prevChunk.length, currentChunk.length); j++) {
                if (prevChunk.slice(-j) === currentChunk.slice(0, j)) {
                    overlap = j;
                }
            }
            overlaps.push(overlap);
        }
        return overlaps;
    };
    LangchainChunkingStep.prototype.process = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, startMemory, separatorStats, docs, chunkLengths, overlapSizes, endTime, endMemory, chunks, tokenCounts, sentenceCounts, wordCounts, err_1, error;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        startTime = performance.now();
                        startMemory = process.memoryUsage().heapUsed;
                        separatorStats = this.trackSeparators(text);
                        return [4 /*yield*/, this.splitter.createDocuments([text])
                            // Track chunk lengths
                        ];
                    case 1:
                        docs = _a.sent();
                        chunkLengths = docs.map(function (doc) { return doc.pageContent.length; });
                        overlapSizes = this.calculateOverlap(docs);
                        endTime = performance.now();
                        endMemory = process.memoryUsage().heapUsed;
                        chunks = docs.map(function (doc) { return doc.pageContent; });
                        tokenCounts = chunks.map(function (chunk) { return _this.countTokens(chunk); });
                        sentenceCounts = chunks.map(function (chunk) {
                            return chunk.split(/[.!?]+/).filter(function (s) { return s.trim().length > 0; }).length;
                        });
                        wordCounts = chunks.map(function (chunk) {
                            return chunk.split(/\s+/).filter(function (w) { return w.trim().length > 0; }).length;
                        });
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
                                        avgSentencesPerChunk: sentenceCounts.reduce(function (a, b) { return a + b; }, 0) / chunks.length,
                                        minSentencesPerChunk: Math.min.apply(Math, sentenceCounts),
                                        maxSentencesPerChunk: Math.max.apply(Math, sentenceCounts),
                                        avgWordsPerChunk: wordCounts.reduce(function (a, b) { return a + b; }, 0) / chunks.length,
                                        minWordsPerChunk: Math.min.apply(Math, wordCounts),
                                        maxWordsPerChunk: Math.max.apply(Math, wordCounts)
                                    },
                                    overlapStats: {
                                        averageOverlap: overlapSizes.length ?
                                            overlapSizes.reduce(function (a, b) { return a + b; }, 0) / overlapSizes.length : 0,
                                        minOverlap: overlapSizes.length ? Math.min.apply(Math, overlapSizes) : 0,
                                        maxOverlap: overlapSizes.length ? Math.max.apply(Math, overlapSizes) : 0,
                                        overlapRatio: overlapSizes.length ?
                                            (overlapSizes.reduce(function (a, b) { return a + b; }, 0) / overlapSizes.length) / this.options.chunkSize : 0
                                    },
                                    separatorStats: Object.fromEntries(separatorStats)
                                }
                            }];
                    case 2:
                        err_1 = _a.sent();
                        error = err_1;
                        throw new Error("Chunking failed: ".concat(error.message || 'Unknown error'));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return LangchainChunkingStep;
}());
exports.LangchainChunkingStep = LangchainChunkingStep;
