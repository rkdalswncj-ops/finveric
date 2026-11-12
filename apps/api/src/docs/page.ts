// GET /api/docs: 사람이 읽는 API 문서. HTML·CSS·JS를 한 응답에 넣는다(외부 파일·CDN 없음).
// Vercel 함수 번들(esbuild CJS)에 문자열로 들어간다. 디스크에서 파일을 읽지 않는다.
// 화면은 /api/openapi.json을 읽어 그린다. 색, 글자 크기, 반경은 DESIGN.md 토큰(packages/ui/src/theme.css)과 같다.

const STYLE = `
:root {
  color-scheme: light;
  --background: #fafafa;
  --card: #ffffff;
  --foreground: #191f28;
  --muted-foreground: #4e5968;
  --muted: #f2f4f6;
  --border: #e5e8eb;
  --input: #6b7684;
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --primary-hover: #1d4ed8;
  --primary-surface: #edf3ff;
  --ring: #1d4ed8;
  --success: #116149;
  --success-surface: #eaf6ef;
  --warning: #7a4900;
  --warning-surface: #fff3d7;
  --destructive: #a32535;
  --destructive-surface: #fff1f1;
  --rounded-control: 8px;
  --rounded-surface: 12px;
  /* 글자 크기와 줄 높이. packages/ui/src/theme.css의 --type-* 값과 같다. 이 화면은 그 파일을 가져올 수 없어 값을 옮겨 둔다. */
  --type-caption: 0.75rem;
  --type-ui: 0.8125rem;
  --type-detail: 0.875rem;
  --type-body: 0.9375rem;
  --type-body-lg: 1rem;
  --type-heading: 1.125rem;
  --type-title: 1.25rem;
  --type-title-lg: 1.5rem;
  --type-page: 1.75rem;
  --type-line-heading: 1.3;
  --type-line-body: 1.6;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  font-synthesis-style: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
* { box-sizing: border-box; }
html { scroll-padding-top: 16px; }
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-size: var(--type-body);
  line-height: var(--type-line-body);
  word-break: keep-all;
  overflow-wrap: break-word;
}
h1, h2, h3, h4, p, ul, dl, dd, pre { margin: 0; }
h1, h2, h3, h4 {
  line-height: var(--type-line-heading);
  letter-spacing: -0.01em;
  font-weight: 700;
  text-wrap: balance;
}
p { text-wrap: pretty; }
a { color: var(--primary); text-underline-offset: 3px; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; border-radius: 4px; }
code, pre { font-family: var(--mono); font-size: var(--type-detail); }
p code, li code, dd code {
  background: var(--muted);
  border-radius: 4px;
  padding: 1px 5px;
  overflow-wrap: anywhere;
}
.skip {
  position: absolute;
  left: 16px;
  top: -48px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--rounded-control);
  padding: 8px 12px;
  z-index: 10;
}
.skip:focus { top: 16px; }

.layout { display: grid; grid-template-columns: minmax(0, 1fr); min-height: 100vh; }
.nav {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 20px 16px;
}
.brand { display: flex; align-items: baseline; gap: 8px; color: var(--foreground); text-decoration: none; }
.brand strong { font-size: var(--type-heading); font-weight: 800; letter-spacing: -0.01em; }
.brand span { color: var(--muted-foreground); font-size: var(--type-detail); }
.toc { margin-top: 16px; }
.toc > summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  list-style: none;
  font-weight: 600;
  border: 1px solid var(--border);
  border-radius: var(--rounded-control);
  padding: 0 14px;
}
.toc > summary::-webkit-details-marker { display: none; }
.toc > summary::after {
  content: "";
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--muted-foreground);
  border-bottom: 2px solid var(--muted-foreground);
  transform: translateY(-2px) rotate(45deg);
}
.toc[open] > summary::after { transform: translateY(2px) rotate(-135deg); }
.toc-body { padding-top: 12px; display: grid; gap: 20px; }
.toc-title {
  font-size: var(--type-ui);
  font-weight: 600;
  color: var(--muted-foreground);
  letter-spacing: 0;
  margin-bottom: 6px;
}
.toc-group ul { list-style: none; padding: 0; display: grid; gap: 2px; }
.toc-group a {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 4px 8px;
  border-radius: var(--rounded-control);
  color: var(--foreground);
  text-decoration: none;
  font-size: var(--type-detail);
}
.toc-group .method { min-width: 44px; text-align: center; }

main { width: 100%; max-width: 960px; padding: 32px 16px 80px; }
main:focus { outline: none; }
.eyebrow { color: var(--muted-foreground); font-size: var(--type-detail); font-weight: 600; }
h1 { font-size: var(--type-page); letter-spacing: -0.02em; margin-top: 4px; }
.lead { margin-top: 12px; color: var(--muted-foreground); max-width: 72ch; }
.facts {
  margin-top: 24px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--rounded-surface);
  overflow: hidden;
}
.facts div { background: var(--card); padding: 12px 16px; min-width: 0; }
.facts dt { font-size: var(--type-ui); color: var(--muted-foreground); }
.facts dd { font-family: var(--mono); font-size: var(--type-detail); overflow-wrap: anywhere; }

.intro { margin-top: 32px; display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
.intro section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--rounded-surface);
  padding: 20px;
  min-width: 0;
}
.intro h2 { font-size: var(--type-title); margin-bottom: 8px; }
.intro p, .errors li { max-width: 72ch; }
.intro p + p, .intro p + ul, .intro ul + p { margin-top: 8px; }
.intro ul { padding-left: 20px; display: grid; gap: 4px; }

.status-line { margin-top: 32px; color: var(--muted-foreground); }
.status-line.error {
  color: var(--destructive);
  background: var(--destructive-surface);
  border-radius: var(--rounded-control);
  padding: 12px 16px;
}

.tag { margin-top: 56px; }
.tag > h2 { font-size: var(--type-title-lg); letter-spacing: -0.02em; }
.tag > p { margin-top: 6px; color: var(--muted-foreground); max-width: 72ch; }
.op {
  margin-top: 20px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--rounded-surface);
  padding: 20px 16px;
  min-width: 0;
}
.op-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.path { font-size: var(--type-body); font-weight: 600; overflow-wrap: anywhere; min-width: 0; }
.op h3 { font-size: var(--type-heading); margin-top: 10px; }
.op h3 a { color: inherit; text-decoration: none; }
.op .desc { margin-top: 6px; max-width: 72ch; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 12px; font-size: var(--type-ui); color: var(--muted-foreground); }
.meta div { display: flex; gap: 6px; align-items: center; min-width: 0; }
.meta dd code { font-size: var(--type-ui); }
.block { margin-top: 20px; }
.block > h4 { font-size: var(--type-detail); color: var(--muted-foreground); font-weight: 600; margin-bottom: 8px; }

/* 메서드는 종류다. 상태 색(성공·주의)을 쓰지 않고 두 메서드 모두 파란 안내 색이다. */
.method {
  display: inline-block;
  font: 600 var(--type-caption)/1 var(--mono);
  padding: 5px 8px;
  border-radius: 5px;
  background: var(--primary-surface);
  color: var(--primary);
}
/* 필수·선택과 인증 표시는 종류다. 중립 배지에 굵기로만 구분한다. */
.badge {
  display: inline-block;
  font-size: var(--type-caption);
  line-height: 1;
  padding: 4px 6px;
  border-radius: 5px;
  background: var(--muted);
  color: var(--muted-foreground);
  white-space: nowrap;
}
.badge.req { color: var(--foreground); font-weight: 600; }
/* 응답 상태 코드는 실제 상태다. 성공·주의·실패 색을 쓴다. */
.code-status { font: 600 var(--type-ui)/1 var(--mono); padding: 4px 6px; border-radius: 5px; }
.code-status.ok { background: var(--success-surface); color: var(--success); }
.code-status.client { background: var(--warning-surface); color: var(--warning); }
.code-status.server { background: var(--destructive-surface); color: var(--destructive); }

.fields { list-style: none; padding: 0; border-top: 1px solid var(--border); }
.field { padding: 10px 0; border-bottom: 1px solid var(--border); min-width: 0; }
.field-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.field-name { font-weight: 600; overflow-wrap: anywhere; background: none; padding: 0; }
.type { font-family: var(--mono); font-size: var(--type-ui); color: var(--muted-foreground); overflow-wrap: anywhere; }
.field-desc { margin-top: 4px; font-size: var(--type-detail); }
.rules { margin-top: 4px; font-size: var(--type-ui); color: var(--muted-foreground); display: grid; gap: 2px; }
.rules code { font-size: var(--type-caption); }
.nested { margin-top: 8px; }
.nested > summary {
  cursor: pointer;
  font-size: var(--type-ui);
  color: var(--primary);
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}
.nested > :not(summary) { margin-left: 12px; padding-left: 12px; border-left: 2px solid var(--muted); }
.note { font-size: var(--type-detail); color: var(--muted-foreground); }
.alt + .alt { margin-top: 16px; }
.alt-name { font-family: var(--mono); font-size: var(--type-ui); font-weight: 600; margin: 8px 0 4px; }

.response + .response { margin-top: 16px; }
.response-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.response-head .media { font-family: var(--mono); font-size: var(--type-ui); color: var(--muted-foreground); }
.errors { list-style: none; padding: 0; display: grid; gap: 8px; }
.errors li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; align-items: start; font-size: var(--type-detail); }

.example-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.example-head h4 { font-size: var(--type-detail); color: var(--muted-foreground); font-weight: 600; }
.example pre {
  background: var(--muted);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--rounded-control);
  padding: 14px 16px;
  overflow-x: auto;
  max-height: 420px;
  line-height: 1.5;
  font-size: var(--type-ui);
}
.copy {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--input);
  border-radius: var(--rounded-control);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: var(--type-detail);
  cursor: pointer;
}
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
/* 마우스가 있는 기기에서만 hover를 쓴다. 터치 뒤에 hover가 남지 않는다. */
@media (hover: hover) {
  a:hover { color: var(--primary-hover); }
  .toc-group a:hover { background: var(--muted); }
  .op h3 a:hover { text-decoration: underline; }
  .copy:hover { background: var(--muted); }
}

@media (min-width: 768px) {
  main { padding: 40px 40px 96px; }
  .facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .intro { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .intro section.wide { grid-column: 1 / -1; }
  .op { padding: 24px; }
}
@media (min-width: 1024px) {
  .layout { grid-template-columns: 288px minmax(0, 1fr); }
  .nav {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    border-bottom: 0;
    border-right: 1px solid var(--border);
    padding: 28px 16px;
  }
  .toc > summary { display: none; }
  .toc-body { padding-top: 0; }
  main { padding: 48px 56px 120px; }
}
`;

// 문자열 안의 스크립트. 템플릿 리터럴 문법(백틱, 달러+중괄호)은 쓰지 않는다.
const SCRIPT = String.raw`
(function () {
  "use strict";
  var TICK = String.fromCharCode(96);
  var statusLine = document.getElementById("status");
  var live = document.getElementById("live");

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs)
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "class") el.className = value;
        else el.setAttribute(key, value === true ? "" : String(value));
      });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) return child.forEach(function (c) { add(el, c); });
    el.appendChild(typeof child === "string" || typeof child === "number"
      ? document.createTextNode(String(child)) : child);
  }
  // 백틱으로 감싼 부분만 code로 바꾼다. 나머지는 글자 그대로 넣는다.
  function inline(text) {
    return String(text).split(TICK).map(function (part, i) {
      return i % 2 ? h("code", null, part) : part;
    }).filter(function (part) { return part !== ""; });
  }
  function blocks(markdown) {
    return String(markdown || "").split(/\n\n+/).map(function (block) {
      if (/^- /.test(block))
        return h("ul", null, block.split("\n").map(function (line) {
          return h("li", null, inline(line.replace(/^- /, "")));
        }));
      return h("p", null, inline(block));
    });
  }
  // "### 제목"으로 나눈 묶음. 첫 묶음은 제목이 없다.
  function sections(markdown) {
    var groups = [{ title: "", text: [] }];
    String(markdown || "").split(/\n\n+/).forEach(function (block) {
      if (block.indexOf("### ") === 0) groups.push({ title: block.slice(4), text: [] });
      else groups[groups.length - 1].text.push(block);
    });
    return groups.map(function (g) { return { title: g.title, text: g.text.join("\n\n") }; });
  }

  function pointer(spec, ref) {
    return ref.replace(/^#\//, "").split("/").reduce(function (node, key) {
      return node ? node[key.replace(/~1/g, "/").replace(/~0/g, "~")] : undefined;
    }, spec);
  }
  function resolve(spec, node) {
    for (var i = 0; node && node.$ref && i < 10; i++) node = pointer(spec, node.$ref);
    return node;
  }
  function refName(ref) { return ref.split("/").pop(); }

  function typeLabel(spec, s) {
    if (!s) return "임의 JSON";
    if (s.$ref) return refName(s.$ref);
    if (s.oneOf) return s.oneOf.map(function (x) { return typeLabel(spec, x); }).join(" | ");
    if (s.const !== undefined) return JSON.stringify(s.const);
    if (s.enum) return "enum";
    if (s.type === "array") return typeLabel(spec, s.items) + "[]";
    if (Array.isArray(s.type)) return s.type.join(" | ");
    return s.type || "임의 JSON";
  }
  function range(min, max, unit) {
    if (min === undefined && max === undefined) return null;
    if (min !== undefined && max !== undefined)
      return min === max ? min + unit : min + "–" + max + unit;
    return min !== undefined ? min + unit + " 이상" : max + unit + " 이하";
  }
  function rules(s) {
    var out = [];
    if (!s) return out;
    if (s.enum) out.push(["값", s.enum.map(function (v) { return JSON.stringify(v); }).join(", ")]);
    if (s.pattern) out.push(["형식", s.pattern]);
    if (s.format) out.push(["형식", s.format]);
    var r = range(s.minimum, s.maximum, "");
    if (r) out.push(["범위", r]);
    var l = range(s.minLength, s.maxLength, "자");
    if (l) out.push(["길이", l]);
    var n = range(s.minItems, s.maxItems, "개");
    if (n) out.push(["항목 수", n]);
    return out;
  }
  function rulesView(spec, s) {
    var list = rules(s);
    if (s && s.type === "array") {
      var items = resolve(spec, s.items);
      if (items && !items.properties)
        rules(items).forEach(function (rule) { list.push(["항목 " + rule[0], rule[1]]); });
    }
    if (!list.length) return null;
    return h("div", { class: "rules" }, list.map(function (rule) {
      return h("div", null, rule[0] + ": ", h("code", null, rule[1]));
    }));
  }

  function hasFields(spec, s) {
    var t = resolve(spec, s);
    if (!t) return false;
    if (t.properties || t.oneOf) return true;
    return t.type === "array" && hasFields(spec, t.items);
  }
  function schemaView(spec, schema, seen) {
    var name = schema && schema.$ref ? refName(schema.$ref) : null;
    if (name) {
      if (seen.indexOf(name) >= 0) return h("p", { class: "note" }, name + "와 같습니다.");
      seen = seen.concat(name);
    }
    var s = resolve(spec, schema);
    if (!s) return null;
    if (s.oneOf)
      return h("div", null,
        h("p", { class: "note" }, "다음 가운데 하나입니다."),
        s.oneOf.map(function (alt) {
          return h("div", { class: "alt" },
            h("p", { class: "alt-name" }, typeLabel(spec, alt)),
            schemaView(spec, alt, seen));
        }));
    if (s.type === "array") {
      if (hasFields(spec, s.items))
        return h("div", null,
          h("p", { class: "note" }, typeLabel(spec, s.items) + " 배열입니다. 항목 필드:"),
          schemaView(spec, s.items, seen));
      return h("div", null, h("p", { class: "note" }, typeLabel(spec, s) + " 배열입니다."), rulesView(spec, s));
    }
    if (s.properties) return fields(spec, s, seen);
    return h("div", null,
      h("p", { class: "note" }, typeLabel(spec, s) + (s.description ? " · " + s.description : "")),
      rulesView(spec, s));
  }
  function fields(spec, s, seen) {
    var required = s.required || [];
    return h("ul", { class: "fields" }, Object.keys(s.properties).map(function (key) {
      var prop = s.properties[key];
      var target = resolve(spec, prop) || {};
      var description = prop.description || target.description;
      var must = required.indexOf(key) >= 0;
      return h("li", { class: "field" },
        h("div", { class: "field-head" },
          h("code", { class: "field-name" }, key),
          h("span", { class: "type" }, typeLabel(spec, prop)),
          h("span", { class: must ? "badge req" : "badge" }, must ? "필수" : "선택")),
        description ? h("p", { class: "field-desc" }, inline(description)) : null,
        rulesView(spec, target),
        hasFields(spec, prop)
          ? h("details", { class: "nested" },
              h("summary", null, typeLabel(spec, prop) + " 필드 보기"),
              schemaView(spec, prop, seen))
          : null);
    }));
  }

  function media(response) {
    var content = response && response.content;
    if (!content) return null;
    var type = Object.keys(content)[0];
    return { type: type, schema: content[type].schema, example: content[type].example };
  }
  function statusClass(code) {
    var n = Number(code);
    return n < 300 ? "ok" : n < 500 ? "client" : "server";
  }
  function responsesView(spec, op) {
    var success = [];
    var other = [];
    Object.keys(op.responses || {}).forEach(function (code) {
      var response = resolve(spec, op.responses[code]);
      var body = media(response);
      if (Number(code) < 300) {
        success.push(h("div", { class: "response" },
          h("div", { class: "response-head" },
            h("span", { class: "code-status ok" }, code),
            h("span", null, response.description),
            body ? h("span", { class: "media" }, body.type) : null),
          body ? schemaView(spec, body.schema, []) : null));
      } else {
        other.push(h("li", null,
          h("span", { class: "code-status " + statusClass(code) }, code),
          h("span", null, inline(response.description))));
      }
    });
    return [
      h("div", { class: "block" }, h("h4", null, "응답"), success),
      other.length ? h("div", { class: "block" }, h("h4", null, "오류 응답"), h("ul", { class: "errors" }, other)) : null,
    ];
  }

  // 좁은 화면에서 경로를 "/" 뒤에서 줄바꿈한다.
  function pathParts(path) {
    return path.split("/").map(function (part, i) {
      return i ? [h("wbr"), "/" + part] : part;
    });
  }
  function shellQuote(text) { return "'" + String(text).replace(/'/g, "'\\''") + "'"; }
  function curl(base, path, method, op) {
    var params = op.parameters || [];
    var url = base + path.replace(/\{(\w+)\}/g, function (_, name) {
      var p = params.filter(function (x) { return x.name === name; })[0];
      return encodeURIComponent(p && p.example !== undefined ? p.example : name);
    });
    var lines = ["curl" + (method === "get" ? "" : " -X " + method.toUpperCase()) + " " + shellQuote(url)];
    if (op.security && op.security.length) lines.push('  -H "Authorization: Bearer $FINVERIC_TOKEN"');
    var body = op.requestBody && media(op.requestBody);
    if (body) {
      lines.push("  -H 'Content-Type: application/json'");
      lines.push("  -d " + shellQuote(JSON.stringify(body.example === undefined ? {} : body.example, null, 2)));
    } else if (method === "post") {
      lines.push("  -H 'Content-Type: application/json'");
      lines.push("  -d '{}'");
    }
    return lines.join(" \\\n");
  }
  function copyButton(text, label) {
    var button = h("button", { type: "button", class: "copy", "aria-label": label + " 복사" }, "복사");
    button.addEventListener("click", function () {
      var done = function () {
        button.textContent = "복사했습니다";
        live.textContent = label + "를 복사했습니다.";
        setTimeout(function () { button.textContent = "복사"; }, 1500);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {
        live.textContent = "복사하지 못했습니다. 직접 선택해 복사하세요.";
      });
    });
    return button;
  }

  function operationView(spec, base, path, method, op) {
    var id = "op-" + (op.operationId || method + path);
    var open = !op.security || op.security.length === 0;
    var keyed = !open && op.security.some(function (s) { return "apiKey" in s; });
    var params = op.parameters || [];
    var body = op.requestBody && media(op.requestBody);
    var example = curl(base, path, method, op);
    return h("section", { class: "op", id: id, "aria-labelledby": id + "-title" },
      h("div", { class: "op-head" },
        h("span", { class: "method " + method }, method.toUpperCase()),
        h("code", { class: "path" }, pathParts(path))),
      h("h3", { id: id + "-title" }, h("a", { href: "#" + id }, op.summary || path)),
      op.description ? h("p", { class: "desc" }, inline(op.description)) : null,
      h("dl", { class: "meta" },
        h("div", null, h("dt", null, "인증"),
          h("dd", null, h("span", { class: open ? "badge open" : "badge lock" }, open ? "공개" : keyed ? "접근 코드 · API 키" : "접근 코드"))),
        h("div", null, h("dt", null, "operationId"), h("dd", null, h("code", null, op.operationId)))),
      params.length
        ? h("div", { class: "block" }, h("h4", null, "경로 값"),
            h("ul", { class: "fields" }, params.map(function (p) {
              return h("li", { class: "field" },
                h("div", { class: "field-head" },
                  h("code", { class: "field-name" }, p.name),
                  h("span", { class: "type" }, typeLabel(spec, p.schema)),
                  h("span", { class: p.required ? "badge req" : "badge" }, p.required ? "필수" : "선택")),
                p.description ? h("p", { class: "field-desc" }, inline(p.description)) : null,
                rulesView(spec, p.schema),
                p.example !== undefined ? h("div", { class: "rules" }, h("div", null, "예: ", h("code", null, String(p.example)))) : null);
            })))
        : null,
      body
        ? h("div", { class: "block" }, h("h4", null, "요청 본문 · " + body.type), schemaView(spec, body.schema, []))
        : null,
      responsesView(spec, op),
      h("div", { class: "block example" },
        h("div", { class: "example-head" }, h("h4", null, "요청 예시"), copyButton(example, "요청 예시")),
        // 긴 예시는 가로로 스크롤한다. 키보드로 초점을 옮겨 화살표로 스크롤할 수 있게 한다.
        h("pre", { tabindex: "0", "aria-label": "요청 예시" }, h("code", null, example))));
  }

  function render(spec) {
    var base = new URL((spec.servers && spec.servers[0] && spec.servers[0].url) || "/", location.href).href.replace(/\/$/, "");
    var info = spec.info || {};
    var parts = sections(info.description);
    document.getElementById("lead").replaceChildren.apply(document.getElementById("lead"), inline(parts[0].text));
    document.getElementById("base").textContent = base;
    document.getElementById("version").textContent = "OpenAPI " + spec.openapi + " · " + (info.version || "");
    document.getElementById("intro").replaceChildren.apply(document.getElementById("intro"),
      parts.slice(1).map(function (part) {
        return h("section", { class: part.title === "오류" ? "wide" : null },
          h("h2", null, part.title), blocks(part.text));
      }));

    var tags = (spec.tags || []).map(function (tag) { return { tag: tag, ops: [] }; });
    Object.keys(spec.paths || {}).forEach(function (path) {
      Object.keys(spec.paths[path]).forEach(function (method) {
        var op = spec.paths[path][method];
        var name = (op.tags || [])[0];
        var group = tags.filter(function (g) { return g.tag.name === name; })[0];
        if (!group) { group = { tag: { name: name || "기타" }, ops: [] }; tags.push(group); }
        group.ops.push({ path: path, method: method, op: op });
      });
    });
    tags = tags.filter(function (g) { return g.ops.length; });

    document.getElementById("toc").replaceChildren.apply(document.getElementById("toc"), tags.map(function (g, i) {
      return h("div", { class: "toc-group" },
        h("p", { class: "toc-title", id: "toc-" + i }, g.tag.name),
        h("ul", { "aria-labelledby": "toc-" + i }, g.ops.map(function (item) {
          return h("li", null, h("a", { href: "#op-" + item.op.operationId },
            h("span", { class: "method " + item.method }, item.method.toUpperCase()),
            h("span", null, item.op.summary)));
        })));
    }));
    document.getElementById("operations").replaceChildren.apply(document.getElementById("operations"), tags.map(function (g, i) {
      return h("section", { class: "tag", "aria-labelledby": "tag-" + i },
        h("h2", { id: "tag-" + i }, g.tag.name),
        g.tag.description ? h("p", null, inline(g.tag.description)) : null,
        g.ops.map(function (item) { return operationView(spec, base, item.path, item.method, item.op); }));
    }));
    statusLine.hidden = true;
    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  var toc = document.getElementById("toc-wrap");
  var wide = window.matchMedia("(min-width: 1024px)");
  toc.open = wide.matches;
  wide.addEventListener("change", function (e) { if (e.matches) toc.open = true; });
  document.getElementById("toc").addEventListener("click", function (e) {
    if (!wide.matches && e.target.closest && e.target.closest("a")) toc.open = false;
  });

  fetch("openapi.json", { headers: { Accept: "application/json" } })
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(render)
    .catch(function () {
      statusLine.className = "status-line error";
      statusLine.replaceChildren("API 문서를 불러오지 못했습니다. ",
        h("a", { href: "openapi.json" }, "/api/openapi.json"), " 응답을 확인하세요.");
    });
})();
`;

/** GET /api/docs 응답 본문. */
export const DOCS_PAGE = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FINVERIC API 문서</title>
<meta name="description" content="FINVERIC 판매 기록 검증 API 참조 문서">
<style>${STYLE}</style>
</head>
<body>
<a class="skip" href="#main">본문으로 이동</a>
<div class="layout">
  <aside class="nav" aria-label="API 목차">
    <a class="brand" href="#main"><strong>FINVERIC</strong><span>API 문서</span></a>
    <details class="toc" id="toc-wrap" open>
      <summary>목차</summary>
      <nav class="toc-body" id="toc" aria-label="경로 목록"></nav>
    </details>
  </aside>
  <main id="main" tabindex="-1">
    <header>
      <p class="eyebrow">판매 기록 검증</p>
      <h1>FINVERIC API</h1>
      <p class="lead" id="lead">증권사 앱과 판매사 콘솔이 쓰는 API입니다.</p>
      <dl class="facts">
        <div><dt>기본 주소</dt><dd id="base">—</dd></div>
        <div><dt>명세</dt><dd><a href="openapi.json">/api/openapi.json</a></dd></div>
        <div><dt>버전</dt><dd id="version">—</dd></div>
      </dl>
    </header>
    <div class="intro" id="intro"></div>
    <p class="status-line" id="status" role="status">API 문서를 불러오고 있습니다.</p>
    <div id="operations"></div>
    <p class="sr-only" id="live" aria-live="polite"></p>
  </main>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`;
