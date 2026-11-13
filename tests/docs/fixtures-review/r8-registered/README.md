# Fixture: R8 CT scoping (positive control)

## 导航表

| `big.md` | 主题 | 唯一权威 | `check-docs.sh` |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 400 行警报：`big.md`（403 行） | 内容内聚，是单一主题 | 按行数切碎会制造跨文件重复定义 |
