#!/usr/bin/env node
/**
 * 同步博客文章快照 → jianjie/data/posts.json
 *
 * 背景：主页 2 的「最新文章」卡片读的是本地快照 jianjie/data/posts.json，
 * 而不是直接抓博客的 atom.xml。原因是博客站点没有开放 CORS
 * （实测 atom.xml / rss.xml 响应里都没有 Access-Control-Allow-Origin），
 * 浏览器从 muyudada.github.io 跨域抓 muyudada.dpdns.org 会被拦掉。
 *
 * 所以这里做「构建期快照」：由 GitHub Actions 定时跑本脚本，把 atom.xml
 * 解析成 JSON 落进仓库，页面再同源读取，既没有 CORS 问题也不用每次访问
 * 都下载 1.2MB 的 XML。
 *
 * 用法：
 *   node tools/sync-posts.mjs          # 拉取并写入快照
 *   node tools/sync-posts.mjs --check  # 只检查是否需要更新（有变化则退出码 1）
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "jianjie", "data", "posts.json");

const FEED_URL = "https://muyudada.dpdns.org/atom.xml";
const HOME = "https://muyudada.dpdns.org/";
const CHECK_ONLY = process.argv.includes("--check");

/** 解析 XML 里常见的实体与数字引用 */
function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 取第一个匹配到的捕获组 */
function pick(block, re) {
  const m = block.match(re);
  return m ? decodeEntities(m[1].trim()) : "";
}

function parseFeed(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries
    .map((block) => {
      // 优先用 link rel="alternate"，没有就退回 <id>
      const linkMatch = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/);
      const url = linkMatch ? decodeEntities(linkMatch[1].trim()) : pick(block, /<id>([\s\S]*?)<\/id>/);
      const title = pick(block, /<title[^>]*>([\s\S]*?)<\/title>/);
      // published 缺失时退回 updated
      const date = pick(block, /<published>([\s\S]*?)<\/published>/) ||
        pick(block, /<updated>([\s\S]*?)<\/updated>/);
      return { title, url, date };
    })
    .filter((item) => item.title && item.url);
}

/** 按日期倒序；同日保持 feed 原有顺序（Array#sort 在现代 V8 里是稳定的） */
function sortByDateDesc(items) {
  return items.slice().sort((a, b) => {
    const ta = Date.parse(a.date) || 0;
    const tb = Date.parse(b.date) || 0;
    return tb - ta;
  });
}

function buildSnapshot(items) {
  // 与旧快照保持同样的字段形状（rss.js 只读 items，其余字段留给人工排查）
  return {
    generated: new Date().toISOString().slice(0, 19),
    feed: FEED_URL,
    home: HOME,
    title: "Muyuの小窝",
    items,
  };
}

function readExisting() {
  if (!existsSync(OUT)) return null;
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return null;
  }
}

async function fetchFeed() {
  // 这个站偶尔会抽风（连接被重置 / 超时），一次失败就整体失败会让定时任务白跑，
  // 所以重试几次。指数退避，总共最多约 2 分钟。
  const attempts = 4;
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(FEED_URL, {
        headers: { "User-Agent": "muyu-posts-sync" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      if (!xml || xml.length < 100) throw new Error(`响应过短（${xml.length} 字节）`);
      clearTimeout(timer);
      return xml;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const detail = err.cause && err.cause.code ? ` (${err.cause.code})` : "";
      console.warn(`第 ${i}/${attempts} 次拉取失败：${err.message}${detail}`);
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 3000 * i));
      }
    }
  }
  throw new Error(`拉取 atom.xml 连续失败 ${attempts} 次：${lastErr.message}`);
}

async function main() {
  const xml = await fetchFeed();

  const items = sortByDateDesc(parseFeed(xml));
  if (items.length === 0) {
    throw new Error("atom.xml 里没解析出任何文章，中止以免把快照清空。");
  }

  const next = buildSnapshot(items);
  const prev = readExisting();

  // 只比 items：generated 每次都变，不该因此触发提交
  const changed = !prev || JSON.stringify(prev.items) !== JSON.stringify(next.items);

  if (CHECK_ONLY) {
    console.log(changed ? "快照需要更新。" : "快照已是最新。");
    process.exit(changed ? 1 : 0);
  }

  if (!changed) {
    console.log(`快照已是最新（${items.length} 篇），不重写文件。`);
    return;
  }

  const before = prev ? prev.items.length : 0;
  writeFileSync(OUT, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log(`已更新快照：${before} 篇 → ${items.length} 篇`);
  console.log("最新三篇：");
  items.slice(0, 3).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.date.slice(0, 10)} | ${p.title}`);
  });
}

main().catch((err) => {
  console.error("同步失败：", err.message);
  process.exit(1);
});
