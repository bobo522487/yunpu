export type RelationKind =
  | '生子'
  | '嗣子'
  | '继子'
  | '祧子'
  | '养子'
  | '义子'
  | '抚子'
  | '螟蛉子'
  | '随母子'
  | '赘子'
  | '契子'
  | '假子'
  | '外子'
  | '异姓子'
  | '抱子'
  | '拾子'
  | '寄子'
  | '生女'
  | '养女'
  | '继女'
  | string;

export interface SpouseInfo {
  id?: string;
  relationLabel?: string; // 关系称谓：原配、继配、侧室、配偶
  prefix?: string; // 前缀补充称谓
  name: string;
  clanOrigin?: string; // 岳家籍贯/郡望 如: 妣李氏，系出清河
  title?: string; // 封号/孺人/宜人
  birthDate?: string;
  deathDate?: string;
  burialPlace?: string; // 葬地与合葬信息
  remarks?: string; // 补充备注
}

export interface PersonBirthInfo {
  date?: string; // 出生日期
  place?: string; // 出生地
  summary?: string; // 出生描述
}

export interface PersonCareerInfo {
  educationLevel?: string; // 学历：小学~博士
  graduationStatus?: string; // 毕业 / 在读 / 肄业
  school?: string; // 就读学校
  major?: string; // 就读专业
  educationSummary?: string; // 文化程度综合描述
  profession?: string; // 公司/单位名称+职务
  title?: string; // 荣誉称号、职称、头衔
  resume?: string; // 履历
  lifeSummary?: string; // 生平记述
}

export interface PersonDeathInfo {
  date?: string; // 去世时间
  burialPlace?: string; // 卒葬地+墓址坐向
  summary?: string; // 卒葬描述
  age?: number; // 享寿
}

export interface PersonSequenceMeta {
  mainLabel?: string; // 主世序（始祖名讳）
  mainNumber?: number; // 主世序序号
  subLabel?: string; // 子世序（分支名讳）
  subNumber?: number; // 子世序序号
  originalPage?: number; // 原谱页码
}

export interface PersonPrivateInfo {
  idCardName?: string; // 实名姓名
  idCardNum?: string; // 身份证号
  mobile?: string; // 联系电话
  address?: string; // 联系地址
}

export interface PersonRecord {
  id: string;
  branchId: string; // 所属谱系图ID

  // 1. 核心身份与名讳
  avatarUrl?: string; // 人物照片 DataURL 或路径
  surname?: string; // 姓氏
  name: string; // 谱名
  legalName?: string; // 常用名（身份证姓名）
  courtesyName?: string; // 字/号/别名/谥号
  childhoodName?: string; // 乳名/幼名
  gender: 'male' | 'female';
  status: 'living' | 'deceased'; // 健在 / 已故

  // 2. 世系与宗法关系（子女由 fatherId 单源派生，不在此冗余存储）
  generation: number; // 世次 如: 1 (第1世)
  generationWord?: string; // 派语字辈
  hangOrder?: string; // 行第 如: 行十八
  rank?: string; // 排行显示 如: 长子、次子、长女
  siblingOrder?: number; // 同父兄弟姊妹排序权重
  fatherId: string | null; // 父亲ID
  fatherName?: string;
  motherName?: string; // 生母
  relationType?: RelationKind; // 与父母关系：生子/嗣子/继子...
  relationTitle?: string; // 关系称谓：如 始迁祖
  relationPrefix?: string; // 前缀：如 左徒
  relationNotes?: string; // 关系备注
  lineageRemarks?: string; // 世系备注：如 迁江西
  branchLabel?: string; // 分房
  headingLine?: string; // 题行

  // 3. 配偶（轻量有序结构体列表）
  spouses: SpouseInfo[];

  // 4. 生命周期内聚子对象
  birth?: PersonBirthInfo;
  career?: PersonCareerInfo;
  death?: PersonDeathInfo;
  sequenceMeta?: PersonSequenceMeta;
  privateInfo?: PersonPrivateInfo;

  // 5. 顶层兼容展示字段（供世系图节点、表格、行传录直接读取）
  birthDate?: string; // 生于
  deathDate?: string; // 卒于
  age?: number; // 享寿
  burialPlace?: string; // 墓茔葬地及坐向
  officialTitle?: string; // 功名/官阶/头衔

  // 6. 传记、页码与末尾备注
  biography?: string; // 传记简介/生平事略
  biographyPage?: number; // 行传页码
  biographyOrder?: number; // 行传录号/分房序号
  notes?: string; // 末尾备注
}

export type LineageViewMode = 'tree' | 'biography' | 'grid' | 'table';

export type DrawerLayoutMode = 'narrow' | 'wide';

export interface BiographyPreviewPreferences {
  showBirth: boolean;
  showBirthDetail: boolean;
  showLife: boolean;
  showDeath: boolean;
  showDeathDetail: boolean;
  showBiography: boolean;
  showChildren: boolean;
  showRemarks: boolean;
  showPrivateInfo: boolean;
}
