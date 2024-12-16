"use strict";
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
var fs_1 = require("fs");
var path_1 = require("path");
var LangchainChunkingStep_1 = require("../src/utils/pipeline/steps/LangchainChunkingStep");
var OramaNativeChunkingStep_1 = require("../src/utils/pipeline/steps/OramaNativeChunkingStep");
var BasicChunkingStep_1 = require("../src/utils/pipeline/steps/BasicChunkingStep");
function compareChunkers() {
    return __awaiter(this, void 0, void 0, function () {
        var chunkers, testFiles, _loop_1, _i, _a, _b, size, content;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    chunkers = [
                        new LangchainChunkingStep_1.LangchainChunkingStep({
                            splitterType: 'recursive',
                            chunkSize: 500
                        }),
                        new OramaNativeChunkingStep_1.OramaNativeChunkingStep({
                            maxTokensPerChunk: 500,
                            type: 'document'
                        }),
                        new BasicChunkingStep_1.BasicChunkingStep({
                            method: 'paragraph',
                            chunkSize: 500
                        }),
                        new BasicChunkingStep_1.BasicChunkingStep({
                            method: 'sentence',
                            chunkSize: 500
                        }),
                        new BasicChunkingStep_1.BasicChunkingStep({
                            method: 'word',
                            chunkSize: 500
                        })
                    ];
                    testFiles = {
                        small: fs_1.default.readFileSync(path_1.default.join(__dirname, 'data/small.txt'), 'utf-8'),
                        medium: fs_1.default.readFileSync(path_1.default.join(__dirname, 'data/medium.txt'), 'utf-8'),
                        large: fs_1.default.readFileSync(path_1.default.join(__dirname, 'data/large.txt'), 'utf-8'),
                    };
                    _loop_1 = function (size, content) {
                        var results, _d, results_1, result;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    console.log("\nTesting ".concat(size, " document:"));
                                    console.log('-'.repeat(50));
                                    return [4 /*yield*/, Promise.all(chunkers.map(function (chunker) { return __awaiter(_this, void 0, void 0, function () {
                                            var result, analysis;
                                            var _a, _b, _c;
                                            return __generator(this, function (_d) {
                                                switch (_d.label) {
                                                    case 0: return [4 /*yield*/, chunker.process(content)];
                                                    case 1:
                                                        result = _d.sent();
                                                        analysis = {
                                                            chunker: chunker.name,
                                                            chunkCount: result.chunks.length,
                                                            chunksPerSecond: result.chunks.length / (result.performance.totalTime / 1000),
                                                            avgChunkSize: result.performance.averageChunkSize,
                                                            memoryMB: result.performance.memoryUsage / 1024 / 1024,
                                                            overlapRatio: (_a = result.performance.overlapStats) === null || _a === void 0 ? void 0 : _a.overlapRatio,
                                                            sentencesPerChunk: (_b = result.performance.chunkStats) === null || _b === void 0 ? void 0 : _b.avgSentencesPerChunk,
                                                            wordsPerChunk: (_c = result.performance.chunkStats) === null || _c === void 0 ? void 0 : _c.avgWordsPerChunk,
                                                            performance: result.performance
                                                        };
                                                        return [2 /*return*/, analysis];
                                                }
                                            });
                                        }); }))
                                        // Print summary table
                                    ];
                                case 1:
                                    results = _e.sent();
                                    // Print summary table
                                    console.table(results.map(function (r) {
                                        var _a, _b, _c;
                                        return ({
                                            chunker: r.chunker,
                                            chunks: r.chunkCount,
                                            chunksPerSec: r.chunksPerSecond.toFixed(2),
                                            avgChunkSize: r.avgChunkSize.toFixed(2),
                                            memoryMB: r.memoryMB.toFixed(2),
                                            overlapRatio: ((_a = r.overlapRatio) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || 'N/A',
                                            sentencesPerChunk: ((_b = r.sentencesPerChunk) === null || _b === void 0 ? void 0 : _b.toFixed(2)) || 'N/A',
                                            wordsPerChunk: ((_c = r.wordsPerChunk) === null || _c === void 0 ? void 0 : _c.toFixed(2)) || 'N/A'
                                        });
                                    }));
                                    // Print detailed stats for each chunker
                                    for (_d = 0, results_1 = results; _d < results_1.length; _d++) {
                                        result = results_1[_d];
                                        console.log("\nDetailed stats for ".concat(result.chunker, ":"));
                                        console.log('Chunk Size Distribution:', result.performance.chunkSizeDistribution);
                                        if (result.performance.chunkStats) {
                                            console.log('Chunk Stats:', result.performance.chunkStats);
                                        }
                                        if (result.performance.overlapStats) {
                                            console.log('Overlap Stats:', result.performance.overlapStats);
                                        }
                                        if (result.performance.separatorStats) {
                                            console.log('Separator Usage:', result.performance.separatorStats);
                                        }
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, _a = Object.entries(testFiles);
                    _c.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    _b = _a[_i], size = _b[0], content = _b[1];
                    return [5 /*yield**/, _loop_1(size, content)];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
compareChunkers().catch(console.error);
