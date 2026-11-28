-- 家族自定义图标对象键（未设置时前端按姓氏生成默认印章并自动适配平台配色预设）
ALTER TABLE "project" ADD COLUMN "icon_key" text;

ALTER TABLE "project" ADD CONSTRAINT "ck_project_icon_key_not_blank"
  CHECK ("icon_key" IS NULL OR btrim("icon_key") <> '');
