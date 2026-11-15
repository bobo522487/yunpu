-- 项目封面/配色与重要等级（远端仓库“新建云谱项目”富弹窗字段持久化）
ALTER TABLE "project" ADD COLUMN "color_theme" text DEFAULT 'sky' NOT NULL;
ALTER TABLE "project" ADD COLUMN "project_level" smallint DEFAULT 1 NOT NULL;

ALTER TABLE "project" ADD CONSTRAINT "ck_project_color_theme"
  CHECK ("color_theme" IN ('sky', 'pink', 'orange', 'indigo', 'emerald', 'violet'));
ALTER TABLE "project" ADD CONSTRAINT "ck_project_project_level"
  CHECK ("project_level" BETWEEN 1 AND 5);
