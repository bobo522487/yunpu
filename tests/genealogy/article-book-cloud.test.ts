import { beforeAll, describe, expect, test } from "vitest";
import { config } from "../../apps/api/src/config";
import { initStorage } from "../../apps/api/src/storage";
import {
  createOrganization,
  request,
  setOrganizationStatus,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { addMember } from "../fixtures/members";
import { call, seedOwnerProject } from "./fixtures/helpers";

describe("article, book, folder kind & asset cloud persistence", () => {
  beforeAll(async () => {
    const env = config();
    await initStorage({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region: env.S3_REGION,
    });
  });

  test("folder kind isolation and deleting article folder unbinds articles", async () => {
    const { cookie, projectId } = await seedOwnerProject("art-folder");

    // Create a lineage folder and an article folder with the same name -> allowed across kinds
    const fLineage = await call(
      `/api/v1/projects/${projectId}/folders`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ name: "卷一", kind: "lineage", seq: 0 }),
      },
    );
    expect(fLineage.status).toBe(201);

    const fArticle = await call(
      `/api/v1/projects/${projectId}/folders`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ name: "卷一", kind: "article", seq: 0 }),
      },
    );
    expect(fArticle.status).toBe(201);
    const articleFolderId = (fArticle.data?.folder as { id: string }).id;

    // Duplicate within same kind -> 409 CONFLICT
    const dupArticle = await call(
      `/api/v1/projects/${projectId}/folders`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ name: "卷一", kind: "article", seq: 1 }),
      },
    );
    expect(dupArticle.status).toBe(409);
    expect(dupArticle.json.code).toBe("CONFLICT");

    // Lineage directory lists only lineage folder; article directory lists only article folder
    const linDir = await call(`/api/v1/projects/${projectId}/lineages`, cookie);
    expect(
      (linDir.data?.folders as { kind: string }[]).map((f) => f.kind),
    ).toEqual(["lineage"]);

    const artCreate = await call(
      `/api/v1/projects/${projectId}/articles`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          title: "重修族谱序",
          folderId: articleFolderId,
          docType: "preface",
          status: "draft",
          privacy: "clan",
          contentHtml: "<p>慎终追远，民德归厚。</p>",
          seq: 0,
        }),
      },
    );
    expect(artCreate.status).toBe(201);
    const articleId = (artCreate.data?.article as { id: string }).id;

    // Delete article folder -> unbinds folderId to null without deleting article
    const delFolder = await call(
      `/api/v1/projects/${projectId}/folders/${articleFolderId}`,
      cookie,
      { method: "DELETE" },
    );
    expect(delFolder.status).toBe(200);

    const artDir = await call(`/api/v1/projects/${projectId}/articles`, cookie);
    expect(artDir.status).toBe(200);
    expect((artDir.data?.folders as unknown[]).length).toBe(0);
    const articles = artDir.data?.articles as {
      id: string;
      folderId: string | null;
    }[];
    expect(articles.length).toBe(1);
    expect(articles[0]?.id).toBe(articleId);
    expect(articles[0]?.folderId).toBeNull();
  });

  test("article CRUD, CAS 409 conflict, duplicate, revision creation and CAS restore", async () => {
    const { cookie, projectId } = await seedOwnerProject("art-cas");

    const created = await call(
      `/api/v1/projects/${projectId}/articles`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          title: "家训十则",
          author: "编委会",
          docType: "rules",
          status: "draft",
          privacy: "clan",
          contentJson: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "第一版家训" }],
              },
            ],
          },
          contentHtml: "<p>第一版家训</p>",
          wordCount: 5,
        }),
      },
    );
    expect(created.status).toBe(201);
    const art1 = created.data?.article as {
      id: string;
      version: number;
      title: string;
    };
    expect(art1.version).toBe(1);

    // Record revision v1
    const rev1 = await call(
      `/api/v1/projects/${projectId}/articles/${art1.id}/revisions`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          summary: "初稿存底",
          authorName: "修谱人",
        }),
      },
    );
    expect(rev1.status).toBe(201);
    const revisionId = (rev1.data?.revision as { id: string }).id;

    // Update v1 -> v2
    const updated = await call(
      `/api/v1/projects/${projectId}/articles/${art1.id}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          version: 1,
          title: "家训十则（修订）",
          status: "approved",
          contentJson: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "第二版家训" }],
              },
            ],
          },
          contentHtml: "<p>第二版家训</p>",
          wordCount: 5,
        }),
      },
    );
    expect(updated.status).toBe(200);
    const art2 = updated.data?.article as { version: number; title: string };
    expect(art2.version).toBe(2);
    expect(art2.title).toBe("家训十则（修订）");

    // Stale version 1 update -> 409 VERSION_CONFLICT with latest server article
    const stale = await call(
      `/api/v1/projects/${projectId}/articles/${art1.id}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          version: 1,
          title: "过期覆盖",
        }),
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.json.code).toBe("VERSION_CONFLICT");
    const conflictArticle = (
      stale.json.details as { article?: { version: number; title: string } }
    )?.article;
    expect(conflictArticle?.version).toBe(2);
    expect(conflictArticle?.title).toBe("家训十则（修订）");

    // Stale restore version 1 -> 409
    const staleRestore = await call(
      `/api/v1/projects/${projectId}/articles/${art1.id}/revisions/${revisionId}/restore`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ version: 1, authorName: "修谱人" }),
      },
    );
    expect(staleRestore.status).toBe(409);

    // Valid restore with version 2 -> bumps version to 3 and restores content
    const restored = await call(
      `/api/v1/projects/${projectId}/articles/${art1.id}/revisions/${revisionId}/restore`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ version: 2, authorName: "修谱人" }),
      },
    );
    expect(restored.status).toBe(200);
    const restoredArticle = restored.data?.article as {
      version: number;
      contentHtml: string;
    };
    expect(restoredArticle.version).toBe(3);
    expect(restoredArticle.contentHtml).toContain("第一版家训");

    // Duplicate article -> creates new row at version 1
    const dup = await call(
      `/api/v1/projects/${projectId}/articles/${art1.id}/duplicate`,
      cookie,
      { method: "POST" },
    );
    expect(dup.status).toBe(201);
    const dupArt = dup.data?.article as {
      id: string;
      version: number;
      title: string;
    };
    expect(dupArt.id).not.toBe(art1.id);
    expect(dupArt.version).toBe(1);
    expect(dupArt.title).toContain("副本");

    // Delete duplicated article
    const del = await call(
      `/api/v1/projects/${projectId}/articles/${dupArt.id}`,
      cookie,
      { method: "DELETE" },
    );
    expect(del.status).toBe(200);
  });

  test("article image asset upload/read, magic bytes, RBAC, and archived org lock", async () => {
    const {
      cookie: ownerCookie,
      organizationId,
      projectId,
    } = await seedOwnerProject("art-asset");
    const viewer = await addMember(
      organizationId,
      uniqueEmail("art-asset-viewer"),
      "viewer",
    );
    const stranger = await signUp(uniqueEmail("art-asset-stranger"));

    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const upload = await request(
      `/api/v1/projects/${projectId}/article-assets`,
      {
        method: "POST",
        headers: {
          cookie: ownerCookie,
          "content-type": "image/png",
        },
        body: pngBytes,
      },
    );
    expect(upload.status).toBe(201);
    const uploadJson = (await upload.json()) as {
      ok: boolean;
      data: { key: string; url: string };
    };
    expect(uploadJson.ok).toBe(true);
    expect(uploadJson.data.url).toBe(
      `/api/v1/projects/${projectId}/article-assets/${uploadJson.data.key}`,
    );

    // Viewer can read with nosniff, cannot upload
    const viewerRead = await request(uploadJson.data.url, {
      headers: { cookie: viewer.cookie },
    });
    expect(viewerRead.status).toBe(200);
    expect(viewerRead.headers.get("content-type")).toBe("image/png");
    expect(viewerRead.headers.get("x-content-type-options")).toBe("nosniff");

    const viewerUpload = await request(
      `/api/v1/projects/${projectId}/article-assets`,
      {
        method: "POST",
        headers: {
          cookie: viewer.cookie,
          "content-type": "image/png",
        },
        body: pngBytes,
      },
    );
    expect(viewerUpload.status).toBe(403);

    // Non-member receives 404
    const strangerRead = await request(uploadJson.data.url, {
      headers: { cookie: stranger.cookie },
    });
    expect(strangerRead.status).toBe(404);

    // Magic bytes mismatch receives 400
    const badMagic = await request(
      `/api/v1/projects/${projectId}/article-assets`,
      {
        method: "POST",
        headers: {
          cookie: ownerCookie,
          "content-type": "image/png",
        },
        body: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
      },
    );
    expect(badMagic.status).toBe(400);

    // Archived org blocks upload with 409
    await setOrganizationStatus(organizationId, "archived");
    const archivedUpload = await request(
      `/api/v1/projects/${projectId}/article-assets`,
      {
        method: "POST",
        headers: {
          cookie: ownerCookie,
          "content-type": "image/png",
        },
        body: pngBytes,
      },
    );
    expect(archivedUpload.status).toBe(409);
  });

  test("book CRUD, CAS 409, duplicate, reorder, editions cap 9 & printStatus finalize", async () => {
    const { cookie, projectId } = await seedOwnerProject("book-cloud");

    const emptySections = {
      preface: {
        code: "preface",
        label: "谱序",
        hint: "谱序、凡例、修谱缘起",
        collapsed: false,
        items: [],
      },
      body: {
        code: "body",
        label: "正文",
        hint: "源流考、家训、先贤传记",
        collapsed: false,
        items: [],
      },
      lineage: {
        code: "lineage",
        label: "世系",
        hint: "检索表、吊线图、世系表",
        collapsed: false,
        items: [],
      },
      appendix: {
        code: "appendix",
        label: "附录",
        hint: "墓志碑记、后记、杂录",
        collapsed: false,
        items: [],
      },
    };
    const defaultLayout = {
      bindingStyle: "thread",
      lineageStyle: "euler",
      paperSize: "k16_185x260",
      borderStyle: "double",
      fontFamily: "song",
      density: "standard",
      fishtailStyle: "black",
      showHallName: true,
      showHeaderName: true,
      pageNumberStyle: "chinese",
    };

    const createA = await call(`/api/v1/projects/${projectId}/books`, cookie, {
      method: "POST",
      body: JSON.stringify({
        bookName: "陈氏宗谱",
        headerName: "陈氏宗谱",
        hallName: "德星堂",
        volumeNo: "卷一",
        editor: "修谱委",
        compilationDate: "2026-11-27",
        sections: emptySections,
        layoutConfig: defaultLayout,
        seq: 0,
      }),
    });
    expect(createA.status).toBe(201);
    const bookA = createA.data?.book as { id: string; version: number };
    expect(bookA.version).toBe(1);

    // Update book -> bumps version to 2
    const patchA = await call(
      `/api/v1/projects/${projectId}/books/${bookA.id}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          version: 1,
          layoutConfig: { ...defaultLayout, fontFamily: "kai" },
        }),
      },
    );
    expect(patchA.status).toBe(200);
    expect((patchA.data?.book as { version: number }).version).toBe(2);

    // Stale CAS version 1 -> 409 VERSION_CONFLICT
    const staleBook = await call(
      `/api/v1/projects/${projectId}/books/${bookA.id}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          version: 1,
          bookName: "覆盖失败",
        }),
      },
    );
    expect(staleBook.status).toBe(409);
    expect(staleBook.json.code).toBe("VERSION_CONFLICT");

    // Generate 10 editions -> trimmed to latest 9
    let latestEditionId = "";
    for (let i = 1; i <= 10; i++) {
      const ed = await call(
        `/api/v1/projects/${projectId}/books/${bookA.id}/editions`,
        cookie,
        {
          method: "POST",
          body: JSON.stringify({
            bindingStyle: "thread",
            lineageStyle: "euler",
            paperSize: "k16_185x260",
            pageCount: i,
            memberCount: 1,
            wordCount: 100 * i,
            layoutSnapshot: { ...defaultLayout, fontFamily: "kai" },
            pages: [
              {
                pageNo: 1,
                type: "cover",
                sectionCode: "cover",
                headerTitle: "陈氏宗谱",
                eyebrowTitle: `第${i}次成书`,
                hallName: "德星堂",
                html: `<div>第${i}次成书</div>`,
              },
            ],
          }),
        },
      );
      expect(ed.status).toBe(201);
      latestEditionId = (ed.data?.edition as { id: string }).id;
    }

    const editionsList = await call(
      `/api/v1/projects/${projectId}/books/${bookA.id}/editions`,
      cookie,
    );
    expect(editionsList.status).toBe(200);
    const editions = editionsList.data?.editions as {
      id: string;
      pageCount: number;
      printStatus: string;
    }[];
    expect(editions.length).toBe(9);
    expect(editions[0]?.id).toBe(latestEditionId);

    // Finalize printStatus
    const finalized = await call(
      `/api/v1/projects/${projectId}/books/${bookA.id}/editions/${latestEditionId}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({ printStatus: "finalized" }),
      },
    );
    expect(finalized.status).toBe(200);
    expect(
      (finalized.data?.edition as { printStatus: string }).printStatus,
    ).toBe("finalized");

    // Duplicate book & reorder
    const dupBook = await call(
      `/api/v1/projects/${projectId}/books/${bookA.id}/duplicate`,
      cookie,
      { method: "POST" },
    );
    expect(dupBook.status).toBe(201);
    const bookB = dupBook.data?.book as { id: string };

    const reordered = await call(
      `/api/v1/projects/${projectId}/books/reorder`,
      cookie,
      {
        method: "PUT",
        body: JSON.stringify({ bookIds: [bookB.id, bookA.id] }),
      },
    );
    expect(reordered.status).toBe(200);
    const reorderedIds = (reordered.data?.books as { id: string }[]).map(
      (b) => b.id,
    );
    expect(reorderedIds).toEqual([bookB.id, bookA.id]);
  });

  test("cross-organization isolation, viewer RBAC, and DB-level FORCE ROW LEVEL SECURITY", async () => {
    const {
      cookie: ownerCookie,
      organizationId,
      projectId,
    } = await seedOwnerProject("rls-docs");
    const viewer = await addMember(
      organizationId,
      uniqueEmail("rls-docs-viewer"),
      "viewer",
    );
    const outsider = await signUp(uniqueEmail("rls-docs-outsider"));
    const outsiderId = (outsider.json.data?.user as { id: string }).id;
    const outsiderOrg = await createOrganization(outsider.cookie, "外族组织");
    expect(outsiderOrg.ok).toBe(true);

    const artRes = await call(
      `/api/v1/projects/${projectId}/articles`,
      ownerCookie,
      {
        method: "POST",
        body: JSON.stringify({
          title: "受保护谱文",
          contentHtml: "<p>私密家史</p>",
        }),
      },
    );
    expect(artRes.status).toBe(201);
    const articleId = (artRes.data?.article as { id: string }).id;

    // Viewer can read, cannot create/update/delete
    const viewerList = await call(
      `/api/v1/projects/${projectId}/articles`,
      viewer.cookie,
    );
    expect(viewerList.status).toBe(200);

    const viewerCreate = await call(
      `/api/v1/projects/${projectId}/articles`,
      viewer.cookie,
      {
        method: "POST",
        body: JSON.stringify({ title: "越权谱文", contentHtml: "<p>x</p>" }),
      },
    );
    expect(viewerCreate.status).toBe(403);

    const viewerCreateBook = await call(
      `/api/v1/projects/${projectId}/books`,
      viewer.cookie,
      {
        method: "POST",
        body: JSON.stringify({
          bookName: "越权谱书",
          headerName: "越权谱书",
          hallName: "",
          volumeNo: "卷一",
          editor: "",
          compilationDate: "2026-11-27",
          sections: {
            preface: {
              code: "preface",
              label: "谱序",
              hint: "",
              collapsed: false,
              items: [],
            },
            body: {
              code: "body",
              label: "正文",
              hint: "",
              collapsed: false,
              items: [],
            },
            lineage: {
              code: "lineage",
              label: "世系",
              hint: "",
              collapsed: false,
              items: [],
            },
            appendix: {
              code: "appendix",
              label: "附录",
              hint: "",
              collapsed: false,
              items: [],
            },
          },
          layoutConfig: {
            bindingStyle: "thread",
            lineageStyle: "euler",
            paperSize: "k16_185x260",
            borderStyle: "double",
            fontFamily: "song",
            density: "standard",
            fishtailStyle: "black",
            showHallName: true,
            showHeaderName: true,
            pageNumberStyle: "chinese",
          },
        }),
      },
    );
    expect(viewerCreateBook.status).toBe(403);

    // Outsider receives 404
    const outsiderRead = await call(
      `/api/v1/projects/${projectId}/articles/${articleId}`,
      outsider.cookie,
    );
    expect(outsiderRead.status).toBe(404);

    // Direct PostgreSQL RLS check under genealogy_app role with outsider user_id
    const visibleToOutsider = await withAdminDb(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL ROLE genealogy_app");
        await client.query("SELECT set_config('app.user_id', $1, true)", [
          outsiderId,
        ]);
        const res = await client.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM public.article WHERE id = $1",
          [articleId],
        );
        return res.rows[0].n;
      } finally {
        await client.query("ROLLBACK");
      }
    });
    expect(visibleToOutsider).toBe(0);
  });
});
