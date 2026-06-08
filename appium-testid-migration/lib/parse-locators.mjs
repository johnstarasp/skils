// Parses Appium screen .java files into structured locator records.
// Single-line annotations are assumed (true across this codebase).

const ANN = /^@(AndroidFindBy|iOSXCUITFindBy|iOSFindBy)\b/;
const FIELD = /^private\s+(?:List<WebElement>|WebElement)\s+(\w+)\s*;/;

export function looksLikeTestId(s) {
  return /^[A-Za-z][\w-]*__[A-Za-z][\w-]*--/.test(s);
}

function withIndex(value) {
  return /\[\d+\]|\[last\(\)\]/.test(value);
}

// Extracts {key, value} from an annotation line, e.g. xpath = "...".
function annValue(line) {
  const m = line.match(
    /\b(xpath|accessibility|id|iOSNsPredicate|iOSClassChain)\s*=\s*"([\s\S]*?)"\s*\)?\s*$/);
  return m ? { key: m[1], value: m[2] } : null;
}

function classifyAndroid({ key, value }) {
  let strategy;
  if (key === 'accessibility') strategy = 'accessibility-id';
  else if (key === 'id') strategy = 'id';
  else if (/@resource-id='mbanking\.NBG:id\//.test(value)) strategy = 'resource-id-native';
  else if (/@resource-id=|contains\(@resource-id/.test(value)) strategy = 'resource-id';
  else if (/@text=|contains\(@text/.test(value)) strategy = 'text';
  else if (/@content-desc/.test(value)) strategy = 'content-desc';
  else if (/android\.(widget|view)\./.test(value)) strategy = 'widget';
  else strategy = 'other';
  return { strategy, raw: value, hasIndex: withIndex(value) };
}

function classifyIos({ key, value }) {
  let strategy;
  if (key === 'accessibility') strategy = 'accessibility-id';
  else if (key === 'iOSClassChain') strategy = 'class-chain';
  else if (key === 'iOSNsPredicate') strategy = /name\s*==/.test(value) ? 'name' : 'predicate';
  else if (/@name=|contains\(@name/.test(value)) strategy = 'name';
  else if (/@label=|contains\(@label/.test(value)) strategy = 'label';
  else if (/@value=/.test(value)) strategy = 'value';
  else if (/XCUIElementType/.test(value)) strategy = 'class-chain';
  else strategy = 'other';
  return { strategy, raw: value, hasIndex: withIndex(value) };
}

function firstMatch(s, re) {
  const m = s && s.match(re);
  return m ? m[1] : undefined;
}

function extractEvidence(rec) {
  const a = rec.android ? rec.android.raw : '';
  const i = rec.ios ? rec.ios.raw : '';
  const ev = {};
  ev.visibleText =
    firstMatch(a, /@text='([^']*)'/) ||
    firstMatch(a, /contains\(@text,'([^']*)'\)/);
  if (!ev.visibleText) {
    const nameVal =
      firstMatch(i, /@name='([^']*)'/) ||
      firstMatch(i, /@label='([^']*)'/) ||
      firstMatch(i, /contains\(@name,'([^']*)'\)/);
    if (nameVal && !looksLikeTestId(nameVal)) ev.visibleText = nameVal;
  }
  ev.contentDesc =
    firstMatch(a, /@content-desc='([^']*)'/) ||
    firstMatch(a, /contains\(@content-desc,'([^']*)'\)/);
  ev.widgetType = firstMatch(a, /(android\.(?:widget|view)\.\w+)/);
  for (const k of Object.keys(ev)) if (ev[k] === undefined) delete ev[k];
  return ev;
}

function buildRecord(fieldName, annLines) {
  const rec = { fieldName, android: null, ios: null, evidence: {} };
  for (const line of annLines) {
    const v = annValue(line);
    if (!v) continue;
    if (line.startsWith('@AndroidFindBy')) rec.android = classifyAndroid(v);
    else rec.ios = classifyIos(v);
  }
  rec.evidence = extractEvidence(rec);
  return rec;
}

export function parseLocators(javaText) {
  const lines = javaText.split(/\r?\n/);
  let pending = [];
  const records = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (ANN.test(t)) { pending.push(t); continue; }
    const fm = t.match(FIELD);
    if (fm) {
      if (pending.length) records.push(buildRecord(fm[1], pending));
      pending = [];
      continue;
    }
    if (t && !t.startsWith('//')) pending = []; // real code resets annotation accumulation
  }
  return records;
}
