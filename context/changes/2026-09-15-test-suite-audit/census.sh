#!/bin/bash
# Test-suite census. Usage: census.sh <root containing src/ and e2e/>
R="$1"; T="$R/src/__tests__"
specs() { find "$T" \( -name '*.test.ts' -o -name '*.test.tsx' \) "$@"; }
loc() { xargs cat 2>/dev/null | wc -l | tr -d ' '; }
cnt() { xargs grep -hcE "$1" 2>/dev/null | awk '{s+=$1} END {print s+0}'; }
filesWith() { specs | xargs grep -lE "$1" 2>/dev/null | wc -l | tr -d ' '; }

echo "== headline"
echo "specs            $(specs | wc -l | tr -d ' ')"
echo "  node .test.ts  $(find "$T" -name '*.test.ts' | wc -l | tr -d ' ')"
echo "  dom  .test.tsx $(find "$T" -name '*.test.tsx' | wc -l | tr -d ' ')"
echo "spec LOC         $(specs | loc)"
echo "spec+helpers LOC $(find "$T" -type f \( -name '*.ts' -o -name '*.tsx' \) | loc)"
echo "it/test blocks   $(specs | cnt '^\s*(it|test)(\.(each|skip|only|skipIf|runIf|todo)\([^)]*\))?\(')"
echo "snap LOC         $(find "$T" -name '*.snap' | loc)"
echo "ENV_READY files  $(filesWith 'skipIf\(!ENV_READY\)')"
echo "largest specs:"; specs -exec wc -l {} + | grep -v total | sort -rn | head -5 | sed "s|$R/||"

echo "== §4 boilerplate (files / lines)"
b() { printf '%-28s %4s files %5s lines\n' "$1" "$(filesWith "$2")" "$(specs | cnt "$2")"; }
b 'const ENV_READY =' 'const ENV_READY = Boolean\('
b 'getPayload({ config })' 'getPayload\(\{ *config'
b 'db = await getDb(payload)' 'db = await getDb\(payload\)'
b 'let payload: Payload' 'let payload: Payload'
b "vi.mock('server-only')" "vi\.mock\(['\"]server-only['\"]"
b "vi.mock(cache/revalidate)" "vi\.mock\(['\"]@/lib/cache/revalidate['\"]"
b 'authState vi.hoisted' 'const authState = vi\.hoisted'

echo "== §5 helper adoption (importer files)"
h() { printf '%-32s %4s importers\n' "$1" "$(filesWith "from ['\"]@/__tests__/helpers/$1['\"]|from ['\"](\.\./)+helpers/$1['\"]|from ['\"]\./helpers/$1['\"]")"; }
for x in kosztorys-db-tree transfer-fixtures kosztorys-tree investment; do h $x; done
echo "manual kosztorys payload.create in non-importers: files=$(specs | xargs grep -LE 'helpers/kosztorys-db-tree' 2>/dev/null | xargs grep -lE "collection: *['\"](kosztorys-sections|kosztorys-items|kosztoryses)['\"]" 2>/dev/null | xargs grep -l 'payload.create' 2>/dev/null | wc -l | tr -d ' ')"

echo "== §6 root of __tests__"
echo "root specs       $(find "$T" -maxdepth 1 \( -name '*.test.ts' -o -name '*.test.tsx' \) | wc -l | tr -d ' ')"
echo "root LOC         $(find "$T" -maxdepth 1 \( -name '*.test.ts' -o -name '*.test.tsx' \) | loc)"

echo "== §7 assertion census"
echo "typeof===function  $(specs | cnt "expect\(typeof [^)]*\)\.toBe\(['\"]function")"
echo "toMatchSnapshot    $(specs | cnt 'toMatch(Inline)?Snapshot\(')"
echo "bare toHaveBeenCalled()  $(specs | cnt '\.toHaveBeenCalled\(\)')"
echo "toHaveBeenCalledWith     $(specs | cnt '\.toHaveBeenCalledWith\(')"
echo "toBeTruthy()             $(specs | cnt '\.toBeTruthy\(\)')"

echo "== §13 DOM / §14 E2E"
echo "dom files $(find "$T" -name '*.test.tsx' | wc -l | tr -d ' ')  LOC $(find "$T" -name '*.test.tsx' | loc)  it $(find "$T" -name '*.test.tsx' | cnt '^\s*(it|test)(\.[a-zA-Z]+(\([^)]*\))?)?\(')"
E="$R/e2e"; echo "e2e specs $(find "$E" -name '*.spec.ts' | wc -l | tr -d ' ')  tests $(find "$E" -name '*.spec.ts' | cnt '^\s*test(\.(skip|only|fixme))?\(')"

echo "== distribution: test LOC / src LOC"
ratio() { local s=$(find "$R/src/$1" -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | loc); local t=$(find "$T/$1" \( -name '*.test.ts' -o -name '*.test.tsx' \) 2>/dev/null | loc); awk -v a="$t" -v b="$s" -v n="$1" 'BEGIN{printf "%-26s src %6d  test %6d  %.2fx\n", n, b, a, (b?a/b:0)}'; }
for d in lib/db lib/kosztorys lib/actions lib/queries components/ui components/kosztorys components/forms components/tables; do ratio $d; done
echo "UI dirs with zero .test.tsx:"
for d in "app/(frontend)" components/dialogs components/filters components/fleet components/nav components/sheets components/investments; do
  s=$(find "$R/src/$d" -type f -name '*.tsx' 2>/dev/null | loc); n=$(find "$T/$d" -name '*.test.tsx' 2>/dev/null | wc -l | tr -d ' ')
  printf '  %-24s src tsx %6s  dom specs %s\n' "$d" "$s" "$n"
done
