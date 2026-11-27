import type { TxDatabase } from "../../db/with-tenant-transaction";
import { insertFolderInTx } from "../folder/service";
import { createLineageInTx } from "../lineage/service";
import {
  createPersonEventInTx,
  createPersonInTx,
  createPersonNameInTx,
  createRelationInTx,
} from "../person/service";
import { createProjectInTx } from "../project/service";

/** Seed an editable, deletable demo family project for a brand-new user's default organization. */
export async function seedDemoFamilyProjectInTx(
  db: TxDatabase,
  organizationId: string,
): Promise<void> {
  const project = await createProjectInTx(
    db,
    organizationId,
    {
      name: "义门陈氏宗谱（范例）",
      status: "in_progress",
      surname: "陈",
      ancestor: "陈旺",
      hallName: "义门堂",
      originText: "江西九江德安县义门村",
      description:
        "系统为新用户初始化的三世同堂家族范例，可直接编辑体验，也可随时删除。",
      colorTheme: "sky",
      projectLevel: 1,
    },
    { skipStarterLineage: true },
  );

  const folder = await insertFolderInTx(db, organizationId, project.id, {
    name: "总世系与支系",
    seq: 0,
  });

  const { lineage } = await createLineageInTx(
    db,
    organizationId,
    project.id,
    {
      folderId: folder.id,
      name: "义门陈氏总世系",
      surname: "陈",
      hallName: "义门堂",
      progenitor: "陈旺",
      region: {
        schemaVersion: 1,
        kind: "structured",
        country: "中国",
        province: "江西省",
        city: "九江市",
        district: "德安县",
        originalText: "江西九江德安县义门村",
      },
      seq: 0,
    },
    { skipStarterProgenitor: true },
  );

  // 第一世
  const chenWang = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "陈旺",
    surname: "陈",
    givenName: "旺",
    sex: "male",
    birthYear: 815,
    deathYear: 882,
    isLiving: false,
    generationWord: "旺",
    relationTitle: "始祖",
    siblingOrder: 1,
    birthInfo: {
      structuredDate: {
        schemaVersion: 1,
        kind: "date",
        calendar: "gregorian",
        qualifier: "exact",
        precision: "year",
        parts: { year: 815 },
      },
      structuredPlace: {
        schemaVersion: 1,
        kind: "structured",
        country: "中国",
        province: "江西省",
        city: "九江市",
        district: "德安县",
        originalText: "江州德安太平乡",
      },
    },
    deathInfo: {
      structuredDate: {
        schemaVersion: 1,
        kind: "date",
        calendar: "gregorian",
        qualifier: "exact",
        precision: "year",
        parts: { year: 882 },
      },
      structuredPlace: {
        schemaVersion: 1,
        kind: "structured",
        country: "中国",
        province: "江西省",
        city: "九江市",
        district: "德安县",
        originalText: "德安县义门村祖茔",
      },
    },
    biography: "义门陈氏立家始祖，定居江州德安太平乡常乐里，确立同居共爨家法。",
  });

  const linShi = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "林氏",
    surname: "林",
    givenName: "淑贤",
    sex: "female",
    birthYear: 818,
    deathYear: 886,
    isLiving: false,
    relationTitle: "始祖母",
    biography: "始祖陈旺配室，佐理家政，谨守礼法。",
  });

  // 第二世
  const chenJi = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "陈机",
    surname: "陈",
    givenName: "机",
    sex: "male",
    birthYear: 840,
    deathYear: 905,
    isLiving: false,
    generationWord: "机",
    relationTitle: "二世长子",
    siblingOrder: 1,
    biography: "长子，主理宗族田产与义学。",
  });

  const wangShi = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "王氏",
    surname: "王",
    givenName: "兰若",
    sex: "female",
    birthYear: 842,
    deathYear: 909,
    isLiving: false,
    relationTitle: "二世长媳",
  });

  const chenGan = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "陈感",
    surname: "陈",
    givenName: "感",
    sex: "male",
    birthYear: 843,
    deathYear: 912,
    isLiving: false,
    generationWord: "感",
    relationTitle: "二世次子",
    siblingOrder: 2,
    biography: "次子，司理家仓与宾客礼仪。",
  });

  const zhouShi = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "周氏",
    surname: "周",
    givenName: "清仪",
    sex: "female",
    birthYear: 846,
    deathYear: 916,
    isLiving: false,
    relationTitle: "二世次媳",
  });

  // 第三世
  const chenBoxuan = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "陈伯宣",
    surname: "陈",
    givenName: "伯宣",
    sex: "male",
    birthYear: 866,
    deathYear: 938,
    isLiving: false,
    generationWord: "伯",
    relationTitle: "三世长孙",
    siblingOrder: 1,
    biography: "博学善文，隐居庐山授徒，助修《义门家法》。",
  });

  const chenZhongxuan = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "陈仲宣",
    surname: "陈",
    givenName: "仲宣",
    sex: "male",
    birthYear: 869,
    deathYear: 941,
    isLiving: false,
    generationWord: "仲",
    relationTitle: "三世次孙",
    siblingOrder: 2,
    biography: "秉性笃厚，创东佳书堂。",
  });

  const chenJixuan = await createPersonInTx(db, organizationId, project.id, {
    lineageId: lineage.id,
    displayName: "陈季宣",
    surname: "陈",
    givenName: "季宣",
    sex: "male",
    birthYear: 874,
    isLiving: true,
    generationWord: "季",
    relationTitle: "三世嗣孙",
    siblingOrder: 1,
    notes: "由陈感过继立嗣，掌理书院藏书。",
  });

  // 名号别名
  await createPersonNameInTx(db, organizationId, project.id, chenWang.id, {
    kind: "courtesy",
    value: "子兴",
    label: "字",
  });
  await createPersonNameInTx(db, organizationId, project.id, chenJi.id, {
    kind: "courtesy",
    value: "道枢",
    label: "字",
  });
  await createPersonNameInTx(db, organizationId, project.id, chenBoxuan.id, {
    kind: "art",
    value: "庐山居士",
    label: "号",
  });
  await createPersonNameInTx(db, organizationId, project.id, chenBoxuan.id, {
    kind: "posthumous",
    value: "文恪",
    label: "谥",
  });

  // 人物关系（含配偶、亲子、继嗣）
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: chenWang.id,
    toPersonId: linShi.id,
    kind: "spouse",
    fromRoleLabel: "夫",
    toRoleLabel: "元配",
    sortOrder: 0,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: chenWang.id,
    toPersonId: chenJi.id,
    kind: "biological_parent",
    sortOrder: 0,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: linShi.id,
    toPersonId: chenJi.id,
    kind: "biological_parent",
    sortOrder: 0,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: chenWang.id,
    toPersonId: chenGan.id,
    kind: "biological_parent",
    sortOrder: 1,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: linShi.id,
    toPersonId: chenGan.id,
    kind: "biological_parent",
    sortOrder: 1,
  });

  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: chenJi.id,
    toPersonId: wangShi.id,
    kind: "spouse",
    fromRoleLabel: "夫",
    toRoleLabel: "正室",
    sortOrder: 0,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: chenJi.id,
    toPersonId: chenBoxuan.id,
    kind: "biological_parent",
    sortOrder: 0,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: wangShi.id,
    toPersonId: chenBoxuan.id,
    kind: "biological_parent",
    sortOrder: 0,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: chenJi.id,
    toPersonId: chenZhongxuan.id,
    kind: "biological_parent",
    sortOrder: 1,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: wangShi.id,
    toPersonId: chenZhongxuan.id,
    kind: "biological_parent",
    sortOrder: 1,
  });

  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: chenGan.id,
    toPersonId: zhouShi.id,
    kind: "spouse",
    fromRoleLabel: "夫",
    toRoleLabel: "正室",
    sortOrder: 0,
  });
  await createRelationInTx(db, organizationId, project.id, {
    fromPersonId: chenGan.id,
    toPersonId: chenJixuan.id,
    kind: "adoptive_parent",
    fromRoleLabel: "嗣父",
    toRoleLabel: "嗣子",
    sortOrder: 0,
  });

  // 生平事件
  await createPersonEventInTx(db, organizationId, project.id, chenWang.id, {
    type: "residence",
    structuredDate: {
      schemaVersion: 1,
      kind: "date",
      calendar: "gregorian",
      qualifier: "about",
      precision: "year",
      parts: { year: 845 },
    },
    structuredPlace: {
      schemaVersion: 1,
      kind: "structured",
      country: "中国",
      province: "江西省",
      city: "九江市",
      district: "德安县",
      originalText: "江州德安义门村",
    },
    description: "率族迁居德安义门村，营建义门祖宅与宗祠。",
    sortOrder: 0,
  });
  await createPersonEventInTx(db, organizationId, project.id, chenWang.id, {
    type: "death",
    structuredDate: {
      schemaVersion: 1,
      kind: "date",
      calendar: "gregorian",
      qualifier: "exact",
      precision: "year",
      parts: { year: 882 },
    },
    description: "卒于义门祖宅，遗命子孙合居共爨、耕读传家。",
    sortOrder: 1,
  });
  await createPersonEventInTx(db, organizationId, project.id, chenBoxuan.id, {
    type: "career",
    structuredDate: {
      schemaVersion: 1,
      kind: "date",
      calendar: "gregorian",
      qualifier: "about",
      precision: "year",
      parts: { year: 895 },
    },
    description: "于庐山设馆讲学，修葺宗谱凡例与家训三十三条。",
    sortOrder: 0,
  });
}
