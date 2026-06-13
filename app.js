const REPO = "admlyz5858/remo";
const DATA_URL = "dashboard.json";
const SLOTS = { facts: [9, 15], money: [11, 17] };
let DATA = null, TAB = "queue";

function nextSlotIso(videos, mode, nowMs) {
  const slots = SLOTS[mode] || [9, 15];
  const sched = (videos || []).filter((v) => v.mode === mode && v.publish_at).map((v) => Date.parse(v.publish_at)).filter((n) => !isNaN(n));
  let after = nowMs; if (sched.length) after = Math.max(after, Math.max(...sched));
  const d = new Date(after);
  for (let day = 0; day < 14; day++) for (const h of slots) {
    const c = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + day, h, 0, 0);
    if (c > after) return new Date(c).toISOString();
  }
  return new Date(after + 3600000).toISOString();
}

function fmt(iso) { return iso ? new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : ""; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function render() {
  if (!DATA) return;
  const m = DATA.metrics, ch = DATA.channels;
  document.getElementById("status").textContent = "🟢 " + fmt(DATA.updated_at);
  document.getElementById("metrics").innerHTML = [
    ["Zamanlı", m.scheduled], ["Bugün", m.today], ["Yayında", m.published], ["İzlenme", (m.total_views || 0).toLocaleString("tr-TR")],
  ].map(([k, v]) => `<div class="bg-zinc-900 rounded-xl p-3"><div class="text-xs text-zinc-400">${k}</div><div class="text-xl font-extrabold">${v}</div></div>`).join("");
  document.getElementById("channels").innerHTML = Object.entries(ch).map(([mode, c]) => {
    const vids = DATA.videos.filter((v) => v.mode === mode);
    const views = vids.reduce((a, v) => a + (v.views || 0), 0);
    return `<a href="https://youtube.com/${c.handle}" target="_blank" class="rounded-xl p-3 block" style="background:${c.accent}22;border:1px solid ${c.accent}66">
      <div class="font-extrabold" style="color:${c.accent}">${c.name}</div>
      <div class="text-xs text-zinc-400">${c.niche}</div>
      <div class="text-sm mt-1">${vids.length} video · ${views.toLocaleString("tr-TR")} izlenme</div></a>`;
  }).join("");

  const vids = DATA.videos.filter((v) => TAB === "queue" ? (v.status === "scheduled" || v.status === "pending") : v.status === "published")
    .sort((a, b) => TAB === "queue" ? (Date.parse(a.publish_at || 0) - Date.parse(b.publish_at || 0)) : ((b.views || 0) - (a.views || 0)));
  document.getElementById("list").innerHTML = vids.map((v) => {
    const c = DATA.channels[v.mode] || {};
    const right = TAB === "queue"
      ? `<span class="badge s-${v.status}">${v.status}</span> <span class="text-xs text-zinc-400">⏰ ${fmt(v.publish_at)}</span>`
      : `<span class="text-xs">▶ ${(v.views || 0).toLocaleString("tr-TR")} · 👍 ${v.likes || 0}</span>`;
    return `<div class="bg-zinc-900 rounded-xl p-3 flex gap-3 items-center">
      <img src="${esc(v.thumbnail)}" class="w-20 h-12 object-cover rounded" onerror="this.style.visibility='hidden'"/>
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">${esc(v.topic || v.video_id)}</div>
        <div class="text-xs" style="color:${c.accent || '#aaa'}">${esc(c.name || v.mode)}</div>
        <div class="mt-1">${right} <a href="${esc(v.url)}" target="_blank" class="text-xs text-sky-400 ml-2">aç</a></div>
      </div></div>`;
  }).join("") || `<div class="text-zinc-500 text-sm">Liste boş.</div>`;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === TAB));
}

async function load() {
  try {
    const r = await fetch(DATA_URL + "?t=" + Date.now());
    if (!r.ok) throw new Error(r.status);
    DATA = await r.json(); render();
  } catch (e) {
    document.getElementById("status").textContent = "🔴 bağlanıyor… birazdan tekrar";
  }
}

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => { TAB = t.dataset.tab; render(); }));
document.getElementById("settings").addEventListener("click", () => {
  const cur = localStorage.getItem("ghpat") || "";
  const v = prompt("GitHub PAT (remo Actions write). Sadece tarayıcında saklanır:", cur);
  if (v !== null) localStorage.setItem("ghpat", v.trim());
});
document.getElementById("produce").addEventListener("click", async () => {
  const pat = localStorage.getItem("ghpat");
  const msg = document.getElementById("produceMsg");
  if (!pat) { msg.textContent = "Önce ⚙️ ile token gir."; return; }
  const mode = document.querySelector('input[name=ch]:checked').value;
  const topic = document.getElementById("topic").value.trim();
  const publish_at = nextSlotIso(DATA ? DATA.videos : [], mode, Date.now());
  msg.textContent = "tetikleniyor…";
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/produce.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: "Bearer " + pat, Accept: "application/vnd.github+json" },
      body: JSON.stringify({ ref: "master", inputs: { mode, topic, publish_at } }),
    });
    if (r.status === 204) msg.textContent = `✅ Üretiliyor (${mode}) → ${fmt(publish_at)} slotuna planlanacak. ~8 dk.`;
    else msg.textContent = "❌ Hata: " + r.status + " (token yetkisi?)";
  } catch (e) { msg.textContent = "❌ " + e.message; }
});

load();
setInterval(load, 60000);
