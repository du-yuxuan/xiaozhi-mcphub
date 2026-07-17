import { AsyncLocalStorage } from 'node:async_hooks';
import { IUser } from '../types/index.js';

/**
 * 请求级用户上下文（基于 AsyncLocalStorage）。
 *
 * 之前的实现是一个进程级单例（全局只有一个 currentUser 槽位），
 * 多个请求并发时会互相覆盖上下文，对多用户是致命的。
 * 现在改用 AsyncLocalStorage，上下文随请求异步链路传播，并发安全。
 */
const userAls = new AsyncLocalStorage<IUser | null>();

export class UserContextService {
  private static instance: UserContextService;

  static getInstance(): UserContextService {
    if (!UserContextService.instance) {
      UserContextService.instance = new UserContextService();
    }
    return UserContextService.instance;
  }

  /**
   * 在指定用户上下文中执行 fn，所有派生的异步操作都会继承该上下文。
   * 用于中间件包裹 next()，使整条请求链路获得用户上下文。
   */
  runWithContext<T>(user: IUser | null, fn: () => T): T {
    return userAls.run(user, fn);
  }

  /**
   * 获取当前请求的用户上下文。
   */
  getCurrentUser(): IUser | null {
    return userAls.getStore() ?? null;
  }

  /**
   * 设置当前异步上下文的用户（enterWith 仅在当前及派生上下文生效）。
   * 保留以兼容旧调用点；优先使用 runWithContext。
   */
  setCurrentUser(user: IUser): void {
    userAls.enterWith(user);
  }

  /**
   * 清除当前上下文用户。ALS 无法真正“取消”上下文，这里置空。
   */
  clearCurrentUser(): void {
    userAls.enterWith(null);
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.isAdmin || false;
  }

  hasUser(): boolean {
    return this.getCurrentUser() !== null;
  }
}
