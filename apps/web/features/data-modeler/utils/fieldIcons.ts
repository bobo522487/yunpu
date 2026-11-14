import {
  FileKey,
  Type,
  Mail,
  CheckCircle2,
  Calendar,
  DollarSign,
  Package,
  ShoppingCart,
  ArrowUpDown,
  Hash,
  ToggleLeft,
  Braces,
  LucideIcon,
} from 'lucide-react';
import { FieldIconKey, SchemaField, SchemaFieldType } from '../../../types';

export const FIELD_ICON_MAP: Record<FieldIconKey, LucideIcon> = {
  key: FileKey,
  text: Type,
  mail: Mail,
  check: CheckCircle2,
  calendar: Calendar,
  dollar: DollarSign,
  package: Package,
  cart: ShoppingCart,
  arrowUpDown: ArrowUpDown,
  hash: Hash,
  toggle: ToggleLeft,
  braces: Braces,
};

export const DATA_TYPE_META: Array<{
  id: SchemaFieldType;
  label: string;
  iconKey: FieldIconKey;
  icon: LucideIcon;
}> = [
  { id: 'varchar', label: 'Varchar', iconKey: 'text', icon: Type },
  { id: 'int', label: 'Integer', iconKey: 'hash', icon: Hash },
  { id: 'bigint', label: 'BigInt', iconKey: 'hash', icon: Hash },
  { id: 'float', label: 'Float', iconKey: 'dollar', icon: DollarSign },
  { id: 'boolean', label: 'Boolean', iconKey: 'toggle', icon: ToggleLeft },
  { id: 'date with time', label: 'Date with Time', iconKey: 'calendar', icon: Calendar },
  { id: 'jsonb', label: 'JSONB', iconKey: 'braces', icon: Braces },
  { id: 'serial', label: 'Serial', iconKey: 'key', icon: FileKey },
];

export const DRAWER_DATA_TYPES = DATA_TYPE_META.filter((t) => t.id !== 'bigint');

export const TYPE_CONSTRAINTS: Record<
  SchemaFieldType,
  { pk: boolean; fk: boolean; unique: boolean; notNull: boolean }
> = {
  serial: { pk: true, fk: false, unique: true, notNull: true },
  varchar: { pk: true, fk: true, unique: true, notNull: true },
  int: { pk: true, fk: true, unique: true, notNull: true },
  bigint: { pk: true, fk: true, unique: true, notNull: true },
  float: { pk: true, fk: true, unique: true, notNull: true },
  boolean: { pk: false, fk: false, unique: false, notNull: true },
  'date with time': { pk: false, fk: false, unique: false, notNull: true },
  jsonb: { pk: false, fk: false, unique: false, notNull: true },
};

export const getIconKeyForType = (type: SchemaFieldType): FieldIconKey => {
  return DATA_TYPE_META.find((t) => t.id === type)?.iconKey || 'text';
};

export const getTypeIcon = (type: SchemaFieldType): LucideIcon => {
  return DATA_TYPE_META.find((t) => t.id === type)?.icon || Type;
};

export const resolveFieldIcon = (
  field: Pick<SchemaField, 'iconName' | 'type'>
): LucideIcon => {
  if (field.iconName && FIELD_ICON_MAP[field.iconName]) {
    return FIELD_ICON_MAP[field.iconName];
  }
  return getTypeIcon(field.type);
};
