# Contract: 私有对象访问

对象只经应用进出。存储本身不提供匿名读取。Bun `S3Client` 使用本环境的 `endpoint`，写入时不设置公开 ACL。

## `POST /api/media`

请求头 `Authorization: Bearer <capability token>`。正文是要保存的字节，最大 1 MB。这个上限只服务本功能的证明，不是产品媒体规则。

**201**

```json
{ "ok": true, "key": "<应用生成的键>" }
```

键由应用生成，调用方不能指定。

**401**：缺少令牌、令牌错误，或令牌属于另一环境。对象不被写入。不提供产品登录。

## `GET /api/media/:key`

同样要求 `Authorization: Bearer <capability token>`。

**200**：正文与当时写入的字节一致。

**401**：缺少令牌、令牌错误，或令牌属于另一环境。

**404**：键不存在。

## 绕过应用的读取

对 MinIO 端点上该对象的 URL 发起不带根凭证的 `GET`。

**结果**：响应状态不是 200，正文不是对象内容。

不调用 `mc anonymous`。不使用 `acl: "public-read"`。不增加公开读的第二通道。
