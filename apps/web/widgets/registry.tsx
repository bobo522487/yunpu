
import { WidgetDefinition, WidgetRegistry } from './types';
import { ButtonWidget } from './Core/Button';
import { InputWidget, EmailWidget, PasswordWidget } from './Core/Input';
import { TextAreaWidget } from './Core/TextArea';
import { TextWidget } from './Core/Text';
import { TableWidget } from './Core/Table';
import { ChartWidget } from './Core/Chart';
import { StatWidget } from './Core/Stat';
import { ImageWidget } from './Core/Image';
import { BadgeWidget } from './Core/Badge';
import { SelectWidget } from './Core/Select';

class RegistryImpl implements WidgetRegistry {
  private widgets: Map<string, WidgetDefinition> = new Map();

  register(def: WidgetDefinition) {
    this.widgets.set(def.manifest.type, def);
  }

  get(type: string) {
    return this.widgets.get(type);
  }

  getAll() {
    return Array.from(this.widgets.values());
  }

  getByCategory(category: string) {
    return this.getAll().filter(w => w.manifest.category === category);
  }

  getCategories() {
    const categories = new Set(this.getAll().map(w => w.manifest.category));
    return Array.from(categories).sort((a, b) => {
       const order = ['常用组件', '文本输入', '表单控件', '数据展示', '媒体展示', '布局'];
       const idxA = order.indexOf(a);
       const idxB = order.indexOf(b);
       
       if (idxA !== -1 && idxB !== -1) return idxA - idxB;
       if (idxA !== -1) return -1;
       if (idxB !== -1) return 1;
       
       return a.localeCompare(b);
    });
  }
}

export const registry = new RegistryImpl();

// Register Core Widgets
registry.register(ButtonWidget);
registry.register(InputWidget);
registry.register(EmailWidget);
registry.register(PasswordWidget);
registry.register(TextAreaWidget);
registry.register(TextWidget);
registry.register(TableWidget);
registry.register(ChartWidget);
registry.register(StatWidget);
registry.register(ImageWidget);
registry.register(BadgeWidget);
registry.register(SelectWidget);
