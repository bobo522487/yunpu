-- 成员列表需要以 genealogy_app 读取 auth."user" 的姓名/邮箱（列级授权见 0008）；
-- 列授权之前必须先有 schema USAGE。
GRANT USAGE ON SCHEMA auth TO genealogy_app;
