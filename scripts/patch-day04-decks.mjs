#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__dirname, "..", "public");

const SLIDES_MAIN = `  <!-- SLIDE 1: TITLE -->
  <div class="slide active" data-slide="0">
    <div class="badge">Day 04 · From Idea to Working Product</div>
    <h1 class="hero">IDEA → <span class="or">CLICKABLE</span><br>MVP</h1>
    <div class="subtitle">// Part 1 · Frontend &amp; UI/UX (Julius) · Part 2 · Backend &amp; data (Deacon Gift) · <strong>3-hour build day</strong></div>
  </div>

  <!-- SLIDE 2: DELIVERABLE -->
  <div class="slide slide-mindset" data-slide="1">
    <div class="tag">North star</div>
    <h2 class="head">ONE SCREEN<br><span class="or">REAL DATA</span></h2>
    <ul class="bullets bullets-mindset">
      <li><span class="pip" aria-hidden="true"></span><div class="bullet-body"><p class="bullet-lead">Mandatory deliverable by end of class</p><p class="bullet-detail">Clickable frontend <strong>connected</strong> to basic backend logic — button saves, list updates, <strong>refresh still shows data</strong>.</p></div></li>
      <li><span class="pip" aria-hidden="true"></span><div class="bullet-body"><p class="bullet-lead">Scope knife</p><p class="bullet-detail"><strong>1 user · 1 primary action · 1 data entity</strong> — not the whole platform today.</p></div></li>
      <li><span class="pip" aria-hidden="true"></span><div class="bullet-body"><p class="bullet-lead">Stack</p><p class="bullet-detail"><code>index.html</code> + <code>app.js</code> + <code>localStorage</code> — no deploy required; open folder in Cursor.</p></div></li>
    </ul>
    <div class="big-q">Ask → spec → build → <span class="or">review</span> → iterate — same director mindset as Day 03.</div>
  </div>

  <!-- SLIDE 3: PART 1 UI -->
  <div class="slide" data-slide="2">
    <div class="tag">Part 1 · Frontend (90 min)</div>
    <h2 class="head">UI THAT<br><span class="or">USERS GET</span></h2>
    <div class="two-col">
      <div class="col-card new">
        <div class="col-lbl g">// Checklist</div>
        <ul>
          <li>One H1 + one primary CTA</li>
          <li>Mobile-first (phone width first)</li>
          <li>Trust line: what / for whom</li>
          <li>Max 3 sections: Hero · Main · Footer</li>
        </ul>
      </div>
      <div class="col-card old">
        <div class="col-lbl r">// Hooks for Part 2</div>
        <ul>
          <li><code>id="btn-primary"</code></li>
          <li>Input ids on every field</li>
          <li><code>id="list-root"</code></li>
          <li><code>id="insights-panel"</code></li>
          <li>Link <code>app.js</code> at bottom</li>
        </ul>
      </div>
    </div>
    <p class="callout-strip"><strong>Context:</strong> Reuse your QAF idea + Day 03 architecture Frontend section in your Cursor prompt.</p>
  </div>

  <!-- SLIDE 4: BUILD -->
  <div class="slide" data-slide="3">
    <div class="tag">Build now</div>
    <h2 class="head">GENERATE<br><span class="or">index.html</span></h2>
    <div class="steps">
      <div class="step"><span class="s-num">01</span><div class="s-body"><h3>New folder in Cursor</h3><p><code>qaf-[subgroup]-[name]-mvp</code> — open as project.</p></div></div>
      <div class="step"><span class="s-num">02</span><div class="s-body"><h3>5-pillar frontend prompt</h3><p>Role · Task · Context · Constraints · Format — <strong>single HTML file</strong>, no React.</p></div></div>
      <div class="step"><span class="s-num">03</span><div class="s-body"><h3>Two iterations (timed)</h3><p>A: clarity &amp; CTA · B: your specific user (labels, empty state).</p></div></div>
      <div class="step"><span class="s-num">04</span><div class="s-body"><h3>Stub app.js</h3><p>Primary button logs <em>Wire me in Part 2</em> — do not delete before break.</p></div></div>
    </div>
  </div>

  <!-- SLIDE 5: HANDOFF -->
  <div class="slide" data-slide="4">
    <div class="tag">Break handoff</div>
    <h2 class="head">HANDOFF<br><span class="or">CARD</span></h2>
    <ul class="checklist">
      <li><span class="chk-box" aria-hidden="true"></span>User + primary button action written down</li>
      <li><span class="chk-box" aria-hidden="true"></span>All hook ids present in HTML</li>
      <li><span class="chk-box" aria-hidden="true"></span>app.js linked; folder stays open</li>
    </ul>
    <p class="pillar-hint">Deacon wires save/load + insights — you keep the same folder.</p>
    <a href="/foundry/day04-backend" class="cta-main" style="text-decoration:none;display:inline-block">Part 2 slides →</a>
  </div>

  <!-- SLIDE 6: PART 2 PREVIEW -->
  <div class="slide" data-slide="5">
    <div class="tag">Part 2 · Backend (90 min)</div>
    <h2 class="head">DATA<br><span class="or">ENGINE</span></h2>
    <div class="score-grid score-grid--dual">
      <div class="s-card"><span class="s-pts">save</span><div class="s-title">localStorage</div><p class="s-desc">Array of records — load on start, save on click.</p></div>
      <div class="s-card"><span class="s-pts">insight</span><div class="s-title">Data-driven</div><p class="s-desc">Count, top 3, or simple stat in #insights-panel.</p></div>
    </div>
    <p class="grader-note">Demo: add 3 items → refresh → still there → explain what is stored.</p>
  </div>

  <!-- SLIDE 7: SUBMIT -->
  <div class="slide" data-slide="6">
    <div class="tag">Submit · Day 04</div>
    <h2 class="head">PROVE<br><span class="or">IT WORKS</span></h2>
    <ul class="checklist" id="missionChecklist">
      <li><label class="checklist-row"><input type="checkbox" class="checklist-cb" autocomplete="off"><span class="chk-text">Primary button saves and updates the list</span></label></li>
      <li><label class="checklist-row"><input type="checkbox" class="checklist-cb" autocomplete="off"><span class="chk-text">Refresh keeps data visible</span></label></li>
      <li><label class="checklist-row"><input type="checkbox" class="checklist-cb" autocomplete="off"><span class="chk-text">Ready to paste prompt + app.js + demo checklist</span></label></li>
    </ul>
    <button type="button" class="cta-main" onclick="void openPortal()">SUBMIT DAY 04 MVP ↓</button>
    <p class="cta-sub">// Graded: UI craft /10 + backend logic /10</p>
    <button type="button" class="cta-secondary" id="btnLastGrade" onclick="void viewLastGradeOnDevice()">See my last grade on this device</button>
  </div>
`;

const SLIDES_BACKEND = `  <div class="slide active" data-slide="0">
    <div class="badge">Day 04 · Part 2</div>
    <h1 class="hero">BACKEND<br><span class="or">&amp; DATA</span></h1>
    <div class="subtitle">// Deacon Gift · Wire <code>app.js</code> · localStorage · insights</div>
  </div>
  <div class="slide" data-slide="1">
    <div class="tag">Pattern</div>
    <h2 class="head">SAVE →<br><span class="or">RENDER</span></h2>
    <div class="steps">
      <div class="step"><span class="s-num">01</span><div class="s-body"><h3>loadData()</h3><p>Read JSON array from <code>localStorage</code> on page load.</p></div></div>
      <div class="step"><span class="s-num">02</span><div class="s-body"><h3>On primary click</h3><p>Validate → push record → saveData() → renderList().</p></div></div>
      <div class="step"><span class="s-num">03</span><div class="s-body"><h3>renderInsights()</h3><p>Count rows or group by one field — data-driven track.</p></div></div>
    </div>
  </div>
  <div class="slide" data-slide="2">
    <div class="tag">AI prompt</div>
    <h2 class="head">5 PILLARS<br><span class="or">app.js ONLY</span></h2>
    <p class="callout-strip">Do not let AI rewrite your HTML layout — <strong>implement app.js only</strong>.</p>
    <p class="pillar-hint">Role: junior backend engineer · Task: wire #btn-primary · Context: handoff card · Constraints: no frameworks · Format: full app.js</p>
  </div>
  <div class="slide" data-slide="3">
    <div class="tag">Demo</div>
    <h2 class="head">CLICK<br><span class="or">TEST</span></h2>
    <ul class="checklist">
      <li><span class="chk-box" aria-hidden="true"></span>Add 3 items via your UI</li>
      <li><span class="chk-box" aria-hidden="true"></span>Refresh — data persists</li>
      <li><span class="chk-box" aria-hidden="true"></span>Insights panel shows a stat</li>
    </ul>
    <a href="/foundry/day04" class="cta-secondary" style="text-decoration:none;display:inline-block;margin-top:12px">← Full day slides</a>
  </div>
  <div class="slide" data-slide="4">
    <div class="tag">Submit</div>
    <h2 class="head">HAND<br><span class="or">IN</span></h2>
    <button type="button" class="cta-main" onclick="void openPortal()">SUBMIT DAY 04 MVP ↓</button>
    <p class="cta-sub">Same portal as Part 1 · use ?assessment=your cohort slug</p>
  </div>
`;

function patchMain(file) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<title>[^<]*<\/title>/, "<title>Day 04 · From Idea to Working Product | Qubators AI Foundry</title>");
  html = html.replace(/AI FOUNDRY · DAY 03/g, "AI FOUNDRY · DAY 04");
  html = html.replace(/Day 03 · Qubators AI Foundry/g, "Day 04 · Build Day");
  html = html.replace(/Day 03 AI Builder/g, "Day 04 Build Day");
  html = html.replace(/'Day 03 · AI Builder \| Qubators AI Foundry'/g, "'Day 04 · Build Day | Qubators AI Foundry'");
  const m = html.match(/<!-- ══ SLIDES ══ -->[\s\S]*?<\/div><!-- \/deck -->/);
  if (!m) throw new Error("slides block not found in " + file);
  html = html.replace(m[0], "<!-- ══ SLIDES ══ -->\n<div class=\"deck\" role=\"region\" aria-label=\"Lesson slides\">\n\n" + SLIDES_MAIN + "\n</div><!-- /deck -->");
  html = html.replace(
    /const cats=\[[\s\S]*?\];/,
    `const cats=[
    {key:'prompt_quality',label:(location.pathname||'').indexOf('day04')>=0?'UI Craft':'Prompt Quality',max:10},
    {key:'architecture_viability',label:(location.pathname||'').indexOf('day04')>=0?'Backend Logic':'Architecture Logic',max:10},
  ];`,
  );
  html = html.replace(
    /const slide6=document\.querySelector\('\.slide\[data-slide="6"\]'\);/g,
    "const slide6=document.querySelector('.slide[data-slide=\"6\"]')||document.querySelector('.slide[data-slide=\"4\"]');",
  );
  html = html.replace(
    /const slide6r=document\.querySelector\('\.slide\[data-slide="6"\]'\);/g,
    "const slide6r=document.querySelector('.slide[data-slide=\"6\"]')||document.querySelector('.slide[data-slide=\"4\"]');",
  );
  fs.writeFileSync(file, html);
}

function patchBackend(file) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<title>[^<]*<\/title>/, "<title>Day 04 Part 2 · Backend | Qubators AI Foundry</title>");
  html = html.replace(/AI FOUNDRY · DAY 03/g, "DAY 04 · BACKEND");
  const m = html.match(/<!-- ══ SLIDES ══ -->[\s\S]*?<\/div><!-- \/deck -->/);
  if (!m) throw new Error("slides block not found in " + file);
  html = html.replace(m[0], "<!-- ══ SLIDES ══ -->\n<div class=\"deck\" role=\"region\" aria-label=\"Lesson slides\">\n\n" + SLIDES_BACKEND + "\n</div><!-- /deck -->");
  html = html.replace(
    /const cats=\[[\s\S]*?\];/,
    `const cats=[
    {key:'prompt_quality',label:'UI Craft',max:10},
    {key:'architecture_viability',label:'Backend Logic',max:10},
  ];`,
  );
  fs.writeFileSync(file, html);
}

patchMain(path.join(pub, "day04-build-day.html"));
patchBackend(path.join(pub, "day04-backend.html"));
console.log("Patched day04-build-day.html and day04-backend.html");
