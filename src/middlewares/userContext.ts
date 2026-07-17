import { Request, Response, NextFunction } from 'express';
import { UserContextService } from '../services/userContextService.js';
import { getUserService } from '../services/userService.js';
import { getSystemConfigService } from '../services/systemConfigService.js';
import { IUser } from '../types/index.js';

const userContextService = UserContextService.getInstance();

/**
 * 控制台 API 用户上下文中间件。
 * 用户来自 JWT（auth 中间件已写入 req.user），用 ALS 包裹 next()，
 * 使整条请求链路获得并发安全的请求级用户上下文。
 */
export const userContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const currentUser = (req as any).user as IUser | undefined;
  if (currentUser) {
    return userContextService.runWithContext(currentUser, () => next());
  }
  next();
};

/**
 * SSE / MCP 端点用户上下文中间件。
 *
 * 之前实现：直接信任 URL 里的 :user 参数，isAdmin 硬编码 false（带 TODO）。
 * 现在改造：
 *  - skipAuth / bearer 鉴权通过 => 视为系统级访问，无具体用户上下文（与全局路由一致）。
 *  - 带 :user 参数 => 到数据库校验该用户真实存在，并取真实 isAdmin，再设上下文；
 *    不存在的用户直接 403。
 *  - 全局路由（无 :user）=> 无用户上下文。
 */
export const sseUserContextMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const systemConfigService = getSystemConfigService();
    const systemConfig = await systemConfigService.getSystemConfig();

    // 关闭鉴权 => 全局开放
    if (systemConfig?.routing?.skipAuth) {
      next();
      return;
    }

    const routingConfig = systemConfig?.routing || ({} as any);

    // bearer 鉴权通过 => 系统级访问，无具体用户
    if (routingConfig.enableBearerAuth) {
      const authHeader = req.headers.authorization;
      if (
        authHeader &&
        authHeader.startsWith('Bearer ') &&
        authHeader.substring(7) === routingConfig.bearerAuthKey
      ) {
        next();
        return;
      }
    }

    const username = req.params.user;
    if (username) {
      const userService = getUserService();
      const user = await userService.getUserByUsernameWithPassword(username);
      if (!user) {
        res.status(403).send('Unknown user');
        return;
      }
      const ctxUser: IUser = {
        username: user.username,
        password: '',
        isAdmin: user.isAdmin || false,
      };
      return userContextService.runWithContext(ctxUser, () => next());
    }

    // 全局路由：无用户上下文（管理员/系统级）
    next();
  } catch (error) {
    console.error('Error in SSE user context middleware:', error);
    next(error);
  }
};
