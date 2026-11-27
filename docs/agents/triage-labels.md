# 分诊标签映射（Triage Labels）

工程技能使用五个标准分诊角色，本文件将它们映射到本仓库 Issue Tracker 实际使用的标签名。

| `mattpocock/skills` 标准角色 | 本仓库实际标签 | 含义 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 需要维护者评估此 Issue |
| `needs-info` | `needs-info` | 等待提交者补充更多信息 |
| `ready-for-agent` | `ready-for-agent` | 规格已明确，可交由自动化 Agent 实施 |
| `ready-for-human` | `ready-for-human` | 需要人工设计或实现 |
| `wontfix` | `wontfix` | 不予处理 |

当技能提及某个分诊角色（例如「打上可由 Agent 执行的标签」）时，使用上表「本仓库实际标签」列对应的标签字符串。

后续如需改用仓库自定义命名，直接编辑「本仓库实际标签」列即可。
