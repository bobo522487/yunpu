import { SchemaField } from '../types';

export const INITIAL_SCHEMAS: Record<string, SchemaField[]> = {
  users: [
    { id: 'id', name: 'ID', type: 'serial', width: 60, iconName: 'key', isPrimary: true, isUnique: true, isNullable: false, defaultValue: 'auto-inc' },
    { id: 'name', name: 'Name', type: 'varchar', width: 200, iconName: 'text', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '', flex: true },
    { id: 'email', name: 'Email', type: 'varchar', width: 250, iconName: 'mail', isPrimary: false, isUnique: true, isNullable: true, defaultValue: 'null', flex: true },
    { id: 'role', name: 'Role', type: 'varchar', width: 140, iconName: 'check', isPrimary: false, isUnique: false, isNullable: false, defaultValue: 'Viewer' },
    { id: 'status', name: 'Status', type: 'varchar', width: 120, iconName: 'check', isPrimary: false, isUnique: false, isNullable: false, defaultValue: 'Active' },
    { id: 'created', name: 'Created At', type: 'date with time', width: 180, iconName: 'calendar', isPrimary: false, isUnique: false, isNullable: false, defaultValue: 'now()', timeZone: 'UTC' },
  ],
  orders: [
    { id: 'id', name: 'Order ID', type: 'serial', width: 80, iconName: 'key', isPrimary: true, isUnique: true, isNullable: false, defaultValue: 'auto-inc' },
    { id: 'customer', name: 'Customer', type: 'varchar', width: 200, iconName: 'text', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '', flex: true },
    { id: 'amount', name: 'Amount', type: 'float', width: 120, iconName: 'dollar', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '0.00' },
    { id: 'status', name: 'Status', type: 'varchar', width: 120, iconName: 'check', isPrimary: false, isUnique: false, isNullable: false, defaultValue: 'Pending' },
    { id: 'date', name: 'Order Date', type: 'date with time', width: 160, iconName: 'calendar', isPrimary: false, isUnique: false, isNullable: false, defaultValue: 'now()', timeZone: 'Asia/Shanghai' },
  ],
  products: [
    { id: 'id', name: 'SKU', type: 'serial', width: 80, iconName: 'key', isPrimary: true, isUnique: true, isNullable: false, defaultValue: 'auto-inc' },
    { id: 'name', name: 'Product Name', type: 'varchar', width: 250, iconName: 'package', isPrimary: false, isUnique: true, isNullable: false, defaultValue: '', flex: true },
    { id: 'category', name: 'Category', type: 'varchar', width: 150, iconName: 'check', isPrimary: false, isUnique: false, isNullable: false, defaultValue: 'General' },
    { id: 'price', name: 'Price', type: 'float', width: 100, iconName: 'dollar', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '0.00' },
    { id: 'stock', name: 'Stock', type: 'int', width: 100, iconName: 'cart', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '0' },
  ],
  inventory_logs: [
    { id: 'id', name: 'Log ID', type: 'serial', width: 80, iconName: 'key', isPrimary: true, isUnique: true, isNullable: false, defaultValue: 'auto-inc' },
    { id: 'product', name: 'Product SKU', type: 'varchar', width: 150, iconName: 'package', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '' },
    { id: 'change', name: 'Quantity Change', type: 'int', width: 150, iconName: 'arrowUpDown', isPrimary: false, isUnique: false, isNullable: false, defaultValue: '0' },
    { id: 'reason', name: 'Reason', type: 'varchar', width: 150, iconName: 'text', isPrimary: false, isUnique: false, isNullable: false, defaultValue: 'Restock', flex: true },
    { id: 'timestamp', name: 'Timestamp', type: 'date with time', width: 180, iconName: 'calendar', isPrimary: false, isUnique: false, isNullable: false, defaultValue: 'now()', timeZone: 'America/New_York' },
  ],
};

export const INITIAL_RECORDS: Record<string, Record<string, any>[]> = {
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active', created: '2023-10-01' },
    { id: 2, name: 'Jane Smith', email: 'jane@company.com', role: 'Editor', status: 'Active', created: '2023-10-02' },
    { id: 3, name: 'Alice Johnson', email: 'alice@test.co', role: 'Viewer', status: 'Inactive', created: '2023-10-05' },
    { id: 4, name: 'Robert Brown', email: 'bob@domain.net', role: 'Editor', status: 'Active', created: '2023-10-10' },
    { id: 5, name: 'Charlie Davis', email: 'charlie@demo.org', role: 'Viewer', status: 'Active', created: '2023-10-12' },
    { id: 6, name: 'Diana Evans', email: 'diana@corp.com', role: 'Admin', status: 'Inactive', created: '2023-10-15' },
  ],
  orders: [
    { id: 1001, customer: 'John Doe', amount: 120.5, status: 'Completed', date: '2023-11-01' },
    { id: 1002, customer: 'Jane Smith', amount: 85.0, status: 'Processing', date: '2023-11-02' },
    { id: 1003, customer: 'Alice Johnson', amount: 240.0, status: 'Pending', date: '2023-11-03' },
    { id: 1004, customer: 'Robert Brown', amount: 45.99, status: 'Completed', date: '2023-11-04' },
  ],
  products: [
    { id: 501, name: 'Wireless Mouse', category: 'Electronics', price: 29.99, stock: 150 },
    { id: 502, name: 'Mechanical Keyboard', category: 'Electronics', price: 89.99, stock: 45 },
    { id: 503, name: 'Desk Chair', category: 'Furniture', price: 199.99, stock: 12 },
    { id: 504, name: 'Monitor 27"', category: 'Electronics', price: 249.5, stock: 30 },
  ],
  inventory_logs: [
    { id: 1, product: 'SKU-501', change: 50, reason: 'Restock', timestamp: '2023-11-01 10:00 AM' },
    { id: 2, product: 'SKU-503', change: -2, reason: 'Sale', timestamp: '2023-11-01 11:30 AM' },
    { id: 3, product: 'SKU-502', change: -5, reason: 'Damage', timestamp: '2023-11-02 09:15 AM' },
  ],
};
