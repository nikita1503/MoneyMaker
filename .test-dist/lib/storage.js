"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_FILE = exports.RUNS_FILE = exports.SENT_DIR = exports.SITES_DIR = exports.DATA_DIR = void 0;
exports.saveSiteHtml = saveSiteHtml;
exports.loadSiteHtml = loadSiteHtml;
exports.saveRun = saveRun;
exports.loadRun = loadRun;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
exports.DATA_DIR = node_path_1.default.join(process.cwd(), "data");
exports.SITES_DIR = node_path_1.default.join(exports.DATA_DIR, "sites");
exports.SENT_DIR = node_path_1.default.join(exports.DATA_DIR, "sent");
exports.RUNS_FILE = node_path_1.default.join(exports.DATA_DIR, "runs.json");
exports.CONFIG_FILE = node_path_1.default.join(exports.DATA_DIR, "config.json");
async function ensureDirs() {
    await promises_1.default.mkdir(exports.SITES_DIR, { recursive: true });
    await promises_1.default.mkdir(exports.SENT_DIR, { recursive: true });
}
async function saveSiteHtml(id, html) {
    await ensureDirs();
    const file = node_path_1.default.join(exports.SITES_DIR, `${id}.html`);
    await promises_1.default.writeFile(file, html, "utf8");
    return node_path_1.default.relative(process.cwd(), file);
}
async function loadSiteHtml(id) {
    const file = node_path_1.default.join(exports.SITES_DIR, `${id}.html`);
    try {
        return await promises_1.default.readFile(file, "utf8");
    }
    catch {
        return null;
    }
}
async function saveRun(id, pages) {
    await ensureDirs();
    let runs = {};
    try {
        runs = JSON.parse(await promises_1.default.readFile(exports.RUNS_FILE, "utf8"));
    }
    catch { }
    runs[id] = pages;
    await promises_1.default.writeFile(exports.RUNS_FILE, JSON.stringify(runs, null, 2), "utf8");
}
async function loadRun(id) {
    try {
        const runs = JSON.parse(await promises_1.default.readFile(exports.RUNS_FILE, "utf8"));
        return runs[id] ?? null;
    }
    catch {
        return null;
    }
}
const DEFAULT_CONFIG = {
    price: 499,
    paymentDetails: process.env.PAYMENT_DETAILS ?? "Paypal: you@example.com",
    fromName: "Alex the Freelancer",
    fromEmail: process.env.SMTP_FROM?.match(/<(.+)>/)?.[1] ?? "you@example.com",
};
async function loadConfig() {
    try {
        const c = JSON.parse(await promises_1.default.readFile(exports.CONFIG_FILE, "utf8"));
        return { ...DEFAULT_CONFIG, ...c };
    }
    catch {
        return DEFAULT_CONFIG;
    }
}
async function saveConfig(c) {
    await ensureDirs();
    const merged = { ...(await loadConfig()), ...c };
    await promises_1.default.writeFile(exports.CONFIG_FILE, JSON.stringify(merged, null, 2), "utf8");
    return merged;
}
