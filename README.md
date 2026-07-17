# xiaozhi-mcphub：多用户 MCP 工具桥接与控制台

在 [MCPHub](https://github.com/samanhappy/mcphub) 与 [xiaozhi-mcphub](https://github.com/huangjunsen0406/xiaozhi-mcphub) 基础上二次开发，**新增完整的真正多用户隔离、权限控制、资源共享和超管中心**。

![控制面板预览](assets/dashboard.zh.png)

## 🚀 与原版的主要差异

### 1. 真正的多用户隔离（核心新增）

原版只有单用户 + 控制台登录账号区分，**所有用户看到同一份数据**。本项目实现了完整的租户级隔离：

| 能力 | 原版 | 本项目 |
|---|---|---|
| 用户上下文 | 全局单例（并发不安全） | AsyncLocalStorage 请求级（并发安全） |
| 服务器/分组/端点 | 全局共享 | 按 owner 隔离，普通用户只能看到自己的 |
| SSE 路由鉴权 | 信任 URL 参数（无校验） | 校验用户真实存在 + 真实 isAdmin |
| 数据过滤 | `filterData` 空实现 | 按 owner + shared 过滤 |

### 2. 权限控制系统

超管可以为每个普通用户设置细粒度权限：

| 权限 | 说明 | 默认 |
|---|---|---|
| `canAccessMarket` | 是否可以访问市场页面 | ❌ 关闭 |
| `canCreateServer` | 是否可以自行添加服务器 | ❌ 关闭 |
| `isAdmin` | 管理员（可管理一切） | ❌ |

- 权限写入 JWT，前后端双重校验
- 关闭权限后：前端隐藏按钮/页面，后端 API 返回 403

### 3. 资源共享机制

超管可以将自己名下的服务器/分组/小智端点**共享给所有普通用户**：

| 操作 | 所有者 | 管理员 | 普通用户（共享） |
|---|---|---|---|
| 查看列表 | ✅ | ✅ | ✅ |
| 启用/禁用 | ✅ | ✅ | ✅ |
| 使用工具 | ✅ | ✅ | ✅ |
| 查看/修改配置 | ✅ | ✅ | ❌ |
| 修改/删除 | ✅ | ✅ | ❌ |

### 4. 用户追踪

每个用户记录：
- 登录次数（`loginCount`）
- 最后登录时间（`lastLoginAt`）
- 最后活动时间（`lastActivityAt`）

### 5. 批量用户管理

超管中心支持：
- **批量添加**：粘贴 `用户名,密码` 列表，一键创建
- **批量权限**：勾选多个用户，统一设置市场/服务器权限
- **批量删除**：勾选多个用户，一键删除

### 6. 超管中心页面

集中管理入口（`/users`，仅管理员可见）：
- 用户统计卡片（用户数、服务器、分组、端点）
- 用户表格（含追踪数据、权限状态）
- 共享管理面板（一键切换服务器/分组共享状态）
- 管理中心快捷入口

## 🔧 快速开始

### 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/huangjunsen0406/xiaozhi-mcphub.git
cd xiaozhi-mcphub
docker compose up -d --build
```

访问 `http://localhost:3000`，默认管理员 `admin` / `admin123`

### 方式二：使用预构建镜像

```bash
# docker-compose.deploy.yml 中设置 image
docker compose -f docker-compose.deploy.yml up -d
```

### 方式三：本地开发

```bash
pnpm install
docker compose up -d db  # 只启动数据库
export DATABASE_URL="postgres://xiaozhi:xiaozhi123456@localhost:5432/xiaozhi_mcphub"
pnpm dev  # 后端 :3000 + 前端 :5173
```

## 📖 使用指南

### 超管（管理员）

1. 登录后访问 **超管中心**（侧边栏 → 用户）
2. **添加用户**：单个添加或批量添加（粘贴用户名,密码列表）
3. **设置权限**：编辑用户，控制市场访问和服务器创建权限
4. **共享资源**：在共享管理面板，一键切换服务器/分组的共享状态
5. **查看追踪**：用户表格显示登录次数、最后登录时间

### 普通用户

1. 管理员创建账号后登录
2. 只能看到**自己名下**的服务器/分组/端点
3. 管理员**共享**的资源也可查看和启用，但不能修改配置
4. 默认不能添加服务器、不能访问市场（需管理员授权）

## 🏗️ 技术架构

### 后端多用户实现

```
请求 → auth 中间件（JWT 验证 + 权限补充）
     → userContext 中间件（AsyncLocalStorage 设置用户上下文）
     → 路由处理器
     → dataService.filterData（按 owner + shared 过滤）
     → ensureServerAccess / ensureServerOwnership（归属校验）
```

### 关键文件

| 文件 | 说明 |
|---|---|
| `src/services/userContextService.ts` | AsyncLocalStorage 请求级用户上下文 |
| `src/services/dataService.ts` | 按 owner + shared 过滤数据 |
| `src/middlewares/auth.ts` | JWT 验证 + 权限补充 + `requirePermission` 中间件 |
| `src/middlewares/userContext.ts` | 控制台 + SSE 用户上下文设置 |
| `src/controllers/serverController.ts` | 服务器归属校验（共享 vs 所有权） |
| `src/controllers/userController.ts` | 用户 CRUD + 批量操作 |
| `src/db/entities/User.ts` | 用户实体（含追踪 + 权限字段） |

### 新增 API

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/users/batch` | 批量创建用户 |
| `PUT` | `/api/users/batch/permissions` | 批量设置权限 |
| `DELETE` | `/api/users/batch` | 批量删除用户 |
| `PUT` | `/api/servers/:name/share` | 切换服务器共享 |
| `PUT` | `/api/groups/:id/share` | 切换分组共享 |
| `PUT` | `/api/xiaozhi/endpoints/:id/share` | 切换端点共享 |
| `PUT` | `/api/users/:username/permissions` | 设置单个用户权限 |

## 📦 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | postgres://xiaozhi:... | 数据库连接串 |
| `JWT_SECRET` | 自动生成 | JWT 签名密钥（生产建议手动设置） |
| `SMART_ROUTING_ENABLED` | false | 智能路由开关 |
| `BASE_PATH` | 空 | 二级路径部署（如 /mcphub） |
| `OPENAI_API_KEY` | - | 智能路由所需 |

## 📄 许可

Apache License 2.0，基于 [MCPHub](https://github.com/samanhappy/mcphub) 和 [xiaozhi-mcphub](https://github.com/huangjunsen0406/xiaozhi-mcphub) 二次开发。
