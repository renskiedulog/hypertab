// Regenerates public/ads-rules.json from EasyList's ad-server list. Run: node script/build-ad-rules.mjs
// ponytail: plain "||domain^" lines only (network blocking); cosmetic rules and exceptions are ignored.
import { writeFileSync } from "node:fs";

const LIST = "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt";
const CHUNK = 5000; // domains per rule, keeps each rule a sane size

const res = await fetch(LIST);
if (!res.ok) throw new Error(`EasyList download failed: ${res.status}`);
const text = await res.text();
const any = [];
const thirdParty = [];
for (const line of text.split("\n")) {
  const m = line.trim().match(/^\|\|([a-z0-9.-]+)\^(\$third-party)?$/);
  if (m) (m[2] ? thirdParty : any).push(m[1]);
}

if (any.length + thirdParty.length === 0) throw new Error("No domains parsed; list format changed? Not overwriting.");

const rules = [];
const add = (domains, condition) => {
  for (let i = 0; i < domains.length; i += CHUNK)
    rules.push({
      id: rules.length + 1,
      priority: 1,
      action: { type: "block" },
      condition: { requestDomains: domains.slice(i, i + CHUNK), ...condition },
    });
};
add(any, {});
add(thirdParty, { domainType: "thirdParty" });

writeFileSync(new URL("../public/ads-rules.json", import.meta.url), JSON.stringify(rules));
console.log(`${any.length + thirdParty.length} domains -> ${rules.length} rules`);
