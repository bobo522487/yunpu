import { SchemaField } from '../types';

export const INITIAL_SCHEMAS: Record<string, SchemaField[]> = {
  clan_members: [
    { id: 'id', name: 'ID', type: 'serial', width: 60, iconName: 'key', isPrimary: true, isUnique: true, isNullable: false, defaultValue: 'auto-inc' },
    { id: 'name', name: '名讳', type: 'varchar', width: 160, iconName: 'text', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '', flex: true },
    { id: 'courtesyName', name: '字号', type: 'varchar', width: 140, iconName: 'text', isPrimary: false, isUnique: false, isNullable: true, defaultValue: '' },
    { id: 'generation', name: '世次', type: 'int', width: 100, iconName: 'arrowUpDown', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '1' },
    { id: 'rank', name: '排行', type: 'varchar', width: 120, iconName: 'check', isPrimary: false, isUnique: false, isNullable: true, defaultValue: '长子' },
    { id: 'officialTitle', name: '功名官阶', type: 'varchar', width: 180, iconName: 'text', isPrimary: false, isUnique: false, isNullable: true, defaultValue: '' },
  ],
  branch_records: [
    { id: 'id', name: 'ID', type: 'serial', width: 60, iconName: 'key', isPrimary: true, isUnique: true, isNullable: false, defaultValue: 'auto-inc' },
    { id: 'branchName', name: '房支名称', type: 'varchar', width: 200, iconName: 'text', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '', flex: true },
    { id: 'ancestor', name: '始迁祖', type: 'varchar', width: 140, iconName: 'text', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '' },
    { id: 'residence', name: '聚居地', type: 'varchar', width: 200, iconName: 'text', isPrimary: false, isUnique: false, isNullable: true, defaultValue: '' },
  ],
};

export const INITIAL_RECORDS: Record<string, Record<string, any>[]> = {
  clan_members: [
    { id: 1, name: '元英', courtesyName: '伯宣', generation: 1, rank: '始祖', officialTitle: '乡饮宾，授奉议大夫' },
    { id: 2, name: '伯康', courtesyName: '子安', generation: 2, rank: '长子', officialTitle: '岁贡生，训导' },
    { id: 3, name: '伯虚', courtesyName: '子顺', generation: 2, rank: '次子', officialTitle: '武略骑尉' },
    { id: 4, name: '伯崇', courtesyName: '德隆', generation: 2, rank: '三子', officialTitle: '廪膳生员' },
    { id: 5, name: '延年', courtesyName: '寿昌', generation: 3, rank: '长子', officialTitle: '庠生' },
  ],
  branch_records: [
    { id: 1, branchName: '桐梓狮子山长房', ancestor: '伯康公', residence: '贵州省遵义市桐梓县' },
    { id: 2, branchName: '西塘东山三房', ancestor: '伯崇公', residence: '江西省九江市德安县' },
  ],
};
