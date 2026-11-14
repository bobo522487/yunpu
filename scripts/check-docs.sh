#!/bin/sh
# scripts/check-docs.sh — SC-DOC-01 的执行者：文档一致性校验器。
#
# Usage: scripts/check-docs.sh --root <dir> [--strict] [--json] [--baseline <file>] [--write-baseline <file>]
#   --root <dir>   待扫描的文档根（默认 docs）；默认跳过任何 .../superpowers/... 子目录
#   --strict       R8 size 从 WARN 升级为违规
#   --json         输出单个 JSON 对象而非逐行文本
#   --baseline <file>    棘轮模式：仅当存在"新增"违规（归一化去行号后不在 file 中）才失败；file 缺失则退出 0
#   --write-baseline <file>  把当前归一化违规写入 file 并退出 0（用于初始化基线，配合 P1 逐步削减）
#
# Rules（R1–R8 见 docs/superpowers/plans/2026-11-13-architecture-docs-refactor.md Task 2）:
#   R1 link            相对链接目标存在；带 #anchor 时校验目标文件内的 GitHub-style 锚点；忽略 http(s):// / 围栏代码块 / 行内代码示例
#   R2 eol             .md 不含 CR 字节
#   R3 oos-dup         `OOS-\d+` 定义行只在 requirements/out-of-scope.md
#   R4 dangling        反引号内的 ID token 被引用但全文档集（不含 README）无定义
#   R5 dual            同一 ID 有 >=2 条**正文**定义行（相同文本也算；单一权威原则）；README 编号索引表不参与
#   R6 needs-clarification  [NEEDS CLARIFICATION] 出现次数为 0
#   R7 section         裸 §x.y 须在**同一文件**找到 ^#{1,6} x.y 标题；跨文件章节引用必须用 [..](file.md#anchor) 链接（由 R1 校验锚点）
#   R8 size            >400 行的 .md 须在 <root>/README.md 的 Complexity Tracking 三列登记
#   R9 registry        <root>/README.md 编号索引中登记的 ID 必须存在真实定义（Registry 不得指向已被删除的定义）
#
# stdout（文本模式）: 每行 "<RULE> <file>:<line> <detail>"，末行 "VIOLATIONS=<n> WARN=<n>"
# exit: 0 无违规 / 1 有违规 / 2 用法或 IO 错误
# 依赖：仅 POSIX sh + find/grep/awk/sed/sort/mktemp（无 bun/node/python）。
set -u

usage() {
  cat >&2 <<'EOF'
Usage: scripts/check-docs.sh --root <dir> [--strict] [--json] [--baseline <file>] [--write-baseline <file>]
  --root <dir>           文档根目录（默认 docs）
  --strict               R8 size 升级为违规
  --json                 输出 JSON
  --baseline <file>      棘轮：仅"新增"违规（归一化去行号后不在 file 中）才失败
  --write-baseline <file> 把当前归一化违规写入 file 并退出 0（初始化基线）
Exit: 0 clean / 1 violations / 2 usage or IO error.
EOF
}

ROOT=docs
STRICT=0
JSON=0
BASELINE=""
WRITE_BASELINE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --root)
      [ $# -ge 2 ] || { echo "check-docs.sh: --root needs a value" >&2; usage; exit 2; }
      ROOT=$2; shift 2 ;;
    --strict) STRICT=1; shift ;;
    --json)   JSON=1;   shift ;;
    --baseline)
      [ $# -ge 2 ] || { echo "check-docs.sh: --baseline needs a value" >&2; usage; exit 2; }
      BASELINE=$2; shift 2 ;;
    --write-baseline)
      [ $# -ge 2 ] || { echo "check-docs.sh: --write-baseline needs a value" >&2; usage; exit 2; }
      WRITE_BASELINE=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "check-docs.sh: unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

[ -d "$ROOT" ] || { echo "check-docs.sh: root is not a directory: $ROOT" >&2; exit 2; }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/check-docs.XXXXXX") || {
  echo "check-docs.sh: cannot create temp dir" >&2; exit 2
}
trap 'rm -rf "$TMP"' EXIT HUP INT TERM

# ---- 输入集合 ---------------------------------------------------------------
# scan: root 下递归所有 .md，排除 superpowers/（评审报告与实施计划是过程产物，不是规格）
find "$ROOT" -type f -name '*.md' -print | grep -v '/superpowers/' \
  | LC_ALL=C sort -u > "$TMP/scanlist"
# defs-extra: 只在扫描项目文档根时纳入项目级宪法，fixture 运行保持隔离
: > "$TMP/extralist"
case "$ROOT" in
  docs|*/docs)
    for extra in .specify/memory/constitution.md; do
      [ -f "$extra" ] && printf '%s\n' "$extra" >> "$TMP/extralist"
    done ;;
esac

: > "$TMP/raw"        # 违规行
: > "$TMP/warns"      # WARN 行（仅 R8 非 --strict）
: > "$TMP/links"      # R1 候选（file<TAB>line<TAB>target）

# ---- 主扫描（awk 一次遍历所有文档）-------------------------------------------
cat > "$TMP/check.awk" <<'AWK'
BEGIN {
  ID   = "[A-Z][A-Z0-9]*(-[A-Z0-9]+)*-[0-9]+"
  D1   = "^[|][[:space:]]*`" ID "`[[:space:]]*[|]"     # 表格首列定义
  D2   = "^#{1,6}[[:space:]]+`?" ID                    # 标题定义（含 ### US-001（P1）…）
  D3   = "^[*][*]`" ID "`"                             # 粗体开头的定义
  D4   = "^[-*+][[:space:]]+`" ID "`"                 # 列表项首 token 为反引号 ID（如 schema.md §5.8 的定义行）
  TIQ  = "`" ID "`"
  LINK = "\\[[^]]*\\]\\([^)]*\\)"
  SEC  = "§[0-9]+([.][0-9]+)+"
  NEED = "[NEEDS CLARIFICATION]"
  CR   = sprintf("%c", 13)
  READ = ROOT "/README.md"

  while ((getline f < SCANLIST) > 0) { if (f != "") { scan[f] = 1; order[++n] = f } }
  close(SCANLIST)
  while ((getline f < EXTRALIST) > 0) { if (f != "" && !(f in scan)) { order[++n] = f } }
  close(EXTRALIST)
  for (k = 1; k <= n; k++) collect_heads(order[k])
}

# Task 3 按主题拆分后，章节号曾按文档集共享；本版收紧（评审 2026-11-14 问题 C）：
# 裸 §x.y 只允许引用同一文件内的标题；跨文件必须用 [..](file.md#anchor)，锚点由 R1 校验。
function collect_heads(f,   hl, hs) {
  while ((getline hl < f) > 0) {
    if (hl ~ /^#{1,6}[[:space:]]+[0-9]+([.][0-9]+)+/) {
      hs = hl; sub(/^#{1,6}[[:space:]]+/, "", hs)
      if (match(hs, /^[0-9]+([.][0-9]+)+/)) fheads[f SUBSEP substr(hs, RSTART, RLENGTH)] = 1
    }
  }
  close(f)
}

function basename(p,   b) { b = p; sub(/^.*\//, "", b); return b }

function emit(rule, loc, detail) { print rule " " loc " " detail > RAW }
function warn(rule, loc, detail) { print rule " " loc " " detail > WARNS }
function norm(s) { gsub(/[[:space:]]+/, " ", s); sub(/^ /, "", s); sub(/ $/, "", s); return s }

# 定义行的归一描述：整行去掉 ID token 后的文本（覆盖第二列及其后的所有列，
# 这样"第二列相同但第三/四列不同"的一号两义也能被 R5 抓到）
function defdesc(line,   d) { d = line; sub(TIQ, "", d); return norm(d) }

function first_id(s) {
  if (match(s, TIQ)) return substr(s, RSTART + 1, RLENGTH - 2)
  if (match(s, ID))  return substr(s, RSTART, RLENGTH)
  return ""
}

# README 表格行是否三列填齐（排除表头与占位符）
function filled(row,   a, cnt, i, c, g) {
  if (row !~ /^[|]/) return 0
  cnt = split(row, a, "|"); c = 0
  for (i = 2; i <= cnt - 1; i++) {
    g = a[i]; gsub(/^[[:space:]]+|[[:space:]]+$/, "", g)
    if (g != "" && g != "—" && g != "-") c++
  }
  return (c >= 3)
}

function process(f, iss,   line, ln, loc, fence, eol_reported, dolink, clean,
                 s, p, tgt, tok, id, dl, tmp, cleaned, sec, r) {
  fence = 0; eol_reported = 0; ln = 0
  while ((getline line < f) > 0) {
    ln++
    loc = f ":" ln

    # ---- R2 eol（每个文件只报第一次）----
    if (!eol_reported && index(line, CR) > 0) {
      if (iss) emit("R2 eol", loc, "CRLF line ending (use LF only)")
      eol_reported = 1
    }

    # ---- R3 oos-dup ----
    if (iss && line ~ /^[|][[:space:]]*`OOS-[0-9]+`[[:space:]]*[|]/) {
      if (f !~ /requirements\/out-of-scope\.md$/)
        emit("R3 oos-dup", loc, "OOS definition outside requirements/out-of-scope.md")
    }

    # ---- R6 needs-clarification ----
    if (iss && index(line, NEED) > 0)
      emit("R6 needs-clarification", loc, "unresolved Phase 0 marker")

    # ---- R7 section：裸 §x.y 必须能在同一文件内找到标题 ----
    # 评审 2026-11-14 问题 C：跨文件章节引用必须写成 [§x.y ..](file.md#anchor)，
    # 这种 § 随链接整体摘除（锚点有效性归 R1）；剩余裸 § 只做同文件校验。
    # 纯文本 "plan.md §99.99" 不构成链接形式，照常违规。
    if (iss) {
      cleaned = line
      gsub(/\[[^]]*\]\([^)]*[.]md#[^)#][^)]*\)/, "", cleaned)
      tmp = cleaned
      while (match(tmp, SEC)) {
        sec = substr(tmp, RSTART, RLENGTH); sub(/^§/, "", sec)
        if (!((f SUBSEP sec) in fheads))
          emit("R7 section", loc, "§" sec " has no heading in the same file; cross-file refs must link [..](file.md#anchor)")
        tmp = substr(tmp, RSTART + RLENGTH)
      }
    }

    # ---- R1 link：围栏代码块与行内代码示例不检查 ----
    dolink = 0
    if (line ~ /^[[:space:]]*```/) { fence = 1 - fence }
    else if (!fence) dolink = 1
    if (iss && dolink) {
      clean = line
      gsub(/`[^`]*`/, "", clean)
      s = clean
      while (match(s, LINK)) {
        tok = substr(s, RSTART, RLENGTH)
        p = index(tok, "](")
        tgt = substr(tok, p + 2, length(tok) - p - 2)
        sub(/[[:space:]].*$/, "", tgt)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", tgt)
        # 保留 #anchor：R1 同时校验文件存在与锚点存在
        if (tgt != "" && tgt !~ /^[a-zA-Z][a-zA-Z0-9+.-]*:/ && tgt !~ /^\/\// && tgt !~ /^#/)
          printf "%s\t%s\t%s\n", f, ln, tgt > LINKS
        s = substr(s, RSTART + RLENGTH)
      }
    }

    # ---- 定义收集（所有文档；extra 文件只提供定义，不产生违规）----
    # 评审 2026-11-14 问题 A：README 编号索引是 Registry，不是 Definition。
    # R4 只信真实定义；R9 另行校验 Registry 与定义集一致。
    if (line ~ D1 || line ~ D2 || line ~ D3 || line ~ D4) {
      id = first_id(line)
      if (id != "") {
        if (f == READ) {
          reg[id] = loc              # Registry：登记位置，不算定义
        } else {
          def[id]++                  # Definition：真实主题文档定义
          dc[id]++
          dl = id SUBSEP dc[id]
          defloc[dl] = loc
          deftext[dl] = defdesc(line)
          defmax[id] = dc[id]
        }
      }
    }

    # ---- 引用收集（仅 scan 集合：反引号内恰好是一个 ID token）----
    if (iss) {
      r = line
      while (match(r, "`[^`]+`")) {
        tok = substr(r, RSTART + 1, RLENGTH - 2)
        if (tok ~ ("^" ID "$")) {
          if (!(tok in ref)) refloc[tok] = loc
          ref[tok] = 1
        }
        r = substr(r, RSTART + RLENGTH)
      }
    }
  }
  close(f)
  if (iss) nlines[f] = ln
}

BEGIN { for (k = 1; k <= n; k++) process(order[k], (order[k] in scan) ? 1 : 0) }

END {
  # ---- R4 dangling ----
  for (id in ref)
    if (!(id in def))
      emit("R4 dangling", refloc[id], id " referenced but never defined")

  # ---- R5 dual：同一 ID >=2 条正文定义行即违规（相同文本也算；Article VI 单一权威） ----
  for (id in defmax) {
    if (defmax[id] < 2) continue
    emit("R5 dual", defloc[id SUBSEP 1], id " has " defmax[id] " definition lines; exactly one authority required")
  }

  # ---- R9 registry：README 登记的 ID 必须有真实定义 ----
  for (id in reg)
    if (!(id in def))
      emit("R9 registry", reg[id], id " registered in README index but no definition in topic docs")

  # ---- R8 size ----
  for (k = 1; k <= n; k++) {
    f = order[k]
    if (!(f in scan) || nlines[f] <= 400) continue
    ok = 0
    inct = 0
    while ((getline row < READ) > 0) {
      # R8 只接受 ## Complexity Tracking 段内的三列登记行；导航表 / 编号索引表
      # 里的同名 basename 不构成登记（全分支评审 Important 1，R8 曾假阴性）。
      if (row ~ /^## Complexity Tracking([[:space:]]|$)/) { inct = 1; continue }
      if (inct && row ~ /^## /) { inct = 0 }
      if (inct && index(row, basename(f)) > 0 && filled(row)) { ok = 1; break }
    }
    close(READ)
    d = "over 400 lines (" nlines[f] "); register in " ROOT "/README.md Complexity Tracking (Violation / Why Needed / Simpler Alternative Rejected Because)"
    if (!ok) {
      if (STRICT) emit("R8 size", f ":1", d)
      else        warn("R8 size", f ":1", d)
    }
  }
}
AWK

awk -v SCANLIST="$TMP/scanlist" -v EXTRALIST="$TMP/extralist" \
    -v RAW="$TMP/raw" -v WARNS="$TMP/warns" -v LINKS="$TMP/links" \
    -v ROOT="$ROOT" -v STRICT="$STRICT" \
    -f "$TMP/check.awk" </dev/null || {
  echo "check-docs.sh: awk scan failed" >&2; exit 2
}

# ---- R1 link：shell 负责目标存在性检查；带 #anchor 时追加 GitHub-style 锚点校验 ----
# GitHub slug 算法：小写化；删除字母/数字/连字符/下划线/空格以外的字符；空格→连字符。
# 中文等非 ASCII 标题的字符会被保留（仅去标点），与本仓库文档约定一致。
slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' \
    | sed -e 's/[][!"'"'"'#$%&()*+,.\/:;<=>?@\\^`{|}~]//g' \
          -e 's/[[:space:]]/-/g'
}
anchor_ok() {
  # $1 = 目标 md 文件, $2 = 锚点。锚点不存在返回 1。
  # 注意：awk 默认退出码是最后一条命令的，必须用 found 标志在 END 显式退出，
  # 否则命中 exit 0 后 END 块仍执行并覆盖退出码。
  afile=$1; aanchor=$2
  [ -f "$afile" ] || return 1
  awk -v want="$aanchor" '
    BEGIN { found = 0 }
    /^#{1,6}[[:space:]]/ {
      h = $0
      sub(/^#{1,6}[[:space:]]+/, "", h)
      # 生成 GitHub slug：小写、去标点（保留 CJK）、空格转连字符
      g = tolower(h)
      gsub(/[][!"#$%&()*+,.\/:;<=>?@\\^`{|}~'"'"']/, "", g)
      gsub(/[[:space:]]/, "-", g)
      # 连续连字符不折叠（GitHub 保留）；首尾连字符保留
      if (g == want) found = 1
    }
    END { exit (found ? 0 : 1) }
  ' "$afile"
}
while IFS="$(printf '\t')" read -r lf lln ltgt; do
  [ -n "$lf" ] || continue
  tgtfile=$ltgt; tgtanchor=""
  case "$tgtfile" in
    *"#"*) tgtanchor=${tgtfile#*#}; tgtfile=${tgtfile%%#*} ;;
  esac
  case "$tgtfile" in
    /*) full=$tgtfile ;;
    *)  full="$(dirname "$lf")/$tgtfile" ;;
  esac
  if [ ! -e "$full" ]; then
    printf 'R1 link %s:%s %s\n' "$lf" "$lln" "$tgtfile#$tgtanchor" >> "$TMP/raw"
  elif [ -n "$tgtanchor" ] && [ -f "$full" ]; then
    if ! anchor_ok "$full" "$tgtanchor"; then
      printf 'R1 anchor %s:%s %s#%s\n' "$lf" "$lln" "$tgtfile" "$tgtanchor" >> "$TMP/raw"
    fi
  fi
done < "$TMP/links"

LC_ALL=C sort -o "$TMP/raw" "$TMP/raw"
LC_ALL=C sort -o "$TMP/warns" "$TMP/warns"

# 归一化：剥离违规位置的行号（file:NN → file），使基线按"规则+文件+内容"比对，
# 文档行号漂移不触发误报。键 = "<rule> <file> <detail>"。
norm_awk='{loc=$2; sub(/:[0-9]+$/,"",loc); rest=""; for(i=3;i<=NF;i++) rest=rest (i>3?" ":"") $i; print $1, loc, rest}'

# ---- --write-baseline：把当前归一化违规落盘并退出 0（初始化棘轮基线）----
if [ -n "$WRITE_BASELINE" ]; then
  awk "$norm_awk" "$TMP/raw" | LC_ALL=C sort -u > "$WRITE_BASELINE"
  nb=$(wc -l < "$WRITE_BASELINE" | tr -d ' ')
  echo "check-docs.sh: wrote baseline with $nb known violations to $WRITE_BASELINE" >&2
  exit 0
fi

# ---- --baseline：棘轮。仅"新增"违规（不在基线中）才失败；已修复的基线项不计失败。----
if [ -n "$BASELINE" ]; then
  awk "$norm_awk" "$TMP/raw" | LC_ALL=C sort -u > "$TMP/rawnorm"
  if [ -f "$BASELINE" ]; then
    awk "$norm_awk" "$BASELINE" | LC_ALL=C sort -u > "$TMP/basenorm"
  else
    : > "$TMP/basenorm"
  fi
  comm -23 "$TMP/rawnorm" "$TMP/basenorm" > "$TMP/newnorm"
  comm -13 "$TMP/rawnorm" "$TMP/basenorm" > "$TMP/fixednorm"
  awk -v na="$TMP/newnorm" '
    BEGIN { while ((getline k < na) > 0) want[k]=1 }
    { loc=$2; sub(/:[0-9]+$/,"",loc); rest=""; for(i=3;i<=NF;i++) rest=rest (i>3?" ":"") $i
      key=$1" "loc" "rest; if (key in want) print }
  ' "$TMP/raw" > "$TMP/newraw"
  mv "$TMP/newraw" "$TMP/raw"
  echo "check-docs.sh: baseline known=$(wc -l < "$TMP/basenorm" | tr -d ' ') fixed=$(wc -l < "$TMP/fixednorm" | tr -d ' ') new=$(wc -l < "$TMP/raw" | tr -d ' ')" >&2
fi

nv=$(wc -l < "$TMP/raw" | tr -d ' ')
nw=$(wc -l < "$TMP/warns" | tr -d ' ')

if [ "$JSON" -eq 1 ]; then
  vjson=$(awk 'function esc(s){gsub(/["\\]/, "\\\\&", s); return s} {printf "%s\"%s\"", (NR>1?",":""), esc($0)} END{printf "\n"}' "$TMP/raw")
  wjson=$(awk 'function esc(s){gsub(/["\\]/, "\\\\&", s); return s} {printf "%s\"%s\"", (NR>1?",":""), esc($0)} END{printf "\n"}' "$TMP/warns")
  printf '{"VIOLATIONS":%s,"WARN":%s,"violations":[%s],"warnings":[%s]}\n' "$nv" "$nw" "$vjson" "$wjson"
else
  cat "$TMP/raw"
  cat "$TMP/warns"
  printf 'VIOLATIONS=%s WARN=%s\n' "$nv" "$nw"
fi

[ "$nv" -gt 0 ] && exit 1
exit 0
