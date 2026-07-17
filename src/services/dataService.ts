import { IUser, McpSettings } from '../types/index.js';
import { UserContextService } from './userContextService.js';

export interface DataService {
  foo(): void;
  filterData(data: any[], user?: IUser): any[];
  filterSettings(settings: McpSettings, user?: IUser): McpSettings;
  mergeSettings(all: McpSettings, newSettings: McpSettings, user?: IUser): McpSettings;
  getPermissions(user: IUser): string[];
}

/**
 * 数据过滤服务。
 *
 * filterData 之前是空实现（直接 return data），导致所有用户看到全部数据。
 * 现在基于请求级用户上下文做 owner 隔离：
 *  - 无用户上下文（内部/系统访问，如小智客户端初始化）或管理员 => 返回全部
 *  - 普通用户 => 仅返回 owner === 用户名 的资源（其名下自建的服务器/分组）
 */
export class DataServiceImpl implements DataService {
  foo() {
    console.log('default implementation');
  }

  filterData(data: any[], user?: IUser): any[] {
    const current = user ?? UserContextService.getInstance().getCurrentUser();
    if (!current || current.isAdmin) {
      return data;
    }
    return data.filter((item) => {
      const owner = item?.owner;
      const shared = item?.shared === true;
      // shared 资源对所有用户可见；owner 为空的兜底为共享；否则要求严格归属匹配
      return shared || !owner || owner === current.username;
    });
  }

  filterSettings(settings: McpSettings, _user?: IUser): McpSettings {
    return settings;
  }

  mergeSettings(all: McpSettings, newSettings: McpSettings, _user?: IUser): McpSettings {
    return newSettings;
  }

  getPermissions(_user: IUser): string[] {
    return ['*'];
  }
}
