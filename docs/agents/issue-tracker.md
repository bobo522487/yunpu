# Issue Tracker：GitHub

本仓库的 Issue 与 Spec 托管在 GitHub 仓库 `bobo522487/yunpu`，所有操作统一使用 `gh` CLI。

## 操作约定

- **创建 Issue**：`gh issue create --title "..." --body "..."`；多行正文请使用 heredoc。
- **读取 Issue**：`gh issue view <number> --json number,title,body,labels,comments`。
- **列出 Issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，按需配合 `--label` 与 `--state` 过滤。
- **设为父 Issue 的子任务（sub-issue）**：使用 `gh issue create --parent <parent> ...`，或事后执行 `gh issue edit <parent> --add-sub-issue <child>`（需 `gh` 2.94+）。旧版 `gh` 可调用 `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`（此处为数字型数据库 ID，获取方式见下方**阻塞关系**）。若不可用 sub-issues，则在子 Issue 正文顶部写明 `Part of #<parent>`。
- **阻塞关系（Blocking）**：优先使用 GitHub 原生 **issue dependencies**（在 UI 中可见的权威表示）。通过 `gh issue create --blocked-by <n>,<n> ...` 或 `gh issue edit <child> --add-blocked-by <blocker>` 添加依赖（需 `gh` 2.94+）。旧版 `gh` 可调用 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`，其中 `<blocker-db-id>` 为阻塞 Issue 的数字型**数据库 ID**（通过 `gh api repos/<owner>/<repo>/issues/<n> --jq .id` 获取，*不是* `#number` 或 `node_id`）。若依赖功能不可用，退回在子 Issue 正文顶部写明 `Blocked by: #<n>, #<n>`。当所有前置阻塞 Issue 均关闭时，该任务即解除阻塞。
- **统计未关闭的阻塞项**：`gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by`（仅统计 open 状态阻塞项；为 `0` 表示可启动）。注意 `gh issue view <n> --json blockedBy` 会包含已关闭的阻塞项，需加过滤：`--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`。
- **评论 Issue**：`gh issue comment <number> --body "..."`。
- **增删标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`。
- **关闭 Issue**：先执行 `gh issue comment <number> --body "..."` 写明结论，再执行 `gh issue close <number>`（对已关闭的 Issue 直接使用 `gh issue close --comment` 会静默丢弃评论且仍返回 0）。

在本地克隆目录中，`gh` 会根据 `git remote -v` 自动推断目标仓库。

仅允许在 `bobo522487/yunpu` 中创建 Issue，严禁提交到 `mattpocock/skills` 或其他外部上游仓库。每次会话首次执行 `gh issue create` 前，先运行 `gh repo view --json nameWithOwner` 校验目标仓库。

## 将 Pull Request 作为分诊入口

**是否将 PR 纳入需求分诊（PRs as a request surface）：no。** _（若本仓库将外部 PR 视为功能需求纳入分诊，可改为 `yes`；`/triage` 会读取此开关。）_

当此开关设为 `yes` 时，PR 与 Issue 共用同一套标签与状态流转，改用 `gh pr` 对应命令：

- **读取 PR**：先 `gh pr view <number>`，再 `gh pr view <number> --comments`（非 TTY 环境下 `--comments` 仅输出评论而不包含正文），查看变更用 `gh pr diff <number>`。
- **列出待分诊的外部 PR**：`gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`。
- **评论 / 打标 / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 Issue 与 PR 共用同一套编号空间，裸编号 `#42` 可能是其中任意一种：可先用 `gh pr view 42` 解析，不存在再回退到 `gh issue view 42`。

## 当技能要求「发布到 Issue Tracker（publish to the issue tracker）」

在 `bobo522487/yunpu` 中创建一个 GitHub Issue。

## 当技能要求「获取对应任务票（fetch the relevant ticket）」

按上文**读取 Issue**的方式拉取内容。

## Wayfinding 协同操作

供 `/wayfinder` 使用。**地图（map）** 为单个父 Issue，每个探索/任务票为挂载在其下的**子 Issue**。

- **地图（Map）**：带 `wayfinder:map` 标签的单个 Issue，正文维护 Notes / Decisions-so-far / Fog：`gh issue create --label wayfinder:map`。
- **子任务票（Child ticket）**：作为 GitHub sub-issue 关联到地图（见上文**设为父 Issue 的子任务**）。若未开启 sub-issues，则在地图正文中加入任务列表并在子 Issue 顶部写 `Part of #<map>`。标签使用 `wayfinder:<type>`（`research` / `prototype` / `grilling` / `task`）；认领后指派给执行开发者。
- **阻塞关系**：见上文**操作约定 → 阻塞关系**。
- **前沿任务查询（Frontier query）**：列出地图下处于 open 状态的子 Issue（`gh issue list --state open`，限定在地图的 sub-issues / 任务列表范围内），剔除仍有未关闭阻塞项（见**统计未关闭的阻塞项**或检查 `Blocked by` 行）以及已有指派人的条目；按地图顺位取第一个。
- **认领（Claim）**：`gh issue edit <n> --add-assignee @me`，作为会话的第一次写操作。
- **结单（Resolve）**：先 `gh issue comment <n> --body "<answer>"`，再 `gh issue close <n>`，然后将结论摘要与链接追加到地图正文的 Decisions-so-far 中。
