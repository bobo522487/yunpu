# 所有者外键不另建引用侧索引

`organization (id, owner_user_id)` 指向 `organization_member (organization_id, user_id)`。

删除一名成员时，数据库要在 `organization` 里查找 `id` 与 `owner_user_id` 都匹配的行。`id` 是 `organization` 的主键，这次查找定位一行，不会随着成员数量变成全表扫描。

因此不为 `fk_organization_owner` 再加一条索引。已经落地的项目内容表仍然有各自的 `(organization_id, project_id)` 索引。这里不存在一份需要继续维护的例外清单。
