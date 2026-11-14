
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { GridItemData } from '../types';

export type SetterType = 'text' | 'number' | 'select' | 'switch' | 'color' | 'textarea' | 'icon' | 'json' | 'buttonGroup';

export interface PropSetter {
  component: SetterType;
  props?: Record<string, any>;
}

export interface PropDefinition {
  name: string;
  label: string;
  type: string;
  defaultValue?: any;
  description?: string;
  group?: string; // e.g., 'General', 'Style', 'Layout'
  target?: 'root' | 'content'; // Where to save the property: 'content' (default) or 'root' (GridItemData)
  setter?: PropSetter;
}

export interface WidgetTraits {
  isContainer?: boolean;
  isResizable?: boolean;
  isFormItem?: boolean;
}

export interface WidgetDataConfig {
  hasDataSource: boolean;
  dataType?: 'array' | 'object' | 'value';
}

export interface WidgetEvent {
  name: string;
  label: string;
  args?: string[];
}

export interface WidgetManifest {
  type: string;
  name: string;
  icon: LucideIcon;
  category: string;
  defaultSize: { w: number; h: number };
  traits?: WidgetTraits;
  properties: PropDefinition[];
  data?: WidgetDataConfig;
  events?: WidgetEvent[];
}

export interface WidgetProps {
  item: GridItemData;
  [key: string]: any; // Content properties spread
}

export interface WidgetDefinition {
  manifest: WidgetManifest;
  component: React.FC<WidgetProps>;
}

export interface WidgetRegistry {
  register: (def: WidgetDefinition) => void;
  get: (type: string) => WidgetDefinition | undefined;
  getAll: () => WidgetDefinition[];
  getByCategory: (category: string) => WidgetDefinition[];
  getCategories: () => string[];
}
